import { supabase } from '@/lib/supabase.js'

export class ChatMessageService {
  
  // Salvar mensagem no histórico estruturado
  static async saveMessage({
    chatId,
    threadId,
    sessao,
    messageId,
    sender,
    content,
    messageType = 'text',
    audioUrl = null,
    metadata = {}
  }) {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert([
          {
            chat_id: chatId,
            thread_id: threadId,
            sessao: sessao,
            message_id: messageId,
            sender,
            content,
            message_type: messageType,
            audio_url: audioUrl,
            metadata
          }
        ])
        .select()
        .single()

      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Error saving message:', error)
      return { data: null, error: error.message }
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

  // Deletar mensagens de um chat
  static async deleteChatMessages(chatId) {
    try {
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('chat_id', chatId)

      if (error) throw error
      return { error: null }
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