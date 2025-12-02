import { Switch, Route } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import Layout from "@/components/layout";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import TasksPage from "@/pages/tasks";
import AIConfigPage from "@/pages/ai-config";
import ChannelsPage from "@/pages/channels";
import SettingsPage from "@/pages/settings";
import ErrorLogsPage from "@/pages/error-logs";
import GitHubPage from "@/pages/github";
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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <Switch>
          <Route path="/auth" component={AuthPage} />
          
          {/* Protected Routes */}
          <Route path="/">
            <Layout><Dashboard /></Layout>
          </Route>
          <Route path="/tasks">
            <Layout><TasksPage /></Layout>
          </Route>
          <Route path="/channels">
            <Layout><ChannelsPage /></Layout>
          </Route>
          <Route path="/ai-config">
            <Layout><AIConfigPage /></Layout>
          </Route>
          <Route path="/settings">
            <Layout><SettingsPage /></Layout>
          </Route>
          <Route path="/error-logs">
            <Layout><ErrorLogsPage /></Layout>
          </Route>
          <Route path="/github">
            <Layout><GitHubPage /></Layout>
          </Route>
          
          <Route component={NotFound} />
        </Switch>
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
