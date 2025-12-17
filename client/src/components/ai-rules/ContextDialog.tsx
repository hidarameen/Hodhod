import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader, Shield } from "lucide-react";
import { ContextRule, contextRuleTypes } from "./types";

interface ContextDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Partial<ContextRule>) => void;
  editingData?: ContextRule | null;
  isLoading?: boolean;
}

const defaultForm: Partial<ContextRule> = {
  ruleType: 'neutralize_negative',
  triggerPattern: '',
  targetSentiment: 'neutral',
  instructions: '',
  examples: [],
  isActive: true,
  priority: 0
};

export function ContextDialog({ open, onOpenChange, onSubmit, editingData, isLoading }: ContextDialogProps) {
  const [form, setForm] = useState<Partial<ContextRule>>(defaultForm);

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
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20">
              <Shield className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <DialogTitle className="text-lg">{editingData ? "تعديل قاعدة السياق" : "إضافة قاعدة سياق"}</DialogTitle>
              <DialogDescription className="text-sm mt-0.5">تحييد اللغة السلبية أو تعديل أسلوب النص</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">نوع القاعدة</Label>
              <Select
                value={form.ruleType}
                onValueChange={(value) => setForm({ ...form, ruleType: value })}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {contextRuleTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="py-1">
                        <div className="font-medium">{type.label}</div>
                        <div className="text-xs text-muted-foreground">{type.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">النبرة المستهدفة</Label>
              <Select
                value={form.targetSentiment}
                onValueChange={(value) => setForm({ ...form, targetSentiment: value })}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="neutral">حيادي</SelectItem>
                  <SelectItem value="positive">إيجابي</SelectItem>
                  <SelectItem value="formal">رسمي</SelectItem>
                  <SelectItem value="professional">مهني</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.ruleType === 'custom' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">نمط التفعيل (Regex)</Label>
              <Input
                value={form.triggerPattern}
                onChange={(e) => setForm({ ...form, triggerPattern: e.target.value })}
                placeholder="مثال: إرهابي|عميل|خائن"
                className="h-10 font-mono"
                dir="ltr"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-medium">التعليمات</Label>
            <Textarea
              value={form.instructions}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              placeholder="اكتب تعليمات واضحة للذكاء الاصطناعي..."
              className="min-h-[100px] resize-none"
            />
          </div>

          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
                />
                <Label className="text-sm cursor-pointer">مفعّل</Label>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">الأولوية:</Label>
              <Input
                type="number"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })}
                className="w-20 h-9"
                min={0}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !form.instructions}
            className="flex-1 h-11"
          >
            {isLoading && <Loader className="h-4 w-4 mr-2 animate-spin" />}
            {editingData ? "حفظ التعديلات" : "إضافة القاعدة"}
          </Button>
          <Button
            variant="outline"
            className="h-11 px-6"
            onClick={() => onOpenChange(false)}
          >
            إلغاء
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
