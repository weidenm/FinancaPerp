import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import Dashboard from "@/pages/dashboard";
import Transacoes from "@/pages/transacoes";
import Orcamentos from "@/pages/orcamentos";
import Metas from "@/pages/metas";
import Contas from "@/pages/contas";
import Categorias from "@/pages/categorias";
import Relatorios from "@/pages/relatorios";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/transacoes" component={Transacoes} />
      <Route path="/orcamentos" component={Orcamentos} />
      <Route path="/metas" component={Metas} />
      <Route path="/contas" component={Contas} />
      <Route path="/categorias" component={Categorias} />
      <Route path="/relatorios" component={Relatorios} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  // Seed default categories on first load; refresh lists (staleTime is Infinity)
  useEffect(() => {
    apiRequest("POST", "/api/seed")
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
        void queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
        void queryClient.invalidateQueries({ queryKey: ["/api/budgets"] });
        void queryClient.invalidateQueries({ queryKey: ["/api/goals"] });
      })
      .catch(() => {});
  }, []);

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router hook={useHashLocation}>
          <SidebarProvider style={style as React.CSSProperties}>
            <div className="flex h-screen w-full">
              <AppSidebar />
              <div className="flex flex-col flex-1 min-w-0">
                <header className="flex items-center justify-between gap-2 px-4 py-2 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                  <ThemeToggle />
                </header>
                <main className="flex-1 overflow-y-auto">
                  <AppRouter />
                </main>
              </div>
            </div>
          </SidebarProvider>
        </Router>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
