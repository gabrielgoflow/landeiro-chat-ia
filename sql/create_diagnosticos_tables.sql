-- Script para criar tabelas de diagnosticos e user_diagnosticos
-- Execute este script no SQL Editor do Supabase Dashboard

-- 1. Adicionar campo data_final_acesso na tabela user_metadata
ALTER TABLE user_metadata 
ADD COLUMN IF NOT EXISTS data_final_acesso TIMESTAMP WITH TIME ZONE;

-- 2. Criar tabela diagnosticos
CREATE TABLE IF NOT EXISTS diagnosticos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome VARCHAR(255) NOT NULL,
  codigo VARCHAR(100) NOT NULL UNIQUE,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Criar tabela user_diagnosticos
CREATE TABLE IF NOT EXISTS user_diagnosticos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  diagnostico_id UUID NOT NULL REFERENCES diagnosticos(id) ON DELETE CASCADE,
  liberado_em TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, diagnostico_id)
);

-- 4. Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_diagnosticos_codigo ON diagnosticos(codigo);
CREATE INDEX IF NOT EXISTS idx_diagnosticos_ativo ON diagnosticos(ativo);
CREATE INDEX IF NOT EXISTS idx_user_diagnosticos_user_id ON user_diagnosticos(user_id);
CREATE INDEX IF NOT EXISTS idx_user_diagnosticos_diagnostico_id ON user_diagnosticos(diagnostico_id);

-- 5. Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_diagnosticos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_diagnosticos_updated_at 
    BEFORE UPDATE ON diagnosticos 
    FOR EACH ROW 
    EXECUTE FUNCTION update_diagnosticos_updated_at();

-- 6. RLS (Row Level Security)
ALTER TABLE diagnosticos ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_diagnosticos ENABLE ROW LEVEL SECURITY;

-- 7. Políticas de acesso para diagnosticos (todos podem ver, apenas admins podem modificar)
DROP POLICY IF EXISTS "Anyone can view active diagnosticos" ON diagnosticos;
CREATE POLICY "Anyone can view active diagnosticos" ON diagnosticos
    FOR SELECT USING (ativo = true OR auth.uid() IN (SELECT user_id FROM user_metadata WHERE role = 'admin'));

DROP POLICY IF EXISTS "Admins can view all diagnosticos" ON diagnosticos;
CREATE POLICY "Admins can view all diagnosticos" ON diagnosticos
    FOR SELECT USING (auth.uid() IN (SELECT user_id FROM user_metadata WHERE role = 'admin'));

DROP POLICY IF EXISTS "Admins can update diagnosticos" ON diagnosticos;
CREATE POLICY "Admins can update diagnosticos" ON diagnosticos
    FOR UPDATE USING (auth.uid() IN (SELECT user_id FROM user_metadata WHERE role = 'admin'));

-- 8. Políticas de acesso para user_diagnosticos
DROP POLICY IF EXISTS "Users can view their own diagnosticos" ON user_diagnosticos;
CREATE POLICY "Users can view their own diagnosticos" ON user_diagnosticos
    FOR SELECT USING (user_id = auth.uid() OR auth.uid() IN (SELECT user_id FROM user_metadata WHERE role = 'admin'));

DROP POLICY IF EXISTS "Users can insert their own diagnosticos" ON user_diagnosticos;
CREATE POLICY "Users can insert their own diagnosticos" ON user_diagnosticos
    FOR INSERT WITH CHECK (user_id = auth.uid() OR auth.uid() IN (SELECT user_id FROM user_metadata WHERE role = 'admin'));

-- 9. Inserir os 12 transtornos iniciais
INSERT INTO diagnosticos (nome, codigo, ativo) VALUES
  ('Depressão', 'depressão', true),
  ('Transtorno Bipolar', 'transtorno_bipolar', true),
  ('Transtorno de Ansiedade Generalizada (TAG)', 'transtorno_ansiedade_generalizada', true),
  ('Transtorno da Ansiedade Social', 'transtorno_ansiedade_social', true),
  ('Transtorno de Pânico', 'transtorno_panico', true),
  ('Transtorno Obsessivo-Compulsivo (TOC)', 'transtorno_obsessivo_compulsivo', true),
  ('Transtorno de Déficit de Atenção e Hiperatividade (TDAH)', 'transtorno_deficit_atencao_hiperatividade', true),
  ('Transtorno do Estresse Pós-Traumático (TEPT)', 'transtorno_estresse_pos_traumatico', true),
  ('Esquizofrenia', 'esquizofrenia', true),
  ('Transtorno de Jogo', 'transtorno_jogo', true),
  ('Transtorno da Compulsão Alimentar', 'transtorno_compulsao_alimentar', true)
ON CONFLICT (codigo) DO NOTHING;

