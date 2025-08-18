-- Script de seed para criar dados de teste
-- Execute este script no Supabase SQL Editor ou através do psql

-- 1. Primeiro, você precisa criar um usuário através da interface do Supabase Auth
-- ou usando o SDK do Supabase para criar um usuário autenticado

-- 2. Depois de criar o usuário, pegue o UUID do usuário e substitua 'YOUR_USER_ID' abaixo
-- Você pode encontrar o ID do usuário na tabela auth.users no Supabase

-- Exemplo de dados de teste para chat_threads
INSERT INTO chat_threads (id, chat_id, thread_id, diagnostico, protocolo) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'chat_001', 'thread_openai_001', 'ansiedade', 'tcc'),
    ('550e8400-e29b-41d4-a716-446655440002', 'chat_002', 'thread_openai_002', 'depressao', 'dbt'),
    ('550e8400-e29b-41d4-a716-446655440003', 'chat_003', 'thread_openai_003', 'estresse', 'mindfulness');

-- Exemplo de dados de teste para user_chats
-- IMPORTANTE: Substitua 'YOUR_USER_ID' pelo UUID real do usuário criado no Supabase Auth
INSERT INTO user_chats (user_id, chat_id, chat_threads_id) VALUES
    ('YOUR_USER_ID', 'chat_001', '550e8400-e29b-41d4-a716-446655440001'),
    ('YOUR_USER_ID', 'chat_002', '550e8400-e29b-41d4-a716-446655440002'),
    ('YOUR_USER_ID', 'chat_003', '550e8400-e29b-41d4-a716-446655440003');

-- Exemplo de review para um dos chats (para teste do sistema de supervisão)
-- Esta inserção vai fazer com que o chat_001 apareça como "FINALIZADO" na interface
-- Descomente as linhas abaixo se quiser testar o sistema de review:

/*
INSERT INTO chat_reviews (chat_id, resumo_atendimento, feedback_direto, sinais_paciente, pontos_positivos, pontos_negativos) VALUES
    ('chat_001', 
     'Paciente apresentou sintomas de ansiedade durante a sessão. Demonstrou boa receptividade às técnicas de TCC apresentadas.',
     'Continue focando nas técnicas de respiração e reestruturação cognitiva. Paciente está progredindo bem.',
     ARRAY['Tensão muscular', 'Respiração acelerada', 'Preocupação excessiva'],
     ARRAY['Boa participação', 'Receptivo às técnicas', 'Demonstrou insight'],
     ARRAY['Resistência inicial', 'Dificuldade para relaxar']
    );
*/