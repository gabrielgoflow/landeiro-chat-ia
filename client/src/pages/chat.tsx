import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useIsMobile } from "@/hooks/use-mobile.jsx";
import { useAuth } from "@/hooks/useAuth.jsx";
import { useChat } from "@/hooks/useChat.jsx";
import { supabaseService } from "@/services/supabaseService.js";
import { supabase } from "@/lib/supabase.js";
import { ChatMessage } from "@/components/ChatMessage.jsx";
import { ChatSidebar } from "@/components/ChatSidebar.jsx";
import { ChatDebugInfo } from "@/components/ChatDebugInfo.jsx";
import { MessageInput } from "@/components/MessageInput.jsx";
import { NewChatDialog } from "@/components/NewChatDialog.jsx";
import { ReviewSidebar } from "@/components/ReviewSidebar";
import { SessionTabs } from "@/components/SessionTabs.jsx";
import iconPaciente from "@/images/icon-paciente.jpg";

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
  const [isCurrentSessionFinalized, setIsCurrentSessionFinalized] =
    useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [selectedSessaoNumber, setSelectedSessaoNumber] = useState(null);
  const [sessionTabsRefreshKey, setSessionTabsRefreshKey] = useState(0);
  const [maxSessionNumber, setMaxSessionNumber] = useState(0);
  const messagesEndRef = useRef(null);
  const lastChatIdRef = useRef(null);
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
    clearError,
  } = useChat();

  const currentChatId = selectedSessionId || currentThread?.id;
  const currentSessao = selectedSessaoNumber || currentThread?.sessionData?.sessao;

  // Função auxiliar para determinar o limite máximo de sessões baseado no diagnóstico
  const getMaxSessionsForDiagnostico = (diagnosticoCodigo) => {
    // Normalizar o código do diagnóstico para comparar (considerar ambos com e sem acento)
    const normalizedCodigo = diagnosticoCodigo?.toLowerCase()?.trim() || '';
    
    // Depressão tem limite de 14 sessões (contando com a sessão extra)
    if (normalizedCodigo === 'depressão' || normalizedCodigo === 'depressao') {
      return 14;
    }
    
    // Outros diagnósticos têm limite de 10 sessões
    return 10;
  };
  
  // Buscar número máximo de sessões do thread atual
  useEffect(() => {
    const fetchMaxSession = async () => {
      if (!threadId) {
        setMaxSessionNumber(0);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from("chat_threads")
          .select("sessao")
          .eq("thread_id", threadId)
          .order("sessao", { ascending: false })
          .limit(1)
          .single();
        
        if (error && error.code !== 'PGRST116') {
          console.error("Erro ao buscar sessão máxima:", error);
          return;
        }
        
        if (data) {
          setMaxSessionNumber(data.sessao || 0);
        }
      } catch (error) {
        console.error("Erro ao buscar sessão máxima:", error);
      }
    };
    
    fetchMaxSession();
  }, [threadId]);
  
  // Verificar se atingiu o limite de sessões
  const hasReachedMaxSessions = useMemo(() => {
    if (!currentThread || !currentThread.sessionData?.diagnostico || maxSessionNumber === 0) {
      return false;
    }
    const maxSessions = getMaxSessionsForDiagnostico(currentThread.sessionData.diagnostico);
    return maxSessionNumber >= maxSessions;
  }, [currentThread, maxSessionNumber]);

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
    // Permite re-inicialização quando lastChatIdRef foi limpo (nova conversa)
    if (lastChatIdRef.current === chatId && lastChatIdRef.current !== null) {
      return;
    }

    const initializeChat = async () => {
      console.log(
        "Initializing chat with chatId:",
        chatId,
        "| Last chatId:",
        lastChatIdRef.current,
      );
      lastChatIdRef.current = chatId;

      // Reset session finalized state when navigating
      setIsCurrentSessionFinalized(false);

      if (chatId === "new") {
        // Always show dialog for /chat/new
        console.log("Opening new chat dialog for /chat/new");
        setShowNewChatDialog(true);
        return;
      }

      if (chatId && chatId !== "new") {
        // Close any open dialog when loading specific chat
        setShowNewChatDialog(false);

        // Load specific chat by ID
        const existingThread = threads.find((t) => t.id === chatId);
        if (existingThread) {
          console.log("Found existing thread locally:", chatId);
          await selectThread(existingThread.id, 1); // Sempre seleciona a sessão 1 ao abrir
        } else {
          // Chat ID not found in current threads, try to load from Supabase
          console.log(
            "Thread not found locally, trying to load from Supabase:",
            chatId,
          );
          const createdThread = await createThreadFromSupabase(chatId);
          if (createdThread) {
            console.log(
              "Thread created from Supabase, now selecting:",
              createdThread.chat_id || chatId,
            );
            await selectThread(createdThread.chat_id || chatId, 1); // Sempre seleciona a sessão 1 ao abrir
          } else {
            console.warn(
              "Chat ID not found in Supabase, redirecting to new chat:",
              chatId,
            );
            setShowNewChatDialog(true);
          }
        }
      } else if (threads.length === 0 && !chatId) {
        // Show dialog when no threads exist and no chatId
        console.log("No threads found, showing new chat dialog");
        setShowNewChatDialog(true);
      }
    };

    initializeChat();
  }, [chatId]);

  // Extract threadId from current thread
  useEffect(() => {
    console.log('[DEBUG] Extract threadId - currentThread:', currentThread, 'currentChatId:', currentChatId);
    if (currentThread?.threadId) {
      console.log('[DEBUG] Setting threadId from currentThread.threadId:', currentThread.threadId);
      setThreadId(currentThread.threadId);
      setCurrentSessionData(currentThread.sessionData);
    } else if (currentThread?.id || currentChatId) {
      // Se não tem threadId no currentThread, buscar do Supabase
      const chatIdToSearch = currentThread?.id || currentChatId;
      console.log('[DEBUG] threadId não encontrado no currentThread, buscando do Supabase para chat_id:', chatIdToSearch);
      const fetchThreadId = async () => {
        try {
          // Primeiro tenta buscar com .single() (caso haja apenas um registro)
          let { data, error } = await supabase
            .from('chat_threads')
            .select('thread_id')
            .eq('chat_id', chatIdToSearch)
            .maybeSingle();
          
          // Se não encontrou com .single(), tenta buscar todos e pegar o primeiro
          if (!data && !error) {
            console.log('[DEBUG] Tentando buscar sem .single()...');
            const { data: allData, error: allError } = await supabase
              .from('chat_threads')
              .select('thread_id')
              .eq('chat_id', chatIdToSearch)
              .limit(1);
            
            if (allData && allData.length > 0) {
              data = allData[0];
              error = allError;
            }
          }
          
          if (data && !error) {
            console.log('[DEBUG] ✅ threadId encontrado no Supabase:', data.thread_id);
            setThreadId(data.thread_id);
          } else {
            console.warn('[DEBUG] ❌ Não foi possível encontrar thread_id no Supabase para chat_id:', chatIdToSearch, 'error:', error);
            setThreadId(null);
          }
        } catch (err) {
          console.error('[DEBUG] Erro ao buscar thread_id:', err);
          setThreadId(null);
        }
      };
      fetchThreadId();
    } else {
      console.log('[DEBUG] currentThread não tem threadId nem id, limpando threadId');
      setThreadId(null);
      setCurrentSessionData(null);
    }
  }, [currentThread, chatId, currentChatId]);

  // Check if current chat has a review - CONSOLIDADO e corrigido para usar sessão selecionada
  useEffect(() => {
    const checkForReview = async () => {
      // Reset estados primeiro
      setHasReview(false);
      setIsCurrentSessionFinalized(false);
      setCurrentReview(null);

      // Usa selectedSessionId e selectedSessaoNumber para verificar a sessão correta
      if (!selectedSessionId || !selectedSessaoNumber) {
        return;
      }

      const chatId = selectedSessionId;
      const sessao = selectedSessaoNumber;

      console.log("Checking review for SELECTED session:", { chatId, sessao });

      try {
        // Usa Supabase diretamente em vez de API dupla
        const { data: review, error } = await supabase
          .from("chat_reviews")
          .select("*")
          .eq("chat_id", chatId)
          .eq("sessao", sessao)
          .single();

        const hasReview = !!review && !error;

        if (hasReview) {
          console.log("Review found for selected session:", { chatId, sessao });
          setHasReview(true);
          setIsCurrentSessionFinalized(true);
          setCurrentReview(review);
          setIsFinalizingChat(false);
        } else {
          console.log("No review found for selected session:", {
            chatId,
            sessao,
          });
        }
      } catch (error) {
        console.error("Error checking review:", error);
      }
    };

    // Debounce para evitar execuções excessivas
    const timeoutId = setTimeout(checkForReview, 200);

    return () => clearTimeout(timeoutId);
  }, [selectedSessionId, selectedSessaoNumber]);

  // Function to load review for current chat - CORRIGIDO para usar sessão selecionada
  const loadReview = async () => {
    // Usa selectedSessionId e selectedSessaoNumber em vez de currentThread
    if (!selectedSessionId || !selectedSessaoNumber) {
      console.log("No selected session or session number:", {
        selectedSessionId,
        selectedSessaoNumber,
      });
      return;
    }

    const chatId = selectedSessionId;
    const sessao = selectedSessaoNumber;
    console.log("Loading review for SELECTED session:", { chatId, sessao });

    setIsLoadingReview(true);
    try {
      // Usa apenas Supabase, sem requisições duplicadas
      const { data: review, error } = await supabase
        .from("chat_reviews")
        .select("*")
        .eq("chat_id", chatId)
        .eq("sessao", sessao)
        .single();

      if (review && !error) {
        console.log(
          "Review loaded for selected session and showing sidebar:",
          review,
        );
        setCurrentReview(review);
        setShowReviewSidebar(true);
      } else {
        console.log("No review found for selected session:", {
          chatId,
          sessao,
        });
      }
    } catch (error) {
      console.error("Error loading review:", error);
    } finally {
      setIsLoadingReview(false);
    }
  };

  const handleSendMessage = async (message) => {
    await sendMessage(message);
  };

  const handleNewChatConfirm = async (formData) => {
    console.log("Creating new chat with formData:", formData);

    try {
      const newThread = await startNewThread(formData);
      setShowNewChatDialog(false);

      // Assim que tivermos o chatId, redirecionamos para a URL desse chat
      if (newThread && newThread.id) {
        const newChatId = newThread.id;
        console.log(
          "New thread created with chatId:",
          newChatId,
          "- Redirecting to URL",
        );

        // Limpa o estado anterior para permitir re-inicialização
        lastChatIdRef.current = null;

        // Incrementa refreshKey para forçar SessionTabs a recarregar
        setSessionTabsRefreshKey((prev) => prev + 1);

        // Redireciona IMEDIATAMENTE para a URL do novo chat
        navigate(`/chat/${newChatId}`);

        // Aguarda um pouco e força refresh novamente para garantir que as sessões sejam carregadas
        setTimeout(() => {
          setSessionTabsRefreshKey((prev) => prev + 1);
          const expectedPath = `/chat/${newChatId}`;
          if (window.location.pathname !== expectedPath) {
            console.log("URL não atualizada, forçando:", expectedPath);
            window.history.replaceState(null, "", expectedPath);
          }
        }, 500);

        console.log("Redirecionamento concluído para:", `/chat/${newChatId}`);
      } else {
        console.error(
          "Erro: Nova conversa criada mas sem chatId válido:",
          newThread,
        );
      }
    } catch (error) {
      console.error("Erro ao criar nova conversa:", error);
      setShowNewChatDialog(false);
    }
  };

  const handleFinalizeChat = async () => {
    if (!currentThread) return;

    setIsFinalizingChat(true);
    try {
      // Get review from external service
      const reviewResponse = await fetch(
        "https://n8nflowhook.goflow.digital/webhook/landeiro-chat-ia-review",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: currentThread.id,
            sessao: currentThread.sessionData?.sessao,
            diagnostico: currentThread.sessionData?.diagnostico,
          }),
        },
      );

      if (reviewResponse.ok) {
        const reviewData = await reviewResponse.json();
        console.log("Review data received:", reviewData);

        // Extract from output field and transform nested arrays to flat strings for storage
        const reviewOutput = reviewData.output;
        const transformedReview = {
          chatId: currentThread.id, // API espera camelCase
          resumoAtendimento: reviewOutput.resumoAtendimento,
          feedbackDireto: reviewOutput.feedbackDireto,
          sinaisPaciente: reviewOutput.sinaisPaciente.map((item) =>
            Array.isArray(item) ? item[0] : item,
          ),
          pontosPositivos: reviewOutput.pontosPositivos.map((item) =>
            Array.isArray(item) ? item[0] : item,
          ),
          pontosNegativos: reviewOutput.pontosNegativos.map((item) =>
            Array.isArray(item) ? item[0] : item,
          ),
          sessao: selectedSessaoNumber || currentThread.sessionData?.sessao,
        };

        // Save review to our database
        console.log(
          "Payload being sent to /api/reviews:",
          JSON.stringify(transformedReview, null, 2),
        );

        const saveResponse = await fetch("/api/reviews", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(transformedReview),
        });

        console.log("API response status:", saveResponse.status);
        if (!saveResponse.ok) {
          const errorText = await saveResponse.text();
          console.log("API error response:", errorText);
        }

        if (saveResponse.ok) {
          console.log("Review saved successfully");

          // Cria objeto com formato correto para o ReviewSidebar (snake_case)
          const reviewForSidebar = {
            id: null,
            chat_id: currentThread.id,
            resumo_atendimento: reviewOutput.resumoAtendimento,
            feedback_direto: reviewOutput.feedbackDireto,
            sinais_paciente: reviewOutput.sinaisPaciente.map((item) =>
              Array.isArray(item) ? item[0] : item,
            ),
            pontos_positivos: reviewOutput.pontosPositivos.map((item) =>
              Array.isArray(item) ? item[0] : item,
            ),
            pontos_negativos: reviewOutput.pontosNegativos.map((item) =>
              Array.isArray(item) ? item[0] : item,
            ),
            sessao: selectedSessaoNumber || currentThread.sessionData?.sessao,
            created_at: new Date().toISOString(),
          };

          console.log(
            "Setting currentReview with sidebar format:",
            reviewForSidebar,
          );

          // Atualiza estados imediatamente
          setCurrentReview(reviewForSidebar);
          setHasReview(true);
          setIsCurrentSessionFinalized(true);
          setShowReviewSidebar(true);

          console.log("ReviewSidebar should now be visible with data");
        } else {
          console.error("Error saving review:", saveResponse.status);
        }
      } else {
        console.error("Error getting review:", reviewResponse.status);
      }
    } catch (error) {
      console.error("Error finalizing chat:", error);
    } finally {
      setIsFinalizingChat(false);
    }
  };

  const handleStartNextSession = async () => {
    if (!currentThread) return;
    setIsStartingNextSession(true);
    try {
      // Inserir nova sessão para o mesmo chat_id
      const { data, error, newSession } =
        await supabaseService.incrementChatSession(currentThread.id);

      if (!error && newSession) {
        console.log(
          `Nova sessão criada: ${newSession} para chat_id: ${currentThread.id}`,
        );
        // Atualizar o estado local da sessão
        setCurrentSessionData((prev) => ({
          ...prev,
          sessao: newSession,
        }));
        if (currentThread.sessionData) {
          currentThread.sessionData.sessao = newSession;
        }
        setHasReview(false);
        setCurrentReview(null);
        setShowReviewSidebar(false);
        setIsCurrentSessionFinalized(false); // Nova sessão não está finalizada
        
        // Incrementa refreshKey para forçar SessionTabs a recarregar
        setSessionTabsRefreshKey((prev) => prev + 1);
        
        if (window.refreshSidebar) {
          await window.refreshSidebar();
        }
        
        // Aguarda um pouco e força refresh novamente para garantir que as sessões sejam carregadas
        setTimeout(() => {
          setSessionTabsRefreshKey((prev) => prev + 1);
        }, 500);
      } else {
        console.error("Erro ao criar nova sessão:", error);
      }
    } catch (error) {
      console.error("Erro ao criar nova sessão:", error);
    } finally {
      setIsStartingNextSession(false);
    }
  };

  // Handler para trocar de sessão nas abas
  const handleSessionChange = async (sessionChatId, sessao) => {
    setSelectedSessionId(sessionChatId);
    setSelectedSessaoNumber(sessao);

    // Atualizar o currentThread.sessionData.sessao imediatamente
    if (currentThread && currentThread.sessionData) {
      currentThread.sessionData.sessao = sessao;
    }

    await selectThread(sessionChatId, sessao); // Passa o número da sessão

    // Verificar se há review para o chat_id e sessao selecionados
    const { data: review, error } = await supabase
      .from("chat_reviews")
      .select("*")
      .eq("chat_id", sessionChatId)
      .eq("sessao", sessao)
      .single();
    const hasReviewForSession = !!review && !error;
    setIsCurrentSessionFinalized(hasReviewForSession);
    setHasReview(hasReviewForSession);
    setCurrentReview(hasReviewForSession ? review : null);

    navigate(`/chat/${sessionChatId}`);
  };

  // REMOVIDO: useEffect duplicado que estava causando loops
  // A verificação de review agora é feita apenas no useEffect consolidado acima

  // Handler para criar nova sessão das abas
  const handleNewSessionFromTabs = () => {
    handleStartNextSession();
  };

  // LOG DE DEPURAÇÃO - Inicializa selectedSessionId e selectedSessaoNumber ao carregar currentThread
  // IMPORTANTE: Este useEffect DEVE estar antes de qualquer return condicional
  useEffect(() => {
    console.log("[DEBUG] useEffect currentThread:", currentThread);
    if (currentThread?.id && currentThread?.sessionData?.sessao) {
      const newSessionId = currentThread.id;
      const newSessaoNumber = currentThread.sessionData.sessao;

      // Só atualiza se realmente mudou para evitar loops
      if (
        selectedSessionId !== newSessionId ||
        selectedSessaoNumber !== newSessaoNumber
      ) {
        console.log(
          "[DEBUG] Setando selectedSessionId e selectedSessaoNumber ao carregar currentThread:",
          newSessionId,
          newSessaoNumber,
        );
        setSelectedSessionId(newSessionId);
        setSelectedSessaoNumber(newSessaoNumber);
      }
    }
  }, [currentThread?.id, currentThread?.sessionData?.sessao]);

  // Proteção: só renderiza o conteúdo principal se currentThread estiver definido
  // Mas permite renderização quando é uma nova conversa ou dialog está aberto
  if (!currentThread && chatId !== "new" && !showNewChatDialog) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <span className="text-gray-500 text-lg">Carregando atendimento...</span>
      </div>
    );
  }
  return (
    <div className="flex h-screen overflow-hidden" data-testid="chat-page">
      <ChatSidebar
        currentThread={currentThread}
        onSelectThread={selectThread}
        onDeleteThread={deleteThread}
        onStartNewThread={startNewThread}
        onNewChatConfirm={handleNewChatConfirm}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="bg-white border-b border-gray-200 px-2 sm:px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <div className="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto">
              <Button
                variant="ghost"
                size="sm"
                className="p-1.5 sm:p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                data-testid="back-to-chats-button"
                onClick={() => navigate("/chats")}
              >
                <i className="fas fa-arrow-left mr-1 sm:mr-2 text-sm"></i>
                <span className="text-xs sm:text-sm">Voltar</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden p-1.5 sm:p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                data-testid="open-sidebar-button"
              >
                <i className="fas fa-bars text-sm"></i>
              </Button>
              <Avatar className="w-6 h-6 sm:w-8 sm:h-8 bg-secondary flex-shrink-0">
                <AvatarFallback className="bg-secondary text-white">
                  <img src="https://nexialab.com.br/wp-content/uploads/2025/10/cropped-favicon-1.png" alt="Logo" className="w-3 h-3 sm:w-4 sm:h-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 sm:flex-initial min-w-0">
                <h2 className="text-sm sm:text-lg font-semibold text-gray-900 truncate">
                  Paciente IA
                </h2>
                <p className="text-xs sm:text-sm text-gray-500 truncate">
                  Online • Responde instantaneamente
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-1.5 sm:space-x-2 w-full sm:w-auto justify-end">
            {/* Conditional review button - only shows when review exists */}
            {hasReview && (
              <>
                <Button
                  onClick={loadReview}
                  disabled={isLoadingReview}
                  className="bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 hover:border-green-300 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                  data-testid="view-review-button"
                >
                  {isLoadingReview ? (
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                  ) : (
                    <i className="fas fa-file-alt mr-2"></i>
                  )}
                  Ver Review
                </Button>

                {hasReachedMaxSessions ? (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium">
                    <i className="fas fa-check-circle mr-2"></i>
                    Protocolo concluído!
                  </div>
                ) : (
                  <Button
                    onClick={handleStartNextSession}
                    disabled={isStartingNextSession}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors"
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
                )}
              </>
            )}

            {currentThread && !hasReview && (
              <Button
                onClick={handleFinalizeChat}
                disabled={isFinalizingChat}
                  className="bg-green-600 hover:bg-green-700 text-white px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors"
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

        {/* Session Tabs - show if we have threadId OR currentChatId (para casos onde thread_id está vazio) */}
        {(threadId || currentChatId) && (
          <SessionTabs
            threadId={threadId}
            currentChatId={currentChatId}
            onSessionChange={handleSessionChange}
            onNewSession={handleNewSessionFromTabs}
            className="border-b"
            refreshKey={sessionTabsRefreshKey}
          />
        )}

        {/* Messages Container */}
        <div
          className="flex-1 overflow-y-auto px-2 sm:px-4 py-3 sm:py-6 min-h-0"
          data-testid="messages-container"
        >
          <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
            {/* Welcome Message */}
            {currentMessages.length === 0 && (
              <div className="flex items-start space-x-3">
                <Avatar className="w-8 h-8 bg-secondary flex-shrink-0">
                  <AvatarFallback className="bg-gray-300 text-gray-600 p-0">
                    <img src={iconPaciente} alt="Paciente" className="w-full h-full object-cover rounded-full" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="bg-ai-message rounded-2xl rounded-tl-md px-3 sm:px-4 py-2 sm:py-3 max-w-md">
                    <p className="text-sm sm:text-base text-gray-800">
                      Olá! Podemos iniciar nossa sessão?
                    </p>
                  </div>
                  <div className="text-[10px] sm:text-xs text-gray-500 mt-1 ml-1">
                    Agora mesmo
                  </div>
                </div>
              </div>
            )}

            {/* Chat Messages */}
            {currentMessages.map((message) => (
              <ChatMessage key={message.id} message={message} />
            ))}

            {/* Loading Message */}
            {isLoading && (
              <div
                className="flex items-start space-x-3"
                data-testid="loading-message"
              >
                <Avatar className="w-8 h-8 bg-secondary flex-shrink-0">
                  <AvatarFallback className="bg-gray-300 text-gray-600 p-0">
                    <img src={iconPaciente} alt="Paciente" className="w-full h-full object-cover rounded-full" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="bg-ai-message rounded-2xl rounded-tl-md px-4 py-3 max-w-md">
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                        <div
                          className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"
                          style={{ animationDelay: "0.1s" }}
                        ></div>
                        <div
                          className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"
                          style={{ animationDelay: "0.2s" }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-500">
                        Digitando...
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Debug Info (Admin only) */}
        {user?.email && ["admin@goflow.digital", "admin@nexialab.com.br"].includes(user.email) && (
          <div className="px-2 sm:px-4 pb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDebug(!showDebug)}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              <i className="fas fa-bug mr-1"></i>
              {showDebug ? "Ocultar Debug" : "Mostrar Debug"}
            </Button>
          </div>
        )}

        <ChatDebugInfo
          currentThread={currentThread}
          sessionData={currentThread?.sessionData}
          visible={showDebug}
        />

        {/* Message Input */}
        {console.log(
          "DEBUG: isCurrentSessionFinalized:",
          isCurrentSessionFinalized,
          "| Sessão atual:",
          currentThread?.sessionData?.sessao,
        )}
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
