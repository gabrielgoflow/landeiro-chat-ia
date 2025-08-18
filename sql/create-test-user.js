// Script para criar usuário de teste via Supabase
// Execute este script com: node sql/create-test-user.js

import { createClient } from '@supabase/supabase-js';

// Configure suas credenciais do Supabase aqui
const supabaseUrl = 'SUA_URL_DO_SUPABASE';
const supabaseServiceKey = 'SUA_SERVICE_KEY_DO_SUPABASE'; // Use a service key para criar usuários

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTestUser() {
  try {
    // Criar usuário via Admin API
    const { data: user, error } = await supabase.auth.admin.createUser({
      email: 'terapeuta@teste.com',
      password: 'senha123',
      email_confirm: true
    });

    if (error) {
      console.error('Erro ao criar usuário:', error.message);
      return;
    }

    console.log('✅ Usuário criado com sucesso!');
    console.log('ID do usuário:', user.user.id);
    console.log('Email:', user.user.email);
    
    // Agora vamos criar os dados de teste associados a este usuário
    await createTestData(user.user.id);
    
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

async function createTestData(userId) {
  try {
    // Inserir chat_threads
    const { data: chatThreads, error: threadsError } = await supabase
      .from('chat_threads')
      .insert([
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          chat_id: 'chat_001',
          thread_id: 'thread_openai_001',
          diagnostico: 'ansiedade',
          protocolo: 'tcc'
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
          chat_id: 'chat_002',
          thread_id: 'thread_openai_002',
          diagnostico: 'depressao',
          protocolo: 'dbt'
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440003',
          chat_id: 'chat_003',
          thread_id: 'thread_openai_003',
          diagnostico: 'estresse',
          protocolo: 'mindfulness'
        }
      ])
      .select();

    if (threadsError) {
      console.error('Erro ao criar chat_threads:', threadsError.message);
      return;
    }

    // Inserir user_chats
    const { data: userChats, error: userChatsError } = await supabase
      .from('user_chats')
      .insert([
        {
          user_id: userId,
          chat_id: 'chat_001',
          chat_threads_id: '550e8400-e29b-41d4-a716-446655440001'
        },
        {
          user_id: userId,
          chat_id: 'chat_002',
          chat_threads_id: '550e8400-e29b-41d4-a716-446655440002'
        },
        {
          user_id: userId,
          chat_id: 'chat_003',
          chat_threads_id: '550e8400-e29b-41d4-a716-446655440003'
        }
      ])
      .select();

    if (userChatsError) {
      console.error('Erro ao criar user_chats:', userChatsError.message);
      return;
    }

    // Criar um review para testar o sistema de supervisão
    const { data: review, error: reviewError } = await supabase
      .from('chat_reviews')
      .insert([
        {
          chat_id: 'chat_001',
          resumo_atendimento: 'Paciente apresentou sintomas de ansiedade durante a sessão. Demonstrou boa receptividade às técnicas de TCC apresentadas.',
          feedback_direto: 'Continue focando nas técnicas de respiração e reestruturação cognitiva. Paciente está progredindo bem.',
          sinais_paciente: ['Tensão muscular', 'Respiração acelerada', 'Preocupação excessiva'],
          pontos_positivos: ['Boa participação', 'Receptivo às técnicas', 'Demonstrou insight'],
          pontos_negativos: ['Resistência inicial', 'Dificuldade para relaxar']
        }
      ])
      .select();

    if (reviewError) {
      console.error('Erro ao criar review:', reviewError.message);
      return;
    }

    console.log('✅ Dados de teste criados com sucesso!');
    console.log('- 3 chat threads criados');
    console.log('- 3 user chats associados');
    console.log('- 1 review criado (chat_001 aparecerá como FINALIZADO)');
    
  } catch (error) {
    console.error('Erro ao criar dados de teste:', error.message);
  }
}

// Executar o script
createTestUser();