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

interface ExportRow {
  Email: string;
  Senha: string;
  Nome: string;
}

interface ExportStats {
  total: number;
  exported: number;
  filtered: number;
  errors: number;
}

/**
 * Gera senha a partir dos 5 primeiros dígitos do CPF + sufixo fixo
 * (Mesma função do script de importação)
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
 * Lista todos os usuários do Supabase com paginação
 */
async function getAllUsers(supabase: any): Promise<Set<string>> {
  const userEmails = new Set<string>();
  let page = 1;
  const perPage = 1000;
  
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
        userEmails.add(user.email.toLowerCase());
      }
    });

    console.log(`📄 Página ${page}: ${data.users.length} usuários encontrados`);

    if (data.users.length < perPage) {
      break;
    }

    page++;
  }

  return userEmails;
}

/**
 * Gera nome do arquivo de saída com timestamp
 */
function generateOutputFilename(): string {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
  return `usuarios-email-senhas-${dateStr}.csv`;
}

/**
 * Função principal
 */
async function main() {
  const args = process.argv.slice(2);
  const onlyExisting = args.includes('--only-existing');
  const onlyNew = args.includes('--only-new');
  const csvPath = args.find(arg => !arg.startsWith('--')) || 
    path.join(process.cwd(), '(TODOS) Lista de Acessos - PCS - Lista Geral.csv');
  const outputPath = args.find((arg, index) => 
    index > 0 && !args[index - 1].startsWith('--') && arg.endsWith('.csv') && arg !== csvPath
  ) || path.join(process.cwd(), generateOutputFilename());

  console.log('📤 Script de Exportação de Email e Senhas\n');
  console.log(`📁 Arquivo CSV de entrada: ${csvPath}`);
  console.log(`📁 Arquivo CSV de saída: ${outputPath}`);
  console.log(`🔍 Filtrar apenas existentes: ${onlyExisting ? 'SIM' : 'NÃO'}`);
  console.log(`🔍 Filtrar apenas novos: ${onlyNew ? 'SIM' : 'NÃO'}\n`);

  // Verificar se arquivo existe
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ Arquivo não encontrado: ${csvPath}`);
    process.exit(1);
  }

  // Configurar Supabase (se necessário para filtragem)
  let supabase: any = null;
  let existingUsers: Set<string> = new Set();

  if (onlyExisting || onlyNew) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('❌ Variáveis de ambiente não configuradas (necessárias para filtragem):');
      console.error('   SUPABASE_URL ou VITE_SUPABASE_URL');
      console.error('   SUPABASE_SERVICE_ROLE_KEY');
      process.exit(1);
    }

    supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log('📋 Carregando lista de usuários do Supabase...\n');
    existingUsers = await getAllUsers(supabase);
    console.log(`✅ ${existingUsers.size} usuários encontrados no Supabase\n`);
  }

  // Ler e processar CSV
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  
  return new Promise<void>((resolve, reject) => {
    Papa.parse<CsvRow>(csvContent, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data;
        const stats: ExportStats = {
          total: rows.length,
          exported: 0,
          filtered: 0,
          errors: 0,
        };

        const exportData: ExportRow[] = [];

        console.log(`📊 Total de linhas no CSV: ${rows.length}\n`);
        console.log('🔄 Processando usuários...\n');

        // Processar cada linha
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const email = row['E-mail']?.trim();
          const nome = row['Nome']?.trim() || '';
          const cpf = row['CPF']?.trim() || '';

          // Validações
          if (!email || !isValidEmail(email)) {
            stats.errors++;
            continue;
          }

          if (!isValidCpf(cpf)) {
            stats.errors++;
            continue;
          }

          // Verificar filtros
          const emailLower = email.toLowerCase();
          const exists = existingUsers.has(emailLower);

          if (onlyExisting && !exists) {
            stats.filtered++;
            continue;
          }

          if (onlyNew && exists) {
            stats.filtered++;
            continue;
          }

          // Gerar senha
          const senha = generatePassword(cpf);

          // Adicionar à lista de exportação
          exportData.push({
            Email: email,
            Senha: senha,
            Nome: nome,
          });

          stats.exported++;

          // Log de progresso a cada 100 linhas
          if ((i + 1) % 100 === 0) {
            const progress = (((i + 1) / rows.length) * 100).toFixed(1);
            console.log(`📈 Progresso: ${i + 1}/${rows.length} (${progress}%) - Exportados: ${stats.exported}`);
          }
        }

        // Gerar CSV de saída
        console.log('\n💾 Gerando arquivo CSV de saída...\n');

        const csvOutput = Papa.unparse(exportData, {
          header: true,
          columns: ['Email', 'Senha', 'Nome'],
        });

        // Salvar arquivo
        try {
          fs.writeFileSync(outputPath, csvOutput, 'utf-8');
          console.log(`✅ Arquivo salvo: ${outputPath}\n`);
        } catch (error: any) {
          console.error(`❌ Erro ao salvar arquivo: ${error.message}`);
          reject(error);
          return;
        }

        // Relatório final
        console.log('='.repeat(60));
        console.log('📊 RELATÓRIO FINAL');
        console.log('='.repeat(60));
        console.log(`📦 Total processado: ${stats.total}`);
        console.log(`✅ Exportados: ${stats.exported}`);
        if (stats.filtered > 0) {
          console.log(`⏭️  Filtrados: ${stats.filtered}`);
        }
        if (stats.errors > 0) {
          console.log(`❌ Erros (dados inválidos): ${stats.errors}`);
        }
        console.log(`📁 Arquivo gerado: ${outputPath}`);
        console.log('='.repeat(60));

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
    console.log('\n✅ Exportação concluída!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro na exportação:', error);
    process.exit(1);
  });




