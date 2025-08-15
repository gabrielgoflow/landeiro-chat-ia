import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import ChatsPage from "@/pages/chats";
import Chat from "@/pages/chat";
import AdminSetup from "@/pages/admin-setup";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={ChatsPage} />
      <Route path="/chats" component={ChatsPage} />
      <Route path="/chat/new" component={Chat} />
      <Route path="/chat/:chatId" component={Chat} />
      <Route path="/admin-setup" component={AdminSetup} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <div className="h-full">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </div>
  );
}

export default App;
