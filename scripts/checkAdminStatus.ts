import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

const ADMIN_EMAILS = ["admin@goflow.digital", "admin@nexialab.com.br", "admin@fernandalandeiro.com.br"];

/**
 * Verifica status de um admin
 */
async function checkAdminStatus(email: string) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Variáveis de ambiente não configuradas');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log(`\n🔍 Verificando status de: ${email}\n`);

  // 1. Verificar se está na lista de emails admin
  const isInList = ADMIN_EMAILS.includes(email);
  console.log(`📋 Na lista de ADMIN_EMAILS: ${isInList ? '✅ SIM' : '❌ NÃO'}`);

  // 2. Buscar usuário no Supabase Auth
  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    console.error(`❌ Erro ao listar usuários: ${listError.message}`);
    return;
  }

  const user = usersData.users.find((u: any) => u.email === email);
  
  if (!user) {
    console.log(`❌ Usuário NÃO encontrado no Supabase Auth`);
    console.log(`💡 Execute: npm run create:admins`);
    return;
  }

  console.log(`✅ Usuário encontrado no Supabase Auth`);
  console.log(`   ID: ${user.id}`);
  console.log(`   Email confirmado: ${user.email_confirmed_at ? '✅ SIM' : '❌ NÃO'}`);
  console.log(`   Criado em: ${user.created_at}`);

  // 3. Verificar user_metadata
  const { data: metadata, error: metadataError } = await supabase
    .from('user_metadata')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (metadataError) {
    if (metadataError.code === 'PGRST116') {
      console.log(`⚠️  Registro NÃO encontrado em user_metadata`);
      console.log(`💡 Execute: npm run create:admins para criar/atualizar metadata`);
    } else {
      console.error(`❌ Erro ao buscar metadata: ${metadataError.message}`);
    }
    return;
  }

  console.log(`✅ Registro encontrado em user_metadata`);
  console.log(`   Role: ${metadata.role || 'N/A'}`);
  console.log(`   Full Name: ${metadata.full_name || 'N/A'}`);
  console.log(`   Data Final Acesso: ${metadata.data_final_acesso || 'N/A'}`);

  // 4. Verificar se role é admin
  if (metadata.role === 'admin') {
    console.log(`\n✅ STATUS: Admin configurado corretamente!`);
  } else {
    console.log(`\n⚠️  STATUS: Role não é 'admin' (atual: '${metadata.role || 'N/A'}')`);
    console.log(`💡 Execute: npm run create:admins para atualizar role`);
  }
}

/**
 * Função principal
 */
async function main() {
  const args = process.argv.slice(2);
  const email = args[0] || 'admin@fernandalandeiro.com.br';

  console.log('👑 Verificador de Status de Admin\n');
  console.log(`📧 Email: ${email}\n`);

  await checkAdminStatus(email);

  console.log('\n' + '='.repeat(60));
  console.log('📊 Verificação concluída');
  console.log('='.repeat(60));
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro:', error);
    process.exit(1);
  });

