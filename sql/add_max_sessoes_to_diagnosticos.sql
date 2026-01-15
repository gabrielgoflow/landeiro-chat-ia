-- Migration: Adicionar campo max_sessoes na tabela diagnosticos
-- Execute este script no SQL Editor do Supabase Dashboard

-- 1. Adicionar coluna max_sessoes
ALTER TABLE diagnosticos 
ADD COLUMN IF NOT EXISTS max_sessoes INTEGER DEFAULT 10;

-- 2. Atualizar registros existentes com valores padrão
-- Depressão: 14 sessões (compatível com código atual)
UPDATE diagnosticos 
SET max_sessoes = 14 
WHERE codigo IN ('depressão', 'depressao');

-- Outros diagnósticos: 10 sessões (padrão)
UPDATE diagnosticos 
SET max_sessoes = 10 
WHERE max_sessoes IS NULL OR max_sessoes = 0;

-- 3. Adicionar comentário na coluna para documentação
COMMENT ON COLUMN diagnosticos.max_sessoes IS 'Número máximo de sessões permitidas para este diagnóstico';

-- 4. Adicionar constraint para garantir valores válidos (opcional, mas recomendado)
ALTER TABLE diagnosticos 
ADD CONSTRAINT check_max_sessoes_valid 
CHECK (max_sessoes >= 1 AND max_sessoes <= 100);
