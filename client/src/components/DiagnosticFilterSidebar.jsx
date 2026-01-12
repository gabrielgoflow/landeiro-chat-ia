import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase.js";
import { Filter, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { useIsMobile } from "@/hooks/use-mobile.jsx";
import { useAuth } from "@/hooks/useAuth";

const ADMIN_EMAILS = ["admin@goflow.digital", "admin@nexialab.com.br", "admin@fernandalandeiro.com.br"];

const isAdminEmail = (email) => {
  return email ? ADMIN_EMAILS.includes(email) : false;
};

export function DiagnosticFilterSidebar({ 
  selectedDiagnostico, 
  onSelectDiagnostico,
  userChats = [],
  isOpen = false,
  onClose
}) {
  const [diagnosticos, setDiagnosticos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const { user } = useAuth();
  const isMobile = useIsMobile();

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

    checkAdmin();
  }, [user]);

  const loadDiagnosticos = async () => {
    try {
      setLoading(true);
      // A política RLS já filtra automaticamente apenas os transtornos ativos
      // para usuários não-admin, então não precisamos filtrar no código
      const { data, error } = await supabase
        .from("diagnosticos")
        .select("*")
        .order("nome");

      if (error) {
        console.error("Erro ao carregar diagnosticos:", error);
        console.error("Código do erro:", error.code);
        console.error("Mensagem:", error.message);
        setDiagnosticos([]);
        return;
      }
      
      // Filtrar apenas os ativos no cliente como segurança adicional
      // (a política RLS já faz isso, mas é uma camada extra de segurança)
      // Se não for admin, excluir diagnósticos de teste
      let filtered = (data || []).filter(d => d.ativo);
      
      if (!isAdmin) {
        filtered = filtered.filter(d => !d.apenas_teste);
      }
      
      setDiagnosticos(filtered);
    } catch (error) {
      console.error("Erro ao carregar diagnosticos:", error);
      setDiagnosticos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!checkingAdmin) {
      loadDiagnosticos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkingAdmin, isAdmin]);

  // Contar chats por diagnóstico
  const getChatCountByDiagnostico = (codigo) => {
    if (!codigo) return userChats.length;
    return userChats.filter(chat => chat.diagnostico === codigo).length;
  };

  return (
    <>
      {/* Overlay para mobile */}
      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onClose}
          data-testid="filter-sidebar-overlay"
        />
      )}

      {/* Sidebar */}
      <div 
        className={`
          ${isMobile 
            ? `fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 h-full overflow-y-auto transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`
            : 'static w-64 bg-white border-r border-gray-200 h-full overflow-y-auto'
          }
        `}
        style={!isMobile ? {minHeight: '100vh'} : {}}
        data-testid="diagnostic-filter-sidebar"
      >
        <div className="p-2 sm:p-4">
          <div className="flex items-center justify-between border-b border-gray-200 pb-3 sm:pb-6 mb-3 sm:mb-0">
            <div className="flex flex-col items-center w-full sm:block">
              <Logo size="xl" />
              <h1 className="text-xs sm:text-sm font-semibold text-secondary text-center mt-2">Atendimento IA</h1>
            </div>
            {isMobile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="p-1.5 sm:p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 absolute top-2 right-2"
                data-testid="close-filter-sidebar-button"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between mt-3 sm:mt-5">
            <div className="flex items-center space-x-2">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Filtrar por</h2>
            </div>
            {selectedDiagnostico && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSelectDiagnostico(null)}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">Diagnóstico/Transtorno</p>
        </div>

        <div className="p-2 sm:p-2">
          {loading ? (
            <div className="text-center py-4 text-gray-500 text-xs sm:text-sm">
              Carregando...
            </div>
          ) : (
            <div className="space-y-1">
              {/* Opção "Todos" */}
              <button
                onClick={() => {
                  onSelectDiagnostico(null);
                  if (isMobile) onClose();
                }}
                className={`w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm transition-colors ${
                  selectedDiagnostico === null
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center">
                    <Filter className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                    Todos
                  </span>
                  <Badge variant="secondary" className="text-[10px] sm:text-xs">
                    {getChatCountByDiagnostico(null)}
                  </Badge>
                </div>
              </button>

              {/* Lista de diagnósticos */}
              {diagnosticos.map((diagnostico) => {
                const count = getChatCountByDiagnostico(diagnostico.codigo);
                const isSelected = selectedDiagnostico === diagnostico.codigo;

                return (
                  <button
                    key={diagnostico.id}
                    onClick={() => {
                      onSelectDiagnostico(diagnostico.codigo);
                      if (isMobile) onClose();
                    }}
                    className={`w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm transition-colors ${
                      isSelected
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{diagnostico.nome}</span>
                      <Badge 
                        variant={isSelected ? "default" : "secondary"} 
                        className="text-[10px] sm:text-xs ml-2"
                      >
                        {count}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

