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
  const [fixRlsScript, setFixRlsScript] = useState('')

  const ADMIN_EMAILS = ['admin@goflow.digital', 'admin@nexialab.com.br']
  const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email)

  useEffect(() => {
    // Carregar o script SQL principal
    fetch('/supabase_schema.sql')
      .then(res => res.text())
      .then(text => setSqlScript(text))
      .catch(err => console.error('Erro ao carregar SQL:', err))
      
    // Carregar o script de correção RLS
    fetch('/fix_rls_policies.sql')
      .then(res => res.text())
      .then(text => setFixRlsScript(text))
      .catch(err => console.error('Erro ao carregar script RLS:', err))
  }, [])

  const copySqlToClipboard = () => {
    navigator.clipboard.writeText(sqlScript)
    toast({
      title: 'SQL copiado!',
      description: 'Cole no SQL Editor do Supabase Dashboard'
    })
  }

  const copyFixRlsToClipboard = () => {
    navigator.clipboard.writeText(fixRlsScript)
    toast({
      title: 'Script RLS copiado!',
      description: 'Execute este script para corrigir políticas de segurança'
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

          {/* Erro RLS Alert */}
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-red-700">
                <i className="fas fa-exclamation-triangle"></i>
                <span>Erro RLS Detectado</span>
              </CardTitle>
              <CardDescription>
                Execute o script de correção se houver erro de segurança
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-red-700">
                Se você está vendo erros como "violates row-level security policy", execute este script:
              </div>
              
              <div className="bg-gray-900 rounded-lg p-4 max-h-48 overflow-y-auto">
                <pre className="text-xs text-green-400 whitespace-pre-wrap font-mono">
                  {fixRlsScript || 'Carregando script de correção...'}
                </pre>
              </div>
              
              <div className="flex space-x-2">
                <Button 
                  onClick={copyFixRlsToClipboard}
                  size="sm"
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  disabled={!fixRlsScript}
                >
                  <i className="fas fa-copy mr-2"></i>
                  Copiar Correção RLS
                </Button>
                <Button 
                  onClick={() => {
                    copyFixRlsToClipboard();
                    window.open('https://app.supabase.com', '_blank');
                  }}
                  size="sm"
                  variant="outline"
                  className="flex-1"
                >
                  <i className="fas fa-external-link-alt mr-2"></i>
                  Copiar + Abrir Supabase
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          {/* Script SQL */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <i className="fas fa-code text-primary"></i>
                <span>Script de Migração Inicial</span>
              </CardTitle>
              <CardDescription>
                Execute primeiro (se as tabelas não existem)
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
                <h4 className="font-medium text-gray-900 mb-2">📋 Resolução do Problema:</h4>
                <ol className="text-sm text-gray-600 space-y-2">
                  <li><strong>1. Erro RLS:</strong> Execute primeiro o script de correção RLS (caixa vermelha)</li>
                  <li><strong>2. Tabelas:</strong> Se não existem, execute o script de migração inicial</li>
                  <li><strong>3. Acesso:</strong> <a href="https://app.supabase.com" target="_blank" className="text-blue-600 underline">app.supabase.com</a> → SQL Editor → New Query</li>
                  <li><strong>4. Execução:</strong> Cole o script e clique em "RUN"</li>
                  <li><strong>5. Verificação:</strong> Use o botão "Verificar Novamente" abaixo</li>
                </ol>
                
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs text-red-800">
                    🚨 <strong>ERRO ATUAL:</strong> RLS (Row Level Security) está bloqueando inserções. 
                    Execute o script de correção RLS primeiro!
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