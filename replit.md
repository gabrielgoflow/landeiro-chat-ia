# Overview

A comprehensive therapy chat application built with React (frontend) and Express.js (backend) that provides an AI-powered conversational interface with advanced session management. The application features a modern UI with tabbed session interface, real-time messaging, audio recording and playback, and comprehensive review/supervision system. Each therapy session maintains independent chat history and reviews, designed specifically for TCC (Cognitive Behavioral Therapy) protocol with external AI services integration.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

The client-side is built with **React 18** using TypeScript and follows a component-based architecture:

- **Routing**: Uses Wouter for lightweight client-side routing
- **State Management**: Combines React hooks with TanStack Query for server state management
- **UI Framework**: shadcn/ui components built on Radix UI primitives with Tailwind CSS styling
- **Chat Management**: Custom `useChat` hook manages chat threads, messages, and localStorage persistence
- **Responsive Design**: Mobile-first approach with dedicated mobile/desktop layouts using custom `useIsMobile` hook

## Backend Architecture

The server uses **Express.js** with TypeScript in a minimal REST API structure:

- **Server Framework**: Express.js with middleware for JSON parsing, CORS, and request logging
- **Route Organization**: Centralized route registration pattern with placeholder for API endpoints
- **Storage Interface**: Abstract storage interface (`IStorage`) with in-memory implementation for development
- **Development Setup**: Vite integration for hot module replacement and asset serving

## Data Storage Solutions

**Development Storage**: In-memory storage using Map data structures for users and chat data

**Enhanced Database Architecture (Opção 1 + Melhorias)**:
- **Authentication**: Supabase Auth for user management and security

**Core Tables**:
- **chat_threads**: Controle de sessões e metadata
  - chat_id (VARCHAR): ID único do chat interno
  - thread_id (VARCHAR): ID do thread do OpenAI Assistant  
  - diagnostico (VARCHAR): Diagnóstico selecionado (ex: ansiedade)
  - protocolo (VARCHAR): Sempre "tcc" (TCC é o protocolo padrão fixo)
  - sessao (SMALLINT): Número da sessão de terapia (auto-incrementado por usuário)
- **user_chats**: Relaciona user_id com chat_id do OpenAI
  - user_id (UUID): Referência ao usuário autenticado
  - chat_id (VARCHAR): ID do chat do OpenAI
  - chat_threads_id (UUID): Referência à tabela chat_threads

**Session Management Implementation (Implemented August 2025)**:
- **SessionTabs Component**: Tabbed interface showing all sessions for a thread with status indicators
- **Session Navigation**: Independent chat histories per session while maintaining same thread_id
- **Status Management**: Sessions automatically marked as "finalizado" when reviews exist, "em_andamento" otherwise
- **Session Creation**: "Iniciar Próxima Sessão" button creates new sessions with unique chat_ids
- **Session Stability (Fixed August 2025)**: Removed automatic polling that caused unwanted session switching - sessions now only load on navigation
- **API Endpoints**: 
  - `/api/thread-sessions/:threadId` - Retrieves all sessions for a thread
  - Enhanced session management in SupabaseService with `createNextSession()` method

**Independent Message System (Fixed August 2025)**:
- **Per-Session Messages**: Each session now loads only its own messages from `chat_messages` table
- **Database Storage**: Messages saved to `chat_messages` table instead of shared OpenAI Assistant history
- **ChatService Integration**: Modified `getMessageHistory()` to use `/api/chat-messages/:chatId` endpoint
- **Message Persistence**: Both user and AI messages automatically saved to database during conversations
- **Session Isolation**: Sessions no longer share message history, ensuring true session independence

**Enhanced Session Message Filtering (Implemented August 2025)**:
- **Added `sessao` Column**: chat_messages table now includes `sessao` INTEGER field for precise session filtering
- **Session-Based Queries**: New `/api/session-messages/:threadId/:sessao` endpoint for thread+session filtering
- **Enhanced ChatService**: Added `getSessionMessages()` method for retrieving messages by thread_id and session number
- **Database Migration Applied**: Existing messages updated with corresponding session numbers
- **Eliminated External History Dependency**: System now uses only `chat_messages` table, no longer relies on external webhook for history retrieval
- **Session Isolation Completed**: Messages properly filtered by session number ensuring complete independence between sessions

**Audio Message Bug Fix (August 2025)**:
- **Fixed Audio Message Storage**: Corrected audio message saving to store complete JSON data with base64 in the `content` field instead of just "Mensagem de áudio"
- **Webhook Response Integration**: Updated code to use correct `base64` field from AI webhook response instead of `audioBase64`  
- **Audio Message Recovery**: Fixed audio message loading from database by properly parsing JSON content with audioBase64 data
- **Session Independence**: Audio messages now properly isolated per session with complete playback functionality
- **System Validation**: Confirmed new audio messages are saved correctly with full base64 data and can be retrieved from database

**Session Management Bug Fix (August 2025)**:
- **Fixed Session Creation Logic**: Corrected `createNextSession()` to maintain same `chat_id` across sessions instead of creating new ones
- **Proper Session Isolation**: Sessions now differentiated only by `sessao` column, maintaining proper thread continuity
- **Message Preservation**: Implemented complete preservation of local message history during navigation between sessions
- **Asynchronous Message Display**: Fixed bug where newly sent messages required page refresh to appear in chat interface

**Immediate UI Updates Implementation (August 2025)**:
- **Instant Session Badges**: ChatSidebar now shows "SESSÃO 1" badge immediately when new chat is created, with fallback logic for all edge cases
- **Always-Visible Session Tabs**: SessionTabs component always displays at least one session tab, even for new chats without database entries
- **Removed Loading Dependencies**: Eliminated loading states that blocked UI rendering, ensuring immediate visual feedback
- **Review-Based Input Disable**: MessageInput automatically becomes read-only when chat has review in chat_reviews table, showing "Atendimento finalizado" overlay
- **Session Column in Reviews**: Reviews now include `sessao` column to track which session number the review corresponds to
- **Page Refresh on New Session**: "Iniciar Próxima Sessão" button now refreshes the page after creating new session to ensure clean state

**Separated Concerns Tables**:
- **chat_messages**: Histórico estruturado de mensagens (NOVA)
  - chat_id (VARCHAR): Referência ao chat
  - thread_id (VARCHAR): Referência ao thread
  - message_id (VARCHAR): ID único da mensagem
  - sender (VARCHAR): 'user' ou 'assistant'
  - content (TEXT): Conteúdo da mensagem
  - message_type (VARCHAR): 'text' ou 'audio'
  - audio_url (VARCHAR): URL do áudio (se aplicável)
  - metadata (JSONB): Metadados da mensagem
- **chat_reviews**: Reviews de supervisão (separados do histórico)
  - chat_id (VARCHAR): Referência ao chat
  - resumo_atendimento (TEXT): Resumo da sessão
  - feedback_direto (TEXT): Feedback direto para o terapeuta
  - sinais_paciente (ARRAY): Sinais observados no paciente
  - pontos_positivos (ARRAY): Aspectos positivos da sessão
  - pontos_negativos (ARRAY): Aspectos a melhorar
  - sessao (SMALLINT): Número da sessão correspondente

**Optimized Views**:
- **v_chat_overview**: Overview completo de chats com status e estatísticas
- **v_user_sessions**: Histórico de sessões por usuário

**Performance Indexes**: Índices otimizados para chat_id, thread_id, created_at, sender

**Benefits**: Separação clara review vs histórico, queries otimizadas, escalabilidade melhorada, manutenção simplificada

**Database Schema** (configured but not actively used):
- **PostgreSQL** with Drizzle ORM for type-safe database operations
- **Users table**: Basic authentication structure with username/password
- **Chat threads**: Email-based thread management with timestamps
- **Messages**: Thread-based message storage with sender identification

**Client-side Persistence**: localStorage for chat history, thread management, and user preferences

## Authentication and Authorization

Currently implements a **basic user structure** with:
- User entity with username/password fields
- Storage interface methods for user creation and retrieval
- No active authentication middleware (prepared for future implementation)

## External Service Integrations

**AI Service Integration**:
- Dual endpoint system: `/api/landeiro-chat-ia` proxy to external webhook
- External webhook: `https://hook.us2.make.com/o4kzajwfvqy7zpcgk54gxpkfj77nklbz`
- Support for both audio (base64) and text responses from AI
- Audio message support: sent as JSON strings to webhook, received as base64
- Automatic audio/text detection and rendering in chat interface
- Session data integration: diagnostico and protocolo fields
- Hardcoded user email for service identification
- Enhanced error handling with detailed logging

**Object Storage Integration**:
- Replit Object Storage for audio file management
- Private object directory for user-uploaded audio files
- Presigned URL upload system for secure file handling
- ACL policies for access control on audio messages

**Development Tools**:
- **Neon Database** integration for PostgreSQL hosting
- **Replit** development environment with cartographer plugin
- **Drizzle Kit** for database migrations and schema management

The architecture separates concerns clearly with the frontend handling user interactions and chat UI, while the backend provides a thin API layer. The modular design allows for easy scaling and integration of additional services as needed.