import { supabase } from "@/lib/supabase.js";

// Cache para max_sessoes por diagnóstico (evita queries repetidas)
const maxSessoesCache = new Map();
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutos

export class SupabaseService {
  // Função auxiliar para determinar o limite máximo de sessões baseado no diagnóstico
  // DEPRECATED: Use getMaxSessionsForDiagnosticoAsync para buscar do banco
  static getMaxSessionsForDiagnostico(diagnosticoCodigo) {
    // Normalizar o código do diagnóstico para comparar (considerar ambos com e sem acento)
    const normalizedCodigo = diagnosticoCodigo?.toLowerCase() || '';
    
    // Depressão tem limite de 14 sessões (contando com a sessão extra)
    if (normalizedCodigo === 'depressão' || normalizedCodigo === 'depressao') {
      return 14;
    }
    
    // Outros diagnósticos têm limite de 10 sessões
    return 10;
  }

  // Função assíncrona para buscar max_sessoes do banco de dados
  static async getMaxSessionsForDiagnosticoAsync(diagnosticoCodigo) {
    if (!diagnosticoCodigo) {
      return 10; // Default
    }

    const normalizedCodigo = diagnosticoCodigo?.toLowerCase()?.trim() || '';
    
    // Verificar cache primeiro
    const cacheKey = normalizedCodigo;
    const cached = maxSessoesCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION_MS) {
      return cached.value;
    }

    try {
      // Buscar do banco de dados
      const { data, error } = await supabase
        .from("diagnosticos")
        .select("max_sessoes")
        .eq("codigo", normalizedCodigo)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error("Erro ao buscar max_sessoes:", error);
        // Usar fallback
        const fallback = this.getMaxSessionsForDiagnostico(diagnosticoCodigo);
        maxSessoesCache.set(cacheKey, { value: fallback, timestamp: Date.now() });
        return fallback;
      }

      if (data && data.max_sessoes) {
        const maxSessoes = data.max_sessoes;
        // Atualizar cache
        maxSessoesCache.set(cacheKey, { value: maxSessoes, timestamp: Date.now() });
        return maxSessoes;
      }

      // Se não encontrou, usar fallback
      const fallback = this.getMaxSessionsForDiagnostico(diagnosticoCodigo);
      maxSessoesCache.set(cacheKey, { value: fallback, timestamp: Date.now() });
      return fallback;
    } catch (error) {
      console.error("Erro ao buscar max_sessoes do banco:", error);
      // Usar fallback em caso de erro
      const fallback = this.getMaxSessionsForDiagnostico(diagnosticoCodigo);
      maxSessoesCache.set(cacheKey, { value: fallback, timestamp: Date.now() });
      return fallback;
    }
  }

  // Limpar cache (útil quando admin atualiza max_sessoes)
  static clearMaxSessoesCache() {
    maxSessoesCache.clear();
  }

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
      
      // Obter limite máximo baseado no diagnóstico (buscar do banco)
      const maxSessions = await this.getMaxSessionsForDiagnosticoAsync(lastSession?.diagnostico);

      // Verificar se já atingiu o limite de sessões para este diagnóstico
      if (currentSession >= maxSessions) {
        return {
          data: null,
          error: `Limite de ${maxSessions} sessões atingido para este diagnóstico`,
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
      console.log("[getUserChats] Buscando chats para userId:", userId);
      
      // 1. Buscar todos os chat_id do usuário
      const { data: userChats, error: userChatsError } = await supabase
        .from("user_chats")
        .select("chat_id")
        .eq("user_id", userId);

      if (userChatsError) {
        console.error("[getUserChats] Erro ao buscar user_chats:", userChatsError);
        throw userChatsError;
      }
      
      const chatIds = userChats.map((uc) => uc.chat_id);
      console.log("[getUserChats] Chat IDs encontrados em user_chats:", chatIds.length);

      // 2. Verificar quais chat_ids realmente têm sessões válidas em chat_threads
      let validChatIds = [];
      if (chatIds.length > 0) {
        const { data: validThreads, error: threadsError } = await supabase
          .from("chat_threads")
          .select("chat_id")
          .in("chat_id", chatIds);

        if (threadsError) {
          console.error("[getUserChats] Erro ao verificar chat_threads:", threadsError);
          throw threadsError;
        }

        // Extrair chat_ids únicos que têm sessões válidas
        validChatIds = [...new Set((validThreads || []).map(t => t.chat_id))];
        console.log("[getUserChats] Chat IDs com sessões válidas:", validChatIds.length);
        
        // Log de chats órfãos (existem em user_chats mas não em chat_threads)
        const orphanChats = chatIds.filter(id => !validChatIds.includes(id));
        if (orphanChats.length > 0) {
          console.warn("[getUserChats] Chats órfãos encontrados (existem em user_chats mas não em chat_threads):", orphanChats);
        }
      }

      // 3. Buscar os dados na view chat_overview apenas para chats válidos
      let chats = [];
      if (validChatIds.length > 0) {
        const { data: overviewData, error: overviewError } = await supabase
          .from("v_chat_overview")
          .select("*")
          .in("chat_id", validChatIds);

        if (overviewError) {
          console.error("[getUserChats] Erro ao buscar v_chat_overview:", overviewError);
          throw overviewError;
        }
        chats = overviewData || [];
        console.log("[getUserChats] Chats retornados da view:", chats.length);
      }

      // 4. Ordenar por data da última mensagem
      chats.sort(
        (a, b) => new Date(b.last_message_at) - new Date(a.last_message_at),
      );
      
      console.log("[getUserChats] Total de chats retornados:", chats.length);
      return chats;
    } catch (error) {
      console.error("[getUserChats] Erro ao buscar chats do usuário:", error);
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
      console.log("[deleteChatThread] Iniciando deleção de chat thread:", chatId);
      
      // Buscar informações do thread antes de deletar para o audit log
      const { data: threadData, error: selectError } = await supabase
        .from("chat_threads")
        .select("chat_id, diagnostico, protocolo, sessao")
        .eq("chat_id", chatId);

      if (selectError) {
        console.error("[deleteChatThread] Erro ao buscar informações do thread:", selectError);
        throw selectError;
      }

      const sessionCount = threadData?.length || 0;
      console.log("[deleteChatThread] Total de sessões que serão deletadas:", sessionCount);

      if (sessionCount === 0) {
        console.warn("[deleteChatThread] Nenhuma sessão encontrada para este chat_id:", chatId);
        return { error: "Nenhuma sessão encontrada para este chat" };
      }

      // Usar o primeiro registro para o audit log (ou todos se necessário)
      const firstThread = threadData?.[0];

      const { error } = await supabase
        .from("chat_threads")
        .delete()
        .eq("chat_id", chatId);

      if (error) {
        console.error("[deleteChatThread] Erro ao deletar thread:", error);
        throw error;
      }

      console.log("[deleteChatThread] Thread deletado com sucesso:", chatId);

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
                action: "delete_thread",
                details: {
                  chatId: chatId,
                  diagnostico: firstThread?.diagnostico || null,
                  protocolo: firstThread?.protocolo || null,
                  sessao: firstThread?.sessao || null,
                  sessionCount: sessionCount,
                },
              }),
            });
          }
        }
      } catch (auditError) {
        // Não falhar a operação se o audit log falhar
        console.error("[deleteChatThread] Erro ao criar audit log:", auditError);
      }

      return { error: null };
    } catch (error) {
      console.error("Error deleting chat thread:", error);
      return { error: error.message };
    }
  }

  // Deletar uma sessão específica (chat_id + sessao)
  static async deleteSession(chatId, sessao) {
    try {
      console.log("[deleteSession] Iniciando deleção de sessão:", { chatId, sessao });
      
      // Verificar quantas sessões existem para este chat_id
      const { data: allSessions, error: countError } = await supabase
        .from("chat_threads")
        .select("sessao")
        .eq("chat_id", chatId);

      if (countError) {
        console.error("[deleteSession] Erro ao contar sessões:", countError);
        throw countError;
      }

      const sessionCount = allSessions?.length || 0;
      console.log("[deleteSession] Total de sessões para este chat_id:", sessionCount);

      // Se for a última sessão, avisar (mas não impedir - deixar o usuário decidir)
      if (sessionCount === 1) {
        console.warn("[deleteSession] ATENÇÃO: Esta é a última sessão do chat_id. A deleção removerá o chat completamente.");
      }

      // Buscar informações da sessão antes de deletar para o audit log
      const { data: sessionData } = await supabase
        .from("chat_threads")
        .select("chat_id, diagnostico, protocolo, sessao")
        .eq("chat_id", chatId)
        .eq("sessao", sessao)
        .maybeSingle();

      if (!sessionData) {
        console.warn("[deleteSession] Sessão não encontrada:", { chatId, sessao });
        return { error: "Sessão não encontrada" };
      }

      const { error } = await supabase
        .from("chat_threads")
        .delete()
        .eq("chat_id", chatId)
        .eq("sessao", sessao);

      if (error) {
        console.error("[deleteSession] Erro ao deletar sessão:", error);
        throw error;
      }

      console.log("[deleteSession] Sessão deletada com sucesso:", { chatId, sessao });

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
                action: "delete_session",
                details: {
                  chatId: chatId,
                  sessao: sessao,
                  diagnostico: sessionData?.diagnostico || null,
                  protocolo: sessionData?.protocolo || null,
                },
              }),
            });
          }
        }
      } catch (auditError) {
        // Não falhar a operação se o audit log falhar
        console.error("Error creating audit log:", auditError);
      }

      return { error: null };
    } catch (error) {
      console.error("Error deleting session:", error);
      return { error: error.message };
    }
  }

  // Deletar chat do usuário (e dados relacionados)
  static async deleteUserChat(userId, chatId) {
    try {
      // Buscar informações do thread antes de deletar para o audit log
      const { data: threadData } = await supabase
        .from("chat_threads")
        .select("chat_id, diagnostico, protocolo, sessao")
        .eq("chat_id", chatId)
        .maybeSingle();

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
                action: "delete_user_chat",
                targetUserId: userId,
                details: {
                  chatId: chatId,
                  diagnostico: threadData?.diagnostico || null,
                  protocolo: threadData?.protocolo || null,
                  sessao: threadData?.sessao || null,
                },
              }),
            });
          }
        }
      } catch (auditError) {
        // Não falhar a operação se o audit log falhar
        console.error("Error creating audit log:", auditError);
      }

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
