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

  // Inicializar timer quando sessão é carregada
  const initializeTimer = useCallback(async () => {
    if (!chatId || isInitializing) return;
    
    // Evitar reinicialização se os valores não mudaram
    const currentKey = `${chatId}-${sessao}-${sessionStartedAt || 'null'}`;
    if (lastInitializedRef.current.chatId === chatId && 
        lastInitializedRef.current.sessao === sessao &&
        lastInitializedRef.current.sessionStartedAt === sessionStartedAt &&
        isInitialized) {
      return;
    }
    
    // Evitar queries duplicadas para a mesma combinação
    if (lastQueryRef.current === currentKey) {
      return;
    }
    
    lastQueryRef.current = currentKey;

    setIsInitializing(true);
    try {
      let startedAt = sessionStartedAt;

      // Se não tem session_started_at, buscar do banco ou iniciar
      if (!startedAt) {
        // Evitar queries duplicadas simultâneas
        if (isQueryingRef.current) {
          console.log("Query já em andamento, aguardando...");
          return;
        }
        
        // Tentar buscar do banco primeiro
        try {
          isQueryingRef.current = true;
          
          // Construir query baseada na sessão específica se fornecida
          let query = supabase
            .from("chat_threads")
            .select("session_started_at, sessao, created_at")
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
                .select("session_started_at, sessao")
                .eq("chat_id", chatId)
                .eq("sessao", sessao)
                .single();
              
              if (!checkError && currentSessionData && currentSessionData.session_started_at) {
                const currentSessionStart = new Date(currentSessionData.session_started_at).getTime();
                const currentSessionElapsed = now - currentSessionStart;
                
                // Se a sessão atual no banco é mais recente (menos de 2 horas), usar ela
                if (currentSessionElapsed < SESSION_DURATION_MS * 2) {
                  console.log("Encontrada sessão mais recente no banco, reiniciando timer:", {
                    oldStartedAt: startedAt,
                    newStartedAt: currentSessionData.session_started_at,
                    sessao
                  });
                  startedAt = currentSessionData.session_started_at;
                  // Recalcular com o novo timestamp
                  const newStartTime = new Date(startedAt).getTime();
                  const newElapsed = now - newStartTime;
                  const newEndTime = newStartTime + SESSION_DURATION_MS;
                  const newRemaining = newEndTime - now;
                  
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
        
        const endTime = startTime + SESSION_DURATION_MS;
        const remaining = endTime - now;
        
        // Log para debug
        console.log("Timer Debug:", {
          startedAt,
          startTime,
          startDate: startDate.toISOString(),
          now: new Date().toISOString(),
          elapsed: elapsed,
          elapsedMinutes: Math.floor(elapsed / 60000),
          endTime,
          remaining,
          remainingMinutes: Math.floor(remaining / 60000),
          isExpired: remaining <= 0
        });
        
        setTimeRemaining(Math.max(0, remaining));
        setIsExpired(remaining <= 0);
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

  // Atualizar timer a cada segundo
  useEffect(() => {
    if (!isInitialized || isExpired) return;

    const interval = setInterval(() => {
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
  }, [isInitialized, isExpired]);

  // Inicializar quando chatId, sessionStartedAt ou sessao mudar
  useEffect(() => {
    // Só reinicializar se os valores realmente mudaram
    if (chatId && !isInitializing) {
      const hasChanged = 
        lastInitializedRef.current.chatId !== chatId || 
        lastInitializedRef.current.sessao !== sessao ||
        lastInitializedRef.current.sessionStartedAt !== sessionStartedAt;
      
      // Se já está inicializado e os valores não mudaram, não reinicializar
      if (!hasChanged && isInitialized) {
        return;
      }
      
      if (hasChanged) {
        setIsInitialized(false);
        setIsExpired(false);
        setTimeRemaining(null);
        // Resetar flag de correção do banco se mudou chatId ou sessao
        if (lastInitializedRef.current.chatId !== chatId || 
            lastInitializedRef.current.sessao !== sessao) {
          lastInitializedRef.current = { chatId: null, sessao: null, sessionStartedAt: null };
          correctedFromDbRef.current = false; // Reset flag de correção
        }
        lastQueryRef.current = null; // Reset query ref também
        isQueryingRef.current = false; // Reset query flag também
        initializeTimer();
      }
    }
  }, [chatId, sessionStartedAt, sessao, isInitializing, initializeTimer, isInitialized]);

  return {
    timeRemaining,
    isExpired,
    isInitialized,
    initializeTimer,
  };
}

