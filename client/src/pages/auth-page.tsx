import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Lock, User, ArrowRight, ShieldCheck, AlertCircle, Sun, Moon, Languages } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import backgroundUrl from "@/assets/background.png";
import { EagleLogo } from "@/components/eagle-logo";

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
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-white dark:bg-black relative overflow-hidden font-sans">
      {/* Dynamic Background */}
      <div 
        className="absolute inset-0 z-0 opacity-30 dark:opacity-50"
        style={{
          backgroundImage: `url(${backgroundUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      
      {/* Enhanced Overlay with Gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/60 to-white dark:from-black/10 dark:via-black/60 dark:to-black z-0" />
      
      {/* Decorative Elements */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl z-0" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl z-0" />
      
      <div className="relative z-10 w-full max-w-lg px-4 pt-8">
        {/* Control Buttons - Positioned Absolutely for Better Layout */}
        <div className={`flex ${i18n.language === 'ar' ? 'flex-row-reverse' : ''} justify-between items-center mb-6 gap-2`}>
          {/* Language Toggle */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => i18n.changeLanguage(i18n.language === 'ar' ? 'en' : 'ar')}
            className="p-3 rounded-xl bg-white/20 dark:bg-white/10 backdrop-blur-sm hover:bg-white/30 dark:hover:bg-white/20 transition-all duration-300 shadow-lg hover:shadow-xl"
            aria-label="Toggle language"
            data-testid="button-toggle-language"
            title={i18n.language === 'ar' ? 'English' : 'العربية'}
          >
            <Languages className="h-5 w-5 text-primary" />
          </motion.button>

          {/* Theme Toggle Button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-3 rounded-xl bg-white/20 dark:bg-white/10 backdrop-blur-sm hover:bg-white/30 dark:hover:bg-white/20 transition-all duration-300 shadow-lg hover:shadow-xl"
            aria-label="Toggle theme"
            data-testid="button-toggle-theme"
          >
            {theme === "dark" ? (
              <Sun className="h-5 w-5 text-amber-400" />
            ) : (
              <Moon className="h-5 w-5 text-blue-600" />
            )}
          </motion.button>
        </div>

        {/* Logo Section */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, type: "spring" }}
          className="flex justify-center mb-12"
        >
          <EagleLogo size={280} flip={i18n.language === 'ar'} className="text-black dark:text-white drop-shadow-2xl" />
        </motion.div>

        {/* Form Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Card className="bg-white/50 dark:bg-black/50 backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-2xl rounded-2xl overflow-hidden">
            {/* Card Header Accent */}
            <div className="h-1 bg-gradient-to-r from-primary via-cyan-400 to-primary" />
            
            <CardContent className="p-10">
              {/* Error Alert */}
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Alert className="mb-6 bg-red-500/15 border border-red-500/40 rounded-xl backdrop-blur-sm">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <AlertDescription className="text-red-600 dark:text-red-400 font-medium">{error}</AlertDescription>
                  </Alert>
                </motion.div>
              )}

              <form onSubmit={handleLogin} className={`space-y-5 ${i18n.language === 'ar' ? 'text-right' : 'text-left'}`}>
                {/* Username Field */}
                <div className="space-y-3">
                  <label className={`text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2 ${i18n.language === 'ar' ? 'flex-row-reverse' : ''}`}>
                    <User className="h-4 w-4 text-primary" />
                    {t('auth.admin_username')}
                  </label>
                  <motion.div
                    whileFocus={{ scale: 1.02 }}
                    className="relative group"
                  >
                    <Input 
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={isLoading}
                      className={`${i18n.language === 'ar' ? 'pr-4 text-right' : 'pl-4'} w-full bg-white/60 dark:bg-white/5 border-2 border-gray-200 dark:border-white/10 text-black dark:text-white focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white dark:focus:bg-white/10 h-12 rounded-xl disabled:opacity-50 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-all duration-300`} 
                      placeholder={t('auth.username_placeholder')}
                      required
                      data-testid="input-username"
                      autoComplete="username"
                    />
                  </motion.div>
                </div>
                
                {/* Password Field */}
                <div className="space-y-3">
                  <label className={`text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2 ${i18n.language === 'ar' ? 'flex-row-reverse' : ''}`}>
                    <Lock className="h-4 w-4 text-primary" />
                    {t('auth.admin_password')}
                  </label>
                  <motion.div
                    whileFocus={{ scale: 1.02 }}
                    className="relative group"
                  >
                    <Input 
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                      className={`${i18n.language === 'ar' ? 'pr-4 text-right' : 'pl-4'} w-full bg-white/60 dark:bg-white/5 border-2 border-gray-200 dark:border-white/10 text-black dark:text-white focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white dark:focus:bg-white/10 h-12 rounded-xl disabled:opacity-50 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-all duration-300`} 
                      placeholder="••••••••••••"
                      required
                      data-testid="input-password"
                      autoComplete="current-password"
                    />
                  </motion.div>
                </div>

                {/* Submit Button */}
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="pt-2"
                >
                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full h-13 bg-gradient-to-r from-primary to-cyan-400 text-white font-bold rounded-xl hover:shadow-2xl hover:shadow-primary/50 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed text-base"
                    data-testid="button-submit"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <ShieldCheck className="h-5 w-5 animate-pulse" /> 
                        {t('auth.authenticating')}
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        {t('auth.initialize_session')} 
                        <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                      </span>
                    )}
                  </Button>
                </motion.div>
              </form>

              {/* Security Footer */}
              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-white/10 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-500 font-mono tracking-widest">🔒 SECURE CONNECTION • TLS 1.3</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Bottom Spacing */}
        <div className="h-8" />
      </div>
    </div>
  );
}
