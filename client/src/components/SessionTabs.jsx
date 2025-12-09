import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { supabaseService } from '@/services/supabaseService'
import { Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase.js'

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
      
      // Buscar sessões diretamente das tabelas
      const { data: chatThreads, error: threadsError } = await supabase
        .from('chat_threads')
        .select('*')
        .eq('thread_id', threadId)
        .order('sessao', { ascending: true });

      if (threadsError) {
        console.error('Erro ao buscar chat_threads:', threadsError);
        setSessions([]);
        return;
      }

      console.log('Chat threads data:', chatThreads);

      // Para cada sessão, verificar se existe review
      const sessionsWithStatus = await Promise.all(
        (chatThreads || []).map(async (thread) => {
          // Verificar se existe review para este chat_id e sessao
          const { data: review, error: reviewError } = await supabase
            .from('chat_reviews')
            .select('*')
            .eq('chat_id', thread.chat_id)
            .eq('sessao', thread.sessao)
            .single();

          const hasReview = !reviewError && review;
          console.log(`Session ${thread.sessao} - has review:`, hasReview);

          return {
            chat_id: thread.chat_id,
            thread_id: thread.thread_id,
            diagnostico: thread.diagnostico,
            protocolo: thread.protocolo,
            sessao: thread.sessao,
            created_at: thread.created_at,
            status: hasReview ? 'finalizado' : 'em_andamento',
            chat_reviews: hasReview ? [{
              id: review.id,
              resumo_atendimento: review.resumo_atendimento || '',
              created_at: review.created_at
            }] : []
          };
        })
      );

      console.log('Sessions with status:', sessionsWithStatus);
      setSessions(sessionsWithStatus);
      
      // Encontrar a sessão atual baseada no currentChatId
      const currentSession = sessionsWithStatus.find(s => s.chat_id === currentChatId)
      if (currentSession) {
        setActiveSession(currentSession.sessao.toString())
      } else if (sessionsWithStatus.length > 0) {
        setActiveSession(sessionsWithStatus[0].sessao.toString())
      }
      
    } catch (error) {
      console.error('Error loading sessions:', error)
      setSessions([])
    } finally {
      setLoading(false)
    }
  }

  const handleSessionSelect = (sessionNumber) => {
    const session = sessions.find(s => s.sessao.toString() === sessionNumber)
    if (session) {
      setActiveSession(sessionNumber)
      onSessionChange?.(session.chat_id, session.sessao)
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
            {sessions.map((session) => {
              console.log('SessionTab:', session, 'Status:', session.status);
              return (
                <TabsTrigger 
                  key={session.sessao} 
                  value={session.sessao.toString()}
                  className="relative flex items-center gap-2"
                  data-testid={`session-tab-${session.sessao}`}
                >
                  <span>SESSÃO {session.sessao}</span>
                  {session.status === 'finalizado' ? (
                    <Badge className="bg-green-100 text-green-800 border-green-200 text-xs px-1 py-0">
                      FINALIZADA
                    </Badge>
                  ) : (
                    <Badge className="bg-blue-100 text-blue-800 border-blue-200 text-xs px-1 py-0">
                      EM ANDAMENTO
                    </Badge>
                  )}
                </TabsTrigger>
              );
            })}
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