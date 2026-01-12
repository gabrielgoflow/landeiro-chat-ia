import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase.js";
import { useToast } from "@/hooks/use-toast";
import { supabaseService } from "@/services/supabaseService";

const ADMIN_EMAILS = ["admin@goflow.digital", "admin@nexialab.com.br", "admin@fernandalandeiro.com.br"];

const isAdminEmail = (email) => {
  return email ? ADMIN_EMAILS.includes(email) : false;
};

export function NewChatDialog({ open, onOpenChange, onConfirm }) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    diagnostico: "",
    protocolo: "tcc", // Always TCC
  });
  const [diagnosticos, setDiagnosticos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [userChats, setUserChats] = useState([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  // Verificar se usuário é admin
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setIsAdmin(false);
        setCheckingAdmin(false);
        return;
      }

      // Check if user is admin by email
      if (isAdminEmail(user.email)) {
        setIsAdmin(true);
        setCheckingAdmin(false);
        return;
      }

      // Check user_metadata table for admin role
      try {
        const { data, error } = await supabase
          .from("user_metadata")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!error && data && data.role === "admin") {
          setIsAdmin(true);
        } else {
          // Se não tem metadata ou role não é admin, verificar novamente por email (fallback)
          if (isAdminEmail(user.email)) {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
        // Em caso de erro, verificar por email como fallback
        if (isAdminEmail(user.email)) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } finally {
        setCheckingAdmin(false);
      }
    };

    if (open && user) {
      checkAdmin();
    }
  }, [open, user]);

  useEffect(() => {
    if (open && user && !checkingAdmin) {
      loadDiagnosticos();
      loadUserChats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, user, checkingAdmin, isAdmin]);

  const loadDiagnosticos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("diagnosticos")
        .select("*")
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      
      // Filtrar diagnósticos de teste se não for admin
      // A política RLS já faz isso, mas é uma camada extra de segurança
      let filtered = data || [];
      
      if (!isAdmin) {
        filtered = filtered.filter(d => !d.apenas_teste);
      }
      
      setDiagnosticos(filtered);
    } catch (error) {
      console.error("Erro ao carregar diagnosticos:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar diagnósticos disponíveis",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUserChats = async () => {
    if (!user) return;
    
    try {
      setLoadingChats(true);
      const chats = await supabaseService.getUserChats(user.id);
      setUserChats(chats || []);
    } catch (error) {
      console.error("Erro ao carregar chats do usuário:", error);
      setUserChats([]);
    } finally {
      setLoadingChats(false);
    }
  };

  // Verificar se o usuário já tem um chat para um diagnóstico específico
  // Agrupar por thread_id para verificar se já existe um chat para este diagnóstico
  const hasChatForDiagnostico = (diagnosticoCodigo) => {
    const threadsByDiagnostico = {};
    userChats.forEach((chat) => {
      if (chat.diagnostico === diagnosticoCodigo) {
        if (!threadsByDiagnostico[chat.thread_id]) {
          threadsByDiagnostico[chat.thread_id] = { maxSessao: chat.sessao || 1 };
        } else {
          threadsByDiagnostico[chat.thread_id].maxSessao = Math.max(
            threadsByDiagnostico[chat.thread_id].maxSessao,
            chat.sessao || 1
          );
        }
      }
    });
    return Object.keys(threadsByDiagnostico).length > 0;
  };

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

  // Verificar se o chat já atingiu o máximo de sessões para o diagnóstico
  const hasMaxSessions = (diagnosticoCodigo) => {
    const threadsByDiagnostico = {};
    userChats.forEach((chat) => {
      if (chat.diagnostico === diagnosticoCodigo) {
        if (!threadsByDiagnostico[chat.thread_id]) {
          threadsByDiagnostico[chat.thread_id] = { maxSessao: chat.sessao || 1 };
        } else {
          threadsByDiagnostico[chat.thread_id].maxSessao = Math.max(
            threadsByDiagnostico[chat.thread_id].maxSessao,
            chat.sessao || 1
          );
        }
      }
    });
    
    // Obter limite máximo baseado no diagnóstico
    const maxSessions = getMaxSessionsForDiagnostico(diagnosticoCodigo);
    
    // Verificar se algum thread já atingiu o limite de sessões
    return Object.values(threadsByDiagnostico).some(
      (thread) => thread.maxSessao >= maxSessions
    );
  };

  const handleSubmit = async () => {
    if (!formData.diagnostico) {
      toast({
        title: "Erro",
        description: "Selecione um diagnóstico",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Erro",
        description: "Usuário não autenticado",
        variant: "destructive",
      });
      return;
    }

    try {
      setValidating(true);
      // Validar acesso ao diagnóstico
      const diagnostico = diagnosticos.find((d) => d.codigo === formData.diagnostico);
      if (!diagnostico) {
        toast({
          title: "Erro",
          description: "Diagnóstico não encontrado",
          variant: "destructive",
        });
        return;
      }

      // Verificar se já existe um chat para este diagnóstico
      if (hasChatForDiagnostico(formData.diagnostico)) {
        toast({
          title: "Chat já existe",
          description: "Você já possui um chat para este diagnóstico. Cada usuário pode ter apenas 1 chat por diagnóstico.",
          variant: "destructive",
        });
        return;
      }

      // Verificar se algum chat deste diagnóstico já atingiu o limite de sessões
      if (hasMaxSessions(formData.diagnostico)) {
        const maxSessions = getMaxSessionsForDiagnostico(formData.diagnostico);
        toast({
          title: "Limite de sessões atingido",
          description: `Este diagnóstico já atingiu o máximo de ${maxSessions} sessões.`,
          variant: "destructive",
        });
        return;
      }

      // Verificar acesso via API (data final de acesso)
      let result;
      try {
        const response = await fetch(`/api/access/validate?userId=${user.id}&diagnosticoCodigo=${formData.diagnostico}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        result = await response.json();
      } catch (error) {
        console.error("Erro ao validar acesso:", error);
        toast({
          title: "Erro de Conexão",
          description: "Não foi possível validar o acesso. O serviço pode estar temporariamente indisponível. Por favor, aguarde alguns minutos e tente novamente.",
          variant: "destructive",
        });
        setValidating(false);
        return;
      }

      if (!result.canAccess) {
        toast({
          title: "Acesso Negado",
          description: result.reason || "Você não tem acesso a este diagnóstico",
          variant: "destructive",
        });
        setValidating(false);
        return;
      }

      onConfirm(formData);
      setFormData({ diagnostico: "", protocolo: "tcc" });
      onOpenChange(false);
      setValidating(false);
    } catch (error) {
      console.error("Erro ao validar acesso:", error);
      const errorMessage = error?.message || error?.toString() || "";
      if (errorMessage.includes("temporário") || 
          errorMessage.includes("temporariamente indisponível") ||
          errorMessage.includes("conexão") ||
          errorMessage.includes("authentication")) {
        toast({
          title: "Erro de Conexão",
          description: "Erro temporário de conexão. Por favor, aguarde alguns instantes e tente novamente.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro",
          description: "Erro ao validar acesso. Tente novamente.",
          variant: "destructive",
        });
      }
      setValidating(false);
    }
  };

  const handleCancel = () => {
    setFormData({ diagnostico: "", protocolo: "tcc" });
    onOpenChange(false);
    navigate("/chats");
  };

  const handleOpenChange = (newOpen) => {
    if (!newOpen) {
      // Se o dialog está sendo fechado (por ESC, clique fora, etc.), redirecionar para /chats
      navigate("/chats");
    }
    onOpenChange(newOpen);
  };

  const isFormValid = formData.diagnostico;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <i className="fas fa-plus text-primary"></i>
            <span>Nova Conversa</span>
          </DialogTitle>
          <DialogDescription>
            Selecione o diagnóstico para iniciar uma nova sessão com protocolo
            TCC.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="diagnostico">Diagnóstico</Label>
            {loading ? (
              <div className="text-sm text-gray-500 py-2">Carregando diagnósticos...</div>
            ) : (
              <Select
                value={formData.diagnostico}
                onValueChange={(value) =>
                  setFormData({ ...formData, diagnostico: value })
                }
              >
                <SelectTrigger id="diagnostico" data-testid="diagnostico-select">
                  <SelectValue placeholder="Selecione o diagnóstico" />
                </SelectTrigger>
                <SelectContent>
                  {diagnosticos.map((diagnostico) => {
                    const hasChat = hasChatForDiagnostico(diagnostico.codigo);
                    const maxSessions = hasMaxSessions(diagnostico.codigo);
                    const isDisabled = hasChat || maxSessions;
                    
                    return (
                      <SelectItem 
                        key={diagnostico.id} 
                        value={diagnostico.codigo}
                        disabled={isDisabled}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span>{diagnostico.nome}</span>
                          {hasChat && (
                            <span className="text-xs text-gray-500 ml-2">(Já possui chat)</span>
                          )}
                          {maxSessions && !hasChat && (
                            <span className="text-xs text-gray-500 ml-2">(Limite de sessões)</span>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            data-testid="cancel-button"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isFormValid || loading || validating}
            data-testid="confirm-button"
            className="ml-2"
          >
            <i className="fas fa-check mr-2"></i>
            {validating ? "Validando..." : "Iniciar Conversa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
