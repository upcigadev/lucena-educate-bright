import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://rpzbzdffequiunyhgafj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwemJ6ZGZmZXF1aXVueWhnYWZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMzQxMTgsImV4cCI6MjA4OTYxMDExOH0.wP-qOA0Ht7aRfOtRaGn-7jdLkJcvnnf53pDRQGBx_Bg'
);

async function seed() {
  const cpf = '11111111111'; // CPF de teste (só números)
  const password = 'lucena2025';  // Senha de teste
  const emailLogin = `admin1@lucena.edu.br`;

  console.log('🔄 A tentar criar utilizador no Supabase Auth...');
  
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: emailLogin,
    password: password,
    options: {
      data: { nome: 'Admin Secretaria', papel: 'SECRETARIA' },
    },
  });

  if (authError || !authData.user) {
    if (authError?.message.includes('User already registered')) {
        console.log('✅ Utilizador já existe no Auth.');
        
        // Fazer login para obtermos o auth_id
        const { data: loginData } = await supabase.auth.signInWithPassword({
            email: emailLogin,
            password: password
        });

        if (loginData.user) {
            await insertUsuario(loginData.user.id, cpf, emailLogin);
        }
    } else {
        console.error('❌ Erro no Auth:', authError?.message);
        return;
    }
  } else {
      console.log('✅ Utilizador criado no Auth com sucesso!');
      await insertUsuario(authData.user.id, cpf, emailLogin);
  }
}

async function insertUsuario(authId, cpf, emailLogin) {
    console.log('🔄 A verificar/inserir na tabela `usuarios`...');
    
    const { data: existing } = await supabase.from('usuarios').select('id').eq('cpf', cpf).maybeSingle();
    
    if (existing) {
        console.log('✅ Tabela `usuarios` já possui este CPF.');
        return;
    }

    const { error: dbError } = await supabase.from('usuarios').insert({
        nome: 'Admin Secretaria',
        cpf: cpf,
        papel: 'SECRETARIA',
        auth_id: authId,
        email: emailLogin,
        ativo: true
    });

    if (dbError) {
        console.error('❌ Erro ao inserir na tabela usuarios:', dbError.message);
    } else {
        console.log('✅ Utilizador SECRETARIA guardado com sucesso!');
        console.log('\n=======================================');
        console.log('Pode fazer login com:');
        console.log(`CPF: ${cpf}  (ou com a máscara 111.111.111-11)`);
        console.log(`Senha: admin`);
        console.log('=======================================');
    }
}

seed();
