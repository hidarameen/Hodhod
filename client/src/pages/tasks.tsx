import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { 
  Play, 
  Pause, 
  Edit, 
  Trash2, 
  Plus, 
  Loader,
  Sparkles,
  Bot,
  ArrowRight,
  ExternalLink,
  Zap,
  FileText,
  Settings2,
  Video,
  Link2,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  EntityReplacement,
  ContextRule,
  ContentFilter,
  PublishingTemplate,
  EntityDialog,
  ContextDialog,
  FilterDialog,
  TemplateDialog,
} from "@/components/ai-rules";

interface TaskFormData {
  id?: number;
  name: string;
  description: string;
  sourceChannels: number[];
  targetChannels: number[];
  aiEnabled: boolean;
  summarizationEnabled: boolean;
  summarizationProviderId: number | null;
  summarizationModelId: number | null;
  videoProcessingEnabled: boolean;
  videoAiProviderId: number | null;
  videoAiModelId: number | null;
  audioProcessingEnabled: boolean;
  audioAiProviderId: number | null;
  audioAiModelId: number | null;
  linkProcessingEnabled: boolean;
  linkVideoDownloadEnabled: boolean;
  linkVideoQuality: string;
}

interface RuleFormData {
  id?: number;
  name: string;
  type: string;
  prompt: string;
  priority: number;
  isActive: boolean;
}

const initialFormData: TaskFormData = {
  name: "",
  description: "",
  sourceChannels: [],
  targetChannels: [],
  aiEnabled: false,
  summarizationEnabled: false,
  summarizationProviderId: null,
  summarizationModelId: null,
  videoProcessingEnabled: false,
  videoAiProviderId: null,
  videoAiModelId: null,
  audioProcessingEnabled: false,
  audioAiProviderId: null,
  audioAiModelId: null,
  linkProcessingEnabled: false,
  linkVideoDownloadEnabled: true,
  linkVideoQuality: "high",
};

const initialRuleFormData: RuleFormData = {
  name: "",
  type: "summarize",
  prompt: "",
  priority: 0,
  isActive: true,
};

export default function TasksPage() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [ruleEditMode, setRuleEditMode] = useState(false);
  const [formData, setFormData] = useState<TaskFormData>(initialFormData);
  const [ruleFormData, setRuleFormData] = useState<RuleFormData>(initialRuleFormData);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [selectedRuleType, setSelectedRuleType] = useState<string>("summarize");
  const [advancedTab, setAdvancedTab] = useState<string>("entities");
  
  // Collapsible states for advanced rules sections
  const [entitiesEnabled, setEntitiesEnabled] = useState(false);
  const [contextEnabled, setContextEnabled] = useState(false);
  const [filtersEnabled, setFiltersEnabled] = useState(false);
  const [templatesEnabled, setTemplatesEnabled] = useState(false);
  
  // Dialog states for advanced rules
  const [entityDialogOpen, setEntityDialogOpen] = useState(false);
  const [contextDialogOpen, setContextDialogOpen] = useState(false);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  
  const [editingEntity, setEditingEntity] = useState<EntityReplacement | null>(null);
  const [editingContext, setEditingContext] = useState<ContextRule | null>(null);
  const [editingFilter, setEditingFilter] = useState<ContentFilter | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<PublishingTemplate | null>(null);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => api.getTasks(),
  });

  const { data: channels = [] } = useQuery({
    queryKey: ["channels"],
    queryFn: () => api.getChannels(),
  });

  const { data: providers = [] } = useQuery({
    queryKey: ["ai-providers"],
    queryFn: () => api.getAiProviders(),
  });

  const { data: models = [] } = useQuery({
    queryKey: ["ai-models"],
    queryFn: () => api.getAiModels(),
  });

  const { data: taskRules = [], refetch: refetchRules } = useQuery({
    queryKey: ["task-rules", selectedTaskId],
    queryFn: () => selectedTaskId ? api.getTaskRules(selectedTaskId) : Promise.resolve([]),
    enabled: !!selectedTaskId,
  });

  const { data: entityReplacements = [] } = useQuery({
    queryKey: ["entity-replacements", selectedTaskId],
    queryFn: () => selectedTaskId ? api.getEntityReplacements(selectedTaskId) : Promise.resolve([]),
    enabled: !!selectedTaskId,
  });

  const { data: contextRules = [] } = useQuery({
    queryKey: ["context-rules", selectedTaskId],
    queryFn: () => selectedTaskId ? api.getContextRules(selectedTaskId) : Promise.resolve([]),
    enabled: !!selectedTaskId,
  });

  const { data: contentFilters = [] } = useQuery({
    queryKey: ["content-filters", selectedTaskId],
    queryFn: () => selectedTaskId ? api.getContentFilters(selectedTaskId) : Promise.resolve([]),
    enabled: !!selectedTaskId,
  });

  const { data: publishingTemplates = [] } = useQuery({
    queryKey: ["publishing-templates", selectedTaskId],
    queryFn: () => selectedTaskId ? api.getPublishingTemplates(selectedTaskId) : Promise.resolve([]),
    enabled: !!selectedTaskId,
  });

  const { data: summarizationRules = [], refetch: refetchSummarizationRules } = useQuery({
    queryKey: ["summarization-rules", selectedTaskId],
    queryFn: () => selectedTaskId ? api.getSummarizationRules(selectedTaskId) : Promise.resolve([]),
    enabled: !!selectedTaskId,
  });

  const { data: videoProcessingRules = [], refetch: refetchVideoRules } = useQuery({
    queryKey: ["video-processing-rules", selectedTaskId],
    queryFn: () => selectedTaskId ? api.getVideoProcessingRules(selectedTaskId) : Promise.resolve([]),
    enabled: !!selectedTaskId,
  });

  const summarizationModels = models.filter(m => 
    formData.summarizationProviderId ? m.providerId === formData.summarizationProviderId : true
  );

  const videoModels = models.filter(m => 
    formData.videoAiProviderId ? m.providerId === formData.videoAiProviderId : true
  );

  const createMutation = useMutation({
    mutationFn: (data: TaskFormData) => api.createTask(data),
    onSuccess: (newTask: any) => {
      toast.success("تم إنشاء المهمة بنجاح!");
      setIsOpen(false);
      setSelectedTaskId(null);
      setFormData(initialFormData);
      setEditMode(false);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل إنشاء المهمة");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<TaskFormData> }) => api.updateTask(id, data),
    onSuccess: () => {
      toast.success("تم تحديث المهمة بنجاح!");
      setIsOpen(false);
      setSelectedTaskId(null);
      setFormData(initialFormData);
      setEditMode(false);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      refetchRules();
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل تحديث المهمة");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: number) => api.toggleTask(id),
    onSuccess: () => {
      toast.success("تم تحديث حالة المهمة");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteTask(id),
    onSuccess: () => {
      toast.success("تم حذف المهمة");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });

  const createRuleMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: number; data: any }) => api.createRule(taskId, data),
    onMutate: async ({ taskId, data }) => {
      await queryClient.cancelQueries({ queryKey: ["task-rules", taskId] });
      const prev = queryClient.getQueryData(["task-rules", taskId]);
      queryClient.setQueryData(["task-rules", taskId], (old: any) => [
        ...(old || []),
        { ...data, id: Date.now() }
      ]);
      return { prev };
    },
    onSuccess: () => {
      toast.success("✅ تم إنشاء القاعدة بنجاح");
      refetchRules();
      setRuleFormData(initialRuleFormData);
      setRuleEditMode(false);
    },
    onError: (error, _, context) => {
      queryClient.setQueryData(["task-rules", selectedTaskId], context?.prev);
      toast.error(error.message || "فشل إنشاء القاعدة");
    },
  });

  const updateRuleMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.updateRule(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ["task-rules", selectedTaskId] });
      const prev = queryClient.getQueryData(["task-rules", selectedTaskId]);
      queryClient.setQueryData(["task-rules", selectedTaskId], (old: any) =>
        old?.map((r: any) => r.id === id ? { ...r, ...data } : r) || []
      );
      return { prev };
    },
    onSuccess: () => {
      toast.success("تم تحديث القاعدة بنجاح");
      refetchRules();
      setRuleFormData(initialRuleFormData);
      setRuleEditMode(false);
    },
    onError: (error, _, context) => {
      queryClient.setQueryData(["task-rules", selectedTaskId], context?.prev);
      toast.error(error.message || "فشل تحديث القاعدة");
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: (id: number) => api.toggleRule(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["task-rules", selectedTaskId] });
      const prev = queryClient.getQueryData(["task-rules", selectedTaskId]);
      queryClient.setQueryData(["task-rules", selectedTaskId], (old: any) =>
        old?.map((r: any) => r.id === id ? { ...r, isActive: !r.isActive } : r) || []
      );
      return { prev };
    },
    onSuccess: () => {
      toast.success("تم تحديث حالة القاعدة");
      refetchRules();
    },
    onError: (_, __, context) => {
      queryClient.setQueryData(["task-rules", selectedTaskId], context?.prev);
      toast.error("فشل تحديث حالة القاعدة");
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (id: number) => api.deleteRule(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["task-rules", selectedTaskId] });
      const prev = queryClient.getQueryData(["task-rules", selectedTaskId]);
      queryClient.setQueryData(["task-rules", selectedTaskId], (old: any) =>
        old?.filter((r: any) => r.id !== id) || []
      );
      return { prev };
    },
    onSuccess: () => {
      toast.success("تم حذف القاعدة");
      refetchRules();
    },
    onError: (_, __, context) => {
      queryClient.setQueryData(["task-rules", selectedTaskId], context?.prev);
      toast.error("فشل حذف القاعدة");
    },
  });

  const createEntityMutation = useMutation({
    mutationFn: (data: any) => api.createEntityReplacement(data),
    onSuccess: () => {
      toast.success("تم إضافة قاعدة الاستبدال");
      queryClient.invalidateQueries({ queryKey: ["entity-replacements", selectedTaskId] });
      setEntityDialogOpen(false);
      setEditingEntity(null);
    },
    onError: () => toast.error("فشل في إضافة القاعدة"),
  });

  const createContextMutation = useMutation({
    mutationFn: (data: any) => api.createContextRule(data),
    onSuccess: () => {
      toast.success("تم إضافة قاعدة السياق");
      queryClient.invalidateQueries({ queryKey: ["context-rules", selectedTaskId] });
      setContextDialogOpen(false);
      setEditingContext(null);
    },
    onError: () => toast.error("فشل في إضافة القاعدة"),
  });

  const createFilterMutation = useMutation({
    mutationFn: (data: any) => api.createContentFilter(data),
    onSuccess: () => {
      toast.success("تم إضافة الفلتر");
      queryClient.invalidateQueries({ queryKey: ["content-filters", selectedTaskId] });
      setFilterDialogOpen(false);
      setEditingFilter(null);
    },
    onError: () => toast.error("فشل في إضافة الفلتر"),
  });

  const createTemplateMutation = useMutation({
    mutationFn: (data: any) => api.createPublishingTemplate(data),
    onSuccess: () => {
      toast.success("تم إضافة القالب");
      queryClient.invalidateQueries({ queryKey: ["publishing-templates", selectedTaskId] });
      setTemplateDialogOpen(false);
      setEditingTemplate(null);
    },
    onError: () => toast.error("فشل في إضافة القالب"),
  });

  const deleteEntityMutation = useMutation({
    mutationFn: (id: number) => api.deleteEntityReplacement(id),
    onSuccess: () => {
      toast.success("تم حذف القاعدة");
      queryClient.invalidateQueries({ queryKey: ["entity-replacements", selectedTaskId] });
    },
  });

  const deleteContextMutation = useMutation({
    mutationFn: (id: number) => api.deleteContextRule(id),
    onSuccess: () => {
      toast.success("تم حذف القاعدة");
      queryClient.invalidateQueries({ queryKey: ["context-rules", selectedTaskId] });
    },
  });

  const deleteFilterMutation = useMutation({
    mutationFn: (id: number) => api.deleteContentFilter(id),
    onSuccess: () => {
      toast.success("تم حذف الفلتر");
      queryClient.invalidateQueries({ queryKey: ["content-filters", selectedTaskId] });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: number) => api.deletePublishingTemplate(id),
    onSuccess: () => {
      toast.success("تم حذف القالب");
      queryClient.invalidateQueries({ queryKey: ["publishing-templates", selectedTaskId] });
    },
  });

  const createSummarizationMutation = useMutation({
    mutationFn: (data: any) => api.createSummarizationRule(data),
    onSuccess: () => {
      toast.success("تم إضافة قاعدة التلخيص");
      refetchSummarizationRules();
    },
    onError: () => toast.error("فشل في إضافة القاعدة"),
  });

  const updateSummarizationMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.updateSummarizationRule(id, data),
    onSuccess: () => {
      toast.success("تم تحديث قاعدة التلخيص");
      refetchSummarizationRules();
    },
    onError: () => toast.error("فشل في تحديث القاعدة"),
  });

  const deleteSummarizationMutation = useMutation({
    mutationFn: (id: number) => api.deleteSummarizationRule(id),
    onSuccess: () => {
      toast.success("تم حذف قاعدة التلخيص");
      refetchSummarizationRules();
    },
    onError: () => toast.error("فشل في حذف القاعدة"),
  });

  const toggleSummarizationMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => api.updateSummarizationRule(id, { isActive }),
    onSuccess: () => {
      refetchSummarizationRules();
    },
    onError: () => toast.error("فشل في تحديث الحالة"),
  });

  // Update mutations for advanced rules (for dialog edits)
  const updateEntityMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.updateEntityReplacement(id, data),
    onSuccess: () => {
      toast.success("تم تحديث قاعدة الاستبدال");
      queryClient.invalidateQueries({ queryKey: ["entity-replacements", selectedTaskId] });
      setEntityDialogOpen(false);
      setEditingEntity(null);
    },
    onError: () => toast.error("فشل في تحديث القاعدة"),
  });

  const updateContextMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.updateContextRule(id, data),
    onSuccess: () => {
      toast.success("تم تحديث قاعدة السياق");
      queryClient.invalidateQueries({ queryKey: ["context-rules", selectedTaskId] });
      setContextDialogOpen(false);
      setEditingContext(null);
    },
    onError: () => toast.error("فشل في تحديث القاعدة"),
  });

  const updateFilterMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.updateContentFilter(id, data),
    onSuccess: () => {
      toast.success("تم تحديث الفلتر");
      queryClient.invalidateQueries({ queryKey: ["content-filters", selectedTaskId] });
      setFilterDialogOpen(false);
      setEditingFilter(null);
    },
    onError: () => toast.error("فشل في تحديث الفلتر"),
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.updatePublishingTemplate(id, data),
    onSuccess: () => {
      toast.success("تم تحديث القالب");
      queryClient.invalidateQueries({ queryKey: ["publishing-templates", selectedTaskId] });
      setTemplateDialogOpen(false);
      setEditingTemplate(null);
    },
    onError: () => toast.error("فشل في تحديث القالب"),
  });

  // Toggle mutations (don't affect dialog state)
  const toggleEntityMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => api.updateEntityReplacement(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entity-replacements", selectedTaskId] });
    },
    onError: () => toast.error("فشل في تحديث الحالة"),
  });

  const toggleContextMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => api.updateContextRule(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["context-rules", selectedTaskId] });
    },
    onError: () => toast.error("فشل في تحديث الحالة"),
  });

  const toggleFilterMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => api.updateContentFilter(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-filters", selectedTaskId] });
    },
    onError: () => toast.error("فشل في تحديث الحالة"),
  });

  const handleCloseDialog = () => {
    setIsOpen(false);
    setEditMode(false);
    setFormData(initialFormData);
    setSelectedTaskId(null);
    setRuleFormData(initialRuleFormData);
    setRuleEditMode(false);
  };

  const handleOpenCreate = () => {
    setEditMode(false);
    setFormData(initialFormData);
    setSelectedTaskId(null);
    setIsOpen(true);
  };

  const handleOpenEdit = (task: any) => {
    setEditMode(true);
    setSelectedTaskId(task.id);
    setFormData({
      id: task.id,
      name: task.name || "",
      description: task.description || "",
      sourceChannels: task.sourceChannels || [],
      targetChannels: task.targetChannels || [],
      aiEnabled: task.aiEnabled || false,
      summarizationEnabled: task.summarizationEnabled || false,
      summarizationProviderId: task.summarizationProviderId || null,
      summarizationModelId: task.summarizationModelId || null,
      videoProcessingEnabled: task.videoProcessingEnabled || false,
      videoAiProviderId: task.videoAiProviderId || null,
      videoAiModelId: task.videoAiModelId || null,
      audioProcessingEnabled: task.audioProcessingEnabled || false,
      audioAiProviderId: task.audioAiProviderId || null,
      audioAiModelId: task.audioAiModelId || null,
      linkProcessingEnabled: task.linkProcessingEnabled || false,
      linkVideoDownloadEnabled: task.linkVideoDownloadEnabled !== false,
      linkVideoQuality: task.linkVideoQuality || "high",
    });
    setIsOpen(true);
  };

  const handleOpenRules = (task: any) => {
    setSelectedTaskId(task.id);
    setIsRulesOpen(true);
    setRuleFormData(initialRuleFormData);
    setRuleEditMode(false);
  };

  const handleEditRule = (rule: any) => {
    setRuleEditMode(true);
    setRuleFormData({
      id: rule.id,
      name: rule.name,
      type: rule.type,
      prompt: rule.prompt,
      priority: rule.priority,
      isActive: rule.isActive,
    });
    setSelectedRuleType(rule.type);
  };

  const handleSubmit = async () => {
    if (!formData.name || formData.sourceChannels.length === 0 || formData.targetChannels.length === 0) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }
    
    if (editMode && formData.id) {
      const { id, ...data } = formData;
      updateMutation.mutate({ id, data });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleSubmitRule = async () => {
    if (!ruleFormData.name || !ruleFormData.prompt) {
      toast.error("يرجى ملء اسم القاعدة والـ Prompt");
      return;
    }
    
    if (ruleEditMode && ruleFormData.id) {
      const { id, ...data } = ruleFormData;
      updateRuleMutation.mutate({ id, data });
    } else if (selectedTaskId) {
      createRuleMutation.mutate({ 
        taskId: selectedTaskId, 
        data: { ...ruleFormData, type: selectedRuleType }
      });
    } else {
      toast.error("يرجى حفظ المهمة أولاً قبل إضافة القواعس");
    }
  };

  const updateRulePriority = async (ruleId: number, newPriority: number) => {
    updateRuleMutation.mutate({ id: ruleId, data: { priority: newPriority } });
  };

  // Handlers for advanced rules dialogs
  const handleEntitySubmit = (data: Partial<EntityReplacement>) => {
    if (editingEntity?.id) {
      updateEntityMutation.mutate({ id: editingEntity.id, data });
    } else if (selectedTaskId) {
      createEntityMutation.mutate({ ...data, taskId: selectedTaskId });
    }
  };

  const handleContextSubmit = (data: Partial<ContextRule>) => {
    if (editingContext?.id) {
      updateContextMutation.mutate({ id: editingContext.id, data });
    } else if (selectedTaskId) {
      createContextMutation.mutate({ ...data, taskId: selectedTaskId });
    }
  };

  const handleFilterSubmit = (data: Partial<ContentFilter>) => {
    if (editingFilter?.id) {
      updateFilterMutation.mutate({ id: editingFilter.id, data });
    } else if (selectedTaskId) {
      createFilterMutation.mutate({ ...data, taskId: selectedTaskId });
    }
  };

  const handleTemplateSubmit = (data: Partial<PublishingTemplate>) => {
    if (editingTemplate?.id) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, data });
    } else if (selectedTaskId) {
      createTemplateMutation.mutate({ ...data, taskId: selectedTaskId });
    }
  };

  const handleToggleEntity = (entity: any) => {
    toggleEntityMutation.mutate({ id: entity.id, isActive: !entity.isActive });
  };

  const handleToggleContext = (rule: any) => {
    toggleContextMutation.mutate({ id: rule.id, isActive: !rule.isActive });
  };

  const handleToggleFilter = (filter: any) => {
    toggleFilterMutation.mutate({ id: filter.id, isActive: !filter.isActive });
  };

  const filteredRules = taskRules.filter((r: any) => r.type === selectedRuleType);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className={i18n.language === 'ar' ? 'text-right' : 'text-left'}>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground tracking-wide">{t('nav.tasks')}</h2>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">إدارة قواعد التوجيه التلقائي ومعالجة الرسائل</p>
        </div>
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleCloseDialog(); else setIsOpen(true); }}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenCreate} className="bg-primary text-primary-foreground font-bold hover:bg-primary/90 w-full sm:w-auto" data-testid="button-create-task">
              <Plus className="h-4 w-4 mr-2" /> مهمة جديدة
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editMode ? "تعديل المهمة" : "إنشاء مهمة توجيه جديدة"}</DialogTitle>
              <DialogDescription>أدخل تفاصيل المهمة واختر القنوات المصدر والهدف</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="task-name">اسم المهمة</Label>
                <Input
                  id="task-name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="مثل: توجيه الأخبار التقنية"
                  className="mt-1"
                  data-testid="input-task-name"
                />
              </div>
              
              <div>
                <Label htmlFor="task-desc">الوصف</Label>
                <Textarea
                  id="task-desc"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="وصف المهمة"
                  className="mt-1 resize-none"
                  data-testid="textarea-task-desc"
                />
              </div>

              <div>
                <Label>القنوات المصدر</Label>
                <div className="space-y-2 mt-2 max-h-40 overflow-y-auto p-2 bg-muted/50 rounded-lg border border-border">
                  {channels.filter((c: any) => c.type !== "website").map((channel: any) => (
                    <label key={channel.id} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={formData.sourceChannels.includes(channel.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({...formData, sourceChannels: [...formData.sourceChannels, channel.id]});
                          } else {
                            setFormData({...formData, sourceChannels: formData.sourceChannels.filter(id => id !== channel.id)});
                          }
                        }}
                        className="accent-primary"
                        data-testid={`checkbox-source-${channel.id}`}
                      />
                      <span className="text-foreground">{channel.title}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label>القنوات الهدف</Label>
                <div className="space-y-2 mt-2 max-h-40 overflow-y-auto p-2 bg-muted/50 rounded-lg border border-border">
                  {channels.filter((c: any) => c.type !== "website").map((channel: any) => (
                    <label key={channel.id} className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={formData.targetChannels.includes(channel.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({...formData, targetChannels: [...formData.targetChannels, channel.id]});
                          } else {
                            setFormData({...formData, targetChannels: formData.targetChannels.filter(id => id !== channel.id)});
                          }
                        }}
                        className="accent-primary"
                        data-testid={`checkbox-target-${channel.id}`}
                      />
                      <span className="text-foreground">{channel.title}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg border border-purple-500/20 bg-gradient-to-r from-purple-500/5 to-transparent">
                <div className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  <Label htmlFor="ai-enabled" className="text-purple-600 dark:text-purple-400 font-medium">تفعيل الذكاء الصناعي</Label>
                </div>
                <ToggleSwitch
                  id="ai-enabled"
                  checked={formData.aiEnabled}
                  onCheckedChange={(checked) => setFormData({...formData, aiEnabled: checked})}
                  activeColor="purple"
                  size="sm"
                  data-testid="switch-ai-enabled"
                />
              </div>

              {formData.aiEnabled && (
                <div className="p-3 rounded-lg bg-gradient-to-r from-primary/5 to-transparent border border-primary/20">
                  <p className="text-sm text-muted-foreground">
                    <Sparkles className="h-4 w-4 inline-block ml-1 text-primary" />
                    للإعدادات المتقدمة (التلخيص، معالجة الفيديو، الاستبدالات)، اذهب إلى{" "}
                    <a href={`/ai-rules?taskId=${selectedTaskId}`} className="underline text-primary font-medium">
                      صفحة قواعد الذكاء الاصطناعي
                    </a>
                  </p>
                </div>
              )}
            </div>


            <Button 
              onClick={handleSubmit}
              className="w-full mt-4"
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-submit-task"
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader className="h-4 w-4 mr-2 animate-spin" />}
              {editMode ? "حفظ التعديلات" : "إنشاء المهمة"}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tasks.length === 0 ? (
          <div className="col-span-full p-8 text-center text-muted-foreground">
            لا توجد مهام حالياً. اضغط على "مهمة جديدة" للبدء
          </div>
        ) : (
          tasks.map((task: any, idx: number) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              data-testid={`card-task-${task.id}`}
            >
              <Card className="border shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden group cursor-pointer">
                {/* Header with gradient */}
                <div className={`h-1 bg-gradient-to-r ${
                  task.isActive 
                    ? 'from-green-500 to-emerald-500' 
                    : 'from-yellow-500 to-orange-500'
                }`} />
                
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-base font-bold text-foreground line-clamp-2">
                        {task.name}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {task.description || "بدون وصف"}
                      </p>
                    </div>
                    <Badge 
                      className={task.isActive 
                        ? "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/30 whitespace-nowrap" 
                        : "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/30 whitespace-nowrap"}
                      variant="outline"
                      data-testid={`badge-status-${task.id}`}
                    >
                      {task.isActive ? "🟢 نشطة" : "🟡 معطلة"}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Channels */}
                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex items-center gap-1 px-2 py-1 rounded bg-muted/50">
                      <span className="text-muted-foreground">المصادر:</span>
                      <span className="font-bold text-foreground">{task.sourceChannels?.length || 0}</span>
                    </div>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <div className="flex items-center gap-1 px-2 py-1 rounded bg-muted/50">
                      <span className="text-muted-foreground">الأهداف:</span>
                      <span className="font-bold text-foreground">{task.targetChannels?.length || 0}</span>
                    </div>
                  </div>

                  {/* Features indicators */}
                  <div className="flex flex-wrap gap-2">
                    {task.aiEnabled && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/10 border border-purple-500/20"
                      >
                        <Sparkles className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                        <span className="text-xs text-purple-600 dark:text-purple-400">AI</span>
                      </motion.div>
                    )}
                    {task.summarizationEnabled && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.05 }}
                        className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20"
                      >
                        <FileText className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">تلخيص</span>
                      </motion.div>
                    )}
                    {task.videoProcessingEnabled && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.1 }}
                        className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/10 border border-blue-500/20"
                      >
                        <Video className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                        <span className="text-xs text-blue-600 dark:text-blue-400">فيديو</span>
                      </motion.div>
                    )}
                    {task.linkProcessingEnabled && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.15 }}
                        className="flex items-center gap-1 px-2 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20"
                      >
                        <Link2 className="h-3 w-3 text-cyan-600 dark:text-cyan-400" />
                        <span className="text-xs text-cyan-600 dark:text-cyan-400">روابط</span>
                      </motion.div>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-between text-xs border-t border-border pt-2">
                    <span className="text-muted-foreground">الموجهة:</span>
                    <span className="font-mono font-bold text-foreground">{task.totalForwarded} رسالة</span>
                  </div>
                </CardContent>

                {/* Actions */}
                <div className="px-4 pb-3 flex gap-2 justify-end border-t border-border pt-3">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-8 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => deleteMutation.mutate(task.id)}
                    data-testid={`button-delete-${task.id}`}
                    title="حذف"
                  >
                    <Trash2 className="h-3 w-3 ml-1" />
                    حذف
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="h-8 text-xs"
                    onClick={() => handleOpenEdit(task)}
                    data-testid={`button-edit-${task.id}`}
                    title="تعديل"
                  >
                    <Edit className="h-3 w-3 ml-1" />
                    تعديل
                  </Button>
                  <Link href={`/ai-rules?taskId=${task.id}`}>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="h-8 text-xs bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/30 hover:bg-purple-500/20"
                      data-testid={`button-customize-${task.id}`}
                      title="تخصيص القواعد"
                    >
                      <Settings2 className="h-3 w-3 ml-1 text-purple-600" />
                      تخصيص
                    </Button>
                  </Link>
                  <Button 
                    size="sm" 
                    className="h-8 text-xs bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary"
                    onClick={() => toggleMutation.mutate(task.id)}
                    data-testid={`button-toggle-${task.id}`}
                    title={task.isActive ? "إيقاف" : "تشغيل"}
                  >
                    {task.isActive ? (
                      <><Pause className="h-3 w-3 ml-1" /> إيقاف</>
                    ) : (
                      <><Play className="h-3 w-3 ml-1" /> تشغيل</>
                    )}
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      <Dialog open={isRulesOpen} onOpenChange={setIsRulesOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              إدارة القواعد
            </DialogTitle>
            <DialogDescription>إضافة وتعديل وحذف القواعد للمهمة</DialogDescription>
          </DialogHeader>

          <Tabs value={selectedRuleType} onValueChange={(value) => {
            setSelectedRuleType(value);
            setRuleFormData(initialRuleFormData);
            setRuleEditMode(false);
          }} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="summarize" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                قواعد التلخيص
              </TabsTrigger>
              <TabsTrigger value="video" className="flex items-center gap-2">
                <Video className="h-4 w-4" />
                قواعد الفيديو
              </TabsTrigger>
            </TabsList>

            <TabsContent value="summarize" className="space-y-4 mt-4">
              <Card className="border-dashed">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">
                    {ruleEditMode ? "تعديل القاعدة" : "إضافة قاعدة جديدة"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>اسم القاعدة</Label>
                      <Input
                        value={ruleFormData.name}
                        onChange={(e) => setRuleFormData({...ruleFormData, name: e.target.value})}
                        placeholder="مثل: تلخيص الأخبار"
                        className="mt-1"
                        data-testid="input-rule-name"
                      />
                    </div>
                    <div>
                      <Label>الأولوية</Label>
                      <Input
                        type="number"
                        value={ruleFormData.priority}
                        onChange={(e) => setRuleFormData({...ruleFormData, priority: parseInt(e.target.value) || 0})}
                        className="mt-1"
                        data-testid="input-rule-priority"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Prompt التلخيص</Label>
                    <Textarea
                      value={ruleFormData.prompt}
                      onChange={(e) => setRuleFormData({...ruleFormData, prompt: e.target.value})}
                      placeholder="مثل: قم بتلخيص النص التالي بشكل موجز مع الحفاظ على النقاط الرئيسية..."
                      className="mt-1 min-h-[100px]"
                      data-testid="textarea-rule-prompt"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleSubmitRule}
                      disabled={createRuleMutation.isPending || updateRuleMutation.isPending}
                      data-testid="button-submit-rule"
                    >
                      {(createRuleMutation.isPending || updateRuleMutation.isPending) && <Loader className="h-4 w-4 mr-2 animate-spin" />}
                      {ruleEditMode ? "حفظ التعديلات" : "إضافة القاعدة"}
                    </Button>
                    {ruleEditMode && (
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setRuleEditMode(false);
                          setRuleFormData(initialRuleFormData);
                        }}
                      >
                        إلغاء
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">القواعد الحالية</h4>
                {filteredRules.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground border rounded-lg border-dashed">
                    لا توجد قواعد تلخيص. أضف قاعدة جديدة للبدء.
                  </div>
                ) : (
                  filteredRules.map((rule: any) => (
                    <Card key={rule.id} className={`border ${!rule.isActive ? 'opacity-50' : ''}`}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col gap-1">
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-5 w-5"
                                onClick={() => updateRulePriority(rule.id, rule.priority + 1)}
                              >
                                <ChevronUp className="h-3 w-3" />
                              </Button>
                              <span className="text-xs text-center text-muted-foreground">{rule.priority}</span>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-5 w-5"
                                onClick={() => updateRulePriority(rule.id, Math.max(0, rule.priority - 1))}
                              >
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                            </div>
                            <div>
                              <p className="font-medium">{rule.name}</p>
                              <p className="text-sm text-muted-foreground line-clamp-2 break-words max-w-lg">{rule.prompt}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <ToggleSwitch
                              checked={rule.isActive}
                              onCheckedChange={() => toggleRuleMutation.mutate(rule.id)}
                              size="sm"
                              data-testid={`toggle-rule-${rule.id}`}
                            />
                            <Button 
                              size="icon" 
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => handleEditRule(rule)}
                              data-testid={`button-edit-rule-${rule.id}`}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost"
                              className="h-7 w-7 text-red-600"
                              onClick={() => deleteRuleMutation.mutate(rule.id)}
                              data-testid={`button-delete-rule-${rule.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="video" className="space-y-4 mt-4">
              <Card className="border-dashed">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">
                    {ruleEditMode ? "تعديل القاعدة" : "إضافة قاعدة جديدة"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>اسم القاعدة</Label>
                      <Input
                        value={ruleFormData.name}
                        onChange={(e) => setRuleFormData({...ruleFormData, name: e.target.value})}
                        placeholder="مثل: تحويل الفيديو"
                        className="mt-1"
                        data-testid="input-video-rule-name"
                      />
                    </div>
                    <div>
                      <Label>الأولوية</Label>
                      <Input
                        type="number"
                        value={ruleFormData.priority}
                        onChange={(e) => setRuleFormData({...ruleFormData, priority: parseInt(e.target.value) || 0})}
                        className="mt-1"
                        data-testid="input-video-rule-priority"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Prompt معالجة الفيديو</Label>
                    <Textarea
                      value={ruleFormData.prompt}
                      onChange={(e) => setRuleFormData({...ruleFormData, prompt: e.target.value})}
                      placeholder="مثل: قم بتلخيص محتوى الفيديو..."
                      className="mt-1 min-h-[100px]"
                      data-testid="textarea-video-rule-prompt"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleSubmitRule}
                      disabled={createRuleMutation.isPending || updateRuleMutation.isPending}
                      data-testid="button-submit-video-rule"
                    >
                      {(createRuleMutation.isPending || updateRuleMutation.isPending) && <Loader className="h-4 w-4 mr-2 animate-spin" />}
                      {ruleEditMode ? "حفظ التعديلات" : "إضافة القاعدة"}
                    </Button>
                    {ruleEditMode && (
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setRuleEditMode(false);
                          setRuleFormData(initialRuleFormData);
                        }}
                      >
                        إلغاء
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">القواعد الحالية</h4>
                {filteredRules.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground border rounded-lg border-dashed">
                    لا توجد قواعد فيديو. أضف قاعدة جديدة للبدء.
                  </div>
                ) : (
                  filteredRules.map((rule: any) => (
                    <Card key={rule.id} className={`border ${!rule.isActive ? 'opacity-50' : ''}`}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col gap-1">
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-5 w-5"
                                onClick={() => updateRulePriority(rule.id, rule.priority + 1)}
                              >
                                <ChevronUp className="h-3 w-3" />
                              </Button>
                              <span className="text-xs text-center text-muted-foreground">{rule.priority}</span>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-5 w-5"
                                onClick={() => updateRulePriority(rule.id, Math.max(0, rule.priority - 1))}
                              >
                                <ChevronDown className="h-3 w-3" />
                              </Button>
                            </div>
                            <div>
                              <p className="font-medium">{rule.name}</p>
                              <p className="text-sm text-muted-foreground line-clamp-2 break-words max-w-lg">{rule.prompt}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <ToggleSwitch
                              checked={rule.isActive}
                              onCheckedChange={() => toggleRuleMutation.mutate(rule.id)}
                              size="sm"
                              data-testid={`toggle-video-rule-${rule.id}`}
                            />
                            <Button 
                              size="icon" 
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => handleEditRule(rule)}
                              data-testid={`button-edit-video-rule-${rule.id}`}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost"
                              className="h-7 w-7 text-red-600"
                              onClick={() => deleteRuleMutation.mutate(rule.id)}
                              data-testid={`button-delete-video-rule-${rule.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Advanced Rules Dialogs */}
      <EntityDialog
        open={entityDialogOpen}
        onOpenChange={setEntityDialogOpen}
        onSubmit={handleEntitySubmit}
        editingData={editingEntity}
        isLoading={createEntityMutation.isPending || updateEntityMutation.isPending}
      />
      
      <ContextDialog
        open={contextDialogOpen}
        onOpenChange={setContextDialogOpen}
        onSubmit={handleContextSubmit}
        editingData={editingContext}
        isLoading={createContextMutation.isPending || updateContextMutation.isPending}
      />
      
      <FilterDialog
        open={filterDialogOpen}
        onOpenChange={setFilterDialogOpen}
        onSubmit={handleFilterSubmit}
        editingData={editingFilter}
        isLoading={createFilterMutation.isPending || updateFilterMutation.isPending}
      />
      
      <TemplateDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        onSubmit={handleTemplateSubmit}
        editingData={editingTemplate}
        isLoading={createTemplateMutation.isPending || updateTemplateMutation.isPending}
      />
    </div>
  );
}
