-- Adicionar campos para armazenar estado de pausa do timer
-- Execute este script no SQL Editor do Supabase Dashboard

-- Adicionar campos na tabela chat_threads
ALTER TABLE chat_threads 
ADD COLUMN IF NOT EXISTS timer_paused BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS timer_paused_time BIGINT;

-- Comentários para documentação
COMMENT ON COLUMN chat_threads.timer_paused IS 'Indica se o timer da sessão está pausado';
COMMENT ON COLUMN chat_threads.timer_paused_time IS 'Tempo restante em milissegundos quando o timer foi pausado';


