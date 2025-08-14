import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'

export function NewChatDialog({ open, onOpenChange, onConfirm }) {
  const [formData, setFormData] = useState({
    diagnostico: '',
    protocolo: ''
  })

  const handleSubmit = () => {
    if (formData.diagnostico && formData.protocolo) {
      onConfirm(formData)
      setFormData({ diagnostico: '', protocolo: '' })
      onOpenChange(false)
    }
  }

  const handleCancel = () => {
    setFormData({ diagnostico: '', protocolo: '' })
    onOpenChange(false)
  }

  const isFormValid = formData.diagnostico && formData.protocolo

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <i className="fas fa-plus text-primary"></i>
            <span>Nova Conversa</span>
          </DialogTitle>
          <DialogDescription>
            Selecione o diagnóstico e protocolo para iniciar uma nova sessão.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="diagnostico">Diagnóstico</Label>
            <Select 
              value={formData.diagnostico} 
              onValueChange={(value) => setFormData({ ...formData, diagnostico: value })}
            >
              <SelectTrigger id="diagnostico" data-testid="diagnostico-select">
                <SelectValue placeholder="Selecione o diagnóstico" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ansiedade">Ansiedade</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="protocolo">Protocolo</Label>
            <Select 
              value={formData.protocolo} 
              onValueChange={(value) => setFormData({ ...formData, protocolo: value })}
            >
              <SelectTrigger id="protocolo" data-testid="protocolo-select">
                <SelectValue placeholder="Selecione o protocolo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tcc">TCC (Terapia Cognitivo-Comportamental)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={handleCancel}
            data-testid="cancel-button"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={!isFormValid}
            data-testid="confirm-button"
            className="ml-2"
          >
            <i className="fas fa-check mr-2"></i>
            Iniciar Conversa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}