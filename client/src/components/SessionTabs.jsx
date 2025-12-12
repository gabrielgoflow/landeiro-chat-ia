import { useState, useEffect, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabaseService } from "@/services/supabaseService";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabase.js";

export function SessionTabs({
  threadId,
  currentChatId,
  onSessionChange,
  onNewSession,
  className = "",
}) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState(null);
  const lastThreadIdRef = useRef(null);
  const lastChatIdRef = useRef(null);
  const isLoadingRef = useRef(false);

  useEffect(() => {
    // Evitar chamadas duplicadas
    if (isLoadingRef.current) {
      console.log("SessionTabs: Já está carregando, ignorando chamada duplicada");
      return;
    }

    // Verificar se realmente mudou
    const threadIdChanged = lastThreadIdRef.current !== threadId;
    const chatIdChanged = lastChatIdRef.current !== currentChatId;

    if (!threadIdChanged && !chatIdChanged) {
      console.log("SessionTabs: threadId e currentChatId não mudaram, ignorando");
      return;
    }

    // Atualizar refs
    lastThreadIdRef.current = threadId;
    lastChatIdRef.current = currentChatId;

    // Se temos threadId, usar ele. Se não, usar currentChatId para buscar por chat_id
    if (threadId) {
      console.log("SessionTabs: useEffect triggered, threadId:", threadId);
      loadSessions();
    } else if (currentChatId) {
      console.log("SessionTabs: threadId não disponível, buscando por currentChatId:", currentChatId);
      loadSessionsByChatId();
    } else {
      console.log("SessionTabs: threadId e currentChatId não disponíveis, clearing sessions");
      setSessions([]);
      setLoading(false);
    }
  }, [threadId, currentChatId]);

  // Atualizar activeSession quando currentChatId mudar
  const lastActiveSessionRef = useRef(null);
  useEffect(() => {
    if (currentChatId && sessions.length > 0) {
      const currentSession = sessions.find(
        (s) => s.chat_id === currentChatId,
      );
      if (currentSession) {
        const newActiveSession = currentSession.sessao.toString();
        // Só atualizar se realmente mudou para evitar loops
        if (lastActiveSessionRef.current !== newActiveSession && activeSession !== newActiveSession) {
          setActiveSession(newActiveSession);
          lastActiveSessionRef.current = newActiveSession;
        }
      }
    }
  }, [currentChatId, sessions]); // Removido activeSession das dependências para evitar loop

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
      const { data: chatThreads, error: threadsError } = await supabase
        .from("chat_threads")
        .select("*")
        .eq("chat_id", currentChatId)
        .order("sessao", { ascending: true });

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
        const { data: review, error: reviewError } = await supabase
          .from("chat_reviews")
          .select("*")
          .eq("chat_id", thread.chat_id)
          .eq("sessao", thread.sessao)
          .single();

        const hasReview = !reviewError && review;
        console.log(`Session ${thread.sessao} - has review:`, hasReview);

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

    // Encontrar a sessão atual baseada no currentChatId
    const currentSession = sessionsWithStatus.find(
      (s) => s.chat_id === currentChatId,
    );
    if (currentSession) {
      setActiveSession(currentSession.sessao.toString());
    } else if (sessionsWithStatus.length > 0) {
      setActiveSession(sessionsWithStatus[0].sessao.toString());
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
      const { data: chatThreads, error: threadsError } = await supabase
        .from("chat_threads")
        .select("*")
        .eq("thread_id", threadId)
        .order("sessao", { ascending: true });

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
        <div className="flex items-center justify-between px-4 py-2">
          <TabsList className="flex-1 justify-start bg-gray-50">
            {sessions.map((session) => {
              // console.log("SessionTab:", session, "Status:", session.status); // Removido para evitar logs excessivos
              return (
                <TabsTrigger
                  key={session.sessao}
                  value={session.sessao.toString()}
                  className="relative flex items-center gap-2"
                  data-testid={`session-tab-${session.sessao}`}
                >
                  <span>SESSÃO {session.sessao}</span>
                  {session.status === "finalizado" ? (
                    <Badge className="bg-green-100 text-green-800 border-green-200 text-xs px-1 py-0">
                      FINALIZADA
                    </Badge>
                  ) : (
                    <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs px-1 py-0">
                      EM ANDAMENTO
                    </Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Botão para nova sessão */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleNewSession}
            className="ml-4 flex items-center gap-2"
            data-testid="new-session-button"
          >
            <Plus className="h-4 w-4" />
            Nova Sessão
          </Button>
        </div>

        {/* Content das sessões */}
        {sessions.map((session) => (
          <TabsContent
            key={session.sessao}
            value={session.sessao.toString()}
            className="m-0"
          >
            <div className="px-4 py-2 bg-gray-50 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-medium">
                    Sessão {session.sessao} - {session.diagnostico} (
                    {session.protocolo.toUpperCase()})
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
