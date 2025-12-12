import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../shared/schema";
import { createClient } from "@supabase/supabase-js";

// Database connection setup
let db: ReturnType<typeof drizzle> | null = null;
let client: ReturnType<typeof postgres> | null = null;
let supabaseClient: ReturnType<typeof createSupabaseClient> | null = null;

/**
 * Cria cliente Supabase seguindo a documentação oficial
 * https://supabase.com/docs/guides/getting-started/quickstarts/react
 */
function createSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.warn("⚠️ Supabase URL or Key not found - some features may not work");
    return null;
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Converte URL de conexão direta para formato pooler do Supabase
 * Seguindo a mesma configuração do N8N
 */
function ensurePoolerUrl(connectionUrl: string): string {
  // Se já está usando pooler, retornar como está
  if (connectionUrl.includes('pooler.supabase.com') || connectionUrl.includes(':6543')) {
    return connectionUrl;
  }

  // Tentar converter URL direta para pooler
  // Formato esperado: postgresql://postgres.fnprdocklfpmndailkoo:SENHA@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
  try {
    const url = new URL(connectionUrl);
    
    // Extrair projeto ID do usuário ou host
    let projetoId = 'fnprdocklfpmndailkoo'; // default do projeto
    if (url.username.includes('.')) {
      projetoId = url.username.split('.')[1];
    } else if (url.hostname.includes('.')) {
      const parts = url.hostname.split('.');
      // Tentar extrair do hostname
      projetoId = parts[0] || 'fnprdocklfpmndailkoo';
    }

    // Construir URL do pooler
    const poolerUrl = `postgresql://postgres.${projetoId}:${url.password}@aws-1-sa-east-1.pooler.supabase.com:6543${url.pathname}?pgbouncer=true`;
    console.log("🔄 Converted direct connection to pooler format");
    return poolerUrl;
  } catch (error) {
    console.warn("⚠️ Could not convert to pooler URL, using original:", error);
    return connectionUrl;
  }
}

if (process.env.DATABASE_URL) {
  try {
    // Primeiro, criar cliente Supabase (seguindo documentação oficial)
    supabaseClient = createSupabaseClient();
    if (supabaseClient) {
      console.log("✅ Supabase client created (following official docs)");
    }

    // Para Drizzle ORM, precisamos de conexão PostgreSQL direta
    // Mas vamos usar o pooler do Supabase (mesmo formato do N8N)
    let connectionUrl = process.env.DATABASE_URL;
    
    // Garantir que estamos usando pooler (mesmo formato do N8N)
    connectionUrl = ensurePoolerUrl(connectionUrl);
    
    // Log da configuração (sem expor senha)
    const urlForLog = connectionUrl.replace(/:([^:@]+)@/, ':****@');
    console.log("🔗 Database connection URL:", urlForLog);
    
    // Verificar se está usando pooler
    const isUsingPooler = connectionUrl.includes('pooler.supabase.com') || connectionUrl.includes(':6543');
    
    if (!isUsingPooler) {
      console.warn("⚠️ NOT using Supabase pooler - this may cause connection issues!");
      console.warn("   N8N uses pooler - configure DATABASE_URL with pooler format");
      console.warn("   Format: postgresql://postgres.fnprdocklfpmndailkoo:SENHA@aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true");
    } else {
      console.log("✅ Using Supabase pooler connection (same as N8N)");
    }
    
    // Configuração para pooler do Supabase (seguindo padrão do N8N)
    // O pooler gerencia as conexões, então configuração mínima
    client = postgres(connectionUrl, { 
      prepare: false, // OBRIGATÓRIO para Supabase pooler (não suporta prepared statements)
      max: 3, // Número baixo de conexões (pooler gerencia o pool)
      idle_timeout: 20, // Fechar conexões idle rapidamente
      connect_timeout: 5, // Timeout curto de conexão
      max_lifetime: 60 * 10, // Máximo de 10 minutos por conexão (pooler recicla conexões)
      // Silenciar notices do PostgreSQL
      onnotice: () => {},
      // Transformar undefined para null (compatibilidade)
      transform: {
        undefined: null
      }
    });
    db = drizzle(client, { schema });
    console.log("✅ Drizzle ORM initialized with Supabase pooler");
    
    // Testar conexão de forma assíncrona (não bloquear inicialização)
    client`SELECT 1 as test`.then(() => {
      console.log("✅ Connection test passed");
    }).catch((testError: any) => {
      console.error("⚠️ Connection test failed:", testError?.message || testError);
      console.error("   This may indicate authentication or configuration issues");
    });
  } catch (error: any) {
    console.error("❌ Failed to connect to database:");
    console.error("   Error:", error?.message || error);
    console.error("   Code:", error?.code);
    console.error("   Hint: Verify DATABASE_URL matches N8N configuration");
  }
} else {
  console.warn("⚠️ DATABASE_URL not found - using in-memory storage");
}

export { db, client, supabaseClient };