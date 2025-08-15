import { supabase } from '@/lib/supabase.js'

// SQL para criar as tabelas necessárias
const MIGRATION_SQL = `
-- Tabela para relacionar chat interno com thread_id do OpenAI Assistant
CREATE TABLE IF NOT EXISTS chat_threads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chat_id VARCHAR(255) NOT NULL UNIQUE,
    thread_id VARCHAR(255) NOT NULL,
    diagnostico VARCHAR(100),
    protocolo VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para relacionar user_id com chat_id do OpenAI
CREATE TABLE IF NOT EXISTS user_chats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    chat_id VARCHAR(255) NOT NULL,
    chat_threads_id UUID REFERENCES chat_threads(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_chat_threads_chat_id ON chat_threads(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_thread_id ON chat_threads(thread_id);
CREATE INDEX IF NOT EXISTS idx_user_chats_user_id ON user_chats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_chats_chat_id ON user_chats(chat_id);

-- RLS (Row Level Security)
ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_chats ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para user_chats
DROP POLICY IF EXISTS "Users can view their own chats" ON user_chats;
CREATE POLICY "Users can view their own chats" ON user_chats
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert their own chats" ON user_chats;
CREATE POLICY "Users can insert their own chats" ON user_chats
    FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own chats" ON user_chats;
CREATE POLICY "Users can update their own chats" ON user_chats
    FOR UPDATE USING (user_id = auth.uid());
`;

export async function runSupabaseMigration() {
  try {
    console.log('Executando migração das tabelas...')
    
    // Execute o SQL de migração
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_query: MIGRATION_SQL 
    })

    if (error) {
      console.error('Erro na migração:', error)
      return { success: false, error: error.message }
    }

    console.log('Migração executada com sucesso!')
    return { success: true, data }
    
  } catch (error) {
    console.error('Erro inesperado na migração:', error)
    return { success: false, error: error.message }
  }
}

// Função alternativa usando SQL direto caso a função RPC não esteja disponível
export async function runSupabaseMigrationDirect() {
  try {
    console.log('Executando migração das tabelas (método direto)...')
    
    // Criar tabela chat_threads
    const { error: error1 } = await supabase.rpc('exec', {
      query: `
        CREATE TABLE IF NOT EXISTS chat_threads (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            chat_id VARCHAR(255) NOT NULL UNIQUE,
            thread_id VARCHAR(255) NOT NULL,
            diagnostico VARCHAR(100),
            protocolo VARCHAR(100),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    })

    // Criar tabela user_chats
    const { error: error2 } = await supabase.rpc('exec', {
      query: `
        CREATE TABLE IF NOT EXISTS user_chats (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
            chat_id VARCHAR(255) NOT NULL,
            chat_threads_id UUID REFERENCES chat_threads(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
      `
    })

    if (error1 || error2) {
      const errors = [error1, error2].filter(Boolean)
      console.error('Erros na migração:', errors)
      return { success: false, errors }
    }

    console.log('Migração executada com sucesso (método direto)!')
    return { success: true }
    
  } catch (error) {
    console.error('Erro inesperado na migração:', error)
    return { success: false, error: error.message }
  }
}

// Verificar se as tabelas já existem
export async function checkTablesExist() {
  try {
    const { data: chatThreads, error: error1 } = await supabase
      .from('chat_threads')
      .select('count', { count: 'exact' })
      .limit(1)

    const { data: userChats, error: error2 } = await supabase
      .from('user_chats')
      .select('count', { count: 'exact' })
      .limit(1)

    return {
      chatThreadsExists: !error1,
      userChatsExists: !error2,
      allTablesExist: !error1 && !error2,
      errors: { chatThreads: error1?.message, userChats: error2?.message }
    }
  } catch (error) {
    return {
      chatThreadsExists: false,
      userChatsExists: false,
      allTablesExist: false,
      error: error.message
    }
  }
}