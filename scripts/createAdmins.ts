import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { db } from '../server/db.js';
import { userMetadata } from '../shared/schema.js';

// Carregar variáveis de ambiente
dotenv.config();

interface AdminUser {
  email: string;
  password: string;
  fullName: string;
}

const ADMINS: AdminUser[] = [
  {
    email: 'admin@goflow.digital',
    password: '!@#GOflow2700',
    fullName: 'Admin GoFlow',
  },
  {
    email: 'admin@nexialab.com.br',
    password: 'rBeupVpv4iju@E6',
    fullName: 'Admin NexiaLab',
  },
];

/**
 * Verifica se usuário já existe no Supabase
 */
async function userExists(supabase: any, email: string): Promise<{ exists: boolean; userId?: string }> {
  try {
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) {
      console.warn(`⚠️ Erro ao verificar usuário existente: ${error.message}`);
      return { exists: false };
    }
    
    const user = data.users.find((u: any) => u.email === email);
    if (user) {
      return { exists: true, userId: user.id };
    }
    
    return { exists: false };
  } catch (error: any) {
    console.warn(`⚠️ Erro ao verificar usuário existente: ${error.message}`);
    return { exists: false };
  }
}

/**
 * Cria usuário no Supabase Auth
 */
async function createUser(
  supabase: any,
  email: string,
  password: string,
  fullName?: string
): Promise<{ userId?: string; error?: string }> {
  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: fullName ? { full_name: fullName } : undefined,
    });

    if (error) {
      return { error: error.message };
    }

    return { userId: data.user.id };
  } catch (error: any) {
    return { error: error.message || 'Erro desconhecido ao criar usuário' };
  }
}

/**
 * Atualiza senha de usuário existente
 */
async function updateUserPassword(
  supabase: any,
  userId: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password: password,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erro desconhecido ao atualizar senha' };
  }
}

/**
 * Insere ou atualiza registro na tabela user_metadata com role admin
 */
async function upsertUserMetadata(
  supabase: any,
  userId: string,
  fullName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verificar se já existe
    if (db) {
      const existing = await db
        .select()
        .from(userMetadata)
        .where(eq(userMetadata.userId, userId))
        .limit(1);

      if (existing.length > 0) {
        // Atualizar existente
        await db
          .update(userMetadata)
          .set({
            fullName: fullName,
            role: 'admin',
            updatedAt: new Date(),
          })
          .where(eq(userMetadata.userId, userId));
      } else {
        // Inserir novo
        await db.insert(userMetadata).values({
          userId: userId,
          fullName: fullName,
          role: 'admin',
        });
      }
    } else {
      // Fallback: usar Supabase diretamente
      const { error: insertError } = await supabase
        .from('user_metadata')
        .upsert({
          user_id: userId,
          full_name: fullName,
          role: 'admin',
        }, {
          onConflict: 'user_id'
        });

      if (insertError) {
        return { success: false, error: insertError.message };
      }
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erro desconhecido ao inserir metadata' };
  }
}

/**
 * Processa criação/atualização de um admin
 */
async function processAdmin(
  supabase: any,
  admin: AdminUser,
  updatePassword: boolean
): Promise<{ success: boolean; error?: string; created?: boolean; updated?: boolean }> {
  console.log(`\n🔄 Processando: ${admin.email}`);

  // Verificar se usuário já existe
  const { exists, userId: existingUserId } = await userExists(supabase, admin.email);

  if (exists && existingUserId) {
    console.log(`   ℹ️  Usuário já existe (ID: ${existingUserId})`);

    if (updatePassword) {
      console.log(`   🔄 Atualizando senha...`);
      const { success: updateSuccess, error: updateError } = await updateUserPassword(
        supabase,
        existingUserId,
        admin.password
      );

      if (!updateSuccess) {
        return {
          success: false,
          error: `Erro ao atualizar senha: ${updateError}`,
        };
      }
      console.log(`   ✅ Senha atualizada`);
    }

    // Atualizar metadata
    const { success: metadataSuccess, error: metadataError } = await upsertUserMetadata(
      supabase,
      existingUserId,
      admin.fullName
    );

    if (!metadataSuccess) {
      console.warn(`   ⚠️  Erro ao atualizar metadata: ${metadataError}`);
    } else {
      console.log(`   ✅ Metadata atualizada (role: admin)`);
    }

    return {
      success: true,
      updated: true,
    };
  }

  // Criar novo usuário
  console.log(`   ➕ Criando novo usuário...`);
  const { userId, error: createError } = await createUser(supabase, admin.email, admin.password, admin.fullName);

  if (createError) {
    return {
      success: false,
      error: `Erro ao criar usuário: ${createError}`,
    };
  }

  if (!userId) {
    return {
      success: false,
      error: 'ID do usuário não retornado',
    };
  }

  console.log(`   ✅ Usuário criado (ID: ${userId})`);

  // Inserir metadata
  const { success: metadataSuccess, error: metadataError } = await upsertUserMetadata(
    supabase,
    userId,
    admin.fullName
  );

  if (!metadataSuccess) {
    console.warn(`   ⚠️  Erro ao inserir metadata: ${metadataError}`);
  } else {
    console.log(`   ✅ Metadata criada (role: admin)`);
  }

  return {
    success: true,
    created: true,
  };
}

/**
 * Função principal
 */
async function main() {
  const args = process.argv.slice(2);
  const updatePassword = args.includes('--update-password');

  console.log('👑 Script de Criação de Usuários Admin\n');
  console.log(`🔄 Atualizar senhas de existentes: ${updatePassword ? 'SIM' : 'NÃO'}\n`);

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

  // Processar cada admin
  let created = 0;
  let updated = 0;
  let failed = 0;

  for (const admin of ADMINS) {
    const result = await processAdmin(supabase, admin, updatePassword);

    if (result.success) {
      if (result.created) {
        created++;
      } else if (result.updated) {
        updated++;
      }
    } else {
      failed++;
      console.error(`   ❌ Erro: ${result.error}`);
    }
  }

  // Relatório final
  console.log('\n' + '='.repeat(60));
  console.log('📊 RELATÓRIO FINAL');
  console.log('='.repeat(60));
  console.log(`✅ Criados: ${created}`);
  console.log(`🔄 Atualizados: ${updated}`);
  console.log(`❌ Falhas: ${failed}`);
  console.log(`📦 Total processado: ${ADMINS.length}`);
  console.log('='.repeat(60));

  if (failed === 0) {
    console.log('\n✅ Todos os admins foram processados com sucesso!');
  } else {
    console.log('\n⚠️  Alguns admins falharam. Verifique os erros acima.');
  }
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



