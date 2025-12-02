import { useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Lock, User, ArrowRight, Cpu, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import backgroundUrl from "@/assets/background.png";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Mock login delay
    setTimeout(() => {
      setLocation("/");
    }, 1500);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-black relative overflow-hidden font-sans">
      {/* Dynamic Background */}
      <div 
        className="absolute inset-0 z-0 opacity-60"
        style={{
          backgroundImage: `url(${backgroundUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent z-0" />
      
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
            <h1 className="font-display text-4xl font-bold text-white mb-2 tracking-wider">NEXUS</h1>
            <p className="text-muted-foreground text-sm uppercase tracking-[0.2em]">Bot Control Interface</p>
          </div>

          <Card className="bg-black/40 backdrop-blur-xl border-white/10 shadow-2xl">
            <CardContent className="p-8">
              <form onSubmit={handleLogin} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider ml-1">Username</label>
                  <div className="relative group">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-primary transition-colors" />
                    <Input 
                      type="text" 
                      className="pl-10 bg-white/5 border-white/10 text-white focus:border-primary/50 focus:ring-primary/20 h-11" 
                      placeholder="Enter admin ID"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wider ml-1">Access Key</label>
                  <div className="relative group">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-focus-within:text-primary transition-colors" />
                    <Input 
                      type="password" 
                      className="pl-10 bg-white/5 border-white/10 text-white focus:border-primary/50 focus:ring-primary/20 h-11" 
                      placeholder="••••••••••••"
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full h-12 bg-primary text-black font-bold hover:bg-cyan-400 transition-all duration-300 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)]"
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
                <p className="text-xs text-gray-600 font-mono">SECURE CONNECTION ESTABLISHED // TLS 1.3</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
