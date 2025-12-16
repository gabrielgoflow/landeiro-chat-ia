import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface MessageInputProps {
  onSendMessage: (message: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  onClearError: () => void;
}

export function MessageInput({ onSendMessage, isLoading, error, onClearError }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  const handleSubmit = async (e: React.FormEvent) => {
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  return (
    <div className="bg-white border-t border-gray-200 px-2 sm:px-4 py-2 sm:py-4 flex-shrink-0">
      <div className="max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="flex items-end space-x-2 sm:space-x-3" data-testid="message-form">
          <div className="flex-1">
            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua mensagem..."
                className="w-full px-3 sm:px-4 py-2 sm:py-3 pr-10 sm:pr-12 text-sm sm:text-base border border-gray-300 rounded-2xl focus:ring-2 focus:ring-primary focus:border-transparent resize-none overflow-hidden min-h-[44px] sm:min-h-[48px] max-h-[120px]"
                data-testid="message-input"
                disabled={isLoading}
              />
              <button
                type="button"
                className="absolute right-1.5 sm:right-2 bottom-1.5 sm:bottom-2 p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 transition-colors duration-150"
                title="Anexar arquivo"
                data-testid="attach-file-button"
              >
                <i className="fas fa-paperclip text-xs sm:text-sm"></i>
              </button>
            </div>
          </div>
          <Button
            type="submit"
            disabled={!message.trim() || isLoading}
            className="p-2 sm:p-3 bg-primary text-white rounded-full hover:bg-indigo-600 focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="send-button"
          >
            {isLoading ? (
              <i className="fas fa-spinner fa-spin text-sm sm:text-base"></i>
            ) : (
              <i className="fas fa-paper-plane text-sm sm:text-base"></i>
            )}
          </Button>
        </form>
        
        <div className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-gray-500 text-center">
          Pressione Enter para enviar, Shift+Enter para nova linha
        </div>
      </div>
    </div>
  );
}
