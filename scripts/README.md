# Scripts de Importação

## Criar Usuários Admin

Script para criar os dois usuários administradores do sistema.

### Usuários Admin

- **admin@goflow.digital** - Senha: `!@#GOflow2700`
- **admin@nexialab.com.br** - Senha: `rBeupVpv4iju@E6`
- **admin@fernandalandeiro.com.br** - Senha: `#IUgdk!@%623g`

### Uso

#### Criar/atualizar admins
```bash
npm run create:admins
```

#### Atualizar senhas de admins existentes
```bash
npm run create:admins:update-password
```

### Funcionalidades

- Cria usuários no Supabase Auth
- Define role "admin" na tabela `user_metadata`
- Se o usuário já existe, atualiza a metadata (não cria duplicado)
- Com `--update-password`, atualiza também as senhas de usuários existentes

### Quando Usar

- Primeira configuração do sistema
- Quando precisa recriar os admins
- Quando precisa atualizar as senhas dos admins

---

## Deletar Todos os Usuários

⚠️ **ATENÇÃO**: Este script deleta TODOS os usuários do Supabase Auth e limpa a tabela `user_metadata`.

### Uso

#### Deletar todos os usuários
```bash
npm run delete:users
```

#### Modo dry-run (simulação, não deleta)
```bash
npm run delete:users:dry-run
```

#### Pular limpeza da tabela user_metadata
```bash
npm run delete:users -- --skip-metadata
```

### Quando usar

Use este script quando:
- Precisa recriar todos os usuários com senhas no formato correto
- Quer limpar o banco antes de uma nova importação
- Precisa resetar todos os usuários

### Processo recomendado

1. **Testar primeiro (dry-run)**:
   ```bash
   npm run delete:users:dry-run
   ```

2. **Deletar todos os usuários**:
   ```bash
   npm run delete:users
   ```

3. **Recriar todos do CSV**:
   ```bash
   npm run import:users
   ```

---

## Importação de Usuários do CSV

Script para importar usuários do arquivo CSV para o Supabase Auth e tabela `user_metadata`.

### Pré-requisitos

1. Instalar dependências:
```bash
npm install
```

2. Configurar variáveis de ambiente no arquivo `.env`:
```
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
```

### Uso

#### Importação normal
```bash
npm run import:users
```

#### Modo dry-run (simulação, não cria usuários)
```bash
npm run import:users:dry-run
```

#### Pular usuários que já existem
```bash
npm run import:users:skip-existing
```

#### Atualizar senhas de usuários existentes
```bash
npm run import:users:update-passwords
```

#### Combinar opções
```bash
npm run import:users -- --dry-run --skip-existing
npm run import:users -- --update-passwords
```

#### Especificar arquivo CSV customizado
```bash
npm run import:users -- "caminho/para/arquivo.csv"
```

### Formato do CSV

O arquivo CSV deve ter as seguintes colunas:
- **Nome**: Nome completo do usuário
- **E-mail**: Email do usuário (obrigatório)
- **CPF**: CPF do usuário (usado para gerar senha)
- **Curso/Origem do Acesso**: Informação adicional (opcional)
- **Período de Acesso**: Informação adicional (opcional)

### Geração de Senha

A senha é gerada automaticamente usando:
- Os 5 primeiros dígitos numéricos do CPF
- Sufixo fixo: `!@%UZJ`

Exemplo: CPF `54427365000126` → Senha `54427!@%UZJ`

### Atualização de Senhas

Se você já criou usuários e precisa atualizar as senhas (por exemplo, após corrigir o formato da senha), use a flag `--update-passwords`:

```bash
npm run import:users:update-passwords
```

Isso irá:
- Buscar cada usuário pelo email
- Atualizar a senha com o novo formato (sem espaços)
- Não criar novos usuários, apenas atualizar os existentes

### Relatório

O script gera um relatório final com:
- Total de usuários processados
- Número de sucessos
- Número de falhas
- Lista de erros (se houver)
- Usuários ignorados (se usar `--skip-existing`)

### Processamento

O script processa usuários em lotes de 10 para não sobrecarregar a API do Supabase. Há um delay de 500ms entre lotes.

---

## Exportação de Email e Senhas

Script para exportar email e senhas de todos os usuários do CSV para um novo arquivo CSV.

### Uso

#### Exportar todos os usuários
```bash
npm run export:users-passwords
```

#### Exportar apenas usuários que já existem no Supabase
```bash
npm run export:users-passwords:existing
```

#### Exportar apenas usuários que NÃO existem no Supabase
```bash
npm run export:users-passwords:new
```

#### Especificar arquivo de saída customizado
```bash
npm run export:users-passwords -- "caminho/para/saida.csv"
```

### Formato do CSV de Saída

O arquivo gerado terá as seguintes colunas:
- **Email**: Email do usuário
- **Senha**: Senha gerada a partir do CPF (formato: `54427!@%UZJ`)
- **Nome**: Nome completo do usuário

Exemplo:
```csv
Email,Senha,Nome
psiluannagomes@gmail.com,54427!@%UZJ,Luanna Santana Gomes
rosenymota@gmail.com,44327!@%UZJ,Roseni Mota
```

### Nome do Arquivo

Por padrão, o arquivo é salvo como `usuarios-email-senhas-YYYY-MM-DD.csv` na raiz do projeto.

### Quando Usar

- **Exportar todos**: Para gerar lista completa de credenciais
- **Apenas existentes**: Para exportar credenciais de usuários já criados no sistema
- **Apenas novos**: Para exportar credenciais de usuários que ainda não foram criados

### Processamento

O script processa todas as linhas do CSV sequencialmente, gerando as senhas a partir do CPF usando a mesma lógica do script de importação.

---

## Atualização de Data Final de Acesso

Script para atualizar a coluna `data_final_acesso` na tabela `user_metadata` baseado no período de acesso informado no CSV.

### Uso

#### Atualizar datas de acesso
```bash
npm run update:access-dates
```

#### Modo dry-run (simulação, não atualiza)
```bash
npm run update:access-dates:dry-run
```

#### Especificar arquivo CSV customizado
```bash
npm run update:access-dates -- "caminho/para/arquivo.csv"
```

### Formato do CSV

O arquivo CSV deve ter as seguintes colunas:
- **E-mail**: Email do usuário (obrigatório)
- **Período de Acesso**: Período de acesso (obrigatório)

### Mapeamento de Períodos

O script mapeia os seguintes períodos para dias:
- `'1 ano de acesso'` → +365 dias
- `'6 meses'` → +184 dias
- `'3 meses'` → +92 dias (aproximado)
- `'2 anos'` → +730 dias

### Funcionalidades

- Busca usuários no Supabase Auth por email
- Calcula data final baseado no período informado
- Atualiza ou cria registro na tabela `user_metadata`
- Processa em lotes para melhor performance
- Relatório detalhado com estatísticas

### Quando Usar

- Quando precisa atualizar as datas de acesso de múltiplos usuários
- Após importar novos usuários do CSV
- Para sincronizar datas de acesso com dados externos

### Processamento

O script:
1. Carrega todos os usuários do Supabase Auth em memória (mapa email → userId)
2. Processa o CSV linha por linha
3. Para cada linha:
   - Busca usuário por email
   - Calcula data final baseado no período
   - Atualiza `data_final_acesso` na tabela `user_metadata`
4. Gera relatório final com estatísticas

