import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useChat } from "@/hooks/useChat";
import { ChatMessage } from "@/components/ChatMessage";
import { ChatSidebar } from "@/components/ChatSidebar";
import { MessageInput } from "@/components/MessageInput";
import { ReviewSidebar } from "@/components/ReviewSidebar.tsx";
import type { ChatReview } from "@shared/schema";

export default function Chat() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [reviewSidebarOpen, setReviewSidebarOpen] = useState(false);
  const [currentReview, setCurrentReview] = useState<ChatReview | null>(null);
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
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

  // Check if current chat has a review
  const checkForReview = async (chatId: string) => {
    if (!chatId) return;
    
    try {
      const response = await fetch(`/api/reviews/${chatId}`);
      if (response.ok) {
        const review = await response.json();
        setCurrentReview(review);
      } else {
        setCurrentReview(null);
      }
    } catch (error) {
      console.error('Error checking for review:', error);
      setCurrentReview(null);
    }
  };

  // Check for review when thread changes
  useEffect(() => {
    if (currentThread?.id) {
      checkForReview(currentThread.id);
    } else {
      setCurrentReview(null);
    }
  }, [currentThread?.id]);

  // Finalize chat function
  const handleFinalizeChat = async () => {
    if (!currentThread?.id) return;
    
    setIsFinalizing(true);
    try {
      console.log('Finalizing chat for thread:', currentThread.id);
      
      const response = await fetch('https://n8nflowhook.goflow.digital/webhook/landeiro-chat-ia-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: currentThread.id
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const reviewData = await response.json();
      console.log('Review data received:', reviewData);
      
      // Extract and flatten the review data from response.output
      const output = reviewData.output;
      
      const transformedReview = {
        chatId: currentThread.id,
        resumoAtendimento: output.resumoAtendimento || '',
        feedbackDireto: output.feedbackDireto || '',
        sinaisPaciente: Array.isArray(output.sinaisPaciente) 
          ? output.sinaisPaciente.flat().filter(Boolean)
          : [],
        pontosPositivos: Array.isArray(output.pontosPositivos) 
          ? output.pontosPositivos.flat().filter(Boolean) 
          : [],
        pontosNegativos: Array.isArray(output.pontosNegativos) 
          ? output.pontosNegativos.flat().filter(Boolean)
          : []
      };
      
      // Save to database
      const saveResponse = await fetch('/api/reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transformedReview),
      });
      
      if (!saveResponse.ok) {
        throw new Error('Failed to save review');
      }
      
      const savedReview = await saveResponse.json();
      console.log('Review saved successfully');
      
      // Update local state
      setCurrentReview(savedReview);
      
      // Show sidebar with review
      setReviewSidebarOpen(true);
      
    } catch (error) {
      console.error('Error finalizing chat:', error);
    } finally {
      setIsFinalizing(false);
    }
  };

  // Load existing review
  const handleViewReview = async () => {
    if (!currentThread?.id || !currentReview) return;
    
    setIsLoadingReview(true);
    try {
      const response = await fetch(`/api/reviews/${currentThread.id}`);
      if (response.ok) {
        const review = await response.json();
        setCurrentReview(review);
        setReviewSidebarOpen(true);
      }
    } catch (error) {
      console.error('Error loading review:', error);
    } finally {
      setIsLoadingReview(false);
    }
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
            {currentReview ? (
              <Button
                onClick={handleViewReview}
                disabled={isLoadingReview}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2"
                data-testid="view-review-button"
              >
                {isLoadingReview ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Carregando...
                  </>
                ) : (
                  <>
                    <i className="fas fa-file-alt mr-2"></i>
                    Review do Atendimento
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleFinalizeChat}
                disabled={isFinalizing || !currentThread?.id || currentMessages.length === 0}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2"
                data-testid="finalize-chat-button"
              >
                {isFinalizing ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Finalizando...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check mr-2"></i>
                    Finalizar Atendimento
                  </>
                )}
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
          disabled={!!currentReview}
        />
      </div>
      
      {/* Review Sidebar */}
      <ReviewSidebar
        review={currentReview}
        isOpen={reviewSidebarOpen}
        onClose={() => setReviewSidebarOpen(false)}
      />
    </div>
  );
}
