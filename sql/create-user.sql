-- Query SQL para criar usuário de teste diretamente no Supabase
-- Execute esta query no SQL Editor do Supabase

-- Criar usuário usando a função auth.users do Supabase
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'terapeuta@teste.com',
    crypt('senha123', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
) RETURNING id, email;

-- Nota: Após executar a query acima, copie o ID retornado e use nas próximas queries

-- Agora execute esta query para criar os dados de teste
-- SUBSTITUA 'USER_ID_COPIADO_ACIMA' pelo ID retornado da query anterior

-- 1. Inserir chat_threads (sempre usando TCC)
INSERT INTO chat_threads (id, chat_id, thread_id, diagnostico, protocolo) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'chat_001', 'thread_openai_001', 'ansiedade', 'tcc'),
    ('550e8400-e29b-41d4-a716-446655440002', 'chat_002', 'thread_openai_002', 'depressao', 'tcc'),
    ('550e8400-e29b-41d4-a716-446655440003', 'chat_003', 'thread_openai_003', 'estresse', 'tcc');

-- 2. Inserir user_chats (substitua USER_ID_COPIADO_ACIMA)
INSERT INTO user_chats (user_id, chat_id, chat_threads_id) VALUES
    ('USER_ID_COPIADO_ACIMA', 'chat_001', '550e8400-e29b-41d4-a716-446655440001'),
    ('USER_ID_COPIADO_ACIMA', 'chat_002', '550e8400-e29b-41d4-a716-446655440002'),
    ('USER_ID_COPIADO_ACIMA', 'chat_003', '550e8400-e29b-41d4-a716-446655440003');

-- 3. Inserir review para teste
INSERT INTO chat_reviews (chat_id, resumo_atendimento, feedback_direto, sinais_paciente, pontos_positivos, pontos_negativos) VALUES
    ('chat_001', 
     'Paciente apresentou sintomas de ansiedade durante a sessão. Demonstrou boa receptividade às técnicas de TCC apresentadas.',
     'Continue focando nas técnicas de respiração e reestruturação cognitiva. Paciente está progredindo bem.',
     ARRAY['Tensão muscular', 'Respiração acelerada', 'Preocupação excessiva'],
     ARRAY['Boa participação', 'Receptivo às técnicas', 'Demonstrou insight'],
     ARRAY['Resistência inicial', 'Dificuldade para relaxar']
    );