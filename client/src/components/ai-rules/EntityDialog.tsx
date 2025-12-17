import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader, ArrowRightLeft, X } from "lucide-react";
import { EntityReplacement, entityTypes } from "./types";

interface EntityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Partial<EntityReplacement>) => void;
  editingData?: EntityReplacement | null;
  isLoading?: boolean;
}

const defaultForm: Partial<EntityReplacement> = {
  entityType: 'person',
  originalText: '',
  replacementText: '',
  caseSensitive: false,
  useContext: true,
  isActive: true,
  priority: 0
};

export function EntityDialog({ open, onOpenChange, onSubmit, editingData, isLoading }: EntityDialogProps) {
  const [form, setForm] = useState<Partial<EntityReplacement>>(defaultForm);
  const [originalTexts, setOriginalTexts] = useState<string[]>([]);
  const [replacementTexts, setReplacementTexts] = useState<string[]>([]);
  const [currentOriginal, setCurrentOriginal] = useState('');
  const [currentReplacement, setCurrentReplacement] = useState('');
  const originalInputRef = useRef<HTMLInputElement>(null);
  const replacementInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingData) {
      setForm(editingData);
      if (editingData.originalText) {
        const originals = editingData.originalText.split('|').map(t => t.trim()).filter(Boolean);
        setOriginalTexts(originals);
      } else {
        setOriginalTexts([]);
      }
      if (editingData.replacementText) {
        const replacements = editingData.replacementText.split('|').map(t => t.trim()).filter(Boolean);
        setReplacementTexts(replacements);
      } else {
        setReplacementTexts([]);
      }
    } else {
      setForm(defaultForm);
      setOriginalTexts([]);
      setReplacementTexts([]);
    }
    setCurrentOriginal('');
    setCurrentReplacement('');
  }, [editingData, open]);

  const handleAddOriginal = (clearInput: boolean = true) => {
    const trimmed = currentOriginal.trim();
    if (trimmed && !originalTexts.includes(trimmed)) {
      setOriginalTexts([...originalTexts, trimmed]);
      if (clearInput) {
        setCurrentOriginal('');
      }
      originalInputRef.current?.focus();
      return true;
    }
    return false;
  };

  const handleAddReplacement = (clearInput: boolean = true) => {
    const trimmed = currentReplacement.trim();
    if (trimmed && !replacementTexts.includes(trimmed)) {
      setReplacementTexts([...replacementTexts, trimmed]);
      if (clearInput) {
        setCurrentReplacement('');
      }
      replacementInputRef.current?.focus();
      return true;
    }
    return false;
  };

  const handleRemoveOriginal = (index: number) => {
    setOriginalTexts(originalTexts.filter((_, i) => i !== index));
  };

  const handleRemoveReplacement = (index: number) => {
    setReplacementTexts(replacementTexts.filter((_, i) => i !== index));
  };

  const handleOriginalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddOriginal();
    } else if (e.key === 'Backspace' && currentOriginal === '' && originalTexts.length > 0) {
      setOriginalTexts(originalTexts.slice(0, -1));
    }
  };

  const handleReplacementKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddReplacement();
    } else if (e.key === 'Backspace' && currentReplacement === '' && replacementTexts.length > 0) {
      setReplacementTexts(replacementTexts.slice(0, -1));
    }
  };

  const handleSubmit = () => {
    const originalText = originalTexts.join('|');
    const replacementText = replacementTexts.join('|');
    
    onSubmit({
      ...form,
      originalText,
      replacementText
    });
  };

  const isValid = originalTexts.length > 0 && replacementTexts.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20">
              <ArrowRightLeft className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-lg">{editingData ? "تعديل قاعدة الاستبدال" : "إضافة قاعدة استبدال"}</DialogTitle>
              <DialogDescription className="text-sm mt-0.5">اكتب الكلمة واضغط Enter لإضافتها كوسم</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">نوع الكيان</Label>
              <Select
                value={form.entityType}
                onValueChange={(value) => setForm({ ...form, entityType: value })}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {entityTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <span className="flex items-center gap-2">
                        <span className="text-lg">{type.icon}</span>
                        {type.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">الأولوية</Label>
              <Input
                type="number"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 0 })}
                className="h-10"
                min={0}
                max={100}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                النصوص الأصلية
                <span className="text-muted-foreground text-xs mr-2">(اكتب واضغط Enter)</span>
              </Label>
              <div 
                className="min-h-[60px] p-2 border rounded-lg bg-background flex flex-wrap gap-2 items-start cursor-text"
                onClick={() => originalInputRef.current?.focus()}
              >
                {originalTexts.map((text, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 rounded-full text-sm"
                  >
                    {text}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveOriginal(index);
                      }}
                      className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  ref={originalInputRef}
                  type="text"
                  value={currentOriginal}
                  onChange={(e) => setCurrentOriginal(e.target.value)}
                  onKeyDown={handleOriginalKeyDown}
                  onBlur={() => {
                    if (currentOriginal.trim()) {
                      handleAddOriginal();
                    }
                  }}
                  placeholder={originalTexts.length === 0 ? "مثال: احمد، صالح، علي..." : ""}
                  className="flex-1 min-w-[100px] bg-transparent border-none outline-none text-sm py-1"
                  enterKeyHint="done"
                />
              </div>
              {originalTexts.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {originalTexts.length} كلمة/عبارة مضافة
                </p>
              )}
            </div>

            <div className="flex justify-center">
              <ArrowRightLeft className="h-5 w-5 text-muted-foreground rotate-90" />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">
                النصوص البديلة
                <span className="text-muted-foreground text-xs mr-2">(اكتب واضغط Enter)</span>
              </Label>
              <div 
                className="min-h-[60px] p-2 border rounded-lg bg-background flex flex-wrap gap-2 items-start cursor-text"
                onClick={() => replacementInputRef.current?.focus()}
              >
                {replacementTexts.map((text, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 rounded-full text-sm"
                  >
                    {text}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveReplacement(index);
                      }}
                      className="hover:bg-green-200 dark:hover:bg-green-800 rounded-full p-0.5 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  ref={replacementInputRef}
                  type="text"
                  value={currentReplacement}
                  onChange={(e) => setCurrentReplacement(e.target.value)}
                  onKeyDown={handleReplacementKeyDown}
                  onBlur={() => {
                    if (currentReplacement.trim()) {
                      handleAddReplacement();
                    }
                  }}
                  placeholder={replacementTexts.length === 0 ? "مثال: طفل" : ""}
                  className="flex-1 min-w-[100px] bg-transparent border-none outline-none text-sm py-1"
                  enterKeyHint="done"
                />
              </div>
              {replacementTexts.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {replacementTexts.length} كلمة/عبارة مضافة
                </p>
              )}
            </div>
          </div>

          {originalTexts.length > 0 && replacementTexts.length > 0 && (
            <div className="p-3 bg-muted/50 rounded-lg border">
              <p className="text-sm text-muted-foreground mb-2">معاينة الاستبدال:</p>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-blue-600 dark:text-blue-400">
                  {originalTexts.join('، ')}
                </span>
                <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-green-600 dark:text-green-400">
                  {replacementTexts.join('، ')}
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-6 p-4 bg-muted/50 rounded-xl">
            <div className="flex items-center gap-2">
              <Switch
                checked={form.useContext}
                onCheckedChange={(checked) => setForm({ ...form, useContext: checked })}
              />
              <Label className="text-sm cursor-pointer">استخدام السياق (مطابقة ذكية)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.caseSensitive}
                onCheckedChange={(checked) => setForm({ ...form, caseSensitive: checked })}
              />
              <Label className="text-sm cursor-pointer">حساس للأحرف</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
              />
              <Label className="text-sm cursor-pointer">مفعّل</Label>
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !isValid}
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
