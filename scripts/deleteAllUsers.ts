import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { db } from '../server/db.js';
import { userMetadata } from '../shared/schema.js';

// Carregar variáveis de ambiente
dotenv.config();

/**
 * Lista todos os usuários com paginação
 */
async function getAllUsers(supabase: any): Promise<any[]> {
  const allUsers: any[] = [];
  let page = 1;
  const perPage = 1000; // Máximo permitido pelo Supabase
  
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      console.error(`❌ Erro ao listar usuários (página ${page}):`, error.message);
      break;
    }

    if (!data.users || data.users.length === 0) {
      break;
    }

    allUsers.push(...data.users);
    console.log(`📄 Página ${page}: ${data.users.length} usuários encontrados`);

    // Se retornou menos que perPage, chegamos ao fim
    if (data.users.length < perPage) {
      break;
    }

    page++;
  }

  return allUsers;
}

/**
 * Deleta um usuário do Supabase Auth
 */
async function deleteUser(supabase: any, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      console.error(`❌ Erro ao deletar usuário ${userId}:`, error.message);
      return false;
    }
    return true;
  } catch (error: any) {
    console.error(`❌ Erro ao deletar usuário ${userId}:`, error.message);
    return false;
  }
}

/**
 * Limpa a tabela user_metadata
 */
async function clearUserMetadata() {
  if (!db) {
    console.warn('⚠️ Database não conectado, pulando limpeza de user_metadata');
    return;
  }

  try {
    // Deletar todos os registros de user_metadata
    await db.delete(userMetadata);
    console.log('✅ Tabela user_metadata limpa');
  } catch (error: any) {
    console.error('❌ Erro ao limpar user_metadata:', error.message);
  }
}

/**
 * Função principal
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const skipMetadata = args.includes('--skip-metadata');

  console.log('🗑️  Script de Deletar Todos os Usuários\n');
  console.log(`🔍 Modo dry-run: ${dryRun ? 'SIM (não vai deletar)' : 'NÃO (vai deletar!)'}`);
  console.log(`📊 Pular limpeza de metadata: ${skipMetadata ? 'SIM' : 'NÃO'}\n`);

  if (!dryRun) {
    console.log('⚠️  ATENÇÃO: Este script vai DELETAR TODOS OS USUÁRIOS!');
    console.log('⚠️  Pressione Ctrl+C para cancelar (aguarde 5 segundos)...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // Configurar Supabase
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Variáveis de ambiente não configuradas:');
    console.error('   SUPABASE_URL ou VITE_SUPABASE_URL');
    console.error('   SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Listar todos os usuários
  console.log('📋 Listando todos os usuários...\n');
  const users = await getAllUsers(supabase);

  if (users.length === 0) {
    console.log('✅ Nenhum usuário encontrado para deletar.');
    process.exit(0);
  }

  console.log(`\n📊 Total de usuários encontrados: ${users.length}\n`);

  if (dryRun) {
    console.log('🔍 DRY RUN - Usuários que seriam deletados:');
    users.slice(0, 10).forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.email} (${user.id})`);
    });
    if (users.length > 10) {
      console.log(`   ... e mais ${users.length - 10} usuários`);
    }
    console.log('\n✅ Dry-run concluído. Execute sem --dry-run para deletar.');
    process.exit(0);
  }

  // Deletar usuários
  console.log('🗑️  Deletando usuários...\n');
  let deleted = 0;
  let failed = 0;

  // Processar em lotes para não sobrecarregar
  const batchSize = 10;
  for (let i = 0; i < users.length; i += batchSize) {
    const batch = users.slice(i, i + batchSize);
    const batchPromises = batch.map(user => 
      deleteUser(supabase, user.id).then(success => ({ user, success }))
    );
    const results = await Promise.all(batchPromises);

    results.forEach(({ user, success }) => {
      if (success) {
        deleted++;
        console.log(`✅ Deletado: ${user.email}`);
      } else {
        failed++;
        console.log(`❌ Falha ao deletar: ${user.email}`);
      }
    });

    // Log de progresso
    const processed = Math.min(i + batchSize, users.length);
    const progress = ((processed / users.length) * 100).toFixed(1);
    console.log(`📈 Progresso: ${processed}/${users.length} (${progress}%) - Deletados: ${deleted}, Falhas: ${failed}\n`);

    // Pequeno delay entre lotes
    if (i + batchSize < users.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Limpar user_metadata
  if (!skipMetadata) {
    console.log('\n🧹 Limpando tabela user_metadata...');
    await clearUserMetadata();
  }

  // Relatório final
  console.log('\n' + '='.repeat(60));
  console.log('📊 RELATÓRIO FINAL');
  console.log('='.repeat(60));
  console.log(`✅ Usuários deletados: ${deleted}`);
  console.log(`❌ Falhas: ${failed}`);
  console.log(`📦 Total processado: ${users.length}`);
  console.log('='.repeat(60));
  console.log('\n✅ Processo concluído!');
  console.log('💡 Agora você pode executar: npm run import:users');
}

// Executar
main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro:', error);
    process.exit(1);
  });

