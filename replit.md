# Overview

A chat application built with React (frontend) and Express.js (backend) that provides an AI-powered conversational interface with audio messaging capabilities. The application features a modern UI with chat threads, real-time messaging, audio recording and playback, and persistent chat history stored in localStorage. It's designed to work with external AI services via webhooks while providing a clean, responsive user experience using shadcn/ui components and Tailwind CSS styling.

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

**Supabase Database Schema**:
- **Authentication**: Supabase Auth for user management and security
- **chat_threads**: Relaciona chat interno com thread_id do OpenAI Assistant
  - chat_id (VARCHAR): ID único do chat interno
  - thread_id (VARCHAR): ID do thread do OpenAI Assistant  
  - diagnostico (VARCHAR): Diagnóstico selecionado (ex: ansiedade)
  - protocolo (VARCHAR): Sempre "tcc" (TCC é o protocolo padrão fixo)
  - sessao (SMALLINT): Número da sessão de terapia (auto-incrementado por usuário)
- **user_chats**: Relaciona user_id com chat_id do OpenAI
  - user_id (UUID): Referência ao usuário autenticado
  - chat_id (VARCHAR): ID do chat do OpenAI
  - chat_threads_id (UUID): Referência à tabela chat_threads
- **chat_reviews**: Supervisão e revisão das sessões de terapia
  - id (VARCHAR): ID único do review
  - chat_id (VARCHAR): Referência ao chat
  - resumo_atendimento (TEXT): Resumo da sessão
  - feedback_direto (TEXT): Feedback direto para o terapeuta
  - sinais_paciente (ARRAY): Sinais observados no paciente
  - pontos_positivos (ARRAY): Aspectos positivos da sessão
  - pontos_negativos (ARRAY): Aspectos a melhorar
  - sessao (SMALLINT): Número da sessão correspondente
  - created_at (TIMESTAMP): Data de criação do review
- **Row Level Security (RLS)**: Implementado para garantir isolamento de dados por usuário

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