import { useState, useEffect, useRef, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabaseService } from "@/services/supabaseService";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabase.js";

export function SessionTabs({
  threadId,
  currentChatId,
  onSessionChange,
  onNewSession,
  className = "",
  refreshKey = 0, // Nova prop para forçar refresh
  selectedSessaoNumber = null, // Sessão selecionada pelo componente pai
}) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState(null);
  const [diagnosticosMap, setDiagnosticosMap] = useState({});
  const [maxSessoesMap, setMaxSessoesMap] = useState({});
  const lastThreadIdRef = useRef(null);
  const lastChatIdRef = useRef(null);
  const lastRefreshKeyRef = useRef(0);
  const isLoadingRef = useRef(false);


  // Carregar diagnósticos para mapear código -> nome e max_sessoes
  useEffect(() => {
    const loadDiagnosticos = async () => {
      try {
        const { data, error } = await supabase
          .from("diagnosticos")
          .select("codigo, nome, max_sessoes")
          .eq("ativo", true);

        if (error) {
          console.error("Erro ao carregar diagnósticos:", error);
          return;
        }

        // Criar mapa de código para nome
        const nomeMap = {};
        const maxSessoesMapLocal = {};
        (data || []).forEach((d) => {
          nomeMap[d.codigo] = d.nome;
          const normalizedCodigo = d.codigo?.toLowerCase()?.trim() || '';
          maxSessoesMapLocal[normalizedCodigo] = d.max_sessoes || 10;
        });
        setDiagnosticosMap(nomeMap);
        setMaxSessoesMap(prev => ({ ...prev, ...maxSessoesMapLocal }));
      } catch (error) {
        console.error("Erro ao carregar diagnósticos:", error);
      }
    };

    loadDiagnosticos();
  }, []);

  useEffect(() => {
    // Evitar chamadas duplicadas
    if (isLoadingRef.current) {
      console.log("SessionTabs: Já está carregando, ignorando chamada duplicada");
      return;
    }

    // Verificar se realmente mudou
    const threadIdChanged = lastThreadIdRef.current !== threadId;
    const chatIdChanged = lastChatIdRef.current !== currentChatId;
    const refreshKeyChanged = lastRefreshKeyRef.current !== refreshKey;
    
    // Se não temos sessões carregadas mas temos um chatId/threadId disponível, forçar reload
    const needsInitialLoad = sessions.length === 0 && (threadId || currentChatId);

    // Se refreshKey mudou ou precisamos de um carregamento inicial, forçar reload
    if (!threadIdChanged && !chatIdChanged && !refreshKeyChanged && !needsInitialLoad) {
      console.log("SessionTabs: threadId, currentChatId e refreshKey não mudaram, ignorando");
      return;
    }

    // Atualizar refs
    lastThreadIdRef.current = threadId;
    lastChatIdRef.current = currentChatId;
    lastRefreshKeyRef.current = refreshKey;

    // Se temos threadId, usar ele. Se não, usar currentChatId para buscar por chat_id
    if (threadId) {
      console.log("SessionTabs: useEffect triggered, threadId:", threadId, "refreshKey:", refreshKey, "needsInitialLoad:", needsInitialLoad);
      loadSessions();
    } else if (currentChatId) {
      console.log("SessionTabs: threadId não disponível, buscando por currentChatId:", currentChatId, "refreshKey:", refreshKey, "needsInitialLoad:", needsInitialLoad);
      loadSessionsByChatId();
    } else {
      console.log("SessionTabs: threadId e currentChatId não disponíveis, clearing sessions");
      setSessions([]);
      setLoading(false);
    }
  }, [threadId, currentChatId, refreshKey, sessions.length]);

  // Atualizar activeSession quando currentChatId ou selectedSessaoNumber mudar
  const lastActiveSessionRef = useRef(null);
  const lastChatIdRefForActiveSession = useRef(null);
  const lastSelectedSessaoNumberRef = useRef(null);
  useEffect(() => {
    if (currentChatId && sessions.length > 0) {
      // PRIORIDADE 1: Se temos selectedSessaoNumber, sempre tentar encontrar essa sessão primeiro
      let currentSession = null;
      if (selectedSessaoNumber) {
        currentSession = sessions.find(
          (s) => s.chat_id === currentChatId && s.sessao === selectedSessaoNumber,
        );
        
        if (currentSession) {
          const newActiveSession = currentSession.sessao.toString();
          // Atualizar se mudou currentChatId, selectedSessaoNumber ou activeSession
          const shouldUpdate = 
            lastChatIdRefForActiveSession.current !== currentChatId || 
            lastSelectedSessaoNumberRef.current !== selectedSessaoNumber ||
            lastActiveSessionRef.current !== newActiveSession;
          
          if (shouldUpdate) {
            console.log('SessionTabs: Atualizando sessão ativa (via selectedSessaoNumber):', {
              newActiveSession,
              selectedSessaoNumber,
              currentChatId,
              previous: lastActiveSessionRef.current
            });
            setActiveSession(newActiveSession);
            lastActiveSessionRef.current = newActiveSession;
            lastChatIdRefForActiveSession.current = currentChatId;
            lastSelectedSessaoNumberRef.current = selectedSessaoNumber;
            return; // Sair cedo se encontramos a sessão
          }
        } else {
          // selectedSessaoNumber está definido mas a sessão não foi encontrada ainda
          // Isso pode acontecer quando uma nova sessão foi criada mas ainda não está na lista
          console.log('SessionTabs: selectedSessaoNumber definido mas sessão não encontrada na lista ainda:', {
            selectedSessaoNumber,
            availableSessions: sessions.map(s => s.sessao),
            currentChatId
          });
          // Não atualizar - aguardar que a sessão apareça na lista
          return;
        }
      }
      
      // PRIORIDADE 2: Se não temos selectedSessaoNumber ou não encontrou, tentar apenas com currentChatId
      // Mas só se selectedSessaoNumber não estava definido
      if (!selectedSessaoNumber) {
        // Ordenar por sessão descendente para pegar a mais recente primeiro
        const sortedSessions = [...sessions].sort((a, b) => b.sessao - a.sessao);
        currentSession = sortedSessions.find(
          (s) => s.chat_id === currentChatId,
        );
        
        if (currentSession) {
          const newActiveSession = currentSession.sessao.toString();
          // Atualizar se mudou currentChatId ou activeSession
          const shouldUpdate = 
            lastChatIdRefForActiveSession.current !== currentChatId ||
            lastActiveSessionRef.current !== newActiveSession;
          
          if (shouldUpdate) {
            console.log('SessionTabs: Atualizando sessão ativa (via currentChatId):', {
              newActiveSession,
              selectedSessaoNumber,
              currentChatId,
              previous: lastActiveSessionRef.current
            });
            setActiveSession(newActiveSession);
            lastActiveSessionRef.current = newActiveSession;
            lastChatIdRefForActiveSession.current = currentChatId;
            lastSelectedSessaoNumberRef.current = selectedSessaoNumber;
          }
        }
      }
    }
  }, [currentChatId, sessions, selectedSessaoNumber]); // Adicionado selectedSessaoNumber nas dependências

  // Buscar sessões por chat_id (quando thread_id está vazio)
  const loadSessionsByChatId = async () => {
    if (isLoadingRef.current) {
      console.log("SessionTabs: loadSessionsByChatId já em execução, ignorando");
      return;
    }

    try {
      isLoadingRef.current = true;
      setLoading(true);
      console.log("SessionTabs: Loading sessions by chat_id:", currentChatId);

      if (!currentChatId) {
        console.warn("SessionTabs: currentChatId is null or undefined, cannot load sessions");
        setSessions([]);
        setLoading(false);
        isLoadingRef.current = false;
        return;
      }

      // Buscar todas as sessões com o mesmo chat_id
      // Ordenar por sessão descendente para que a mais recente seja encontrada primeiro
      const { data: chatThreads, error: threadsError } = await supabase
        .from("chat_threads")
        .select("*")
        .eq("chat_id", currentChatId)
        .order("sessao", { ascending: false });

      if (threadsError) {
        console.error("SessionTabs: Erro ao buscar chat_threads por chat_id:", threadsError);
        setSessions([]);
        isLoadingRef.current = false;
        return;
      }

      console.log("SessionTabs: Chat threads encontrados por chat_id:", chatThreads?.length || 0, "sessões", chatThreads);

      // Processar sessões (mesma lógica do loadSessions)
      await processSessions(chatThreads || []);
    } catch (error) {
      console.error("SessionTabs: Error loading sessions by chat_id:", error);
      setSessions([]);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  };

  // Processar e enriquecer sessões com status de review
  const processSessions = async (chatThreads) => {
    const sessionsWithStatus = await Promise.all(
      chatThreads.map(async (thread) => {
        // Verificar se existe review para este chat_id e sessao
        // Usar maybeSingle() para evitar erro quando não existe review
        const { data: review, error: reviewError } = await supabase
          .from("chat_reviews")
          .select("*")
          .eq("chat_id", thread.chat_id)
          .eq("sessao", thread.sessao)
          .maybeSingle();

        // Considerar como finalizado apenas se realmente existe review (não apenas ausência de erro)
        const hasReview = review && !reviewError && review.id;
        console.log(`Session ${thread.sessao} - has review:`, hasReview, reviewError?.code);

        return {
          chat_id: thread.chat_id,
          thread_id: thread.thread_id,
          diagnostico: thread.diagnostico,
          protocolo: thread.protocolo,
          sessao: thread.sessao,
          created_at: thread.created_at,
          status: hasReview ? "finalizado" : "em_andamento",
          chat_reviews: hasReview
            ? [
                {
                  id: review.id,
                  resumo_atendimento: review.resumo_atendimento || "",
                  created_at: review.created_at,
                },
              ]
            : [],
        };
      }),
    );

    console.log("SessionTabs: Sessions with status:", sessionsWithStatus);
    setSessions(sessionsWithStatus);

    // Encontrar a sessão atual baseada no currentChatId e selectedSessaoNumber
    // IMPORTANTE: Sempre verificar selectedSessaoNumber PRIMEIRO
    let currentSession = null;
    
    // PRIORIDADE 1: Se temos selectedSessaoNumber, usar ele para encontrar a sessão correta
    if (selectedSessaoNumber) {
      currentSession = sessionsWithStatus.find(
        (s) => s.chat_id === currentChatId && s.sessao === selectedSessaoNumber,
      );
      console.log('SessionTabs: Buscando sessão com selectedSessaoNumber:', selectedSessaoNumber, 'encontrada:', !!currentSession);
      
      // Se selectedSessaoNumber está definido mas a sessão não foi encontrada,
      // NÃO definir sessão ativa - aguardar que o useEffect que monitora selectedSessaoNumber
      // defina a sessão correta quando ela aparecer na lista
      if (!currentSession) {
        console.log('SessionTabs: selectedSessaoNumber definido mas sessão não encontrada ainda. Aguardando...', {
          selectedSessaoNumber,
          availableSessions: sessionsWithStatus.map(s => s.sessao),
          currentChatId
        });
        // Não definir sessão ativa aqui - deixar o useEffect fazer isso
        return;
      }
    }
    
    // PRIORIDADE 2: Se não temos selectedSessaoNumber ou não encontrou, tentar apenas com currentChatId
    // Mas só se selectedSessaoNumber não estava definido
    if (!currentSession && !selectedSessaoNumber) {
      // Ordenar por sessão descendente para pegar a mais recente primeiro
      const sortedSessions = [...sessionsWithStatus].sort((a, b) => b.sessao - a.sessao);
      currentSession = sortedSessions.find(
        (s) => s.chat_id === currentChatId,
      );
    }
    
    if (currentSession) {
      const newActiveSession = currentSession.sessao.toString();
      // Sempre atualizar para garantir sincronização
      setActiveSession(newActiveSession);
      lastActiveSessionRef.current = newActiveSession;
      lastChatIdRefForActiveSession.current = currentChatId;
      console.log('SessionTabs: Sessão ativa definida para:', newActiveSession, {
        selectedSessaoNumber,
        foundBy: selectedSessaoNumber ? 'selectedSessaoNumber' : 'currentChatId'
      });
    } else if (sessionsWithStatus.length > 0 && !selectedSessaoNumber) {
      // Se não encontrou e não temos selectedSessaoNumber, usar a sessão mais recente (maior número)
      const sortedSessions = [...sessionsWithStatus].sort((a, b) => b.sessao - a.sessao);
      const latestSession = sortedSessions[0].sessao.toString();
      setActiveSession(latestSession);
      lastActiveSessionRef.current = latestSession;
      console.log('SessionTabs: Nenhuma sessão encontrada, usando mais recente:', latestSession);
    } else if (selectedSessaoNumber) {
      // Se temos selectedSessaoNumber mas não encontramos a sessão, não fazer nada
      // O useEffect que monitora selectedSessaoNumber vai atualizar quando a sessão aparecer
      console.log('SessionTabs: selectedSessaoNumber definido mas sessão não encontrada. Mantendo sessão atual ou aguardando...');
    }
  };

  const loadSessions = async () => {
    if (isLoadingRef.current) {
      console.log("SessionTabs: loadSessions já em execução, ignorando");
      return;
    }

    try {
      isLoadingRef.current = true;
      setLoading(true);
      console.log("SessionTabs: Loading sessions for threadId:", threadId);

      if (!threadId) {
        console.warn("SessionTabs: threadId is null or undefined, cannot load sessions");
        setSessions([]);
        setLoading(false);
        isLoadingRef.current = false;
        return;
      }

      // Buscar sessões diretamente das tabelas
      // Ordenar por sessão descendente para que a mais recente seja encontrada primeiro
      const { data: chatThreads, error: threadsError } = await supabase
        .from("chat_threads")
        .select("*")
        .eq("thread_id", threadId)
        .order("sessao", { ascending: false });

      if (threadsError) {
        console.error("SessionTabs: Erro ao buscar chat_threads:", threadsError);
        setSessions([]);
        isLoadingRef.current = false;
        return;
      }

      console.log("SessionTabs: Chat threads data encontrados:", chatThreads?.length || 0, "sessões", chatThreads);

      // Processar sessões (reutiliza a função comum)
      await processSessions(chatThreads || []);
    } catch (error) {
      console.error("Error loading sessions:", error);
      setSessions([]);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  };

  const handleSessionSelect = (sessionNumber) => {
    const session = sessions.find((s) => s.sessao.toString() === sessionNumber);
    if (session) {
      setActiveSession(sessionNumber);
      onSessionChange?.(session.chat_id, session.sessao);
    }
  };

  const handleNewSession = () => {
    onNewSession?.();
  };

  // Ordenar sessões em ordem ascendente para exibição (sessão 1 primeiro)
  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => a.sessao - b.sessao);
  }, [sessions]);

  // Encontrar a sessão atual para verificar se está finalizada
  // IMPORTANTE: Hooks devem ser chamados antes de qualquer return condicional
  // Verificar a sessão que corresponde ao currentChatId (sessão atual sendo visualizada)
  const currentSession = useMemo(() => {
    if (!currentChatId || !sessions.length) return null;
    // Primeiro tentar encontrar pela sessão ativa nas tabs
    if (activeSession) {
      const sessionByActive = sessions.find((s) => s.sessao.toString() === activeSession);
      if (sessionByActive && sessionByActive.chat_id === currentChatId) {
        return sessionByActive;
      }
    }
    // Se não encontrar, buscar pela sessão que corresponde ao currentChatId
    const sessionByChatId = sessions.find((s) => s.chat_id === currentChatId);
    return sessionByChatId || null;
  }, [activeSession, sessions, currentChatId]);

  // Verificar se existe alguma sessão em andamento no mesmo chat_id
  // O botão só deve estar habilitado se TODAS as sessões do mesmo chat_id estiverem finalizadas
  const hasSessionInProgress = useMemo(() => {
    if (!sessions.length || !currentChatId) return false;
    // Verificar se existe alguma sessão em andamento (não finalizada) no mesmo chat_id
    // Filtrar apenas sessões do mesmo chat_id para garantir que estamos verificando o chat correto
    const sessionsForCurrentChat = sessions.filter((s) => s.chat_id === currentChatId);
    return sessionsForCurrentChat.some((s) => s.status === "em_andamento");
  }, [sessions, currentChatId]);

  // O botão só deve estar habilitado se não houver nenhuma sessão em andamento
  const canCreateNewSession = !hasSessionInProgress;
  
  // Debug log
  useEffect(() => {
    if (currentSession) {
      console.log("SessionTabs: Current session status:", {
        sessao: currentSession.sessao,
        status: currentSession.status,
        hasSessionInProgress,
        canCreateNewSession,
        chatId: currentSession.chat_id,
        currentChatId,
        allSessions: sessions.map(s => ({ sessao: s.sessao, status: s.status }))
      });
    }
  }, [currentSession, hasSessionInProgress, canCreateNewSession, currentChatId, sessions]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <div className="text-sm text-gray-500">Carregando sessões...</div>
      </div>
    );
  }

  if (!sessions.length) {
    console.warn("SessionTabs: Nenhuma sessão encontrada. threadId:", threadId, "currentChatId:", currentChatId);
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <div className="text-sm text-gray-500">Nenhuma sessão encontrada</div>
      </div>
    );
  }

  // Só mostrar as tabs se houver 2 ou mais sessões
  // Se houver apenas 1 sessão, não há necessidade de mostrar tabs de navegação
  if (sessions.length < 2) {
    console.log("SessionTabs: Apenas 1 sessão encontrada, não mostrando tabs. sessions.length:", sessions.length, "sessions:", sessions);
    return null;
  }

  // console.log("SessionTabs: ✅ Renderizando tabs com", sessions.length, "sessões", "threadId:", threadId, "currentChatId:", currentChatId, "sessions:", sessions); // Removido para evitar logs excessivos

  return (
    <div className={`border-b bg-white ${className}`}>
      <Tabs
        value={activeSession}
        onValueChange={handleSessionSelect}
        className="w-full"
      >
        <div className="flex items-center justify-between px-4 py-2 gap-4" style={{overflowX: 'scroll', maxWidth: '80vw'}}>
          <div className="flex-1 min-w-0 overflow-x-auto">
            <TabsList className="inline-flex justify-start bg-gray-50 min-w-max">
              {sortedSessions.map((session) => {
                const isActive = activeSession === session.sessao.toString();
                // console.log("SessionTab:", session, "Status:", session.status); // Removido para evitar logs excessivos
                return (
                  <TabsTrigger
                    key={session.sessao}
                    value={session.sessao.toString()}
                    className={`relative flex items-center gap-2 whitespace-nowrap ${
                      isActive 
                        ? 'data-[state=active]:bg-[#009693] data-[state=active]:text-white data-[state=active]:shadow-[1px_2px_3px_1px_rgba(0,0,0,0.63)]' 
                        : ''
                    }`}
                    style={
                      isActive
                        ? {
                            background: '#009693',
                            color: 'white',
                            boxShadow: '1px 2px 3px 1px rgba(0, 0, 0, 0.63)',
                          }
                        : undefined
                    }
                    data-testid={`session-tab-${session.sessao}`}
                  >
                    <span>SESSÃO {session.sessao}</span>
                    {session.status === "finalizado" ? (
                      <Badge 
                        className={`text-xs px-1 py-0 ${
                          isActive 
                            ? 'bg-white/20 text-white border-white/30' 
                            : 'bg-green-100 text-green-800 border-green-200'
                        }`}
                      >
                        FINALIZADA
                      </Badge>
                    ) : (
                      <Badge 
                        className={`text-xs px-1 py-0 ${
                          isActive 
                            ? 'bg-white/20 text-white border-white/30' 
                            : 'bg-blue-100 text-blue-800 border-blue-200'
                        }`}
                      >
                        EM ANDAMENTO
                      </Badge>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          {/* Botão para nova sessão
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNewSession}
                    disabled={!canCreateNewSession}
                    className="flex items-center gap-2"
                    data-testid="new-session-button"
                  >
                    <Plus className="h-4 w-4" />
                    Nova Sessão
                  </Button>
                </span>
              </TooltipTrigger>
              {!canCreateNewSession && (
                <TooltipContent side="bottom">
                  <p className="max-w-xs">Finalize o atendimento e aguarde o review antes de iniciar nova sessão</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider> */}
        </div>

        {/* Content das sessões */}
        {sortedSessions.map((session) => (
          <TabsContent
            key={session.sessao}
            value={session.sessao.toString()}
            className="m-0"
          >
            <div className="px-4 py-2 bg-gray-50 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-medium">
                    Sessão {session.sessao}/{maxSessoesMap[session.diagnostico?.toLowerCase()?.trim() || ''] || supabaseService.getMaxSessionsForDiagnostico(session.diagnostico || '')} - {diagnosticosMap[session.diagnostico] || session.diagnostico || 'N/A'} (
                    {session.protocolo?.toUpperCase() || 'TCC'})
                  </span>
                  <span className="text-gray-500">
                    Iniciada em{" "}
                    {new Date(session.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>

                {session.chat_reviews?.length > 0 && (
                  <div className="text-sm text-gray-500">
                    Finalizada em{" "}
                    {new Date(
                      session.chat_reviews[0].created_at,
                    ).toLocaleDateString("pt-BR")}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

export default SessionTabs;
