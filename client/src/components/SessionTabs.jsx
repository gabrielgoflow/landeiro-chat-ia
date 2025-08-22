import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { supabaseService } from '@/services/supabaseService'
import { Plus } from 'lucide-react'

export function SessionTabs({ 
  threadId, 
  currentChatId, 
  onSessionChange, 
  onNewSession,
  className = "" 
}) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeSession, setActiveSession] = useState(null)

  useEffect(() => {
    if (threadId) {
      loadSessions()
    }
  }, [threadId])



  const loadSessions = async () => {
    try {
      setLoading(true)
      console.log('Loading sessions for threadId:', threadId)
      
      // Usar a nova API para buscar todas as sessões do thread
      try {
        console.log('Fetching thread sessions for threadId:', threadId)
        const response = await fetch(`/api/thread-sessions/${threadId}`)
        console.log('Thread sessions API response status:', response.status)
        
        if (response.ok) {
          const threadSessions = await response.json()
          console.log('Thread sessions data:', threadSessions)
          
          // Transformar os dados para o formato esperado pelo componente
          const formattedSessions = threadSessions.map(session => ({
            chat_id: session.chat_id,
            thread_id: session.thread_id,
            diagnostico: session.diagnostico,
            protocolo: session.protocolo,
            sessao: session.sessao,
            created_at: session.created_at,
            status: session.status,
            chat_reviews: session.review_id ? [{
              id: session.review_id,
              resumo_atendimento: session.resumo_atendimento || '',
              created_at: session.review_created
            }] : []
          }))
          
          setSessions(formattedSessions)
          
          // Encontrar a sessão atual baseada no currentChatId
          const currentSession = formattedSessions.find(s => s.chat_id === currentChatId)
          if (currentSession) {
            setActiveSession(currentSession.sessao.toString())
          } else if (formattedSessions.length > 0) {
            setActiveSession(formattedSessions[0].sessao.toString())
          }
          
        } else {
          console.warn('Failed to load thread sessions')
          setSessions([])
        }
      } catch (apiError) {
        console.error('Error using thread sessions API:', apiError)
        setSessions([])
      }
      
    } catch (error) {
      console.error('Error loading sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSessionSelect = (sessionNumber) => {
    const session = sessions.find(s => s.sessao.toString() === sessionNumber)
    if (session) {
      setActiveSession(sessionNumber)
      onSessionChange?.(session.chat_id)
    }
  }

  const handleNewSession = () => {
    onNewSession?.()
  }

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <div className="text-sm text-gray-500">Carregando sessões...</div>
      </div>
    )
  }

  if (!sessions.length) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <div className="text-sm text-gray-500">Nenhuma sessão encontrada</div>
      </div>
    )
  }

  return (
    <div className={`border-b bg-white ${className}`}>
      <Tabs value={activeSession} onValueChange={handleSessionSelect} className="w-full">
        <div className="flex items-center justify-between px-4 py-2">
          <TabsList className="flex-1 justify-start bg-gray-50">
            {sessions.map((session) => (
              <TabsTrigger 
                key={session.sessao} 
                value={session.sessao.toString()}
                className="relative flex items-center gap-2"
                data-testid={`session-tab-${session.sessao}`}
              >
                <span>SESSÃO {session.sessao}</span>
                
                {/* Status badge */}
                {session.chat_reviews?.length > 0 ? (
                  <Badge className="bg-green-100 text-green-800 border-green-200 text-xs px-1 py-0">
                    FINALIZADA
                  </Badge>
                ) : (
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs px-1 py-0">
                    EM ANDAMENTO
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
          
          {/* Botão para nova sessão */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleNewSession}
            className="ml-4 flex items-center gap-2"
            data-testid="new-session-button"
          >
            <Plus className="h-4 w-4" />
            Nova Sessão
          </Button>
        </div>

        {/* Content das sessões */}
        {sessions.map((session) => (
          <TabsContent key={session.sessao} value={session.sessao.toString()} className="m-0">
            <div className="px-4 py-2 bg-gray-50 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-medium">
                    Sessão {session.sessao} - {session.diagnostico} ({session.protocolo.toUpperCase()})
                  </span>
                  <span className="text-gray-500">
                    Iniciada em {new Date(session.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
                
                {session.chat_reviews?.length > 0 && (
                  <div className="text-sm text-gray-500">
                    Finalizada em {new Date(session.chat_reviews[0].created_at).toLocaleDateString('pt-BR')}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

export default SessionTabs