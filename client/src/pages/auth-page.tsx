import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Lock, User, ArrowRight, ShieldCheck, AlertCircle, Sun, Moon, Languages, Bird } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import backgroundUrl from "@/assets/background.png";

export default function AuthPage() {
  const [, setLocation] = useLocation();
  const { theme, setTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

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
        {/* Control Buttons */}
        <div className={`flex ${i18n.language === 'ar' ? 'flex-row-reverse' : ''} justify-between items-center mb-4 gap-2`}>
          {/* Language Toggle */}
          <button
            onClick={() => i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar')}
            className="p-2 rounded-lg bg-black/20 dark:bg-white/20 hover:bg-black/30 dark:hover:bg-white/30 transition-colors"
            aria-label="Toggle language"
            data-testid="button-toggle-language"
            title={i18n.language === 'ar' ? 'English' : 'العربية'}
          >
            <Languages className="h-5 w-5 text-primary" />
          </button>

          {/* Theme Toggle Button */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 rounded-lg bg-black/20 dark:bg-white/20 hover:bg-black/30 dark:hover:bg-white/30 transition-colors"
            aria-label="Toggle theme"
            data-testid="button-toggle-theme"
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5 text-amber-400" />
            ) : (
              <Moon className="h-5 w-5 text-blue-600" />
            )}
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-primary/10 border border-primary/30 backdrop-blur-xl mb-6 shadow-[0_0_30px_rgba(6,182,212,0.3)]">
              <Bird className="h-12 w-12 text-primary" />
            </div>
            <div className="overflow-hidden mb-2">
              <motion.h1 
                className="font-display text-4xl font-bold text-black dark:text-white tracking-wider whitespace-nowrap"
                animate={{ x: i18n.language === 'ar' ? [100, -100] : [-100, 100] }}
                transition={{ duration: 3, repeat: Infinity, repeatType: "reverse" }}
              >
                {t('app.name')}
              </motion.h1>
            </div>
            <div className="overflow-hidden">
              <motion.p 
                className="text-gray-600 dark:text-muted-foreground text-sm uppercase tracking-[0.2em] whitespace-nowrap"
                animate={{ x: i18n.language === 'ar' ? [-100, 100] : [100, -100] }}
                transition={{ duration: 3, repeat: Infinity, repeatType: "reverse", delay: 0.2 }}
              >
                {t('app.subtitle')}
              </motion.p>
            </div>
          </div>

          <Card className="bg-white/40 dark:bg-black/40 backdrop-blur-xl border-black/10 dark:border-white/10 shadow-2xl">
            <CardContent className="p-8">
              {error && (
                <Alert className="mb-6 bg-red-500/10 border-red-500/30">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <AlertDescription className="text-red-400">{error}</AlertDescription>
                </Alert>
              )}
              <form onSubmit={handleLogin} className={`space-y-6 ${i18n.language === 'ar' ? 'text-right' : 'text-left'}`}>
                <div className="space-y-2">
                  <label className={`text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider ${i18n.language === 'ar' ? 'mr-1' : 'ml-1'}`}>
                    {t('auth.admin_username')}
                  </label>
                  <div className="relative group">
                    <User className={`absolute ${i18n.language === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 group-focus-within:text-primary transition-colors`} />
                    <Input 
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={isLoading}
                      className={`${i18n.language === 'ar' ? 'pr-10 text-right' : 'pl-10'} bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-black dark:text-white focus:border-primary/50 focus:ring-primary/20 h-11 disabled:opacity-50 placeholder:text-gray-400 dark:placeholder:text-gray-500`} 
                      placeholder={t('auth.username_placeholder')}
                      required
                      data-testid="input-username"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className={`text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider ${i18n.language === 'ar' ? 'mr-1' : 'ml-1'}`}>
                    {t('auth.admin_password')}
                  </label>
                  <div className="relative group">
                    <Lock className={`absolute ${i18n.language === 'ar' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500 group-focus-within:text-primary transition-colors`} />
                    <Input 
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      className={`${i18n.language === 'ar' ? 'pr-10 text-right' : 'pl-10'} bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-black dark:text-white focus:border-primary/50 focus:ring-primary/20 h-11 disabled:opacity-50 placeholder:text-gray-400 dark:placeholder:text-gray-500`} 
                      placeholder="••••••••••••"
                      required
                      data-testid="input-password"
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full h-12 bg-primary text-black dark:text-white font-bold hover:bg-cyan-400 transition-all duration-300 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)]"
                  data-testid="button-submit"
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 animate-pulse" /> {t('auth.authenticating')}
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      {t('auth.initialize_session')} <ArrowRight className="h-4 w-4" />
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
