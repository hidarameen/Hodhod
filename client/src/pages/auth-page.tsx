import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Lock, User, ArrowRight, Cpu, ShieldCheck, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import backgroundUrl from "@/assets/background.png";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        toast.error(data.error || "Login failed");
        setIsLoading(false);
        return;
      }

      // حفظ الـ token والـ admin status
      localStorage.setItem("adminToken", data.token);
      localStorage.setItem("adminUser", data.username);
      localStorage.setItem("isAdmin", "true");
      
      toast.success("✓ Admin login successful!");
      
      // الانتظار قليلاً قبل الانتقال
      setTimeout(() => {
        setLocation("/");
      }, 500);
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
      toast.error(message);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white dark:bg-black relative overflow-hidden font-sans">
      {/* Dynamic Background */}
      <div 
        className="absolute inset-0 z-0 opacity-40 dark:opacity-60"
        style={{
          backgroundImage: `url(${backgroundUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-white via-white/80 to-transparent dark:from-black dark:via-black/80 dark:to-transparent z-0" />
      
      <div className="relative z-10 w-full max-w-md px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-primary/10 border border-primary/30 backdrop-blur-xl mb-6 shadow-[0_0_30px_rgba(6,182,212,0.3)]">
              <Cpu className="h-10 w-10 text-primary" />
            </div>
            <h1 className="font-display text-4xl font-bold text-black dark:text-white mb-2 tracking-wider">NEXUS</h1>
            <p className="text-gray-600 dark:text-muted-foreground text-sm uppercase tracking-[0.2em]">Bot Control Interface</p>
          </div>

          <Card className="bg-white/40 dark:bg-black/40 backdrop-blur-xl border-black/10 dark:border-white/10 shadow-2xl">
            <CardContent className="p-8">
              {error && (
                <Alert className="mb-6 bg-red-500/10 border-red-500/30">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <AlertDescription className="text-red-400">{error}</AlertDescription>
                </Alert>
              )}
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider ml-1">Admin Username</label>
                  <div className="relative group">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 group-focus-within:text-primary transition-colors" />
                    <Input 
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={isLoading}
                      className="pl-10 bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-black dark:text-white focus:border-primary/50 focus:ring-primary/20 h-11 disabled:opacity-50 placeholder:text-gray-400 dark:placeholder:text-gray-500" 
                      placeholder="Enter admin username"
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider ml-1">Admin Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 group-focus-within:text-primary transition-colors" />
                    <Input 
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      className="pl-10 bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-black dark:text-white focus:border-primary/50 focus:ring-primary/20 h-11 disabled:opacity-50 placeholder:text-gray-400 dark:placeholder:text-gray-500" 
                      placeholder="••••••••••••"
                      required
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full h-12 bg-primary text-white dark:text-black font-bold hover:bg-cyan-400 transition-all duration-300 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)]"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 animate-pulse" /> Authenticating...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Initialize Session <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-600 font-mono">SECURE CONNECTION ESTABLISHED // TLS 1.3</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
