import { supabase } from '@/lib/supabase.js'
import { SupabaseService } from '@/services/supabaseService.js'

export class ChatMessageService {
  
  // Função auxiliar para registrar falhas em audit_logs
  static async logFailure(action, details) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        if (token) {
          await fetch("/api/audit-logs", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({
              action: action,
              details: {
                ...details,
                timestamp: new Date().toISOString(),
                type: "failure",
              },
            }),
          });
        }
      }
    } catch (auditError) {
      console.warn('[logFailure] Erro ao registrar falha em audit_logs:', auditError);
    }
  }

  // Salvar mensagem no histórico estruturado
  // Parâmetros opcionais diagnostico e protocolo permitem verificar/criar chat_thread automaticamente
  static async saveMessage({
    chatId,
    threadId,
    sessao,
    messageId,
    sender,
    content,
    messageType = 'text',
    audioUrl = null,
    metadata = {},
    // Parâmetros opcionais para garantir que chat_thread existe (previne chats órfãos)
    diagnostico = null,
    protocolo = null
  }) {
    try {
      // Validar campos obrigatórios
      if (!chatId) {
        throw new Error('chatId é obrigatório');
      }
      if (!sessao || sessao === undefined || sessao === null) {
        throw new Error('sessao é obrigatório');
      }
      if (!messageId) {
        throw new Error('messageId é obrigatório');
      }
      if (!sender) {
        throw new Error('sender é obrigatório');
      }
      if (!content) {
        throw new Error('content é obrigatório');
      }

      // Se diagnostico e protocolo foram fornecidos, garantir que chat_thread existe
      // Isso previne o problema de "chats órfãos" onde mensagens são salvas mas chat_thread não existe
      if (diagnostico && protocolo) {
        const { data: threadData, error: threadError, created } = 
          await SupabaseService.ensureChatThreadExists(chatId, diagnostico, protocolo, sessao);
        
        if (threadError) {
          console.warn('[saveMessage] Não foi possível garantir existência de chat_thread:', threadError);
          // Continua salvando a mensagem mesmo se falhar (melhor ter mensagem sem thread que não ter nada)
        } else if (created) {
          console.log('[saveMessage] chat_thread foi criado automaticamente para prevenir chat órfão');
        }
      }

      console.log('Salvando mensagem:', {
        chatId,
        threadId,
        sessao,
        messageId,
        sender,
        messageType,
        contentLength: content?.length || 0
      });

      const { data, error } = await supabase
        .from('chat_messages')
        .insert([
          {
            chat_id: chatId,
            thread_id: threadId || null,
            sessao: sessao,
            message_id: messageId,
            sender,
            content,
            message_type: messageType,
            audio_url: audioUrl || null,
            metadata: metadata || {}
          }
        ])
        .select()
        .single()

      if (error) {
        console.error('Erro do Supabase ao salvar mensagem:', {
          error,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      console.log('Mensagem salva com sucesso:', data?.id);
      return { data, error: null }
    } catch (error) {
      console.error('Error saving message:', {
        error,
        message: error.message,
        chatId,
        sessao,
        sender,
        messageType
      });

      // Registrar falha de salvamento em audit_logs
      await this.logFailure("save_message_failed", {
        chatId,
        sessao,
        sender,
        messageType,
        errorMessage: error.message,
        errorCode: error.code,
      });

      return { data: null, error: error.message || 'Erro desconhecido ao salvar mensagem' }
    }
  }

  // Buscar histórico de mensagens de um chat
  static async getChatMessages(chatId, limit = 100) {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true })
        .limit(limit)

      if (error) throw error
      return { data: data || [], error: null }
    } catch (error) {
      console.error('Error getting chat messages:', error)
      return { data: [], error: error.message }
    }
  }

  // Buscar mensagens de uma sessão específica por thread_id + sessao
  static async getSessionMessages(threadId, sessao, limit = 100) {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', threadId)
        .eq('sessao', sessao)
        .order('created_at', { ascending: true })
        .limit(limit)

      if (error) throw error
      return { data: data || [], error: null }
    } catch (error) {
      console.error('Error getting session messages:', error)
      return { data: [], error: error.message }
    }
  }

  // Buscar mensagens por thread_id (útil para visualizar todas as sessões)
  static async getThreadMessages(threadId, limit = 100) {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true })
        .limit(limit)

      if (error) throw error
      return { data: data || [], error: null }
    } catch (error) {
      console.error('Error getting thread messages:', error)
      return { data: [], error: error.message }
    }
  }

  // Deletar mensagens de um chat (com backup e audit log)
  static async deleteChatMessages(chatId, sessao = null) {
    try {
      // Contar mensagens antes de deletar
      let countQuery = supabase
        .from('chat_messages')
        .select('id', { count: 'exact' })
        .eq('chat_id', chatId);
      
      if (sessao !== null) {
        countQuery = countQuery.eq('sessao', sessao);
      }
      
      const { count: messageCount } = await countQuery;

      if (messageCount === 0) {
        return { error: null, count: 0 };
      }

      // Fazer backup das mensagens antes de deletar (via API do servidor)
      try {
        const token = (await supabase.auth.getSession()).data.session?.access_token;
        if (token) {
          await fetch("/api/admin/backup/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({ chatId, sessao }),
          });
        }
      } catch (backupError) {
        console.warn('[deleteChatMessages] Erro ao fazer backup (continuando com delete):', backupError);
      }

      // Deletar mensagens
      let deleteQuery = supabase
        .from('chat_messages')
        .delete()
        .eq('chat_id', chatId);
      
      if (sessao !== null) {
        deleteQuery = deleteQuery.eq('sessao', sessao);
      }

      const { error } = await deleteQuery;

      if (error) throw error;

      // Criar audit log
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const token = (await supabase.auth.getSession()).data.session?.access_token;
          if (token) {
            await fetch("/api/audit-logs", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`,
              },
              body: JSON.stringify({
                action: "delete_messages",
                details: {
                  chatId,
                  sessao,
                  messageCount,
                },
              }),
            });
          }
        }
      } catch (auditError) {
        console.warn('[deleteChatMessages] Erro ao criar audit log:', auditError);
      }

      console.log('[deleteChatMessages] Mensagens deletadas com backup:', { chatId, sessao, count: messageCount });
      return { error: null, count: messageCount }
    } catch (error) {
      console.error('Error deleting chat messages:', error)
      return { error: error.message }
    }
  }

  // Atualizar mensagem
  static async updateMessage(messageId, updateData) {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .update(updateData)
        .eq('message_id', messageId)
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Error updating message:', error)
      return { data: null, error: error.message }
    }
  }
}