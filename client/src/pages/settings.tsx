import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  UserPlus, 
  Bell, 
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
  Copy,
  Download,
  Filter,
  X,
  AlertTriangle,
  Info,
  Clock
} from "lucide-react";
import { toast } from "sonner";

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

  // Real-time Console State
  const [logFilter, setLogFilter] = useState<string>("");
  const [logLevelFilter, setLogLevelFilter] = useState<string>("all");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedTab, setSelectedTab] = useState<"general" | "console">("general");

  const { data: admins = [], isLoading: loadingAdmins } = useQuery({
    queryKey: ["admins"],
    queryFn: () => api.getAdmins(),
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
    queryKey: ["error-logs"],
    queryFn: () => api.getErrorLogs(1000),
    refetchInterval: autoRefresh ? 2000 : false,
  });

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
      } else {
        toast.error(data.message || "فشل إرسال الرمز");
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
        setLoginStep("2fa");
      } else {
        toast.error(data.message || "رمز التحقق غير صحيح");
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
      } else {
        toast.error(data.message || "كلمة المرور غير صحيحة");
      }
    } catch (error) {
      toast.error("حدث خطأ في الاتصال");
    } finally {
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

  const getLogLevelColor = (level: string) => {
    if (level?.includes("ERROR")) return "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-900";
    if (level?.includes("WARN")) return "bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900";
    if (level?.includes("INFO")) return "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900";
    return "bg-gray-50 dark:bg-gray-950/30 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-900";
  };

  const getLogLevelIcon = (level: string) => {
    if (level?.includes("ERROR")) return <AlertTriangle className="h-4 w-4 flex-shrink-0" />;
    if (level?.includes("WARN")) return <AlertCircle className="h-4 w-4 flex-shrink-0" />;
    if (level?.includes("INFO")) return <Info className="h-4 w-4 flex-shrink-0" />;
    return <Clock className="h-4 w-4 flex-shrink-0" />;
  };

  const filteredLogs = eventLogs.filter((log: any) => {
    const matchesSearch = !logFilter || 
      log.component?.toLowerCase().includes(logFilter.toLowerCase()) ||
      log.errorMessage?.toLowerCase().includes(logFilter.toLowerCase()) ||
      log.function?.toLowerCase().includes(logFilter.toLowerCase());
    
    const matchesLevel = logLevelFilter === "all" || log.errorType?.includes(logLevelFilter.toUpperCase());
    
    return matchesSearch && matchesLevel;
  });

  // Auto-scroll to latest logs
  useEffect(() => {
    const element = document.getElementById("logs-container");
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }, [filteredLogs]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("تم نسخ إلى الحافظة");
  };

  const downloadLogs = () => {
    const logsText = filteredLogs.map((log: any) => 
      `[${log.timestamp}] ${log.errorType} - ${log.component} - ${log.function} - ${log.errorMessage}`
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
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground">إعدادات النظام</h2>
          <p className="text-muted-foreground mt-1">إدارة التحكم والإشعارات وسجلات الأحداث الفورية</p>
        </div>
      </div>

      {selectedTab === "general" && (
        <div className="space-y-6">
          <Card className="border shadow-sm border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-primary" /> تسجيل دخول اليوزربوت
              </CardTitle>
              <CardDescription>تسجيل الدخول بحساب تلغرام</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {loadingUserbot ? (
                <div className="flex justify-center p-4">
                  <Loader className="h-6 w-6 animate-spin" />
                </div>
              ) : isConnected ? (
                <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-6 w-6 text-green-500" />
                    <div>
                      <p className="font-medium text-green-600">متصل ويعمل</p>
                      <p className="text-sm text-muted-foreground">{userbotStatus.phoneNumber}</p>
                    </div>
                  </div>
                  <Button onClick={handleLogout} disabled={isLoggingIn} variant="outline" size="sm" className="text-red-600">
                    {isLoggingIn ? <Loader className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4 mr-1" />}
                    خروج
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-yellow-600 bg-yellow-500/10 p-3 rounded border border-yellow-500/20">
                    <AlertCircle className="h-4 w-4 inline mr-2" /> يجب تسجيل الدخول لتفعيل البوت
                  </div>

                  {loginStep === "phone" && (
                    <div className="space-y-3">
                      <div>
                        <Label>رقم الهاتف (مع رمز الدولة)</Label>
                        <Input
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          placeholder="+966512345678"
                          className="mt-1"
                        />
                      </div>
                      <Button onClick={handleStartLogin} disabled={isLoggingIn} className="w-full">
                        {isLoggingIn && <Loader className="h-4 w-4 mr-2 animate-spin" />}
                        إرسال الرمز
                      </Button>
                    </div>
                  )}

                  {loginStep === "otp" && (
                    <div className="space-y-3">
                      <div>
                        <Label>رمز التحقق</Label>
                        <Input
                          type="text"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                          placeholder="123456"
                          maxLength={6}
                          className="mt-1 text-center text-2xl"
                        />
                      </div>
                      <Button onClick={handleVerifyCode} disabled={isLoggingIn || !otpCode} className="w-full">
                        تحقق
                      </Button>
                    </div>
                  )}

                  {loginStep === "2fa" && (
                    <div className="space-y-3">
                      <div>
                        <Label>كلمة مرور التحقق</Label>
                        <Input type="password" value={twoFaPassword} onChange={(e) => setTwoFaPassword(e.target.value)} className="mt-1" />
                      </div>
                      <Button onClick={handleVerify2FA} disabled={isLoggingIn || !twoFaPassword} className="w-full">
                        تسجيل دخول
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-4 w-4" /> إدارة المسؤولين
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Dialog open={addAdminDialogOpen} onOpenChange={setAddAdminDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <UserPlus className="h-4 w-4 mr-2" /> إضافة مسؤول
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>إضافة مسؤول جديد</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Input
                      value={newAdminId}
                      onChange={(e) => setNewAdminId(e.target.value)}
                      placeholder="معرف تلغرام"
                    />
                    <Input
                      value={newAdminUsername}
                      onChange={(e) => setNewAdminUsername(e.target.value)}
                      placeholder="اسم المستخدم (اختياري)"
                    />
                    <Button onClick={handleAddAdmin} className="w-full" disabled={createAdminMutation.isPending}>
                      إضافة
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <div className="space-y-2">
                {loadingAdmins ? (
                  <div className="text-center p-4"><Loader className="h-6 w-6 animate-spin inline" /></div>
                ) : admins.length === 0 ? (
                  <p className="text-center text-muted-foreground">لا يوجد مسؤولون</p>
                ) : (
                  admins.map((admin: Admin) => (
                    <div key={admin.id} className="flex items-center justify-between p-3 bg-muted rounded border">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                          {getInitial(admin.username)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{admin.username || "غير معروف"}</p>
                          <p className="text-xs text-muted-foreground">ID: {admin.telegramId}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteAdminMutation.mutate(admin.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-4 w-4" /> الإشعارات
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: "errorAlerts", label: "تنبيهات الأخطاء" },
                { key: "taskCompletion", label: "إتمام المهام" },
                { key: "autoBackup", label: "النسخ الاحتياطية" }
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between p-3 border rounded">
                  <Label className="cursor-pointer">{label}</Label>
                  <Switch
                    checked={notificationSettings[key as keyof typeof notificationSettings]}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({ ...notificationSettings, [key]: checked })
                    }
                  />
                </div>
              ))}
              <Button onClick={handleSaveSettings} className="w-full" disabled={saveSettingMutation.isPending}>
                <Save className="h-4 w-4 mr-2" /> حفظ
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {selectedTab === "console" && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <CardTitle>سجل الأحداث Real-Time</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={autoRefresh ? "default" : "outline"}
                    onClick={() => setAutoRefresh(!autoRefresh)}
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${autoRefresh ? 'animate-spin' : ''}`} />
                    {autoRefresh ? "جاري" : "إيقاف"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => refetchLogs()} disabled={loadingLogs}>
                    تحديث
                  </Button>
                  <Button size="sm" variant="outline" onClick={downloadLogs}>
                    <Download className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="ابحث..."
                    value={logFilter}
                    onChange={(e) => setLogFilter(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <select
                  value={logLevelFilter}
                  onChange={(e) => setLogLevelFilter(e.target.value)}
                  className="px-3 py-2 rounded-md border text-sm"
                >
                  <option value="all">الكل</option>
                  <option value="error">أخطاء</option>
                  <option value="warn">تحذيرات</option>
                  <option value="info">معلومات</option>
                </select>
                {(logFilter || logLevelFilter !== "all") && (
                  <Button size="sm" variant="ghost" onClick={() => { setLogFilter(""); setLogLevelFilter("all"); }}>
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>

              <div className="text-xs text-muted-foreground">
                {filteredLogs.length} من {eventLogs.length} سجل
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div id="logs-container" className="space-y-1 h-[600px] overflow-y-auto border rounded-lg p-4 bg-black/5 dark:bg-black/30 font-mono text-xs">
              {loadingLogs ? (
                <div className="flex justify-center py-8"><Loader className="h-6 w-6 animate-spin" /></div>
              ) : filteredLogs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">لا توجد أحداث</div>
              ) : (
                filteredLogs.map((log: any, idx: number) => (
                  <div key={idx} className={`p-2 rounded border-l-2 ${getLogLevelColor(log.errorType)}`}>
                    <div className="flex items-start gap-2">
                      {getLogLevelIcon(log.errorType)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold">[{log.component}]</span>
                          <span className="text-muted-foreground">{log.function}</span>
                          <span className="ml-auto text-muted-foreground text-xs">
                            {new Date(log.timestamp).toLocaleTimeString('ar')}
                          </span>
                        </div>
                        <p className="mt-1 break-words">{log.errorMessage}</p>
                        {log.stackTrace && (
                          <details className="mt-2 cursor-pointer">
                            <summary className="text-xs text-muted-foreground hover:text-foreground">
                              Stack Trace
                            </summary>
                            <pre className="mt-1 p-1 bg-black/10 rounded text-xs overflow-x-auto max-h-24 overflow-y-auto">
                              {log.stackTrace}
                            </pre>
                          </details>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 flex-shrink-0"
                        onClick={() => copyToClipboard(`[${log.timestamp}] ${log.errorType} - ${log.component} - ${log.errorMessage}`)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="fixed bottom-6 right-6 flex gap-2">
        <Button
          onClick={() => setSelectedTab("general")}
          variant={selectedTab === "general" ? "default" : "outline"}
          size="lg"
        >
          الإعدادات
        </Button>
        <Button
          onClick={() => setSelectedTab("console")}
          variant={selectedTab === "console" ? "default" : "outline"}
          size="lg"
        >
          سجل الأحداث
        </Button>
      </div>
    </div>
  );
}
