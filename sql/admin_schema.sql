-- Admin Panel Database Schema
-- Tabelas para painel administrativo: custos, metadados de usuários e logs de auditoria

-- ===========================================
-- ADMIN TABLES
-- ===========================================

-- Tabela de custos por sessão
CREATE TABLE IF NOT EXISTS session_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id VARCHAR NOT NULL,
  user_id UUID NOT NULL,
  sessao INTEGER NOT NULL,
  cost_amount DECIMAL(10, 2),
  tokens_input INTEGER,
  tokens_output INTEGER,
  api_calls INTEGER DEFAULT 0,
  cost_breakdown JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de metadados de usuários
CREATE TABLE IF NOT EXISTS user_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  full_name VARCHAR,
  role VARCHAR DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de logs de auditoria
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  action VARCHAR NOT NULL,
  target_user_id UUID,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- INDEXES FOR PERFORMANCE
-- ===========================================

-- Índices para session_costs
CREATE INDEX IF NOT EXISTS idx_session_costs_chat_id ON session_costs(chat_id);
CREATE INDEX IF NOT EXISTS idx_session_costs_user_id ON session_costs(user_id);
CREATE INDEX IF NOT EXISTS idx_session_costs_sessao ON session_costs(sessao);
CREATE INDEX IF NOT EXISTS idx_session_costs_created_at ON session_costs(created_at DESC);

-- Índices para user_metadata
CREATE INDEX IF NOT EXISTS idx_user_metadata_user_id ON user_metadata(user_id);
CREATE INDEX IF NOT EXISTS idx_user_metadata_role ON user_metadata(role);

-- Índices para audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_user_id ON audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_user_id ON audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Índices adicionais para queries administrativas em tabelas existentes
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(chat_id) WHERE chat_id IN (
  SELECT chat_id FROM user_chats
);

-- ===========================================
-- FUNCTIONS
-- ===========================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_session_costs_updated_at
  BEFORE UPDATE ON session_costs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_metadata_updated_at
  BEFORE UPDATE ON user_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- VIEWS FOR ADMIN QUERIES
-- ===========================================

-- View para resumo de custos por usuário
CREATE OR REPLACE VIEW v_user_costs_summary AS
SELECT 
  sc.user_id,
  COUNT(DISTINCT sc.chat_id) as total_sessions,
  COUNT(*) as total_cost_records,
  SUM(sc.cost_amount) as total_cost,
  SUM(sc.tokens_input) as total_tokens_input,
  SUM(sc.tokens_output) as total_tokens_output,
  SUM(sc.api_calls) as total_api_calls,
  MIN(sc.created_at) as first_cost_date,
  MAX(sc.created_at) as last_cost_date
FROM session_costs sc
GROUP BY sc.user_id;

-- View para resumo de custos por sessão
CREATE OR REPLACE VIEW v_session_costs_summary AS
SELECT 
  sc.chat_id,
  sc.sessao,
  sc.user_id,
  sc.cost_amount,
  sc.tokens_input,
  sc.tokens_output,
  sc.api_calls,
  sc.created_at,
  ct.diagnostico,
  ct.protocolo
FROM session_costs sc
LEFT JOIN chat_threads ct ON sc.chat_id = ct.chat_id;

-- View para estatísticas de uso por usuário
CREATE OR REPLACE VIEW v_user_usage_stats AS
SELECT 
  uc.user_id,
  COUNT(DISTINCT uc.chat_id) as total_chats,
  COUNT(DISTINCT ct.sessao) as total_sessions,
  COUNT(cm.id) as total_messages,
  COUNT(CASE WHEN cm.sender = 'user' THEN 1 END) as user_messages,
  COUNT(CASE WHEN cm.sender = 'assistant' THEN 1 END) as assistant_messages,
  MIN(cm.created_at) as first_message_date,
  MAX(cm.created_at) as last_message_date,
  COALESCE(vcs.total_cost, 0) as total_cost
FROM user_chats uc
LEFT JOIN chat_threads ct ON uc.chat_id = ct.chat_id
LEFT JOIN chat_messages cm ON uc.chat_id = cm.chat_id
LEFT JOIN v_user_costs_summary vcs ON uc.user_id = vcs.user_id
GROUP BY uc.user_id, vcs.total_cost;

-- ===========================================
-- RLS POLICIES (Row Level Security)
-- ===========================================

-- Habilitar RLS nas tabelas admin
ALTER TABLE session_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas para session_costs (apenas admins podem ver todos, usuários veem apenas os seus)
DROP POLICY IF EXISTS "Admins can view all session costs" ON session_costs;
CREATE POLICY "Admins can view all session costs" ON session_costs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_metadata um
      WHERE um.user_id = auth.uid() AND um.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can view own session costs" ON session_costs;
CREATE POLICY "Users can view own session costs" ON session_costs
  FOR SELECT
  USING (user_id = auth.uid());

-- Políticas para user_metadata (apenas admins podem ver/editar)
DROP POLICY IF EXISTS "Admins can view all user metadata" ON user_metadata;
CREATE POLICY "Admins can view all user metadata" ON user_metadata
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_metadata um
      WHERE um.user_id = auth.uid() AND um.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Users can view own metadata" ON user_metadata;
CREATE POLICY "Users can view own metadata" ON user_metadata
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can update user metadata" ON user_metadata;
CREATE POLICY "Admins can update user metadata" ON user_metadata
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_metadata um
      WHERE um.user_id = auth.uid() AND um.role = 'admin'
    )
  );

-- Políticas para audit_logs (apenas admins podem ver)
DROP POLICY IF EXISTS "Admins can view audit logs" ON audit_logs;
CREATE POLICY "Admins can view audit logs" ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_metadata um
      WHERE um.user_id = auth.uid() AND um.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can insert audit logs" ON audit_logs;
CREATE POLICY "Admins can insert audit logs" ON audit_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_metadata um
      WHERE um.user_id = auth.uid() AND um.role = 'admin'
    )
  );




