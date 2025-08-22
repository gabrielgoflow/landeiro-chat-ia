import { useState, useEffect, useRef } from "react";
import { useParams, Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useIsMobile } from "@/hooks/use-mobile.jsx";
import { useAuth } from "@/hooks/useAuth.jsx";
import { useChat } from "@/hooks/useChat.jsx";
import { supabaseService } from "@/services/supabaseService.js";
import { ChatMessage } from "@/components/ChatMessage.jsx";
import { ChatSidebar } from "@/components/ChatSidebar.jsx";
import { ChatDebugInfo } from "@/components/ChatDebugInfo.jsx";
import { MessageInput } from "@/components/MessageInput.jsx";
import { NewChatDialog } from "@/components/NewChatDialog.jsx";
import { ReviewSidebar } from "@/components/ReviewSidebar";
import { SessionTabs } from "@/components/SessionTabs.jsx";

export default function Chat() {
  const { chatId } = useParams();
  const [location, navigate] = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [isFinalizingChat, setIsFinalizingChat] = useState(false);
  const [showReviewSidebar, setShowReviewSidebar] = useState(false);
  const [currentReview, setCurrentReview] = useState(null);
  const [isLoadingReview, setIsLoadingReview] = useState(false);
  const [hasReview, setHasReview] = useState(false);
  const [isStartingNextSession, setIsStartingNextSession] = useState(false);
  const [currentSessionData, setCurrentSessionData] = useState(null);
  const [threadId, setThreadId] = useState(null);
  const [isCurrentSessionFinalized, setIsCurrentSessionFinalized] = useState(false);
  const messagesEndRef = useRef(null);
  const initializedRef = useRef(false);
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
    createThreadFromSupabase,
    reloadThread,
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
    const initializeChat = async () => {
      // Reset session finalized state when navigating
      setIsCurrentSessionFinalized(false);
      
      if (chatId && chatId !== 'new') {
        // Load specific chat by ID
        const existingThread = threads.find(t => t.id === chatId);
        if (existingThread) {
          console.log('Found existing thread locally:', chatId);
          selectThread(existingThread.id);
        } else {
          // Chat ID not found in current threads, try to load from Supabase
          console.log('Thread not found locally, trying to load from Supabase:', chatId);
          const createdThread = await createThreadFromSupabase(chatId);
          if (createdThread) {
            console.log('Thread created from Supabase, now selecting:', chatId);
            selectThread(chatId);
          } else {
            console.warn('Chat ID not found in Supabase, redirecting to new chat:', chatId);
            setShowNewChatDialog(true);
          }
        }
      } else if (chatId === 'new' || (threads.length === 0 && !chatId)) {
        // Create new thread for /chat/new or when no threads exist
        setShowNewChatDialog(true);
      }
    };

    if (!initializedRef.current) {
      initializedRef.current = true;
      initializeChat();
    }
  }, [chatId, threads, selectThread, startNewThread, createThreadFromSupabase]);

  // Extract threadId from current thread
  useEffect(() => {
    if (currentThread?.threadId) {
      setThreadId(currentThread.threadId);
      setCurrentSessionData(currentThread.sessionData);
    } else {
      setThreadId(null);
      setCurrentSessionData(null);
    }
  }, [currentThread]);

  // Check if current chat has a review
  useEffect(() => {
    const checkForReview = async () => {
      if (currentThread?.openaiChatId || currentThread?.id) {
        const chatId = currentThread.openaiChatId || currentThread.id;
        console.log('Checking review for chatId:', chatId);
        try {
          const response = await fetch(`/api/reviews/${chatId}`);
          console.log('Review check response:', response.status);
          const reviewExists = response.ok;
          setHasReview(reviewExists);
          
          // Se há review, garante que os estados estão corretos
          if (reviewExists) {
            console.log('Review found - setting chat as finalized');
            setIsFinalizingChat(false); // Garantir que não está em processo de finalização
          }
        } catch (error) {
          console.error('Error checking review:', error);
          setHasReview(false);
        }
      } else {
        console.log('No chatId found in currentThread:', currentThread);
        setHasReview(false);
      }
    };
    
    checkForReview();
  }, [currentThread?.openaiChatId, currentThread?.id]);

  // Function to load review for current chat
  const loadReview = async () => {
    const chatId = currentThread?.openaiChatId || currentThread?.id || 'thread_1755278578584_qwcovo1vb';
    console.log('Trying to load review for chatId:', chatId);
    
    setIsLoadingReview(true);
    try {
      const response = await fetch(`/api/reviews/${chatId}`);
      console.log('Review response status:', response.status);
      if (response.ok) {
        const review = await response.json();
        console.log('Review loaded:', review);
        setCurrentReview(review);
        setShowReviewSidebar(true);
      } else {
        console.log('No review found for chat ID:', chatId);
        // Try with test ID
        const testResponse = await fetch('/api/reviews/thread_1755278578584_qwcovo1vb');
        if (testResponse.ok) {
          const testReview = await testResponse.json();
          console.log('Test review loaded:', testReview);
          setCurrentReview(testReview);
          setShowReviewSidebar(true);
        }
      }
    } catch (error) {
      console.error('Error loading review:', error);
    } finally {
      setIsLoadingReview(false);
    }
  };



  const handleSendMessage = async (message) => {
    await sendMessage(message);
  };

  const handleNewChatConfirm = (formData) => {
    startNewThread(formData);
    setShowNewChatDialog(false);
  };

  const handleFinalizeChat = async () => {
    if (!currentThread) return;
    
    setIsFinalizingChat(true);
    try {
      // Get review from external service
      const reviewResponse = await fetch('https://n8nflowhook.goflow.digital/webhook/landeiro-chat-ia-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: currentThread.id
        })
      });
      
      if (reviewResponse.ok) {
        const reviewData = await reviewResponse.json();
        console.log('Review data received:', reviewData);
        
        // Extract from output field and transform nested arrays to flat strings for storage
        const reviewOutput = reviewData.output;
        const transformedReview = {
          chatId: currentThread.id,
          resumoAtendimento: reviewOutput.resumoAtendimento,
          feedbackDireto: reviewOutput.feedbackDireto,
          sinaisPaciente: reviewOutput.sinaisPaciente.map(item => Array.isArray(item) ? item[0] : item),
          pontosPositivos: reviewOutput.pontosPositivos.map(item => Array.isArray(item) ? item[0] : item),
          pontosNegativos: reviewOutput.pontosNegativos.map(item => Array.isArray(item) ? item[0] : item)
        };
        
        // Save review to our database
        const saveResponse = await fetch('/api/reviews', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(transformedReview)
        });
        
        if (saveResponse.ok) {
          console.log('Review saved successfully');
          setCurrentReview(transformedReview);
          setShowReviewSidebar(true);
          setHasReview(true); // Atualizar estado para indicar que tem review
        } else {
          console.error('Error saving review:', saveResponse.status);
        }
      } else {
        console.error('Error getting review:', reviewResponse.status);
      }
    } catch (error) {
      console.error('Error finalizing chat:', error);
    } finally {
      setIsFinalizingChat(false);
    }
  };

  const handleStartNextSession = async () => {
    if (!currentThread) return;
    
    setIsStartingNextSession(true);
    try {
      // Criar uma nova sessão com um novo chat_id
      const { data, error, newChatId, newSession } = await supabaseService.createNextSession(
        currentThread.threadId, // thread_id do OpenAI
        currentThread.sessionData.diagnostico,
        currentThread.sessionData.protocolo
      );
      
      if (!error && newChatId && newSession) {
        console.log(`New session ${newSession} created with chat_id: ${newChatId}`);
        
        // Criar novo thread local
        const newThread = {
          id: newChatId,
          title: `${currentThread.sessionData.diagnostico} - ${currentThread.sessionData.protocolo.toUpperCase()}`,
          threadId: currentThread.threadId, // Mesmo thread_id do OpenAI
          openaiChatId: newChatId,
          sessionData: {
            ...currentThread.sessionData,
            sessao: newSession
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        // Limpar estado local primeiro
        setHasReview(false);
        setCurrentReview(null);
        setShowReviewSidebar(false);
        setIsCurrentSessionFinalized(false); // Nova sessão não está finalizada
        
        // Navegar para o novo chat
        navigate(`/chat/${newChatId}`);
        
        // Forçar reload do thread para garantir sincronização
        setTimeout(() => {
          reloadThread(newChatId);
        }, 100);
        
      } else {
        console.error('Error starting next session:', error);
      }
    } catch (error) {
      console.error('Error starting next session:', error);
    } finally {
      setIsStartingNextSession(false);
    }
  }

  // Handler para trocar de sessão nas abas
  const handleSessionChange = (sessionChatId) => {
    console.log('Changing to session:', sessionChatId);
    
    // Primeiro, limpar todas as mensagens da tela para evitar confusão visual
    // Isso força uma renderização limpa antes de carregar a nova sessão
    
    // Navegar para a nova sessão
    navigate(`/chat/${sessionChatId}`);
  };

  // Detect if current session is finalized based on review (one-time check only)
  useEffect(() => {
    const checkSessionStatus = async () => {
      if (!chatId || chatId === 'new') {
        setIsCurrentSessionFinalized(false);
        return;
      }

      try {
        const response = await fetch(`/api/reviews/${chatId}`);
        if (response.ok) {
          const reviewData = await response.json();
          console.log('Review found - setting chat as finalized');
          setIsCurrentSessionFinalized(!!reviewData);
          setHasReview(!!reviewData);
          if (reviewData) {
            setCurrentReview(reviewData);
          }
        } else if (response.status === 404) {
          setIsCurrentSessionFinalized(false);
          setHasReview(false);
          setCurrentReview(null);
        }
      } catch (error) {
        console.error('Error checking session status:', error);
        setIsCurrentSessionFinalized(false);
      }
    };

    // Only check once when chatId changes
    checkSessionStatus();
  }, [chatId]);

  // Handler para criar nova sessão das abas
  const handleNewSessionFromTabs = () => {
    handleStartNextSession();
  };

  return (
    <div className="flex h-screen overflow-hidden" data-testid="chat-page">
      <ChatSidebar
        threads={threads}
        currentThread={currentThread}
        messages={allMessages}
        onSelectThread={selectThread}
        onDeleteThread={deleteThread}
        onStartNewThread={() => setShowNewChatDialog(true)}
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
              <h2 className="text-lg font-semibold text-gray-900">Paciente IA</h2>
              <p className="text-sm text-gray-500">Online • Responde instantaneamente</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {/* Conditional review button - only shows when review exists */}
            {hasReview && (
              <>
                <Button
                  onClick={loadReview}
                  disabled={isLoadingReview}
                  className="bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 hover:border-green-300 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                  data-testid="view-review-button"
                >
                  {isLoadingReview ? (
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                  ) : (
                    <i className="fas fa-file-alt mr-2"></i>
                  )}
                  Ver Review
                </Button>
                
                <Button
                  onClick={handleStartNextSession}
                  disabled={isStartingNextSession}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  data-testid="start-next-session-button"
                >
                  {isStartingNextSession ? (
                    <>
                      <i className="fas fa-spinner fa-spin mr-2"></i>
                      Iniciando...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-play mr-2"></i>
                      Iniciar Próxima Sessão
                    </>
                  )}
                </Button>
              </>
            )}
            
            {currentThread && !hasReview && (
              <Button
                onClick={handleFinalizeChat}
                disabled={isFinalizingChat}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                data-testid="finalize-chat-button"
              >
                {isFinalizingChat ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Finalizando...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check-circle mr-2"></i>
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

        {/* Session Tabs - only show if we have a threadId */}
        {threadId && (
          <SessionTabs
            threadId={threadId}
            currentChatId={currentThread?.id}
            onSessionChange={handleSessionChange}
            onNewSession={handleNewSessionFromTabs}
            className="border-b"
          />
        )}

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
          isFinalized={isCurrentSessionFinalized}
        />
      </div>
      
      <NewChatDialog
        open={showNewChatDialog}
        onOpenChange={setShowNewChatDialog}
        onConfirm={handleNewChatConfirm}
      />
      
      <ReviewSidebar
        review={currentReview}
        isOpen={showReviewSidebar}
        onClose={() => setShowReviewSidebar(false)}
      />
    </div>
  );
}