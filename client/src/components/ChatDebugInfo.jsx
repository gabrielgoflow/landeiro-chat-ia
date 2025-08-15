import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth.jsx'
import { SupabaseService } from '@/services/supabaseService.js'

export function ChatDebugInfo({ currentThread, sessionData, visible = false }) {
  const { user } = useAuth()
  const [supabaseData, setSupabaseData] = useState(null)
  const [loading, setLoading] = useState(false)

  const checkSupabaseData = async () => {
    if (!user || !currentThread) return
    
    setLoading(true)
    try {
      // Check if thread exists in Supabase
      const { data, error } = await SupabaseService.getThreadIdByChatId(currentThread.id)
      setSupabaseData({ data, error })
    } catch (error) {
      setSupabaseData({ data: null, error: error.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (visible && currentThread) {
      checkSupabaseData()
    }
  }, [visible, currentThread, user])

  if (!visible || !user || user.email !== 'admin@goflow.digital') {
    return null
  }

  return (
    <Card className="mt-4 border-yellow-200 bg-yellow-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center space-x-2">
          <i className="fas fa-bug text-yellow-600"></i>
          <span>Debug Info (Admin)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <strong>Thread ID:</strong>
            <div className="font-mono bg-white p-1 rounded border text-gray-700">
              {currentThread?.id || 'N/A'}
            </div>
          </div>
          
          <div>
            <strong>User ID:</strong>
            <div className="font-mono bg-white p-1 rounded border text-gray-700">
              {user?.id || 'N/A'}
            </div>
          </div>
        </div>

        {sessionData && (
          <div>
            <strong>Session Data:</strong>
            <div className="bg-white p-2 rounded border text-xs">
              <div>Diagnóstico: <span className="font-mono">{sessionData.diagnostico}</span></div>
              <div>Protocolo: <span className="font-mono">{sessionData.protocolo}</span></div>
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <strong className="text-xs">Supabase Status:</strong>
            <Button
              onClick={checkSupabaseData}
              size="sm"
              variant="outline"
              className="h-6 text-xs"
              disabled={loading}
            >
              {loading ? <i className="fas fa-spinner fa-spin"></i> : 'Verificar'}
            </Button>
          </div>
          
          <div className="bg-white p-2 rounded border text-xs">
            {loading ? (
              <div className="text-gray-500">Verificando...</div>
            ) : supabaseData ? (
              supabaseData.data ? (
                <div className="text-green-700">
                  <div>✓ Thread encontrado no Supabase</div>
                  <div>Thread ID OpenAI: <span className="font-mono">{supabaseData.data.thread_id || 'Vazio'}</span></div>
                  <div>Diagnóstico: <span className="font-mono">{supabaseData.data.diagnostico}</span></div>
                  <div>Protocolo: <span className="font-mono">{supabaseData.data.protocolo}</span></div>
                </div>
              ) : (
                <div className="text-red-700">
                  ✗ Thread não encontrado no Supabase
                  {supabaseData.error && (
                    <div className="mt-1 text-xs">{supabaseData.error}</div>
                  )}
                </div>
              )
            ) : (
              <div className="text-gray-500">Clique em "Verificar" para checar Supabase</div>
            )}
          </div>
        </div>

        <div className="text-xs text-gray-600 border-t pt-2">
          <strong>Webhook Body Preview:</strong>
          <pre className="bg-white p-2 rounded border mt-1 overflow-x-auto">
{JSON.stringify({
  message: "[mensagem do usuário]",
  email: "gabriel@goflow.digital",
  thread: currentThread?.id,
  chat_id: currentThread?.id,
  diagnostico: sessionData?.diagnostico,
  protocolo: sessionData?.protocolo
}, null, 2)}
          </pre>
        </div>
      </CardContent>
    </Card>
  )
}