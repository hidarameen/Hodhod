import { Switch, Route } from "wouter";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import Layout from "@/components/layout";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import TasksPage from "@/pages/tasks";
import AIConfigPage from "@/pages/ai-config";
import AIRulesPage from "@/pages/ai-rules";
import ChannelsPage from "@/pages/channels";
import SettingsPage from "@/pages/settings";
import ErrorLogsPage from "@/pages/error-logs";
import GitHubPage from "@/pages/github";
import ArchivePage from "@/pages/archive";
import NotFound from "@/pages/not-found";
import { ThemeProvider } from "next-themes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000,
    },
  },
});

// Protected Route Wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(true);
  const isAdmin = typeof window !== 'undefined' ? localStorage.getItem("isAdmin") === "true" : false;

  useEffect(() => {
    if (!isAdmin) {
      setLocation("/auth");
    }
    setIsLoading(false);
  }, [isAdmin, setLocation]);

  if (isLoading) return null;
  if (!isAdmin) return null;

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <Switch>
          <Route path="/auth" component={AuthPage} />
          
          {/* Protected Routes */}
          <Route path="/">
            <ProtectedRoute>
              <Layout><Dashboard /></Layout>
            </ProtectedRoute>
          </Route>
          <Route path="/tasks">
            <ProtectedRoute>
              <Layout><TasksPage /></Layout>
            </ProtectedRoute>
          </Route>
          <Route path="/channels">
            <ProtectedRoute>
              <Layout><ChannelsPage /></Layout>
            </ProtectedRoute>
          </Route>
          <Route path="/ai-config">
            <ProtectedRoute>
              <Layout><AIConfigPage /></Layout>
            </ProtectedRoute>
          </Route>
          <Route path="/ai-rules">
            <ProtectedRoute>
              <Layout><AIRulesPage /></Layout>
            </ProtectedRoute>
          </Route>
          <Route path="/settings">
            <ProtectedRoute>
              <Layout><SettingsPage /></Layout>
            </ProtectedRoute>
          </Route>
          <Route path="/error-logs">
            <ProtectedRoute>
              <Layout><ErrorLogsPage /></Layout>
            </ProtectedRoute>
          </Route>
          <Route path="/github">
            <ProtectedRoute>
              <Layout><GitHubPage /></Layout>
            </ProtectedRoute>
          </Route>
          <Route path="/archive">
            <ProtectedRoute>
              <Layout><ArchivePage /></Layout>
            </ProtectedRoute>
          </Route>
          
          <Route component={NotFound} />
        </Switch>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
