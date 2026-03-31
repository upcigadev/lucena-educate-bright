const axios = require('axios');

let sessionToken = null;

/**
 * Converte uma hora no formato "HH:MM" para Unix epoch (segundos inteiros).
 * O Control iD exige int para begin_time / end_time.
 *
 * Para begin_time: usa a data de hoje + HH:MM (horário de Brasília, UTC-3).
 * Para end_time:   usa uma data distante (2099-12-31) como "sem vencimento".
 *
 * Se o valor já for um número (ou string numérica), retorna como número.
 * Se não souber converter, retorna null (campo não é enviado).
 */
function parseTimeField(val, role = 'begin') {
  if (val == null || val === '') return null;
  // Já é número? retorna como int
  if (typeof val === 'number') return Math.floor(val);
  if (typeof val === 'string' && /^\d+$/.test(val.trim())) return parseInt(val.trim());

  // Formato "HH:MM" ou "HH:MM:SS"
  const match = String(val).match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;

  const hh = parseInt(match[1]);
  const mm = parseInt(match[2]);

  if (role === 'end') {
    // Sem vencimento: usa 2037-12-31 (int32 max é ~2038-01-19, então 2037 é seguro).
    // 2099 gera ~4.1 bilhões que ultrapassa int32 e o iDFace rejeita com "got uint64".
    const far = new Date('2037-12-31T00:00:00-03:00');
    far.setHours(hh, mm, 0, 0);
    return Math.floor(far.getTime() / 1000);
  }

  // begin: data de hoje + hora
  const d = new Date();
  d.setHours(hh, mm, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

async function login(ip) {
  try {
    const response = await axios.post(`http://${ip}/login.fcgi`, {
      login: 'upciga',
      password: 'lucenaupciga2026'
    }, { timeout: 5000 });
    
    if (response.data && response.data.session) {
      sessionToken = response.data.session;
      console.log(`[deviceService] Sessão obtida para IP ${ip}`);
      return sessionToken;
    }
    throw new Error('O aparelho não retornou um token válido.');
  } catch (error) {
    throw new Error(`Falha de autenticação no IP ${ip}. Verifique a rede e a senha. Erro: ${error.message}`);
  }
}

async function checkConnection(ip) {
  if (!ip) throw new Error('IP não informado');
  await login(ip);
  return { status: 'connected', ip };
}

async function startFaceCapture(ip, internalUserId, countdown = 5) {
  if (!sessionToken) await login(ip);
  
  try {
    const response = await axios.post(`http://${ip}/remote_enroll.fcgi?session=${sessionToken}`, {
      type: 'face',
      user_id: parseInt(internalUserId),
      save: true,
      sync: true,
      auto: true,      // Habilita o modo automático (ignora o botão físico)
      countdown: countdown // Configurável pela escola via IoTConfig
    }, { timeout: 60000 });

    return { status: 'success', data: response.data };
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      throw new Error('Tempo esgotado (60s). O rosto não foi posicionado no aparelho a tempo.');
    }
    throw new Error(`Falha no acionamento da câmera: ${error.message}`);
  }
}

async function registerUser(ip, userData) {
  if (!sessionToken) await login(ip);
  
  try {
    // "Upsert" no usuário do Control iD:
    // - se já existe um usuário com registration == userData.id, atualiza (modify_objects)
    // - caso contrário, cria (create_objects)
    const registrationToMatch = String(userData.id).trim();

    let matchedInternalId = null;
    try {
      const loaded = await getUsers(ip);
      const users = loaded?.users || [];

      for (const u of users) {
        const regCandidate =
          u?.registration ??
          u?.reg ??
          u?.registration_id ??
          u?.registrationId;

        // Tenta localizar o usuário pelo campo "registration".
        // Alguns firmwares podem retornar campos com nomes diferentes; então fazemos também um fallback
        // buscando o valor no conjunto de propriedades do objeto.
        const registrationMatches =
          regCandidate != null && String(regCandidate).trim() === registrationToMatch;

        const anyValueMatches =
          !registrationMatches &&
          u &&
          typeof u === 'object' &&
          Object.values(u).some(v => v != null && String(v).trim() === registrationToMatch);

        if (!registrationMatches && !anyValueMatches) continue;

        matchedInternalId =
          u?.id ??
          u?.internal_id ??
          u?.internalId ??
          u?.user_id ??
          u?.userId;
        break;
      }
    } catch (e) {
      // Se falhar ao listar usuários, seguimos para criação para não travar o fluxo.
    }

    const beginTime = parseTimeField(userData.begin_time ?? userData.beginTime ?? null, 'begin');
    const endTime   = parseTimeField(userData.end_time   ?? userData.endTime   ?? null, 'end');

    if (matchedInternalId != null) {
      await updateUser(ip, matchedInternalId, userData.name, userData.id, beginTime, endTime);
      return { status: 'success', internalUserId: matchedInternalId, updated: true };
    }

    const createValues = {
      id: parseInt(userData.id),
      name: userData.name,
      registration: userData.id,
    };
    if (beginTime != null) createValues.begin_time = beginTime;
    if (endTime   != null) createValues.end_time   = endTime;

    const response = await axios.post(`http://${ip}/create_objects.fcgi?session=${sessionToken}`, {
      object: 'users',
      values: [{
        ...createValues
      }]
    }, { timeout: 10000 });

    if (response.data && response.data.ids && response.data.ids.length > 0) {
      const internalId = response.data.ids[0];

      // ─── Vínculo ao Grupo de Acesso Padrão ───────────────────────────────
      // No Control iD, criar o usuário apenas registra a identidade; sem
      // pertencer a um Grupo de Acesso o equipamento nega a entrada.
      // group_id: 1 é o Grupo Padrão que libera o acesso geral.
      // Para regras por turno (manhã/tarde), criar grupos separados e
      // substituir o group_id conforme o horário do aluno.
      try {
        await axios.post(`http://${ip}/create_objects.fcgi?session=${sessionToken}`, {
          object: 'user_groups',
          values: [{ user_id: internalId, group_id: 1 }]
        }, { timeout: 10000 });
        console.log(`[deviceService] Usuário ${internalId} vinculado ao Grupo de Acesso 1.`);
      } catch (groupErr) {
        console.warn(
          `[deviceService] ⚠️  Falha ao vincular usuário ${internalId} ao grupo de acesso:`,
          groupErr?.message || groupErr
        );
        // Não interrompe o fluxo — a identidade já foi criada com sucesso.
      }
      // ─────────────────────────────────────────────────────────────────────

      return { status: 'success', internalUserId: internalId, created: true };
    }
    throw new Error('Falha ao obter o ID interno de criação do aparelho.');
  } catch (error) {
    if (error.response && error.response.status === 401) {
      sessionToken = null;
    }
    const details =
      error.response && error.response.data
        ? ` | payload: ${typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data)}`
        : '';
    throw new Error(`Erro na criação do usuário: ${error.message}${details}`);
  }
}

async function getUsers(ip) {
  if (!sessionToken) await login(ip);
  
  try {
    const response = await axios.post(`http://${ip}/load_objects.fcgi?session=${sessionToken}`, {
      object: 'users'
    }, { timeout: 10000 });

    return { status: 'success', users: response.data.users || [] };
  } catch (error) {
    if (error.response && error.response.status === 401) sessionToken = null;
    throw new Error(`Erro ao carregar usuários: ${error.message}`);
  }
}

async function deleteUser(ip, internalId) {
  if (!sessionToken) await login(ip);
  
  try {
    const response = await axios.post(`http://${ip}/destroy_objects.fcgi?session=${sessionToken}`, {
      object: 'users',
      where: { users: { id: parseInt(internalId) } }
    }, { timeout: 10000 });

    return { status: 'success', data: response.data };
  } catch (error) {
    if (error.response && error.response.status === 401) sessionToken = null;
    throw new Error(`Erro ao excluir usuário: ${error.message}`);
  }
}

async function updateUser(ip, internalId, newName, newRegistration, beginTime, endTime) {
  if (!sessionToken) await login(ip);
  
  try {
    const updateValues = {
      name: newName,
      registration: newRegistration,
    };
    if (beginTime != null) updateValues.begin_time = beginTime;
    if (endTime != null) updateValues.end_time = endTime;

    const response = await axios.post(`http://${ip}/modify_objects.fcgi?session=${sessionToken}`, {
      object: 'users',
      values: {
        ...updateValues,
      },
      where: { users: { id: parseInt(internalId) } }
    }, { timeout: 10000 });

    return { status: 'success', data: response.data };
  } catch (error) {
    if (error.response && error.response.status === 401) sessionToken = null;
    throw new Error(`Erro ao atualizar usuário: ${error.message}`);
  }
}

async function getUserImage(ip, internalUserId) {
  if (!sessionToken) await login(ip);
  
  try {
    const response = await axios.get(`http://${ip}/user_get_image.fcgi?session=${sessionToken}&user_id=${internalUserId}`, {
      responseType: 'arraybuffer',
      timeout: 10000
    });

    const base64Str = Buffer.from(response.data, 'binary').toString('base64');
    return { status: 'success', image: `data:image/jpeg;base64,${base64Str}` };
  } catch (error) {
    if (error.response && error.response.status === 401) sessionToken = null;
    throw new Error(`Erro ao obter imagem do usuário: ${error.message}`);
  }
}

async function getUserImageBuffer(ip, internalUserId) {
  if (!sessionToken) await login(ip);

  try {
    const response = await axios.get(
      `http://${ip}/user_get_image.fcgi?session=${sessionToken}&user_id=${internalUserId}`,
      { responseType: 'arraybuffer', timeout: 10000 }
    );
    return Buffer.from(response.data);
  } catch (error) {
    if (error.response && error.response.status === 401) sessionToken = null;
    throw new Error(`Erro ao obter imagem (buffer) do usuário: ${error.message}`);
  }
}

module.exports = {
  checkConnection,
  startFaceCapture,
  registerUser,
  getUsers,
  deleteUser,
  updateUser,
  getUserImage,
  getUserImageBuffer,
};