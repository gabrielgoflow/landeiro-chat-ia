import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChatService } from "@/services/chatService";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ChatThread, Message } from "@shared/schema";
import { Logo } from "@/components/Logo";

interface ChatSidebarProps {
  threads: ChatThread[];
  currentThread: ChatThread | null;
  messages: { [threadId: string]: Message[] };
  onSelectThread: (threadId: string) => void;
  onDeleteThread: (threadId: string) => void;
  onStartNewThread: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export function ChatSidebar({
  threads,
  currentThread,
  messages,
  onSelectThread,
  onDeleteThread,
  onStartNewThread,
  isOpen,
  onClose
}: ChatSidebarProps) {
  const isMobile = useIsMobile();

  const getLastMessage = (threadId: string): string => {
    const threadMessages = messages[threadId] || [];
    const lastMessage = threadMessages[threadMessages.length - 1];
    return lastMessage ? lastMessage.content : "Nova conversa";
  };

  const getFormattedTime = (thread: ChatThread): string => {
    return ChatService.formatTimestamp(thread.updatedAt);
  };

  return (
    <>
      {/* Sidebar Overlay for Mobile */}
      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onClose}
          data-testid="sidebar-overlay"
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-80 bg-white shadow-lg transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:inset-0
      `} data-testid="sidebar">
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-2 sm:p-4 border-b border-border">
            <div className="flex items-center justify-center flex-1">
              <div className="w-auto h-6 sm:h-8 rounded-lg">
                <img src="https://nexialab.com.br/wp-content/uploads/2025/10/cropped-favicon-1.png" alt="Logo" className="w-3 h-3 sm:w-4 sm:h-4" />
              </div>
            </div>
            {isMobile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="p-1.5 sm:p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                data-testid="close-sidebar-button"
              >
                <i className="fas fa-times text-sm"></i>
              </Button>
            )}
          </div>

          {/* New Chat Button */}
          <div className="p-2 sm:p-4">
            <Button
              onClick={onStartNewThread}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 bg-gradient-pbe text-white text-sm sm:text-base rounded-lg hover:opacity-90 transition-opacity duration-200"
              data-testid="new-chat-button"
            >
              <i className="fas fa-plus mr-1.5 sm:mr-2"></i>
              <span className="hidden sm:inline">Nova Conversa</span>
              <span className="sm:hidden">Nova</span>
            </Button>
          </div>

          {/* Chat History */}
          <div className="flex-1 overflow-y-auto px-2 sm:px-4 pb-2 sm:pb-4">
            <div className="space-y-1.5 sm:space-y-2">
              {threads.length > 0 && (
                <div className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider px-1.5 sm:px-2 py-0.5 sm:py-1">
                  Conversas Recentes
                </div>
              )}
              
              {threads.map((thread) => {
                const isActive = currentThread?.id === thread.id;
                const lastMessage = getLastMessage(thread.id);
                const formattedTime = getFormattedTime(thread);

                return (
                  <div
                    key={thread.id}
                    className={`
                      group flex items-center px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg cursor-pointer transition-colors duration-150
                      ${isActive 
                        ? 'bg-primary/10 border border-primary/20' 
                        : 'hover:bg-muted'
                      }
                    `}
                    onClick={() => onSelectThread(thread.id)}
                    data-testid={`thread-${thread.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs sm:text-sm font-medium text-foreground truncate">
                        {thread.title}
                      </div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground truncate">
                        {lastMessage}
                      </div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground/70 mt-0.5 sm:mt-1">
                        {formattedTime}
                      </div>
                    </div>
                    {/* Botão de delete removido - apenas admins podem deletar via painel admin */}
                  </div>
                );
              })}

              {threads.length === 0 && (
                <div className="text-center py-4 sm:py-8 text-muted-foreground">
                  <i className="fas fa-comments text-2xl sm:text-3xl mb-2 sm:mb-3 text-muted"></i>
                  <p className="text-xs sm:text-sm">Nenhuma conversa ainda</p>
                  <p className="text-[10px] sm:text-xs mt-1 px-2">Clique em "Nova Conversa" para começar</p>
                </div>
              )}
            </div>
          </div>

          {/* User Info */}
          <div className="p-2 sm:p-4 border-t border-border">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Avatar className="w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0">
                <AvatarFallback className="bg-muted text-muted-foreground">
                  <i className="fas fa-user text-xs sm:text-sm"></i>
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-xs sm:text-sm font-medium text-foreground truncate">
                  gabriel@goflow.digital
                </div>
                <div className="text-[10px] sm:text-xs text-muted-foreground">Usuário ativo</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
