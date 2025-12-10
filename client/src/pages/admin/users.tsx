import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { adminService } from "@/services/adminService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Search, Eye, Edit, Calendar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [dataFinalAcesso, setDataFinalAcesso] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadUsers();
  }, [page, search]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await adminService.getUsers(page, 50, search || undefined);
      setUsers(data.users || []);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao carregar usuários",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUserDetails = async (userId: string) => {
    try {
      const details = await adminService.getUserDetails(userId);
      setUserDetails(details);
      
      // Carregar data final de acesso
      if (details.metadata?.dataFinalAcesso) {
        const date = new Date(details.metadata.dataFinalAcesso);
        setDataFinalAcesso(date.toISOString().split('T')[0]);
      } else {
        setDataFinalAcesso("");
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao carregar detalhes do usuário",
        variant: "destructive",
      });
    }
  };

  const handleUpdateAccessDate = async (userId: string) => {
    try {
      await adminService.updateUserAccessDate(userId, dataFinalAcesso);
      toast({
        title: "Sucesso",
        description: "Data final de acesso atualizada com sucesso",
      });
      loadUserDetails(userId);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar data de acesso",
        variant: "destructive",
      });
    }
  };


  const handleViewUser = async (user: any) => {
    setSelectedUser(user);
    await loadUserDetails(user.userId);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gerenciamento de Usuários</h1>
          <p className="text-gray-600 mt-2">Visualize e gerencie todos os usuários do sistema</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Usuários</CardTitle>
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar usuários..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
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
                    <TableHead>Email</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        Nenhum usuário encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => (
                      <TableRow key={user.userId}>
                        <TableCell className="font-medium">{user.email || "N/A"}</TableCell>
                        <TableCell>{user.fullName || "N/A"}</TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              user.role === "admin"
                                ? "bg-red-100 text-red-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {user.role || "user"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              user.emailConfirmed
                                ? "bg-green-100 text-green-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {user.emailConfirmed ? "Confirmado" : "Pendente"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {user.createdAt
                            ? new Date(user.createdAt).toLocaleDateString("pt-BR")
                            : "N/A"}
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewUser(user)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                Ver
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Detalhes do Usuário</DialogTitle>
                              </DialogHeader>
                              {userDetails && (
                                <div className="space-y-4">
                                  <div>
                                    <h3 className="font-semibold mb-2">Informações Básicas</h3>
                                    <div className="space-y-2 text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">ID:</span>
                                        <span className="font-mono text-xs">{selectedUser?.userId}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Email:</span>
                                        <span>{userDetails.authUser?.email || "N/A"}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Nome:</span>
                                        <span>{userDetails.metadata?.fullName || userDetails.authUser?.email?.split("@")[0] || "N/A"}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Role:</span>
                                        <span>{userDetails.metadata?.role || "user"}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Email Confirmado:</span>
                                        <span>{userDetails.authUser?.emailConfirmed ? "Sim" : "Não"}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Último Login:</span>
                                        <span>
                                          {userDetails.authUser?.lastSignIn
                                            ? new Date(userDetails.authUser.lastSignIn).toLocaleString("pt-BR")
                                            : "Nunca"}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <div>
                                    <h3 className="font-semibold mb-2">Estatísticas</h3>
                                    <div className="space-y-2 text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Total de Sessões:</span>
                                        <span>{userDetails.sessions || 0}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Total de Mensagens:</span>
                                        <span>{userDetails.messagesCount || 0}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-600">Custo Total:</span>
                                        <span>R$ {userDetails.totalCost?.toFixed(2) || "0,00"}</span>
                                      </div>
                                    </div>
                                  </div>

                                  {userDetails.sessionsByDiagnostico && userDetails.sessionsByDiagnostico.length > 0 && (
                                    <div>
                                      <h3 className="font-semibold mb-2">Sessões por Transtorno</h3>
                                      <div className="space-y-2">
                                        {userDetails.sessionsByDiagnostico.map((stat: any, index: number) => (
                                          <div
                                            key={index}
                                            className="flex justify-between items-center p-2 bg-gray-50 rounded"
                                          >
                                            <span className="text-sm font-medium">{stat.diagnostico}</span>
                                            <span className="text-sm text-gray-600">{stat.count} sessões</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                  
                                  <div>
                                    <h3 className="font-semibold mb-2">Data Final de Acesso</h3>
                                    <div className="space-y-2">
                                      <p className="text-sm text-gray-600 mb-2">
                                        Todos os transtornos ativos estão liberados para este usuário. 
                                        O acesso é controlado apenas pela data final de acesso.
                                      </p>
                                      <div className="flex items-center space-x-2">
                                        <Input
                                          type="date"
                                          value={dataFinalAcesso}
                                          onChange={(e) => setDataFinalAcesso(e.target.value)}
                                          className="flex-1"
                                        />
                                        <Button
                                          size="sm"
                                          onClick={() => handleUpdateAccessDate(selectedUser.userId)}
                                        >
                                          <Calendar className="h-4 w-4 mr-2" />
                                          Atualizar
                                        </Button>
                                      </div>
                                      {userDetails.metadata?.dataFinalAcesso ? (
                                        <p className="text-xs text-gray-500">
                                          Atual: {new Date(userDetails.metadata.dataFinalAcesso).toLocaleDateString("pt-BR")}
                                        </p>
                                      ) : (
                                        <p className="text-xs text-gray-500">
                                          Sem data definida - acesso ilimitado
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
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




