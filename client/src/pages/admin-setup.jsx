import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth.jsx'
import { DatabaseSetup } from '@/components/DatabaseSetup.jsx'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Link } from 'wouter'

export default function AdminSetup() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [sqlScript, setSqlScript] = useState('')

  const isAdmin = user?.email === 'admin@goflow.digital'

  useEffect(() => {
    // Carregar o script SQL
    fetch('/supabase_schema.sql')
      .then(res => res.text())
      .then(text => setSqlScript(text))
      .catch(err => console.error('Erro ao carregar SQL:', err))
  }, [])

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(sqlScript)
    toast({
      title: 'SQL copiado!',
      description: 'Cole no SQL Editor do Supabase Dashboard'
    })
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-red-600">Acesso Negado</CardTitle>
            <CardDescription className="text-center">
              Esta página é apenas para administradores
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/">
              <Button className="w-full">
                Voltar ao Chat
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Configuração do Administrador</h1>
          <p className="text-gray-600 mt-2">Gerenciar tabelas do Supabase para integração OpenAI</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Status das Tabelas */}
          <div>
            <DatabaseSetup />
          </div>

          {/* Script SQL */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <i className="fas fa-code text-primary"></i>
                <span>Script de Migração</span>
              </CardTitle>
              <CardDescription>
                Execute este SQL no Supabase Dashboard
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto">
                <pre className="text-xs text-green-400 whitespace-pre-wrap font-mono">
                  {sqlScript || 'Carregando script SQL...'}
                </pre>
              </div>
              
              <div className="flex space-x-2">
                <Button 
                  onClick={copySqlToClipboard}
                  size="sm"
                  className="flex-1"
                  disabled={!sqlScript}
                >
                  <i className="fas fa-copy mr-2"></i>
                  Copiar SQL
                </Button>
                <Button 
                  onClick={() => {
                    copySqlToClipboard();
                    window.open('https://app.supabase.com', '_blank');
                  }}
                  size="sm"
                  className="flex-1"
                >
                  <i className="fas fa-external-link-alt mr-2"></i>
                  Copiar SQL + Abrir Supabase
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Exemplo Visual */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <i className="fas fa-eye text-green-500"></i>
              <span>Onde Encontrar o SQL Editor</span>
            </CardTitle>
            <CardDescription>
              Procure por estes elementos no Supabase Dashboard
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-blue-500">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-4 h-4 bg-gray-800 rounded"></div>
                <span className="font-medium">Menu Lateral Esquerdo</span>
              </div>
              <p className="text-sm text-gray-600">Procure por "SQL Editor" na lista de opções</p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-green-500">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-4 h-4 bg-blue-500 rounded"></div>
                <span className="font-medium">Botão "New Query"</span>
              </div>
              <p className="text-sm text-gray-600">Após abrir SQL Editor, clique em "New Query" ou "+"</p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-purple-500">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-4 h-4 bg-blue-600 rounded"></div>
                <span className="font-medium">Botão "RUN"</span>
              </div>
              <p className="text-sm text-gray-600">Cole o SQL e clique no botão azul "RUN" no canto inferior direito</p>
            </div>
          </CardContent>
        </Card>

        {/* Instruções */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <i className="fas fa-info-circle text-blue-500"></i>
              <span>Instruções de Configuração</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="font-medium text-gray-900 mb-2">📋 Passos OBRIGATÓRIOS para criar as tabelas:</h4>
                <ol className="text-sm text-gray-600 space-y-2">
                  <li><strong>1. Abra o Supabase:</strong> <a href="https://app.supabase.com" target="_blank" className="text-blue-600 underline">app.supabase.com</a></li>
                  <li><strong>2. Selecione o projeto</strong> do Landeiro Chat</li>
                  <li><strong>3. No menu lateral, clique em "SQL Editor"</strong></li>
                  <li><strong>4. Clique em "New Query"</strong> (novo script)</li>
                  <li><strong>5. COPIE todo o SQL</strong> da caixa acima</li>
                  <li><strong>6. COLE no editor</strong> do Supabase</li>
                  <li><strong>7. Clique em "RUN"</strong> (botão azul)</li>
                  <li><strong>8. Aguarde a confirmação</strong> "Success. No rows returned"</li>
                  <li><strong>9. Verifique aqui</strong> se as tabelas foram criadas</li>
                </ol>
                
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs text-yellow-800">
                    ⚠️ <strong>IMPORTANTE:</strong> As tabelas NÃO são criadas automaticamente. 
                    Você DEVE executar o SQL manualmente no Supabase Dashboard.
                  </p>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Tabelas que serão criadas:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li><strong>chat_threads:</strong> Liga chats internos aos threads OpenAI</li>
                  <li><strong>user_chats:</strong> Liga usuários aos chats OpenAI</li>
                  <li><strong>Índices:</strong> Para melhor performance</li>
                  <li><strong>RLS:</strong> Segurança por usuário</li>
                  <li><strong>Políticas:</strong> Controle de acesso</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Voltar ao Chat */}
        <div className="text-center">
          <Link href="/">
            <Button variant="outline">
              <i className="fas fa-arrow-left mr-2"></i>
              Voltar ao Chat
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}