-- Query completa para criar usuário de teste
-- Execute esta query no SQL Editor do Supabase

-- 1. Inserir chat_threads
INSERT INTO chat_threads (id, chat_id, thread_id, diagnostico, protocolo) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'chat_001', 'thread_openai_001', 'ansiedade', 'tcc'),
    ('550e8400-e29b-41d4-a716-446655440002', 'chat_002', 'thread_openai_002', 'depressao', 'dbt'),
    ('550e8400-e29b-41d4-a716-446655440003', 'chat_003', 'thread_openai_003', 'estresse', 'mindfulness');

-- 2. Inserir user_chats
-- SUBSTITUA 'SEU_USER_ID_AQUI' pelo ID do usuário criado no Supabase Auth
INSERT INTO user_chats (user_id, chat_id, chat_threads_id) VALUES
    ('SEU_USER_ID_AQUI', 'chat_001', '550e8400-e29b-41d4-a716-446655440001'),
    ('SEU_USER_ID_AQUI', 'chat_002', '550e8400-e29b-41d4-a716-446655440002'),
    ('SEU_USER_ID_AQUI', 'chat_003', '550e8400-e29b-41d4-a716-446655440003');

-- 3. Inserir review para teste (faz o chat_001 aparecer como FINALIZADO)
INSERT INTO chat_reviews (chat_id, resumo_atendimento, feedback_direto, sinais_paciente, pontos_positivos, pontos_negativos) VALUES
    ('chat_001', 
     'Paciente apresentou sintomas de ansiedade durante a sessão. Demonstrou boa receptividade às técnicas de TCC apresentadas.',
     'Continue focando nas técnicas de respiração e reestruturação cognitiva. Paciente está progredindo bem.',
     ARRAY['Tensão muscular', 'Respiração acelerada', 'Preocupação excessiva'],
     ARRAY['Boa participação', 'Receptivo às técnicas', 'Demonstrou insight'],
     ARRAY['Resistência inicial', 'Dificuldade para relaxar']
    );