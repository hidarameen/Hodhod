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
  Copy,
  Check,
  AlertCircle,
  Zap
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

export default function AIRulesPage() {
  const queryClient = useQueryClient();
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("entities");
  
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
            <TabsList className="grid w-full grid-cols-3 mb-6">
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
            </TabsList>

            <TabsContent value="entities" className="space-y-6">
              <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    {editingEntity ? "تعديل قاعدة الاستبدال" : "إضافة قاعدة استبدال جديدة"}
                  </CardTitle>
                  <CardDescription>
                    استبدل أسماء أو كلمات بأخرى تلقائياً. مثال: "محمد مصطفى" ← "البطل محمد مصطفى"
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>نوع الكيان</Label>
                      <Select
                        value={entityForm.entityType}
                        onValueChange={(value) => setEntityForm({ ...entityForm, entityType: value })}
                      >
                        <SelectTrigger className="mt-1">
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
                      <Label>الأولوية</Label>
                      <Input
                        type="number"
                        value={entityForm.priority}
                        onChange={(e) => setEntityForm({ ...entityForm, priority: parseInt(e.target.value) || 0 })}
                        className="mt-1"
                        min={0}
                        max={100}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>النص الأصلي</Label>
                      <Input
                        value={entityForm.originalText}
                        onChange={(e) => setEntityForm({ ...entityForm, originalText: e.target.value })}
                        placeholder="مثال: محمد مصطفى"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>النص البديل</Label>
                      <Input
                        value={entityForm.replacementText}
                        onChange={(e) => setEntityForm({ ...entityForm, replacementText: e.target.value })}
                        placeholder="مثال: البطل محمد مصطفى"
                        className="mt-1"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={entityForm.useContext}
                        onCheckedChange={(checked) => setEntityForm({ ...entityForm, useContext: checked })}
                      />
                      <Label>استخدام السياق</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={entityForm.caseSensitive}
                        onCheckedChange={(checked) => setEntityForm({ ...entityForm, caseSensitive: checked })}
                      />
                      <Label>حساس لحالة الأحرف</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={entityForm.isActive}
                        onCheckedChange={(checked) => setEntityForm({ ...entityForm, isActive: checked })}
                      />
                      <Label>مفعّل</Label>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleSubmitEntity}
                      disabled={createEntityMutation.isPending || updateEntityMutation.isPending}
                      className="flex-1"
                    >
                      {(createEntityMutation.isPending || updateEntityMutation.isPending) && (
                        <Loader className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      {editingEntity ? "حفظ التعديلات" : "إضافة القاعدة"}
                    </Button>
                    {editingEntity && (
                      <Button
                        variant="outline"
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
              </Card>

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

            <TabsContent value="context" className="space-y-6">
              <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    إضافة قاعدة سياق جديدة
                  </CardTitle>
                  <CardDescription>
                    تحييد اللغة السلبية، تعزيز الإيجابية، أو تعديل أسلوب النص
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>نوع القاعدة</Label>
                      <Select
                        value={contextForm.ruleType}
                        onValueChange={(value) => setContextForm({ ...contextForm, ruleType: value })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {contextRuleTypes.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              <div>
                                <div className="font-medium">{type.label}</div>
                                <div className="text-xs text-muted-foreground">{type.description}</div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>النبرة المستهدفة</Label>
                      <Select
                        value={contextForm.targetSentiment}
                        onValueChange={(value) => setContextForm({ ...contextForm, targetSentiment: value })}
                      >
                        <SelectTrigger className="mt-1">
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
                      <Label>نمط التفعيل (Regex)</Label>
                      <Input
                        value={contextForm.triggerPattern}
                        onChange={(e) => setContextForm({ ...contextForm, triggerPattern: e.target.value })}
                        placeholder="مثال: إرهابي|عميل|خائن"
                        className="mt-1 font-mono"
                        dir="ltr"
                      />
                    </div>
                  )}

                  <div>
                    <Label>التعليمات</Label>
                    <Textarea
                      value={contextForm.instructions}
                      onChange={(e) => setContextForm({ ...contextForm, instructions: e.target.value })}
                      placeholder="اكتب تعليمات واضحة للذكاء الاصطناعي..."
                      className="mt-1 min-h-[100px]"
                    />
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={contextForm.isActive}
                        onCheckedChange={(checked) => setContextForm({ ...contextForm, isActive: checked })}
                      />
                      <Label>مفعّل</Label>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">الأولوية</Label>
                      <Input
                        type="number"
                        value={contextForm.priority}
                        onChange={(e) => setContextForm({ ...contextForm, priority: parseInt(e.target.value) || 0 })}
                        className="w-20 h-8"
                        min={0}
                      />
                    </div>
                  </div>

                  <Button
                    onClick={handleSubmitContext}
                    disabled={createContextMutation.isPending}
                    className="w-full"
                  >
                    {createContextMutation.isPending && <Loader className="h-4 w-4 mr-2 animate-spin" />}
                    إضافة القاعدة
                  </Button>
                </CardContent>
              </Card>

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

            <TabsContent value="training" className="space-y-6">
              <Card className="border-2 border-dashed border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    إضافة مثال تدريب جديد
                  </CardTitle>
                  <CardDescription>
                    علّم الذكاء الاصطناعي أسلوبك المفضل بأمثلة عملية
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>نوع المثال</Label>
                    <Select
                      value={trainingForm.exampleType}
                      onValueChange={(value) => setTrainingForm({ ...trainingForm, exampleType: value })}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {exampleTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div>
                              <div className="font-medium">{type.label}</div>
                              <div className="text-xs text-muted-foreground">{type.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>النص المُدخل</Label>
                    <Textarea
                      value={trainingForm.inputText}
                      onChange={(e) => setTrainingForm({ ...trainingForm, inputText: e.target.value })}
                      placeholder="النص الأصلي أو مخرج الذكاء الاصطناعي الخاطئ..."
                      className="mt-1 min-h-[80px]"
                    />
                  </div>

                  <div>
                    <Label>المخرج المتوقع</Label>
                    <Textarea
                      value={trainingForm.expectedOutput}
                      onChange={(e) => setTrainingForm({ ...trainingForm, expectedOutput: e.target.value })}
                      placeholder="الصياغة الصحيحة التي تفضلها..."
                      className="mt-1 min-h-[80px]"
                    />
                  </div>

                  <div>
                    <Label>شرح (اختياري)</Label>
                    <Input
                      value={trainingForm.explanation}
                      onChange={(e) => setTrainingForm({ ...trainingForm, explanation: e.target.value })}
                      placeholder="لماذا هذه الصياغة أفضل؟"
                      className="mt-1"
                    />
                  </div>

                  <Button
                    onClick={handleSubmitTraining}
                    disabled={createTrainingMutation.isPending}
                    className="w-full"
                  >
                    {createTrainingMutation.isPending && <Loader className="h-4 w-4 mr-2 animate-spin" />}
                    إضافة المثال
                  </Button>
                </CardContent>
              </Card>

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
