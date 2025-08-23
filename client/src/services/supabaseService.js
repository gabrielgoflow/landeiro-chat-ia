import { supabase } from "@/lib/supabase.js";

export class SupabaseService {
  // Incrementar sessão de um chat existente (para "Iniciar Próxima Sessão")
  static async incrementChatSession(chatId) {
    try {
      // Buscar o último registro desse chat_id
      const { data: lastSession, error: selectError } = await supabase
        .from("chat_threads")
        .select("*")
        .eq("chat_id", chatId)
        .order("sessao", { ascending: false })
        .limit(1)
        .single();

      if (selectError) throw selectError;

      const nextSession = (lastSession?.sessao || 0) + 1;

      // Inserir novo registro com mesmo chat_id, mas sessao incrementada
      const { data: newThread, error: insertError } = await supabase
        .from("chat_threads")
        .insert({
          chat_id: chatId,
          thread_id: lastSession.thread_id,
          diagnostico: lastSession.diagnostico,
          protocolo: lastSession.protocolo,
          sessao: nextSession,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      return { data: newThread, error: null, newSession: nextSession };
    } catch (error) {
      console.error("Error incrementing chat session:", error);
      return { data: null, error: error.message, newSession: null };
    }
  }

  // Criar próxima sessão (novo chat_id com mesmo thread_id)
  static async createNextSession(threadId, diagnostico, protocolo) {
    try {
      // Primeiro, buscar a última sessão deste thread
      const { data: lastSession, error: lastSessionError } = await supabase
        .from("chat_threads")
        .select("sessao")
        .eq("thread_id", threadId)
        .order("sessao", { ascending: false })
        .limit(1)
        .single();

      if (lastSessionError && lastSessionError.code !== "PGRST116") {
        throw lastSessionError;
      }

      const newSessionNumber = (lastSession?.sessao || 0) + 1;
      const newChatId = `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Criar novo chat_thread
      const { data: newThread, error: threadError } = await supabase
        .from("chat_threads")
        .insert({
          chat_id: newChatId,
          thread_id: threadId,
          diagnostico,
          protocolo,
          sessao: newSessionNumber,
        })
        .select()
        .single();

      if (threadError) throw threadError;

      // Criar relação user_chat usando usuário padrão
      const userId = await SupabaseService.getCurrentUserId();
      if (userId) {
        const { error: userChatError } = await supabase
          .from("user_chats")
          .insert({
            user_id: userId,
            chat_id: newChatId,
            chat_threads_id: newThread.id,
          });

        if (userChatError)
          console.warn(
            "Warning: Could not create user_chat relation:",
            userChatError,
          );
      }

      return {
        data: newThread,
        error: null,
        newChatId,
        newSession: newSessionNumber,
      };
    } catch (error) {
      console.error("Error creating next session:", error);
      return {
        data: null,
        error: error.message,
        newChatId: null,
        newSession: null,
      };
    }
  }

  // Criar relação entre chat interno e thread_id do OpenAI
  static async createChatThread(
    chatId,
    threadId,
    diagnostico,
    protocolo,
    sessao = 1,
  ) {
    try {
      const { data, error } = await supabase
        .from("chat_threads")
        .insert([
          {
            chat_id: chatId,
            thread_id: threadId,
            diagnostico,
            protocolo,
            sessao: sessao, // Sempre começa com sessão 1 para novos chats
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error("Error creating chat thread:", error);
      return { data: null, error: error.message };
    }
  }

  // Buscar thread_id do OpenAI por chat_id interno
  static async getThreadIdByChatId(chatId) {
    try {
      const { data, error } = await supabase
        .from("chat_threads")
        .select("thread_id, diagnostico, protocolo, sessao")
        .eq("chat_id", chatId)
        .single();

      if (error && error.code !== "PGRST116") throw error; // PGRST116 = not found
      return { data, error: null };
    } catch (error) {
      console.error("Error getting thread ID:", error);
      return { data: null, error: error.message };
    }
  }

  // Criar relação entre user_id e chat_id do OpenAI
  static async createUserChat(userId, openaiChatId, chatThreadsId = null) {
    try {
      const { data, error } = await supabase
        .from("user_chats")
        .insert([
          {
            user_id: userId,
            chat_id: openaiChatId,
            chat_threads_id: chatThreadsId,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error("Error creating user chat:", error);
      return { data: null, error: error.message };
    }
  }

  // Buscar chats do usuário agrupados por thread_id (apenas sessão mais recente)
  static async getUserChats(userId) {
    try {
      const { data, error } = await supabase
        .from("user_chats")
        .select(
          `
          *,
          chat_threads (
            chat_id,
            thread_id,
            diagnostico,
            protocolo,
            sessao,
            created_at,
            updated_at
          )
        `,
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Transform and group by thread_id, keeping only the latest session per thread
      const transformedData =
        data?.map((userChat) => ({
          ...userChat,
          chat_id: userChat.chat_threads?.chat_id || userChat.chat_id,
          thread_id: userChat.chat_threads?.thread_id,
          diagnostico: userChat.chat_threads?.diagnostico,
          protocolo: userChat.chat_threads?.protocolo,
          sessao: userChat.chat_threads?.sessao,
          created_at: userChat.chat_threads?.created_at || userChat.created_at,
        })) || [];

      // Group by thread_id and keep only the latest session for each thread
      const threadGroups = {};
      transformedData.forEach((chat) => {
        const threadId = chat.thread_id;
        if (!threadId) {
          // If no thread_id, treat as individual chat
          threadGroups[chat.chat_id] = chat;
        } else {
          // If thread_id exists, keep only the latest session
          if (
            !threadGroups[threadId] ||
            chat.sessao > threadGroups[threadId].sessao
          ) {
            threadGroups[threadId] = chat;
          }
        }
      });

      // Convert back to array and sort by created_at
      return Object.values(threadGroups).sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at),
      );
    } catch (error) {
      console.error("Error getting user chats:", error);
      return [];
    }
  }

  // Atualizar thread_id de um chat existente
  static async updateChatThread(chatId, threadId) {
    try {
      const { data, error } = await supabase
        .from("chat_threads")
        .update({ thread_id: threadId })
        .eq("chat_id", chatId)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error("Error updating chat thread:", error);
      return { data: null, error: error.message };
    }
  }

  // Deletar chat thread
  static async deleteChatThread(chatId) {
    try {
      const { error } = await supabase
        .from("chat_threads")
        .delete()
        .eq("chat_id", chatId);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error("Error deleting chat thread:", error);
      return { error: error.message };
    }
  }

  // Deletar chat do usuário (e dados relacionados)
  static async deleteUserChat(userId, chatId) {
    try {
      // First delete the review if it exists
      await supabase.from("chat_reviews").delete().eq("chat_id", chatId);

      // Delete the user chat relationship
      const { error: userChatError } = await supabase
        .from("user_chats")
        .delete()
        .eq("user_id", userId)
        .eq("chat_id", chatId);

      if (userChatError) throw userChatError;

      // Delete the chat thread (CASCADE will handle related data)
      const { error: chatThreadError } = await supabase
        .from("chat_threads")
        .delete()
        .eq("chat_id", chatId);

      if (chatThreadError) throw chatThreadError;

      return { error: null };
    } catch (error) {
      console.error("Error deleting user chat:", error);
      throw error;
    }
  }

  // Buscar chat_id do OpenAI por user_id
  static async getOpenAIChatByUser(userId) {
    try {
      const { data, error } = await supabase
        .from("user_chats")
        .select("chat_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return { data, error: null };
    } catch (error) {
      console.error("Error getting OpenAI chat:", error);
      return { data: null, error: error.message };
    }
  }

  // Obter ID do usuário atual (usando usuário padrão)
  static async getCurrentUserId() {
    try {
      // Por simplicidade, usar o primeiro usuário encontrado ou um padrão
      const { data, error } = await supabase
        .from("user_chats")
        .select("user_id")
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116") {
        // Se não houver usuários, retornar um UUID padrão
        return "2e8960cd-5745-4d81-8971-eecd7fc46510";
      }

      return data?.user_id || "2e8960cd-5745-4d81-8971-eecd7fc46510";
    } catch (error) {
      console.warn("Using default user ID:", error);
      return "2e8960cd-5745-4d81-8971-eecd7fc46510";
    }
  }

  // Verificar se tabelas existem (para debug)
  static async checkTablesExist() {
    try {
      const { data: chatThreads, error: error1 } = await supabase
        .from("chat_threads")
        .select("count", { count: "exact" })
        .limit(1);

      const { data: userChats, error: error2 } = await supabase
        .from("user_chats")
        .select("count", { count: "exact" })
        .limit(1);

      return {
        chatThreadsExists: !error1,
        userChatsExists: !error2,
        errors: { chatThreads: error1, userChats: error2 },
      };
    } catch (error) {
      console.error("Error checking tables:", error);
      return {
        chatThreadsExists: false,
        userChatsExists: false,
        errors: { general: error.message },
      };
    }
  }
}

export { SupabaseService as supabaseService };
export default SupabaseService;
