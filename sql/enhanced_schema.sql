-- Enhanced Database Schema for Landeiro Atendimento IA
-- Opção 1 + Melhorias: Separação clara entre Reviews e Histórico

-- ===========================================
-- CORE TABLES
-- ===========================================

-- Threads de chat - controle de sessões e metadata
CREATE TABLE IF NOT EXISTS chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id VARCHAR NOT NULL,
  thread_id VARCHAR NOT NULL,
  diagnostico VARCHAR,
  protocolo VARCHAR,
  sessao SMALLINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Relacionamento entre usuários e chats
CREATE TABLE IF NOT EXISTS user_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  chat_id VARCHAR NOT NULL,
  chat_threads_id UUID REFERENCES chat_threads(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- SEPARATED CONCERNS TABLES
-- ===========================================

-- 1. HISTÓRICO ESTRUTURADO - nova tabela chat_messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id VARCHAR NOT NULL,
  thread_id VARCHAR,
  message_id VARCHAR NOT NULL,
  sender VARCHAR NOT NULL CHECK (sender IN ('user', 'assistant')),
  content TEXT NOT NULL,
  message_type VARCHAR DEFAULT 'text' CHECK (message_type IN ('text', 'audio')),
  audio_url VARCHAR,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. REVIEWS DE SUPERVISÃO - tabela separada chat_reviews
CREATE TABLE IF NOT EXISTS chat_reviews (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id VARCHAR NOT NULL UNIQUE,
  resumo_atendimento TEXT NOT NULL,
  feedback_direto TEXT NOT NULL,
  sinais_paciente TEXT[] NOT NULL,
  pontos_positivos TEXT[] NOT NULL,
  pontos_negativos TEXT[] NOT NULL,
  sessao SMALLINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- PERFORMANCE INDEXES
-- ===========================================

-- Índices para chat_messages (histórico)
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_id ON chat_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_id ON chat_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender ON chat_messages(sender);

-- Índices para chat_threads
CREATE INDEX IF NOT EXISTS idx_chat_threads_chat_id ON chat_threads(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_thread_id ON chat_threads(thread_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_sessao ON chat_threads(sessao);

-- Índices para chat_reviews
CREATE INDEX IF NOT EXISTS idx_chat_reviews_chat_id ON chat_reviews(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_reviews_sessao ON chat_reviews(sessao);

-- Índices para user_chats
CREATE INDEX IF NOT EXISTS idx_user_chats_user_id ON user_chats(user_id);
CREATE INDEX IF NOT EXISTS idx_user_chats_chat_id ON user_chats(chat_id);

-- ===========================================
-- OPTIMIZED VIEWS
-- ===========================================

-- View para overview completo de chat
CREATE OR REPLACE VIEW v_chat_overview AS
SELECT 
  ct.chat_id,
  ct.thread_id,
  ct.diagnostico,
  ct.protocolo,
  ct.sessao,
  ct.created_at as thread_created,
  uc.user_id,
  CASE 
    WHEN cr.id IS NOT NULL THEN 'finalizado'
    ELSE 'em_andamento'
  END as status,
  cr.id as review_id,
  cr.created_at as review_created,
  COALESCE(msg_count.total_messages, 0) as total_messages,
  msg_count.last_message_at
FROM chat_threads ct
LEFT JOIN user_chats uc ON ct.chat_id = uc.chat_id
LEFT JOIN chat_reviews cr ON ct.chat_id = cr.chat_id
LEFT JOIN (
  SELECT 
    chat_id,
    COUNT(*) as total_messages,
    MAX(created_at) as last_message_at
  FROM chat_messages
  GROUP BY chat_id
) msg_count ON ct.chat_id = msg_count.chat_id;

-- View para histórico de sessões por usuário
CREATE OR REPLACE VIEW v_user_sessions AS
SELECT 
  uc.user_id,
  ct.chat_id,
  ct.thread_id,
  ct.diagnostico,
  ct.protocolo,
  ct.sessao,
  ct.created_at as session_started,
  cr.created_at as session_finished,
  CASE 
    WHEN cr.id IS NOT NULL THEN 'finalizada'
    ELSE 'em_andamento'
  END as session_status,
  cr.resumo_atendimento
FROM chat_threads ct
JOIN user_chats uc ON ct.chat_id = uc.chat_id
LEFT JOIN chat_reviews cr ON ct.chat_id = cr.chat_id
ORDER BY uc.user_id, ct.sessao DESC;

-- ===========================================
-- ARCHITECTURE BENEFITS
-- ===========================================

/*
## Vantagens da Opção 1 + Melhorias:

### 1. SEPARAÇÃO CLARA DE RESPONSABILIDADES
- chat_threads: controle de sessões e metadata
- chat_messages: histórico estruturado de mensagens
- chat_reviews: reviews de supervisão

### 2. PERFORMANCE OTIMIZADA
- Índices específicos para cada contexto de consulta
- Views pré-computadas para queries frequentes
- Queries isoladas por tipo de dado

### 3. ESCALABILIDADE
- Tabelas menores e mais focadas
- Fácil particionamento futuro
- Crescimento independente de cada tipo de dado

### 4. MANUTENÇÃO SIMPLIFICADA
- Modificações isoladas por feature
- Backup e restore granular
- Debugging focado por contexto

### 5. FLEXIBILIDADE
- Novos tipos de mensagem facilmente adicionados
- Reviews podem evoluir independentemente
- Histórico pode ser arquivado separadamente

### 6. QUERIES TÍPICAS OTIMIZADAS
- Buscar mensagens: SELECT * FROM chat_messages WHERE chat_id = ?
- Overview de chat: SELECT * FROM v_chat_overview WHERE chat_id = ?
- Stats rápidas: Índices específicos para agregações
- Sessões por usuário: SELECT * FROM v_user_sessions WHERE user_id = ?
*/