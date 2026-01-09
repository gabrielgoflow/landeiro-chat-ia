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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Search, Eye, Calendar, UserPlus, Upload, FileText, Download, X, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userDetails, setUserDetails] = useState<any>(null);
  const [dataFinalAcesso, setDataFinalAcesso] = useState("");
  const { toast } = useToast();

  // Modal de criação
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    email: "",
    password: "",
    fullName: "",
    dataFinalAcesso: "",
    status: "ativo",
  });
  const [creating, setCreating] = useState(false);

  // Modal de atualização em massa
  const [bulkUpdateModalOpen, setBulkUpdateModalOpen] = useState(false);
  const [bulkUpdateFile, setBulkUpdateFile] = useState<File | null>(null);
  const [bulkUpdatePreview, setBulkUpdatePreview] = useState<any[]>([]);
  const [bulkUpdateResult, setBulkUpdateResult] = useState<any>(null);
  const [bulkUpdateProcessing, setBulkUpdateProcessing] = useState(false);

  // Modal de criação em massa
  const [bulkCreateModalOpen, setBulkCreateModalOpen] = useState(false);
  const [bulkCreateFile, setBulkCreateFile] = useState<File | null>(null);
  const [bulkCreatePreview, setBulkCreatePreview] = useState<any[]>([]);
  const [bulkCreateResult, setBulkCreateResult] = useState<any>(null);
  const [bulkCreateProcessing, setBulkCreateProcessing] = useState(false);

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
      loadUsers();
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

  const handleDeleteUser = async (userId: string, email: string) => {
    try {
      await adminService.deleteUser(userId);
      toast({
        title: "Sucesso",
        description: `Usuário ${email} excluído com sucesso`,
      });
      loadUsers();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao excluir usuário",
        variant: "destructive",
      });
    }
  };

  // Criar usuário
  const handleCreateUser = async () => {
    if (!createForm.email) {
      toast({
        title: "Erro",
        description: "Email é obrigatório",
        variant: "destructive",
      });
      return;
    }

    try {
      setCreating(true);
      const result = await adminService.createUser({
        email: createForm.email,
        password: createForm.password || undefined, // Senha opcional, será gerada automaticamente
        fullName: createForm.fullName || undefined,
        dataFinalAcesso: createForm.dataFinalAcesso || undefined,
        status: createForm.status,
      });
      
      if (result.password) {
        toast({
          title: "Sucesso",
          description: `Usuário criado com sucesso! Senha gerada: ${result.password}`,
          duration: 10000, // Mostrar por mais tempo para o usuário copiar a senha
        });
      } else {
        toast({
          title: "Sucesso",
          description: "Usuário criado com sucesso",
        });
      }
      
      setCreateModalOpen(false);
      setCreateForm({
        email: "",
        password: "",
        fullName: "",
        dataFinalAcesso: "",
        status: "ativo",
      });
      loadUsers();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar usuário",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  // Download template para atualização em massa
  const downloadBulkUpdateTemplate = () => {
    const csv = "email,status\nusuario1@example.com,ativo\nusuario2@example.com,inadimplente";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template-atualizacao-status.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Processar arquivo de atualização em massa
  const handleBulkUpdateFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast({
        title: "Erro",
        description: "Por favor, selecione um arquivo CSV",
        variant: "destructive",
      });
      return;
    }

    setBulkUpdateFile(file);
    setBulkUpdateResult(null);

    // Preview do arquivo
    const text = await file.text();
    const lines = text.split("\n").filter((line) => line.trim());
    const headers = lines[0]?.split(",").map((h) => h.trim().toLowerCase());
    
    if (!headers?.includes("email") || !headers?.includes("status")) {
      toast({
        title: "Erro",
        description: "CSV deve conter as colunas: email, status",
        variant: "destructive",
      });
      setBulkUpdateFile(null);
      return;
    }

    const preview = lines.slice(1, 6).map((line) => {
      const values = line.split(",");
      return {
        email: values[0]?.trim() || "",
        status: values[1]?.trim() || "",
      };
    });

    setBulkUpdatePreview(preview);
  };

  // Processar atualização em massa
  const handleBulkUpdate = async () => {
    if (!bulkUpdateFile) return;

    try {
      setBulkUpdateProcessing(true);
      const result = await adminService.bulkUpdateUserStatus(bulkUpdateFile);
      setBulkUpdateResult(result);
      toast({
        title: "Processamento concluído",
        description: `${result.success} atualizados com sucesso, ${result.failed} falharam`,
      });
      loadUsers();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao processar atualização em massa",
        variant: "destructive",
      });
    } finally {
      setBulkUpdateProcessing(false);
    }
  };

  // Download template para criação em massa
  const downloadBulkCreateTemplate = () => {
    const csv = "email,senha,nome,dataFinalAcesso\nusuario1@example.com,senha123,Nome Usuario 1,2024-12-31\nusuario2@example.com,,Nome Usuario 2,\nusuario3@example.com,,,";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template-criacao-usuarios.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Processar arquivo de criação em massa
  const handleBulkCreateFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast({
        title: "Erro",
        description: "Por favor, selecione um arquivo CSV",
        variant: "destructive",
      });
      return;
    }

    setBulkCreateFile(file);
    setBulkCreateResult(null);

    // Preview do arquivo
    const text = await file.text();
    const lines = text.split("\n").filter((line) => line.trim());
    const headers = lines[0]?.split(",").map((h) => h.trim().toLowerCase());
    
    if (!headers?.includes("email")) {
      toast({
        title: "Erro",
        description: "CSV deve conter a coluna: email (obrigatório). Colunas opcionais: senha, nome, datafinalacesso",
        variant: "destructive",
      });
      setBulkCreateFile(null);
      return;
    }

    const preview = lines.slice(1, 6).map((line) => {
      const values = line.split(",");
      const senhaIndex = headers.indexOf("senha");
      return {
        email: values[0]?.trim() || "",
        senha: senhaIndex >= 0 && values[senhaIndex]?.trim() ? "***" : "(gerada automaticamente)",
        nome: headers.indexOf("nome") >= 0 ? values[headers.indexOf("nome")]?.trim() || "" : "",
        dataFinalAcesso: headers.indexOf("datafinalacesso") >= 0 ? values[headers.indexOf("datafinalacesso")]?.trim() || "" : "",
      };
    });

    setBulkCreatePreview(preview);
  };

  // Processar criação em massa
  const handleBulkCreate = async () => {
    if (!bulkCreateFile) return;

    try {
      setBulkCreateProcessing(true);
      const result = await adminService.bulkCreateUsers(bulkCreateFile);
      setBulkCreateResult(result);
      
      // Contar quantas senhas foram geradas
      const generatedPasswords = result.results?.filter((r: any) => r.generatedPassword).length || 0;
      
      let description = `${result.success} usuários criados com sucesso, ${result.failed} falharam`;
      if (generatedPasswords > 0) {
        description += `. ${generatedPasswords} senha(s) gerada(s) automaticamente - veja os detalhes abaixo.`;
      }
      
      toast({
        title: "Processamento concluído",
        description: description,
        duration: 8000,
      });
      loadUsers();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao processar criação em massa",
        variant: "destructive",
      });
    } finally {
      setBulkCreateProcessing(false);
    }
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
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle>Usuários</CardTitle>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
                  <DialogTrigger asChild>
                    <Button className="whitespace-nowrap">
                      <UserPlus className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Criar Usuário</span>
                      <span className="sm:hidden">Criar</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Criar Novo Usuário</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="email">Email *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={createForm.email}
                          onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                          placeholder="usuario@example.com"
                        />
                      </div>
                      <div>
                        <Label htmlFor="password">Senha</Label>
                        <Input
                          id="password"
                          type="password"
                          value={createForm.password}
                          onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                          placeholder="Deixe em branco para gerar automaticamente"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Se não preenchida, uma senha segura será gerada automaticamente
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="fullName">Nome Completo</Label>
                        <Input
                          id="fullName"
                          value={createForm.fullName}
                          onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                          placeholder="Nome do usuário"
                        />
                      </div>
                      <div>
                        <Label htmlFor="dataFinalAcesso">Data Final de Acesso</Label>
                        <Input
                          id="dataFinalAcesso"
                          type="date"
                          value={createForm.dataFinalAcesso}
                          onChange={(e) => setCreateForm({ ...createForm, dataFinalAcesso: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="status">Status</Label>
                        <Select
                          value={createForm.status}
                          onValueChange={(value) => setCreateForm({ ...createForm, status: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ativo">Ativo</SelectItem>
                            <SelectItem value="inadimplente">Inadimplente</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setCreateModalOpen(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleCreateUser} disabled={creating}>
                          {creating ? "Criando..." : "Criar"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={bulkUpdateModalOpen} onOpenChange={setBulkUpdateModalOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="whitespace-nowrap">
                      <Upload className="h-4 w-4 mr-2" />
                      <span className="hidden lg:inline">Atualizar Status em Massa</span>
                      <span className="lg:hidden">Atualizar Status</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Atualizar Status em Massa</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Arquivo CSV</Label>
                        <div className="flex items-center space-x-2">
                          <Input
                            type="file"
                            accept=".csv"
                            onChange={handleBulkUpdateFileChange}
                            className="flex-1"
                          />
                          <Button variant="outline" size="sm" onClick={downloadBulkUpdateTemplate}>
                            <Download className="h-4 w-4 mr-2" />
                            Template
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Formato esperado: email,status (header obrigatório)
                        </p>
                      </div>

                      {bulkUpdatePreview.length > 0 && (
                        <div>
                          <Label>Preview (primeiras 5 linhas)</Label>
                          <div className="border rounded p-2 max-h-40 overflow-auto">
                            <div className="min-w-full inline-block">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Status</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {bulkUpdatePreview.map((row, idx) => (
                                    <TableRow key={idx}>
                                      <TableCell>{row.email}</TableCell>
                                      <TableCell>{row.status}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        </div>
                      )}

                      {bulkUpdateResult && (
                        <div>
                          <Label>Resultado do Processamento</Label>
                          <div className="border rounded p-4 space-y-2">
                            <div className="flex justify-between">
                              <span>Total:</span>
                              <span className="font-medium">{bulkUpdateResult.total}</span>
                            </div>
                            <div className="flex justify-between text-green-600">
                              <span>Sucessos:</span>
                              <span className="font-medium">{bulkUpdateResult.success}</span>
                            </div>
                            <div className="flex justify-between text-red-600">
                              <span>Falhas:</span>
                              <span className="font-medium">{bulkUpdateResult.failed}</span>
                            </div>
                            {bulkUpdateResult.results && bulkUpdateResult.results.length > 0 && (
                              <div className="mt-4 max-h-60 overflow-auto">
                                <Label>Detalhes</Label>
                                <div className="min-w-full inline-block">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Erro</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {bulkUpdateResult.results.slice(0, 20).map((r: any, idx: number) => (
                                        <TableRow key={idx}>
                                          <TableCell>{r.email}</TableCell>
                                          <TableCell>
                                            {r.success ? (
                                              <span className="text-green-600">✓ Sucesso</span>
                                            ) : (
                                              <span className="text-red-600">✗ Falhou</span>
                                            )}
                                          </TableCell>
                                          <TableCell className="text-xs text-red-600">
                                            {r.error || "-"}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => {
                          setBulkUpdateModalOpen(false);
                          setBulkUpdateFile(null);
                          setBulkUpdatePreview([]);
                          setBulkUpdateResult(null);
                        }}>
                          Fechar
                        </Button>
                        <Button
                          onClick={handleBulkUpdate}
                          disabled={!bulkUpdateFile || bulkUpdateProcessing}
                        >
                          {bulkUpdateProcessing ? "Processando..." : "Processar"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog open={bulkCreateModalOpen} onOpenChange={setBulkCreateModalOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="whitespace-nowrap">
                      <UserPlus className="h-4 w-4 mr-2" />
                      <span className="hidden lg:inline">Criar Usuários em Massa</span>
                      <span className="lg:hidden">Criar em Massa</span>
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Criar Usuários em Massa</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Arquivo CSV</Label>
                        <div className="flex items-center space-x-2">
                          <Input
                            type="file"
                            accept=".csv"
                            onChange={handleBulkCreateFileChange}
                            className="flex-1"
                          />
                          <Button variant="outline" size="sm" onClick={downloadBulkCreateTemplate}>
                            <Download className="h-4 w-4 mr-2" />
                            Template
                          </Button>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Formato esperado: email (obrigatório), senha (opcional - será gerada se não fornecida), nome (opcional), dataFinalAcesso (opcional)
                        </p>
                      </div>

                      {bulkCreatePreview.length > 0 && (
                        <div>
                          <Label>Preview (primeiras 5 linhas)</Label>
                          <div className="border rounded p-2 max-h-40 overflow-auto">
                            <div className="min-w-full inline-block">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Senha</TableHead>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Data Final</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {bulkCreatePreview.map((row, idx) => (
                                    <TableRow key={idx}>
                                      <TableCell>{row.email}</TableCell>
                                      <TableCell className="text-xs text-gray-500">
                                        {row.senha}
                                      </TableCell>
                                      <TableCell>{row.nome || "-"}</TableCell>
                                      <TableCell>{row.dataFinalAcesso || "-"}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </div>
                        </div>
                      )}

                      {bulkCreateResult && (
                        <div>
                          <Label>Resultado do Processamento</Label>
                          <div className="border rounded p-4 space-y-2">
                            <div className="flex justify-between">
                              <span>Total:</span>
                              <span className="font-medium">{bulkCreateResult.total}</span>
                            </div>
                            <div className="flex justify-between text-green-600">
                              <span>Sucessos:</span>
                              <span className="font-medium">{bulkCreateResult.success}</span>
                            </div>
                            <div className="flex justify-between text-red-600">
                              <span>Falhas:</span>
                              <span className="font-medium">{bulkCreateResult.failed}</span>
                            </div>
                            {bulkCreateResult.results && bulkCreateResult.results.length > 0 && (
                              <div className="mt-4 max-h-60 overflow-auto">
                                <Label>Detalhes</Label>
                                <div className="min-w-full inline-block">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Senha Gerada</TableHead>
                                        <TableHead>Erro</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {bulkCreateResult.results.slice(0, 20).map((r: any, idx: number) => (
                                        <TableRow key={idx}>
                                          <TableCell>{r.email}</TableCell>
                                          <TableCell>
                                            {r.success ? (
                                              <span className="text-green-600">✓ Sucesso</span>
                                            ) : (
                                              <span className="text-red-600">✗ Falhou</span>
                                            )}
                                          </TableCell>
                                          <TableCell className="text-xs font-mono">
                                            {r.generatedPassword ? (
                                              <span className="text-blue-600 font-semibold">{r.generatedPassword}</span>
                                            ) : (
                                              <span className="text-gray-400">-</span>
                                            )}
                                          </TableCell>
                                          <TableCell className="text-xs text-red-600">
                                            {r.error || "-"}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => {
                          setBulkCreateModalOpen(false);
                          setBulkCreateFile(null);
                          setBulkCreatePreview([]);
                          setBulkCreateResult(null);
                        }}>
                          Fechar
                        </Button>
                        <Button
                          onClick={handleBulkCreate}
                          disabled={!bulkCreateFile || bulkCreateProcessing}
                        >
                          {bulkCreateProcessing ? "Processando..." : "Processar"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <div className="relative w-full sm:w-64 min-w-0">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar usuários..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10 w-full"
                  />
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Carregando...</div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Email Confirmado</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        Nenhum usuário encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((user) => (
                      <TableRow key={user.userId}>
                        <TableCell className="font-medium min-w-[200px]">{user.email || "N/A"}</TableCell>
                        <TableCell className="min-w-[150px]">{user.fullName || "N/A"}</TableCell>
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
                              user.status === "ativo"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {user.status === "ativo" ? "Ativo" : "Inadimplente"}
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
                          <div className="flex items-center space-x-2">
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
                                        <span className="text-gray-600">Status:</span>
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                                          userDetails.metadata?.status === "ativo"
                                            ? "bg-green-100 text-green-800"
                                            : "bg-red-100 text-red-800"
                                        }`}>
                                          {userDetails.metadata?.status === "ativo" ? "Ativo" : "Inadimplente"}
                                        </span>
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
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Tem certeza que deseja excluir o usuário <strong>{user.email}</strong>?
                                  Esta ação não pode ser desfeita e todos os dados do usuário serão permanentemente removidos.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteUser(user.userId, user.email)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Excluir
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
