import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ChatsPage from "@/pages/chats";
import Chat from "@/pages/chat";
import Login from "@/pages/login";
import Register from "@/pages/register";
import AdminSetup from "@/pages/admin-setup";
import NotFound from "@/pages/not-found";
import AdminDashboardPage from "@/pages/admin/AdminDashboardPage";
import AdminUsersPage from "@/pages/admin/AdminUsersPage";
import AdminSessionsPage from "@/pages/admin/AdminSessionsPage";
import AdminUsagePage from "@/pages/admin/AdminUsagePage";
import AdminCostsPage from "@/pages/admin/AdminCostsPage";
import AdminExportPage from "@/pages/admin/AdminExportPage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={ChatsPage} />
      <Route path="/chats" component={ChatsPage} />
      <Route path="/chat/new" component={Chat} />
      <Route path="/chat/:chatId" component={Chat} />
      <Route path="/admin-setup" component={AdminSetup} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      {/* Admin Routes - specific routes first */}
      <Route path="/admin/users" component={AdminUsersPage} />
      <Route path="/admin/sessions" component={AdminSessionsPage} />
      <Route path="/admin/usage" component={AdminUsagePage} />
      <Route path="/admin/costs" component={AdminCostsPage} />
      <Route path="/admin/export" component={AdminExportPage} />
      <Route path="/admin" component={AdminDashboardPage} />
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
