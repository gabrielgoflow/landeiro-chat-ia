import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { checkTablesExist } from '@/utils/supabaseMigration.js'

export function DatabaseSetup() {
  const [tablesStatus, setTablesStatus] = useState({
    chatThreadsExists: false,
    userChatsExists: false,
    allTablesExist: false,
    loading: true
  })
  const { toast } = useToast()

  useEffect(() => {
    checkDatabaseStatus()
  }, [])

  const checkDatabaseStatus = async () => {
    setTablesStatus(prev => ({ ...prev, loading: true }))
    
    try {
      const status = await checkTablesExist()
      setTablesStatus({ ...status, loading: false })
    } catch (error) {
      console.error('Error checking database status:', error)
      setTablesStatus(prev => ({ ...prev, loading: false }))
      toast({
        title: 'Erro ao verificar banco de dados',
        description: error.message,
        variant: 'destructive'
      })
    }
  }

  const createTables = async () => {
    toast({
      title: 'Instruções para criar tabelas',
      description: 'Execute o SQL fornecido no Supabase Dashboard > SQL Editor'
    })
  }

  if (tablesStatus.loading) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center space-x-2">
            <i className="fas fa-spinner fa-spin text-primary"></i>
            <span>Verificando banco de dados...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <i className="fas fa-database text-primary"></i>
          <span>Status do Banco de Dados</span>
        </CardTitle>
        <CardDescription>
          Tabelas necessárias para integração OpenAI
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">chat_threads</span>
            <span className={`text-xs px-2 py-1 rounded ${
              tablesStatus.chatThreadsExists 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {tablesStatus.chatThreadsExists ? 'Existente' : 'Não encontrada'}
            </span>
          </div>
          
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">user_chats</span>
            <span className={`text-xs px-2 py-1 rounded ${
              tablesStatus.userChatsExists 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {tablesStatus.userChatsExists ? 'Existente' : 'Não encontrada'}
            </span>
          </div>
        </div>

        {!tablesStatus.allTablesExist && (
          <div className="space-y-3 pt-4 border-t">
            <p className="text-sm text-gray-600">
              Para criar as tabelas necessárias:
            </p>
            <ol className="text-xs text-gray-500 space-y-1">
              <li>1. Acesse o Supabase Dashboard</li>
              <li>2. Vá em SQL Editor</li>
              <li>3. Execute o arquivo supabase_schema.sql</li>
            </ol>
            <Button
              onClick={createTables}
              className="w-full"
              size="sm"
            >
              Ver Instruções
            </Button>
          </div>
        )}

        {tablesStatus.allTablesExist && (
          <div className="flex items-center space-x-2 text-green-600 text-sm">
            <i className="fas fa-check-circle"></i>
            <span>Banco de dados configurado corretamente</span>
          </div>
        )}

        <Button
          onClick={checkDatabaseStatus}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <i className="fas fa-refresh mr-2"></i>
          Verificar Novamente
        </Button>
      </CardContent>
    </Card>
  )
}