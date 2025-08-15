import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useIsMobile } from "@/hooks/use-mobile.jsx";
import { useAuth } from "@/hooks/useAuth.jsx";
import { useChat } from "@/hooks/useChat.jsx";
import { ChatMessage } from "@/components/ChatMessage.jsx";
import { ChatSidebar } from "@/components/ChatSidebar.jsx";
import { ChatDebugInfo } from "@/components/ChatDebugInfo.jsx";
import { MessageInput } from "@/components/MessageInput.jsx";

export default function Chat() {
  const { chatId } = useParams();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const messagesEndRef = useRef(null);
  const isMobile = useIsMobile();
  const { user } = useAuth();
  
  const {
    threads,
    allMessages,
    currentMessages,
    currentThread,
    isLoading,
    error,
    startNewThread,
    selectThread,
    deleteThread,
    sendMessage,
    clearError
  } = useChat();

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages]);

  // Close sidebar on mobile when thread changes
  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  }, [currentThread, isMobile]);

  // Initialize based on chatId parameter
  useEffect(() => {
    if (chatId && chatId !== 'new') {
      // Load specific chat by ID
      const existingThread = threads.find(t => t.id === chatId);
      if (existingThread) {
        selectThread(existingThread.id);
      } else {
        // Chat ID not found in current threads, could be from database
        // Try to load it as a new thread with history from Supabase
        console.warn('Chat ID not found:', chatId);
        loadChatFromDatabase(chatId);
      }
    } else if (chatId === 'new' || (threads.length === 0 && !chatId)) {
      // Create new thread for /chat/new or when no threads exist
      startNewThread();
    }
  }, [chatId, threads, selectThread, startNewThread]);

  const loadChatFromDatabase = async (chatId) => {
    try {
      setError(null);
      // For now, we'll show an error message since we don't have the full integration
      // In a complete implementation, we would load the chat data from Supabase
      // and recreate the thread with the correct threadId to load history
      console.error('Chat loading from database not fully implemented yet');
      setError('Chat não encontrado. Redirecionando para nova conversa...');
      setTimeout(() => {
        startNewThread();
      }, 2000);
    } catch (error) {
      console.error('Error loading chat from database:', error);
      setError('Erro ao carregar chat. Criando nova conversa...');
      setTimeout(() => {
        startNewThread();
      }, 2000);
    }
  };

  const handleSendMessage = async (message) => {
    await sendMessage(message);
  };

  return (
    <div className="flex h-screen overflow-hidden" data-testid="chat-page">
      <ChatSidebar
        threads={threads}
        currentThread={currentThread}
        messages={allMessages}
        onSelectThread={selectThread}
        onDeleteThread={deleteThread}
        onStartNewThread={startNewThread}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/">
              <Button
                variant="ghost"
                size="sm"
                className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                data-testid="back-to-chats-button"
              >
                <i className="fas fa-arrow-left mr-2"></i>
                Voltar
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              data-testid="open-sidebar-button"
            >
              <i className="fas fa-bars"></i>
            </Button>
            <Avatar className="w-8 h-8 bg-secondary">
              <AvatarFallback className="bg-secondary text-white">
                <i className="fas fa-robot text-sm"></i>
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Assistente IA</h2>
              <p className="text-sm text-gray-500">Online • Responde instantaneamente</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              data-testid="settings-button"
            >
              <i className="fas fa-cog"></i>
            </Button>
          </div>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto px-4 py-6 min-h-0" data-testid="messages-container">
          <div className="max-w-4xl mx-auto space-y-6">
            
            {/* Welcome Message */}
            {currentMessages.length === 0 && (
              <div className="flex items-start space-x-3">
                <Avatar className="w-8 h-8 bg-secondary flex-shrink-0">
                  <AvatarFallback className="bg-secondary text-white">
                    <i className="fas fa-robot text-sm"></i>
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="bg-ai-message rounded-2xl rounded-tl-md px-4 py-3 max-w-md">
                    <p className="text-gray-800">Olá! Podemos iniciar nossa sessão?</p>
                  </div>
                  <div className="text-xs text-gray-500 mt-1 ml-1">Agora mesmo</div>
                </div>
              </div>
            )}

            {/* Chat Messages */}
            {currentMessages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}

            {/* Loading Message */}
            {isLoading && (
              <div className="flex items-start space-x-3" data-testid="loading-message">
                <Avatar className="w-8 h-8 bg-secondary flex-shrink-0">
                  <AvatarFallback className="bg-secondary text-white">
                    <i className="fas fa-robot text-sm"></i>
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="bg-ai-message rounded-2xl rounded-tl-md px-4 py-3 max-w-md">
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
                      </div>
                      <span className="text-sm text-gray-500">Digitando...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Debug Info (Admin only) */}
        {user?.email === 'admin@goflow.digital' && (
          <div className="px-4 pb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDebug(!showDebug)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              <i className="fas fa-bug mr-1"></i>
              {showDebug ? 'Ocultar Debug' : 'Mostrar Debug'}
            </Button>
          </div>
        )}
        
        <ChatDebugInfo 
          currentThread={currentThread}
          sessionData={currentThread?.sessionData}
          visible={showDebug}
        />

        {/* Message Input */}
        <MessageInput
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          error={error}
          onClearError={clearError}
        />
      </div>
    </div>
  );
}