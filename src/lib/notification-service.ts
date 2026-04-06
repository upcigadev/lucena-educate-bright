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

    // Se aluno não for encontrado ou não tiver responsáveis, aborta silenciosamente ("fire-and-forget")
    if (!dados || !dados.responsaveis || dados.responsaveis.length === 0) {
      return;
    }

    const payload = {
      aluno_nome: dados.aluno_nome,
      escola_nome: dados.escola_nome,
      horario_registro: registro.hora_entrada,
      status_frequencia: registro.status,
      responsaveis: dados.responsaveis
    };

    const webhookUrl = 'https://n8n.somosbas3.com/webhook/4219808d-b47a-4033-a407-6f57a2c313d7';

    // Disparo assíncrono para o n8n sem aguardar resolução final (evita travar a UI).
    fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    }).catch(err => {
      console.error('Falha de rede ao disparar webhook para n8n:', err);
    });

  } catch (error) {
    console.error('Erro na preparação do payload de notificação para o n8n:', error);
  }
}
