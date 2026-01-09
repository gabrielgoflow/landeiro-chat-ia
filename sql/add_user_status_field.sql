-- Adicionar campo status na tabela user_metadata
-- Execute este script no SQL Editor do Supabase Dashboard

-- Adicionar coluna status se não existir
ALTER TABLE user_metadata 
ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'ativo';

-- Adicionar constraint CHECK para valores válidos
ALTER TABLE user_metadata
DROP CONSTRAINT IF EXISTS user_metadata_status_check;

ALTER TABLE user_metadata
ADD CONSTRAINT user_metadata_status_check 
CHECK (status IN ('ativo', 'inadimplente'));

-- Atualizar registros existentes para ter status 'ativo' se NULL
UPDATE user_metadata 
SET status = 'ativo' 
WHERE status IS NULL;

-- Criar índice para melhor performance em consultas por status
CREATE INDEX IF NOT EXISTS idx_user_metadata_status ON user_metadata(status);
