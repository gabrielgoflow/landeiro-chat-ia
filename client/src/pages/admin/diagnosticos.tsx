import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { adminService } from "@/services/adminService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function AdminDiagnosticos() {
  const [diagnosticos, setDiagnosticos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadDiagnosticos();
  }, []);

  const loadDiagnosticos = async () => {
    try {
      setLoading(true);
      const stats = await adminService.getDiagnosticoStats();
      setDiagnosticos(stats);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao carregar transtornos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAtivo = async (id: string, currentAtivo: boolean) => {
    try {
      await adminService.updateDiagnostico(id, { ativo: !currentAtivo });
      toast({
        title: "Sucesso",
        description: `Transtorno ${!currentAtivo ? "ativado" : "desativado"} com sucesso`,
      });
      loadDiagnosticos();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao atualizar transtorno",
        variant: "destructive",
      });
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gerenciamento de Transtornos</h1>
          <p className="text-gray-600 mt-2">
            Ative ou desative transtornos disponíveis no sistema
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Transtornos Disponíveis</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Carregando...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Usuários com Acesso</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diagnosticos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                        Nenhum transtorno encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    diagnosticos.map((diagnostico) => (
                      <TableRow key={diagnostico.diagnosticoId}>
                        <TableCell className="font-medium">
                          {diagnostico.nome}
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {diagnostico.codigo}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={diagnostico.ativo ? "default" : "secondary"}
                            className={
                              diagnostico.ativo
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }
                          >
                            {diagnostico.ativo ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-gray-600">
                            {diagnostico.totalUsuarios || 0} usuário(s)
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Switch
                              id={`toggle-${diagnostico.diagnosticoId}`}
                              checked={diagnostico.ativo}
                              onCheckedChange={() =>
                                handleToggleAtivo(
                                  diagnostico.diagnosticoId,
                                  diagnostico.ativo
                                )
                              }
                            />
                            <Label
                              htmlFor={`toggle-${diagnostico.diagnosticoId}`}
                              className="text-sm text-gray-600"
                            >
                              {diagnostico.ativo ? "Ativo" : "Inativo"}
                            </Label>
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

