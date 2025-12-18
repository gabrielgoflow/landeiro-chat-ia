import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth.jsx";
import ProtectedRoute from "@/components/ProtectedRoute.jsx";
import ChatsPage from "@/pages/chats.jsx";
import Chat from "@/pages/chat.jsx";
import Login from "@/pages/login.jsx";
import Register from "@/pages/register.jsx";
import ForgotPassword from "@/pages/forgot-password.jsx";
import ResetPassword from "@/pages/reset-password.jsx";
import AdminSetup from "@/pages/admin-setup.jsx";
import NotFound from "@/pages/not-found.jsx";
import AdminDashboardPage from "@/pages/admin/AdminDashboardPage";
import AdminUsersPage from "@/pages/admin/AdminUsersPage";
import AdminDiagnosticosPage from "@/pages/admin/AdminDiagnosticosPage";
import AdminSessionsPage from "@/pages/admin/AdminSessionsPage";
import AdminUsagePage from "@/pages/admin/AdminUsagePage";
import AdminCostsPage from "@/pages/admin/AdminCostsPage";
import AdminExportPage from "@/pages/admin/AdminExportPage";

function Router() {
  const [, navigate] = useLocation();
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password/:token" component={ResetPassword} />
      <Route path="/admin-setup">
        <ProtectedRoute>
          <AdminSetup />
        </ProtectedRoute>
      </Route>
      <Route path="/chat/new">
        <ProtectedRoute>
          <Chat />
        </ProtectedRoute>
      </Route>
      <Route path="/chat/:chatId">
        <ProtectedRoute>
          <Chat />
        </ProtectedRoute>
      </Route>
      {/* Admin Routes - must come before "/" route */}
      <Route path="/admin/users" component={AdminUsersPage} />
      <Route path="/admin/diagnosticos" component={AdminDiagnosticosPage} />
      <Route path="/admin/sessions" component={AdminSessionsPage} />
      <Route path="/admin/usage" component={AdminUsagePage} />
      <Route path="/admin/costs" component={AdminCostsPage} />
      <Route path="/admin/export" component={AdminExportPage} />
      <Route path="/admin" component={AdminDashboardPage} />
      <Route path="/chats">
        <ProtectedRoute>
          <ChatsPage />
        </ProtectedRoute>
      </Route>
      <Route path="/">
        {() => {
          navigate("/chats");
          return null;
        }}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <div className="h-full">
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </div>
  );
}

export default App;
