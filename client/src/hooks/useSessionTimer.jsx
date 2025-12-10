import { useState, useEffect, useCallback } from "react";
import { supabaseService } from "@/services/supabaseService";
import { supabase } from "@/lib/supabase.js";

const SESSION_DURATION_MS = 60 * 60 * 1000; // 1 hora em milissegundos

export function useSessionTimer(chatId, sessionStartedAt, sessao = null) {
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [isExpired, setIsExpired] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Inicializar timer quando sessão é carregada
  const initializeTimer = useCallback(async () => {
    if (!chatId) return;

    try {
      let startedAt = sessionStartedAt;

      // Se não tem session_started_at, buscar do banco ou iniciar
      if (!startedAt) {
        // Tentar buscar do banco primeiro
        try {
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
          
          const { data: threadData, error } = await query.limit(1).single();
          
          if (!error && threadData) {
            // Usar session_started_at se existir, senão usar created_at como fallback
            startedAt = threadData.session_started_at || threadData.created_at;
            console.log("Session timer encontrado no banco:", {
              chatId,
              sessao: threadData.sessao,
              session_started_at: threadData.session_started_at,
              created_at: threadData.created_at,
              usando: startedAt
            });
          } else {
            // Se não existe, iniciar o timer agora
            console.log("Session timer não encontrado, iniciando agora para chatId:", chatId, "sessao:", sessao);
            startedAt = await supabaseService.startSessionTimer(chatId);
          }
        } catch (err) {
          console.error("Erro ao buscar session_started_at:", err);
          // Se não conseguir buscar, iniciar o timer agora
          startedAt = await supabaseService.startSessionTimer(chatId);
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
        const endTime = startTime + SESSION_DURATION_MS;
        const now = new Date().getTime();
        const remaining = endTime - now;
        
        // Log para debug
        console.log("Timer Debug:", {
          startedAt,
          startTime,
          startDate: startDate.toISOString(),
          now: new Date().toISOString(),
          endTime,
          remaining,
          remainingMinutes: Math.floor(remaining / 60000),
          isExpired: remaining <= 0
        });
        
        setTimeRemaining(Math.max(0, remaining));
        setIsExpired(remaining <= 0);
        setIsInitialized(true);
      } else {
        // Fallback: considerar expirado se não conseguir inicializar
        setIsExpired(true);
        setIsInitialized(true);
      }
    } catch (error) {
      console.error("Erro ao inicializar timer:", error);
      setIsExpired(true);
      setIsInitialized(true);
    }
  }, [chatId, sessionStartedAt, sessao]);

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
    if (chatId) {
      setIsInitialized(false);
      setIsExpired(false);
      setTimeRemaining(null);
      initializeTimer();
    }
  }, [chatId, sessionStartedAt, sessao, initializeTimer]);

  return {
    timeRemaining,
    isExpired,
    isInitialized,
    initializeTimer,
  };
}

