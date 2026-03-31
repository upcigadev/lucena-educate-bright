const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');
const deviceService = require('./src/services/deviceService');

const PORT = 3000;
// O frontend (Vite) pode rodar em portas diferentes durante o desenvolvimento.
// Mantemos uma lista explícita porque `credentials: true` não funciona com `origin: '*'`.
const FRONTEND_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://192.168.0.2:8080',
  'http://10.0.0.10:8080',
];
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: FRONTEND_ORIGINS,
    methods: ['GET', 'POST'],
  },
});

app.use(
  cors({
    origin: FRONTEND_ORIGINS,
    credentials: true,
  })
);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

function jsonError(res, status, message) {
  return res.status(status).json({ success: false, error: message });
}

app.post('/api/connect', async (req, res) => {
  const { ip } = req.body || {};
  if (!ip) {
    return jsonError(res, 400, 'Informe o ip do aparelho no corpo da requisição.');
  }
  try {
    const result = await deviceService.checkConnection(ip);
    cachedDeviceIp = ip; // cache para o proxy de fotos
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Connection error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/capture', async (req, res) => {
  const { ip, internalUserId, userId, countdown } = req.body || {};
  const uid = internalUserId ?? userId;
  if (!ip || uid == null) {
    return jsonError(res, 400, 'Informe ip e internalUserId (ou userId) no corpo da requisição.');
  }
  try {
    const countdownSecs = typeof countdown === 'number' && countdown > 0 ? countdown : 5;
    const result = await deviceService.startFaceCapture(ip, String(uid), countdownSecs);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Face capture error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/register', async (req, res) => {
  const { ip, userData } = req.body || {};
  if (!ip || !userData || userData.name == null || userData.id == null) {
    return jsonError(
      res,
      400,
      'Informe ip e userData com name e id no corpo da requisição.'
    );
  }
  try {
    const result = await deviceService.registerUser(ip, userData);
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('User registration error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/sync-users', async (req, res) => {
  const { ip, users } = req.body || {};
  if (!ip || !Array.isArray(users)) {
    return jsonError(res, 400, 'Informe ip e users (array) no corpo da requisição.');
  }

  try {
    let created = 0;
    const failed = [];

    // Mantemos sequencial para reduzir carga na ponte e reutilizar sessionToken.
    for (const u of users) {
      try {
        if (!u || u.id == null || u.name == null) continue;
        await deviceService.registerUser(ip, {
          id: u.id,
          name: u.name,
          begin_time: u.begin_time ?? u.beginTime ?? null,
          end_time: u.end_time ?? u.endTime ?? null,
        });
        created += 1;
      } catch (e) {
        failed.push({ id: u?.id ?? null, error: e?.message || String(e) });
      }
    }

    return res.json({
      success: true,
      data: {
        created,
        failedCount: failed.length,
        failed,
      },
    });
  } catch (error) {
    console.error('Sync users error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Remove um usuário do equipamento Control iD (chamado ao inativar um aluno)
app.post('/api/delete-user', async (req, res) => {
  const { ip, internalUserId } = req.body || {};
  if (!ip || internalUserId == null) {
    return jsonError(res, 400, 'Informe ip e internalUserId.');
  }
  try {
    await deviceService.deleteUser(ip, String(internalUserId));
    console.log(`[deviceService] Usuário ${internalUserId} removido do equipamento.`);
    return res.json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Busca a imagem de um único usuário no equipamento
app.post('/api/get-image', async (req, res) => {
  const { ip, internalUserId } = req.body || {};
  if (!ip || internalUserId == null) {
    return jsonError(res, 400, 'Informe ip e internalUserId no corpo da requisição.');
  }
  try {
    const result = await deviceService.getUserImage(ip, String(internalUserId));
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Get image error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Busca imagens de múltiplos usuários de forma sequencial (sem sobrecarregar o hardware)
// Body: { ip, users: [{ matricula, internalUserId }] }
// Retorna: [{ matricula, image: 'data:image/jpeg;base64,...' | null }]
app.post('/api/sync-images', async (req, res) => {
  const { ip, users } = req.body || {};
  if (!ip || !Array.isArray(users)) {
    return jsonError(res, 400, 'Informe ip e users (array de { matricula, internalUserId }) no corpo.');
  }

  const results = [];
  let fetched = 0;
  let failed = 0;

  for (const u of users) {
    try {
      if (u?.internalUserId == null) {
        results.push({ matricula: u?.matricula ?? null, image: null });
        continue;
      }
      const imgResult = await deviceService.getUserImage(ip, String(u.internalUserId));
      results.push({ matricula: u.matricula, image: imgResult.image });
      fetched += 1;
    } catch (e) {
      results.push({ matricula: u?.matricula ?? null, image: null });
      failed += 1;
    }
  }

  console.log(`[sync-images] Concluído: ${fetched} imagens obtidas, ${failed} falhas.`);
  return res.json({ success: true, data: { results, fetched, failed } });
});

// Proxy de foto: busca a imagem diretamente do hardware iDFace em tempo real.
// O frontend passa o IP via query param: GET /api/device/photo/<internalId>?ip=<ip>
// Retorna binary JPEG ou 404 se o aluno não tiver biometria cadastrada no aparelho.
let cachedDeviceIp = null; // IP salvo ao conectar via /api/connect
app.get('/api/device/photo/:internalId', async (req, res) => {
  const { internalId } = req.params;
  const ip = req.query.ip || cachedDeviceIp;
  if (!ip) {
    return res.status(400).json({ error: 'IP do dispositivo não informado. Passe ?ip= ou conecte-se primeiro via /api/connect.' });
  }
  try {
    const buffer = await deviceService.getUserImageBuffer(ip, internalId);
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'no-cache');
    return res.send(buffer);
  } catch (error) {
    // Qualquer falha (foto não existe, aparelho offline) → 404 para o AvatarFallback exibir iniciais
    return res.status(404).end();
  }
});

// Webhooks do aparelho (mesma lógica do servidor anterior; emite via Socket.IO)
app.use((req, res) => {
  const rota = req.path;

  if (rota.includes('device_is_alive') || rota.includes('secbox')) {
    return res.status(200).json({ status: 'success' });
  }

  if (rota.includes('dao')) {
    if (
      req.body &&
      req.body.object_changes &&
      req.body.object_changes[0] &&
      req.body.object_changes[0].object === 'access_logs'
    ) {
      // Normaliza `values` — pode ser objeto único ou array dependendo do firmware.
      const rawValues = req.body.object_changes[0].values;
      const valuesArray = Array.isArray(rawValues) ? rawValues : rawValues ? [rawValues] : [];

      console.log('\n[Webhook Server] 📝 Log de Acesso Recebido!');
      console.log(JSON.stringify(valuesArray, null, 2));

      if (valuesArray.length > 0) {
        io.emit('device:accessLog', {
          type: 'log',
          data: valuesArray, // sempre array
        });
      }
    }
    return res.status(200).json({ status: 'success' });
  }

  if (rota.includes('access_photo')) {
    console.log('\n[Webhook Server] 📸 Foto Biométrica Recebida!');

    // O aparelho da Control iD envia o ID do usuário na URL (query string)
    const userId = String(req.query.user_id || '');

    let base64Image = null;

    if (Buffer.isBuffer(req.body)) {
      // Corpo binário bruto (sem parser)
      base64Image = req.body.toString('base64');
    } else if (typeof req.body === 'string' && req.body.length > 0) {
      // Express converteu para string
      base64Image = Buffer.from(req.body, 'binary').toString('base64');
    } else if (req.body instanceof Uint8Array || (req.body && req.body.type === 'Buffer')) {
      base64Image = Buffer.from(req.body.data ?? req.body).toString('base64');
    }

    if (base64Image) {
      const dataUri = `data:image/jpeg;base64,${base64Image}`;
      console.log(`[Webhook Server] Emitindo foto para userId=${userId} (${dataUri.length} chars)`);
      io.emit('device:accessLog', {
        type: 'photo',
        userId,
        data: dataUri,
      });
    } else {
      console.warn('[Webhook Server] ⚠️  Corpo da foto não reconhecido:', typeof req.body, req.body ? req.body.constructor?.name : 'null');
    }

    return res.status(200).json({ status: 'success' });
  }

  return res.status(200).json({ status: 'success' });
});


server.listen(PORT, '0.0.0.0', () => {
  console.log(
    `[Server] HTTP + WebSocket escutando em 0.0.0.0:${PORT} (CORS: http://localhost:5173)`
  );
});
