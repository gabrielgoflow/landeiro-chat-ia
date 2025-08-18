# Seed Data - Criação de Usuário de Teste

Este diretório contém scripts para criar dados de teste para o sistema Landeiro Atendimento IA.

## Opções para Criar Usuário de Teste

### Opção 1: Via Interface do Supabase (Mais Simples)

1. **Acesse o Dashboard do Supabase**
   - Vá para [dashboard do Supabase](https://supabase.com/dashboard)
   - Selecione seu projeto

2. **Criar Usuário na Interface**
   - Vá para "Authentication" > "Users"
   - Clique em "Add user"
   - Preencha:
     - Email: `terapeuta@teste.com`
     - Password: `senha123`
     - Confirme o email automaticamente

3. **Copiar o ID do Usuário**
   - Depois de criar, copie o UUID do usuário (ex: `550e8400-e29b-41d4-a716-446655440000`)

4. **Executar Script SQL**
   - Vá para "SQL Editor" no Supabase
   - Abra o arquivo `seed.sql`
   - Substitua `YOUR_USER_ID` pelo UUID copiado
   - Execute o script

### Opção 2: Via Script JavaScript (Mais Automático)

1. **Configurar Credenciais**
   - Abra `create-test-user.js`
   - Substitua:
     - `SUA_URL_DO_SUPABASE` pela URL do seu projeto
     - `SUA_SERVICE_KEY_DO_SUPABASE` pela service key (encontrada em Settings > API)

2. **Executar Script**
   ```bash
   node sql/create-test-user.js
   ```

### Opção 3: Via SQL Direto (Manual)

Se preferir executar SQL manualmente:

```sql
-- 1. Primeiro criar usuário via Supabase Auth UI
-- 2. Depois executar este SQL substituindo YOUR_USER_ID

-- Inserir chat threads
INSERT INTO chat_threads (id, chat_id, thread_id, diagnostico, protocolo) VALUES
    ('550e8400-e29b-41d4-a716-446655440001', 'chat_001', 'thread_openai_001', 'ansiedade', 'tcc'),
    ('550e8400-e29b-41d4-a716-446655440002', 'chat_002', 'thread_openai_002', 'depressao', 'dbt');

-- Inserir user chats (substitua YOUR_USER_ID)
INSERT INTO user_chats (user_id, chat_id, chat_threads_id) VALUES
    ('YOUR_USER_ID', 'chat_001', '550e8400-e29b-41d4-a716-446655440001'),
    ('YOUR_USER_ID', 'chat_002', '550e8400-e29b-41d4-a716-446655440002');
```

## Dados de Teste Criados

Após executar qualquer uma das opções, você terá:

### Usuário de Teste
- **Email**: `terapeuta@teste.com`
- **Senha**: `senha123`

### Chats de Teste
1. **Chat 001** - Ansiedade/TCC (com review - aparecerá como FINALIZADO)
2. **Chat 002** - Depressão/DBT (sem review - aparecerá como EM ANDAMENTO)
3. **Chat 003** - Estresse/Mindfulness (sem review - aparecerá como EM ANDAMENTO)

### Sistema de Review
- O `chat_001` terá um review associado, então aparecerá como "FINALIZADO" na interface
- Os outros chats aparecerão como "EM ANDAMENTO"

## Login no Sistema

Após criar os dados, você pode fazer login no sistema com:
- **Email**: `terapeuta@teste.com`
- **Senha**: `senha123`

## Estrutura dos Dados

O seed cria dados que seguem a estrutura do sistema:
- **chat_threads**: Relaciona chat interno com thread do OpenAI
- **user_chats**: Relaciona usuário com chats
- **chat_reviews**: Sistema de supervisão (opcional para teste)

## Troubleshooting

Se encontrar problemas:

1. **Erro de permissão**: Certifique-se de usar a service key do Supabase
2. **Usuário já existe**: Mude o email no script
3. **Erro de RLS**: Verifique se as políticas RLS estão ativas no banco
4. **IDs duplicados**: Os UUIDs no script são únicos, mas se já existirem, mude-os

## Limpeza

Para remover os dados de teste:

```sql
-- Remover na ordem correta (por causa das foreign keys)
DELETE FROM chat_reviews WHERE chat_id IN ('chat_001', 'chat_002', 'chat_003');
DELETE FROM user_chats WHERE chat_id IN ('chat_001', 'chat_002', 'chat_003');
DELETE FROM chat_threads WHERE chat_id IN ('chat_001', 'chat_002', 'chat_003');
-- Remover usuário via interface do Supabase Auth
```