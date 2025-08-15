-- ===== SCRIPT PARA CORRIGIR POLÍTICAS RLS =====
-- Execute este script no SQL Editor do Supabase Dashboard

-- Corrigir políticas para chat_threads
DROP POLICY IF EXISTS "Users can view own chat threads" ON chat_threads;
CREATE POLICY "Users can view own chat threads" ON chat_threads FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can insert own chat threads" ON chat_threads;  
CREATE POLICY "Users can insert own chat threads" ON chat_threads FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update own chat threads" ON chat_threads;
CREATE POLICY "Users can update own chat threads" ON chat_threads FOR UPDATE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can delete own chat threads" ON chat_threads;
CREATE POLICY "Users can delete own chat threads" ON chat_threads FOR DELETE USING (auth.uid() IS NOT NULL);

-- Corrigir políticas para user_chats  
DROP POLICY IF EXISTS "Users can view own chats" ON user_chats;
CREATE POLICY "Users can view own chats" ON user_chats FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own chats" ON user_chats;
CREATE POLICY "Users can insert own chats" ON user_chats FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own chats" ON user_chats;
CREATE POLICY "Users can update own chats" ON user_chats FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own chats" ON user_chats;
CREATE POLICY "Users can delete own chats" ON user_chats FOR DELETE USING (user_id = auth.uid());

-- ===== FIM DO SCRIPT =====