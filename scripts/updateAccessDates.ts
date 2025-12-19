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

interface UpdateResult {
  email: string;
  nome: string;
  periodo: string;
  success: boolean;
  error?: string;
  userId?: string;
  dataFinal?: Date;
}

interface UpdateStats {
  total: number;
  success: number;
  failed: number;
  notFound: number;
  invalidPeriod: number;
  results: UpdateResult[];
}

/**
 * Mapeia período de acesso para número de dias
 */
function getDaysFromPeriod(periodo: string): number | null {
  const periodoLower = periodo.toLowerCase().trim();
  
  if (periodoLower.includes('1 ano') || periodoLower.includes('um ano')) {
    return 365;
  }
  
  if (periodoLower.includes('6 meses') || periodoLower.includes('seis meses')) {
    return 184;
  }
  
  // Adicionar mais mapeamentos conforme necessário
  if (periodoLower.includes('3 meses') || periodoLower.includes('três meses')) {
    return 92; // Aproximadamente 3 meses
  }
  
  if (periodoLower.includes('2 anos') || periodoLower.includes('dois anos')) {
    return 730;
  }
  
  return null;
}

/**
 * Calcula data final de acesso baseado no período
 */
function calculateFinalDate(periodo: string): Date | null {
  const days = getDaysFromPeriod(periodo);
  
  if (days === null) {
    return null;
  }
  
  const today = new Date();
  const finalDate = new Date(today);
  finalDate.setDate(finalDate.getDate() + days);
  
  return finalDate;
}

/**
 * Valida email
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Lista todos os usuários do Supabase com paginação e cria mapa de email -> userId
 */
async function getAllUsersMap(supabase: any): Promise<Map<string, string>> {
  const userMap = new Map<string, string>();
  let page = 1;
  const perPage = 1000;
  
  console.log('📋 Carregando usuários do Supabase...\n');
  
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      console.warn(`⚠️ Erro ao listar usuários (página ${page}):`, error.message);
      break;
    }

    if (!data.users || data.users.length === 0) {
      break;
    }

    data.users.forEach((user: any) => {
      if (user.email) {
        userMap.set(user.email.toLowerCase(), user.id);
      }
    });

    console.log(`📄 Página ${page}: ${data.users.length} usuários carregados`);

    if (data.users.length < perPage) {
      break;
    }

    page++;
  }

  console.log(`✅ Total de ${userMap.size} usuários carregados\n`);
  return userMap;
}

/**
 * Atualiza data_final_acesso na tabela user_metadata usando Supabase
 */
async function updateUserAccessDate(
  supabase: any,
  userId: string,
  dataFinal: Date
): Promise<{ success: boolean; error?: string }> {
  try {
    // Verificar se registro existe
    const { data: existing, error: selectError } = await supabase
      .from('user_metadata')
      .select('user_id')
      .eq('user_id', userId)
      .limit(1);

    if (selectError) {
      return { success: false, error: selectError.message };
    }

    const dataFinalISO = dataFinal.toISOString();

    if (existing && existing.length > 0) {
      // Update existente
      const { error: updateError } = await supabase
        .from('user_metadata')
        .update({
          data_final_acesso: dataFinalISO,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (updateError) {
        return { success: false, error: updateError.message };
      }
    } else {
      // Insert novo registro
      const { error: insertError } = await supabase
        .from('user_metadata')
        .insert({
          user_id: userId,
          data_final_acesso: dataFinalISO,
        });

      if (insertError) {
        return { success: false, error: insertError.message };
      }
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || 'Erro desconhecido ao atualizar data de acesso' };
  }
}

/**
 * Processa uma linha do CSV
 */
async function processRow(
  supabase: any,
  userMap: Map<string, string>,
  row: CsvRow,
  dryRun: boolean
): Promise<UpdateResult> {
  const email = row['E-mail']?.trim();
  const nome = row['Nome']?.trim() || '';
  const periodo = row['Período de Acesso']?.trim() || '';

  // Validações
  if (!email) {
    return {
      email: email || 'N/A',
      nome,
      periodo,
      success: false,
      error: 'Email não fornecido',
    };
  }

  if (!isValidEmail(email)) {
    return {
      email,
      nome,
      periodo,
      success: false,
      error: 'Email inválido',
    };
  }

  if (!periodo) {
    return {
      email,
      nome,
      periodo,
      success: false,
      error: 'Período de acesso não fornecido',
    };
  }

  // Buscar usuário
  const emailLower = email.toLowerCase();
  const userId = userMap.get(emailLower);

  if (!userId) {
    return {
      email,
      nome,
      periodo,
      success: false,
      error: 'Usuário não encontrado no Supabase',
    };
  }

  // Calcular data final
  const dataFinal = calculateFinalDate(periodo);

  if (!dataFinal) {
    return {
      email,
      nome,
      periodo,
      success: false,
      error: `Período não mapeado: "${periodo}"`,
    };
  }

  // Modo dry-run
  if (dryRun) {
    console.log(`[DRY RUN] Atualizaria: ${email} | Período: ${periodo} | Data Final: ${dataFinal.toISOString().split('T')[0]}`);
    return {
      email,
      nome,
      periodo,
      success: true,
      userId,
      dataFinal,
    };
  }

  // Atualizar no banco
  const { success, error: updateError } = await updateUserAccessDate(supabase, userId, dataFinal);

  if (!success) {
    return {
      email,
      nome,
      periodo,
      success: false,
      error: `Erro ao atualizar: ${updateError}`,
      userId,
      dataFinal,
    };
  }

  return {
    email,
    nome,
    periodo,
    success: true,
    userId,
    dataFinal,
  };
}

/**
 * Função principal
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const csvPath = args.find(arg => !arg.startsWith('--')) || 
    path.join(process.cwd(), '(TODOS) Lista de Acessos - PCS - Lista Geral.csv');

  console.log('📅 Script de Atualização de Data Final de Acesso\n');
  console.log(`📁 Arquivo CSV: ${csvPath}`);
  console.log(`🔍 Modo dry-run: ${dryRun ? 'SIM (não vai atualizar)' : 'NÃO (vai atualizar!)'}\n`);

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

  // Carregar mapa de usuários
  const userMap = await getAllUsersMap(supabase);

  // Ler e processar CSV
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  
  return new Promise<void>((resolve, reject) => {
    Papa.parse<CsvRow>(csvContent, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data;
        const stats: UpdateStats = {
          total: rows.length,
          success: 0,
          failed: 0,
          notFound: 0,
          invalidPeriod: 0,
          results: [],
        };

        console.log(`📊 Total de linhas no CSV: ${rows.length}\n`);
        console.log('🔄 Processando atualizações...\n');

        // Processar em lotes para não sobrecarregar
        const batchSize = 10;
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          const batchPromises = batch.map(row => processRow(supabase, userMap, row, dryRun));
          const batchResults = await Promise.all(batchPromises);

          // Atualizar estatísticas
          batchResults.forEach(result => {
            stats.results.push(result);
            if (result.success) {
              stats.success++;
            } else {
              stats.failed++;
              if (result.error?.includes('não encontrado')) {
                stats.notFound++;
              } else if (result.error?.includes('não mapeado')) {
                stats.invalidPeriod++;
              }
            }
          });

          // Log de progresso
          const processed = Math.min(i + batchSize, rows.length);
          const progress = ((processed / rows.length) * 100).toFixed(1);
          console.log(`📈 Progresso: ${processed}/${rows.length} (${progress}%) - Sucessos: ${stats.success}, Falhas: ${stats.failed}`);

          // Pequeno delay entre lotes
          if (i + batchSize < rows.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }

        // Relatório final
        console.log('\n' + '='.repeat(60));
        console.log('📊 RELATÓRIO FINAL');
        console.log('='.repeat(60));
        console.log(`📦 Total processado: ${stats.total}`);
        console.log(`✅ Sucessos: ${stats.success}`);
        console.log(`❌ Falhas: ${stats.failed}`);
        if (stats.notFound > 0) {
          console.log(`👤 Usuários não encontrados: ${stats.notFound}`);
        }
        if (stats.invalidPeriod > 0) {
          console.log(`⚠️  Períodos não mapeados: ${stats.invalidPeriod}`);
        }
        console.log('='.repeat(60));

        // Listar falhas
        if (stats.failed > 0) {
          console.log('\n❌ FALHAS:');
          stats.results
            .filter(r => !r.success)
            .slice(0, 20) // Mostrar apenas os primeiros 20
            .forEach(r => {
              console.log(`   - ${r.email}: ${r.error}`);
            });
          if (stats.failed > 20) {
            console.log(`   ... e mais ${stats.failed - 20} falhas`);
          }
        }

        // Listar períodos não mapeados
        if (stats.invalidPeriod > 0) {
          console.log('\n⚠️  PERÍODOS NÃO MAPEADOS:');
          const uniquePeriods = new Set(
            stats.results
              .filter(r => r.error?.includes('não mapeado'))
              .map(r => r.periodo)
          );
          uniquePeriods.forEach(periodo => {
            console.log(`   - "${periodo}"`);
          });
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
    console.log('\n✅ Atualização concluída!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro na atualização:', error);
    process.exit(1);
  });

