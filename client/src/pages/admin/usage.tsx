import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { adminService } from "@/services/adminService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

export default function AdminUsage() {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [userId, setUserId] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadHistory();
  }, [page, userId]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const data = await adminService.getUsageHistory(page, 50, {
        userId: userId || undefined,
      });
      setHistory(data.history || []);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao carregar histórico",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Histórico de Uso</h1>
          <p className="text-gray-600 mt-2">Visualize o histórico de uso do sistema</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Histórico</CardTitle>
              <Input
                placeholder="Filtrar por User ID..."
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-64"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Carregando...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>User ID</TableHead>
                    <TableHead>Chat ID</TableHead>
                    <TableHead>Remetente</TableHead>
                    <TableHead>Tipo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                        Nenhum histórico encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    history.map((item) => (
                      <TableRow key={item.id || `${item.chatId}-${item.createdAt}`}>
                        <TableCell>
                          {new Date(item.createdAt).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {item.userId?.substring(0, 8)}...
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {item.chatId?.substring(0, 12)}...
                        </TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              item.sender === "user"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {item.sender === "user" ? "Usuário" : "Assistente"}
                          </span>
                        </TableCell>
                        <TableCell>{item.messageType || "text"}</TableCell>
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




