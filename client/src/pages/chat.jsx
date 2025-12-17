import { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { useSessionTimer } from "@/hooks/useSessionTimer";
import { SessionTimer } from "@/components/SessionTimer";
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
  const [isCurrentSessionFinalized, setIsCurrentSessionFinalized] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [selectedSessaoNumber, setSelectedSessaoNumber] = useState(null);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [maxSessionNumber, setMaxSessionNumber] = useState(0);
  
  // Usar useCallback para evitar recriação da função e loops
  const handlePauseChange = useCallback((paused) => {
    setIsTimerPaused(paused);
  }, []);
  const messagesEndRef = useRef(null);
  const lastChatIdRef = useRef(null);
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { toast } = useToast();

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
  
  // Verificar se atingiu o limite de sessões (será movido para depois da declaração de currentSessao)

  // Timer da sessão - buscar session_started_at da sessão atual
  // Memoizado para evitar recálculos desnecessários
  const sessionStartedAt = useMemo(() => {
    if (selectedSessionId && currentThread?.sessionData?.sessionStartedAt) {
      return currentThread.sessionData.sessionStartedAt;
    }
    // Se não tem no currentThread, buscar diretamente do Supabase
    return null;
  }, [selectedSessionId, currentThread?.sessionData?.sessionStartedAt]);
  
  const currentChatId = selectedSessionId || currentThread?.id;
  const currentSessao = selectedSessaoNumber || currentThread?.sessionData?.sessao;
  
  // Buscar número máximo de sessões do thread atual (movido para depois da declaração de currentSessao)
  useEffect(() => {
    const fetchMaxSession = async () => {
      // Usar threadId do estado ou do currentThread
      const threadIdToUse = threadId || currentThread?.threadId;
      
      if (!threadIdToUse) {
        console.log('[DEBUG] fetchMaxSession: threadId não definido, resetando maxSessionNumber');
        setMaxSessionNumber(0);
        return;
      }
      
      try {
        console.log('[DEBUG] fetchMaxSession: Buscando sessão máxima para threadId:', threadIdToUse);
        const { data, error } = await supabase
          .from("chat_threads")
          .select("sessao")
          .eq("thread_id", threadIdToUse)
          .order("sessao", { ascending: false })
          .limit(1)
          .single();
        
        if (error && error.code !== 'PGRST116') {
          console.error("[DEBUG] fetchMaxSession: Erro ao buscar sessão máxima:", error);
          // Se não encontrou, tentar usar a sessão atual como fallback
          const sessaoAtual = currentSessao || currentThread?.sessionData?.sessao;
          if (sessaoAtual) {
            console.log('[DEBUG] fetchMaxSession: Usando sessão atual como fallback:', sessaoAtual);
            setMaxSessionNumber(sessaoAtual);
          }
          return;
        }
        
        if (data) {
          console.log('[DEBUG] fetchMaxSession: Sessão máxima encontrada:', data.sessao);
          setMaxSessionNumber(data.sessao || 0);
        } else {
          const sessaoAtual = currentSessao || currentThread?.sessionData?.sessao;
          console.log('[DEBUG] fetchMaxSession: Nenhuma sessão encontrada, usando sessão atual:', sessaoAtual);
          setMaxSessionNumber(sessaoAtual || 0);
        }
      } catch (error) {
        console.error("[DEBUG] fetchMaxSession: Erro ao buscar sessão máxima:", error);
        // Fallback para sessão atual
        const sessaoAtual = currentSessao || currentThread?.sessionData?.sessao;
        if (sessaoAtual) {
          setMaxSessionNumber(sessaoAtual);
        }
      }
    };
    
    fetchMaxSession();
  }, [threadId, currentThread?.threadId, currentSessao, currentThread?.sessionData?.sessao]);
  
  // Verificar se atingiu o limite de sessões
  const hasReachedMaxSessions = useMemo(() => {
    // Usar a sessão atual se maxSessionNumber não estiver disponível
    const sessionNumberToCheck = maxSessionNumber > 0 ? maxSessionNumber : (currentSessao || currentThread?.sessionData?.sessao);
    
    if (!currentThread || !currentThread.sessionData?.diagnostico) {
      console.log('[DEBUG] hasReachedMaxSessions: Condições não atendidas - sem currentThread ou diagnostico', {
        hasCurrentThread: !!currentThread,
        diagnostico: currentThread?.sessionData?.diagnostico,
      });
      return false;
    }
    
    if (!sessionNumberToCheck || sessionNumberToCheck === 0) {
      console.log('[DEBUG] hasReachedMaxSessions: Condições não atendidas - sem número de sessão', {
        maxSessionNumber,
        currentSessao,
        sessaoFromThread: currentThread?.sessionData?.sessao,
        sessionNumberToCheck
      });
      return false;
    }
    
    const maxSessions = getMaxSessionsForDiagnostico(currentThread.sessionData.diagnostico);
    const reached = sessionNumberToCheck >= maxSessions;
    console.log('[DEBUG] hasReachedMaxSessions: Verificação FINAL', {
      sessionNumberToCheck,
      maxSessions,
      diagnostico: currentThread.sessionData.diagnostico,
      reached,
      maxSessionNumber,
      currentSessao,
      sessaoFromThread: currentThread?.sessionData?.sessao
    });
    return reached;
  }, [currentThread, maxSessionNumber, currentSessao]);
  
  const { timeRemaining, isExpired: isSessionExpired } = useSessionTimer(
    currentChatId,
    sessionStartedAt,
    currentSessao
  );

  // Debug logs - removido para evitar logs excessivos em produção
  // console.log("Chat component state:", {
  //   chatId,
  //   threads: threads.length,
  //   currentThread: currentThread?.id,
  //   showNewChatDialog,
  //   user: user?.id,
  // });

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
      console.log('Initializing chat with chatId:', chatId, '| Last chatId:', lastChatIdRef.current);
      lastChatIdRef.current = chatId;
      
      // Reset session finalized state when navigating
      setIsCurrentSessionFinalized(false);
      
      if (chatId === 'new') {
        // Always show dialog for /chat/new
        console.log('Opening new chat dialog for /chat/new');
        setShowNewChatDialog(true);
        return;
      }
      
      if (chatId && chatId !== 'new') {
        // Close any open dialog when loading specific chat
        setShowNewChatDialog(false);
        
        // Load specific chat by ID
        const existingThread = threads.find((t) => t.id === chatId);
        if (existingThread) {
          console.log('Found existing thread locally:', chatId);
          // Usa a sessão do thread existente, ou 1 se não tiver sessão definida
          const sessao = existingThread.sessionData?.sessao || 1;
          await selectThread(existingThread.id, sessao);
        } else {
          // Chat ID not found in current threads, try to load from Supabase
          console.log(
            "Thread not found locally, trying to load from Supabase:",
            chatId,
          );
          const createdThread = await createThreadFromSupabase(chatId);
          if (createdThread) {
            console.log('Thread created from Supabase, now selecting:', createdThread.chat_id || chatId);
            // Usa a sessão do thread criado (que já é a mais recente)
            const sessao = createdThread.sessionData?.sessao || 1;
            await selectThread(createdThread.chat_id || chatId, sessao);
          } else {
            console.warn(
              "Chat ID not found in Supabase, redirecting to new chat:",
              chatId,
            );
            // Só abre o dialog se realmente não encontrou o chat
            setShowNewChatDialog(true);
          }
        }
      } else if (threads.length === 0 && !chatId && !currentThread) {
        // Show dialog when no threads exist and no chatId and no currentThread
        // Mas só se não estivermos no meio de uma operação de nova sessão
        if (!isStartingNextSession) {
          console.log('No threads found, showing new chat dialog');
          setShowNewChatDialog(true);
        }
      }
    };

    initializeChat();
  }, [chatId, threads.length, currentThread?.id, isStartingNextSession]);

  // Extract threadId from current thread
  const lastThreadIdSearchRef = useRef(null);
  const isFetchingThreadIdRef = useRef(false);
  
  useEffect(() => {
    // Evitar chamadas duplicadas
    if (isFetchingThreadIdRef.current) {
      console.log('[DEBUG] Extract threadId: Já está buscando, ignorando chamada duplicada');
      return;
    }

    const chatIdToSearch = currentThread?.id || selectedSessionId || currentThread?.id;
    const searchKey = `${currentThread?.id || ''}-${currentThread?.threadId || ''}`;
    
    // Verificar se já buscamos para este chat_id
    if (lastThreadIdSearchRef.current === searchKey) {
      console.log('[DEBUG] Extract threadId: Já buscamos para este chat, ignorando');
      return;
    }

    console.log('[DEBUG] Extract threadId - currentThread:', currentThread, 'chatIdToSearch:', chatIdToSearch);
    
    if (currentThread?.threadId) {
      console.log('[DEBUG] ✅ Setting threadId from currentThread.threadId:', currentThread.threadId);
      setThreadId(currentThread.threadId);
      setCurrentSessionData(currentThread.sessionData);
      lastThreadIdSearchRef.current = searchKey;
    } else if (chatIdToSearch) {
      // Se não tem threadId no currentThread, buscar do Supabase
      console.log('[DEBUG] 🔍 threadId não encontrado no currentThread, buscando do Supabase para chat_id:', chatIdToSearch);
      isFetchingThreadIdRef.current = true;
      lastThreadIdSearchRef.current = searchKey;
      
      const fetchThreadId = async () => {
        try {
          // Buscar thread_id usando o chat_id
          const { data, error } = await supabase
            .from('chat_threads')
            .select('thread_id, chat_id, sessao')
            .eq('chat_id', chatIdToSearch)
            .maybeSingle();
          
          console.log('[DEBUG] Resultado da busca no Supabase:', { data, error, chatIdToSearch });
          
          if (data && data.thread_id && !error) {
            console.log('[DEBUG] ✅ threadId encontrado no Supabase:', data.thread_id, 'para chat_id:', data.chat_id, 'sessao:', data.sessao);
            setThreadId(data.thread_id);
          } else {
            // Se não encontrou thread_id, pode estar vazio (caso de múltiplas sessões com mesmo chat_id)
            console.log('[DEBUG] ⚠️ thread_id não encontrado ou vazio para chat_id:', chatIdToSearch, '- SessionTabs buscará por chat_id');
            setThreadId(null);
          }
        } catch (err) {
          console.error('[DEBUG] ❌ Erro ao buscar thread_id:', err);
          setThreadId(null);
        } finally {
          isFetchingThreadIdRef.current = false;
        }
      };
      fetchThreadId();
    } else {
      console.log('[DEBUG] currentThread não tem threadId nem id, limpando threadId');
      setThreadId(null);
      setCurrentSessionData(null);
      lastThreadIdSearchRef.current = searchKey;
    }
  }, [currentThread?.id, currentThread?.threadId, selectedSessionId]);

  // Check if current chat has a review - CONSOLIDADO e corrigido para usar sessão selecionada
  const lastReviewCheckRef = useRef(null);
  const isCheckingReviewRef = useRef(false);
  
  useEffect(() => {
    // Evitar execuções duplicadas
    if (isCheckingReviewRef.current) {
      return;
    }
    
    const checkKey = `${selectedSessionId}-${selectedSessaoNumber}`;
    if (lastReviewCheckRef.current === checkKey) {
      return;
    }
    
    const checkForReview = async () => {
      // Reset estados primeiro
      setHasReview(false);
      setIsCurrentSessionFinalized(false);
      setCurrentReview(null);
      
      // Usa selectedSessionId e selectedSessaoNumber para verificar a sessão correta
      if (!selectedSessionId || !selectedSessaoNumber) {
        lastReviewCheckRef.current = checkKey;
        return;
      }

      const chatId = selectedSessionId;
      const sessao = selectedSessaoNumber;
      
      isCheckingReviewRef.current = true;
      
      try {
        // Usa Supabase diretamente em vez de API dupla
        const { data: review, error } = await supabase
          .from('chat_reviews')
          .select('*')
          .eq('chat_id', chatId)
          .eq('sessao', sessao)
          .single();
          
        const hasReview = !!review && !error;
        
        if (hasReview) {
          setHasReview(true);
          setIsCurrentSessionFinalized(true);
          setCurrentReview(review);
          setIsFinalizingChat(false);
        }
        
        lastReviewCheckRef.current = checkKey;
      } catch (error) {
        console.error('Error checking review:', error);
        lastReviewCheckRef.current = checkKey;
      } finally {
        isCheckingReviewRef.current = false;
      }
    };
    
    // Debounce para evitar execuções excessivas
    const timeoutId = setTimeout(checkForReview, 200);
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [selectedSessionId, selectedSessaoNumber]);

  // Function to load review for current chat - CORRIGIDO para usar sessão selecionada
  const loadReview = async () => {
    // Usa selectedSessionId e selectedSessaoNumber em vez de currentThread
    if (!selectedSessionId || !selectedSessaoNumber) {
      console.log('No selected session or session number:', { selectedSessionId, selectedSessaoNumber });
      return;
    }

    const chatId = selectedSessionId;
    const sessao = selectedSessaoNumber;
    console.log('Loading review for SELECTED session:', { chatId, sessao });
    
    setIsLoadingReview(true);
    try {
      // Usa apenas Supabase, sem requisições duplicadas
      const { data: review, error } = await supabase
        .from('chat_reviews')
        .select('*')
        .eq('chat_id', chatId)
        .eq('sessao', sessao)
        .single();

      if (review && !error) {
        console.log('Review loaded for selected session and showing sidebar:', review);
        setCurrentReview(review);
        setShowReviewSidebar(true);
      } else {
        console.log('No review found for selected session:', { chatId, sessao });
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
    console.log('Creating new chat with formData:', formData);
    
    try {
      const newThread = await startNewThread(formData);
      setShowNewChatDialog(false);
      
      // Assim que tivermos o chatId, redirecionamos para a URL desse chat
      if (newThread && newThread.id) {
        const newChatId = newThread.id;
        console.log('New thread created with chatId:', newChatId, '- Redirecting to URL');
        
        // Limpa o estado anterior para permitir re-inicialização
        lastChatIdRef.current = null;
        
        // Redireciona IMEDIATAMENTE para a URL do novo chat
        navigate(`/chat/${newChatId}`);
        
        // Força atualização da URL se necessário (backup)
        setTimeout(() => {
          const expectedPath = `/chat/${newChatId}`;
          if (window.location.pathname !== expectedPath) {
            console.log('URL não atualizada, forçando:', expectedPath);
            window.history.replaceState(null, '', expectedPath);
            // Força re-render se necessário
            window.location.reload();
          }
        }, 200);
        
        console.log('Redirecionamento concluído para:', `/chat/${newChatId}`);
      } else {
        console.error('Erro: Nova conversa criada mas sem chatId válido:', newThread);
      }
    } catch (error) {
      console.error('Erro ao criar nova conversa:', error);
      setShowNewChatDialog(false);
    }
  };

  const handleFinalizeChat = async () => {
    if (!currentThread) return;

    setIsFinalizingChat(true);
    try {
      // Usa currentSessao que leva em conta selectedSessaoNumber
      const sessaoToUse = currentSessao || currentThread.sessionData?.sessao;
      
      // Validar que sessao está definida
      if (!sessaoToUse || sessaoToUse === undefined || sessaoToUse === null) {
        console.error("Erro: sessao não está definida. currentSessao:", currentSessao, "sessionData.sessao:", currentThread.sessionData?.sessao);
        alert("Erro: Não foi possível determinar o número da sessão. Por favor, tente novamente.");
        setIsFinalizingChat(false);
        return;
      }
      
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
            sessao: sessaoToUse,
            diagnostico: currentThread.sessionData?.diagnostico,
          }),
        },
      );

      if (reviewResponse.ok) {
        const reviewData = await reviewResponse.json();
        console.log("Review data received:", reviewData);

        // Extract from output field and transform nested arrays to flat strings for storage
        const reviewOutput = reviewData.output;
        
        // Função auxiliar para achatar arrays aninhados recursivamente
        const flattenArray = (arr) => {
          if (!Array.isArray(arr)) return [arr];
          const result = [];
          for (const item of arr) {
            if (Array.isArray(item)) {
              result.push(...flattenArray(item));
            } else {
              result.push(item);
            }
          }
          return result.filter(item => item !== null && item !== undefined && item !== '');
        };
        
        const transformedReview = {
          chatId: currentThread.id,  // API espera camelCase
          resumoAtendimento: reviewOutput.resumoAtendimento || '',
          feedbackDireto: reviewOutput.feedbackDireto || '',
          sinaisPaciente: flattenArray(reviewOutput.sinaisPaciente || []),
          pontosPositivos: flattenArray(reviewOutput.pontosPositivos || []),
          pontosNegativos: flattenArray(reviewOutput.pontosNegativos || []),
          sessao: sessaoToUse
        };

        // Save review to our database
        console.log('Payload being sent to /api/reviews:', JSON.stringify(transformedReview, null, 2));
        
        const saveResponse = await fetch('/api/reviews', {
          method: 'POST',
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(transformedReview),
        });
        
        console.log('API response status:', saveResponse.status);
        if (!saveResponse.ok) {
          const errorText = await saveResponse.text();
          
          console.log('API error response:', errorText);
        }
        
        if (saveResponse.ok) {
          console.log('Review saved successfully');
          
          // Cria objeto com formato correto para o ReviewSidebar (snake_case)
          const reviewForSidebar = {
            id: null,
            chat_id: currentThread.id,
            resumo_atendimento: reviewOutput.resumoAtendimento,
            feedback_direto: reviewOutput.feedbackDireto,
            sinais_paciente: reviewOutput.sinaisPaciente.map(item => Array.isArray(item) ? item[0] : item),
            pontos_positivos: reviewOutput.pontosPositivos.map(item => Array.isArray(item) ? item[0] : item),
            pontos_negativos: reviewOutput.pontosNegativos.map(item => Array.isArray(item) ? item[0] : item),
            sessao: sessaoToUse,
            created_at: new Date().toISOString()
          };
          
          console.log('Setting currentReview with sidebar format:', reviewForSidebar);
          
          // Atualiza estados imediatamente
          setCurrentReview(reviewForSidebar);
          setHasReview(true);
          setIsCurrentSessionFinalized(true);
          setShowReviewSidebar(true);
          
          console.log('ReviewSidebar should now be visible with data');
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

  // Finalização automática quando sessão expira por tempo
  const hasAutoFinalizedRef = useRef(false);
  const lastExpiredSessionRef = useRef(null);
  const hasDeletedEmptySessionRef = useRef(false);
  
  useEffect(() => {
    // Verificar se a sessão expirou e ainda não foi finalizada
    if (isSessionExpired && !hasReview && currentThread) {
      const sessionKey = `${selectedSessionId}-${selectedSessaoNumber}`;
      
      // Se não há mensagens, deletar a sessão
      if (currentMessages.length === 0) {
        // Evitar múltiplas tentativas de deletar a mesma sessão
        if (hasDeletedEmptySessionRef.current && lastExpiredSessionRef.current === sessionKey) {
          return;
        }
        
        console.log('Sessão expirada sem mensagens, deletando sessão...', {
          chatId: selectedSessionId,
          sessao: selectedSessaoNumber
        });
        
        hasDeletedEmptySessionRef.current = true;
        lastExpiredSessionRef.current = sessionKey;
        
        // Deletar a sessão do banco de dados
        const deleteEmptySession = async () => {
          try {
            const { error } = await supabaseService.deleteSession(selectedSessionId, selectedSessaoNumber);
            if (error) {
              console.error('Erro ao deletar sessão vazia:', error);
            } else {
              console.log('Sessão vazia deletada com sucesso');
              // Recarregar a página para atualizar a interface
              window.location.reload();
            }
          } catch (error) {
            console.error('Erro ao deletar sessão vazia:', error);
          }
        };
        
        deleteEmptySession();
        return;
      }
      
      // Evitar múltiplas finalizações para a mesma sessão
      if (hasAutoFinalizedRef.current && lastExpiredSessionRef.current === sessionKey) {
        return;
      }
      
      // Verificar se já tem pelo menos 4 mensagens antes de finalizar automaticamente
      if (currentMessages.length >= 4) {
        console.log('Sessão expirada automaticamente, finalizando atendimento...', {
          chatId: selectedSessionId,
          sessao: selectedSessaoNumber,
          messageCount: currentMessages.length
        });
        
        hasAutoFinalizedRef.current = true;
        lastExpiredSessionRef.current = sessionKey;
        
        // Chamar finalização automática
        handleFinalizeChat();
      } else {
        console.log('Sessão expirada mas não há mensagens suficientes para finalizar automaticamente', {
          chatId: selectedSessionId,
          sessao: selectedSessaoNumber,
          messageCount: currentMessages.length
        });
      }
    } else if (!isSessionExpired) {
      // Resetar flags quando a sessão não está mais expirada (nova sessão)
      const sessionKey = `${selectedSessionId}-${selectedSessaoNumber}`;
      if (lastExpiredSessionRef.current !== sessionKey) {
        hasAutoFinalizedRef.current = false;
        hasDeletedEmptySessionRef.current = false;
      }
    }
  }, [isSessionExpired, hasReview, currentThread, selectedSessionId, selectedSessaoNumber, currentMessages.length, handleFinalizeChat]);

  const handleStartNextSession = async () => {
    if (!currentThread) return;
    setIsStartingNextSession(true);
    try {
      // Garantir que o dialog não seja aberto durante a criação da nova sessão
      setShowNewChatDialog(false);
      
      // Inserir nova sessão para o mesmo chat_id
      const { data, error, newSession } = await supabaseService.incrementChatSession(currentThread.id);
      
      if (error) {
        toast({
          title: "Erro",
          description: error || "Erro ao criar nova sessão",
          variant: "destructive",
        });
        return;
      }
      
      if (newSession) {
        console.log(`Nova sessão criada: ${newSession} para chat_id: ${currentThread.id}`);
        
        // Resetar estados relacionados à sessão anterior
        setHasReview(false);
        setCurrentReview(null);
        setShowReviewSidebar(false);
        setIsCurrentSessionFinalized(false);
        
        // Atualizar estados locais PRIMEIRO para que o timer seja reinicializado
        setSelectedSessionId(currentThread.id);
        setSelectedSessaoNumber(newSession);
        
        // Pequeno delay para garantir que o banco foi atualizado
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Selecionar a nova sessão diretamente sem reload
        await selectThread(currentThread.id, newSession);
        
        // Atualizar o estado local da sessão
        setCurrentSessionData((prev) => ({
          ...prev,
          sessao: newSession
        }));
        
        if (window.refreshSidebar) {
          await window.refreshSidebar();
        }
        
        // Refresh na URL atual para atualizar os dados após criar a nova sessão
        // Pequeno delay para garantir que o banco foi atualizado antes do reload
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Recarregar a página para atualizar todos os dados
        window.location.reload();
      } else {
        console.error('Erro ao criar nova sessão: sem newSession');
        toast({
          title: "Erro",
          description: "Erro ao criar nova sessão. Tente novamente.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Erro ao criar nova sessão:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar nova sessão. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsStartingNextSession(false);
    }
  };

  // Handler para trocar de sessão nas abas
  const handleSessionChange = async (sessionChatId, sessao) => {
    setSelectedSessionId(sessionChatId);
    setSelectedSessaoNumber(sessao);
    await selectThread(sessionChatId, sessao); // Passa o número da sessão
    // Verificar se há review para o chat_id e sessao selecionados
    const { data: review, error } = await supabase
      .from('chat_reviews')
      .select('*')
      .eq('chat_id', sessionChatId)
      .eq('sessao', sessao)
      .single();
    const hasReviewForSession = !!review && !error;
    setIsCurrentSessionFinalized(hasReviewForSession);
    setHasReview(hasReviewForSession);
    setCurrentReview(hasReviewForSession ? review : null);
    
    navigate(`/chat/${sessionChatId}`);
  };

  // REMOVIDO: useEffect duplicado que estava causando loops
  // A verificação de review agora é feita apenas no useEffect consolidado acima
  // REMOVIDO: useEffect duplicado que estava causando loops
  // A verificação de review agora é feita apenas no useEffect consolidado acima

  // Handler para criar nova sessão das abas
  const handleNewSessionFromTabs = () => {
    handleStartNextSession();
  };

  // LOG DE DEPURAÇÃO - Inicializa selectedSessionId e selectedSessaoNumber ao carregar currentThread
  // IMPORTANTE: Este useEffect DEVE estar antes de qualquer return condicional
  const lastCurrentThreadRef = useRef(null);
  useEffect(() => {
    const currentThreadKey = `${currentThread?.id}-${currentThread?.sessionData?.sessao}`;
    
    // Evitar execução se o currentThread não mudou realmente
    if (lastCurrentThreadRef.current === currentThreadKey) {
      return;
    }
    
    if (currentThread?.id && currentThread?.sessionData?.sessao) {
      const newSessionId = currentThread.id;
      const newSessaoNumber = currentThread.sessionData.sessao;
      
      // Só atualiza se realmente mudou para evitar loops
      if (selectedSessionId !== newSessionId || selectedSessaoNumber !== newSessaoNumber) {
        setSelectedSessionId(newSessionId);
        setSelectedSessaoNumber(newSessaoNumber);
      }
      
      lastCurrentThreadRef.current = currentThreadKey;
    }
  }, [currentThread?.id, currentThread?.sessionData?.sessao, selectedSessionId, selectedSessaoNumber]);

  // Proteção: só renderiza o conteúdo principal se currentThread estiver definido
  // Mas permite renderização quando é uma nova conversa ou dialog está aberto
  if (!currentThread && chatId !== 'new' && !showNewChatDialog) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <span className="text-gray-500 text-lg">Carregando atendimento...</span>
      </div>
    );
  }
  return (
    <div className="flex h-screen overflow-hidden" data-testid="chat-page">
      {/* Render NewChatDialog first if it should be shown */}
      {showNewChatDialog && (
        <NewChatDialog
          open={showNewChatDialog}
          onOpenChange={setShowNewChatDialog}
          onConfirm={handleNewChatConfirm}
        />
      )}

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
                <AvatarFallback className="bg-gray-300 text-gray-600 p-0">
                  <img src={iconPaciente} alt="Paciente" className="w-full h-full object-cover rounded-full" />
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
            {/* Session Timer */}
            {selectedSessionId && timeRemaining !== null && (
              <SessionTimer 
                timeRemaining={timeRemaining} 
                isExpired={isSessionExpired}
                isFinalized={isCurrentSessionFinalized}
                chatId={currentChatId}
                sessao={currentSessao}
                onPauseChange={handlePauseChange}
              />
            )}
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
                disabled={isFinalizingChat || currentMessages.length < 4}
                className="bg-green-600 hover:bg-green-700 text-white px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="finalize-chat-button"
                title={currentMessages.length < 4 ? "É necessário ter pelo menos 4 mensagens para finalizar o atendimento" : "Finalizar atendimento"}
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
              className="p-1.5 sm:p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              data-testid="settings-button"
            >
              <i className="fas fa-cog text-sm"></i>
            </Button>
            </div>
          </div>
        </div>

        {/* Session Tabs - show if we have threadId OR currentChatId (para casos onde thread_id está vazio) */}
        {threadId || currentChatId ? (
          <SessionTabs
            threadId={threadId}
            currentChatId={currentChatId}
            onSessionChange={handleSessionChange}
            onNewSession={handleNewSessionFromTabs}
            className="border-b"
          />
        ) : null}

        {/* Messages Container */}
        <div
          className="flex-1 overflow-y-auto px-2 sm:px-4 py-3 sm:py-6 min-h-0"
          data-testid="messages-container"
        >
          <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
            {/* Welcome Message - apenas na primeira sessão */}
            {currentMessages.length === 0 && currentSessao === 1 && (
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
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div
                          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: "0.15s" }}
                        ></div>
                        <div
                          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: "0.3s" }}
                        ></div>
                      </div>
                      <span className="text-sm text-gray-500 flex items-center">
                        <i className="fas fa-keyboard mr-2 text-xs"></i>
                        Paciente está digitando...
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
        <MessageInput
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
          error={error}
          onClearError={clearError}
          isFinalized={isCurrentSessionFinalized}
          isSessionExpired={isSessionExpired}
          isPaused={isTimerPaused}
        />
      </div>

      <ReviewSidebar
        review={currentReview}
        isOpen={showReviewSidebar}
        onClose={() => setShowReviewSidebar(false)}
      />
    </div>
  );
}
