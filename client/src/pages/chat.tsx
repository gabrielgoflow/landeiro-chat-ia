import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useChat } from "@/hooks/useChat";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatSidebar } from "@/components/ChatSidebar";
import { MessageInput } from "@/components/MessageInput";
import { ReviewSidebar } from "@/components/ReviewSidebar";
import type { ChatReview } from "@shared/schema";

export default function Chat() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isReviewSidebarOpen, setIsReviewSidebarOpen] = useState(false);
  const [currentReview, setCurrentReview] = useState<ChatReview | null>(null);
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  
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

  // Initialize with first thread or create new one
  useEffect(() => {
    if (threads.length === 0) {
      startNewThread();
    }
  }, [threads.length, startNewThread]);

  const handleSendMessage = async (message: string) => {
    await sendMessage(message);
  };

  // Function to load review for current chat
  const loadReview = async () => {
    if (!currentThread?.openaiChatId) return;
    
    setIsLoadingReview(true);
    try {
      const response = await fetch(`/api/reviews/${currentThread.openaiChatId}`);
      if (response.ok) {
        const review = await response.json();
        setCurrentReview(review);
        setIsReviewSidebarOpen(true);
      } else {
        console.log('No review found for this chat');
      }
    } catch (error) {
      console.error('Error loading review:', error);
    } finally {
      setIsLoadingReview(false);
    }
  };

  // Check if current chat has a review
  const [hasReview, setHasReview] = useState(false);
  
  useEffect(() => {
    const checkForReview = async () => {
      if (currentThread?.openaiChatId) {
        try {
          const response = await fetch(`/api/reviews/${currentThread.openaiChatId}`);
          setHasReview(response.ok);
        } catch {
          setHasReview(false);
        }
      } else {
        setHasReview(false);
      }
    };
    
    checkForReview();
  }, [currentThread?.openaiChatId]);

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
            {hasReview && (
              <Button
                variant="outline"
                size="sm"
                onClick={loadReview}
                disabled={isLoadingReview}
                className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100 hover:border-blue-300"
                data-testid="view-review-button"
              >
                {isLoadingReview ? (
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                ) : (
                  <i className="fas fa-file-alt mr-2"></i>
                )}
                Ver Review
              </Button>
            )}
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
                    <p className="text-gray-800">Olá! Sou o assistente da Landeiro. Como posso ajudar você hoje?</p>
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

        {/* Message Input */}
        <MessageInput
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          error={error}
          onClearError={clearError}
        />
      </div>
      
      {/* Review Sidebar */}
      <ReviewSidebar
        review={currentReview}
        isOpen={isReviewSidebarOpen}
        onClose={() => {
          setIsReviewSidebarOpen(false);
          setCurrentReview(null);
        }}
      />
    </div>
  );
}
