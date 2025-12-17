import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Loader, Film, Volume2, Image, Subtitles, Zap, Clock, FileVideo, Settings2, Sparkles } from "lucide-react";
import { VideoProcessingRule, videoOutputFormats } from "./types";

interface VideoProcessingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Partial<VideoProcessingRule>) => void;
  editingData?: VideoProcessingRule | null;
  isLoading?: boolean;
}

const defaultForm: Partial<VideoProcessingRule> = {
  name: '',
  extractFrames: false,
  extractAudio: true,
  maxDuration: 3600,
  outputFormat: 'mp4',
  generateSubtitles: false,
  isActive: true,
  priority: 0
};

export function VideoProcessingDialog({ open, onOpenChange, onSubmit, editingData, isLoading }: VideoProcessingDialogProps) {
  const [form, setForm] = useState<Partial<VideoProcessingRule>>(defaultForm);

  useEffect(() => {
    if (editingData) {
      setForm(editingData);
    } else {
      setForm(defaultForm);
    }
  }, [editingData, open]);

  const handleSubmit = () => {
    onSubmit(form);
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours} ساعة ${mins > 0 ? `و ${mins} دقيقة` : ''}`;
    return `${mins} دقيقة`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] p-0 overflow-hidden bg-gradient-to-b from-background to-background/95">
        <div className="bg-gradient-to-l from-red-500/10 via-pink-500/10 to-purple-500/10 dark:from-red-500/20 dark:via-pink-500/15 dark:to-purple-500/10">
          <DialogHeader className="p-6 pb-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-red-500 to-pink-600 shadow-lg shadow-red-500/25">
                <Film className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold bg-gradient-to-l from-red-600 to-pink-600 dark:from-red-400 dark:to-pink-400 bg-clip-text text-transparent">
                  {editingData ? "تعديل قاعدة معالجة الفيديو" : "إضافة قاعدة معالجة فيديو"}
                </DialogTitle>
                <DialogDescription className="text-sm mt-1 text-muted-foreground">
                  أعد قواعد معالجة ملفات الفيديو والمحتوى البصري
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              اسم القاعدة
            </Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="مثال: معالجة فيديوهات الأخبار"
              className="h-12 text-base border-2 focus:border-primary/50 transition-all rounded-xl bg-muted/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <FileVideo className="h-4 w-4 text-blue-500" />
                صيغة الإخراج
              </Label>
              <Select
                value={form.outputFormat}
                onValueChange={(value) => setForm({ ...form, outputFormat: value })}
              >
                <SelectTrigger className="h-12 border-2 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {videoOutputFormats.map((format) => (
                    <SelectItem key={format.value} value={format.value}>
                      <span className="font-medium">{format.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-purple-500" />
                الأولوية
              </Label>
              <Input
                type="number"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })}
                className="h-12 border-2 rounded-xl bg-muted/30"
                min={0}
                max={100}
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-emerald-500" />
              أقصى مدة: <span className="text-primary font-bold">{formatDuration(form.maxDuration || 3600)}</span>
            </Label>
            <div className="px-2">
              <Slider
                value={[form.maxDuration || 3600]}
                onValueChange={([value]) => setForm({ ...form, maxDuration: value })}
                min={60}
                max={14400}
                step={60}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>1 دقيقة</span>
                <span>4 ساعات</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-semibold">خيارات المعالجة</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm({ ...form, extractFrames: !form.extractFrames })}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 text-right ${
                  form.extractFrames 
                    ? 'border-blue-500/50 bg-blue-500/10 dark:bg-blue-500/20' 
                    : 'border-border hover:border-primary/30 hover:bg-muted/50'
                }`}
              >
                <div className={`p-2.5 rounded-xl ${form.extractFrames ? 'bg-blue-500 text-white' : 'bg-muted'}`}>
                  <Image className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-sm">استخراج الصور</div>
                  <div className="text-xs text-muted-foreground">التقاط إطارات من الفيديو</div>
                </div>
                <Switch checked={form.extractFrames} onCheckedChange={() => {}} className="pointer-events-none" />
              </button>

              <button
                type="button"
                onClick={() => setForm({ ...form, extractAudio: !form.extractAudio })}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 text-right ${
                  form.extractAudio 
                    ? 'border-emerald-500/50 bg-emerald-500/10 dark:bg-emerald-500/20' 
                    : 'border-border hover:border-primary/30 hover:bg-muted/50'
                }`}
              >
                <div className={`p-2.5 rounded-xl ${form.extractAudio ? 'bg-emerald-500 text-white' : 'bg-muted'}`}>
                  <Volume2 className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-sm">استخراج الصوت</div>
                  <div className="text-xs text-muted-foreground">فصل المسار الصوتي</div>
                </div>
                <Switch checked={form.extractAudio} onCheckedChange={() => {}} className="pointer-events-none" />
              </button>

              <button
                type="button"
                onClick={() => setForm({ ...form, generateSubtitles: !form.generateSubtitles })}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 text-right ${
                  form.generateSubtitles 
                    ? 'border-purple-500/50 bg-purple-500/10 dark:bg-purple-500/20' 
                    : 'border-border hover:border-primary/30 hover:bg-muted/50'
                }`}
              >
                <div className={`p-2.5 rounded-xl ${form.generateSubtitles ? 'bg-purple-500 text-white' : 'bg-muted'}`}>
                  <Subtitles className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-sm">إنشاء ترجمات</div>
                  <div className="text-xs text-muted-foreground">توليد نص من الكلام</div>
                </div>
                <Switch checked={form.generateSubtitles} onCheckedChange={() => {}} className="pointer-events-none" />
              </button>

              <button
                type="button"
                onClick={() => setForm({ ...form, isActive: !form.isActive })}
                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 text-right ${
                  form.isActive 
                    ? 'border-amber-500/50 bg-amber-500/10 dark:bg-amber-500/20' 
                    : 'border-border hover:border-primary/30 hover:bg-muted/50'
                }`}
              >
                <div className={`p-2.5 rounded-xl ${form.isActive ? 'bg-amber-500 text-white' : 'bg-muted'}`}>
                  <Zap className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-sm">مفعّل</div>
                  <div className="text-xs text-muted-foreground">تفعيل القاعدة</div>
                </div>
                <Switch checked={form.isActive} onCheckedChange={() => {}} className="pointer-events-none" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-6 pt-0">
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !form.name}
            className="flex-1 h-12 rounded-xl bg-gradient-to-l from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white font-bold shadow-lg shadow-red-500/25"
          >
            {isLoading && <Loader className="h-5 w-5 ml-2 animate-spin" />}
            {editingData ? "حفظ التعديلات" : "إضافة القاعدة"}
          </Button>
          <Button
            variant="outline"
            className="h-12 px-8 rounded-xl border-2"
            onClick={() => onOpenChange(false)}
          >
            إلغاء
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
