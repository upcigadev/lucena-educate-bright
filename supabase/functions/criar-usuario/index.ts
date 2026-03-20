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
    // Validate caller JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await anonClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(
        JSON.stringify({ error: "Token inválido" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callerAuthId = claims.claims.sub as string;

    // Check caller is SECRETARIA or DIRETOR
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: callerUser } = await adminClient
      .from("usuarios")
      .select("papel")
      .eq("auth_id", callerAuthId)
      .eq("ativo", true)
      .single();

    if (!callerUser || !["SECRETARIA", "DIRETOR"].includes(callerUser.papel)) {
      return new Response(
        JSON.stringify({ error: "Apenas SECRETARIA ou DIRETOR podem cadastrar usuários" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { nome, cpf, email, papel, senha, escola_id, telefone, escolas_ids } = body;

    if (!nome || !cpf || !papel) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: nome, cpf, papel" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validPapeis = ["SECRETARIA", "DIRETOR", "PROFESSOR", "RESPONSAVEL"];
    if (!validPapeis.includes(papel)) {
      return new Response(
        JSON.stringify({ error: `Papel inválido. Use: ${validPapeis.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DIRETOR can only create PROFESSOR and RESPONSAVEL
    if (callerUser.papel === "DIRETOR" && !["PROFESSOR", "RESPONSAVEL"].includes(papel)) {
      return new Response(
        JSON.stringify({ error: "Diretor só pode cadastrar PROFESSOR ou RESPONSAVEL" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cpfClean = cpf.replace(/\D/g, "");

    // Check duplicate CPF
    const { data: existing } = await adminClient
      .from("usuarios")
      .select("id")
      .eq("cpf", cpfClean)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ error: "CPF já cadastrado no sistema" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Create auth user
    const password = senha || `Lucena@${cpfClean.slice(-4)}`;
    const authEmail = email || `${cpfClean}@lucena.edu.br`;

    const { data: authData, error: authErr } = await adminClient.auth.admin.createUser({
      email: authEmail,
      password,
      email_confirm: true,
    });

    if (authErr) {
      return new Response(
        JSON.stringify({ error: `Erro ao criar credencial: ${authErr.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authId = authData.user.id;

    // 2. Insert in usuarios
    const { data: usuario, error: usrErr } = await adminClient
      .from("usuarios")
      .insert({
        nome,
        cpf: cpfClean,
        email: email || null,
        papel,
        auth_id: authId,
      })
      .select()
      .single();

    if (usrErr) {
      // Rollback auth user
      await adminClient.auth.admin.deleteUser(authId);
      return new Response(
        JSON.stringify({ error: `Erro ao criar usuário: ${usrErr.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Create role-specific record
    let roleRecord = null;

    if (papel === "DIRETOR" && escola_id) {
      const { data, error } = await adminClient
        .from("diretores")
        .insert({ usuario_id: usuario.id, escola_id })
        .select()
        .single();
      if (error) {
        return new Response(
          JSON.stringify({ error: `Erro ao vincular diretor: ${error.message}`, usuario_id: usuario.id }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      roleRecord = data;
    } else if (papel === "PROFESSOR") {
      const { data, error } = await adminClient
        .from("professores")
        .insert({ usuario_id: usuario.id })
        .select()
        .single();
      if (error) {
        return new Response(
          JSON.stringify({ error: `Erro ao criar professor: ${error.message}`, usuario_id: usuario.id }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      roleRecord = data;
      // Link to schools
      if (escolas_ids && Array.isArray(escolas_ids) && escolas_ids.length > 0) {
        const links = escolas_ids.map((eid: string) => ({
          professor_id: data.id,
          escola_id: eid,
        }));
        await adminClient.from("professor_escolas").insert(links);
      }
    } else if (papel === "RESPONSAVEL") {
      const { data, error } = await adminClient
        .from("responsaveis")
        .insert({ usuario_id: usuario.id, telefone: telefone || null })
        .select()
        .single();
      if (error) {
        return new Response(
          JSON.stringify({ error: `Erro ao criar responsável: ${error.message}`, usuario_id: usuario.id }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      roleRecord = data;
    }

    return new Response(
      JSON.stringify({
        success: true,
        usuario_id: usuario.id,
        auth_id: authId,
        email_login: authEmail,
        senha_temporaria: password,
        papel,
        role_record: roleRecord,
      }),
      { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
