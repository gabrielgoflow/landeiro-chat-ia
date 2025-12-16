import { useState, useEffect } from 'react'
import { Link, useLocation } from 'wouter'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth.jsx'
import { useToast } from '@/hooks/use-toast'
import { Logo } from '@/components/Logo'

export default function Register() {
  const [, setLocation] = useLocation()
  const { signUp, loading } = useAuth()
  const { toast } = useToast()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  })

  // Auto-fill admin credentials if seed parameter is present
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('seed') === 'admin') {
      setFormData({
        email: 'admin@goflow.digital',
        password: '!@#GOflow2700',
        confirmPassword: '!@#GOflow2700'
      })
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!formData.email || !formData.password || !formData.confirmPassword) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos',
        variant: 'destructive'
      })
      return
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: 'Erro',
        description: 'As senhas não coincidem',
        variant: 'destructive'
      })
      return
    }

    if (formData.password.length < 6) {
      toast({
        title: 'Erro',
        description: 'A senha deve ter pelo menos 6 caracteres',
        variant: 'destructive'
      })
      return
    }

    const { data, error } = await signUp(formData.email, formData.password)
    
    if (error) {
      toast({
        title: 'Erro ao criar conta',
        description: error.message,
        variant: 'destructive'
      })
    } else {
      toast({
        title: 'Conta criada com sucesso!',
        description: 'Verifique seu email para confirmar a conta'
      })
      setLocation('/login')
    }
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-8 sm:py-12 px-4 sm:px-6">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="text-center mb-3 sm:mb-4">
            <Logo size="lg" />
          </div>
          <CardTitle className="text-xl sm:text-2xl text-center">Criar conta</CardTitle>
          <CardDescription className="text-sm sm:text-base text-center">
            Crie sua conta para acessar o chat IA
          </CardDescription>
          
          {/* Admin Seed Button */}
          <div className="text-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFormData({
                email: 'admin@goflow.digital',
                password: '!@#GOflow2700',
                confirmPassword: '!@#GOflow2700'
              })}
              className="text-xs"
              data-testid="seed-admin-button"
            >
              Criar Usuário Admin
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="seu@email.com"
                value={formData.email}
                onChange={handleChange}
                required
                data-testid="email-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={handleChange}
                required
                data-testid="password-input"
              />
              <p className="text-xs text-gray-500">Mínimo de 6 caracteres</p>
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
                data-testid="confirm-password-input"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
              data-testid="register-button"
            >
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  Criando conta...
                </>
              ) : (
                'Criar conta'
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Já tem uma conta?{' '}
              <Link href="/login" className="font-medium text-primary hover:opacity-80">
                Fazer login
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}