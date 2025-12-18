import { useState } from 'react'
import { Link, useLocation } from 'wouter'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Logo } from '@/components/Logo'

export default function ForgotPassword() {
  const [, setLocation] = useLocation()
  const { toast } = useToast()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!email || !email.includes('@')) {
      toast({
        title: 'Erro',
        description: 'Por favor, informe um email válido',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao solicitar reset de senha')
      }

      setSuccess(true)
      toast({
        title: 'Email enviado!',
        description: 'Se o email existir, você receberá um link de reset de senha em breve.',
      })
    } catch (error) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao solicitar reset de senha. Tente novamente.',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-8 sm:py-12 px-4 sm:px-6">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="text-center sm:flex sm:items-center sm:justify-center mb-3 sm:mb-4">
            <div className="inline-block">
              <Logo size="xl" />
            </div>
          </div>
          <CardTitle className="text-xl sm:text-2xl text-center">
            Esqueci minha senha
          </CardTitle>
          <CardDescription className="text-sm sm:text-base text-center">
            {success 
              ? 'Verifique seu email para redefinir sua senha'
              : 'Digite seu email para receber um link de redefinição de senha'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-800">
                  Se o email <strong>{email}</strong> estiver cadastrado, você receberá um link para redefinir sua senha.
                </p>
              </div>
              <Button
                onClick={() => setLocation('/login')}
                className="w-full"
                variant="outline"
              >
                Voltar para o login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  data-testid="email-input"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={loading}
                data-testid="submit-button"
              >
                {loading ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Enviando...
                  </>
                ) : (
                  'Enviar link de reset'
                )}
              </Button>
              <div className="text-center">
                <Link href="/login" className="text-sm text-blue-600 hover:text-blue-800">
                  Voltar para o login
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
