-- Query para criar usuário de teste no Supabase
-- Execute esta query no SQL Editor do Supabase

-- ATENÇÃO: Esta query NÃO funciona diretamente no SQL Editor
-- A criação de usuários deve ser feita via:
-- 1. Interface do Supabase Dashboard (Authentication > Users > Add user)
-- 2. API Admin do Supabase 
-- 3. SDK do Supabase com service key

-- Para criar via interface do Supabase Dashboard:
-- 1. Vá para Authentication > Users
-- 2. Clique em "Add user"
-- 3. Preencha:
--    Email: terapeuta@teste.com
--    Password: senha123
--    Email confirmed: true (marque)
-- 4. Clique em "Create user"

-- Para criar via API REST (use no terminal ou Postman):
-- POST https://SEU_PROJETO.supabase.co/auth/v1/admin/users
-- Headers:
-- Authorization: Bearer SUA_SERVICE_KEY
-- Content-Type: application/json
-- apikey: SUA_SERVICE_KEY
-- Body:
-- {
--   "email": "terapeuta@teste.com",
--   "password": "senha123",
--   "email_confirm": true
-- }

-- Após criar o usuário, você receberá o user_id (UUID)
-- Use esse ID na query abaixo para criar os dados de teste:

-- SUBSTITUA 'USER_ID_AQUI' pelo UUID retornado
SELECT 'Usuário criado! Agora execute as queries de dados de teste com o ID: USER_ID_AQUI' as message;