import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { History, RotateCcw, Search, Filter, Trash2, MessageSquare, FileText, User } from "lucide-react";

interface AuditLog {
  id: string;
  adminUserId: string;
  adminEmail?: string;
  action: string;
  targetUserId?: string;
  targetEmail?: string;
  details: any;
  createdAt: string;
}

interface DeletedItem {
  id: string;
  chat_id?: string;
  sessao?: number;
  diagnostico?: string;
  email?: string;
  full_name?: string;
  message_count?: number;
  deleted_at: string;
  deleted_by?: string;
}

export default function AdminAuditLogs() {
  const [activeTab, setActiveTab] = useState("logs");
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [deletedItems, setDeletedItems] = useState<DeletedItem[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  
  // Filters
  const [actionFilter, setActionFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [deletedType, setDeletedType] = useState("threads");
  
  const { toast } = useToast();

  useEffect(() => {
    loadActions();
  }, []);

  useEffect(() => {
    if (activeTab === "logs") {
      loadLogs();
    } else {
      loadDeletedItems();
    }
  }, [activeTab, page, actionFilter, fromDate, toDate, deletedType]);

  const loadActions = async () => {
    try {
      const response = await fetch("/api/admin/audit-logs/actions", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("supabase.auth.token") || ""}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setActions(data);
      }
    } catch (error) {
      console.error("Erro ao carregar ações:", error);
    }
  };

  const loadLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", "25");
      if (actionFilter) params.append("action", actionFilter);
      if (fromDate) params.append("from", fromDate);
      if (toDate) params.append("to", toDate);

      const response = await fetch(`/api/admin/audit-logs?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("supabase.auth.token") || ""}`,
        },
      });

      if (!response.ok) throw new Error("Erro ao carregar logs");

      const data = await response.json();
      setLogs(data.logs || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (error: any) {
      console.error("Erro ao carregar logs:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao carregar audit logs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDeletedItems = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", "25");

      const response = await fetch(`/api/admin/deleted/${deletedType}?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("supabase.auth.token") || ""}`,
        },
      });

      if (!response.ok) throw new Error("Erro ao carregar itens deletados");

      const data = await response.json();
      setDeletedItems(data.items || []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (error: any) {
      console.error("Erro ao carregar itens deletados:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao carregar itens deletados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (item: DeletedItem, type: string) => {
    try {
      let endpoint = "";
      let body: any = {};

      switch (type) {
        case "threads":
          endpoint = `/api/admin/restore/thread/${item.id}`;
          break;
        case "messages":
          endpoint = `/api/admin/restore/messages/${item.chat_id}`;
          body = { sessao: item.sessao };
          break;
        case "reviews":
          endpoint = `/api/admin/restore/review/${item.id}`;
          break;
        case "users":
          endpoint = `/api/admin/restore/user/${item.id}`;
          break;
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("supabase.auth.token") || ""}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao restaurar");
      }

      const result = await response.json();

      toast({
        title: "Sucesso",
        description: type === "users" 
          ? `Metadados do usuário recuperados. ${result.note || ""}`
          : "Item restaurado com sucesso!",
      });

      // Recarregar lista
      loadDeletedItems();
    } catch (error: any) {
      console.error("Erro ao restaurar:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao restaurar item",
        variant: "destructive",
      });
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  };

  const getActionBadgeVariant = (action: string) => {
    if (action.includes("delete")) return "destructive";
    if (action.includes("restore")) return "default";
    if (action.includes("create")) return "secondary";
    if (action.includes("update")) return "outline";
    return "secondary";
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "threads":
        return <FileText className="h-4 w-4" />;
      case "messages":
        return <MessageSquare className="h-4 w-4" />;
      case "reviews":
        return <FileText className="h-4 w-4" />;
      case "users":
        return <User className="h-4 w-4" />;
      default:
        return <Trash2 className="h-4 w-4" />;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <History className="h-8 w-8" />
            Audit Logs e Recuperação
          </h1>
          <p className="text-muted-foreground">
            Visualize o histórico de ações e recupere dados deletados
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setPage(1); }}>
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="logs">Audit Logs</TabsTrigger>
            <TabsTrigger value="deleted">Itens Deletados</TabsTrigger>
          </TabsList>

          <TabsContent value="logs" className="space-y-4">
            {/* Filtros */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Filtros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label>Ação</Label>
                    <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v === "all" ? "" : v); setPage(1); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todas as ações" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as ações</SelectItem>
                        {actions.map((action) => (
                          <SelectItem key={action} value={action}>
                            {action}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Data inicial</Label>
                    <Input
                      type="date"
                      value={fromDate}
                      onChange={(e) => { setFromDate(e.target.value); setPage(1); }}
                    />
                  </div>
                  <div>
                    <Label>Data final</Label>
                    <Input
                      type="date"
                      value={toDate}
                      onChange={(e) => { setToDate(e.target.value); setPage(1); }}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setActionFilter("");
                        setFromDate("");
                        setToDate("");
                        setPage(1);
                      }}
                    >
                      Limpar filtros
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabela de Logs */}
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Ações ({total})</CardTitle>
                <CardDescription>
                  Registro de todas as ações realizadas no sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">Carregando...</div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum log encontrado
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Ação</TableHead>
                        <TableHead>Admin</TableHead>
                        <TableHead>Alvo</TableHead>
                        <TableHead>Detalhes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="whitespace-nowrap">
                            {formatDate(log.createdAt)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getActionBadgeVariant(log.action)}>
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {log.adminEmail || log.adminUserId?.slice(0, 8)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {log.targetEmail || log.targetUserId?.slice(0, 8) || "-"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-muted p-1 rounded max-w-xs truncate block">
                              {JSON.stringify(log.details).slice(0, 100)}
                              {JSON.stringify(log.details).length > 100 ? "..." : ""}
                            </code>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {/* Paginação */}
                {totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                    >
                      Anterior
                    </Button>
                    <span className="py-2 px-4 text-sm">
                      Página {page} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      Próxima
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="deleted" className="space-y-4">
            {/* Seletor de tipo */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RotateCcw className="h-5 w-5" />
                  Recuperar Dados Deletados
                </CardTitle>
                <CardDescription>
                  Selecione o tipo de dado para visualizar e restaurar
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  {["threads", "messages", "reviews", "users"].map((type) => (
                    <Button
                      key={type}
                      variant={deletedType === type ? "default" : "outline"}
                      onClick={() => { setDeletedType(type); setPage(1); }}
                      className="flex items-center gap-2"
                    >
                      {getTypeIcon(type)}
                      {type === "threads" && "Sessões"}
                      {type === "messages" && "Mensagens"}
                      {type === "reviews" && "Reviews"}
                      {type === "users" && "Usuários"}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Tabela de itens deletados */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {deletedType === "threads" && "Sessões Deletadas"}
                  {deletedType === "messages" && "Mensagens Deletadas"}
                  {deletedType === "reviews" && "Reviews Deletadas"}
                  {deletedType === "users" && "Usuários Deletados"}
                  {" "}({total})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8">Carregando...</div>
                ) : deletedItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum item deletado encontrado
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {deletedType === "threads" && (
                          <>
                            <TableHead>Chat ID</TableHead>
                            <TableHead>Sessão</TableHead>
                            <TableHead>Diagnóstico</TableHead>
                            <TableHead>Deletado em</TableHead>
                            <TableHead>Ações</TableHead>
                          </>
                        )}
                        {deletedType === "messages" && (
                          <>
                            <TableHead>Chat ID</TableHead>
                            <TableHead>Sessão</TableHead>
                            <TableHead>Qtd. Mensagens</TableHead>
                            <TableHead>Deletado em</TableHead>
                            <TableHead>Ações</TableHead>
                          </>
                        )}
                        {deletedType === "reviews" && (
                          <>
                            <TableHead>Chat ID</TableHead>
                            <TableHead>Sessão</TableHead>
                            <TableHead>Deletado em</TableHead>
                            <TableHead>Ações</TableHead>
                          </>
                        )}
                        {deletedType === "users" && (
                          <>
                            <TableHead>Email</TableHead>
                            <TableHead>Nome</TableHead>
                            <TableHead>Deletado em</TableHead>
                            <TableHead>Ações</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deletedItems.map((item) => (
                        <TableRow key={item.id}>
                          {deletedType === "threads" && (
                            <>
                              <TableCell className="font-mono text-xs">
                                {item.chat_id?.slice(0, 20)}...
                              </TableCell>
                              <TableCell>{item.sessao}</TableCell>
                              <TableCell>{item.diagnostico || "-"}</TableCell>
                              <TableCell>{formatDate(item.deleted_at)}</TableCell>
                            </>
                          )}
                          {deletedType === "messages" && (
                            <>
                              <TableCell className="font-mono text-xs">
                                {item.chat_id?.slice(0, 20)}...
                              </TableCell>
                              <TableCell>{item.sessao}</TableCell>
                              <TableCell>{item.message_count}</TableCell>
                              <TableCell>{formatDate(item.deleted_at)}</TableCell>
                            </>
                          )}
                          {deletedType === "reviews" && (
                            <>
                              <TableCell className="font-mono text-xs">
                                {item.chat_id?.slice(0, 20)}...
                              </TableCell>
                              <TableCell>{item.sessao}</TableCell>
                              <TableCell>{formatDate(item.deleted_at)}</TableCell>
                            </>
                          )}
                          {deletedType === "users" && (
                            <>
                              <TableCell>{item.email}</TableCell>
                              <TableCell>{item.full_name || "-"}</TableCell>
                              <TableCell>{formatDate(item.deleted_at)}</TableCell>
                            </>
                          )}
                          <TableCell>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="outline" className="flex items-center gap-1">
                                  <RotateCcw className="h-3 w-3" />
                                  Restaurar
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirmar Restauração</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {deletedType === "users" 
                                      ? "Isso irá recuperar os metadados do usuário. O usuário precisa ser recriado manualmente no Supabase Auth."
                                      : "Isso irá restaurar o item para o banco de dados original. Tem certeza?"}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleRestore(item, deletedType)}>
                                    Restaurar
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {/* Paginação */}
                {totalPages > 1 && (
                  <div className="flex justify-center gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                    >
                      Anterior
                    </Button>
                    <span className="py-2 px-4 text-sm">
                      Página {page} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      Próxima
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
