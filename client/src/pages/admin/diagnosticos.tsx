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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function AdminDiagnosticos() {
  const [diagnosticos, setDiagnosticos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    codigo: "",
    ativo: true,
    apenas_teste: false,
  });
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

  const handleToggleApenasTeste = async (id: string, currentApenasTeste: boolean) => {
    try {
      await adminService.updateDiagnostico(id, { apenas_teste: !currentApenasTeste });
      toast({
        title: "Sucesso",
        description: `Transtorno ${!currentApenasTeste ? "marcado como teste" : "removido de teste"} com sucesso`,
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

  const handleCreateDiagnostico = async () => {
    if (!formData.nome || !formData.codigo) {
      toast({
        title: "Erro",
        description: "Nome e código são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      setCreating(true);
      await adminService.createDiagnostico(formData);
      toast({
        title: "Sucesso",
        description: "Transtorno criado com sucesso",
      });
      setShowCreateDialog(false);
      setFormData({ nome: "", codigo: "", ativo: true, apenas_teste: false });
      loadDiagnosticos();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar transtorno",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
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
            <div className="flex items-center justify-between">
              <CardTitle>Transtornos Disponíveis</CardTitle>
              <Button onClick={() => setShowCreateDialog(true)}>
                Novo Diagnóstico
              </Button>
            </div>
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
                    <TableHead>Apenas Teste</TableHead>
                    <TableHead>Usuários com Acesso</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {diagnosticos.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
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
                          <div className="flex items-center space-x-2">
                            <Switch
                              id={`toggle-teste-${diagnostico.diagnosticoId}`}
                              checked={diagnostico.apenas_teste || false}
                              onCheckedChange={() =>
                                handleToggleApenasTeste(
                                  diagnostico.diagnosticoId,
                                  diagnostico.apenas_teste || false
                                )
                              }
                            />
                            <Label
                              htmlFor={`toggle-teste-${diagnostico.diagnosticoId}`}
                              className="text-sm text-gray-600"
                            >
                              {diagnostico.apenas_teste ? "Sim" : "Não"}
                            </Label>
                          </div>
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

        {/* Modal de Criação */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Novo Diagnóstico</DialogTitle>
              <DialogDescription>
                Preencha os dados para criar um novo transtorno
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) =>
                    setFormData({ ...formData, nome: e.target.value })
                  }
                  placeholder="Ex: Depressão"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="codigo">Código</Label>
                <Input
                  id="codigo"
                  value={formData.codigo}
                  onChange={(e) =>
                    setFormData({ ...formData, codigo: e.target.value })
                  }
                  placeholder="Ex: depressao"
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="ativo"
                  checked={formData.ativo}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, ativo: checked })
                  }
                />
                <Label htmlFor="ativo" className="text-sm">
                  Ativo
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="apenas_teste"
                  checked={formData.apenas_teste}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, apenas_teste: checked })
                  }
                />
                <Label htmlFor="apenas_teste" className="text-sm">
                  Apenas Teste
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
              >
                Cancelar
              </Button>
              <Button onClick={handleCreateDiagnostico} disabled={creating}>
                {creating ? "Criando..." : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}

