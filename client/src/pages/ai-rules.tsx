import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Sparkles, 
  Plus, 
  Trash2, 
  Edit, 
  Save, 
  RefreshCw,
  ArrowRightLeft,
  Shield,
  Brain,
  Settings2,
  FileText,
  Loader,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  AlertCircle,
  Zap,
  Filter
} from "lucide-react";
import { toast } from "sonner";

interface EntityReplacement {
  id?: number;
  taskId: number;
  entityType: string;
  originalText: string;
  replacementText: string;
  caseSensitive: boolean;
  useContext: boolean;
  isActive: boolean;
  priority: number;
}

interface ContextRule {
  id?: number;
  taskId: number;
  ruleType: string;
  triggerPattern: string;
  targetSentiment: string;
  instructions: string;
  examples: any[];
  isActive: boolean;
  priority: number;
}

interface TrainingExample {
  id?: number;
  taskId: number | null;
  exampleType: string;
  inputText: string;
  expectedOutput: string;
  explanation: string;
  tags: string[];
  isActive: boolean;
}

interface ContentFilter {
  id?: number;
  taskId: number;
  name: string;
  filterType: string;
  matchType: string;
  pattern: string;
  contextDescription?: string;
  sentimentTarget?: string;
  action: string;
  modifyInstructions?: string;
  priority: number;
  isActive: boolean;
}

interface TemplateCustomField {
  id?: number;
  templateId?: number;
  fieldName: string;
  fieldLabel: string;
  extractionInstructions: string;
  defaultValue?: string;
  useDefaultIfEmpty: boolean;
  formatting: string;
  displayOrder: number;
  showLabel: boolean;
  labelSeparator: string;
  prefix?: string;
  suffix?: string;
  fieldType: string;
  isActive: boolean;
}

interface PublishingTemplate {
  id?: number;
  taskId: number;
  name: string;
  templateType: string;
  isDefault: boolean;
  headerText?: string;
  headerFormatting?: string;
  footerText?: string;
  footerFormatting?: string;
  fieldSeparator?: string;
  useNewlineAfterHeader?: boolean;
  useNewlineBeforeFooter?: boolean;
  maxLength?: number;
  extractionPrompt?: string;
  customFields?: TemplateCustomField[];
}

const entityTypes = [
  { value: 'person', label: 'شخص', icon: '👤' },
  { value: 'organization', label: 'منظمة', icon: '🏢' },
  { value: 'location', label: 'موقع', icon: '📍' },
  { value: 'event', label: 'حدث', icon: '📅' },
  { value: 'custom', label: 'مخصص', icon: '✏️' },
];

const contextRuleTypes = [
  { value: 'neutralize_negative', label: 'تحييد السلبية', description: 'تحويل اللغة السلبية إلى حيادية' },
  { value: 'enhance_positive', label: 'تعزيز الإيجابية', description: 'تعزيز الكلمات الإيجابية' },
  { value: 'formal_tone', label: 'صياغة رسمية', description: 'تحويل اللغة العامية إلى رسمية' },
  { value: 'remove_bias', label: 'إزالة التحيز', description: 'إزالة الكلمات المتحيزة' },
  { value: 'custom', label: 'مخصص', description: 'قاعدة مخصصة بتعليمات محددة' },
];

const exampleTypes = [
  { value: 'correction', label: 'تصحيح', description: 'تصحيح خطأ في المخرجات' },
  { value: 'preference', label: 'تفضيل', description: 'أسلوب تفضله في الصياغة' },
  { value: 'style', label: 'أسلوب', description: 'أسلوب كتابة معين' },
  { value: 'terminology', label: 'مصطلحات', description: 'مصطلحات تفضلها' },
];

const filterTypes = [
  { value: 'allow', label: 'سماح', description: 'السماح بالمحتوى المطابق' },
  { value: 'block', label: 'حظر', description: 'حظر المحتوى المطابق' },
  { value: 'require', label: 'مطلوب', description: 'يتطلب وجود المحتوى' },
];

const matchTypes = [
  { value: 'contains', label: 'يحتوي', description: 'يحتوي على النص' },
  { value: 'exact', label: 'مطابق', description: 'مطابقة تامة' },
  { value: 'regex', label: 'تعبير نمطي', description: 'تعبير نمطي (Regex)' },
  { value: 'sentiment', label: 'مشاعر', description: 'تحليل المشاعر' },
  { value: 'context', label: 'سياق', description: 'تحليل السياق' },
];

const filterActions = [
  { value: 'skip', label: 'تخطي', description: 'تخطي الرسالة' },
  { value: 'forward', label: 'تمرير', description: 'تمرير الرسالة' },
  { value: 'modify', label: 'تعديل', description: 'تعديل المحتوى' },
  { value: 'flag', label: 'تمييز', description: 'تمييز للمراجعة' },
];

const sentimentTargets = [
  { value: 'positive', label: 'إيجابي' },
  { value: 'negative', label: 'سلبي' },
  { value: 'neutral', label: 'محايد' },
  { value: 'any', label: 'أي' },
];

const templateTypes = [
  { value: 'news', label: 'خبر', description: 'قالب الأخبار' },
  { value: 'report', label: 'تقرير', description: 'قالب التقارير' },
  { value: 'interview', label: 'مقابلة', description: 'قالب المقابلات' },
  { value: 'summary', label: 'ملخص', description: 'قالب الملخصات' },
  { value: 'custom', label: 'مخصص', description: 'قالب مخصص' },
];

const formattingOptions = [
  { value: 'none', label: 'بدون تنسيق', example: 'نص عادي' },
  { value: 'bold', label: 'عريض', example: '**نص عريض**' },
  { value: 'italic', label: 'مائل', example: '__نص مائل__' },
  { value: 'code', label: 'كود', example: '`نص كود`' },
  { value: 'quote', label: 'اقتباس', example: '> اقتباس' },
  { value: 'spoiler', label: 'مخفي', example: '||نص مخفي||' },
  { value: 'strikethrough', label: 'مشطوب', example: '~~نص مشطوب~~' },
  { value: 'underline', label: 'تحته خط', example: '<u>نص</u>' },
];

const fieldTypes = [
  { value: 'extracted', label: 'مستخرج بالذكاء الاصطناعي', description: 'يتم استخراجه من النص' },
  { value: 'summary', label: 'الملخص', description: 'نتيجة التلخيص من المعالجة السابقة' },
  { value: 'date_today', label: 'تاريخ اليوم', description: 'تاريخ اليوم الحالي تلقائياً' },
  { value: 'static', label: 'نص ثابت', description: 'قيمة ثابتة تحددها أنت' },
];

export default function AIRulesPage() {
  const queryClient = useQueryClient();
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("entities");
  
  const [isEntityFormOpen, setIsEntityFormOpen] = useState(false);
  const [isContextFormOpen, setIsContextFormOpen] = useState(false);
  const [isTrainingFormOpen, setIsTrainingFormOpen] = useState(false);
  const [isFilterFormOpen, setIsFilterFormOpen] = useState(false);
  const [isTemplateFormOpen, setIsTemplateFormOpen] = useState(false);
  
  const [entityForm, setEntityForm] = useState<Partial<EntityReplacement>>({
    entityType: 'person',
    originalText: '',
    replacementText: '',
    caseSensitive: false,
    useContext: true,
    isActive: true,
    priority: 0
  });
  
  const [contextForm, setContextForm] = useState<Partial<ContextRule>>({
    ruleType: 'neutralize_negative',
    triggerPattern: '',
    targetSentiment: 'neutral',
    instructions: '',
    examples: [],
    isActive: true,
    priority: 0
  });
  
  const [trainingForm, setTrainingForm] = useState<Partial<TrainingExample>>({
    exampleType: 'correction',
    inputText: '',
    expectedOutput: '',
    explanation: '',
    tags: [],
    isActive: true
  });

  const [filterForm, setFilterForm] = useState<Partial<ContentFilter>>({
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
  });

  const [templateForm, setTemplateForm] = useState<Partial<PublishingTemplate>>({
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
  });

  const [currentField, setCurrentField] = useState<Partial<TemplateCustomField>>({
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
  });

  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);
  
  const [editingEntity, setEditingEntity] = useState<number | null>(null);
  const [editingContext, setEditingContext] = useState<number | null>(null);
  const [editingTraining, setEditingTraining] = useState<number | null>(null);

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => api.getTasks(),
  });

  const { data: entityReplacements = [], isLoading: loadingEntities } = useQuery({
    queryKey: ["entity-replacements", selectedTaskId],
    queryFn: () => selectedTaskId ? api.getEntityReplacements(selectedTaskId) : Promise.resolve([]),
    enabled: !!selectedTaskId,
  });

  const { data: contextRules = [], isLoading: loadingContext } = useQuery({
    queryKey: ["context-rules", selectedTaskId],
    queryFn: () => selectedTaskId ? api.getContextRules(selectedTaskId) : Promise.resolve([]),
    enabled: !!selectedTaskId,
  });

  const { data: trainingExamples = [], isLoading: loadingTraining } = useQuery({
    queryKey: ["training-examples", selectedTaskId],
    queryFn: () => api.getTrainingExamples(selectedTaskId),
  });

  const { data: contentFilters = [], isLoading: loadingFilters } = useQuery({
    queryKey: ["content-filters", selectedTaskId],
    queryFn: () => selectedTaskId ? api.getContentFilters(selectedTaskId) : Promise.resolve([]),
    enabled: !!selectedTaskId,
  });

  const { data: publishingTemplates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ["publishing-templates", selectedTaskId],
    queryFn: () => selectedTaskId ? api.getPublishingTemplates(selectedTaskId) : Promise.resolve([]),
    enabled: !!selectedTaskId,
  });

  const createEntityMutation = useMutation({
    mutationFn: (data: any) => api.createEntityReplacement(data),
    onSuccess: () => {
      toast.success("تم إضافة قاعدة الاستبدال");
      queryClient.invalidateQueries({ queryKey: ["entity-replacements"] });
      resetEntityForm();
    },
    onError: () => toast.error("فشل في إضافة القاعدة"),
  });

  const updateEntityMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.updateEntityReplacement(id, data),
    onSuccess: () => {
      toast.success("تم تحديث القاعدة");
      queryClient.invalidateQueries({ queryKey: ["entity-replacements"] });
      resetEntityForm();
      setEditingEntity(null);
    },
    onError: () => toast.error("فشل في تحديث القاعدة"),
  });

  const deleteEntityMutation = useMutation({
    mutationFn: (id: number) => api.deleteEntityReplacement(id),
    onSuccess: () => {
      toast.success("تم حذف القاعدة");
      queryClient.invalidateQueries({ queryKey: ["entity-replacements"] });
    },
    onError: () => toast.error("فشل في حذف القاعدة"),
  });

  const createContextMutation = useMutation({
    mutationFn: (data: any) => api.createContextRule(data),
    onSuccess: () => {
      toast.success("تم إضافة قاعدة السياق");
      queryClient.invalidateQueries({ queryKey: ["context-rules"] });
      resetContextForm();
    },
    onError: () => toast.error("فشل في إضافة القاعدة"),
  });

  const deleteContextMutation = useMutation({
    mutationFn: (id: number) => api.deleteContextRule(id),
    onSuccess: () => {
      toast.success("تم حذف القاعدة");
      queryClient.invalidateQueries({ queryKey: ["context-rules"] });
    },
    onError: () => toast.error("فشل في حذف القاعدة"),
  });

  const createTrainingMutation = useMutation({
    mutationFn: (data: any) => api.createTrainingExample(data),
    onSuccess: () => {
      toast.success("تم إضافة مثال التدريب");
      queryClient.invalidateQueries({ queryKey: ["training-examples"] });
      resetTrainingForm();
    },
    onError: () => toast.error("فشل في إضافة المثال"),
  });

  const deleteTrainingMutation = useMutation({
    mutationFn: (id: number) => api.deleteTrainingExample(id),
    onSuccess: () => {
      toast.success("تم حذف المثال");
      queryClient.invalidateQueries({ queryKey: ["training-examples"] });
    },
    onError: () => toast.error("فشل في حذف المثال"),
  });

  const createFilterMutation = useMutation({
    mutationFn: (data: any) => api.createContentFilter(data),
    onSuccess: () => {
      toast.success("تم إضافة الفلتر");
      queryClient.invalidateQueries({ queryKey: ["content-filters"] });
      resetFilterForm();
    },
    onError: () => toast.error("فشل في إضافة الفلتر"),
  });

  const deleteFilterMutation = useMutation({
    mutationFn: (id: number) => api.deleteContentFilter(id),
    onSuccess: () => {
      toast.success("تم حذف الفلتر");
      queryClient.invalidateQueries({ queryKey: ["content-filters"] });
    },
    onError: () => toast.error("فشل في حذف الفلتر"),
  });

  const createTemplateMutation = useMutation({
    mutationFn: (data: any) => api.createPublishingTemplate(data),
    onSuccess: () => {
      toast.success("تم إضافة القالب");
      queryClient.invalidateQueries({ queryKey: ["publishing-templates"] });
      resetTemplateForm();
    },
    onError: () => toast.error("فشل في إضافة القالب"),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: number) => api.deletePublishingTemplate(id),
    onSuccess: () => {
      toast.success("تم حذف القالب");
      queryClient.invalidateQueries({ queryKey: ["publishing-templates"] });
    },
    onError: () => toast.error("فشل في حذف القالب"),
  });

  const resetEntityForm = () => {
    setEntityForm({
      entityType: 'person',
      originalText: '',
      replacementText: '',
      caseSensitive: false,
      useContext: true,
      isActive: true,
      priority: 0
    });
  };

  const resetContextForm = () => {
    setContextForm({
      ruleType: 'neutralize_negative',
      triggerPattern: '',
      targetSentiment: 'neutral',
      instructions: '',
      examples: [],
      isActive: true,
      priority: 0
    });
  };

  const resetTrainingForm = () => {
    setTrainingForm({
      exampleType: 'correction',
      inputText: '',
      expectedOutput: '',
      explanation: '',
      tags: [],
      isActive: true
    });
  };

  const resetFilterForm = () => {
    setFilterForm({
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
    });
  };

  const resetTemplateForm = () => {
    setTemplateForm({
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
    });
    resetCurrentField();
  };

  const resetCurrentField = () => {
    setCurrentField({
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
    });
    setEditingFieldIndex(null);
  };

  const handleSubmitEntity = () => {
    if (!selectedTaskId || !entityForm.originalText || !entityForm.replacementText) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    const data = { ...entityForm, taskId: selectedTaskId };
    
    if (editingEntity) {
      updateEntityMutation.mutate({ id: editingEntity, data });
    } else {
      createEntityMutation.mutate(data);
    }
  };

  const handleSubmitContext = () => {
    if (!selectedTaskId || !contextForm.instructions) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    const data = { ...contextForm, taskId: selectedTaskId };
    createContextMutation.mutate(data);
  };

  const handleSubmitTraining = () => {
    if (!trainingForm.inputText || !trainingForm.expectedOutput) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    const data = { ...trainingForm, taskId: selectedTaskId };
    createTrainingMutation.mutate(data);
  };

  const handleEditEntity = (entity: any) => {
    setEntityForm(entity);
    setEditingEntity(entity.id);
  };

  const handleSubmitFilter = () => {
    if (!selectedTaskId || !filterForm.name || !filterForm.pattern) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    const data = { ...filterForm, taskId: selectedTaskId };
    createFilterMutation.mutate(data);
  };

  const handleSubmitTemplate = () => {
    if (!selectedTaskId || !templateForm.name) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }

    if (!templateForm.customFields || templateForm.customFields.length === 0) {
      toast.error("يرجى إضافة حقل واحد على الأقل");
      return;
    }

    const data = { ...templateForm, taskId: selectedTaskId };
    createTemplateMutation.mutate(data);
  };

  const handleAddCustomField = () => {
    if (!currentField.fieldName || !currentField.fieldLabel) {
      toast.error("يرجى ملء اسم الحقل والعنوان");
      return;
    }

    if (currentField.fieldType === 'extracted' && !currentField.extractionInstructions) {
      toast.error("يرجى إضافة تعليمات الاستخراج للحقل المستخرج بالذكاء الاصطناعي");
      return;
    }

    const newField: TemplateCustomField = {
      fieldName: currentField.fieldName || '',
      fieldLabel: currentField.fieldLabel || '',
      extractionInstructions: currentField.extractionInstructions || '',
      defaultValue: currentField.defaultValue || '',
      useDefaultIfEmpty: currentField.useDefaultIfEmpty ?? true,
      formatting: currentField.formatting || 'none',
      displayOrder: (templateForm.customFields?.length || 0),
      showLabel: currentField.showLabel ?? false,
      labelSeparator: currentField.labelSeparator || ': ',
      prefix: currentField.prefix || '',
      suffix: currentField.suffix || '',
      fieldType: currentField.fieldType || 'extracted',
      isActive: true
    };

    if (editingFieldIndex !== null) {
      const updatedFields = [...(templateForm.customFields || [])];
      updatedFields[editingFieldIndex] = newField;
      setTemplateForm({ ...templateForm, customFields: updatedFields });
      toast.success("تم تحديث الحقل");
    } else {
      setTemplateForm({
        ...templateForm,
        customFields: [...(templateForm.customFields || []), newField]
      });
      toast.success("تم إضافة الحقل");
    }
    
    resetCurrentField();
  };

  const handleEditCustomField = (index: number) => {
    const field = templateForm.customFields?.[index];
    if (field) {
      setCurrentField(field);
      setEditingFieldIndex(index);
    }
  };

  const handleRemoveCustomField = (index: number) => {
    const newFields = [...(templateForm.customFields || [])];
    newFields.splice(index, 1);
    // Reorder
    newFields.forEach((f, i) => f.displayOrder = i);
    setTemplateForm({ ...templateForm, customFields: newFields });
    toast.success("تم حذف الحقل");
  };

  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    const fields = [...(templateForm.customFields || [])];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (newIndex < 0 || newIndex >= fields.length) return;
    
    [fields[index], fields[newIndex]] = [fields[newIndex], fields[index]];
    fields.forEach((f, i) => f.displayOrder = i);
    setTemplateForm({ ...templateForm, customFields: fields });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground tracking-wide flex items-center gap-2">
            <Brain className="h-8 w-8 text-primary" />
            قواعد الذكاء الاصطناعي المتقدمة
          </h2>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            تخصيص معالجة النصوص بقواعد استبدال وسياق وتدريب
          </p>
        </div>
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            اختر المهمة
          </CardTitle>
          <CardDescription>
            اختر المهمة التي تريد إعداد قواعد الذكاء الاصطناعي لها
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedTaskId?.toString() || ""}
            onValueChange={(value) => setSelectedTaskId(value ? parseInt(value) : null)}
          >
            <SelectTrigger className="w-full md:w-80">
              <SelectValue placeholder="اختر مهمة..." />
            </SelectTrigger>
            <SelectContent>
              {tasks.map((task: any) => (
                <SelectItem key={task.id} value={task.id.toString()}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${task.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                    {task.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedTaskId && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5 mb-6">
              <TabsTrigger value="entities" className="flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4" />
                <span className="hidden sm:inline">قواعد الاستبدال</span>
                <span className="sm:hidden">استبدال</span>
                {entityReplacements.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{entityReplacements.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="context" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">قواعد السياق</span>
                <span className="sm:hidden">سياق</span>
                {contextRules.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{contextRules.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="training" className="flex items-center gap-2">
                <Brain className="h-4 w-4" />
                <span className="hidden sm:inline">أمثلة التدريب</span>
                <span className="sm:hidden">تدريب</span>
                {trainingExamples.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{trainingExamples.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="filters" className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <span className="hidden sm:inline">فلاتر المحتوى</span>
                <span className="sm:hidden">فلاتر</span>
                {contentFilters.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{contentFilters.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="templates" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span className="hidden sm:inline">قوالب النشر</span>
                <span className="sm:hidden">قوالب</span>
                {publishingTemplates.length > 0 && (
                  <Badge variant="secondary" className="ml-1">{publishingTemplates.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="entities" className="space-y-4">
              <Collapsible open={isEntityFormOpen} onOpenChange={setIsEntityFormOpen}>
                <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="py-3 px-4 cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Plus className="h-4 w-4 text-primary" />
                          <CardTitle className="text-sm font-medium">
                            {editingEntity ? "تعديل قاعدة الاستبدال" : "إضافة قاعدة استبدال جديدة"}
                          </CardTitle>
                        </div>
                        {isEntityFormOpen ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <CardDescription className="text-xs mt-1">
                        استبدل أسماء أو كلمات بأخرى تلقائياً
                      </CardDescription>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-3 pt-0 px-4 pb-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">نوع الكيان</Label>
                          <Select
                            value={entityForm.entityType}
                            onValueChange={(value) => setEntityForm({ ...entityForm, entityType: value })}
                          >
                            <SelectTrigger className="mt-1 h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {entityTypes.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  <span className="flex items-center gap-2">
                                    <span>{type.icon}</span>
                                    {type.label}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">الأولوية</Label>
                          <Input
                            type="number"
                            value={entityForm.priority}
                            onChange={(e) => setEntityForm({ ...entityForm, priority: parseInt(e.target.value) || 0 })}
                            className="mt-1 h-8 text-sm"
                            min={0}
                            max={100}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">النص الأصلي</Label>
                          <Input
                            value={entityForm.originalText}
                            onChange={(e) => setEntityForm({ ...entityForm, originalText: e.target.value })}
                            placeholder="مثال: محمد مصطفى"
                            className="mt-1 h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">النص البديل</Label>
                          <Input
                            value={entityForm.replacementText}
                            onChange={(e) => setEntityForm({ ...entityForm, replacementText: e.target.value })}
                            placeholder="مثال: البطل محمد مصطفى"
                            className="mt-1 h-8 text-sm"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <Switch
                            checked={entityForm.useContext}
                            onCheckedChange={(checked) => setEntityForm({ ...entityForm, useContext: checked })}
                            className="scale-90"
                          />
                          <Label className="text-xs">استخدام السياق</Label>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Switch
                            checked={entityForm.caseSensitive}
                            onCheckedChange={(checked) => setEntityForm({ ...entityForm, caseSensitive: checked })}
                            className="scale-90"
                          />
                          <Label className="text-xs">حساس لحالة الأحرف</Label>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Switch
                            checked={entityForm.isActive}
                            onCheckedChange={(checked) => setEntityForm({ ...entityForm, isActive: checked })}
                            className="scale-90"
                          />
                          <Label className="text-xs">مفعّل</Label>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={handleSubmitEntity}
                          disabled={createEntityMutation.isPending || updateEntityMutation.isPending}
                          className="flex-1 h-8 text-sm"
                          size="sm"
                        >
                          {(createEntityMutation.isPending || updateEntityMutation.isPending) && (
                            <Loader className="h-3 w-3 mr-2 animate-spin" />
                          )}
                          {editingEntity ? "حفظ التعديلات" : "إضافة القاعدة"}
                        </Button>
                        {editingEntity && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-sm"
                            onClick={() => {
                              resetEntityForm();
                              setEditingEntity(null);
                            }}
                          >
                            إلغاء
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <ArrowRightLeft className="h-5 w-5 text-primary" />
                  القواعد المضافة ({entityReplacements.length})
                </h3>
                
                {loadingEntities ? (
                  <div className="flex justify-center p-8">
                    <Loader className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : entityReplacements.length === 0 ? (
                  <Card className="p-8 text-center text-muted-foreground">
                    <ArrowRightLeft className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>لا توجد قواعد استبدال. أضف قاعدة جديدة للبدء.</p>
                  </Card>
                ) : (
                  <div className="grid gap-3">
                    <AnimatePresence>
                      {entityReplacements.map((entity: any) => (
                        <motion.div
                          key={entity.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                        >
                          <Card className={`p-4 ${!entity.isActive ? 'opacity-60' : ''}`}>
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge variant="outline">
                                    {entityTypes.find(t => t.value === entity.entityType)?.icon}
                                    {entityTypes.find(t => t.value === entity.entityType)?.label}
                                  </Badge>
                                  <Badge variant={entity.isActive ? "default" : "secondary"}>
                                    {entity.isActive ? "مفعّل" : "معطّل"}
                                  </Badge>
                                  {entity.priority > 0 && (
                                    <Badge variant="outline">أولوية: {entity.priority}</Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 text-lg">
                                  <code className="bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded text-red-700 dark:text-red-300">
                                    {entity.originalText}
                                  </code>
                                  <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                                  <code className="bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded text-green-700 dark:text-green-300">
                                    {entity.replacementText}
                                  </code>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleEditEntity(entity)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-red-600"
                                  onClick={() => deleteEntityMutation.mutate(entity.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </Card>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="context" className="space-y-4">
              <Collapsible open={isContextFormOpen} onOpenChange={setIsContextFormOpen}>
                <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="py-3 px-4 cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Plus className="h-4 w-4 text-primary" />
                          <CardTitle className="text-sm font-medium">
                            إضافة قاعدة سياق جديدة
                          </CardTitle>
                        </div>
                        {isContextFormOpen ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <CardDescription className="text-xs mt-1">
                        تحييد اللغة السلبية، تعزيز الإيجابية، أو تعديل أسلوب النص
                      </CardDescription>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-3 pt-0 px-4 pb-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">نوع القاعدة</Label>
                          <Select
                            value={contextForm.ruleType}
                            onValueChange={(value) => setContextForm({ ...contextForm, ruleType: value })}
                          >
                            <SelectTrigger className="mt-1 h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {contextRuleTypes.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  <div>
                                    <div className="font-medium text-sm">{type.label}</div>
                                    <div className="text-xs text-muted-foreground">{type.description}</div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">النبرة المستهدفة</Label>
                          <Select
                            value={contextForm.targetSentiment}
                            onValueChange={(value) => setContextForm({ ...contextForm, targetSentiment: value })}
                          >
                            <SelectTrigger className="mt-1 h-8 text-sm">
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

                      {contextForm.ruleType === 'custom' && (
                        <div>
                          <Label className="text-xs">نمط التفعيل (Regex)</Label>
                          <Input
                            value={contextForm.triggerPattern}
                            onChange={(e) => setContextForm({ ...contextForm, triggerPattern: e.target.value })}
                            placeholder="مثال: إرهابي|عميل|خائن"
                            className="mt-1 h-8 text-sm font-mono"
                            dir="ltr"
                          />
                        </div>
                      )}

                      <div>
                        <Label className="text-xs">التعليمات</Label>
                        <Textarea
                          value={contextForm.instructions}
                          onChange={(e) => setContextForm({ ...contextForm, instructions: e.target.value })}
                          placeholder="اكتب تعليمات واضحة للذكاء الاصطناعي..."
                          className="mt-1 min-h-[70px] text-sm"
                        />
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <Switch
                            checked={contextForm.isActive}
                            onCheckedChange={(checked) => setContextForm({ ...contextForm, isActive: checked })}
                            className="scale-90"
                          />
                          <Label className="text-xs">مفعّل</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground">الأولوية</Label>
                          <Input
                            type="number"
                            value={contextForm.priority}
                            onChange={(e) => setContextForm({ ...contextForm, priority: parseInt(e.target.value) || 0 })}
                            className="w-16 h-7 text-sm"
                            min={0}
                          />
                        </div>
                      </div>

                      <Button
                        onClick={handleSubmitContext}
                        disabled={createContextMutation.isPending}
                        className="w-full h-8 text-sm"
                        size="sm"
                      >
                        {createContextMutation.isPending && <Loader className="h-3 w-3 mr-2 animate-spin" />}
                        إضافة القاعدة
                      </Button>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  قواعد السياق المضافة ({contextRules.length})
                </h3>
                
                {loadingContext ? (
                  <div className="flex justify-center p-8">
                    <Loader className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : contextRules.length === 0 ? (
                  <Card className="p-8 text-center text-muted-foreground">
                    <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>لا توجد قواعد سياق. أضف قاعدة جديدة للبدء.</p>
                  </Card>
                ) : (
                  <div className="grid gap-3">
                    {contextRules.map((rule: any) => (
                      <Card key={rule.id} className={`p-4 ${!rule.isActive ? 'opacity-60' : ''}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge>
                                {contextRuleTypes.find(t => t.value === rule.ruleType)?.label}
                              </Badge>
                              <Badge variant="outline">
                                ← {rule.targetSentiment}
                              </Badge>
                              {rule.priority > 0 && (
                                <Badge variant="outline">أولوية: {rule.priority}</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{rule.instructions}</p>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-red-600"
                            onClick={() => deleteContextMutation.mutate(rule.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="training" className="space-y-4">
              <Collapsible open={isTrainingFormOpen} onOpenChange={setIsTrainingFormOpen}>
                <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="py-3 px-4 cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Plus className="h-4 w-4 text-primary" />
                          <CardTitle className="text-sm font-medium">
                            إضافة مثال تدريب جديد
                          </CardTitle>
                        </div>
                        {isTrainingFormOpen ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <CardDescription className="text-xs mt-1">
                        علّم الذكاء الاصطناعي أسلوبك المفضل بأمثلة عملية
                      </CardDescription>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-3 pt-0 px-4 pb-4">
                      <div>
                        <Label className="text-xs">نوع المثال</Label>
                        <Select
                          value={trainingForm.exampleType}
                          onValueChange={(value) => setTrainingForm({ ...trainingForm, exampleType: value })}
                        >
                          <SelectTrigger className="mt-1 h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {exampleTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                <div>
                                  <div className="font-medium text-sm">{type.label}</div>
                                  <div className="text-xs text-muted-foreground">{type.description}</div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-xs">النص المُدخل</Label>
                        <Textarea
                          value={trainingForm.inputText}
                          onChange={(e) => setTrainingForm({ ...trainingForm, inputText: e.target.value })}
                          placeholder="النص الأصلي أو مخرج الذكاء الاصطناعي الخاطئ..."
                          className="mt-1 min-h-[60px] text-sm"
                        />
                      </div>

                      <div>
                        <Label className="text-xs">المخرج المتوقع</Label>
                        <Textarea
                          value={trainingForm.expectedOutput}
                          onChange={(e) => setTrainingForm({ ...trainingForm, expectedOutput: e.target.value })}
                          placeholder="الصياغة الصحيحة التي تفضلها..."
                          className="mt-1 min-h-[60px] text-sm"
                        />
                      </div>

                      <div>
                        <Label className="text-xs">شرح (اختياري)</Label>
                        <Input
                          value={trainingForm.explanation}
                          onChange={(e) => setTrainingForm({ ...trainingForm, explanation: e.target.value })}
                          placeholder="لماذا هذه الصياغة أفضل؟"
                          className="mt-1 h-8 text-sm"
                        />
                      </div>

                      <Button
                        onClick={handleSubmitTraining}
                        disabled={createTrainingMutation.isPending}
                        className="w-full h-8 text-sm"
                        size="sm"
                      >
                        {createTrainingMutation.isPending && <Loader className="h-3 w-3 mr-2 animate-spin" />}
                        إضافة المثال
                      </Button>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  أمثلة التدريب ({trainingExamples.length})
                </h3>
                
                {loadingTraining ? (
                  <div className="flex justify-center p-8">
                    <Loader className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : trainingExamples.length === 0 ? (
                  <Card className="p-8 text-center text-muted-foreground">
                    <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>لا توجد أمثلة تدريب. أضف أمثلة لتحسين دقة الذكاء الاصطناعي.</p>
                  </Card>
                ) : (
                  <Accordion type="single" collapsible className="space-y-2">
                    {trainingExamples.map((example: any) => (
                      <AccordionItem key={example.id} value={example.id.toString()} className="border rounded-lg px-4">
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-2 text-right">
                            <Badge variant="outline">
                              {exampleTypes.find(t => t.value === example.exampleType)?.label}
                            </Badge>
                            <span className="text-sm truncate max-w-[300px]">
                              {example.inputText.substring(0, 50)}...
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="space-y-3 pt-2">
                          <div>
                            <Label className="text-xs text-muted-foreground">المُدخل</Label>
                            <p className="bg-muted/50 p-2 rounded text-sm">{example.inputText}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">المخرج المتوقع</Label>
                            <p className="bg-green-50 dark:bg-green-900/20 p-2 rounded text-sm">{example.expectedOutput}</p>
                          </div>
                          {example.explanation && (
                            <div>
                              <Label className="text-xs text-muted-foreground">الشرح</Label>
                              <p className="text-sm text-muted-foreground">{example.explanation}</p>
                            </div>
                          )}
                          <div className="flex justify-between items-center pt-2 border-t">
                            <span className="text-xs text-muted-foreground">
                              استُخدم {example.useCount || 0} مرة
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600"
                              onClick={() => deleteTrainingMutation.mutate(example.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              حذف
                            </Button>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                )}
              </div>
            </TabsContent>

            <TabsContent value="filters" className="space-y-4">
              <Collapsible open={isFilterFormOpen} onOpenChange={setIsFilterFormOpen}>
                <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="py-3 px-4 cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Plus className="h-4 w-4 text-primary" />
                          <CardTitle className="text-sm font-medium">
                            إضافة فلتر محتوى جديد
                          </CardTitle>
                        </div>
                        {isFilterFormOpen ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <CardDescription className="text-xs mt-1">
                        تصفية المحتوى تلقائياً بناءً على أنماط محددة
                      </CardDescription>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-3 pt-0 px-4 pb-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">اسم الفلتر</Label>
                          <Input
                            value={filterForm.name}
                            onChange={(e) => setFilterForm({ ...filterForm, name: e.target.value })}
                            placeholder="مثال: فلتر المحتوى السلبي"
                            className="mt-1 h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">نوع الفلتر</Label>
                          <Select
                            value={filterForm.filterType}
                            onValueChange={(value) => setFilterForm({ ...filterForm, filterType: value })}
                          >
                            <SelectTrigger className="mt-1 h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {filterTypes.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  <div>
                                    <div className="font-medium text-sm">{type.label}</div>
                                    <div className="text-xs text-muted-foreground">{type.description}</div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">نوع المطابقة</Label>
                          <Select
                            value={filterForm.matchType}
                            onValueChange={(value) => setFilterForm({ ...filterForm, matchType: value })}
                          >
                            <SelectTrigger className="mt-1 h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {matchTypes.map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  <div>
                                    <div className="font-medium text-sm">{type.label}</div>
                                    <div className="text-xs text-muted-foreground">{type.description}</div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">الإجراء</Label>
                          <Select
                            value={filterForm.action}
                            onValueChange={(value) => setFilterForm({ ...filterForm, action: value })}
                          >
                            <SelectTrigger className="mt-1 h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {filterActions.map((action) => (
                                <SelectItem key={action.value} value={action.value}>
                                  <div>
                                    <div className="font-medium text-sm">{action.label}</div>
                                    <div className="text-xs text-muted-foreground">{action.description}</div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs">النمط / الكلمات المفتاحية</Label>
                        <Input
                          value={filterForm.pattern}
                          onChange={(e) => setFilterForm({ ...filterForm, pattern: e.target.value })}
                          placeholder="مثال: كلمة1|كلمة2|كلمة3"
                          className="mt-1 h-8 text-sm font-mono"
                          dir="ltr"
                        />
                      </div>

                      {filterForm.matchType === 'context' && (
                        <div>
                          <Label className="text-xs">وصف السياق</Label>
                          <Textarea
                            value={filterForm.contextDescription}
                            onChange={(e) => setFilterForm({ ...filterForm, contextDescription: e.target.value })}
                            placeholder="اكتب وصفاً للسياق المطلوب تحليله..."
                            className="mt-1 min-h-[60px] text-sm"
                          />
                        </div>
                      )}

                      {filterForm.matchType === 'sentiment' && (
                        <div>
                          <Label className="text-xs">المشاعر المستهدفة</Label>
                          <Select
                            value={filterForm.sentimentTarget}
                            onValueChange={(value) => setFilterForm({ ...filterForm, sentimentTarget: value })}
                          >
                            <SelectTrigger className="mt-1 h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {sentimentTargets.map((target) => (
                                <SelectItem key={target.value} value={target.value}>
                                  {target.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {filterForm.action === 'modify' && (
                        <div>
                          <Label className="text-xs">تعليمات التعديل</Label>
                          <Textarea
                            value={filterForm.modifyInstructions}
                            onChange={(e) => setFilterForm({ ...filterForm, modifyInstructions: e.target.value })}
                            placeholder="اكتب تعليمات التعديل للذكاء الاصطناعي..."
                            className="mt-1 min-h-[60px] text-sm"
                          />
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <Switch
                            checked={filterForm.isActive}
                            onCheckedChange={(checked) => setFilterForm({ ...filterForm, isActive: checked })}
                            className="scale-90"
                          />
                          <Label className="text-xs">مفعّل</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground">الأولوية</Label>
                          <Input
                            type="number"
                            value={filterForm.priority}
                            onChange={(e) => setFilterForm({ ...filterForm, priority: parseInt(e.target.value) || 0 })}
                            className="w-16 h-7 text-sm"
                            min={0}
                          />
                        </div>
                      </div>

                      <Button
                        onClick={handleSubmitFilter}
                        disabled={createFilterMutation.isPending}
                        className="w-full h-8 text-sm"
                        size="sm"
                      >
                        {createFilterMutation.isPending && <Loader className="h-3 w-3 mr-2 animate-spin" />}
                        إضافة الفلتر
                      </Button>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Filter className="h-5 w-5 text-primary" />
                  الفلاتر المضافة ({contentFilters.length})
                </h3>
                
                {loadingFilters ? (
                  <div className="flex justify-center p-8">
                    <Loader className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : contentFilters.length === 0 ? (
                  <Card className="p-8 text-center text-muted-foreground">
                    <Filter className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>لا توجد فلاتر محتوى. أضف فلتر جديد للبدء.</p>
                  </Card>
                ) : (
                  <div className="grid gap-3">
                    {contentFilters.map((filter: any) => (
                      <Card key={filter.id} className={`p-4 ${!filter.isActive ? 'opacity-60' : ''}`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-semibold">{filter.name}</span>
                              <Badge variant={filter.isActive ? "default" : "secondary"}>
                                {filter.isActive ? "مفعّل" : "معطّل"}
                              </Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <Badge variant="outline">
                                {filterTypes.find(t => t.value === filter.filterType)?.label}
                              </Badge>
                              <Badge variant="outline">
                                {matchTypes.find(t => t.value === filter.matchType)?.label}
                              </Badge>
                              <Badge variant="outline">
                                {filterActions.find(a => a.value === filter.action)?.label}
                              </Badge>
                              {filter.priority > 0 && (
                                <Badge variant="outline">أولوية: {filter.priority}</Badge>
                              )}
                            </div>
                            <code className="text-sm bg-muted px-2 py-1 rounded">{filter.pattern}</code>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-red-600"
                            onClick={() => deleteFilterMutation.mutate(filter.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="templates" className="space-y-4">
              <Collapsible open={isTemplateFormOpen} onOpenChange={setIsTemplateFormOpen}>
                <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                  <CollapsibleTrigger asChild>
                    <CardHeader className="py-3 px-4 cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Plus className="h-4 w-4 text-primary" />
                          <CardTitle className="text-sm font-medium">
                            إنشاء قالب نشر مخصص
                          </CardTitle>
                        </div>
                        {isTemplateFormOpen ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <CardDescription className="text-xs mt-1">
                        أنشئ قالب نشر مع حقول مخصصة يتم استخراجها بالذكاء الاصطناعي
                      </CardDescription>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <CardContent className="space-y-4 pt-0 px-4 pb-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">اسم القالب *</Label>
                          <Input
                            value={templateForm.name}
                            onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                            placeholder="مثال: قالب الأخبار العاجلة"
                            className="mt-1 h-8 text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">نوع القالب</Label>
                          <Select
                            value={templateForm.templateType}
                            onValueChange={(value) => setTemplateForm({ ...templateForm, templateType: value })}
                          >
                            <SelectTrigger className="mt-1 h-8 text-sm">
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

                      <div className="p-3 border rounded-lg bg-muted/30">
                        <h4 className="text-xs font-medium mb-2">رأس القالب (اختياري)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="md:col-span-2">
                            <Label className="text-xs">نص الرأس</Label>
                            <Input
                              value={templateForm.headerText || ''}
                              onChange={(e) => setTemplateForm({ ...templateForm, headerText: e.target.value })}
                              placeholder="مثال: عاجل | أخبار اليوم"
                              className="mt-1 h-8 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">تنسيق الرأس</Label>
                            <Select
                              value={templateForm.headerFormatting || 'none'}
                              onValueChange={(value) => setTemplateForm({ ...templateForm, headerFormatting: value })}
                            >
                              <SelectTrigger className="mt-1 h-8 text-sm">
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

                      <div className="p-3 border rounded-lg">
                        <h4 className="text-xs font-medium mb-2 flex items-center gap-2">
                          <Zap className="h-3 w-3 text-yellow-500" />
                          الحقول المخصصة
                        </h4>
                        
                        <div className="space-y-3 p-3 bg-muted/30 rounded-lg mb-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">اسم الحقل (للنظام) *</Label>
                              <Input
                                value={currentField.fieldName || ''}
                                onChange={(e) => setCurrentField({ ...currentField, fieldName: e.target.value.replace(/\s/g, '_') })}
                                placeholder="مثال: news_type"
                                className="mt-1 h-8 text-sm font-mono"
                                dir="ltr"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">عنوان الحقل (للعرض) *</Label>
                              <Input
                                value={currentField.fieldLabel || ''}
                                onChange={(e) => setCurrentField({ ...currentField, fieldLabel: e.target.value })}
                                placeholder="مثال: نوع الخبر"
                                className="mt-1 h-8 text-sm"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">نوع الحقل</Label>
                              <Select
                                value={currentField.fieldType || 'extracted'}
                                onValueChange={(value) => setCurrentField({ ...currentField, fieldType: value })}
                              >
                                <SelectTrigger className="mt-1 h-8 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {fieldTypes.map((ft) => (
                                    <SelectItem key={ft.value} value={ft.value}>
                                      <div>
                                        <div className="font-medium text-sm">{ft.label}</div>
                                        <div className="text-xs text-muted-foreground">{ft.description}</div>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-xs">التنسيق</Label>
                              <Select
                                value={currentField.formatting || 'none'}
                                onValueChange={(value) => setCurrentField({ ...currentField, formatting: value })}
                              >
                                <SelectTrigger className="mt-1 h-8 text-sm">
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
                            <div>
                              <Label className="text-xs">تعليمات الاستخراج بالذكاء الاصطناعي *</Label>
                              <Textarea
                                value={currentField.extractionInstructions || ''}
                                onChange={(e) => setCurrentField({ ...currentField, extractionInstructions: e.target.value })}
                                placeholder="مثال: استخرج نوع الخبر من النص (سياسي، اقتصادي، رياضي، الخ)"
                                className="mt-1 min-h-[60px] text-sm"
                              />
                            </div>
                          )}

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div>
                              <Label className="text-xs">القيمة الافتراضية</Label>
                              <Input
                                value={currentField.defaultValue || ''}
                                onChange={(e) => setCurrentField({ ...currentField, defaultValue: e.target.value })}
                                placeholder="قيمة إذا فشل الاستخراج"
                                className="mt-1 h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">بادئة (قبل القيمة)</Label>
                              <Input
                                value={currentField.prefix || ''}
                                onChange={(e) => setCurrentField({ ...currentField, prefix: e.target.value })}
                                placeholder="مثال: emoji"
                                className="mt-1 h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">لاحقة (بعد القيمة)</Label>
                              <Input
                                value={currentField.suffix || ''}
                                onChange={(e) => setCurrentField({ ...currentField, suffix: e.target.value })}
                                placeholder="مثال: نص إضافي"
                                className="mt-1 h-8 text-sm"
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-3">
                            <div className="flex items-center gap-1.5">
                              <Switch
                                checked={currentField.showLabel ?? false}
                                onCheckedChange={(checked) => setCurrentField({ ...currentField, showLabel: checked })}
                                className="scale-90"
                              />
                              <Label className="text-xs">إظهار العنوان</Label>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Switch
                                checked={currentField.useDefaultIfEmpty ?? true}
                                onCheckedChange={(checked) => setCurrentField({ ...currentField, useDefaultIfEmpty: checked })}
                                className="scale-90"
                              />
                              <Label className="text-xs">استخدام الافتراضي إذا فارغ</Label>
                            </div>
                          </div>

                          <Button 
                            type="button" 
                            onClick={handleAddCustomField}
                            className="w-full h-8 text-sm"
                            size="sm"
                            variant={editingFieldIndex !== null ? "default" : "outline"}
                          >
                            <Plus className="h-3 w-3 mr-2" />
                            {editingFieldIndex !== null ? 'تحديث الحقل' : 'إضافة الحقل'}
                          </Button>
                          
                          {editingFieldIndex !== null && (
                            <Button 
                              type="button" 
                              onClick={resetCurrentField}
                              variant="ghost"
                              size="sm"
                              className="w-full h-8 text-sm"
                            >
                              إلغاء التعديل
                            </Button>
                          )}
                        </div>

                        {templateForm.customFields && templateForm.customFields.length > 0 && (
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">الحقول المضافة ({templateForm.customFields.length})</Label>
                            {templateForm.customFields.map((field, index) => (
                              <div key={index} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                                <div className="flex flex-col gap-0.5">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-4 w-4"
                                    onClick={() => handleMoveField(index, 'up')}
                                    disabled={index === 0}
                                  >
                                    <ChevronDown className="h-2 w-2 rotate-180" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-4 w-4"
                                    onClick={() => handleMoveField(index, 'down')}
                                    disabled={index === templateForm.customFields!.length - 1}
                                  >
                                    <ChevronDown className="h-2 w-2" />
                                  </Button>
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-sm font-medium">{field.fieldLabel}</span>
                                    <Badge variant="outline" className="text-[10px]">{field.fieldName}</Badge>
                                    <Badge variant="secondary" className="text-[10px]">
                                      {fieldTypes.find(ft => ft.value === field.fieldType)?.label}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="flex gap-0.5">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={() => handleEditCustomField(index)}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6 text-red-600"
                                    onClick={() => handleRemoveCustomField(index)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="p-3 border rounded-lg bg-muted/30">
                        <h4 className="text-xs font-medium mb-2">تذييل القالب (اختياري)</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="md:col-span-2">
                            <Label className="text-xs">نص التذييل</Label>
                            <Input
                              value={templateForm.footerText || ''}
                              onChange={(e) => setTemplateForm({ ...templateForm, footerText: e.target.value })}
                              placeholder="مثال: المصدر: قناتنا الإخبارية"
                              className="mt-1 h-8 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">تنسيق التذييل</Label>
                            <Select
                              value={templateForm.footerFormatting || 'none'}
                              onValueChange={(value) => setTemplateForm({ ...templateForm, footerFormatting: value })}
                            >
                              <SelectTrigger className="mt-1 h-8 text-sm">
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

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs">الحد الأقصى للطول (اختياري)</Label>
                          <Input
                            type="number"
                            value={templateForm.maxLength || ''}
                            onChange={(e) => setTemplateForm({ ...templateForm, maxLength: e.target.value ? parseInt(e.target.value) : undefined })}
                            placeholder="بدون حد"
                            className="mt-1 h-8 text-sm"
                            min={0}
                          />
                        </div>
                        <div>
                          <Label className="text-xs">الفاصل بين الحقول</Label>
                          <Select
                            value={templateForm.fieldSeparator || '\n'}
                            onValueChange={(value) => setTemplateForm({ ...templateForm, fieldSeparator: value })}
                          >
                            <SelectTrigger className="mt-1 h-8 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={'\n'}>سطر جديد</SelectItem>
                              <SelectItem value={'\n\n'}>سطرين</SelectItem>
                              <SelectItem value={' | '}>شريط |</SelectItem>
                              <SelectItem value={' - '}>شرطة -</SelectItem>
                              <SelectItem value={' '}>مسافة</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Switch
                          checked={templateForm.isDefault ?? false}
                          onCheckedChange={(checked) => setTemplateForm({ ...templateForm, isDefault: checked })}
                          className="scale-90"
                        />
                        <Label className="text-xs">تعيين كقالب افتراضي</Label>
                      </div>

                      <Button
                        onClick={handleSubmitTemplate}
                        disabled={createTemplateMutation.isPending}
                        className="w-full h-8 text-sm"
                        size="sm"
                      >
                        {createTemplateMutation.isPending && <Loader className="h-3 w-3 mr-2 animate-spin" />}
                        إنشاء القالب
                      </Button>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {/* Existing Templates List */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  القوالب المحفوظة ({publishingTemplates.length})
                </h3>
                
                {loadingTemplates ? (
                  <div className="flex justify-center p-8">
                    <Loader className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : publishingTemplates.length === 0 ? (
                  <Card className="p-8 text-center text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>لا توجد قوالب نشر. أنشئ قالب جديد للبدء.</p>
                  </Card>
                ) : (
                  <div className="grid gap-3">
                    {publishingTemplates.map((template: any) => (
                      <Card key={template.id} className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="font-semibold">{template.name}</span>
                              <Badge variant="outline">
                                {templateTypes.find(t => t.value === template.templateType)?.label}
                              </Badge>
                              {template.isDefault && (
                                <Badge>افتراضي</Badge>
                              )}
                            </div>
                            
                            {template.headerText && (
                              <div className="text-sm mb-1">
                                <span className="text-muted-foreground">الرأس: </span>
                                <code className="bg-muted px-1 rounded">{template.headerText}</code>
                                {template.headerFormatting !== 'none' && (
                                  <Badge variant="secondary" className="ml-2 text-xs">
                                    {formattingOptions.find(f => f.value === template.headerFormatting)?.label}
                                  </Badge>
                                )}
                              </div>
                            )}
                            
                            {template.customFields && template.customFields.length > 0 && (
                              <div className="text-sm mb-1">
                                <span className="text-muted-foreground">الحقول: </span>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {template.customFields.map((field: any, idx: number) => (
                                    <Badge key={idx} variant="outline" className="text-xs">
                                      {field.fieldLabel}
                                      {field.formatting !== 'none' && (
                                        <span className="ml-1 text-primary">
                                          ({formattingOptions.find(f => f.value === field.formatting)?.label})
                                        </span>
                                      )}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {template.footerText && (
                              <div className="text-sm">
                                <span className="text-muted-foreground">التذييل: </span>
                                <code className="bg-muted px-1 rounded">{template.footerText}</code>
                              </div>
                            )}
                            
                            {template.maxLength && (
                              <Badge variant="outline" className="mt-2 text-xs">
                                الحد الأقصى: {template.maxLength} حرف
                              </Badge>
                            )}
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-red-600"
                            onClick={() => deleteTemplateMutation.mutate(template.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      )}

      {!selectedTaskId && (
        <Card className="p-12 text-center">
          <Sparkles className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
          <h3 className="text-xl font-semibold mb-2">اختر مهمة للبدء</h3>
          <p className="text-muted-foreground">
            اختر مهمة من القائمة أعلاه لإعداد قواعد الذكاء الاصطناعي المتقدمة
          </p>
        </Card>
      )}
    </div>
  );
}
