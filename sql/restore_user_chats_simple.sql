-- ===========================================
-- Migration Simples: Restaurar user_chats
-- ===========================================
-- Restaura registros em user_chats baseado em session_costs e chat_threads
-- ===========================================

-- Restaurar user_chats a partir de session_costs (que tem user_id + chat_id)
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
    SELECT 1 FROM user_chats uc 
    WHERE uc.user_id = sc.user_id 
    AND uc.chat_id = sc.chat_id
)
ORDER BY sc.chat_id, sc.user_id, sc.created_at DESC;

-- Mostrar quantos registros foram inseridos
SELECT COUNT(*) as registros_inseridos
FROM user_chats
WHERE created_at >= NOW() - INTERVAL '1 minute';
