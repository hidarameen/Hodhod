import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader, FileText, Plus, Trash2, Edit, ChevronUp, ChevronDown, Zap, X } from "lucide-react";
import { toast } from "sonner";
import { PublishingTemplate, TemplateCustomField, templateTypes, formattingOptions, fieldTypes, presetFields, PresetField } from "./types";

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Partial<PublishingTemplate>) => void;
  editingData?: PublishingTemplate | null;
  isLoading?: boolean;
}

const defaultForm: Partial<PublishingTemplate> = {
  name: '',
  templateType: 'custom',
  isDefault: false,
  headerText: '',
  headerFormatting: 'none',
  footerText: '',
  footerFormatting: 'none',
  fieldSeparator: '\n',
  useNewlineAfterHeader: true,
  useNewlineBeforeFooter: true,
  maxLength: undefined,
  extractionPrompt: '',
  customFields: []
};

const defaultField: Partial<TemplateCustomField> = {
  fieldName: '',
  fieldLabel: '',
  extractionInstructions: '',
  defaultValue: '',
  useDefaultIfEmpty: true,
  formatting: 'none',
  displayOrder: 0,
  showLabel: false,
  labelSeparator: ': ',
  prefix: '',
  suffix: '',
  fieldType: 'extracted',
  isActive: true
};

export function TemplateDialog({ open, onOpenChange, onSubmit, editingData, isLoading }: TemplateDialogProps) {
  const [form, setForm] = useState<Partial<PublishingTemplate>>(defaultForm);
  const [currentField, setCurrentField] = useState<Partial<TemplateCustomField>>(defaultField);
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState<'main' | 'fields'>('main');
  const fieldFormRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingData) {
      setForm({
        name: editingData.name,
        templateType: editingData.templateType,
        isDefault: editingData.isDefault,
        headerText: editingData.headerText || '',
        headerFormatting: editingData.headerFormatting || 'none',
        footerText: editingData.footerText || '',
        footerFormatting: editingData.footerFormatting || 'none',
        fieldSeparator: editingData.fieldSeparator || '\n',
        useNewlineAfterHeader: editingData.useNewlineAfterHeader ?? true,
        useNewlineBeforeFooter: editingData.useNewlineBeforeFooter ?? true,
        maxLength: editingData.maxLength,
        extractionPrompt: editingData.extractionPrompt || '',
        customFields: editingData.customFields || []
      });
    } else {
      setForm(defaultForm);
    }
    setCurrentField(defaultField);
    setEditingFieldIndex(null);
    setActiveSection('main');
  }, [editingData, open]);

  const handleSubmit = () => {
    if (!form.customFields || form.customFields.length === 0) {
      toast.error("يرجى إضافة حقل واحد على الأقل");
      return;
    }
    onSubmit(form);
  };

  const handleAddField = () => {
    if (!currentField.fieldName || !currentField.fieldLabel) {
      toast.error("يرجى ملء اسم الحقل والعنوان");
      return;
    }
    if (currentField.fieldType === 'extracted' && !currentField.extractionInstructions) {
      toast.error("يرجى إضافة تعليمات الاستخراج");
      return;
    }

    const newField: TemplateCustomField = {
      fieldName: currentField.fieldName || '',
      fieldLabel: currentField.fieldLabel || '',
      extractionInstructions: currentField.extractionInstructions || '',
      defaultValue: currentField.defaultValue || '',
      useDefaultIfEmpty: currentField.useDefaultIfEmpty ?? true,
      formatting: currentField.formatting || 'none',
      displayOrder: form.customFields?.length || 0,
      showLabel: currentField.showLabel ?? false,
      labelSeparator: currentField.labelSeparator || ': ',
      prefix: currentField.prefix || '',
      suffix: currentField.suffix || '',
      fieldType: currentField.fieldType || 'extracted',
      isActive: true
    };

    // Check for duplicate fieldName
    const updatedFields = [...(form.customFields || [])];
    const duplicateIndex = updatedFields.findIndex(f => f.fieldName === newField.fieldName);

    if (editingFieldIndex !== null) {
      updatedFields[editingFieldIndex] = newField;
      setForm({ ...form, customFields: updatedFields });
      toast.success("تم تحديث الحقل");
    } else if (duplicateIndex !== -1) {
      // If adding new and name exists, update existing instead of duplicating
      updatedFields[duplicateIndex] = {
        ...newField,
        displayOrder: updatedFields[duplicateIndex].displayOrder
      };
      setForm({ ...form, customFields: updatedFields });
      toast.success("تم تحديث الحقل الموجود مسبقاً");
    } else {
      setForm({
        ...form,
        customFields: [...updatedFields, newField]
      });
      toast.success("تم إضافة الحقل");
    }
    
    setCurrentField(defaultField);
    setEditingFieldIndex(null);
  };

  const handleEditField = (index: number) => {
    const field = form.customFields?.[index];
    if (field) {
      setCurrentField(field);
      setEditingFieldIndex(index);
      toast.info(`تعديل الحقل: ${field.fieldLabel}`);
      setTimeout(() => {
        fieldFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  const handleCancelEdit = () => {
    setCurrentField(defaultField);
    setEditingFieldIndex(null);
  };

  const handleRemoveField = (index: number) => {
    const newFields = [...(form.customFields || [])];
    newFields.splice(index, 1);
    newFields.forEach((f, i) => f.displayOrder = i);
    setForm({ ...form, customFields: newFields });
    toast.success("تم حذف الحقل");
  };

  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    const fields = [...(form.customFields || [])];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;
    [fields[index], fields[newIndex]] = [fields[newIndex], fields[index]];
    fields.forEach((f, i) => f.displayOrder = i);
    setForm({ ...form, customFields: fields });
  };

  const handleAddPresetField = (preset: PresetField) => {
    const existingField = form.customFields?.find(f => f.fieldName === preset.fieldName);
    if (existingField) {
      toast.error(`الحقل "${preset.fieldLabel}" موجود بالفعل`);
      return;
    }

    const newField: TemplateCustomField = {
      fieldName: preset.fieldName,
      fieldLabel: preset.fieldLabel,
      extractionInstructions: preset.extractionInstructions,
      defaultValue: '',
      useDefaultIfEmpty: true,
      formatting: 'none',
      displayOrder: form.customFields?.length || 0,
      showLabel: true,
      labelSeparator: ': ',
      prefix: '',
      suffix: '',
      fieldType: preset.fieldType,
      isActive: true
    };

    setForm({
      ...form,
      customFields: [...(form.customFields || []), newField]
    });
    toast.success(`تمت إضافة حقل "${preset.fieldLabel}"`);
  };

  const isPresetFieldAdded = (presetId: string) => {
    const preset = presetFields.find(p => p.id === presetId);
    if (!preset) return false;
    return form.customFields?.some(f => f.fieldName === preset.fieldName) || false;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4 border-b flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-pink-500/20 to-rose-500/20">
              <FileText className="h-5 w-5 text-pink-600" />
            </div>
            <div>
              <DialogTitle className="text-lg">{editingData ? "تعديل قالب النشر" : "إنشاء قالب نشر"}</DialogTitle>
              <DialogDescription className="text-sm mt-0.5">أنشئ قالب نشر مع حقول مخصصة</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex gap-2 py-3 border-b flex-shrink-0">
          <Button
            variant={activeSection === 'main' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveSection('main')}
          >
            الإعدادات الأساسية
          </Button>
          <Button
            variant={activeSection === 'fields' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveSection('fields')}
          >
            الحقول المخصصة
            {form.customFields && form.customFields.length > 0 && (
              <Badge variant="secondary" className="mr-2">{form.customFields.length}</Badge>
            )}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          {activeSection === 'main' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">اسم القالب *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="مثال: قالب الأخبار العاجلة"
                    className="h-10"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">نوع القالب</Label>
                  <Select
                    value={form.templateType}
                    onValueChange={(value) => setForm({ ...form, templateType: value })}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {templateTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="p-4 border rounded-xl bg-muted/30 space-y-4">
                <h4 className="text-sm font-medium">رأس القالب (اختياري)</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label className="text-xs text-muted-foreground">نص الرأس</Label>
                    <Input
                      value={form.headerText || ''}
                      onChange={(e) => setForm({ ...form, headerText: e.target.value })}
                      placeholder="مثال: عاجل | أخبار اليوم"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">تنسيق</Label>
                    <Select
                      value={form.headerFormatting || 'none'}
                      onValueChange={(value) => setForm({ ...form, headerFormatting: value })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {formattingOptions.map((fmt) => (
                          <SelectItem key={fmt.value} value={fmt.value}>
                            {fmt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="p-4 border rounded-xl bg-muted/30 space-y-4">
                <h4 className="text-sm font-medium">تذييل القالب (اختياري)</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-2">
                    <Label className="text-xs text-muted-foreground">نص التذييل</Label>
                    <Input
                      value={form.footerText || ''}
                      onChange={(e) => setForm({ ...form, footerText: e.target.value })}
                      placeholder="مثال: المصدر: قناتنا الإخبارية"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">تنسيق</Label>
                    <Select
                      value={form.footerFormatting || 'none'}
                      onValueChange={(value) => setForm({ ...form, footerFormatting: value })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {formattingOptions.map((fmt) => (
                          <SelectItem key={fmt.value} value={fmt.value}>
                            {fmt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">الفاصل بين الحقول</Label>
                  <Select
                    value={form.fieldSeparator || '\n'}
                    onValueChange={(value) => setForm({ ...form, fieldSeparator: value })}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={'\n'}>سطر جديد</SelectItem>
                      <SelectItem value={'\n\n'}>سطر فارغ</SelectItem>
                      <SelectItem value={'\n\n\n'}>سطرين فارغين</SelectItem>
                      <SelectItem value={' | '}>شريط |</SelectItem>
                      <SelectItem value={' - '}>شرطة -</SelectItem>
                      <SelectItem value={' '}>مسافة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">الحد الأقصى للطول</Label>
                  <Input
                    type="number"
                    value={form.maxLength || ''}
                    onChange={(e) => setForm({ ...form, maxLength: e.target.value ? parseInt(e.target.value) : undefined })}
                    placeholder="بدون حد"
                    className="h-10"
                    min={0}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-xl">
                <Switch
                  checked={form.isDefault ?? false}
                  onCheckedChange={(checked) => setForm({ ...form, isDefault: checked })}
                />
                <Label className="text-sm cursor-pointer">تعيين كقالب افتراضي</Label>
              </div>
            </div>
          )}

          {activeSection === 'fields' && (
            <div className="space-y-5">
              {/* لوحة الحقول الثابتة الجاهزة */}
              <div className="p-4 border rounded-xl bg-gradient-to-br from-blue-50/50 to-indigo-50/50 dark:from-blue-950/20 dark:to-indigo-950/20 space-y-3">
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-blue-600" />
                  <h4 className="text-sm font-medium">إضافة حقل ثابت جاهز</h4>
                </div>
                <p className="text-xs text-muted-foreground">اختر من الحقول الجاهزة لإضافتها بسرعة</p>
                <div className="grid grid-cols-4 gap-2">
                  {presetFields.map((preset) => {
                    const isAdded = isPresetFieldAdded(preset.id);
                    return (
                      <Button
                        key={preset.id}
                        variant={isAdded ? "secondary" : "outline"}
                        size="sm"
                        className={`h-auto py-2 px-3 flex flex-col items-center gap-1 ${isAdded ? 'opacity-60' : 'hover:bg-blue-50 dark:hover:bg-blue-950/30'}`}
                        onClick={() => handleAddPresetField(preset)}
                        disabled={isAdded}
                      >
                        <span className="text-lg">{preset.icon}</span>
                        <span className="text-xs font-medium">{preset.fieldLabel}</span>
                        {isAdded && <Badge variant="secondary" className="text-[10px] px-1">مضاف</Badge>}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* نموذج إضافة حقل مخصص */}
              <div 
                ref={fieldFormRef}
                className={`p-4 border-2 rounded-xl space-y-4 transition-all duration-300 ${
                  editingFieldIndex !== null 
                    ? 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-400 dark:border-green-600 ring-2 ring-green-200 dark:ring-green-800' 
                    : 'bg-gradient-to-br from-yellow-50/50 to-amber-50/50 dark:from-yellow-950/20 dark:to-amber-950/20 border-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {editingFieldIndex !== null ? (
                      <Edit className="h-4 w-4 text-green-600" />
                    ) : (
                      <Zap className="h-4 w-4 text-yellow-600" />
                    )}
                    <h4 className={`text-sm font-medium ${editingFieldIndex !== null ? 'text-green-700 dark:text-green-400' : ''}`}>
                      {editingFieldIndex !== null ? `تعديل الحقل: ${currentField.fieldLabel}` : 'إضافة حقل مخصص'}
                    </h4>
                  </div>
                  {editingFieldIndex !== null && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-muted-foreground hover:text-destructive"
                      onClick={handleCancelEdit}
                    >
                      <X className="h-4 w-4 mr-1" />
                      إلغاء التعديل
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">اسم الحقل (للنظام) *</Label>
                    <Input
                      value={currentField.fieldName || ''}
                      onChange={(e) => setCurrentField({ ...currentField, fieldName: e.target.value.replace(/\s/g, '_') })}
                      placeholder="مثال: news_type"
                      className="h-9 font-mono"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">عنوان الحقل (للعرض) *</Label>
                    <Input
                      value={currentField.fieldLabel || ''}
                      onChange={(e) => setCurrentField({ ...currentField, fieldLabel: e.target.value })}
                      placeholder="مثال: نوع الخبر"
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">نوع الحقل</Label>
                    <Select
                      value={currentField.fieldType || 'extracted'}
                      onValueChange={(value) => setCurrentField({ ...currentField, fieldType: value })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fieldTypes.map((ft) => (
                          <SelectItem key={ft.value} value={ft.value}>
                            <div className="py-0.5">
                              <div className="font-medium text-sm">{ft.label}</div>
                              <div className="text-xs text-muted-foreground">{ft.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">التنسيق</Label>
                    <Select
                      value={currentField.formatting || 'none'}
                      onValueChange={(value) => setCurrentField({ ...currentField, formatting: value })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {formattingOptions.map((fmt) => (
                          <SelectItem key={fmt.value} value={fmt.value}>
                            <div className="flex items-center gap-2">
                              <span>{fmt.label}</span>
                              <code className="text-xs bg-muted px-1 rounded">{fmt.example}</code>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {currentField.fieldType === 'extracted' && (
                  <div className="space-y-2">
                    <Label className="text-xs">تعليمات الاستخراج بالذكاء الاصطناعي *</Label>
                    <Textarea
                      value={currentField.extractionInstructions || ''}
                      onChange={(e) => setCurrentField({ ...currentField, extractionInstructions: e.target.value })}
                      placeholder="مثال: استخرج نوع الخبر من النص (سياسي، اقتصادي، رياضي)"
                      className="min-h-[60px] resize-none"
                    />
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">القيمة الافتراضية</Label>
                    <Input
                      value={currentField.defaultValue || ''}
                      onChange={(e) => setCurrentField({ ...currentField, defaultValue: e.target.value })}
                      placeholder="إذا فشل الاستخراج"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">بادئة</Label>
                    <Input
                      value={currentField.prefix || ''}
                      onChange={(e) => setCurrentField({ ...currentField, prefix: e.target.value })}
                      placeholder="قبل القيمة"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">لاحقة</Label>
                    <Input
                      value={currentField.suffix || ''}
                      onChange={(e) => setCurrentField({ ...currentField, suffix: e.target.value })}
                      placeholder="بعد القيمة"
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={currentField.showLabel ?? false}
                      onCheckedChange={(checked) => setCurrentField({ ...currentField, showLabel: checked })}
                    />
                    <Label className="text-xs cursor-pointer">إظهار العنوان</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={currentField.useDefaultIfEmpty ?? true}
                      onCheckedChange={(checked) => setCurrentField({ ...currentField, useDefaultIfEmpty: checked })}
                    />
                    <Label className="text-xs cursor-pointer">استخدام الافتراضي</Label>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    onClick={handleAddField}
                    className={`flex-1 h-9 ${editingFieldIndex !== null ? 'bg-green-600 hover:bg-green-700' : ''}`}
                    size="sm"
                  >
                    {editingFieldIndex !== null ? (
                      <Edit className="h-4 w-4 mr-2" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    {editingFieldIndex !== null ? 'حفظ التعديلات' : 'إضافة الحقل'}
                  </Button>
                  {editingFieldIndex !== null && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9"
                      onClick={handleCancelEdit}
                    >
                      إلغاء
                    </Button>
                  )}
                </div>
              </div>

              {form.customFields && form.customFields.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">الحقول المضافة ({form.customFields.length})</Label>
                  <p className="text-xs text-muted-foreground">اضغط على أيقونة القلم لتعديل أو سلة المهملات للحذف</p>
                  <div className="space-y-2">
                    {form.customFields.map((field, index) => {
                      const isBeingEdited = editingFieldIndex === index;
                      return (
                        <div 
                          key={index} 
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all duration-200 ${
                            isBeingEdited 
                              ? 'bg-green-50 dark:bg-green-950/30 border-green-400 dark:border-green-600' 
                              : 'bg-muted/50 border-transparent hover:border-muted-foreground/20'
                          }`}
                        >
                          <div className="flex flex-col gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => handleMoveField(index, 'up')}
                              disabled={index === 0}
                            >
                              <ChevronUp className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => handleMoveField(index, 'down')}
                              disabled={index === form.customFields!.length - 1}
                            >
                              <ChevronDown className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-medium ${isBeingEdited ? 'text-green-700 dark:text-green-400' : ''}`}>
                                {field.fieldLabel}
                              </span>
                              <Badge variant="outline" className="text-xs">{field.fieldName}</Badge>
                              <Badge variant="secondary" className="text-xs">
                                {fieldTypes.find(ft => ft.value === field.fieldType)?.label}
                              </Badge>
                              {isBeingEdited && (
                                <Badge className="text-xs bg-green-600">قيد التعديل</Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <Button
                              size="icon"
                              variant={isBeingEdited ? "default" : "ghost"}
                              className={`h-8 w-8 ${isBeingEdited ? 'bg-green-600 hover:bg-green-700' : 'hover:bg-blue-100 dark:hover:bg-blue-900/30'}`}
                              onClick={() => handleEditField(index)}
                              title="تعديل الحقل"
                            >
                              <Edit className={`h-4 w-4 ${isBeingEdited ? 'text-white' : 'text-blue-600'}`} />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 hover:bg-red-100 dark:hover:bg-red-900/30"
                              onClick={() => handleRemoveField(index)}
                              title="حذف الحقل"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-4 border-t flex-shrink-0">
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !form.name}
            className="flex-1 h-11"
          >
            {isLoading && <Loader className="h-4 w-4 mr-2 animate-spin" />}
            {editingData ? "حفظ التعديلات" : "إنشاء القالب"}
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
