import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabaseService } from "@/services/supabaseService";
import { Plus, MessageSquare, Calendar, User, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ChatsPage() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [userChats, setUserChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chatReviews, setChatReviews] = useState({});

  useEffect(() => {
    if (user) {
      loadUserChats();
    }
  }, [user]);

  const loadUserChats = async () => {
    try {
      setLoading(true);
      const chats = await supabaseService.getUserChats(user.id);
      setUserChats(chats);

      // Check review status for each chat
      const reviewStatuses = {};
      for (const chat of chats) {
        try {
          const response = await fetch(`/api/reviews/${chat.chat_id}`);
          reviewStatuses[chat.chat_id] = response.ok;
        } catch (error) {
          console.error(
            `Error checking review for chat ${chat.chat_id}:`,
            error,
          );
          reviewStatuses[chat.chat_id] = false;
        }
      }
      setChatReviews(reviewStatuses);
    } catch (error) {
      console.error("Erro ao carregar chats:", error);
    } finally {
      setLoading(false);
    }
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando seus chats...</p>
        </div>
      </div>
    );
  }

  // LOG para depuração da home de chats
  console.log("ChatsPage userChats:", userChats);

  // Agrupa por thread_id, mantendo apenas a sessão mais alta
  const latestThreads = {};
  userChats.forEach((chat) => {
    if (
      !latestThreads[chat.thread_id] ||
      chat.sessao > latestThreads[chat.thread_id].sessao
    ) {
      latestThreads[chat.thread_id] = chat;
    }
  });
  const chatsToShow = Object.values(latestThreads);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <User className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Seus Atendimentos
                </h1>
                <p className="text-gray-600">
                  Gerencie suas conversas de terapia
                </p>
              </div>
            </div>
            {/* User Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center space-x-2 hover:bg-gray-100"
                  data-testid="user-profile-dropdown"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-blue-100 text-blue-600 text-sm font-medium">
                      {user?.email?.charAt(0).toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-gray-700">{user?.email}</span>
                  <i className="fas fa-chevron-down text-xs text-gray-400"></i>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium text-gray-900">Conta</p>
                  <p className="text-xs text-gray-500 truncate">
                    {user?.email}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="text-red-600 focus:text-red-600"
                  data-testid="logout-option"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair da conta
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header with New Chat Button */}
        <div className="flex justify-end mb-6">
          <Button
            className="bg-blue-600 hover:bg-blue-700"
            data-testid="button-new-chat"
            onClick={() => navigate("/chat/new")}
          >
            <Plus className="h-5 w-5 mr-2" />
            Nova Conversa
          </Button>
        </div>

        {chatsToShow.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Nenhuma conversa ainda
            </h2>
            <p className="text-gray-600 mb-6">
              Comece sua jornada de autoconhecimento criando sua primeira
              conversa
            </p>
            <Link href="/chat/new">
              <Button
                className="bg-blue-600 hover:bg-blue-700"
                data-testid="button-first-chat"
              >
                <Plus className="h-5 w-5 mr-2" />
                Iniciar Primeira Conversa
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {chatsToShow.map((chat) => {
              // Badge de status
              const statusBadge =
                chat.status === "finalizado" ? (
                  <Badge className="bg-green-100 text-green-800 border-green-200 text-xs font-medium">
                    FINALIZADO
                  </Badge>
                ) : (
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs font-medium">
                    EM ANDAMENTO
                  </Badge>
                );
              // Badge de sessão
              const sessionBadge = (
                <Badge
                  variant="default"
                  className="w-fit text-xs bg-indigo-600 text-white px-2 py-0.5"
                >
                  SESSÃO {chat.sessao} (ATUAL)
                </Badge>
              );
              // Data da última mensagem
              const lastMessageDate = chat.last_message_at
                ? new Date(chat.last_message_at).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Sem mensagens";
              return (
                <Link key={chat.chat_id} href={`/chat/${chat.chat_id}`}>
                  <Card
                    className="hover:shadow-lg transition-shadow cursor-pointer h-full relative"
                    data-testid={`card-chat-${chat.chat_id}`}
                  >
                    {/* Status Tag */}
                    <div className="absolute top-2 right-2 z-10 flex flex-col items-end space-y-1">
                      {statusBadge}
                      {sessionBadge}
                    </div>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between pr-20">
                        <MessageSquare className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
                        <div className="flex flex-col space-y-2 ml-3 flex-1">
                          <Badge variant="secondary" className="w-fit">
                            {(chat.diagnostico || "Diagnóstico").toUpperCase()}
                          </Badge>
                          <Badge variant="outline" className="w-fit">
                            {(chat.protocolo || "Protocolo").toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        <div className="flex items-center text-sm text-gray-600">
                          <Calendar className="h-4 w-4 mr-2" />
                          {lastMessageDate}
                        </div>
                        <div className="text-sm text-gray-800">
                          <strong>ID:</strong> {chat.chat_id.substring(0, 8)}...
                        </div>
                        <div className="border-t pt-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            data-testid={`button-open-${chat.chat_id}`}
                          >
                            {chat.status === "finalizado"
                              ? "Visualizar Supervisão"
                              : "Continuar Conversa"}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
