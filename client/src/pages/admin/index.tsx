import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { StatsCards } from "@/components/admin/StatsCards";
import { adminService } from "@/services/adminService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalSessions: 0,
    totalMessages: 0,
    totalCost: 0,
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await adminService.getSystemStats();
      setStats(data);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao carregar estatísticas",
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
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Administrativo</h1>
          <p className="text-gray-600 mt-2">Visão geral do sistema</p>
        </div>

        <StatsCards stats={stats} loading={loading} />

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Informações do Sistema</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total de Usuários:</span>
                  <span className="font-semibold">{stats.totalUsers}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total de Sessões:</span>
                  <span className="font-semibold">{stats.totalSessions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total de Mensagens:</span>
                  <span className="font-semibold">{stats.totalMessages}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Custo Total:</span>
                  <span className="font-semibold">
                    R$ {stats.totalCost.toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm text-gray-600">
                  Use o menu lateral para navegar entre as diferentes seções do painel administrativo.
                </p>
                <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                  <li>Gerenciar usuários e suas permissões</li>
                  <li>Visualizar e gerenciar sessões de chat</li>
                  <li>Consultar histórico de uso</li>
                  <li>Monitorar custos por usuário e sessão</li>
                  <li>Exportar mensagens para auditoria</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}




