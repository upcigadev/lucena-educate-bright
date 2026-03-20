import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { matricula, evento, timestamp, dispositivo_id } = body;

    if (!matricula || !evento || !timestamp || !dispositivo_id) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: matricula, evento, timestamp, dispositivo_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const eventTimestamp = new Date(timestamp);
    const eventDate = eventTimestamp.toISOString().split("T")[0];

    // Find aluno by matricula
    const { data: aluno, error: alunoErr } = await supabase
      .from("alunos")
      .select("id, turma_id, escola_id")
      .eq("matricula", matricula)
      .eq("ativo", true)
      .single();

    if (alunoErr || !aluno) {
      await logEvento(supabase, dispositivo_id, matricula, evento, eventTimestamp, "erro", "Aluno não encontrado");
      return new Response(
        JSON.stringify({ error: "Aluno não encontrado para esta matrícula" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get turma time config (with serie fallback)
    let horarioInicio = "07:00:00";
    let toleranciaMin = 15;
    let limiteMax = "07:30:00";

    if (aluno.turma_id) {
      const { data: turma } = await supabase
        .from("turmas")
        .select("horario_inicio, tolerancia_min, limite_max, serie_id")
        .eq("id", aluno.turma_id)
        .single();

      if (turma) {
        if (turma.horario_inicio || turma.tolerancia_min != null || turma.limite_max) {
          // Turma has own config
          horarioInicio = turma.horario_inicio || horarioInicio;
          toleranciaMin = turma.tolerancia_min ?? toleranciaMin;
          limiteMax = turma.limite_max || limiteMax;
        }

        // Fallback to serie
        if (!turma.horario_inicio || turma.tolerancia_min == null || !turma.limite_max) {
          const { data: serie } = await supabase
            .from("series")
            .select("horario_inicio, tolerancia_min, limite_max")
            .eq("id", turma.serie_id)
            .single();

          if (serie) {
            if (!turma.horario_inicio) horarioInicio = serie.horario_inicio || horarioInicio;
            if (turma.tolerancia_min == null) toleranciaMin = serie.tolerancia_min ?? toleranciaMin;
            if (!turma.limite_max) limiteMax = serie.limite_max || limiteMax;
          }
        }
      }
    }

    // Determine status based on timestamp
    let status = "presente";

    if (evento === "entrada") {
      const eventTime = eventTimestamp.toTimeString().substring(0, 8);
      
      // Add tolerancia_min to horario_inicio
      const [hh, mm, ss] = horarioInicio.split(":").map(Number);
      const toleranciaDate = new Date(2000, 0, 1, hh, mm + toleranciaMin, ss || 0);
      const toleranciaTime = toleranciaDate.toTimeString().substring(0, 8);

      if (eventTime <= toleranciaTime) {
        status = "presente";
      } else if (eventTime > limiteMax) {
        status = "atraso";
      } else {
        status = "atraso";
      }

      // Upsert frequencia
      const { error: freqErr } = await supabase
        .from("frequencias")
        .upsert(
          {
            aluno_id: aluno.id,
            turma_id: aluno.turma_id,
            data: eventDate,
            status,
            hora_entrada: eventTimestamp.toISOString(),
            dispositivo_id,
          },
          { onConflict: "aluno_id,data" }
        );

      if (freqErr) {
        await logEvento(supabase, dispositivo_id, matricula, evento, eventTimestamp, "erro", freqErr.message);
        return new Response(
          JSON.stringify({ error: freqErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else if (evento === "saida") {
      // Update existing record with exit time
      const { error: freqErr } = await supabase
        .from("frequencias")
        .update({ hora_saida: eventTimestamp.toISOString() })
        .eq("aluno_id", aluno.id)
        .eq("data", eventDate);

      if (freqErr) {
        await logEvento(supabase, dispositivo_id, matricula, evento, eventTimestamp, "erro", freqErr.message);
        return new Response(
          JSON.stringify({ error: freqErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    await logEvento(supabase, dispositivo_id, matricula, evento, eventTimestamp, "processado", null);

    return new Response(
      JSON.stringify({ success: true, aluno_id: aluno.id, status, evento }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function logEvento(
  supabase: any,
  dispositivo_id: string,
  matricula: string,
  evento: string,
  timestamp: Date,
  status: string,
  erro: string | null
) {
  await supabase.from("iot_evento_log").insert({
    dispositivo_id,
    matricula,
    evento,
    timestamp_evento: timestamp.toISOString(),
    status_processamento: status,
    erro,
  });
}
