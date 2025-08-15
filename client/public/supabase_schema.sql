-- Tabela para relacionar chat interno com thread_id do OpenAI Assistant
CREATE TABLE IF NOT EXISTS chat_threads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chat_id VARCHAR(255) NOT NULL UNIQUE, -- ID do chat interno da aplicação
    thread_id VARCHAR(255) NOT NULL, -- ID do thread do OpenAI Assistant
    diagnostico VARCHAR(100), -- Diagnóstico selecionado (ex: ansiedade)
    protocolo VARCHAR(100), -- Protocolo selecionado (ex: tcc)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para relacionar user_id com chat_id do OpenAI
CREATE TABLE IF NOT EXISTS user_chats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    chat_id VARCHAR(255) NOT NULL, -- ID do chat do OpenAI
    chat_threads_id UUID REFERENCES chat_threads(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_chat_threads_chat_id ON chat_threads(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_thread_id ON chat_threads(thread_id);
CREATE INDEX IF NOT EXISTS idx_user_chats_user_id ON user_chats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_chats_chat_id ON user_chats(chat_id);

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_chat_threads_updated_at 
    BEFORE UPDATE ON chat_threads 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_chats_updated_at 
    BEFORE UPDATE ON user_chats 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- RLS (Row Level Security) para garantir que usuários só vejam seus próprios dados
ALTER TABLE chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_chats ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para chat_threads
CREATE POLICY "Users can view their own chat threads" ON chat_threads
    FOR SELECT USING (
        chat_id IN (
            SELECT uc.chat_id 
            FROM user_chats uc 
            WHERE uc.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert their own chat threads" ON chat_threads
    FOR INSERT WITH CHECK (
        chat_id IN (
            SELECT uc.chat_id 
            FROM user_chats uc 
            WHERE uc.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own chat threads" ON chat_threads
    FOR UPDATE USING (
        chat_id IN (
            SELECT uc.chat_id 
            FROM user_chats uc 
            WHERE uc.user_id = auth.uid()
        )
    );

-- Políticas RLS para user_chats
CREATE POLICY "Users can view their own chats" ON user_chats
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own chats" ON user_chats
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own chats" ON user_chats
    FOR UPDATE USING (user_id = auth.uid());