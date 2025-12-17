import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ChatService } from "@/services/chatService.js";
import { supabaseService } from "@/services/supabaseService.js";
import { useIsMobile } from "@/hooks/use-mobile.jsx";
import { useAuth } from "@/hooks/useAuth.jsx";
import { useToast } from "@/hooks/use-toast";
import { NewChatDialog } from "./NewChatDialog.jsx";
import { Logo } from "@/components/Logo";
import { supabase } from "@/lib/supabase.js";

export function ChatSidebar({
  currentThread,
  onSelectThread,
  onDeleteThread,
  onStartNewThread,
  onNewChatConfirm,
  isOpen,
  onClose,
}) {
  const isMobile = useIsMobile();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [userChats, setUserChats] = useState([]);
  const [chatReviews, setChatReviews] = useState({});
  const [loadingChats, setLoadingChats] = useState(false);
  const [diagnosticosMap, setDiagnosticosMap] = useState({});

  // Função auxiliar para determinar o limite máximo de sessões baseado no diagnóstico
  const getMaxSessionsForDiagnostico = (diagnosticoCodigo) => {
    // Normalizar o código do diagnóstico para comparar (considerar ambos com e sem acento)
    const normalizedCodigo = diagnosticoCodigo?.toLowerCase() || '';
    
    // Depressão tem limite de 14 sessões (contando com a sessão extra)
    if (normalizedCodigo === 'depressão' || normalizedCodigo === 'depressao') {
      return 14;
    }
    
    // Outros diagnósticos têm limite de 10 sessões
    return 10;
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast({
        title: "Erro ao sair",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso",
      });
    }
  };

  // Function to load user chats from Supabase - memoizada para evitar recriações
  const loadUserChats = useCallback(async () => {
    if (!user) return;

    try {
      setLoadingChats(true);
      const chats = await supabaseService.getUserChats(user.id);
      setUserChats(chats);

      // Check review status for the latest session of each thread
      const reviewStatuses = {};
      for (const chat of chats) {
        try {
          // Verifica review para o par chat_id + última sessão
          const { data: review, error } = await supabaseService.supabase
            .from("chat_reviews")
            .select("*")
            .eq("chat_id", chat.chat_id)
            .eq("sessao", chat.sessao)
            .single();
          reviewStatuses[chat.chat_id] = !!review && !error;
        } catch (error) {
          reviewStatuses[chat.chat_id] = false;
        }
      }
      setChatReviews(reviewStatuses);
    } catch (error) {
      console.error("Erro ao carregar chats:", error);
    } finally {
      setLoadingChats(false);
    }
  }, [user]);

  // Carregar diagnósticos para mapear código -> nome
  useEffect(() => {
    const loadDiagnosticos = async () => {
      try {
        const { data, error } = await supabase
          .from("diagnosticos")
          .select("codigo, nome")
          .eq("ativo", true);

        if (error) {
          console.error("Erro ao carregar diagnósticos:", error);
          return;
        }

        // Criar mapa de código para nome
        const map = {};
        (data || []).forEach((d) => {
          map[d.codigo] = d.nome;
        });
        setDiagnosticosMap(map);
      } catch (error) {
        console.error("Erro ao carregar diagnósticos:", error);
      }
    };

    loadDiagnosticos();
  }, []);

  // Load user chats from Supabase on mount and when user changes
  useEffect(() => {
    loadUserChats();
  }, [loadUserChats]);

  // Expose refresh function globally for when new chats are created
  useEffect(() => {
    window.refreshSidebar = loadUserChats;
    return () => {
      delete window.refreshSidebar;
    };
  }, [loadUserChats]);

  const handleNewChatConfirm = async (formData) => {
    // Se temos a função de confirmação do chat principal, usa ela (com redirecionamento)
    if (onNewChatConfirm) {
      await onNewChatConfirm(formData);

      toast({
        title: "Nova conversa iniciada",
        description: `Diagnóstico: ${formData.diagnostico} | Protocolo: TCC`,
      });
    } else {
      // Fallback para compatibilidade
      const newThread = await onStartNewThread(formData);
      setShowNewChatDialog(false);

      toast({
        title: "Nova conversa iniciada",
        description: `Diagnóstico: ${formData.diagnostico} | Protocolo: TCC`,
      });
    }
  };


  const getLastMessage = (threadId) => {
    const threadMessages = messages[threadId] || [];
    const lastMessage = threadMessages[threadMessages.length - 1];
    return lastMessage ? lastMessage.content : "Nova conversa";
  };

  const getFormattedTime = (thread) => {
    return ChatService.formatTimestamp(thread.updatedAt || new Date());
  };

  // LOG para depuração do Sidebar - removido para evitar logs excessivos
  // console.log("Sidebar userChats:", userChats);

  // Agrupa por chat_id, mantendo apenas a sessão mais alta
  const latestChats = {};
  userChats.forEach((chat) => {
    if (
      !latestChats[chat.chat_id] ||
      chat.sessao > latestChats[chat.chat_id].sessao
    ) {
      latestChats[chat.chat_id] = chat;
    }
  });
  const chatsToShow = Object.values(latestChats);

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
      <div
        className={`
        fixed inset-y-0 left-0 z-50 w-80 bg-white shadow-lg transform transition-transform duration-300 ease-in-out
        ${isOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0 lg:static lg:inset-0
      `}
        data-testid="sidebar"
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="flex items-center justify-between p-5 sm:p-4 border-b border-border h-[80px]">
            <div className="flex items-center justify-center flex-1">
              <div className="w-auto h-8 sm:h-8 rounded-lg ">
                <Logo size="xl" />
              </div>
            </div>
            {isMobile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="p-1.5 sm:p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                data-testid="close-sidebar-button"
              >
                <i className="fas fa-times text-sm"></i>
              </Button>
            )}
          </div>

          {/* New Chat Button */}
          <div className="p-2 sm:p-4">
            <Button
              onClick={() => setShowNewChatDialog(true)}
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
              {userChats.length > 0 && (
                <div className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wider px-1.5 sm:px-2 py-0.5 sm:py-1">
                  Todas as Conversas
                </div>
              )}

              {loadingChats ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mx-auto"></div>
                  <p className="text-xs text-muted-foreground mt-2">Carregando...</p>
                </div>
              ) : (
                chatsToShow.map((chat) => {
                  const isActive =
                    currentThread?.id === chat.chat_id ||
                    currentThread?.openaiChatId === chat.chat_id;
                  // LOG para cada card - removido para evitar logs excessivos
                  // console.log("Sidebar card:", {
                  //   chat_id: chat.chat_id,
                  //   sessao: chat.sessao,
                  //   status: chatReviews[chat.chat_id]
                  //     ? "FINALIZADO"
                  //     : "EM ANDAMENTO",
                  //   chat,
                  // });

                  return (
                    <div
                      key={chat.chat_id}
                      className={`
                        group flex items-start px-2 sm:px-3 py-2 sm:py-3 rounded-lg cursor-pointer transition-colors duration-150 relative
                        ${
                          isActive
                            ? "bg-primary/10 border border-primary/20"
                            : "hover:bg-muted"
                        }
                      `}
                      onClick={() => {
                        // Navigate to the latest session of this thread
                        window.location.href = `/chat/${chat.chat_id}`;
                      }}
                      data-testid={`chat-${chat.chat_id}`}
                    >
                      {/* Status Tags */}
                      <div className="absolute top-2 right-2 flex flex-col items-end space-y-1">
                        <div className="flex items-center space-x-1">
                          {chat.status === "finalizado" ? (
                            <Badge className="bg-green-100 text-green-800 border-green-200 text-xs font-medium px-1.5 py-0.5">
                              FINALIZADO
                            </Badge>
                          ) : (
                            <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs font-medium px-1.5 py-0.5">
                              EM ANDAMENTO
                            </Badge>
                          )}
                        </div>

                        {/* Latest Session Badge - below status */}
                        {chat.sessao && (
                          <Badge
                            variant="default"
                            className="w-fit text-xs bg-gradient-pbe text-white px-2 py-0.5"
                          >
                            SESSÃO {chat.sessao}/{getMaxSessionsForDiagnostico(chat.diagnostico)} (ATUAL)
                          </Badge>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 pr-16 sm:pr-24">
                        <div className="flex flex-col space-y-0.5 sm:space-y-1 mb-1.5 sm:mb-2">
                          <Badge variant="secondary" className="w-fit text-[10px] sm:text-xs">
                            {(diagnosticosMap[chat.diagnostico] || chat.diagnostico || "Diagnóstico").toUpperCase()}
                          </Badge>
                          <Badge variant="outline" className="w-fit text-[10px] sm:text-xs">
                            {(chat.protocolo || "Protocolo").toUpperCase()}
                          </Badge>
                        </div>
                        <div className="text-[10px] sm:text-xs text-gray-500 truncate">
                          {chat.thread_id
                            ? `Thread: ${chat.thread_id.substring(7, 15)}...`
                            : `ID: ${chat.chat_id.substring(0, 8)}...`}
                        </div>
                        <div className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">
                          {chat.last_message_at
                            ? new Date(chat.last_message_at).toLocaleDateString(
                                "pt-BR",
                                {
                                  day: "2-digit",
                                  month: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )
                            : "Sem mensagens"}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              {!loadingChats && userChats.length === 0 && (
                <div className="text-center py-4 sm:py-8 text-gray-500">
                  <i className="fas fa-comments text-2xl sm:text-3xl mb-2 sm:mb-3 text-gray-300"></i>
                  <p className="text-xs sm:text-sm">Nenhuma conversa ainda</p>
                  <p className="text-[10px] sm:text-xs mt-1 px-2">
                    Clique em "Nova Conversa" para começar
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* User Info */}
          <div className="p-2 sm:p-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 sm:space-x-3 flex-1 min-w-0">
                <Avatar className="w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0">
                  <AvatarFallback className="bg-gray-300 text-gray-600">
                    <i className="fas fa-user text-xs sm:text-sm"></i>
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                    {user?.email || "Usuário"}
                  </div>
                  <div className="text-[10px] sm:text-xs text-gray-500 flex items-center space-x-1 sm:space-x-2">
                    <span>Conectado</span>
                    {user?.email && ["admin@goflow.digital", "admin@nexialab.com.br"].includes(user.email) && (
                      <a
                        href="/admin-setup"
                        className="text-blue-500 hover:text-blue-600"
                        title="Configurações Admin"
                      >
                        <i className="fas fa-cog text-xs"></i>
                      </a>
                    )}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="p-1.5 sm:p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 flex-shrink-0"
                data-testid="logout-button"
                title="Sair da conta"
              >
                <i className="fas fa-sign-out-alt text-xs sm:text-sm"></i>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* New Chat Dialog */}
      <NewChatDialog
        open={showNewChatDialog}
        onOpenChange={setShowNewChatDialog}
        onConfirm={handleNewChatConfirm}
      />
    </>
  );
}
