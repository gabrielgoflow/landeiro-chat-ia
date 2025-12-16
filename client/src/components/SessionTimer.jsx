import { useEffect, useState, useMemo, useRef } from "react";
import { Clock, Pause, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase.js";

export function SessionTimer({ timeRemaining, isExpired, chatId, sessao, isFinalized = false }) {
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
  
  // Função para salvar estado no banco de dados
  const savePausedStateToDB = async (chatId, sessao, isPaused, pausedTime) => {
    if (!chatId || !sessao) return;
    
    try {
      const updateData = {
        timer_paused: isPaused,
        timer_paused_time: isPaused ? pausedTime : null
      };
      
      const { error } = await supabase
        .from("chat_threads")
        .update(updateData)
        .eq("chat_id", chatId)
        .eq("sessao", sessao);
      
      if (error) {
        console.error("SessionTimer: Erro ao salvar estado no banco:", error);
      } else {
        console.log("SessionTimer: Estado salvo no banco:", {
          chatId,
          sessao,
          ...updateData
        });
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
        return;
      }
      
      // Só recarregar se chatId ou sessao realmente mudaram
      if (lastChatIdRef.current === chatId && lastSessaoRef.current === sessao) {
        return;
      }
      
      // Marcar como carregando do banco para evitar salvar durante o carregamento
      isLoadingFromDBRef.current = true;
      isInitializingRef.current = true;
      
      console.log("SessionTimer: Carregando estado do banco para:", { chatId, sessao });
      const state = await loadPausedStateFromDB(chatId, sessao);
      
      // Atualizar lastSavedStateRef ANTES de atualizar o estado
      // Isso previne que o useEffect de persistência salve o estado antigo
      lastSavedStateRef.current = {
        isPaused: state.isPaused,
        pausedTime: state.pausedTime
      };
      
      // Agora atualizar o estado
      setIsPaused(state.isPaused);
      setPausedTime(state.pausedTime);
      wasPausedRef.current = state.isPaused;
      lastChatIdRef.current = chatId;
      lastSessaoRef.current = sessao;
      
      // Marcar como não carregando após um pequeno delay
      // para garantir que todos os useEffects tenham processado
      setTimeout(() => {
        isLoadingFromDBRef.current = false;
        isInitializingRef.current = false;
      }, 100);
      
      console.log("SessionTimer: Estado carregado do banco:", {
        chatId,
        sessao,
        isPaused: state.isPaused,
        pausedTime: state.pausedTime
      });
    };
    
    loadState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, sessao]);
  
  // Ref para rastrear se já estava pausado antes (evita atualizar pausedTime quando timeRemaining muda)
  const wasPausedRef = useRef(false);
  const lastChatIdRef = useRef(null);
  const lastSessaoRef = useRef(null);
  const isInitializingRef = useRef(true);
  const isLoadingFromDBRef = useRef(false); // Flag para indicar que estamos carregando do banco
  const lastSavedStateRef = useRef({ isPaused: false, pausedTime: null });

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
      return;
    }
    
    if (!chatId || !sessao) return;
    
    // Só salvar se o estado realmente mudou E não for o estado inicial padrão
    const currentState = { isPaused, pausedTime };
    const stateChanged = 
      lastSavedStateRef.current.isPaused !== currentState.isPaused ||
      lastSavedStateRef.current.pausedTime !== currentState.pausedTime;
    
    // Só salvar se houve mudança real (não durante carregamento)
    if (stateChanged) {
      console.log("SessionTimer: Estado mudou, salvando no banco:", {
        from: lastSavedStateRef.current,
        to: currentState
      });
      savePausedStateToDB(chatId, sessao, isPaused, pausedTime);
      lastSavedStateRef.current = { ...currentState };
    }
  }, [isPaused, pausedTime, chatId, sessao]);

  const handlePauseToggle = async () => {
    if (isPaused) {
      // Retomar: limpar o tempo pausado e atualizar no banco
      console.log("SessionTimer: Retomando timer");
      const newState = { isPaused: false, pausedTime: null };
      lastSavedStateRef.current = newState; // Atualizar ref antes de mudar estado
      setPausedTime(null);
      setIsPaused(false);
      wasPausedRef.current = false;
      // Atualizar no banco de dados
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





