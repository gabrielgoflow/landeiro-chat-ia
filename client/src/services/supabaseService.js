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

      const currentSession = lastSession?.sessao || 0;
      const nextSession = currentSession + 1;

      // Verificar se já atingiu o limite de 10 sessões
      if (currentSession >= 10) {
        return {
          data: null,
          error: "Limite de 10 sessões atingido para este diagnóstico",
          newSession: null,
        };
      }

      // Inserir novo registro com mesmo chat_id, mas sessao incrementada
      const now = new Date().toISOString();
      const { data: newThread, error: insertError } = await supabase
        .from("chat_threads")
        .insert({
          chat_id: chatId,
          thread_id: lastSession.thread_id,
          diagnostico: lastSession.diagnostico,
          protocolo: lastSession.protocolo,
          sessao: nextSession,
          session_started_at: now,
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
      const now = new Date().toISOString();
      const { data: newThread, error: threadError } = await supabase
        .from("chat_threads")
        .insert({
          chat_id: newChatId,
          thread_id: threadId,
          diagnostico,
          protocolo,
          sessao: newSessionNumber,
          session_started_at: now,
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

  // Iniciar timer da sessão (atualizar session_started_at se não existir)
  static async startSessionTimer(chatId, sessao = null) {
    try {
      // Verificar se há erro de autenticação antes de continuar
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error("No active session found");
        // Retornar timestamp atual como fallback, mas não tentar atualizar o banco
        return new Date().toISOString();
      }

      // Construir query baseada na sessão específica se fornecida
      let selectQuery = supabase
        .from("chat_threads")
        .select("session_started_at, sessao")
        .eq("chat_id", chatId);
      
      // Se temos o número da sessão, buscar essa sessão específica
      if (sessao !== null && sessao !== undefined) {
        selectQuery = selectQuery.eq("sessao", sessao);
      } else {
        // Se não temos sessão específica, buscar a mais recente
        selectQuery = selectQuery.order("sessao", { ascending: false });
      }
      
      const { data: existingList, error: selectError } = await selectQuery.limit(1);
      
      // Se for erro de autenticação ou conexão, não tentar novamente
      if (selectError) {
        if (selectError.code === "PGRST116") {
          // Não encontrado - isso é OK, vamos criar
        } else if (selectError.message?.includes("authentication") ||
                   selectError.message?.includes("JWT") ||
                   selectError.message?.includes("connection") ||
                   selectError.message?.includes("timeout")) {
          console.error("Erro de conexão ao buscar session timer:", selectError.message);
          // Retornar timestamp atual como fallback, mas não tentar atualizar
          return new Date().toISOString();
        } else {
          throw selectError;
        }
      }

      const existing = existingList && existingList.length > 0 ? existingList[0] : null;

      // Se já tem session_started_at, retornar
      if (existing?.session_started_at) {
        return existing.session_started_at;
      }

      // Se não tem, atualizar com timestamp atual
      const now = new Date().toISOString();
      
      // Determinar qual sessão atualizar
      let sessaoToUpdate = sessao;
      if (sessaoToUpdate === null || sessaoToUpdate === undefined) {
        // Se não temos sessão específica mas encontramos uma, usar a encontrada
        if (existing) {
          sessaoToUpdate = existing.sessao;
        } else {
          // Se não encontramos nenhuma, buscar a mais recente primeiro
          const { data: latestSession, error: latestError } = await supabase
            .from("chat_threads")
            .select("sessao")
            .eq("chat_id", chatId)
            .order("sessao", { ascending: false })
            .limit(1)
            .single();
          
          if (latestError) {
            if (latestError.message?.includes("authentication") ||
                latestError.message?.includes("JWT") ||
                latestError.message?.includes("connection") ||
                latestError.message?.includes("timeout")) {
              console.error("Erro de conexão ao buscar sessão mais recente:", latestError.message);
              return now; // Retornar timestamp atual sem atualizar o banco
            }
            throw new Error("Não foi possível encontrar sessão para atualizar");
          }
          
          if (!latestSession) {
            throw new Error("Não foi possível encontrar sessão para atualizar");
          }
          
          sessaoToUpdate = latestSession.sessao;
        }
      }
      
      // Atualizar a sessão específica
      const { data, error: updateError } = await supabase
        .from("chat_threads")
        .update({ session_started_at: now })
        .eq("chat_id", chatId)
        .eq("sessao", sessaoToUpdate)
        .select("session_started_at")
        .single();

      if (updateError) {
        // Se for erro de autenticação ou conexão, não propagar
        if (updateError.message?.includes("authentication") ||
            updateError.message?.includes("JWT") ||
            updateError.message?.includes("connection") ||
            updateError.message?.includes("timeout")) {
          console.error("Erro de conexão ao atualizar session timer:", updateError.message);
          return now; // Retornar timestamp atual sem atualizar o banco
        }
        throw updateError;
      }
      return data?.session_started_at || now;
    } catch (error) {
      console.error("Error starting session timer:", error);
      // Se for erro de autenticação ou conexão, retornar timestamp atual sem tentar novamente
      if (error?.message?.includes("authentication") ||
          error?.message?.includes("JWT") ||
          error?.message?.includes("connection") ||
          error?.message?.includes("timeout")) {
        return new Date().toISOString();
      }
      // Retornar timestamp atual como fallback
      return new Date().toISOString();
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
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("chat_threads")
        .insert([
          {
            chat_id: chatId,
            thread_id: threadId,
            diagnostico,
            protocolo,
            sessao: sessao, // Sempre começa com sessão 1 para novos chats
            session_started_at: now,
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
        .select("thread_id, diagnostico, protocolo, sessao, session_started_at")
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
      // 1. Buscar todos os chat_id do usuário
      const { data: userChats, error: userChatsError } = await supabase
        .from("user_chats")
        .select("chat_id")
        .eq("user_id", userId);

      if (userChatsError) throw userChatsError;
      const chatIds = userChats.map((uc) => uc.chat_id);

      // 2. Buscar os dados na view chat_overview
      let chats = [];
      if (chatIds.length > 0) {
        const { data: overviewData, error: overviewError } = await supabase
          .from("v_chat_overview")
          .select("*")
          .in("chat_id", chatIds);

        if (overviewError) throw overviewError;
        chats = overviewData || [];
      }

      // 3. Ordenar por data da última mensagem
      chats.sort(
        (a, b) => new Date(b.last_message_at) - new Date(a.last_message_at),
      );
      return chats;
    } catch (error) {
      console.error("Error getting user chats from chat_overview:", error);
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
