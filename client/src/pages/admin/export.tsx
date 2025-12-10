import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { adminService } from "@/services/adminService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useToast } from "@/hooks/use-toast";
import { Download } from "lucide-react";

export default function AdminExport() {
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    userId: "",
    chatId: "",
    startDate: "",
    endDate: "",
    format: "csv" as "csv" | "json",
  });
  const { toast } = useToast();

  const handleExport = async () => {
    try {
      setLoading(true);
      await adminService.exportMessages({
        userId: filters.userId || undefined,
        chatId: filters.chatId || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        format: filters.format,
      });
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
    } finally {
      setLoading(false);
    }
  };

  const handleExportUser = async () => {
    if (!filters.userId) {
      toast({
        title: "Erro",
        description: "Por favor, informe o User ID",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      await adminService.exportUserMessages(filters.userId, filters.format);
      toast({
        title: "Sucesso",
        description: "Mensagens do usuário exportadas com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao exportar mensagens",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportSession = async () => {
    if (!filters.chatId) {
      toast({
        title: "Erro",
        description: "Por favor, informe o Chat ID",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      await adminService.exportSessionMessages(filters.chatId, filters.format);
      toast({
        title: "Sucesso",
        description: "Mensagens da sessão exportadas com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao exportar mensagens",
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
          <h1 className="text-3xl font-bold text-gray-900">Exportação de Mensagens</h1>
          <p className="text-gray-600 mt-2">
            Exporte mensagens para auditoria em formato CSV ou JSON
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filtros de Exportação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="userId">User ID (opcional)</Label>
                <Input
                  id="userId"
                  placeholder="UUID do usuário"
                  value={filters.userId}
                  onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="chatId">Chat ID (opcional)</Label>
                <Input
                  id="chatId"
                  placeholder="ID da sessão"
                  value={filters.chatId}
                  onChange={(e) => setFilters({ ...filters, chatId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate">Data Inicial (opcional)</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Data Final (opcional)</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="format">Formato</Label>
                <Select
                  value={filters.format}
                  onValueChange={(value: "csv" | "json") =>
                    setFilters({ ...filters, format: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex space-x-4 pt-4">
              <Button onClick={handleExport} disabled={loading}>
                <Download className="h-4 w-4 mr-2" />
                Exportar Todas as Mensagens
              </Button>
              <Button
                variant="outline"
                onClick={handleExportUser}
                disabled={loading || !filters.userId}
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar por Usuário
              </Button>
              <Button
                variant="outline"
                onClick={handleExportSession}
                disabled={loading || !filters.chatId}
              >
                <Download className="h-4 w-4 mr-2" />
                Exportar por Sessão
              </Button>
            </div>

            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold mb-2">Informações sobre Exportação</h3>
              <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                <li>
                  <strong>CSV:</strong> Formato adequado para planilhas e análise em Excel
                </li>
                <li>
                  <strong>JSON:</strong> Formato completo com todos os metadados
                </li>
                <li>
                  As exportações incluem todas as mensagens (usuário e assistente) com
                  timestamps
                </li>
                <li>
                  Use os filtros para exportar mensagens específicas por usuário, sessão ou
                  período
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}




