import { useEffect, useState, useMemo } from "react";
import { Clock, Pause, Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function SessionTimer({ timeRemaining, isExpired, chatId, sessao, isFinalized = false }) {
  const [displayTime, setDisplayTime] = useState("");
  
  // Criar chave única para localStorage baseada em chatId e sessao
  const storageKey = useMemo(() => {
    return chatId && sessao ? `session_timer_paused_${chatId}_${sessao}` : null;
  }, [chatId, sessao]);
  
  // Função para carregar estado do localStorage
  const loadPausedState = (key) => {
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
  
  // Carregar estado de pausa do localStorage ao montar ou quando storageKey mudar
  const [isPaused, setIsPaused] = useState(() => {
    const state = loadPausedState(storageKey);
    return state.isPaused;
  });
  
  const [pausedTime, setPausedTime] = useState(() => {
    const state = loadPausedState(storageKey);
    return state.pausedTime;
  });
  
  // Recarregar estado quando storageKey mudar (mudança de sessão)
  useEffect(() => {
    if (!storageKey) {
      setIsPaused(false);
      setPausedTime(null);
      return;
    }
    const state = loadPausedState(storageKey);
    setIsPaused(state.isPaused);
    setPausedTime(state.pausedTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

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
        if (storageKey) {
          try {
            localStorage.removeItem(storageKey);
          } catch (error) {
            console.error("Erro ao limpar estado de pausa:", error);
          }
        }
      }
      return;
    }

    const updateDisplay = () => {
      // Se estiver pausado, usar o tempo pausado
      const timeToUse = isPaused && pausedTime !== null ? pausedTime : timeRemaining;
      const totalSeconds = Math.max(0, Math.floor(timeToUse / 1000));
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      setDisplayTime(`${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`);
    };

    updateDisplay();
    
    // Só atualizar o intervalo se não estiver pausado e não estiver finalizado/expirado
    if (!isPaused && !isFinalized && !isExpired) {
      const interval = setInterval(updateDisplay, 1000);
      return () => clearInterval(interval);
    }
  }, [timeRemaining, isExpired, isPaused, pausedTime, isFinalized]);

  // Atualizar o tempo pausado quando pausar
  useEffect(() => {
    if (isPaused && timeRemaining !== null) {
      setPausedTime(timeRemaining);
    }
  }, [isPaused, timeRemaining]);

  // Persistir estado de pausa no localStorage
  useEffect(() => {
    if (!storageKey) return;
    
    try {
      if (isPaused && pausedTime !== null) {
        // Salvar quando pausado
        const data = {
          isPaused: true,
          pausedTime,
          lastUpdated: new Date().toISOString()
        };
        localStorage.setItem(storageKey, JSON.stringify(data));
      } else if (!isPaused && pausedTime === null) {
        // Limpar quando retomado
        localStorage.removeItem(storageKey);
      }
    } catch (error) {
      console.error("Erro ao salvar estado de pausa no localStorage:", error);
    }
  }, [isPaused, pausedTime, storageKey]);

  const handlePauseToggle = () => {
    if (isPaused) {
      // Retomar: limpar o tempo pausado e remover do localStorage
      setPausedTime(null);
      setIsPaused(false);
      if (storageKey) {
        try {
          localStorage.removeItem(storageKey);
        } catch (error) {
          console.error("Erro ao remover estado de pausa do localStorage:", error);
        }
      }
    } else {
      // Pausar: salvar o tempo atual
      setPausedTime(timeRemaining);
      setIsPaused(true);
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





