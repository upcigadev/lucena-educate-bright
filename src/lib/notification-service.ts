import { db } from './mock-db';

export interface RegistroFrequenciaWebhook {
  aluno_id: string;
  hora_entrada: string;
  status: string;
  data: string;
}

export async function enviarNotificacaoFrequencia(registro: RegistroFrequenciaWebhook) {
  try {
    const res = await db.alunos.getAlunoComResponsaveis(registro.aluno_id);
    const dados = res.data;

    if (!dados || !dados.responsaveis || dados.responsaveis.length === 0) return;

    const payload = {
      aluno_nome: dados.aluno_nome,
      escola_nome: dados.escola_nome,
      horario_registro: registro.hora_entrada,
      status_frequencia: registro.status,
      responsaveis: dados.responsaveis,
    };

    const webhookUrl = 'https://n8n.somosbas3.com/webhook/4219808d-b47a-4033-a407-6f57a2c313d7';
    fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch((err) => {
      console.error('Falha de rede ao disparar webhook para n8n:', err);
    });
  } catch (error) {
    console.error('Erro na preparação do payload de notificação para o n8n:', error);
  }
}

// ── Comunicados em Massa ──────────────────────────────────────────────────────

const CHUNK_SIZE = 10;

export type AlvoComunicado = 'escola' | 'professores' | 'turma' | 'responsaveis';

export interface ComunicadoPayload {
  remetente_id: string;
  titulo: string;
  mensagem: string;
  alvo: AlvoComunicado;
  escola_id?: string | null;
  turma_id?: string | null;
  onProgress?: (feitas: number, total: number) => void;
}

export interface ComunicadoResult {
  enviadas: number;
}

/**
 * Envia comunicados em lote usando chunks de CHUNK_SIZE para manter a UI fluída.
 * alvo = 'escola'       → professores + responsáveis da escola
 * alvo = 'professores'  → professores da escola
 * alvo = 'responsaveis' → responsáveis dos alunos da escola
 * alvo = 'turma'        → responsáveis dos alunos de uma turma
 */
export async function enviarComunicadoEmMassa(
  payload: ComunicadoPayload,
): Promise<ComunicadoResult> {
  const { remetente_id, titulo, mensagem, alvo, escola_id, turma_id, onProgress } = payload;

  const { data: destRows } = await db.mural.getDestinatarios(alvo, escola_id, turma_id);
  const destinatarios = ((destRows || []) as { usuario_id: string }[])
    .map((r) => r.usuario_id)
    .filter((id) => id && id !== remetente_id);

  const uniqueIds = [...new Set(destinatarios)];
  const total = uniqueIds.length;
  let feitas = 0;

  for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
    const chunk = uniqueIds.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map((dest_id) =>
        db.notificacoes.insert({ remetente_id, destinatario_id: dest_id, titulo, mensagem }),
      ),
    );
    feitas += chunk.length;
    onProgress?.(feitas, total);
    // Yield ao event loop para não travar a UI
    await new Promise((r) => setTimeout(r, 0));
  }

  return { enviadas: feitas };
}
