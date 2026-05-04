import { db } from './mock-db';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ─────────────────────────────────────────────────────────────────────────────

export interface RegistroFrequenciaWebhook {
  aluno_id: string;
  hora_entrada: string;
  status: string;
  data: string;
}

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

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

const CHUNK_SIZE = 10;

const N8N_WEBHOOK_FREQUENCIA =
  'https://n8n.somosbas3.com/webhook/4219808d-b47a-4033-a407-6f57a2c313d7';

const N8N_WEBHOOK_COMUNICADOS =
  'https://n8n.somosbas3.com/webhook/53017e34-fdc4-4a45-a24e-5e7dc7d0a24c';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normaliza um número de telefone brasileiro:
 *  - Remove espaços, traços, parênteses e pontos.
 *  - Adiciona DDI 55 se não houver código de país.
 *  - Retorna string vazia se o número for inválido (< 10 dígitos).
 */
function normalizarTelefone(raw: string): string {
  // Remove tudo que não for dígito
  const digits = raw.replace(/\D/g, '');

  if (digits.length < 10) return ''; // Número inválido

  // Já tem DDI (começa com 55 e tem 12 ou 13 dígitos)
  if (digits.startsWith('55') && digits.length >= 12) {
    return digits;
  }

  return `55${digits}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Notificação de Frequência (individual, fire-and-forget para n8n)
// ─────────────────────────────────────────────────────────────────────────────

export async function enviarNotificacaoFrequencia(
  registro: RegistroFrequenciaWebhook,
): Promise<void> {
  try {
    const res = await db.alunos.getAlunoComResponsaveis(registro.aluno_id);
    const dados = res.data;

    if (!dados || !dados.responsaveis || dados.responsaveis.length === 0) return;

    const labels: Record<string, string> = {
      presente: '🟢 Presente no horário',
      atrasado: '🟠 Atrasado',
      falta: '🔴 Falta',
    };
    const formatStatus = labels[registro.status] || '🟢 Presente no horário';

    const payload = {
      aluno_nome: dados.aluno_nome,
      escola_nome: dados.escola_nome,
      horario_registro: registro.hora_entrada,
      status_frequencia: formatStatus,
      raw_status: registro.status,
      responsaveis: dados.responsaveis,
    };

    fetch(N8N_WEBHOOK_FREQUENCIA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch((err) => {
      console.error('[n8n] Falha de rede ao disparar webhook de frequência:', err);
    });
  } catch (error) {
    console.error('[n8n] Erro na preparação do payload de frequência:', error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Comunicados em Massa
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Envia comunicados em massa:
 *
 * Passo A – Grava as notificações no banco interno (aparecem no sino).
 * Passo B – Monta payload bulk com nomes + telefones dos destinatários.
 * Passo C – Dispara UM único POST ao webhook do n8n (fire-and-forget).
 *
 * alvo = 'escola'       → professores + responsáveis da escola
 * alvo = 'professores'  → professores da escola
 * alvo = 'responsaveis' → responsáveis dos alunos da escola
 * alvo = 'turma'        → responsáveis dos alunos de uma turma
 */
export async function enviarComunicadoEmMassa(
  payload: ComunicadoPayload,
): Promise<ComunicadoResult> {
  const {
    remetente_id,
    titulo,
    mensagem,
    alvo,
    escola_id,
    turma_id,
    onProgress,
  } = payload;

  // ── Passo A: Gravação interna (notificações no sino) ─────────────────────

  const { data: destRows } = await db.mural.getDestinatarios(
    alvo,
    escola_id,
    turma_id,
  );

  const destinatarios = (
    (destRows || []) as { usuario_id: string }[]
  )
    .map((r) => r.usuario_id)
    .filter((id): id is string => Boolean(id) && id !== remetente_id);

  const uniqueIds = [...new Set(destinatarios)];
  const total = uniqueIds.length;
  let feitas = 0;

  for (let i = 0; i < uniqueIds.length; i += CHUNK_SIZE) {
    const chunk = uniqueIds.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map((dest_id) =>
        db.notificacoes.insert({
          remetente_id,
          destinatario_id: dest_id,
          titulo,
          mensagem,
        }),
      ),
    );
    feitas += chunk.length;
    onProgress?.(feitas, total);
    // Cede ao event loop para não travar a UI
    await new Promise<void>((r) => setTimeout(r, 0));
  }

  // ── Passo B: Coleta destinatários com telefone para o n8n ────────────────

  // Fire-and-forget assíncrono: não bloqueia o retorno para a UI
  void (async () => {
    try {
      const listaTelefones = await db.mural.getDestinatariosComTelefone(
        alvo,
        escola_id,
        turma_id,
      );

      // Normaliza e filtra números inválidos
      const destinatariosN8n = listaTelefones
        .map((d) => ({
          nome: d.nome,
          telefone: normalizarTelefone(d.telefone),
        }))
        .filter((d) => d.telefone.length > 0);

      if (destinatariosN8n.length === 0) {
        console.info(
          '[n8n] Comunicado sem destinatários com telefone válido — webhook não disparado.',
        );
        return;
      }

      // ── Passo C: Disparo único para o n8n ─────────────────────────────────

      const n8nPayload = {
        titulo,
        mensagem,
        escola_id: escola_id ?? null,
        remetente_id,
        destinatarios: destinatariosN8n,
      };

      const response = await fetch(N8N_WEBHOOK_COMUNICADOS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(n8nPayload),
      });

      if (!response.ok) {
        console.error(
          `[n8n] Webhook retornou erro HTTP ${response.status}:`,
          await response.text().catch(() => '(sem corpo)'),
        );
      } else {
        console.info(
          `[n8n] Comunicado enviado para ${destinatariosN8n.length} destinatário(s) via WhatsApp.`,
        );
      }
    } catch (err) {
      console.error('[n8n] Falha ao disparar webhook de comunicado em massa:', err);
    }
  })();

  // Retorna imediatamente após a gravação interna (a chamada ao n8n é assíncrona)
  return { enviadas: feitas };
}
