import * as fs from 'fs';
import * as path from 'path';
import Papa from 'papaparse';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config();

interface CsvRow {
  'Nome': string;
  'E-mail': string;
  'CPF': string;
  'Curso/Origem do Acesso': string;
  'Período de Acesso': string;
}

interface ImportResult {
  email: string;
  nome: string;
  success: boolean;
  error?: string;
  userId?: string;
}

interface ImportStats {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  results: ImportResult[];
}

/**
 * Gera senha a partir dos 5 primeiros dígitos do CPF + sufixo fixo
 */
function generatePassword(cpf: string): string {
  // Remover formatação do CPF (pontos, traços, espaços)
  const cpfDigits = cpf.replace(/\D/g, '');
  
  // Extrair os 5 primeiros dígitos
  const firstFive = cpfDigits.substring(0, 5);
  
  // Se o CPF tiver menos de 5 dígitos, preencher com zeros à esquerda
  const padded = firstFive.padStart(5, '0');
  
  // Concatenar com sufixo fixo (sem espaços)
  return `${padded}!@%UZJ`;
}

/**
 * Valida email
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Valida CPF (verifica se tem pelo menos alguns dígitos)
 */
function isValidCpf(cpf: string): boolean {
  const cpfDigits = cpf.replace(/\D/g, '');
  return cpfDigits.length >= 5;
}

/**
 * Verifica se usuário já existe no Supabase
 */
async function userExists(supabase: any, email: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) {
      console.warn(`⚠️ Erro ao verificar usuário existente: ${error.message}`);
      return false;
    }
    return data.users.some(user => user.email === email);
  } catch (error: any) {
    console.warn(`⚠️ Erro ao verificar usuário existente: ${error.message}`);
    return false;
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
 * Atualiza senha de usuário existente no Supabase Auth
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
 * Busca usuário por email no Supabase Auth
 */
async function getUserByEmail(
  supabase: any,
  email: string
): Promise<{ userId?: string; error?: string }> {
  try {
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) {
      return { error: error.message };
    }
    
    const user = data.users.find((u: any) => u.email === email);
    if (user) {
      return { userId: user.id };
    }
    
    return { error: 'Usuário não encontrado' };
  } catch (error: any) {
    return { error: error.message || 'Erro desconhecido ao buscar usuário' };
  }
}

/**
 * Insere registro na tabela user_metadata
 */
async function insertUserMetadata(
  supabase: any,
  userId: string,
  fullName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('user_metadata')
      .insert({
        user_id: userId,
        full_name: fullName,
        role: 'user',
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erro desconhecido ao inserir metadata' };
  }
}

/**
 * Processa uma linha do CSV
 */
async function processUser(
  supabase: any,
  row: CsvRow,
  dryRun: boolean,
  skipExisting: boolean,
  updatePasswords: boolean
): Promise<ImportResult> {
  const email = row['E-mail']?.trim();
  const nome = row['Nome']?.trim() || '';
  const cpf = row['CPF']?.trim() || '';

  // Validações
  if (!email) {
    return {
      email: email || 'N/A',
      nome,
      success: false,
      error: 'Email não fornecido',
    };
  }

  if (!isValidEmail(email)) {
    return {
      email,
      nome,
      success: false,
      error: 'Email inválido',
    };
  }

  if (!isValidCpf(cpf)) {
    return {
      email,
      nome,
      success: false,
      error: 'CPF inválido ou muito curto',
    };
  }

  // Gerar senha
  const password = generatePassword(cpf);

  // Verificar se usuário já existe
  const existingUser = await getUserByEmail(supabase, email);
  const userExists = !!existingUser.userId;

  // Se usuário existe e estamos em modo skip-existing, pular
  if (userExists && skipExisting && !updatePasswords) {
    return {
      email,
      nome,
      success: false,
      error: 'Usuário já existe',
    };
  }

  // Modo dry-run
  if (dryRun) {
    if (userExists) {
      console.log(`[DRY RUN] Atualizaria senha: ${email} | Nova senha: ${password.substring(0, 5)}...`);
    } else {
      console.log(`[DRY RUN] Criaria usuário: ${email} | Senha: ${password.substring(0, 5)}...`);
    }
    return {
      email,
      nome,
      success: true,
    };
  }

  // Se usuário existe e estamos em modo update-passwords, atualizar senha
  if (userExists && updatePasswords) {
    const { success: updateSuccess, error: updateError } = await updateUserPassword(
      supabase,
      existingUser.userId!,
      password
    );

    if (!updateSuccess) {
      return {
        email,
        nome,
        success: false,
        error: `Erro ao atualizar senha: ${updateError}`,
      };
    }

    return {
      email,
      nome,
      success: true,
      userId: existingUser.userId,
    };
  }

  // Se usuário existe mas não estamos em modo update, retornar erro
  if (userExists) {
    return {
      email,
      nome,
      success: false,
      error: 'Usuário já existe (use --update-passwords para atualizar senha)',
    };
  }

  // Criar novo usuário
  const { userId, error: createError } = await createUser(supabase, email, password, nome);

  if (createError) {
    return {
      email,
      nome,
      success: false,
      error: `Erro ao criar usuário: ${createError}`,
    };
  }

  if (!userId) {
    return {
      email,
      nome,
      success: false,
      error: 'ID do usuário não retornado',
    };
  }

  // Inserir metadata
  const { success: metadataSuccess, error: metadataError } = await insertUserMetadata(
    supabase,
    userId,
    nome
  );

  if (!metadataSuccess) {
    console.warn(`⚠️ Usuário ${email} criado mas metadata falhou: ${metadataError}`);
    // Não falhamos completamente, o usuário foi criado
  }

  return {
    email,
    nome,
    success: true,
    userId,
  };
}

/**
 * Função principal
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const skipExisting = args.includes('--skip-existing');
  const updatePasswords = args.includes('--update-passwords');
  const csvPath = args.find(arg => !arg.startsWith('--')) || 
    path.join(process.cwd(), '(TODOS) Lista de Acessos - PCS - Lista Geral.csv');

  console.log('🚀 Iniciando importação de usuários do CSV\n');
  console.log(`📁 Arquivo CSV: ${csvPath}`);
  console.log(`🔍 Modo dry-run: ${dryRun ? 'SIM' : 'NÃO'}`);
  console.log(`⏭️  Pular existentes: ${skipExisting ? 'SIM' : 'NÃO'}`);
  console.log(`🔄 Atualizar senhas: ${updatePasswords ? 'SIM' : 'NÃO'}\n`);

  // Verificar se arquivo existe
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ Arquivo não encontrado: ${csvPath}`);
    process.exit(1);
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

  // Ler e processar CSV
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  
  return new Promise<void>((resolve, reject) => {
    Papa.parse<CsvRow>(csvContent, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data;
        const stats: ImportStats = {
          total: rows.length,
          success: 0,
          failed: 0,
          skipped: 0,
          results: [],
        };

        console.log(`📊 Total de linhas no CSV: ${rows.length}\n`);
        console.log('🔄 Processando usuários...\n');

        // Processar em lotes para não sobrecarregar
        const batchSize = 10;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          const batchPromises = batch.map(row => processUser(supabase, row, dryRun, skipExisting, updatePasswords));
          const batchResults = await Promise.all(batchPromises);

          // Atualizar estatísticas
          batchResults.forEach(result => {
            stats.results.push(result);
            if (result.success) {
              stats.success++;
            } else if (result.error?.includes('já existe') && !updatePasswords) {
              stats.skipped++;
            } else {
              stats.failed++;
            }
          });

          // Log de progresso
          const processed = Math.min(i + batchSize, rows.length);
          const progress = ((processed / rows.length) * 100).toFixed(1);
          console.log(`📈 Progresso: ${processed}/${rows.length} (${progress}%)`);

          // Pequeno delay entre lotes para não sobrecarregar a API
          if (i + batchSize < rows.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        // Relatório final
        console.log('\n' + '='.repeat(60));
        console.log('📊 RELATÓRIO FINAL');
        console.log('='.repeat(60));
        console.log(`✅ Sucessos: ${stats.success}${updatePasswords ? ' (incluindo atualizações)' : ''}`);
        console.log(`❌ Falhas: ${stats.failed}`);
        if (!updatePasswords) {
          console.log(`⏭️  Ignorados (já existentes): ${stats.skipped}`);
        }
        console.log(`📦 Total processado: ${stats.total}`);
        console.log('='.repeat(60));

        // Listar falhas
        if (stats.failed > 0) {
          console.log('\n❌ FALHAS:');
          stats.results
            .filter(r => !r.success && !r.error?.includes('já existe'))
            .forEach(r => {
              console.log(`   - ${r.email}: ${r.error}`);
            });
        }

        // Listar ignorados
        if (stats.skipped > 0) {
          console.log('\n⏭️  IGNORADOS (já existentes):');
          stats.results
            .filter(r => r.error?.includes('já existe'))
            .slice(0, 10) // Mostrar apenas os primeiros 10
            .forEach(r => {
              console.log(`   - ${r.email}`);
            });
          if (stats.skipped > 10) {
            console.log(`   ... e mais ${stats.skipped - 10} usuários`);
          }
        }

        resolve();
      },
      error: (error) => {
        console.error('❌ Erro ao processar CSV:', error.message);
        reject(error);
      },
    });
  });
}

// Executar
main()
  .then(() => {
    console.log('\n✅ Importação concluída!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro na importação:', error);
    process.exit(1);
  });

