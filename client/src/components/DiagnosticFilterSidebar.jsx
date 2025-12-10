import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/lib/supabase.js";
import { Filter, X } from "lucide-react";

export function DiagnosticFilterSidebar({ 
  selectedDiagnostico, 
  onSelectDiagnostico,
  userChats = []
}) {
  const [diagnosticos, setDiagnosticos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDiagnosticos();
  }, []);

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
      setDiagnosticos((data || []).filter(d => d.ativo));
    } catch (error) {
      console.error("Erro ao carregar diagnosticos:", error);
      setDiagnosticos([]);
    } finally {
      setLoading(false);
    }
  };

  // Contar chats por diagnóstico
  const getChatCountByDiagnostico = (codigo) => {
    if (!codigo) return userChats.length;
    return userChats.filter(chat => chat.diagnostico === codigo).length;
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-full overflow-y-auto" style={{minHeight: '100vh'}}>
      <div className="p-4">
        <div className="flex items-center space-x-2 border-b border-gray-200 w-full mx-auto px-4 py-6">
            <Avatar className="w-8 h-8 bg-secondary flex-shrink-0">
                <AvatarFallback className="bg-secondary text-white">
                <img src="https://nexialab.com.br/wp-content/uploads/2025/10/cropped-favicon-1.png" alt="Logo" className="w-4 h-4" />
                </AvatarFallback>
            </Avatar>
            <h1 className="text-lg font-semibold text-gray-900">Atendimento IA</h1>

        </div>

        <div className="flex items-center justify-between mt-5">
          <div className="flex items-center space-x-2">

            <h2 className="text-lg font-semibold text-gray-900">Filtrar por</h2>
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
        <p className="text-sm text-gray-500">Diagnóstico/Transtorno</p>
      </div>

      <div className="p-2">
        {loading ? (
          <div className="text-center py-4 text-gray-500 text-sm">
            Carregando...
          </div>
        ) : (
          <div className="space-y-1">
            {/* Opção "Todos" */}
            <button
              onClick={() => onSelectDiagnostico(null)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedDiagnostico === null
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center">
                  <Filter className="h-4 w-4 mr-2" />
                  Todos
                </span>
                <Badge variant="secondary" className="text-xs">
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
                  onClick={() => onSelectDiagnostico(diagnostico.codigo)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    isSelected
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate">{diagnostico.nome}</span>
                    <Badge 
                      variant={isSelected ? "default" : "secondary"} 
                      className="text-xs ml-2"
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
  );
}

