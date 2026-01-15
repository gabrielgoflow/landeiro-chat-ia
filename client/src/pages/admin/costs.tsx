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
import { DollarSign } from "lucide-react";

export default function AdminCosts() {
  const [costs, setCosts] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [userId, setUserId] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    loadCosts();
    loadSummary();
  }, [page, userId]);

  const loadCosts = async () => {
    try {
      setLoading(true);
      const data = await adminService.getCosts(page, 50, {
        userId: userId || undefined,
      });
      setCosts(data.costs || []);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao carregar custos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    try {
      const data = await adminService.getCostSummary({
        userId: userId || undefined,
      });
      setSummary(data);
    } catch (error: any) {
      console.error("Error loading summary:", error);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestão de Custos</h1>
          <p className="text-gray-600 mt-2">Monitore os custos por usuário e sessão</p>
        </div>

        {summary && (
          <div className="grid gap-6 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Custo Total</CardTitle>
                <DollarSign className="h-5 w-5 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  $ {Number(summary.totalCost || 0).toFixed(2)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total de Sessões</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalSessions || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Chamadas API</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalApiCalls || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tokens (I/O)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Number(summary.totalTokensInput || 0).toLocaleString()} /{" "}
                  {Number(summary.totalTokensOutput || 0).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Custos por Sessão</CardTitle>
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
                    <TableHead>Chat ID</TableHead>
                    <TableHead>Sessão</TableHead>
                    <TableHead>Custo</TableHead>
                    <TableHead>Tokens (I/O)</TableHead>
                    <TableHead>Chamadas API</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        Nenhum custo encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    costs.map((cost) => (
                      <TableRow key={cost.id}>
                        <TableCell className="font-mono text-xs">
                          {cost.chatId?.substring(0, 12)}...
                        </TableCell>
                        <TableCell>{cost.sessao || "N/A"}</TableCell>
                        <TableCell className="font-semibold">
                          $ {Number(cost.costAmount || 0).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {Number(cost.tokensInput || 0).toLocaleString()} /{" "}
                          {Number(cost.tokensOutput || 0).toLocaleString()}
                        </TableCell>
                        <TableCell>{cost.apiCalls || 0}</TableCell>
                        <TableCell>
                          {new Date(cost.createdAt).toLocaleDateString("pt-BR")}
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




