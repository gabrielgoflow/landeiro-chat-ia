import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  History,
  DollarSign,
  Download,
  LogOut,
  Home,
} from "lucide-react";

interface AdminLayoutProps {
  children: React.ReactNode;
}

import { Settings } from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Usuários", href: "/admin/users", icon: Users },
  { name: "Transtornos", href: "/admin/diagnosticos", icon: Settings },
  { name: "Sessões", href: "/admin/sessions", icon: MessageSquare },
  { name: "Histórico", href: "/admin/usage", icon: History },
  { name: "Custos", href: "/admin/costs", icon: DollarSign },
  { name: "Exportação", href: "/admin/export", icon: Download },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const [location] = useLocation();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/login";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 overflow-hidden">
        <div className="flex flex-col h-full">
          {/* Logo/Header */}
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 border-b border-gray-200 flex-shrink-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">Painel Admin</h1>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 sm:px-4 py-6 space-y-1 overflow-y-auto overflow-x-hidden">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href || location.startsWith(item.href + "/");
              return (
                <Link key={item.href} href={item.href}>
                  <button
                    className={`w-full flex items-center px-3 sm:px-4 py-2 sm:py-3 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <Icon className="mr-2 sm:mr-3 h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </button>
                </Link>
              );
            })}
          </nav>

          {/* User info and logout */}
          <div className="p-3 sm:p-4 border-t border-gray-200 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
                <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                  {user?.email?.charAt(0).toUpperCase() || "A"}
                </div>
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                    {user?.email || "Admin"}
                  </p>
                  <p className="text-[10px] sm:text-xs text-gray-500 truncate">Administrador</p>
                </div>
              </div>
            </div>
            <div className="flex space-x-2">
              <Link href="/" className="flex-1 min-w-0">
                <Button variant="outline" size="sm" className="w-full">
                  <Home className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0" />
                  <span className="truncate">Chat</span>
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="flex-1 min-w-0"
              >
                <LogOut className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2 flex-shrink-0" />
                <span className="truncate">Sair</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="pl-64">
        <main className="py-8 px-8">{children}</main>
      </div>
    </div>
  );
}




