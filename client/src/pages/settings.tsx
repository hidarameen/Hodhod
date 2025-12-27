import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  UserPlus, 
  Bell, 
  Database,
  Save,
  Trash2,
  Loader,
  Phone,
  Key,
  LogOut,
  CheckCircle,
  AlertCircle,
  Smartphone,
  XCircle,
  RefreshCw,
  ScrollText,
  Copy,
  Download,
  Filter,
  X,
  ChevronDown,
  Clock,
  AlertTriangle,
  Info
} from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Admin {
  id: number;
  telegramId: string;
  username: string | null;
  addedBy: number | null;
  createdAt: string;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [newAdminId, setNewAdminId] = useState("");
  const [newAdminUsername, setNewAdminUsername] = useState("");
  const [addAdminDialogOpen, setAddAdminDialogOpen] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState({
    errorAlerts: true,
    taskCompletion: false,
    autoBackup: true
  });
  
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [twoFaPassword, setTwoFaPassword] = useState("");
  const [loginStep, setLoginStep] = useState<"phone" | "otp" | "2fa">("phone");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [phoneError, setPhoneError] = useState("");

  // Event Logs State
  const [logFilter, setLogFilter] = useState<string>("");
  const [logLevelFilter, setLogLevelFilter] = useState<string>("all");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  const { data: admins = [], isLoading: loadingAdmins } = useQuery({
    queryKey: ["admins"],
    queryFn: () => api.getAdmins(),
  });

  const { data: settings = [] } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api.getSettings(),
  });

  const { data: userbotStatus, isLoading: loadingUserbot, refetch: refetchUserbot } = useQuery({
    queryKey: ["userbot-status"],
    queryFn: async () => {
      const res = await fetch("/api/userbot/status");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const { data: eventLogs = [], isLoading: loadingLogs, refetch: refetchLogs } = useQuery({
    queryKey: ["error-logs", logLevelFilter, autoRefresh],
    queryFn: () => api.getErrorLogs(1000, autoRefresh ? 5 : undefined),
    refetchInterval: autoRefresh ? 2000 : false, // تحديث أسرع (كل ثانيتين)
  });

  // Auto-scroll logic
  useEffect(() => {
    if (autoRefresh && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [eventLogs, autoRefresh]);

  const createAdminMutation = useMutation({
    mutationFn: (data: { telegramId: string; username?: string }) => api.createAdmin(data),
    onSuccess: () => {
      toast.success("تمت إضافة المسؤول بنجاح");
      queryClient.invalidateQueries({ queryKey: ["admins"] });
      setAddAdminDialogOpen(false);
      setNewAdminId("");
      setNewAdminUsername("");
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل إضافة المسؤول");
    },
  });

  const deleteAdminMutation = useMutation({
    mutationFn: (id: number) => api.deleteAdmin(id),
    onSuccess: () => {
      toast.success("تم حذف المسؤول");
      queryClient.invalidateQueries({ queryKey: ["admins"] });
    },
    onError: () => {
      toast.error("فشل حذف المسؤول");
    },
  });

  const saveSettingMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => api.saveSetting(key, value),
    onSuccess: () => {
      toast.success("تم حفظ الإعدادات");
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  const handleAddAdmin = () => {
    if (!newAdminId) {
      toast.error("يرجى إدخال معرف تلغرام");
      return;
    }
    createAdminMutation.mutate({
      telegramId: newAdminId,
      username: newAdminUsername || undefined
    });
  };

  const handleSaveSettings = async () => {
    try {
      await saveSettingMutation.mutateAsync({ key: "error_alerts", value: notificationSettings.errorAlerts.toString() });
      await saveSettingMutation.mutateAsync({ key: "task_completion", value: notificationSettings.taskCompletion.toString() });
      await saveSettingMutation.mutateAsync({ key: "auto_backup", value: notificationSettings.autoBackup.toString() });
      toast.success("تم حفظ جميع الإعدادات");
    } catch (error) {
      toast.error("فشل حفظ بعض الإعدادات");
    }
  };

  const validatePhoneNumber = (phone: string): boolean => {
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    const phoneRegex = /^\+?[1-9]\d{6,14}$/;
    return phoneRegex.test(cleanPhone);
  };

  const resetLoginForm = () => {
    setPhoneNumber("");
    setOtpCode("");
    setTwoFaPassword("");
    setLoginStep("phone");
    setPhoneError("");
  };

  const handleStartLogin = async () => {
    setPhoneError("");
    
    if (!phoneNumber) {
      setPhoneError("يرجى إدخال رقم الهاتف");
      toast.error("يرجى إدخال رقم الهاتف");
      return;
    }
    
    if (!validatePhoneNumber(phoneNumber)) {
      setPhoneError("رقم الهاتف غير صالح - تأكد من إضافة رمز الدولة");
      toast.error("رقم الهاتف غير صالح");
      return;
    }
    
    setIsLoggingIn(true);
    try {
      const res = await fetch("/api/userbot/login/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
      });
      const data = await res.json();
      
      if (data.status === "code_sent") {
        toast.success(data.message || "تم إرسال رمز التحقق");
        setLoginStep("otp");
      } else if (data.status === "error") {
        toast.error(data.message || "فشل إرسال الرمز");
        if (data.error === "phone_invalid") {
          setPhoneError("رقم الهاتف غير صحيح");
        }
      }
    } catch (error) {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!otpCode) {
      toast.error("يرجى إدخال رمز التحقق");
      return;
    }
    
    setIsLoggingIn(true);
    try {
      const res = await fetch("/api/userbot/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, code: otpCode }),
      });
      const data = await res.json();
      
      if (data.status === "success") {
        toast.success(data.message || "تم تسجيل الدخول بنجاح");
        resetLoginForm();
        refetchUserbot();
      } else if (data.status === "2fa_required") {
        toast.info(data.message || "يتطلب كلمة مرور التحقق بخطوتين");
        setLoginStep("2fa");
      } else if (data.status === "error") {
        toast.error(data.message || "رمز التحقق غير صحيح");
        if (data.error === "session_expired" || data.error === "code_expired") {
          resetLoginForm();
        }
      }
    } catch (error) {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleVerify2FA = async () => {
    if (!twoFaPassword) {
      toast.error("يرجى إدخال كلمة المرور");
      return;
    }
    
    setIsLoggingIn(true);
    try {
      const res = await fetch("/api/userbot/login/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, password: twoFaPassword }),
      });
      const data = await res.json();
      
      if (data.status === "success") {
        toast.success(data.message || "تم تسجيل الدخول بنجاح");
        resetLoginForm();
        refetchUserbot();
      } else if (data.status === "error") {
        toast.error(data.message || "كلمة المرور غير صحيحة");
        if (data.error === "session_expired") {
          resetLoginForm();
        }
      }
    } catch (error) {
      toast.error("حدث خطأ في الاتصال");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleCancelLogin = async () => {
    if (!phoneNumber) {
      resetLoginForm();
      return;
    }
    
    setIsLoggingIn(true);
    try {
      await fetch("/api/userbot/login/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
      });
      toast.info("تم إلغاء عملية تسجيل الدخول");
    } catch (error) {
      console.error("Cancel error:", error);
    } finally {
      resetLoginForm();
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingIn(true);
    try {
      const res = await fetch("/api/userbot/logout", { method: "POST" });
      const data = await res.json();
      
      if (data.status === "success") {
        toast.success(data.message || "تم تسجيل الخروج");
        refetchUserbot();
      }
    } catch (error) {
      toast.error("فشل تسجيل الخروج");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const getInitial = (username: string | null) => {
    if (!username) return "?";
    return username.replace("@", "").charAt(0).toUpperCase();
  };

  const isConnected = userbotStatus?.status === "connected" || userbotStatus?.status === "active";

  // Event Logs Helpers
  const getLogLevelColor = (level: string) => {
    if (level?.includes("ERROR")) return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900";
    if (level?.includes("WARN")) return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900";
    if (level?.includes("INFO")) return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900";
    return "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-900";
  };

  const getLogLevelIcon = (level: string) => {
    if (level?.includes("ERROR")) return <AlertTriangle className="h-4 w-4" />;
    if (level?.includes("WARN")) return <AlertCircle className="h-4 w-4" />;
    if (level?.includes("INFO")) return <Info className="h-4 w-4" />;
    return <Clock className="h-4 w-4" />;
  };

  const filteredLogs = eventLogs.filter((log: any) => {
    const matchesSearch = !logFilter || 
      log.component?.toLowerCase().includes(logFilter.toLowerCase()) ||
      log.errorMessage?.toLowerCase().includes(logFilter.toLowerCase()) ||
      log.function?.toLowerCase().includes(logFilter.toLowerCase());
    
    const matchesLevel = logLevelFilter === "all" || log.errorType?.includes(logLevelFilter.toUpperCase());
    
    return matchesSearch && matchesLevel;
  });

  // Show all logs without deduplication
  const deduplicatedLogs = filteredLogs;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("تم نسخ إلى الحافظة");
  };

  const downloadLogs = () => {
    const logsText = filteredLogs.map((log: any) => 
      `[${log.timestamp}] ${log.errorType} - ${log.component} - ${log.errorMessage}`
    ).join("\n");
    
    const element = document.createElement("a");
    element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(logsText));
    element.setAttribute("download", `event-logs-${new Date().toISOString()}.txt`);
    element.style.display = "none";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success("تم تحميل السجلات");
  };

  return (
    <div className="space-y-6 md:space-y-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground tracking-wide">إعدادات النظام</h2>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">إدارة التحكم بالوصول والإشعارات وتفضيلات النظام</p>
        </div>
        <Button 
          onClick={handleSaveSettings}
          className="bg-primary text-primary-foreground font-bold hover:bg-primary/90 w-full sm:w-auto"
          disabled={saveSettingMutation.isPending}
          data-testid="button-save-settings"
        >
          {saveSettingMutation.isPending ? (
            <Loader className="h-3 w-3 mr-2 animate-spin" />
          ) : (
            <Save className="h-3 w-3 mr-2" />
          )}
          حفظ التغييرات
        </Button>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-fit">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">عام</span>
          </TabsTrigger>
          <TabsTrigger value="admins" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">مسؤولين</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <ScrollText className="h-4 w-4" />
            <span className="hidden sm:inline">سجلات</span>
          </TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6">
          <Card className="border shadow-sm border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Smartphone className="h-4 w-4 text-primary" /> تسجيل دخول اليوزربوت
              </CardTitle>
              <CardDescription>
                تسجيل الدخول بحساب تلغرام لتفعيل إعادة توجيه الرسائل من القنوات
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingUserbot ? (
                <div className="flex justify-center p-4">
                  <Loader className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : isConnected ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-lg">
                    <CheckCircle className="h-6 w-6 text-green-500 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="font-medium text-green-600 dark:text-green-400">متصل ويعمل</p>
                      <p className="text-sm text-muted-foreground">
                        رقم الهاتف: {userbotStatus.phoneNumber}
                      </p>
                      {userbotStatus.lastLoginAt && (
                        <p className="text-xs text-muted-foreground">
                          آخر تسجيل دخول: {new Date(userbotStatus.lastLoginAt).toLocaleString('ar')}
                        </p>
                      )}
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={handleLogout}
                      disabled={isLoggingIn}
                      className="text-red-600 border-red-500/30 hover:bg-red-500/10"
                      data-testid="button-userbot-logout"
                    >
                      {isLoggingIn ? (
                        <Loader className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <LogOut className="h-4 w-4 mr-1" /> تسجيل خروج
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">
                      يجب تسجيل الدخول لتفعيل إعادة توجيه الرسائل
                    </p>
                  </div>

                  {loginStep === "phone" && (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="phone">رقم الهاتف (مع رمز الدولة)</Label>
                        <div className="relative mt-1">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="phone"
                            type="tel"
                            value={phoneNumber}
                            onChange={(e) => {
                              setPhoneNumber(e.target.value);
                              setPhoneError("");
                            }}
                            placeholder="+966512345678"
                            className={`pl-10 ${phoneError ? 'border-red-500' : ''}`}
                            dir="ltr"
                            data-testid="input-phone-number"
                          />
                        </div>
                        {phoneError ? (
                          <p className="text-xs text-red-500 mt-1">{phoneError}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground mt-1">
                            مثال: +966512345678 أو +201012345678
                          </p>
                        )}
                      </div>
                      <Button 
                        onClick={handleStartLogin}
                        className="w-full"
                        disabled={isLoggingIn}
                        data-testid="button-send-code"
                      >
                        {isLoggingIn ? (
                          <Loader className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Key className="h-4 w-4 mr-2" />
                        )}
                        إرسال رمز التحقق
                      </Button>
                    </div>
                  )}

                  {loginStep === "otp" && (
                    <div className="space-y-3">
                      <div className="text-center p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                        <p className="text-sm text-blue-600 dark:text-blue-400">
                          تم إرسال رمز التحقق إلى تلغرام أو الرسائل النصية
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          رقم الهاتف: {phoneNumber}
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="otp">رمز التحقق</Label>
                        <Input
                          id="otp"
                          type="text"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                          placeholder="12345"
                          className="mt-1 text-center text-2xl tracking-widest"
                          maxLength={6}
                          dir="ltr"
                          data-testid="input-otp-code"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline"
                          onClick={handleCancelLogin}
                          className="flex-1"
                          disabled={isLoggingIn}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          إلغاء
                        </Button>
                        <Button 
                          onClick={handleVerifyCode}
                          className="flex-1"
                          disabled={isLoggingIn || !otpCode}
                          data-testid="button-verify-code"
                        >
                          {isLoggingIn && <Loader className="h-4 w-4 mr-2 animate-spin" />}
                          تحقق
                        </Button>
                      </div>
                      <Button 
                        variant="ghost"
                        onClick={handleStartLogin}
                        className="w-full text-sm"
                        disabled={isLoggingIn}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        إعادة إرسال الرمز
                      </Button>
                    </div>
                  )}

                  {loginStep === "2fa" && (
                    <div className="space-y-3">
                      <div className="text-center p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                        <p className="text-sm text-purple-600 dark:text-purple-400">
                          حسابك محمي بالتحقق بخطوتين - أدخل كلمة المرور
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="2fa">كلمة مرور التحقق بخطوتين</Label>
                        <Input
                          id="2fa"
                          type="password"
                          value={twoFaPassword}
                          onChange={(e) => setTwoFaPassword(e.target.value)}
                          placeholder="••••••••"
                          className="mt-1"
                          data-testid="input-2fa-password"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline"
                          onClick={handleCancelLogin}
                          className="flex-1"
                          disabled={isLoggingIn}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          إلغاء
                        </Button>
                        <Button 
                          onClick={handleVerify2FA}
                          className="flex-1"
                          disabled={isLoggingIn || !twoFaPassword}
                          data-testid="button-verify-2fa"
                        >
                          {isLoggingIn && <Loader className="h-4 w-4 mr-2 animate-spin" />}
                          تسجيل الدخول
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Bell className="h-4 w-4 text-primary" /> إشعارات وتنبيهات
              </CardTitle>
              <CardDescription>تخصيص إعدادات الإشعارات والنسخ الاحتياطية</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                {[
                  { key: "errorAlerts", label: "تنبيهات الأخطاء", desc: "تلقي إشعارات بالأخطاء الفورية" },
                  { key: "taskCompletion", label: "إتمام المهام", desc: "إشعارات عند انتهاء المهام" },
                  { key: "autoBackup", label: "النسخ الاحتياطية التلقائية", desc: "حفظ نسخة احتياطية تلقائية يومية" }
                ].map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                    <div className="flex-1">
                      <Label className="font-medium cursor-pointer">{label}</Label>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <Switch
                      checked={notificationSettings[key as keyof typeof notificationSettings]}
                      onCheckedChange={(checked) =>
                        setNotificationSettings({
                          ...notificationSettings,
                          [key]: checked
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Admins Tab */}
        <TabsContent value="admins">
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Shield className="h-4 w-4 text-primary" /> إدارة المسؤولين
              </CardTitle>
              <CardDescription>إدارة المستخدمين المصرح لهم ومسؤولي البوت</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Dialog open={addAdminDialogOpen} onOpenChange={setAddAdminDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-testid="button-add-admin">
                    <UserPlus className="h-3 w-3 mr-2" /> إضافة مسؤول
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>إضافة مسؤول جديد</DialogTitle>
                    <DialogDescription>أدخل معرف تلغرام واسم المستخدم للمسؤول الجديد</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="telegram-id">معرف تلغرام</Label>
                      <Input
                        id="telegram-id"
                        value={newAdminId}
                        onChange={(e) => setNewAdminId(e.target.value)}
                        placeholder="123456789"
                        className="mt-1"
                        data-testid="input-admin-telegram-id"
                      />
                    </div>
                    <div>
                      <Label htmlFor="username">اسم المستخدم (اختياري)</Label>
                      <Input
                        id="username"
                        value={newAdminUsername}
                        onChange={(e) => setNewAdminUsername(e.target.value)}
                        placeholder="@username"
                        className="mt-1"
                        data-testid="input-admin-username"
                      />
                    </div>
                    <Button 
                      onClick={handleAddAdmin}
                      className="w-full"
                      disabled={createAdminMutation.isPending}
                      data-testid="button-submit-admin"
                    >
                      {createAdminMutation.isPending && <Loader className="h-4 w-4 mr-2 animate-spin" />}
                      إضافة المسؤول
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              
              <div className="space-y-2">
                {loadingAdmins ? (
                  <div className="flex justify-center p-4">
                    <Loader className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : admins.length === 0 ? (
                  <div className="text-center p-4 text-muted-foreground">
                    لا يوجد مسؤولون حالياً
                  </div>
                ) : (
                  admins.map((admin: Admin) => (
                    <div 
                      key={admin.id} 
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded bg-muted/50 border border-border hover:border-primary/50 transition-colors"
                      data-testid={`admin-row-${admin.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/40 to-primary/20 flex items-center justify-center text-primary font-bold">
                          {getInitial(admin.username)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{admin.username || "غير معروف"}</p>
                          <p className="text-xs text-muted-foreground font-mono">ID: {admin.telegramId}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteAdminMutation.mutate(admin.id)}
                        disabled={deleteAdminMutation.isPending}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                        data-testid={`button-delete-admin-${admin.id}`}
                      >
                        {deleteAdminMutation.isPending ? (
                          <Loader className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 mr-1" /> حذف
                          </>
                        )}
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Logs Tab */}
        <TabsContent value="logs" className="space-y-4">
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <ScrollText className="h-4 w-4 text-primary" /> سجل الأحداث والكونسول
                  </CardTitle>
                  <CardDescription>عرض جميع أحداث النظام والرسائل التفصيلية</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={autoRefresh ? "default" : "outline"}
                    onClick={() => setAutoRefresh(!autoRefresh)}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className={`h-3 w-3 ${autoRefresh ? 'animate-spin' : ''}`} />
                    تحديث تلقائي
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => refetchLogs()}
                    disabled={loadingLogs}
                  >
                    {loadingLogs ? <Loader className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                    تحديث
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={downloadLogs}
                    className="flex items-center gap-1"
                  >
                    <Download className="h-3 w-3" />
                    تحميل
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                <div className="flex-1 relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="ابحث في الأحداث..."
                    value={logFilter}
                    onChange={(e) => setLogFilter(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <select
                  value={logLevelFilter}
                  onChange={(e) => setLogLevelFilter(e.target.value)}
                  className="px-3 py-2 rounded-md border border-input bg-background text-sm font-medium"
                >
                  <option value="all">جميع المستويات</option>
                  <option value="error">أخطاء</option>
                  <option value="warn">تحذيرات</option>
                  <option value="info">معلومات</option>
                </select>
                {(logFilter || logLevelFilter !== "all") && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setLogFilter("");
                      setLogLevelFilter("all");
                    }}
                    className="text-xs"
                  >
                    <X className="h-3 w-3 mr-1" /> مسح الفلاتر
                  </Button>
                )}
              </div>

              <div className="text-sm text-muted-foreground flex justify-between">
                <span>إجمالي السجلات: <span className="font-semibold text-foreground">{deduplicatedLogs.length}</span></span>
                {autoRefresh && <span className="flex items-center gap-1"><span className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></span> بث مباشر</span>}
              </div>

              <div ref={logsContainerRef} className="bg-slate-950 dark:bg-slate-950 border border-slate-700 dark:border-slate-700 rounded-lg font-mono text-xs overflow-y-auto max-h-[600px] md:max-h-[700px] p-4 space-y-1 shadow-lg" style={{ backgroundColor: '#0f1729' }}>
                {loadingLogs && eventLogs.length === 0 ? (
                  <div className="flex justify-center p-8">
                    <Loader className="h-6 w-6 animate-spin text-blue-400" />
                  </div>
                ) : deduplicatedLogs.length === 0 ? (
                  <div className="text-center text-slate-500 py-8">
                    <ScrollText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    لا توجد أحداث حالياً
                  </div>
                ) : (
                  <>
                    {deduplicatedLogs.map((log: any, idx: number) => {
                      const isError = log.errorType?.includes("ERROR");
                      const isWarn = log.errorType?.includes("WARN");
                      const isInfo = log.errorType?.includes("INFO");
                      return (
                        <div
                          key={`${log.component}-${log.function}-${idx}`}
                          className="py-2 px-3 rounded transition-colors cursor-pointer hover:bg-slate-800/40 animate-in fade-in slide-in-from-bottom-1 duration-300 border border-transparent hover:border-slate-600/30 group"
                          onClick={() => setExpandedLog(expandedLog === idx ? null : idx)}
                        >
                          <div className="flex items-start gap-2 flex-wrap text-xs leading-relaxed">
                            <span className="text-slate-500 flex-shrink-0 select-none">{new Date(log.timestamp).toLocaleTimeString('ar')}</span>
                            <span className={`flex-shrink-0 font-semibold ${
                              isError ? 'text-red-500' : isWarn ? 'text-yellow-500' : isInfo ? 'text-blue-400' : 'text-green-400'
                            }`}>
                              [{log.errorType}]
                            </span>
                            <span className="text-cyan-400 font-medium">{log.component}</span>
                            <span className="text-slate-500">::</span>
                            <span className="text-blue-300">{log.function}</span>
                            <span className={`flex-1 ${
                              isError ? 'text-red-300' : isWarn ? 'text-yellow-300' : 'text-slate-300'
                            } break-words`}>{log.errorMessage}</span>
                          </div>
                          
                          {expandedLog === idx && (
                            <div className="mt-3 ml-6 pl-3 border-l border-slate-700 space-y-2 text-xs animate-in fade-in duration-200">
                              {log.stackTrace && (
                                <div>
                                  <p className="font-semibold text-slate-300 mb-2">Stack Trace:</p>
                                  <pre className="bg-slate-900/60 border border-slate-700 p-3 rounded overflow-x-auto max-h-40 overflow-y-auto text-slate-400 leading-relaxed text-xs" style={{ backgroundColor: '#0d1527' }}>
                                    {log.stackTrace}
                                  </pre>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="mt-2 h-7 text-xs text-blue-400 hover:text-blue-300 hover:bg-slate-700/40 font-mono"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyToClipboard(log.stackTrace);
                                    }}
                                  >
                                    <Copy className="h-3 w-3 mr-1" /> نسخ
                                  </Button>
                                </div>
                              )}
                              {log.metadata && (
                                <div>
                                  <p className="font-semibold text-slate-300 mb-2">البيانات:</p>
                                  <pre className="bg-slate-900/60 border border-slate-700 p-3 rounded overflow-x-auto max-h-40 overflow-y-auto text-slate-400 leading-relaxed text-xs" style={{ backgroundColor: '#0d1527' }}>
                                    {JSON.stringify(log.metadata, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div ref={logsEndRef} className="h-0" />
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
