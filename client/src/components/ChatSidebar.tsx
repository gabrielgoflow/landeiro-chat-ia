import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChatService } from "@/services/chatService";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ChatThread, Message } from "@shared/schema";

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
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <i className="fas fa-robot text-white text-sm"></i>
              </div>
              <h1 className="text-lg font-semibold text-gray-900">Landeiro Chat IA</h1>
            </div>
            {isMobile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                data-testid="close-sidebar-button"
              >
                <i className="fas fa-times"></i>
              </Button>
            )}
          </div>

          {/* New Chat Button */}
          <div className="p-4">
            <Button
              onClick={onStartNewThread}
              className="w-full flex items-center justify-center px-4 py-3 bg-primary text-white rounded-lg hover:bg-indigo-600 transition-colors duration-200"
              data-testid="new-chat-button"
            >
              <i className="fas fa-plus mr-2"></i>
              Nova Conversa
            </Button>
          </div>

          {/* Chat History */}
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            <div className="space-y-2">
              {threads.length > 0 && (
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wider px-2 py-1">
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
                      group flex items-center px-3 py-2 rounded-lg cursor-pointer transition-colors duration-150
                      ${isActive 
                        ? 'bg-indigo-50 border border-indigo-100' 
                        : 'hover:bg-gray-100'
                      }
                    `}
                    onClick={() => onSelectThread(thread.id)}
                    data-testid={`thread-${thread.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {thread.title}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {lastMessage}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {formattedTime}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteThread(thread.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-red-500 transition-opacity duration-150"
                      data-testid={`delete-thread-${thread.id}`}
                    >
                      <i className="fas fa-trash text-xs"></i>
                    </Button>
                  </div>
                );
              })}

              {threads.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <i className="fas fa-comments text-3xl mb-3 text-gray-300"></i>
                  <p className="text-sm">Nenhuma conversa ainda</p>
                  <p className="text-xs mt-1">Clique em "Nova Conversa" para começar</p>
                </div>
              )}
            </div>
          </div>

          {/* User Info */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center space-x-3">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-gray-300 text-gray-600">
                  <i className="fas fa-user text-sm"></i>
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  gabriel@goflow.digital
                </div>
                <div className="text-xs text-gray-500">Usuário ativo</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
