import { useState, useEffect } from 'react'
import { useLocation, useParams } from 'wouter'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Logo } from '@/components/Logo'

export default function ResetPassword() {
  const [, setLocation] = useLocation()
  const { token: tokenParam } = useParams()
  const { toast } = useToast()
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [token, setToken] = useState(null)

  useEffect(() => {
    if (tokenParam) {
      setToken(tokenParam)
    } else {
      // Tentar pegar token da URL se não vier via params
      const urlParams = new URLSearchParams(window.location.search)
      const tokenFromUrl = urlParams.get('token')
      if (tokenFromUrl) {
        setToken(tokenFromUrl)
      }
    }
  }, [tokenParam])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!token) {
      toast({
        title: 'Erro',
        description: 'Token inválido',
        variant: 'destructive'
      })
      return
    }

    if (!formData.newPassword || !formData.confirmPassword) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos',
        variant: 'destructive'
      })
      return
    }

    if (formData.newPassword.length < 6) {
      toast({
        title: 'Erro',
        description: 'A senha deve ter pelo menos 6 caracteres',
        variant: 'destructive'
      })
      return
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast({
        title: 'Erro',
        description: 'As senhas não coincidem',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          token,
          newPassword: formData.newPassword 
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao redefinir senha')
      }

      setSuccess(true)
      toast({
        title: 'Senha redefinida com sucesso!',
        description: 'Você pode fazer login com sua nova senha.',
      })

      // Redirecionar para login após 2 segundos
      setTimeout(() => {
        setLocation('/login')
      }, 2000)
    } catch (error) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao redefinir senha. Tente novamente.',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  if (!token) {
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
              Token inválido
            </CardTitle>
            <CardDescription className="text-sm sm:text-base text-center">
              O link de reset de senha é inválido ou expirou
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => setLocation('/forgot-password')}
              className="w-full"
            >
              Solicitar novo link
            </Button>
          </CardContent>
        </Card>
      </div>
    )
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
            Redefinir senha
          </CardTitle>
          <CardDescription className="text-sm sm:text-base text-center">
            {success 
              ? 'Senha redefinida com sucesso! Redirecionando...'
              : 'Digite sua nova senha'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-md">
                <p className="text-sm text-green-800">
                  Sua senha foi redefinida com sucesso! Você será redirecionado para a página de login.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova senha</Label>
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  placeholder="••••••••"
                  value={formData.newPassword}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  minLength={6}
                  data-testid="new-password-input"
                />
                <p className="text-xs text-gray-500">
                  Mínimo de 6 caracteres
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar senha</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  disabled={loading}
                  minLength={6}
                  data-testid="confirm-password-input"
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={loading}
                data-testid="reset-button"
              >
                {loading ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    Redefinindo...
                  </>
                ) : (
                  'Redefinir senha'
                )}
              </Button>
              <div className="text-center">
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setLocation('/login')}
                  className="text-sm"
                >
                  Voltar para o login
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
