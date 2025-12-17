import { useEffect, useState, useMemo, useRef } from "react";
import { Clock, Pause, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase.js";

export function SessionTimer({ timeRemaining, isExpired, chatId, sessao, isFinalized = false, onPauseChange }) {
  const [displayTime, setDisplayTime] = useState("");
  
  // Criar chave única para localStorage baseada em chatId e sessao
  const storageKey = useMemo(() => {
    return chatId && sessao ? `session_timer_paused_${chatId}_${sessao}` : null;
  }, [chatId, sessao]);
  
  // Função para carregar estado do banco de dados
  const loadPausedStateFromDB = async (chatId, sessao) => {
    if (!chatId || !sessao) return { isPaused: false, pausedTime: null };
    
    try {
      const { data, error } = await supabase
        .from("chat_threads")
        .select("timer_paused, timer_paused_time")
        .eq("chat_id", chatId)
        .eq("sessao", sessao)
        .single();
      
      if (error) {
        // Se não encontrar registro, retornar estado padrão
        if (error.code === "PGRST116") {
          console.log("SessionTimer: Nenhum registro encontrado no banco, usando estado padrão");
          return { isPaused: false, pausedTime: null };
        }
        console.error("SessionTimer: Erro ao carregar estado do banco:", error);
        return { isPaused: false, pausedTime: null };
      }
      
      if (data) {
        console.log("SessionTimer: Estado carregado do banco:", {
          chatId,
          sessao,
          timer_paused: data.timer_paused,
          timer_paused_time: data.timer_paused_time
        });
        return {
          isPaused: data.timer_paused || false,
          pausedTime: data.timer_paused_time || null
        };
      }
    } catch (error) {
      console.error("SessionTimer: Erro ao carregar estado de pausa do banco:", error);
    }
    
    return { isPaused: false, pausedTime: null };
  };
  
  // Função para ajustar session_started_at quando retomamos o timer
  const adjustSessionStartedAtOnResume = async (chatId, sessao, pausedTime) => {
    if (!chatId || !sessao || pausedTime === null) {
      console.warn("SessionTimer: Tentativa de ajustar session_started_at sem dados necessários:", { chatId, sessao, pausedTime });
      return;
    }
    
    try {
      // Calcular o novo session_started_at baseado no tempo pausado
      // Se o tempo restante é pausedTime, então o tempo decorrido é SESSION_DURATION_MS - pausedTime
      // O novo session_started_at deve ser: now - (SESSION_DURATION_MS - pausedTime)
      const SESSION_DURATION_MS = 60 * 60 * 1000; // 1 hora
      const now = new Date().getTime();
      const elapsedWhenPaused = SESSION_DURATION_MS - pausedTime;
      const newSessionStartedAt = new Date(now - elapsedWhenPaused).toISOString();
      
      console.log("SessionTimer: Ajustando session_started_at ao retomar:", {
        chatId,
        sessao,
        pausedTime,
        pausedTimeMinutes: Math.floor(pausedTime / 60000),
        elapsedWhenPaused,
        elapsedWhenPausedMinutes: Math.floor(elapsedWhenPaused / 60000),
        newSessionStartedAt
      });
      
      const { data, error } = await supabase
        .from("chat_threads")
        .update({ session_started_at: newSessionStartedAt })
        .eq("chat_id", chatId)
        .eq("sessao", sessao)
        .select("session_started_at");
      
      if (error) {
        console.error("SessionTimer: Erro ao ajustar session_started_at:", error);
      } else {
        console.log("SessionTimer: session_started_at ajustado com sucesso:", {
          chatId,
          sessao,
          newSessionStartedAt: data?.[0]?.session_started_at
        });
      }
    } catch (error) {
      console.error("SessionTimer: Erro ao ajustar session_started_at:", error);
    }
  };

  // Função para salvar estado no banco de dados
  const savePausedStateToDB = async (chatId, sessao, isPaused, pausedTime) => {
    if (!chatId || !sessao) {
      console.warn("SessionTimer: Tentativa de salvar sem chatId ou sessao:", { chatId, sessao });
      return;
    }
    
    // NÃO salvar durante carregamento do banco ou inicialização
    if (isLoadingFromDBRef.current || isInitializingRef.current) {
      console.warn("SessionTimer: Tentativa de salvar durante carregamento/inicialização, ignorando:", {
        chatId,
        sessao,
        isPaused,
        pausedTime,
        isLoadingFromDB: isLoadingFromDBRef.current,
        isInitializing: isInitializingRef.current
      });
      return;
    }
    
    try {
      const updateData = {
        timer_paused: isPaused,
        timer_paused_time: isPaused ? pausedTime : null
      };
      
      console.log("SessionTimer: Tentando salvar estado no banco:", {
        chatId,
        sessao,
        updateData,
        isLoadingFromDB: isLoadingFromDBRef.current,
        isInitializing: isInitializingRef.current
      });
      
      const { data, error } = await supabase
        .from("chat_threads")
        .update(updateData)
        .eq("chat_id", chatId)
        .eq("sessao", sessao)
        .select();
      
      if (error) {
        console.error("SessionTimer: Erro ao salvar estado no banco:", error);
        throw error; // Re-throw para que o chamador saiba que falhou
      } else {
        console.log("SessionTimer: Estado salvo no banco com sucesso:", {
          chatId,
          sessao,
          updateData,
          rowsUpdated: data?.length || 0
        });
        
        // Verificar se realmente foi salvo
        if (data && data.length > 0) {
          console.log("SessionTimer: Verificação - dados salvos:", data[0]);
          
          // Verificar se os dados salvos correspondem ao que tentamos salvar
          const savedData = data[0];
          if (savedData.timer_paused !== isPaused || 
              (isPaused && savedData.timer_paused_time !== pausedTime) ||
              (!isPaused && savedData.timer_paused_time !== null)) {
            console.error("SessionTimer: ERRO - Dados salvos não correspondem ao esperado!", {
              esperado: { isPaused, pausedTime },
              salvo: { timer_paused: savedData.timer_paused, timer_paused_time: savedData.timer_paused_time }
            });
          } else {
            console.log("SessionTimer: Confirmação - Dados salvos corretamente!");
          }
        } else {
          console.warn("SessionTimer: AVISO - Nenhuma linha foi atualizada!");
        }
      }
    } catch (error) {
      console.error("SessionTimer: Erro ao salvar estado de pausa no banco:", error);
    }
  };
  
  // Função para carregar estado do localStorage (fallback)
  const loadPausedStateFromLocalStorage = (key) => {
    if (!key) return { isPaused: false, pausedTime: null };
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const data = JSON.parse(stored);
        return {
          isPaused: data.isPaused || false,
          pausedTime: data.pausedTime || null
        };
      }
    } catch (error) {
      console.error("Erro ao carregar estado de pausa do localStorage:", error);
    }
    return { isPaused: false, pausedTime: null };
  };
  
  // Carregar estado de pausa do localStorage ao montar
  // IMPORTANTE: O storageKey pode mudar, então vamos inicializar com false e recarregar no useEffect
  const [isPaused, setIsPaused] = useState(false);
  const [pausedTime, setPausedTime] = useState(null);
  
  // Carregar estado do banco quando chatId ou sessao mudarem (troca de aba)
  useEffect(() => {
    // Criar uma chave única para esta combinação de chatId/sessao
    const sessionKey = `${chatId}-${sessao}`;
    
    // Limpar timeout pendente se existir
    if (notificationTimeoutRef.current) {
      clearTimeout(notificationTimeoutRef.current);
      notificationTimeoutRef.current = null;
    }
    
    const loadState = async () => {
      if (!chatId || !sessao) {
        setIsPaused(false);
        setPausedTime(null);
        wasPausedRef.current = false;
        lastChatIdRef.current = null;
        lastSessaoRef.current = null;
        lastSavedStateRef.current = { isPaused: false, pausedTime: null };
        isLoadingFromDBRef.current = false;
        isInitializingRef.current = true; // Resetar flag de inicialização
        isLoadingStateRef.current = false;
        lastSessionKeyRef.current = null;
        lastPauseChangeNotificationRef.current = null;
        return;
      }
      
      // Verificação mais robusta: comparar chatId e sessao separadamente
      const sessionChanged = 
        lastChatIdRef.current !== chatId || 
        lastSessaoRef.current !== sessao;
      
      // Só recarregar se a sessão realmente mudou
      if (!sessionChanged && lastSessionKeyRef.current === sessionKey) {
        console.log("SessionTimer: Sessão não mudou, ignorando carregamento:", { 
          sessionKey, 
          lastSessionKey: lastSessionKeyRef.current,
          chatId,
          sessao,
          lastChatId: lastChatIdRef.current,
          lastSessao: lastSessaoRef.current
        });
        return;
      }
      
      // Evitar carregamento simultâneo
      if (isLoadingStateRef.current) {
        console.log("SessionTimer: Já está carregando estado, ignorando chamada duplicada:", { 
          chatId, 
          sessao,
          sessionKey,
          lastSessionKey: lastSessionKeyRef.current
        });
        return;
      }
      
      // Atualizar refs ANTES de marcar como carregando para evitar execuções duplicadas
      lastSessionKeyRef.current = sessionKey;
      lastChatIdRef.current = chatId;
      lastSessaoRef.current = sessao;
      
      // Marcar como carregando do banco para evitar salvar durante o carregamento
      isLoadingStateRef.current = true;
      isLoadingFromDBRef.current = true;
      isInitializingRef.current = true;
      
      console.log("SessionTimer: Carregando estado do banco para:", { chatId, sessao, sessionKey });
      const state = await loadPausedStateFromDB(chatId, sessao);
      
      // Atualizar lastSavedStateRef ANTES de atualizar o estado
      // Isso previne que o useEffect de persistência salve o estado antigo
      lastSavedStateRef.current = {
        isPaused: state.isPaused,
        pausedTime: state.pausedTime
      };
      
      // Garantir que userInitiatedChange está false ao carregar do banco
      userInitiatedChange.current = false;
      
      // Agora atualizar o estado
      setIsPaused(state.isPaused);
      setPausedTime(state.pausedTime);
      wasPausedRef.current = state.isPaused;
      
      // Consolidar notificação: só notificar se o valor mudou
      const shouldNotify = lastPauseChangeNotificationRef.current !== state.isPaused;
      if (onPauseChange && shouldNotify) {
        console.log("SessionTimer: Notificando estado pausado após carregar:", {
          isPaused: state.isPaused,
          chatId,
          sessao,
          previousNotification: lastPauseChangeNotificationRef.current
        });
        lastPauseChangeNotificationRef.current = state.isPaused;
        onPauseChange(state.isPaused);
      }
      
      // Marcar como não carregando após um delay maior
      // para garantir que todos os useEffects tenham processado
      notificationTimeoutRef.current = setTimeout(() => {
        console.log("SessionTimer: Finalizando carregamento do banco, habilitando persistência:", {
          chatId,
          sessao,
          sessionKey,
          estadoCarregado: { isPaused: state.isPaused, pausedTime: state.pausedTime },
          lastSavedState: lastSavedStateRef.current,
          userInitiated: userInitiatedChange.current
        });
        isLoadingFromDBRef.current = false;
        isInitializingRef.current = false;
        isLoadingStateRef.current = false; // Liberar flag de carregamento
        notificationTimeoutRef.current = null;
      }, 500);
      
      console.log("SessionTimer: Estado carregado do banco:", {
        chatId,
        sessao,
        sessionKey,
        isPaused: state.isPaused,
        pausedTime: state.pausedTime
      });
    };
    
    loadState().catch((error) => {
      console.error("SessionTimer: Erro ao carregar estado do banco:", error);
      isLoadingStateRef.current = false;
      isLoadingFromDBRef.current = false;
      isInitializingRef.current = false;
      // Resetar lastSessionKeyRef em caso de erro para permitir nova tentativa
      if (error.code !== "PGRST116") {
        lastSessionKeyRef.current = null;
      }
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
        notificationTimeoutRef.current = null;
      }
    });
    
    // Cleanup: cancelar timeout pendente se o componente for desmontado ou sessão mudar
    return () => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
        notificationTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, sessao]);
  
  // Ref para rastrear se já estava pausado antes (evita atualizar pausedTime quando timeRemaining muda)
  const wasPausedRef = useRef(false);
  const lastChatIdRef = useRef(null);
  const lastSessaoRef = useRef(null);
  const isInitializingRef = useRef(true);
  const isLoadingFromDBRef = useRef(false); // Flag para indicar que estamos carregando do banco
  const lastSavedStateRef = useRef({ isPaused: false, pausedTime: null });
  const userInitiatedChange = useRef(false); // Flag para rastrear mudanças intencionais do usuário
  const isLoadingStateRef = useRef(false); // Flag para evitar carregamento simultâneo
  const lastSessionKeyRef = useRef(null); // Ref para rastrear a última sessão carregada
  const lastPauseChangeNotificationRef = useRef(null); // Ref para rastrear última notificação de onPauseChange
  const notificationTimeoutRef = useRef(null); // Ref para armazenar timeout de notificação

  useEffect(() => {
    // Se a sessão foi finalizada ou expirou, parar o timer
    if (isExpired || isFinalized) {
      if (isFinalized) {
        setDisplayTime("Sessão finalizada");
      } else {
        setDisplayTime("Tempo esgotado");
      }
      // Limpar estado de pausa quando expirar ou finalizar
      if (isPaused) {
        setIsPaused(false);
        setPausedTime(null);
        wasPausedRef.current = false;
        // Limpar do banco de dados
        if (chatId && sessao) {
          savePausedStateToDB(chatId, sessao, false, null);
        }
      }
      return;
    }

    // Se estiver pausado, usar apenas o tempo pausado e não atualizar
    if (isPaused && pausedTime !== null) {
      const totalSeconds = Math.max(0, Math.floor(pausedTime / 1000));
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      setDisplayTime(`${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`);
      return; // Não criar intervalo quando pausado
    }

    // Quando não está pausado, atualizar normalmente
    const updateDisplay = () => {
      if (timeRemaining === null) return;
      const totalSeconds = Math.max(0, Math.floor(timeRemaining / 1000));
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      setDisplayTime(`${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`);
    };

    updateDisplay();
    
    // Só criar o intervalo se não estiver pausado e não estiver finalizado/expirado
    if (!isPaused && !isFinalized && !isExpired) {
      const interval = setInterval(updateDisplay, 1000);
      return () => clearInterval(interval);
    }
  }, [timeRemaining, isExpired, isPaused, pausedTime, isFinalized]);

  // Persistir estado de pausa no banco de dados
  // Usar ref para evitar salvar durante inicialização e detectar mudanças
  useEffect(() => {
    // Não salvar durante inicialização ou carregamento do estado do banco
    if (isInitializingRef.current || isLoadingFromDBRef.current) {
      console.log("SessionTimer: useEffect de persistência ignorado (inicializando/carregando):", {
        isInitializing: isInitializingRef.current,
        isLoadingFromDB: isLoadingFromDBRef.current,
        isPaused,
        pausedTime
      });
      return;
    }
    
    if (!chatId || !sessao) {
      console.log("SessionTimer: useEffect de persistência ignorado (sem chatId/sessao):", {
        chatId,
        sessao
      });
      return;
    }
    
    // Só salvar se o estado realmente mudou E não for o estado inicial padrão
    const currentState = { isPaused, pausedTime };
    const stateChanged = 
      lastSavedStateRef.current.isPaused !== currentState.isPaused ||
      lastSavedStateRef.current.pausedTime !== currentState.pausedTime;
    
    if (!stateChanged) {
      // Estado não mudou, não fazer nada
      return;
    }
    
    // Só salvar se foi uma mudança intencional do usuário
    if (userInitiatedChange.current) {
      console.log("SessionTimer: Estado mudou (ação do usuário), salvando no banco:", {
        from: lastSavedStateRef.current,
        to: currentState,
        chatId,
        sessao
      });
      savePausedStateToDB(chatId, sessao, isPaused, pausedTime);
      lastSavedStateRef.current = { ...currentState };
      // Resetar flag após salvar
      userInitiatedChange.current = false;
    } else {
      // Se houve mudança mas não foi intencional, pode ser uma transição de aba ou carregamento
      // Neste caso, NÃO salvar para evitar sobrescrever o estado correto do banco
      console.log("SessionTimer: Estado mudou mas NÃO foi ação do usuário, IGNORANDO salvamento:", {
        from: lastSavedStateRef.current,
        to: currentState,
        userInitiated: userInitiatedChange.current,
        chatId,
        sessao,
        motivo: "Mudança detectada após carregamento do banco ou transição de aba"
      });
      // Atualizar lastSavedStateRef para evitar loops, mas NÃO salvar no banco
      lastSavedStateRef.current = { ...currentState };
    }
  }, [isPaused, pausedTime, chatId, sessao]);

  // Notificar componente pai sobre mudanças no estado de pausa
  // IMPORTANTE: Não incluir onPauseChange nas dependências para evitar loops
  // Só notificar se o valor realmente mudou e não estamos carregando
  useEffect(() => {
    if (onPauseChange && 
        !isInitializingRef.current && 
        !isLoadingFromDBRef.current && 
        !isLoadingStateRef.current &&
        lastPauseChangeNotificationRef.current !== isPaused) {
      console.log("SessionTimer: Notificando mudança de estado pausado:", {
        isPaused,
        previousNotification: lastPauseChangeNotificationRef.current
      });
      lastPauseChangeNotificationRef.current = isPaused;
      onPauseChange(isPaused);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPaused]);

  const handlePauseToggle = async () => {
    // Marcar como mudança intencional do usuário ANTES de alterar o estado
    userInitiatedChange.current = true;
    
    if (isPaused) {
      // Retomar: ajustar session_started_at e limpar o tempo pausado
      console.log("SessionTimer: Retomando timer");
      
      // Salvar o tempo pausado antes de limpar
      const pausedTimeToUse = pausedTime;
      
      const newState = { isPaused: false, pausedTime: null };
      lastSavedStateRef.current = newState; // Atualizar ref antes de mudar estado
      setPausedTime(null);
      setIsPaused(false);
      wasPausedRef.current = false;
      
      // Ajustar session_started_at no banco para refletir o tempo pausado
      if (chatId && sessao && pausedTimeToUse !== null) {
        await adjustSessionStartedAtOnResume(chatId, sessao, pausedTimeToUse);
      }
      
      // Atualizar estado no banco de dados
      if (chatId && sessao) {
        await savePausedStateToDB(chatId, sessao, false, null);
      }
    } else {
      // Pausar: salvar o tempo atual
      if (timeRemaining !== null) {
        console.log("SessionTimer: Pausando timer em:", timeRemaining);
        const newState = { isPaused: true, pausedTime: timeRemaining };
        lastSavedStateRef.current = newState; // Atualizar ref antes de mudar estado
        setPausedTime(timeRemaining);
        setIsPaused(true);
        wasPausedRef.current = true;
        // Salvar imediatamente no banco de dados
        if (chatId && sessao) {
          await savePausedStateToDB(chatId, sessao, true, timeRemaining);
        }
      }
    }
  };

  // Determinar cor baseado no tempo restante
  const getVariant = () => {
    if (isExpired || isFinalized) return "destructive";
    const timeToCheck = isPaused && pausedTime !== null ? pausedTime : timeRemaining;
    const minutes = Math.floor(timeToCheck / 60000);
    if (minutes < 5) return "destructive";
    if (minutes < 15) return "default";
    return "secondary";
  };

  return (
    <div className="flex items-center gap-2">
      <Badge variant={getVariant()} className="flex items-center gap-1.5 px-3 py-1.5">
        <Clock className="h-3.5 w-3.5" />
        <span className="font-mono text-sm">{displayTime}</span>
        {isPaused && <span className="text-xs opacity-75">(Pausado)</span>}
      </Badge>
      {!isExpired && !isFinalized && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handlePauseToggle}
          title={isPaused ? "Retomar" : "Pausar"}
        >
          {isPaused ? (
            <Play className="h-3.5 w-3.5" />
          ) : (
            <Pause className="h-3.5 w-3.5" />
          )}
        </Button>
      )}
    </div>
  );
}





