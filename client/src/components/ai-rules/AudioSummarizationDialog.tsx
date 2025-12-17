import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Loader, Mic, Sparkles, ListChecks, Hash, Zap, AlignLeft, Settings2, BookOpen } from "lucide-react";
import { SummarizationRule, summarizationStyles } from "./types";

interface AudioSummarizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Partial<SummarizationRule>) => void;
  editingData?: SummarizationRule | null;
  isLoading?: boolean;
}

const defaultForm: Partial<SummarizationRule> = {
  name: '',
  prompt: '',
  maxLength: 300,
  style: 'balanced',
  keyPointsCount: 3,
  isActive: true,
  priority: 0
};

const styleIcons: Record<string, { icon: string; color: string; bgColor: string }> = {
  brief: { icon: '⚡', color: 'text-blue-500', bgColor: 'bg-blue-500' },
  balanced: { icon: '⚖️', color: 'text-purple-500', bgColor: 'bg-purple-500' },
  detailed: { icon: '📚', color: 'text-emerald-500', bgColor: 'bg-emerald-500' },
  technical: { icon: '🔧', color: 'text-orange-500', bgColor: 'bg-orange-500' },
};

export function AudioSummarizationDialog({ open, onOpenChange, onSubmit, editingData, isLoading }: AudioSummarizationDialogProps) {
  const [form, setForm] = useState<Partial<SummarizationRule>>(defaultForm);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] p-0 overflow-hidden bg-gradient-to-b from-background to-background/95">
        <div className="bg-gradient-to-l from-blue-500/10 via-cyan-500/10 to-teal-500/10 dark:from-blue-500/20 dark:via-cyan-500/15 dark:to-teal-500/10">
          <DialogHeader className="p-6 pb-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 shadow-lg shadow-blue-500/25">
                <Mic className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold bg-gradient-to-l from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent">
                  {editingData ? "تعديل قاعدة تلخيص الصوت" : "إضافة قاعدة تلخيص صوت"}
                </DialogTitle>
                <DialogDescription className="text-sm mt-1 text-muted-foreground">
                  أعد قاعدة تلخيص المقاطع الصوتية والرسائل الصوتية
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-blue-500" />
              اسم القاعدة
            </Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="مثال: تلخيص الرسائل الصوتية المختصر"
              className="h-12 text-base border-2 focus:border-primary/50 transition-all rounded-xl bg-muted/30"
            />
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-purple-500" />
              أسلوب التلخيص
            </Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {summarizationStyles.map((style) => {
                const styleInfo = styleIcons[style.value] || styleIcons.balanced;
                const isSelected = form.style === style.value;
                return (
                  <button
                    key={style.value}
                    type="button"
                    onClick={() => setForm({ ...form, style: style.value })}
                    className={`p-3 rounded-xl border-2 transition-all duration-200 text-center ${
                      isSelected
                        ? `border-primary/50 bg-primary/10 dark:bg-primary/20 ring-2 ring-primary/20`
                        : 'border-border hover:border-primary/30 hover:bg-muted/50'
                    }`}
                  >
                    <div className="text-2xl mb-1">{styleInfo.icon}</div>
                    <div className="font-semibold text-xs">{style.label}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Hash className="h-4 w-4 text-blue-500" />
                الطول الأقصى: <span className="text-primary font-bold">{form.maxLength} حرف</span>
              </Label>
              <div className="px-2">
                <Slider
                  value={[form.maxLength || 300]}
                  onValueChange={([value]) => setForm({ ...form, maxLength: value })}
                  min={100}
                  max={2000}
                  step={50}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>100</span>
                  <span>2000</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-cyan-500" />
                النقاط الرئيسية: <span className="text-primary font-bold">{form.keyPointsCount}</span>
              </Label>
              <div className="px-2">
                <Slider
                  value={[form.keyPointsCount || 3]}
                  onValueChange={([value]) => setForm({ ...form, keyPointsCount: value })}
                  min={1}
                  max={10}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-2">
                  <span>1</span>
                  <span>10</span>
                </div>
              </div>
            </div>
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

          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <AlignLeft className="h-4 w-4 text-cyan-500" />
              تعليمات مخصصة (اختياري)
            </Label>
            <Textarea
              value={form.prompt}
              onChange={(e) => setForm({ ...form, prompt: e.target.value })}
              placeholder="أضف تعليمات خاصة للذكاء الاصطناعي عند تلخيص المقاطع الصوتية..."
              className="min-h-[100px] border-2 rounded-xl bg-muted/30 resize-none"
            />
          </div>

          <div className="p-4 rounded-xl border-2 border-blue-500/30 bg-gradient-to-l from-blue-500/5 to-cyan-500/5 dark:from-blue-500/10 dark:to-cyan-500/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${form.isActive ? 'bg-blue-500 text-white' : 'bg-muted'}`}>
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-semibold">تفعيل القاعدة</div>
                  <div className="text-xs text-muted-foreground">القاعدة {form.isActive ? 'مفعلة' : 'معطلة'}</div>
                </div>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-6 pt-0">
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !form.name}
            className="flex-1 h-12 rounded-xl bg-gradient-to-l from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-bold shadow-lg shadow-blue-500/25"
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
