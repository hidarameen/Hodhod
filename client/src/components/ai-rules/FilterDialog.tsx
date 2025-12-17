import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader, Filter } from "lucide-react";
import { ContentFilter, filterTypes, matchTypes, filterActions, sentimentTargets } from "./types";

interface FilterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Partial<ContentFilter>) => void;
  editingData?: ContentFilter | null;
  isLoading?: boolean;
}

const defaultForm: Partial<ContentFilter> = {
  name: '',
  filterType: 'allow',
  matchType: 'contains',
  pattern: '',
  contextDescription: '',
  sentimentTarget: 'any',
  action: 'forward',
  modifyInstructions: '',
  priority: 0,
  isActive: true
};

export function FilterDialog({ open, onOpenChange, onSubmit, editingData, isLoading }: FilterDialogProps) {
  const [form, setForm] = useState<Partial<ContentFilter>>(defaultForm);

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

  const showContextFields = form.matchType === 'sentiment' || form.matchType === 'context';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20">
              <Filter className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <DialogTitle className="text-lg">{editingData ? "تعديل الفلتر" : "إضافة فلتر محتوى"}</DialogTitle>
              <DialogDescription className="text-sm mt-0.5">تصفية المحتوى بناءً على أنماط أو سياق</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">اسم الفلتر</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="مثال: فلتر الأخبار السياسية"
              className="h-10"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">نوع الفلتر</Label>
              <Select
                value={form.filterType}
                onValueChange={(value) => setForm({ ...form, filterType: value })}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {filterTypes.map((type) => (
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
              <Label className="text-sm font-medium">نوع المطابقة</Label>
              <Select
                value={form.matchType}
                onValueChange={(value) => setForm({ ...form, matchType: value })}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {matchTypes.map((type) => (
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
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">النمط / الكلمات المفتاحية</Label>
            <Input
              value={form.pattern}
              onChange={(e) => setForm({ ...form, pattern: e.target.value })}
              placeholder={form.matchType === 'regex' ? "تعبير نمطي..." : "كلمات مفتاحية..."}
              className="h-10 font-mono"
              dir="ltr"
            />
          </div>

          {showContextFields && (
            <>
              <div className="space-y-2">
                <Label className="text-sm font-medium">وصف السياق</Label>
                <Textarea
                  value={form.contextDescription}
                  onChange={(e) => setForm({ ...form, contextDescription: e.target.value })}
                  placeholder="صف السياق الذي تريد تصفيته..."
                  className="min-h-[80px] resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">المشاعر المستهدفة</Label>
                <Select
                  value={form.sentimentTarget}
                  onValueChange={(value) => setForm({ ...form, sentimentTarget: value })}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sentimentTargets.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-medium">الإجراء</Label>
            <Select
              value={form.action}
              onValueChange={(value) => setForm({ ...form, action: value })}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {filterActions.map((type) => (
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

          {form.action === 'modify' && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">تعليمات التعديل</Label>
              <Textarea
                value={form.modifyInstructions}
                onChange={(e) => setForm({ ...form, modifyInstructions: e.target.value })}
                placeholder="كيف تريد تعديل المحتوى..."
                className="min-h-[80px] resize-none"
              />
            </div>
          )}

          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
            <div className="flex items-center gap-2">
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
              />
              <Label className="text-sm cursor-pointer">مفعّل</Label>
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
            disabled={isLoading || !form.name || !form.pattern}
            className="flex-1 h-11"
          >
            {isLoading && <Loader className="h-4 w-4 mr-2 animate-spin" />}
            {editingData ? "حفظ التعديلات" : "إضافة الفلتر"}
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
