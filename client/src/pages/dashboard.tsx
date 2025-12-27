import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { 
  Activity, 
  MessageSquare, 
  Zap, 
  Users, 
  TrendingUp,
  Clock,
  Loader
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const chartData = [
  { time: "00:00", messages: 120, ai: 45 },
  { time: "04:00", messages: 80, ai: 20 },
  { time: "08:00", messages: 450, ai: 180 },
  { time: "12:00", messages: 980, ai: 420 },
  { time: "16:00", messages: 850, ai: 380 },
  { time: "20:00", messages: 600, ai: 250 },
  { time: "23:59", messages: 300, ai: 100 },
];

export default function Dashboard() {
  const { t, i18n } = useTranslation();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => api.getDashboardStats(),
    refetchInterval: 15000, // زيادة الفاصل الزمني إلى 15 ثانية لتقليل الضغط
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const statCards = [
    { 
      title: t('dashboard.total_messages'), 
      value: stats?.totalForwarded || "0", 
      icon: MessageSquare, 
      change: "+12%", 
      color: "text-blue-600 dark:text-blue-400" 
    },
    { 
      title: t('dashboard.active_tasks'), 
      value: stats?.activeTasks || "0", 
      icon: Zap, 
      change: stats?.inactiveTasks ? `+${stats.inactiveTasks}` : "0", 
      color: "text-yellow-600 dark:text-yellow-400" 
    },
    { 
      title: t('dashboard.ai_operations'), 
      value: stats?.aiEnabledTasks || "0", 
      icon: Activity, 
      change: "+24%", 
      color: "text-purple-600 dark:text-purple-400" 
    },
    { 
      title: t('dashboard.monitored_channels'), 
      value: stats?.totalChannels || "0", 
      icon: Users, 
      change: "+3", 
      color: "text-green-600 dark:text-green-400" 
    },
  ];

  return (
    <div className="space-y-6 md:space-y-8" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className={i18n.language === 'ar' ? 'text-right' : 'text-left'}>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground tracking-wide">{t('dashboard.title')}</h2>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <span className="px-3 py-1 bg-card border border-border rounded text-xs font-mono text-muted-foreground">
            {t('dashboard.uptime')}: جاري التشغيل
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {statCards.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="border shadow-sm hover:shadow-md transition-shadow" data-testid={`card-stat-${i}`}>
              <CardContent className="p-4 md:p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-2 md:p-3 rounded-xl bg-muted ${stat.color}`}>
                    <stat.icon className="h-5 w-5 md:h-6 md:w-6" />
                  </div>
                  <span className="text-xs font-medium text-green-600 dark:text-green-500 flex items-center gap-1 bg-green-500/10 px-2 py-1 rounded-full">
                    {stat.change} <TrendingUp className="h-3 w-3" />
                  </span>
                </div>
                <div>
                  <p className="text-xs md:text-sm text-muted-foreground font-medium uppercase tracking-wider">{stat.title}</p>
                  <h3 className="text-2xl md:text-3xl font-bold text-foreground mt-1" data-testid={`text-stat-value-${i}`}>{stat.value}</h3>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Main Chart Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <Card className="border shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base md:text-lg font-medium text-foreground flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" /> {t('dashboard.throughput')}
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[250px] md:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorAi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--secondary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '8px' }}
                  itemStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Area type="monotone" dataKey="messages" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorMessages)" />
                <Area type="monotone" dataKey="ai" stroke="hsl(var(--secondary))" strokeWidth={2} fillOpacity={1} fill="url(#colorAi)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Live Logs Panel */}
        <Card className="border shadow-sm flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base md:text-lg font-medium text-foreground flex items-center justify-between">
              <span className="flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /> {t('dashboard.live_logs')}</span>
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto space-y-2">
            <div className="text-xs text-green-600 dark:text-green-500">✓ نظام قيد التشغيل</div>
            <div className="text-xs text-muted-foreground">∘ جاري استقبال البيانات</div>
            <div className="text-xs text-muted-foreground">∘ عدد المهام: {stats?.totalTasks || 0}</div>
            <div className="text-xs text-muted-foreground">∘ القنوات المراقبة: {stats?.totalChannels || 0}</div>
            <div className="text-xs text-purple-600 dark:text-purple-400">◇ الذكاء الصناعي: نشط</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
