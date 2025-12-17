import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import { 
  LayoutDashboard, 
  Workflow, 
  Bot, 
  Radio, 
  Settings, 
  LogOut,
  Shield,
  Sun,
  Moon,
  Languages,
  Menu,
  X,
  Github,
  Archive
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EagleLogo } from "@/components/eagle-logo";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dir = i18n.language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  // Close sidebar when route changes on mobile
  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  const navItems = [
    { icon: LayoutDashboard, label: t('nav.overview'), path: "/" },
    { icon: Workflow, label: t('nav.tasks'), path: "/tasks" },
    { icon: Radio, label: t('nav.channels'), path: "/channels" },
    { icon: Bot, label: t('nav.ai'), path: "/ai-config" },
    { icon: Archive, label: "الأرشيف", path: "/archive" },
    { icon: Github, label: "GitHub", path: "/github" },
    { icon: Settings, label: t('nav.settings'), path: "/settings" },
  ];

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground font-sans selection:bg-primary/20">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed lg:static inset-y-0 z-50 w-64 flex-shrink-0 text-foreground backdrop-blur-sm flex flex-col transition-transform duration-300 bg-white/90 dark:bg-black/80",
          i18n.language === 'ar' ? "border-l border-border" : "border-r border-border"
        )}
        style={i18n.language === 'ar' 
          ? { right: sidebarOpen ? '0' : '100%' } 
          : { left: sidebarOpen ? '0' : '-100%' }
        }
      >
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shadow-[0_0_15px_hsl(var(--primary)/0.2)]">
              <EagleLogo size={24} flip={i18n.language === 'ar'} className="text-black dark:text-white" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg tracking-wider text-foreground">{t('app.name')}</h1>
              <p className="text-xs text-muted-foreground font-mono">v2.4.0-BETA</p>
            </div>
          </div>
          {/* Close button for mobile */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.path;
            return (
              <Link key={item.path} href={item.path}>
                <div
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group cursor-pointer",
                    isActive 
                      ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_10px_hsl(var(--primary)/0.1)]" 
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <item.icon className={cn("h-5 w-5", isActive && "animate-pulse")} />
                  <span className="font-medium tracking-wide">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border space-y-4">
          <div className="bg-muted/50 rounded-xl p-4 border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground">{t('nav.system_load')}</span>
              <span className="text-xs text-primary font-mono">24%</span>
            </div>
            <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary w-[24%] shadow-[0_0_10px_currentColor]" />
            </div>
          </div>
          
          <button 
            onClick={() => {
              localStorage.removeItem("isAdmin");
              localStorage.removeItem("adminToken");
              localStorage.removeItem("adminUser");
              window.location.href = "/auth";
            }}
            className="flex w-full items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            <span>{t('nav.disconnect')}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top Bar */}
        <header className="h-16 border-b border-border bg-background/50 backdrop-blur-sm flex items-center justify-between px-4 md:px-8 z-10">
          <div className="flex items-center gap-4">
            {/* Mobile menu button */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="lg:hidden"
              onClick={() => setSidebarOpen(true)}
              data-testid="button-toggle-sidebar"
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-medium text-green-600 dark:text-green-500 uppercase tracking-wider hidden sm:inline">{t('common.system_online')}</span>
            </div>
            <div className="h-4 w-px bg-border hidden sm:block" />
            <span className="text-sm text-muted-foreground font-mono hidden sm:inline">{t('common.latency')}: 42ms</span>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            {/* Theme Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="text-muted-foreground hover:text-foreground"
              data-testid="button-toggle-theme"
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>

            {/* Language Toggle */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                  <Languages className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => i18n.changeLanguage('en')}>
                  English
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => i18n.changeLanguage('ar')}>
                  العربية
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex items-center gap-3 pl-2 md:pl-4 border-l border-border">
              <div className="text-right hidden md:block">
                <p className="text-sm font-medium text-foreground">{t('common.admin_user')}</p>
                <p className="text-xs text-muted-foreground">{t('common.level_access')}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-secondary/20 border border-secondary/50 flex items-center justify-center">
                <Shield className="h-5 w-5 text-secondary" />
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
          {children}
        </div>
        
        {/* Background Grid/Effects */}
        <div className="absolute inset-0 pointer-events-none z-[-1] opacity-10 dark:opacity-20" 
             style={{ 
               backgroundImage: 'linear-gradient(hsl(var(--muted-foreground)/0.1) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--muted-foreground)/0.1) 1px, transparent 1px)', 
               backgroundSize: '40px 40px' 
             }} 
        />
      </main>
    </div>
  );
}
