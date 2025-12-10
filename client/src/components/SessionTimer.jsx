import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function SessionTimer({ timeRemaining, isExpired }) {
  const [displayTime, setDisplayTime] = useState("");

  useEffect(() => {
    if (isExpired) {
      setDisplayTime("Tempo esgotado");
      return;
    }

    const updateDisplay = () => {
      const totalSeconds = Math.max(0, Math.floor(timeRemaining / 1000));
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      setDisplayTime(`${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`);
    };

    updateDisplay();
    const interval = setInterval(updateDisplay, 1000);

    return () => clearInterval(interval);
  }, [timeRemaining, isExpired]);

  // Determinar cor baseado no tempo restante
  const getVariant = () => {
    if (isExpired) return "destructive";
    const minutes = Math.floor(timeRemaining / 60000);
    if (minutes < 5) return "destructive";
    if (minutes < 15) return "default";
    return "secondary";
  };

  return (
    <Badge variant={getVariant()} className="flex items-center gap-1.5 px-3 py-1.5">
      <Clock className="h-3.5 w-3.5" />
      <span className="font-mono text-sm">{displayTime}</span>
    </Badge>
  );
}

