import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
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
  Terminal,
  Filter,
  Download
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

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
  
  const [logFilter, setLogFilter] = useState({ source: "", level: "" });
  const [showConsoleLogs, setShowConsoleLogs] = useState(false);

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

  const { data: consoleLogs = [], isLoading: loadingLogs, refetch: refetchLogs } = useQuery({
    queryKey: ["console-logs", logFilter],
    queryFn: () => api.getConsoleLogs({ 
      limit: 200, 
      source: logFilter.source || undefined,
      level: logFilter.level || undefined
    }),
    enabled: showConsoleLogs,
    refetchInterval: showConsoleLogs ? 3000 : false,
  });

  const { data: logsStats } = useQuery({
    queryKey: ["console-logs-stats"],
    queryFn: () => api.getConsoleLogsStats(),
    enabled: showConsoleLogs,
    refetchInterval: showConsoleLogs ? 5000 : false,
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

  const clearLogsMutation = useMutation({
    mutationFn: () => api.clearConsoleLogs(),
    onSuccess: () => {
      toast.success("تم مسح السجلات");
      queryClient.invalidateQueries({ queryKey: ["console-logs"] });
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

  const getLogLevelBadge = (level: string) => {
    switch (level) {
      case 'error':
        return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20';
      case 'warn':
        return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20';
      case 'info':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      default:
        return 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20';
    }
  };

  const handleDownloadLogs = () => {
    const logsText = consoleLogs.map((log: any) => 
      `[${new Date(log.timestamp).toLocaleString('ar')}] [${log.level.toUpperCase()}] [${log.source}] ${log.message}`
    ).join('\n');
    
    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `console-logs-${new Date().toISOString()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 md:space-y-8 max-w-4xl mx-auto">
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
              <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-500" />
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
                <AlertCircle className="h-5 w-5 text-yellow-500" />
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
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded bg-muted/50 border border-border"
                  data-testid={`admin-row-${admin.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded bg-primary/20 flex items-center justify-center text-primary font-bold text-xs">
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
                    className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => deleteAdminMutation.mutate(admin.id)}
                    disabled={deleteAdminMutation.isPending}
                    data-testid={`button-delete-admin-${admin.id}`}
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> حذف
                  </Button>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Database className="h-4 w-4 text-blue-600 dark:text-blue-400" /> حفظ البيانات
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">حالة قاعدة البيانات</Label>
              <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm text-green-600 dark:text-green-400">متصلة وتعمل</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-foreground">النسخ الاحتياطي التلقائي</Label>
                <p className="text-xs text-muted-foreground">نسخ احتياطي يومي للتخزين السحابي</p>
              </div>
              <Switch 
                checked={notificationSettings.autoBackup}
                onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, autoBackup: checked})}
                data-testid="switch-auto-backup"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-foreground">
              <Bell className="h-4 w-4 text-yellow-600 dark:text-yellow-400" /> الإشعارات
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-foreground">تنبيهات الأخطاء</Label>
                <p className="text-xs text-muted-foreground">إشعار المسؤول عند حدوث أخطاء حرجة</p>
              </div>
              <Switch 
                checked={notificationSettings.errorAlerts}
                onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, errorAlerts: checked})}
                data-testid="switch-error-alerts"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-foreground">إتمام المهام</Label>
                <p className="text-xs text-muted-foreground">إشعار عند إتمام مهام التوجيه</p>
              </div>
              <Switch 
                checked={notificationSettings.taskCompletion}
                onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, taskCompletion: checked})}
                data-testid="switch-task-completion"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="cursor-pointer" onClick={() => setShowConsoleLogs(!showConsoleLogs)}>
          <CardTitle className="flex items-center justify-between text-foreground">
            <span className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-green-600 dark:text-green-400" /> سجل الكونسول المباشر
            </span>
            <div className="flex items-center gap-2">
              {logsStats && (
                <div className="flex gap-2 text-xs">
                  <Badge variant="secondary" className="bg-blue-500/10 text-blue-600">
                    {logsStats.info} معلومات
                  </Badge>
                  {logsStats.warnings > 0 && (
                    <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600">
                      {logsStats.warnings} تحذير
                    </Badge>
                  )}
                  {logsStats.errors > 0 && (
                    <Badge variant="secondary" className="bg-red-500/10 text-red-600">
                      {logsStats.errors} خطأ
                    </Badge>
                  )}
                </div>
              )}
              <Button variant="ghost" size="sm">
                {showConsoleLogs ? "إخفاء" : "عرض"}
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            عرض السجلات المباشرة للنظام والبوت مع التحديث التلقائي
          </CardDescription>
        </CardHeader>

        {showConsoleLogs && (
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={logFilter.level} onValueChange={(value) => setLogFilter({...logFilter, level: value})}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="كل المستويات" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">الكل</SelectItem>
                  <SelectItem value="info">معلومات</SelectItem>
                  <SelectItem value="warn">تحذيرات</SelectItem>
                  <SelectItem value="error">أخطاء</SelectItem>
                </SelectContent>
              </Select>

              <Select value={logFilter.source} onValueChange={(value) => setLogFilter({...logFilter, source: value})}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="كل المصادر" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">الكل</SelectItem>
                  <SelectItem value="telegram-bot">البوت</SelectItem>
                  <SelectItem value="express">السيرفر</SelectItem>
                  <SelectItem value="auth-service">المصادقة</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex gap-2 flex-1">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => refetchLogs()}
                  disabled={loadingLogs}
                  className="flex-1 sm:flex-none"
                >
                  <RefreshCw className={`h-4 w-4 mr-1 ${loadingLogs ? 'animate-spin' : ''}`} />
                  تحديث
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleDownloadLogs}
                  disabled={consoleLogs.length === 0}
                  className="flex-1 sm:flex-none"
                >
                  <Download className="h-4 w-4 mr-1" />
                  تحميل
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => clearLogsMutation.mutate()}
                  disabled={clearLogsMutation.isPending}
                  className="flex-1 sm:flex-none"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  مسح
                </Button>
              </div>
            </div>

            <div className="bg-black/95 rounded-lg p-4 max-h-96 overflow-y-auto font-mono text-xs">
              {loadingLogs ? (
                <div className="flex items-center justify-center p-8">
                  <Loader className="h-6 w-6 animate-spin text-green-500" />
                </div>
              ) : consoleLogs.length === 0 ? (
                <div className="text-center text-gray-500 p-4">
                  لا توجد سجلات متاحة
                </div>
              ) : (
                <div className="space-y-1">
                  {consoleLogs.map((log: any) => (
                    <div 
                      key={log.id}
                      className="flex gap-2 hover:bg-white/5 px-2 py-1 rounded transition-colors"
                    >
                      <span className="text-gray-500 shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString('ar', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </span>
                      <Badge 
                        variant="outline" 
                        className={`shrink-0 text-xs h-5 ${getLogLevelBadge(log.level)}`}
                      >
                        {log.level}
                      </Badge>
                      <span className="text-cyan-400 shrink-0">[{log.source}]</span>
                      <span className={`
                        break-all
                        ${log.level === 'error' ? 'text-red-400' : 
                          log.level === 'warn' ? 'text-yellow-400' : 
                          'text-green-400'}
                      `}>
                        {log.message}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span>التحديث التلقائي كل 3 ثوان • عرض آخر {consoleLogs.length} سجل</span>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
