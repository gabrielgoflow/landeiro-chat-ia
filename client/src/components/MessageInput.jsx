import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AudioRecorder } from "./AudioRecorder.jsx";
import { Send } from "lucide-react";

export function MessageInput({ onSendMessage, isLoading, error, onClearError, isFinalized = false, isSessionExpired = false }) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef(null);
  const { toast } = useToast();



  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
    }
  }, [message]);

  // Show error toast
  useEffect(() => {
    if (error) {
      toast({
        title: "Erro ao enviar mensagem",
        description: error,
        variant: "destructive",
      });
      onClearError();
    }
  }, [error, toast, onClearError]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!message.trim() || isLoading) return;
    
    const messageToSend = message.trim();
    setMessage("");
    
    try {
      await onSendMessage(messageToSend);
    } catch (err) {
      // Error handling is done in the parent component
      setMessage(messageToSend); // Restore message on error
    }
  };

  const handleAudioSent = async (audioMessage) => {
    try {
      await onSendMessage(audioMessage);
    } catch (err) {
      // Error handling is done in the parent component
      console.error('Error sending audio:', err);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="bg-white border-t border-gray-200 px-2 sm:px-4 py-2 sm:py-4 flex-shrink-0 relative">
      {/* Overlay when finalized or session expired */}
      {(isFinalized || isSessionExpired) && (
        <div className="absolute inset-0 bg-gray-100 bg-opacity-90 flex items-center justify-center z-10 rounded-t-lg">
          <div className="text-center px-2">
            {isFinalized ? (
              <>
                <i className="fas fa-check-circle text-green-500 text-xl sm:text-2xl mb-2"></i>
                <p className="text-gray-700 font-medium text-sm sm:text-base">Atendimento finalizado</p>
                <p className="text-gray-500 text-xs sm:text-sm">Esta conversa não pode mais receber mensagens</p>
              </>
            ) : (
              <>
                <i className="fas fa-clock text-red-500 text-xl sm:text-2xl mb-2"></i>
                <p className="text-gray-700 font-medium text-sm sm:text-base">Sessão expirada</p>
                <p className="text-gray-500 text-xs sm:text-sm">Tempo de 1 hora esgotado. Esta sessão não pode mais receber mensagens.</p>
              </>
            )}
          </div>
        </div>
      )}
      
      <div className="max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="flex items-end space-x-2 sm:space-x-3" data-testid="message-form">
          <div className="flex-1">
            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua mensagem ou grave um áudio..."
                className="w-full px-3 sm:px-4 py-2 sm:py-3 pr-10 sm:pr-12 text-sm sm:text-base border border-gray-300 rounded-2xl focus:ring-2 focus:ring-primary focus:border-transparent resize-none overflow-hidden min-h-[44px] sm:min-h-[48px] max-h-[120px]"
                data-testid="message-input"
                disabled={isLoading || isFinalized || isSessionExpired}
              />
            </div>
          </div>
          
          <AudioRecorder 
            onAudioSent={handleAudioSent} 
            disabled={isLoading || isFinalized || isSessionExpired}
          />
          
          <Button
            type="submit"
            disabled={!message.trim() || isLoading || isFinalized || isSessionExpired}
            className="p-2 sm:p-3 bg-primary text-white rounded-full hover:bg-indigo-600 focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="send-button"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-3.5 w-3.5 sm:h-4 sm:w-4 border-b-2 border-white" />
            ) : (
              <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            )}
          </Button>
        </form>
        
        <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-gray-500 text-center">
          {isFinalized 
            ? "Esta conversa foi finalizada" 
            : isSessionExpired 
            ? "Sessão expirada - Tempo de 1 hora esgotado"
            : "Pressione Enter para enviar, Shift+Enter para nova linha"}
        </div>
      </div>
    </div>
  );
}