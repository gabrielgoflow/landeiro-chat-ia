-- ===== SCRIPT PARA CRIAR TABELAS SUPABASE =====
-- Execute este script no SQL Editor do Supabase Dashboard

-- 1. Tabela chat_threads
CREATE TABLE IF NOT EXISTS chat_threads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chat_id VARCHAR(255) NOT NULL UNIQUE,
    thread_id VARCHAR(255) NOT NULL,
    diagnostico VARCHAR(100),
    protocolo VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela user_chats
CREATE TABLE IF NOT EXISTS user_chats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    chat_id VARCHAR(255) NOT NULL,
    chat_threads_id UUID REFERENCES chat_threads(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_chat_threads_chat_id ON chat_threads(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_thread_id ON chat_threads(thread_id);
CREATE INDEX IF NOT EXISTS idx_user_chats_user_id ON user_chats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_chats_chat_id ON user_chats(chat_id);

-- 4. RLS (Segurança por usuário)
ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_chats ENABLE ROW LEVEL SECURITY;

-- 5. Políticas de acesso para user_chats
CREATE POLICY "Users can view own chats" ON user_chats FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own chats" ON user_chats FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own chats" ON user_chats FOR UPDATE USING (user_id = auth.uid());

-- ===== FIM DO SCRIPT =====