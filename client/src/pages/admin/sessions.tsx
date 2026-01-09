import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { adminService } from "@/services/adminService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Eye, Download, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function AdminSessions() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [sessionMessages, setSessionMessages] = useState<any[]>([]);
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [diagnostico, setDiagnostico] = useState("");
  const [diagnosticos, setDiagnosticos] = useState<any[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadDiagnosticos();
  }, []);

  useEffect(() => {
    // Debounce email filter to avoid too many requests
    const timeoutId = setTimeout(() => {
      loadSessions();
    }, userEmail ? 500 : 0); // Wait 500ms if there's an email filter

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, userId, userEmail, diagnostico]);

  const loadDiagnosticos = async () => {
    try {
      const data = await adminService.getDiagnosticos();
      // Filtrar apenas diagnósticos ativos para manter consistência com o sidebar
      setDiagnosticos((data || []).filter((d: any) => d.ativo));
    } catch (error: any) {
      console.error("Erro ao carregar diagnósticos:", error);
    }
  };

  const loadSessions = async () => {
    try {
      setLoading(true);
      const filters = {
        userId: userId || undefined,
        userEmail: userEmail || undefined,
        diagnostico: diagnostico || undefined,
      };
      console.log("[AdminSessions] Loading sessions with filters:", filters);
      const data = await adminService.getSessions(page, 50, filters);
      console.log("[AdminSessions] Received", data.sessions?.length || 0, "sessions");
      console.log("[AdminSessions] First session sample:", data.sessions?.[0]);
      setSessions(data.sessions || []);
    } catch (error: any) {
      console.error("[AdminSessions] Error loading sessions:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao carregar sessões",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSessionMessages = async (chatId: string) => {
    try {
      const messages = await adminService.getSessionMessages(chatId);
      setSessionMessages(messages);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao carregar mensagens",
        variant: "destructive",
      });
    }
  };

  const handleViewSession = async (session: any) => {
    setSelectedSession(session);
    await loadSessionMessages(session.chatId);
  };

  const handleExportSession = async (chatId: string) => {
    try {
      await adminService.exportSessionMessages(chatId, "csv");
      toast({
        title: "Sucesso",
        description: "Mensagens exportadas com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao exportar mensagens",
        variant: "destructive",
      });
    }
  };

  const handleClearFilters = () => {
    setUserId("");
    setUserEmail("");
    setDiagnostico("");
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gerenciamento de Sessões</h1>
          <p className="text-gray-600 mt-2">Visualize e gerencie todas as sessões de chat</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Sessões</CardTitle>
              <div className="flex items-center space-x-2">
                <Input
                  placeholder="Filtrar por User ID..."
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="w-48"
                />
                <Input
                  placeholder="Filtrar por Email..."
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="w-64"
                />
                <Select 
                  value={diagnostico || "todos"} 
                  onValueChange={(value) => setDiagnostico(value === "todos" ? "" : value)}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Todos os diagnósticos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os diagnósticos</SelectItem>
                    {diagnosticos.map((diag) => (
                      <SelectItem key={diag.id} value={diag.codigo}>
                        {diag.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(userId || userEmail || diagnostico) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearFilters}
                    className="flex items-center space-x-1"
                  >
                    <X className="h-4 w-4" />
                    <span>Limpar</span>
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Carregando...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Chat ID</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Sessão</TableHead>
                    <TableHead>Diagnóstico</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        Nenhuma sessão encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    sessions.map((session) => (
                      <TableRow key={session.chatId}>
                        <TableCell className="font-mono text-xs">
                          {session.chatId.substring(0, 12)}...
                        </TableCell>
                        <TableCell className="text-sm">
                          {session.userEmail || "N/A"}
                        </TableCell>
                        <TableCell>{session.sessao || "N/A"}</TableCell>
                        <TableCell>{session.diagnostico || "N/A"}</TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              session.status === "finalizado"
                                ? "bg-green-100 text-green-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {session.status || "em_andamento"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {new Date(session.createdAt).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewSession(session)}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  Ver
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                                <DialogHeader>
                                  <DialogTitle>Detalhes da Sessão</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <h3 className="font-semibold mb-2">Informações da Sessão</h3>
                                    <div className="space-y-2 text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Chat ID:</span>
                                        <span className="font-mono text-xs">{session.chatId}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Sessão:</span>
                                        <span>{session.sessao || "N/A"}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Diagnóstico:</span>
                                        <span>{session.diagnostico || "N/A"}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Status:</span>
                                        <span>{session.status || "em_andamento"}</span>
                                      </div>
                                    </div>
                                  </div>
                                  <div>
                                    <h3 className="font-semibold mb-2">Mensagens ({sessionMessages.length})</h3>
                                    <div className="space-y-2 max-h-96 overflow-y-auto">
                                      {sessionMessages.map((msg) => (
                                        <div
                                          key={msg.id}
                                          className={`p-3 rounded-lg ${
                                            msg.sender === "user"
                                              ? "bg-blue-50"
                                              : "bg-gray-50"
                                          }`}
                                        >
                                          <div className="flex justify-between items-start mb-1">
                                            <span className="text-xs font-medium">
                                              {msg.sender === "user" ? "Usuário" : "Assistente"}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                              {new Date(msg.createdAt).toLocaleString("pt-BR")}
                                            </span>
                                          </div>
                                          <p className="text-sm">{msg.content}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleExportSession(session.chatId)}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Exportar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}




