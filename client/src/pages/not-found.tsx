import { Link } from "wouter";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-white font-sans relative overflow-hidden">
      {/* Background Grid */}
      <div className="absolute inset-0 pointer-events-none z-0 opacity-20" 
             style={{ 
               backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)', 
               backgroundSize: '40px 40px' 
             }} 
      />
      
      <div className="z-10 text-center space-y-6 p-8 glass-panel rounded-2xl max-w-md mx-4 border-red-500/20 shadow-[0_0_50px_rgba(239,68,68,0.1)]">
        <div className="inline-flex h-20 w-20 rounded-full bg-red-500/10 items-center justify-center border border-red-500/20 mb-2">
          <AlertTriangle className="h-10 w-10 text-red-500 animate-pulse" />
        </div>
        
        <div>
          <h1 className="text-4xl font-display font-bold mb-2 text-white">System Error 404</h1>
          <p className="text-muted-foreground font-mono text-sm">
            MODULE_NOT_FOUND: The requested sector is unreachable or has been decommissioned.
          </p>
        </div>

        <Link href="/">
          <Button className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white gap-2">
            <ArrowLeft className="h-4 w-4" /> Return to Nexus
          </Button>
        </Link>
      </div>
    </div>
  );
}
