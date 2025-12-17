import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Video, Link2, Download, Sparkles, MonitorPlay, Smartphone, Monitor, Tv } from "lucide-react";

interface LinkProcessingSettingsProps {
  linkVideoDownloadEnabled: boolean;
  linkVideoQuality: string;
  onVideoDownloadChange: (enabled: boolean) => void;
  onQualityChange: (quality: string) => void;
}

const qualityOptions = [
  { 
    value: 'low', 
    label: 'منخفضة', 
    resolution: '480p', 
    size: '~15MB',
    icon: Smartphone,
    color: 'from-slate-500 to-gray-600',
    borderColor: 'border-slate-500/40',
    bgColor: 'bg-slate-500/10 dark:bg-slate-500/20'
  },
  { 
    value: 'medium', 
    label: 'متوسطة', 
    resolution: '720p', 
    size: '~30MB',
    icon: Monitor,
    color: 'from-blue-500 to-cyan-600',
    borderColor: 'border-blue-500/40',
    bgColor: 'bg-blue-500/10 dark:bg-blue-500/20'
  },
  { 
    value: 'high', 
    label: 'عالية', 
    resolution: '1080p', 
    size: '~50MB',
    icon: MonitorPlay,
    color: 'from-purple-500 to-pink-600',
    borderColor: 'border-purple-500/40',
    bgColor: 'bg-purple-500/10 dark:bg-purple-500/20'
  },
  { 
    value: 'best', 
    label: 'أفضل متاح', 
    resolution: '4K+', 
    size: '~100MB',
    icon: Tv,
    color: 'from-emerald-500 to-teal-600',
    borderColor: 'border-emerald-500/40',
    bgColor: 'bg-emerald-500/10 dark:bg-emerald-500/20'
  },
];

export function LinkProcessingSettings({
  linkVideoDownloadEnabled,
  linkVideoQuality,
  onVideoDownloadChange,
  onQualityChange
}: LinkProcessingSettingsProps) {
  return (
    <div className="space-y-5">
      <div className="p-4 rounded-xl bg-gradient-to-l from-blue-500/5 via-cyan-500/5 to-teal-500/5 dark:from-blue-500/10 dark:via-cyan-500/10 dark:to-teal-500/10 border border-blue-500/20">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-500/20 mt-0.5">
            <Link2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            عند تفعيل معالجة الروابط، سيتم تنزيل الفيديو من الروابط المرسلة 
            <span className="text-foreground font-medium mx-1">(YouTube, Twitter, Instagram, TikTok...)</span> 
            ومعالجته تلقائياً. تعمل هذه الميزة فقط عندما تحتوي الرسالة على رابط فقط بدون نص إضافي.
          </p>
        </div>
      </div>

      <div className={`p-4 rounded-xl border-2 transition-all duration-300 ${
        linkVideoDownloadEnabled 
          ? 'border-emerald-500/50 bg-gradient-to-l from-emerald-500/10 to-teal-500/5 dark:from-emerald-500/20 dark:to-teal-500/10' 
          : 'border-border bg-muted/30'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl transition-colors ${
              linkVideoDownloadEnabled ? 'bg-emerald-500 text-white' : 'bg-muted'
            }`}>
              <Download className="h-5 w-5" />
            </div>
            <div>
              <Label className={`font-semibold ${linkVideoDownloadEnabled ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>
                تحميل الفيديو الأصلي
              </Label>
              <p className="text-xs text-muted-foreground mt-0.5">تنزيل الفيديو من الروابط المدعومة</p>
            </div>
          </div>
          <Switch
            checked={linkVideoDownloadEnabled}
            onCheckedChange={onVideoDownloadChange}
          />
        </div>
      </div>

      {linkVideoDownloadEnabled && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <Label className="flex items-center gap-2 text-sm font-semibold">
            <Video className="h-4 w-4 text-purple-500" />
            دقة الفيديو
          </Label>
          <div className="grid grid-cols-2 gap-3">
            {qualityOptions.map((quality) => {
              const isSelected = linkVideoQuality === quality.value;
              const IconComponent = quality.icon;
              return (
                <button
                  key={quality.value}
                  type="button"
                  onClick={() => onQualityChange(quality.value)}
                  className={`group relative p-4 rounded-xl border-2 transition-all duration-200 text-right overflow-hidden ${
                    isSelected 
                      ? `${quality.borderColor} ${quality.bgColor} ring-2 ring-offset-2 ring-offset-background ring-primary/30`
                      : 'border-border hover:border-primary/30 hover:bg-muted/50'
                  }`}
                >
                  {isSelected && (
                    <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-l ${quality.color}`} />
                  )}
                  <div className="flex items-start justify-between mb-2">
                    <div className={`p-2 rounded-lg transition-colors ${
                      isSelected ? `bg-gradient-to-br ${quality.color} text-white` : 'bg-muted'
                    }`}>
                      <IconComponent className="h-4 w-4" />
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      isSelected 
                        ? `bg-gradient-to-l ${quality.color} text-white` 
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {quality.resolution}
                    </span>
                  </div>
                  <div className="font-bold text-sm">{quality.label}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    {quality.size}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
