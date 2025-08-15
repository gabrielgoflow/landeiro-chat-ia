import { Switch, Route } from "wouter";
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
import AdminSetup from "@/pages/admin-setup.jsx";
import NotFound from "@/pages/not-found.jsx";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
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
      <Route path="/">
        <ProtectedRoute>
          <ChatsPage />
        </ProtectedRoute>
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