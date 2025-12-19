import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const ADMIN_EMAILS = ["admin@goflow.digital", "admin@nexialab.com.br", "admin@fernandalandeiro.com.br"];

const isAdminEmail = (email: string | undefined): boolean => {
  return email ? ADMIN_EMAILS.includes(email) : false;
};

export default function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      if (authLoading) return;

      if (!user) {
        setLocation("/login");
        return;
      }

      // Check if user is admin by email
      if (isAdminEmail(user.email)) {
        setIsAdmin(true);
        setCheckingAdmin(false);
        return;
      }

      // Check user_metadata table for admin role
      try {
        const { data, error } = await supabase
          .from("user_metadata")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!error && data && data.role === "admin") {
          setIsAdmin(true);
        } else {
          // Se não tem metadata ou role não é admin, verificar novamente por email (fallback)
          if (isAdminEmail(user.email)) {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
        // Em caso de erro, verificar por email como fallback
        if (isAdminEmail(user.email)) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } finally {
        setCheckingAdmin(false);
      }
    };

    checkAdmin();
  }, [user, authLoading, setLocation]);

  if (authLoading || checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect via useEffect
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
            <Button className="w-full" onClick={() => setLocation("/")}>
              Voltar ao Chat
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}




