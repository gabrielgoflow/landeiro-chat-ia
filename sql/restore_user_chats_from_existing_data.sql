-- ===========================================
-- Migration: Restaurar user_chats a partir de dados existentes
-- ===========================================
-- Esta migration restaura registros em user_chats baseado em:
-- 1. chat_threads existentes
-- 2. session_costs (que relaciona chat_id com user_id)
-- 3. Evita duplicatas (não insere se já existir)
-- ===========================================

-- Método 1: Restaurar a partir de session_costs (mais confiável)
-- Busca user_id através de session_costs que tem tanto chat_id quanto user_id
INSERT INTO user_chats (user_id, chat_id, chat_threads_id, created_at, updated_at)
SELECT DISTINCT ON (sc.chat_id, sc.user_id)
    sc.user_id,
    sc.chat_id,
    ct.id as chat_threads_id,
    COALESCE(ct.created_at, sc.created_at, NOW()) as created_at,
    NOW() as updated_at
FROM session_costs sc
INNER JOIN chat_threads ct ON ct.chat_id = sc.chat_id
WHERE NOT EXISTS (
    -- Não inserir se já existir um registro com esse user_id e chat_id
    SELECT 1 FROM user_chats uc 
    WHERE uc.user_id = sc.user_id 
    AND uc.chat_id = sc.chat_id
)
ORDER BY sc.chat_id, sc.user_id, sc.created_at DESC;

-- Método 2: Para chats que não têm session_costs mas têm chat_threads
-- Tenta encontrar user_id através de outros meios ou deixa NULL (será tratado manualmente)
-- NOTA: Este método requer atenção manual para chats sem user_id identificado

-- Log de quantos registros foram restaurados
DO $$
DECLARE
    restored_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO restored_count
    FROM user_chats uc
    WHERE uc.created_at >= NOW() - INTERVAL '1 minute';
    
    RAISE NOTICE 'Registros restaurados em user_chats: %', restored_count;
END $$;

-- Verificar chats órfãos (chat_threads sem user_chats correspondente)
-- Estes precisarão ser tratados manualmente
SELECT 
    ct.chat_id,
    ct.diagnostico,
    ct.protocolo,
    ct.sessao,
    ct.created_at as thread_created_at,
    CASE 
        WHEN sc.user_id IS NOT NULL THEN sc.user_id::text
        ELSE 'USER_ID_NÃO_ENCONTRADO'
    END as suggested_user_id
FROM chat_threads ct
LEFT JOIN user_chats uc ON uc.chat_id = ct.chat_id
LEFT JOIN session_costs sc ON sc.chat_id = ct.chat_id
WHERE uc.id IS NULL
GROUP BY ct.chat_id, ct.diagnostico, ct.protocolo, ct.sessao, ct.created_at, sc.user_id
ORDER BY ct.created_at DESC;

-- ===========================================
-- INSTRUÇÕES:
-- ===========================================
-- 1. Execute este script no SQL Editor do Supabase
-- 2. Verifique o resultado da query de "chats órfãos" acima
-- 3. Para chats com suggested_user_id, você pode inserir manualmente:
--    INSERT INTO user_chats (user_id, chat_id, chat_threads_id)
--    VALUES ('USER_ID_AQUI', 'chat_id_aqui', (SELECT id FROM chat_threads WHERE chat_id = 'chat_id_aqui' LIMIT 1));
-- 4. Para chats sem user_id identificado, será necessário investigar manualmente
-- ===========================================
