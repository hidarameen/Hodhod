import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader, Brain } from "lucide-react";
import { TrainingExample, exampleTypes } from "./types";

interface TrainingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Partial<TrainingExample>) => void;
  editingData?: TrainingExample | null;
  isLoading?: boolean;
}

const defaultForm: Partial<TrainingExample> = {
  exampleType: 'correction',
  inputText: '',
  expectedOutput: '',
  explanation: '',
  tags: [],
  isActive: true
};

export function TrainingDialog({ open, onOpenChange, onSubmit, editingData, isLoading }: TrainingDialogProps) {
  const [form, setForm] = useState<Partial<TrainingExample>>(defaultForm);

  useEffect(() => {
    if (editingData) {
      setForm(editingData);
    } else {
      setForm(defaultForm);
    }
  }, [editingData, open]);

  const handleSubmit = () => {
    if (!form.inputText || !form.expectedOutput) {
      return;
    }
    onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20">
              <Brain className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <DialogTitle className="text-lg">{editingData ? "تعديل مثال التدريب" : "إضافة مثال تدريب"}</DialogTitle>
              <DialogDescription className="text-sm mt-0.5">علّم الذكاء الاصطناعي أسلوبك المفضل بأمثلة عملية</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">نوع المثال</Label>
            <Select
              value={form.exampleType}
              onValueChange={(value) => setForm({ ...form, exampleType: value })}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {exampleTypes.map((type) => (
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
            <Label className="text-sm font-medium">النص المُدخل</Label>
            <Textarea
              value={form.inputText}
              onChange={(e) => setForm({ ...form, inputText: e.target.value })}
              placeholder="النص الأصلي أو مخرج الذكاء الاصطناعي الخاطئ..."
              className="min-h-[80px] resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">المخرج المتوقع</Label>
            <Textarea
              value={form.expectedOutput}
              onChange={(e) => setForm({ ...form, expectedOutput: e.target.value })}
              placeholder="الصياغة الصحيحة التي تفضلها..."
              className="min-h-[80px] resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">شرح (اختياري)</Label>
            <Input
              value={form.explanation}
              onChange={(e) => setForm({ ...form, explanation: e.target.value })}
              placeholder="لماذا هذه الصياغة أفضل؟"
              className="h-10"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !form.inputText || !form.expectedOutput}
            className="flex-1 h-11"
          >
            {isLoading && <Loader className="h-4 w-4 mr-2 animate-spin" />}
            {editingData ? "حفظ التعديلات" : "إضافة المثال"}
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
