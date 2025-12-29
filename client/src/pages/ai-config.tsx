import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { 
  Bot, 
  Sparkles, 
  Save,
  Cpu,
  Loader,
  Eye,
  EyeOff,
  Check
} from "lucide-react";
import { toast } from "sonner";

interface Provider {
  id: number;
  name: string;
  apiKey: string | null;
  isActive: boolean;
  config: any;
  createdAt: string;
}

interface Model {
  id: number;
  providerId: number;
  modelName: string;
  displayName: string;
  capabilities: string[];
  isActive: boolean;
}

export default function AIConfigPage() {
  const queryClient = useQueryClient();
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [defaultPrompt, setDefaultPrompt] = useState(
    "You are an expert summarizer and content curator. Your goal is to extract key insights from tech discussions and present them in a concise, bulleted format. Maintain the original tone but remove noise."
  );
  const [temperature, setTemperature] = useState(0.7);

  const { data: providers = [], isLoading: loadingProviders } = useQuery({
    queryKey: ["ai-providers"],
    queryFn: () => api.getAiProviders(),
  });

  const { data: models = [] } = useQuery({
    queryKey: ["ai-models"],
    queryFn: () => api.getAiModels(),
  });

  const updateProviderMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.updateAiProvider(id, data),
    onSuccess: () => {
      toast.success("تم تحديث مزود الخدمة بنجاح");
      queryClient.invalidateQueries({ queryKey: ["ai-providers"] });
      setConfigDialogOpen(false);
      setApiKeyInput("");
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل تحديث مزود الخدمة");
    },
  });

  const toggleProviderMutation = useMutation({
    mutationFn: (id: number) => api.toggleAiProvider(id),
    onSuccess: () => {
      toast.success("تم تغيير حالة مزود الخدمة");
      queryClient.invalidateQueries({ queryKey: ["ai-providers"] });
    },
  });

  const saveSettingMutation = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) => api.saveSetting(key, value),
    onSuccess: () => {
      toast.success("تم حفظ الإعدادات");
    },
    onError: () => {
      toast.error("فشل حفظ الإعدادات");
    },
  });

  const handleConfigureProvider = (provider: Provider) => {
    setSelectedProvider(provider);
    setApiKeyInput(provider.apiKey || "");
    setConfigDialogOpen(true);
  };

  const handleSaveApiKey = () => {
    if (!selectedProvider) return;
    updateProviderMutation.mutate({
      id: selectedProvider.id,
      data: { apiKey: apiKeyInput }
    });
  };

  const handleSaveAllSettings = async () => {
    try {
      await saveSettingMutation.mutateAsync({ key: "default_prompt", value: defaultPrompt });
      await saveSettingMutation.mutateAsync({ key: "temperature", value: temperature.toString() });
      toast.success("تم حفظ جميع الإعدادات");
    } catch (error) {
      toast.error("فشل حفظ بعض الإعدادات");
    }
  };

  const getProviderDisplayName = (name: string) => {
    const names: Record<string, string> = {
      openai: "OpenAI",
      groq: "Groq",
      claude: "Anthropic Claude",
      huggingface: "HuggingFace"
    };
    return names[name] || name;
  };

  const getProviderColor = (name: string) => {
    const colors: Record<string, string> = {
      openai: "bg-green-500/20 text-green-600 dark:text-green-500",
      groq: "bg-orange-500/20 text-orange-600 dark:text-orange-500",
      claude: "bg-purple-500/20 text-purple-600 dark:text-purple-500",
      huggingface: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-500"
    };
    return colors[name] || "bg-muted text-foreground";
  };

  if (loadingProviders) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground tracking-wide">AI Neural Core</h2>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">إعداد مزودي الذكاء الصناعي والموديلات وقواعد التحويل</p>
        </div>
        <Button 
          onClick={handleSaveAllSettings}
          className="bg-primary text-primary-foreground font-bold hover:bg-primary/90 w-full sm:w-auto"
          disabled={saveSettingMutation.isPending}
          data-testid="button-save-config"
        >
          {saveSettingMutation.isPending ? (
            <Loader className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          حفظ الإعدادات
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Provider Configuration */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Cpu className="h-5 w-5 text-primary" /> مزودي الخدمة النشطون
              </CardTitle>
              <CardDescription>إعداد مفاتيح API وإعدادات الاتصال لخدمات الذكاء الصناعي</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {providers.map((provider: Provider) => {
                const isActive = provider.isActive && provider.apiKey;
                const hasApiKey = !!provider.apiKey;
                return (
                  <div 
                    key={provider.id} 
                    className={`relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl border-2 transition-all duration-300 ${
                      isActive 
                        ? 'border-green-500/40 bg-gradient-to-l from-green-500/10 via-emerald-500/5 to-transparent dark:from-green-500/20 dark:via-emerald-500/10' 
                        : hasApiKey 
                          ? 'border-yellow-500/40 bg-gradient-to-l from-yellow-500/10 to-transparent dark:from-yellow-500/15'
                          : 'border-border bg-muted/30 hover:bg-muted/50'
                    }`}
                    data-testid={`provider-card-${provider.name}`}
                  >
                    {isActive && (
                      <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-l from-green-500 to-emerald-500" />
                    )}
                    <div className="flex items-center gap-4">
                      <div className={`h-12 w-12 rounded-xl flex items-center justify-center shadow-lg transition-all ${getProviderColor(provider.name)}`}>
                        <Bot className="h-6 w-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground text-base">{getProviderDisplayName(provider.name)}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <div className={`h-2 w-2 rounded-full ${hasApiKey ? (isActive ? 'bg-green-500 animate-pulse' : 'bg-yellow-500') : 'bg-red-500'}`} />
                          <span className={`text-xs font-medium ${isActive ? 'text-green-600 dark:text-green-400' : hasApiKey ? 'text-yellow-600 dark:text-yellow-400' : 'text-muted-foreground'}`}>
                            {hasApiKey 
                              ? (isActive ? 'متصل ونشط' : 'متصل ومعطل') 
                              : 'غير متصل - يحتاج مفتاح API'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 justify-end">
                      <div className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        isActive 
                          ? 'bg-green-500/20 text-green-600 dark:text-green-400' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {isActive ? 'مفعّل' : 'معطّل'}
                      </div>
                      <Switch
                        checked={provider.isActive}
                        onCheckedChange={() => toggleProviderMutation.mutate(provider.id)}
                        disabled={!provider.apiKey}
                        data-testid={`switch-provider-${provider.name}`}
                      />
                      <Button 
                        variant={hasApiKey ? "outline" : "default"}
                        size="sm"
                        onClick={() => handleConfigureProvider(provider)}
                        className={`rounded-xl font-semibold ${!hasApiKey ? 'bg-primary hover:bg-primary/90' : ''}`}
                        data-testid={`button-configure-${provider.name}`}
                      >
                        {hasApiKey ? 'تعديل' : 'إعداد'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Settings */}
        <div className="space-y-6">
          {/* Available Models Section */}
          <Card className="border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Bot className="h-5 w-5 text-primary" /> الموديلات المتاحة
              </CardTitle>
              <CardDescription>قائمة بجميع موديلات الذكاء الاصطناعي المتاحة</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[400px] overflow-y-auto">
              {providers.map((provider: Provider) => {
                const providerModels = models.filter((m: Model) => m.providerId === provider.id);
                if (providerModels.length === 0) return null;
                return (
                  <div key={provider.id} className="space-y-2">
                    <div className={`px-2 py-1 rounded-lg text-xs font-bold ${getProviderColor(provider.name)}`}>
                      {getProviderDisplayName(provider.name)} ({providerModels.length})
                    </div>
                    <div className="space-y-1 pr-2">
                      {providerModels.map((model: Model) => (
                        <div 
                          key={model.id}
                          className={`flex items-center justify-between p-2 rounded-lg text-xs transition-all ${
                            model.isActive 
                              ? 'bg-green-500/10 border border-green-500/30' 
                              : 'bg-muted/50 border border-transparent'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${model.isActive ? 'bg-green-500' : 'bg-muted-foreground'}`} />
                            <span className="font-medium text-foreground">{model.displayName}</span>
                          </div>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                            Array.isArray(model.capabilities) && model.capabilities.includes('audio')
                              ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' 
                              : 'bg-purple-500/20 text-purple-600 dark:text-purple-400'
                          }`}>
                            {Array.isArray(model.capabilities) && model.capabilities.includes('audio') ? 'صوت' : 'نص'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {models.length === 0 && (
                <div className="text-center text-muted-foreground py-8">
                  <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">لا توجد موديلات متاحة</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border shadow-sm bg-gradient-to-b from-purple-500/5 to-transparent dark:from-purple-900/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-foreground">
                <Sparkles className="h-5 w-5 text-yellow-600 dark:text-yellow-400" /> الشخصية الافتراضية
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground tracking-wider">System Prompt</Label>
                <Textarea 
                  className="min-h-[200px] font-mono text-sm resize-none"
                  value={defaultPrompt}
                  onChange={(e) => setDefaultPrompt(e.target.value)}
                  data-testid="textarea-system-prompt"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs uppercase text-muted-foreground tracking-wider">Temperature</Label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                    className="flex-1 h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                    data-testid="slider-temperature"
                  />
                  <span className="font-mono text-sm text-foreground w-10">{temperature.toFixed(1)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Configure Provider Dialog */}
      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>إعداد {selectedProvider ? getProviderDisplayName(selectedProvider.name) : ""}</DialogTitle>
            <DialogDescription>أدخل مفتاح API للاتصال بالخدمة</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="api-key">مفتاح API</Label>
              <div className="relative mt-1">
                <Input
                  id="api-key"
                  type={showApiKey ? "text" : "password"}
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="sk-..."
                  className="pr-10"
                  data-testid="input-api-key"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            
            <Button 
              onClick={handleSaveApiKey}
              className="w-full"
              disabled={updateProviderMutation.isPending}
              data-testid="button-save-api-key"
            >
              {updateProviderMutation.isPending ? (
                <Loader className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              حفظ المفتاح
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
