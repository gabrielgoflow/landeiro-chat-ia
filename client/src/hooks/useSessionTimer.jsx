import { useState, useEffect, useCallback, useRef } from "react";
import { supabaseService } from "@/services/supabaseService";
import { supabase } from "@/lib/supabase.js";

const SESSION_DURATION_MS = 60 * 60 * 1000; // 1 hora em milissegundos

export function useSessionTimer(chatId, sessionStartedAt, sessao = null) {
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [isExpired, setIsExpired] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const lastInitializedRef = useRef({ chatId: null, sessao: null, sessionStartedAt: null });
  const lastQueryRef = useRef(null);
  const isQueryingRef = useRef(false);
  const correctedFromDbRef = useRef(false); // Flag para indicar que já corrigimos do banco
  const isPausedRef = useRef(false); // Flag para rastrear se o timer está pausado
  const pausedTimeRef = useRef(null); // Ref para armazenar o tempo pausado
  const lastPausedTimeBeforeResumeRef = useRef(null); // Ref para armazenar o último tempo pausado antes de ser retomado

  // Inicializar timer quando sessão é carregada
  const initializeTimer = useCallback(async () => {
    if (!chatId || isInitializing) return;
    
    // Verificação mais robusta: comparar cada campo separadamente
    const chatIdChanged = lastInitializedRef.current.chatId !== chatId;
    const sessaoChanged = lastInitializedRef.current.sessao !== sessao;
    const sessionStartedAtChanged = lastInitializedRef.current.sessionStartedAt !== sessionStartedAt;
    const hasChanged = chatIdChanged || sessaoChanged || sessionStartedAtChanged;
    
    // Evitar reinicialização se os valores não mudaram
    if (!hasChanged && isInitialized) {
      console.log("useSessionTimer: Valores não mudaram, evitando reinicialização:", {
        chatId,
        sessao,
        sessionStartedAt,
        lastInitialized: lastInitializedRef.current
      });
      return;
    }
    
    // Evitar queries duplicadas para a mesma combinação
    const currentKey = `${chatId}-${sessao}-${sessionStartedAt || 'null'}`;
    if (lastQueryRef.current === currentKey && isQueryingRef.current) {
      console.log("useSessionTimer: Query já em andamento para esta combinação, aguardando:", currentKey);
      return;
    }
    
    lastQueryRef.current = currentKey;

    setIsInitializing(true);
    try {
      let startedAt = sessionStartedAt;

      // IMPORTANTE: Se temos sessao específica, SEMPRE buscar do banco para garantir
      // que estamos usando o session_started_at correto da sessão atual
      // Isso previne usar o session_started_at de uma sessão anterior
      let sessionDataFromDB = null;
      if (sessao !== null && sessao !== undefined && chatId) {
        try {
          const { data: sessionData, error: sessionError } = await supabase
            .from("chat_threads")
            .select("session_started_at, timer_paused, timer_paused_time")
            .eq("chat_id", chatId)
            .eq("sessao", sessao)
            .single();
          
          if (!sessionError && sessionData) {
            sessionDataFromDB = sessionData;
            // Sempre usar o session_started_at do banco para esta sessão específica
            if (sessionData.session_started_at) {
              startedAt = sessionData.session_started_at;
              console.log("useSessionTimer: Usando session_started_at do banco para sessão específica:", {
                chatId,
                sessao,
                session_started_at: sessionData.session_started_at,
                propSessionStartedAt: sessionStartedAt
              });
            }
            
            // Também atualizar estado pausado
            isPausedRef.current = sessionData.timer_paused || false;
            pausedTimeRef.current = sessionData.timer_paused_time || null;
          }
        } catch (err) {
          console.error("useSessionTimer: Erro ao buscar session_started_at da sessão específica:", err);
        }
      }

      // Se não tem session_started_at, buscar do banco ou iniciar
      // (mas só se não já buscamos acima)
      if (!startedAt && !sessionDataFromDB) {
        // Evitar queries duplicadas simultâneas
        if (isQueryingRef.current) {
          console.log("Query já em andamento, aguardando...");
          return;
        }
        
        // Tentar buscar do banco primeiro
        try {
          isQueryingRef.current = true;
          
          // Construir query baseada na sessão específica se fornecida
          // Incluir também timer_paused e timer_paused_time para verificar estado de pausa
          let query = supabase
            .from("chat_threads")
            .select("session_started_at, sessao, created_at, timer_paused, timer_paused_time")
            .eq("chat_id", chatId);
          
          // Se temos o número da sessão, buscar essa sessão específica
          if (sessao !== null && sessao !== undefined) {
            query = query.eq("sessao", sessao);
          } else {
            // Se não temos sessão específica, buscar a mais recente
            query = query.order("sessao", { ascending: false });
          }
          
          // Usar maybeSingle() em vez de single() para evitar erro quando não encontra
          const { data: threadData, error } = await query.limit(1).maybeSingle();
          
          // Verificar se é erro de autenticação ou conexão
          if (error) {
            if (error.message?.includes("authentication") ||
                error.message?.includes("JWT") ||
                error.message?.includes("connection") ||
                error.message?.includes("timeout")) {
              console.error("Erro de conexão ao buscar session timer:", error.message);
              // Não tentar iniciar o timer se houver erro de conexão
              setIsExpired(true);
              setIsInitialized(true);
              setIsInitializing(false);
              return;
            }
            // Se for erro "não encontrado", continuar normalmente
            if (error.code !== "PGRST116") {
              throw error;
            }
          }
          
          if (!error && threadData) {
            // Verificar se o timer está pausado
            isPausedRef.current = threadData.timer_paused || false;
            pausedTimeRef.current = threadData.timer_paused_time || null;
            
            console.log("useSessionTimer: Estado pausado carregado durante inicialização:", {
              chatId,
              sessao,
              timer_paused: threadData.timer_paused,
              timer_paused_time: threadData.timer_paused_time,
              isPausedRef: isPausedRef.current,
              pausedTimeRef: pausedTimeRef.current
            });
            
            // Se session_started_at não existe, iniciar o timer agora (não usar created_at como fallback)
            if (!threadData.session_started_at) {
              // Adicionar pequeno delay para evitar sobrecarga
              await new Promise(resolve => setTimeout(resolve, 100));
              startedAt = await supabaseService.startSessionTimer(chatId, threadData.sessao);
            } else {
              // Usar session_started_at se existir
              startedAt = threadData.session_started_at;
            }
          } else {
            // Se não existe, iniciar o timer agora
            // Adicionar pequeno delay para evitar sobrecarga
            await new Promise(resolve => setTimeout(resolve, 100));
            startedAt = await supabaseService.startSessionTimer(chatId, sessao);
          }
        } catch (err) {
          console.error("Erro ao buscar session_started_at:", err);
          // Se for erro de autenticação ou conexão, não tentar novamente
          if (err?.message?.includes("authentication") ||
              err?.message?.includes("JWT") ||
              err?.message?.includes("connection") ||
              err?.message?.includes("timeout")) {
            setIsExpired(true);
            setIsInitialized(true);
            setIsInitializing(false);
            isQueryingRef.current = false;
            return;
          }
          // Se não conseguir buscar, tentar iniciar o timer agora (com delay)
          await new Promise(resolve => setTimeout(resolve, 200));
          startedAt = await supabaseService.startSessionTimer(chatId, sessao);
        } finally {
          isQueryingRef.current = false;
        }
      }

      // IMPORTANTE: Se temos sessao específica, buscar estado pausado ANTES de calcular
      // Isso garante que o estado pausado seja carregado antes de calcular o timeRemaining
      if (sessao !== null && sessao !== undefined && chatId) {
        try {
          const { data: pausedStateData, error: pausedStateError } = await supabase
            .from("chat_threads")
            .select("timer_paused, timer_paused_time")
            .eq("chat_id", chatId)
            .eq("sessao", sessao)
            .single();
          
          if (!pausedStateError && pausedStateData) {
            isPausedRef.current = pausedStateData.timer_paused || false;
            pausedTimeRef.current = pausedStateData.timer_paused_time || null;
            
            console.log("useSessionTimer: Estado pausado carregado ANTES de calcular timeRemaining:", {
              chatId,
              sessao,
              timer_paused: pausedStateData.timer_paused,
              timer_paused_time: pausedStateData.timer_paused_time,
              isPausedRef: isPausedRef.current,
              pausedTimeRef: pausedTimeRef.current
            });
          }
        } catch (err) {
          console.error("useSessionTimer: Erro ao buscar estado pausado antes de calcular:", err);
        }
      }

      if (startedAt) {
        // Garantir que startedAt é uma string ISO válida
        const startDate = new Date(startedAt);
        
        // Verificar se a data é válida
        if (isNaN(startDate.getTime())) {
          console.error("Data inválida recebida:", startedAt);
          setIsExpired(true);
          setIsInitialized(true);
          return;
        }
        
        const startTime = startDate.getTime();
        const now = new Date().getTime();
        const elapsed = now - startTime;
        
        // Se o tempo decorrido for maior que a duração da sessão, a sessão já expirou
        // Se for muito antigo (mais de 2 horas), verificar se é a sessão correta
        // Se não for, tentar buscar a sessão correta do banco
        if (elapsed > SESSION_DURATION_MS * 2) {
          // Verificar se já corrigimos do banco para esta combinação de chatId/sessao
          const correctionKey = `${chatId}-${sessao}`;
          const alreadyCorrected = correctedFromDbRef.current === correctionKey;
          
          if (alreadyCorrected) {
            // Já verificamos e atualizamos, não fazer novamente
            console.log("Timer já foi corrigido do banco para esta sessão, evitando verificação duplicada");
            // Usar o valor que já está no lastInitializedRef
            const correctedStartedAt = lastInitializedRef.current.sessionStartedAt;
            if (correctedStartedAt) {
              const correctedStartTime = new Date(correctedStartedAt).getTime();
              const correctedEndTime = correctedStartTime + SESSION_DURATION_MS;
              const correctedRemaining = correctedEndTime - now;
              setTimeRemaining(Math.max(0, correctedRemaining));
              setIsExpired(correctedRemaining <= 0);
              setIsInitialized(true);
            }
            return;
          }
          
          console.warn("Session timer muito antigo (mais de 2 horas), verificando se é a sessão correta:", {
            startedAt,
            elapsedHours: elapsed / (1000 * 60 * 60),
            chatId,
            sessao
          });
          
          // Se temos uma sessão específica, verificar se o timestamp no banco é diferente
          // Isso pode indicar que estamos usando o timestamp de uma sessão anterior
          if (sessao !== null && sessao !== undefined) {
            try {
              const { data: currentSessionData, error: checkError } = await supabase
                .from("chat_threads")
                .select("session_started_at, sessao, timer_paused, timer_paused_time")
                .eq("chat_id", chatId)
                .eq("sessao", sessao)
                .single();
              
              if (!checkError && currentSessionData && currentSessionData.session_started_at) {
                // Atualizar estado de pausa do banco
                isPausedRef.current = currentSessionData.timer_paused || false;
                pausedTimeRef.current = currentSessionData.timer_paused_time || null;
                
                const currentSessionStart = new Date(currentSessionData.session_started_at).getTime();
                const currentSessionElapsed = now - currentSessionStart;
                
                // Se a sessão atual no banco é mais recente (menos de 2 horas), usar ela
                if (currentSessionElapsed < SESSION_DURATION_MS * 2) {
                  console.log("Encontrada sessão mais recente no banco, reiniciando timer:", {
                    oldStartedAt: startedAt,
                    newStartedAt: currentSessionData.session_started_at,
                    sessao,
                    isPaused: isPausedRef.current,
                    pausedTime: pausedTimeRef.current
                  });
                  startedAt = currentSessionData.session_started_at;
                  
                  // Recalcular com o novo timestamp
                  // Se estiver pausado, usar o tempo pausado; caso contrário, calcular normalmente
                  let newRemaining;
                  if (isPausedRef.current && pausedTimeRef.current !== null) {
                    newRemaining = pausedTimeRef.current;
                  } else {
                    const newStartTime = new Date(startedAt).getTime();
                    const newElapsed = now - newStartTime;
                    const newEndTime = newStartTime + SESSION_DURATION_MS;
                    newRemaining = newEndTime - now;
                  }
                  
                  setTimeRemaining(Math.max(0, newRemaining));
                  setIsExpired(newRemaining <= 0);
                  setIsInitialized(true);
                  // Marcar como já inicializado com o valor do banco para evitar loops
                  lastInitializedRef.current = { 
                    chatId, 
                    sessao, 
                    sessionStartedAt: startedAt 
                  };
                  // Marcar que já corrigimos do banco para esta sessão
                  correctedFromDbRef.current = correctionKey;
                  // Resetar query ref para permitir nova query se necessário
                  lastQueryRef.current = null;
                  return;
                }
              }
            } catch (err) {
              console.error("Erro ao verificar sessão atual no banco:", err);
            }
          }
          
          // Se não encontrou uma sessão mais recente, marcar como expirado
          setTimeRemaining(0);
          setIsExpired(true);
          setIsInitialized(true);
          lastInitializedRef.current = { chatId, sessao, sessionStartedAt: startedAt };
          correctedFromDbRef.current = correctionKey; // Marcar como verificado mesmo se expirado
          return;
        }
        
        // Verificar se o timer está pausado - se estiver, usar o tempo pausado
        let remaining;
        if (isPausedRef.current && pausedTimeRef.current !== null) {
          // Se está pausado, usar o tempo pausado diretamente e NÃO calcular baseado no tempo decorrido
          remaining = pausedTimeRef.current;
          console.log("Timer Debug: Timer está pausado, usando timer_paused_time (NÃO calculando):", {
            pausedTime: pausedTimeRef.current,
            remainingMinutes: Math.floor(remaining / 60000),
            isPaused: isPausedRef.current
          });
        } else if (lastPausedTimeBeforeResumeRef.current !== null) {
          // Se não está pausado mas temos um tempo pausado salvo (indicando que foi retomado),
          // usar esse valor como base em vez de calcular a partir do session_started_at
          remaining = lastPausedTimeBeforeResumeRef.current;
          console.log("Timer Debug: Timer foi retomado, usando tempo pausado salvo:", {
            pausedTime: lastPausedTimeBeforeResumeRef.current,
            remainingMinutes: Math.floor(remaining / 60000),
            isPaused: isPausedRef.current,
            note: "Usando tempo pausado em vez de calcular a partir de session_started_at"
          });
          // Limpar a ref após usar para evitar usar valor antigo em próximas inicializações
          lastPausedTimeBeforeResumeRef.current = null;
        } else {
          // Se não está pausado e não foi retomado recentemente, calcular normalmente baseado no tempo decorrido
          const endTime = startTime + SESSION_DURATION_MS;
          remaining = endTime - now;
          
          // Log para debug
          console.log("Timer Debug: Timer NÃO está pausado, calculando normalmente:", {
            startedAt,
            startTime,
            startDate: startDate.toISOString(),
            now: new Date().toISOString(),
            elapsed: elapsed,
            elapsedMinutes: Math.floor(elapsed / 60000),
            endTime,
            remaining,
            remainingMinutes: Math.floor(remaining / 60000),
            isExpired: remaining <= 0,
            isPaused: isPausedRef.current
          });
        }
        
        setTimeRemaining(Math.max(0, remaining));
        // Se está pausado, não marcar como expirado (o tempo pausado já foi validado)
        setIsExpired(!isPausedRef.current && remaining <= 0);
        setIsInitialized(true);
        // Marcar como inicializado para evitar reinicializações
        lastInitializedRef.current = { chatId, sessao, sessionStartedAt: startedAt };
      } else {
        // Fallback: considerar expirado se não conseguir inicializar
        setIsExpired(true);
        setIsInitialized(true);
        lastInitializedRef.current = { chatId, sessao, sessionStartedAt: null };
      }
    } catch (error) {
      console.error("Erro ao inicializar timer:", error);
      // Se for erro de autenticação ou conexão, não tentar novamente imediatamente
      if (error?.message?.includes("authentication") ||
          error?.message?.includes("JWT") ||
          error?.message?.includes("connection") ||
          error?.message?.includes("timeout")) {
        console.error("Erro de conexão detectado, aguardando antes de tentar novamente");
        setIsExpired(true);
        setIsInitialized(true);
        setIsInitializing(false);
        return;
      }
      setIsExpired(true);
      setIsInitialized(true);
    } finally {
      setIsInitializing(false);
    }
  }, [chatId, sessionStartedAt, sessao, isInitializing]);

  // Verificar estado pausado do banco periodicamente
  // IMPORTANTE: Adicionar delay inicial para dar tempo do SessionTimer carregar o estado
  useEffect(() => {
    if (!isInitialized || !chatId || sessao === null || sessao === undefined) return;
    
    const checkPausedState = async () => {
      try {
        const { data, error } = await supabase
          .from("chat_threads")
          .select("timer_paused, timer_paused_time")
          .eq("chat_id", chatId)
          .eq("sessao", sessao)
          .single();
        
        if (!error && data) {
          const wasPaused = isPausedRef.current;
          const newIsPaused = data.timer_paused || false;
          const newPausedTime = data.timer_paused_time || null;
          
          // Detectar retomada: estava pausado e agora não está mais
          const isResuming = wasPaused && !newIsPaused;
          
          // Só atualizar se:
          // 1. O estado realmente mudou E
          // 2. Não estamos sobrescrevendo um estado pausado válido com um estado não pausado (exceto se for retomada)
          //    (isso previne que leituras antigas do banco sobrescrevam o estado correto)
          const stateChanged = wasPaused !== newIsPaused || pausedTimeRef.current !== newPausedTime;
          const wouldOverridePausedState = wasPaused && !newIsPaused && pausedTimeRef.current !== null && !isResuming;
          
          if (stateChanged && !wouldOverridePausedState) {
            // Se está retomando, salvar o tempo pausado antes de limpar
            if (isResuming && pausedTimeRef.current !== null) {
              lastPausedTimeBeforeResumeRef.current = pausedTimeRef.current;
              console.log("useSessionTimer: Timer retomado, salvando tempo pausado:", {
                pausedTime: pausedTimeRef.current,
                pausedTimeMinutes: Math.floor(pausedTimeRef.current / 60000)
              });
              
              // Usar o tempo pausado como base para continuar
              setTimeRemaining(pausedTimeRef.current);
            }
            
            console.log("useSessionTimer: Estado pausado mudou no banco:", {
              wasPaused,
              newIsPaused,
              oldPausedTime: pausedTimeRef.current,
              newPausedTime,
              isResuming,
              wouldOverride: wouldOverridePausedState
            });
            
            isPausedRef.current = newIsPaused;
            pausedTimeRef.current = newPausedTime;
            
            // Se está pausado, usar o tempo pausado
            if (newIsPaused && newPausedTime !== null) {
              setTimeRemaining(newPausedTime);
            }
          } else if (wouldOverridePausedState) {
            console.log("useSessionTimer: Ignorando atualização que sobrescreveria estado pausado:", {
              wasPaused,
              newIsPaused,
              oldPausedTime: pausedTimeRef.current,
              newPausedTime
            });
          }
        }
      } catch (err) {
        console.error("useSessionTimer: Erro ao verificar estado pausado:", err);
      }
    };
    
    // Adicionar delay inicial de 1 segundo para dar tempo do SessionTimer carregar o estado
    const initialTimeout = setTimeout(() => {
      checkPausedState();
    }, 1000);
    
    // Verificar a cada 3 segundos (menos frequente para não sobrecarregar)
    const interval = setInterval(checkPausedState, 3000);
    
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [isInitialized, chatId, sessao]);

  // Atualizar timer a cada segundo
  // IMPORTANTE: Não atualizar se o timer estiver pausado
  useEffect(() => {
    if (!isInitialized || isExpired) return;
    
    // Se está pausado, não criar intervalo e manter o timeRemaining fixo
    if (isPausedRef.current && pausedTimeRef.current !== null) {
      // Garantir que o timeRemaining está no valor pausado
      if (timeRemaining !== pausedTimeRef.current) {
        setTimeRemaining(pausedTimeRef.current);
      }
      return;
    }

    const interval = setInterval(() => {
      // Verificar novamente se está pausado antes de atualizar
      if (isPausedRef.current && pausedTimeRef.current !== null) {
        setTimeRemaining(pausedTimeRef.current);
        return;
      }
      
      setTimeRemaining((prev) => {
        if (prev === null) return null;
        const newRemaining = prev - 1000;
        
        if (newRemaining <= 0) {
          setIsExpired(true);
          return 0;
        }
        
        return newRemaining;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isInitialized, isExpired, timeRemaining]);

  // Inicializar quando chatId ou sessao mudar
  // IMPORTANTE: Não usar sessionStartedAt como dependência crítica porque:
  // 1. Ele pode mudar constantemente mesmo quando a sessão não mudou
  // 2. O useSessionTimer já busca o session_started_at do banco de qualquer forma
  // 3. Mudanças em sessionStartedAt não devem causar reinicialização se chatId e sessao não mudaram
  useEffect(() => {
    // Só reinicializar se os valores realmente mudaram
    if (chatId && !isInitializing) {
      // Verificação mais robusta: comparar apenas chatId e sessao (não sessionStartedAt)
      const chatIdChanged = lastInitializedRef.current.chatId !== chatId;
      const sessaoChanged = lastInitializedRef.current.sessao !== sessao;
      const hasChanged = chatIdChanged || sessaoChanged;
      
      // Se já está inicializado e os valores críticos não mudaram, não reinicializar
      if (!hasChanged && isInitialized) {
        // Atualizar sessionStartedAt no ref sem reinicializar
        if (lastInitializedRef.current.sessionStartedAt !== sessionStartedAt) {
          lastInitializedRef.current.sessionStartedAt = sessionStartedAt;
        }
        return;
      }
      
      if (hasChanged) {
        console.log("useSessionTimer: useEffect - Valores críticos mudaram, reinicializando:", {
          chatIdChanged,
          sessaoChanged,
          oldChatId: lastInitializedRef.current.chatId,
          newChatId: chatId,
          oldSessao: lastInitializedRef.current.sessao,
          newSessao: sessao
        });
        
        setIsInitialized(false);
        setIsExpired(false);
        setTimeRemaining(null);
        
        // Resetar flag de correção do banco se mudou chatId ou sessao
        console.log("useSessionTimer: Sessão mudou, resetando estado pausado:", {
          oldChatId: lastInitializedRef.current.chatId,
          newChatId: chatId,
          oldSessao: lastInitializedRef.current.sessao,
          newSessao: sessao
        });
        correctedFromDbRef.current = false; // Reset flag de correção
        isPausedRef.current = false; // Reset estado de pausa
        pausedTimeRef.current = null; // Reset tempo pausado
        lastPausedTimeBeforeResumeRef.current = null; // Reset tempo pausado antes de retomar
        
        lastQueryRef.current = null; // Reset query ref também
        isQueryingRef.current = false; // Reset query flag também
        initializeTimer();
      }
    }
  }, [chatId, sessao, isInitializing, initializeTimer, isInitialized]); // Removido sessionStartedAt das dependências

  return {
    timeRemaining,
    isExpired,
    isInitialized,
    initializeTimer,
  };
}

