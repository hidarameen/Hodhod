import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { api } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Sparkles, 
  Plus, 
  Trash2, 
  Edit, 
  ArrowRightLeft,
  Shield,
  Brain,
  Settings2,
  FileText,
  Loader,
  Filter,
  ToggleRight,
  LayoutGrid,
  BookOpen,
  Film,
  Link2,
  Mic
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { toast } from "sonner";

import {
  EntityReplacement,
  ContextRule,
  TrainingExample,
  ContentFilter,
  PublishingTemplate,
  SummarizationRule,
  VideoProcessingRule,
  AudioProcessingRule,
  entityTypes,
  contextRuleTypes,
  exampleTypes,
  filterTypes,
  matchTypes,
  filterActions,
  templateTypes,
  fieldTypes,
  summarizationStyles
} from "@/components/ai-rules/types";
import { EntityDialog } from "@/components/ai-rules/EntityDialog";
import { ContextDialog } from "@/components/ai-rules/ContextDialog";
import { TrainingDialog } from "@/components/ai-rules/TrainingDialog";
import { FilterDialog } from "@/components/ai-rules/FilterDialog";
import { TemplateDialog } from "@/components/ai-rules/TemplateDialog";
import { SummarizationDialog } from "@/components/ai-rules/SummarizationDialog";
import { VideoProcessingDialog } from "@/components/ai-rules/VideoProcessingDialog";
import { AudioSummarizationDialog } from "@/components/ai-rules/AudioSummarizationDialog";
import { RuleSection } from "@/components/ai-rules/RuleSection";

type SectionType = 'entities' | 'context' | 'training' | 'filters' | 'templates' | 'summarization' | 'video' | 'audio';

interface SectionInfo {
  id: SectionType;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  description: string;
}

const sections: SectionInfo[] = [
  { 
    id: 'entities', 
    label: 'قواعد الاستبدال', 
    shortLabel: 'استبدال',
    icon: <ArrowRightLeft className="h-4 w-4" />, 
    color: 'text-foreground',
    bgColor: 'from-slate-500/8 to-slate-600/8',
    description: 'استبدال الأسماء والكلمات تلقائياً'
  },
  { 
    id: 'context', 
    label: 'قواعد السياق', 
    shortLabel: 'سياق',
    icon: <Shield className="h-4 w-4" />, 
    color: 'text-foreground',
    bgColor: 'from-slate-500/8 to-slate-600/8',
    description: 'تحييد اللغة وتعديل الأسلوب'
  },
  { 
    id: 'training', 
    label: 'أمثلة التدريب', 
    shortLabel: 'تدريب',
    icon: <Brain className="h-4 w-4" />, 
    color: 'text-foreground',
    bgColor: 'from-slate-500/8 to-slate-600/8',
    description: 'تدريب الذكاء الاصطناعي بأمثلة'
  },
  { 
    id: 'filters', 
    label: 'فلاتر المحتوى', 
    shortLabel: 'فلاتر',
    icon: <Filter className="h-4 w-4" />, 
    color: 'text-foreground',
    bgColor: 'from-slate-500/8 to-slate-600/8',
    description: 'تصفية المحتوى حسب أنماط'
  },
  { 
    id: 'templates', 
    label: 'قوالب النشر', 
    shortLabel: 'قوالب',
    icon: <FileText className="h-4 w-4" />, 
    color: 'text-foreground',
    bgColor: 'from-slate-500/8 to-slate-600/8',
    description: 'تنسيق المخرجات المنشورة'
  },
  {
    id: 'summarization',
    label: 'تلخيص النصوص',
    shortLabel: 'تلخيص',
    icon: <BookOpen className="h-4 w-4" />,
    color: 'text-foreground',
    bgColor: 'from-slate-500/8 to-slate-600/8',
    description: 'إعدادات وقواعد تلخيص النصوص'
  },
  {
    id: 'video',
    label: 'معالجة الفيديو',
    shortLabel: 'فيديو',
    icon: <Film className="h-4 w-4" />,
    color: 'text-foreground',
    bgColor: 'from-slate-500/8 to-slate-600/8',
    description: 'إعدادات ومعالجة ملفات الفيديو والروابط'
  },
  {
    id: 'audio',
    label: 'تلخيص الصوت',
    shortLabel: 'صوت',
    icon: <Mic className="h-4 w-4" />,
    color: 'text-foreground',
    bgColor: 'from-slate-500/8 to-slate-600/8',
    description: 'تفريغ وتلخيص المقاطع الصوتية والرسائل الصوتية'
  },
];

export default function AIRulesPage() {
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sectionStates, setSectionStates] = useState<Record<SectionType, boolean>>({
    entities: true,
    context: true,
    training: true,
    filters: true,
    templates: true,
    summarization: true,
    video: true,
    audio: true
  });

  // Auto-select task from URL query parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const taskIdParam = params.get('taskId');
    if (taskIdParam) {
      const taskId = parseInt(taskIdParam);
      if (!isNaN(taskId)) {
        setSelectedTaskId(taskId);
      }
    }
  }, [location]);

  const [isEntityDialogOpen, setIsEntityDialogOpen] = useState(false);
  const [isContextDialogOpen, setIsContextDialogOpen] = useState(false);
  const [isTrainingDialogOpen, setIsTrainingDialogOpen] = useState(false);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isSummarizationDialogOpen, setIsSummarizationDialogOpen] = useState(false);
  const [isVideoDialogOpen, setIsVideoDialogOpen] = useState(false);
  const [isAudioDialogOpen, setIsAudioDialogOpen] = useState(false);

  const [editingEntity, setEditingEntity] = useState<EntityReplacement | null>(null);
  const [editingContext, setEditingContext] = useState<ContextRule | null>(null);
  const [editingTraining, setEditingTraining] = useState<TrainingExample | null>(null);
  const [editingFilter, setEditingFilter] = useState<ContentFilter | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<PublishingTemplate | null>(null);
  const [editingSummarization, setEditingSummarization] = useState<SummarizationRule | null>(null);
  const [editingVideo, setEditingVideo] = useState<VideoProcessingRule | null>(null);
  const [editingAudio, setEditingAudio] = useState<SummarizationRule | null>(null);

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

  const { data: summarizationRules = [], isLoading: loadingSummarization } = useQuery({
    queryKey: ["summarization-rules", selectedTaskId],
    queryFn: () => selectedTaskId ? api.getSummarizationRules(selectedTaskId) : Promise.resolve([]),
    enabled: !!selectedTaskId,
  });

  const { data: videoProcessingRules = [], isLoading: loadingVideo } = useQuery({
    queryKey: ["video-processing-rules", selectedTaskId],
    queryFn: () => selectedTaskId ? api.getVideoProcessingRules(selectedTaskId) : Promise.resolve([]),
    enabled: !!selectedTaskId,
  });

  const { data: audioSummarizationRules = [], isLoading: loadingAudioSummarization } = useQuery({
    queryKey: ["audio-summarization-rules", selectedTaskId],
    queryFn: () => selectedTaskId ? api.getSummarizationRules(selectedTaskId).then((rules: any[]) => rules.filter(r => r.type === 'audio_summarize')) : Promise.resolve([]),
    enabled: !!selectedTaskId,
  });

  const { data: providers = [] } = useQuery({
    queryKey: ["ai-providers"],
    queryFn: () => api.getAiProviders(),
  });

  const { data: models = [] } = useQuery({
    queryKey: ["ai-models"],
    queryFn: () => api.getAiModels(),
  });

  const selectedTask = useMemo(() => {
    return tasks.find((t: any) => t.id === selectedTaskId);
  }, [tasks, selectedTaskId]);

  const summarizationModels = useMemo(() => {
    if (!selectedTask?.summarizationProviderId) return [];
    return models.filter((m: any) => m.providerId === selectedTask.summarizationProviderId);
  }, [models, selectedTask?.summarizationProviderId]);

  const videoModels = useMemo(() => {
    if (!selectedTask?.videoAiProviderId) return [];
    return models.filter((m: any) => m.providerId === selectedTask.videoAiProviderId);
  }, [models, selectedTask?.videoAiProviderId]);

  const audioModels = useMemo(() => {
    if (!selectedTask?.audioAiProviderId) return [];
    return models.filter((m: any) => m.providerId === selectedTask.audioAiProviderId);
  }, [models, selectedTask?.audioAiProviderId]);

  const getProviderName = (providerId: number) => {
    const provider = providers.find((p: any) => p.id === providerId);
    return provider?.name?.toUpperCase() || '';
  };

  const updateTaskSettingsMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.updateTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("تم حفظ الإعدادات");
    },
    onError: () => toast.error("فشل في حفظ الإعدادات"),
  });

  const createEntityMutation = useMutation({
    mutationFn: (data: any) => api.createEntityReplacement(data),
    onSuccess: () => {
      toast.success("تم إضافة قاعدة الاستبدال");
      queryClient.invalidateQueries({ queryKey: ["entity-replacements"] });
      setIsEntityDialogOpen(false);
      setEditingEntity(null);
    },
    onError: () => toast.error("فشل في إضافة القاعدة"),
  });

  const updateEntityMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.updateEntityReplacement(id, data),
    onSuccess: () => {
      toast.success("تم تحديث القاعدة");
      queryClient.invalidateQueries({ queryKey: ["entity-replacements"] });
      setIsEntityDialogOpen(false);
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
      setIsContextDialogOpen(false);
      setEditingContext(null);
    },
    onError: () => toast.error("فشل في إضافة القاعدة"),
  });

  const updateContextMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.updateContextRule(id, data),
    onSuccess: () => {
      toast.success("تم تحديث القاعدة");
      queryClient.invalidateQueries({ queryKey: ["context-rules"] });
      setIsContextDialogOpen(false);
      setEditingContext(null);
    },
    onError: () => toast.error("فشل في تحديث القاعدة"),
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
      setIsTrainingDialogOpen(false);
      setEditingTraining(null);
    },
    onError: () => toast.error("فشل في إضافة المثال"),
  });

  const updateTrainingMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.updateTrainingExample(id, data),
    onSuccess: () => {
      toast.success("تم تحديث المثال");
      queryClient.invalidateQueries({ queryKey: ["training-examples"] });
      setIsTrainingDialogOpen(false);
      setEditingTraining(null);
    },
    onError: () => toast.error("فشل في تحديث المثال"),
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
      setIsFilterDialogOpen(false);
      setEditingFilter(null);
    },
    onError: () => toast.error("فشل في إضافة الفلتر"),
  });

  const updateFilterMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.updateContentFilter(id, data),
    onSuccess: () => {
      toast.success("تم تحديث الفلتر");
      queryClient.invalidateQueries({ queryKey: ["content-filters"] });
      setIsFilterDialogOpen(false);
      setEditingFilter(null);
    },
    onError: () => toast.error("فشل في تحديث الفلتر"),
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
      setIsTemplateDialogOpen(false);
      setEditingTemplate(null);
    },
    onError: () => toast.error("فشل في إضافة القالب"),
  });

  const updateTemplateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.updatePublishingTemplate(id, data),
    onSuccess: () => {
      toast.success("تم تحديث القالب");
      queryClient.invalidateQueries({ queryKey: ["publishing-templates"] });
      setIsTemplateDialogOpen(false);
      setEditingTemplate(null);
    },
    onError: () => toast.error("فشل في تحديث القالب"),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: (id: number) => api.deletePublishingTemplate(id),
    onSuccess: () => {
      toast.success("تم حذف القالب");
      queryClient.invalidateQueries({ queryKey: ["publishing-templates"] });
    },
    onError: () => toast.error("فشل في حذف القالب"),
  });

  const createSummarizationMutation = useMutation({
    mutationFn: (data: any) => api.createSummarizationRule(data),
    onSuccess: () => {
      toast.success("تم إضافة قاعدة التلخيص");
      queryClient.invalidateQueries({ queryKey: ["summarization-rules"] });
      setIsSummarizationDialogOpen(false);
      setEditingSummarization(null);
    },
    onError: () => toast.error("فشل في إضافة القاعدة"),
  });

  const updateSummarizationMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.updateSummarizationRule(id, data),
    onSuccess: () => {
      toast.success("تم تحديث القاعدة");
      queryClient.invalidateQueries({ queryKey: ["summarization-rules"] });
      setIsSummarizationDialogOpen(false);
      setEditingSummarization(null);
    },
    onError: () => toast.error("فشل في تحديث القاعدة"),
  });

  const deleteSummarizationMutation = useMutation({
    mutationFn: (id: number) => api.deleteSummarizationRule(id),
    onSuccess: () => {
      toast.success("تم حذف القاعدة");
      queryClient.invalidateQueries({ queryKey: ["summarization-rules"] });
    },
    onError: () => toast.error("فشل في حذف القاعدة"),
  });

  const createVideoMutation = useMutation({
    mutationFn: (data: any) => api.createVideoProcessingRule(data),
    onSuccess: () => {
      toast.success("تم إضافة قاعدة معالجة الفديو");
      queryClient.invalidateQueries({ queryKey: ["video-processing-rules"] });
      setIsVideoDialogOpen(false);
      setEditingVideo(null);
    },
    onError: () => toast.error("فشل في إضافة القاعدة"),
  });

  const updateVideoMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.updateVideoProcessingRule(id, data),
    onSuccess: () => {
      toast.success("تم تحديث القاعدة");
      queryClient.invalidateQueries({ queryKey: ["video-processing-rules"] });
      setIsVideoDialogOpen(false);
      setEditingVideo(null);
    },
    onError: () => toast.error("فشل في تحديث القاعدة"),
  });

  const deleteVideoMutation = useMutation({
    mutationFn: (id: number) => api.deleteVideoProcessingRule(id),
    onSuccess: () => {
      toast.success("تم حذف القاعدة");
      queryClient.invalidateQueries({ queryKey: ["video-processing-rules"] });
    },
    onError: () => toast.error("فشل في حذف القاعدة"),
  });

  const createAudioMutation = useMutation({
    mutationFn: (data: any) => api.createSummarizationRule({ ...data, type: 'audio_summarize' }),
    onSuccess: () => {
      toast.success("تم إضافة قاعدة تلخيص الصوت");
      queryClient.invalidateQueries({ queryKey: ["audio-summarization-rules"] });
      setIsAudioDialogOpen(false);
      setEditingAudio(null);
    },
    onError: () => toast.error("فشل في إضافة القاعدة"),
  });

  const updateAudioMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.updateSummarizationRule(id, { ...data, type: 'audio_summarize' }),
    onSuccess: () => {
      toast.success("تم تحديث القاعدة");
      queryClient.invalidateQueries({ queryKey: ["audio-summarization-rules"] });
      setIsAudioDialogOpen(false);
      setEditingAudio(null);
    },
    onError: () => toast.error("فشل في تحديث القاعدة"),
  });

  const deleteAudioMutation = useMutation({
    mutationFn: (id: number) => api.deleteSummarizationRule(id),
    onSuccess: () => {
      toast.success("تم حذف القاعدة");
      queryClient.invalidateQueries({ queryKey: ["audio-summarization-rules"] });
    },
    onError: () => toast.error("فشل في حذف القاعدة"),
  });

  const handleSubmitEntity = (data: Partial<EntityReplacement>) => {
    if (!selectedTaskId) return;
    const payload = { ...data, taskId: selectedTaskId };
    if (editingEntity?.id) {
      updateEntityMutation.mutate({ id: editingEntity.id, data: payload });
    } else {
      createEntityMutation.mutate(payload);
    }
  };

  const handleSubmitContext = (data: Partial<ContextRule>) => {
    if (!selectedTaskId) return;
    const payload = { ...data, taskId: selectedTaskId };
    if (editingContext?.id) {
      updateContextMutation.mutate({ id: editingContext.id, data: payload });
    } else {
      createContextMutation.mutate(payload);
    }
  };

  const handleSubmitTraining = (data: Partial<TrainingExample>) => {
    if (!selectedTaskId) {
      toast.error("يرجى اختيار مهمة أولاً");
      return;
    }
    const payload = { ...data, taskId: selectedTaskId };
    if (editingTraining?.id) {
      updateTrainingMutation.mutate({ id: editingTraining.id, data: payload });
    } else {
      createTrainingMutation.mutate(payload);
    }
  };

  const handleSubmitFilter = (data: Partial<ContentFilter>) => {
    if (!selectedTaskId) {
      toast.error("يرجى اختيار مهمة أولاً");
      return;
    }
    const payload = { ...data, taskId: selectedTaskId };
    if (editingFilter?.id) {
      updateFilterMutation.mutate({ id: editingFilter.id, data: payload });
    } else {
      createFilterMutation.mutate(payload);
    }
  };

  const handleSubmitTemplate = (data: Partial<PublishingTemplate>) => {
    if (!selectedTaskId) {
      toast.error("يرجى اختيار مهمة أولاً");
      return;
    }
    const payload = { ...data, taskId: selectedTaskId };
    if (editingTemplate?.id) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, data: payload });
    } else {
      createTemplateMutation.mutate(payload);
    }
  };

  const handleSubmitSummarization = (data: Partial<SummarizationRule>) => {
    if (!selectedTaskId) {
      toast.error("يرجى اختيار مهمة أولاً");
      return;
    }
    const payload = { ...data, taskId: selectedTaskId };
    if (editingSummarization?.id) {
      updateSummarizationMutation.mutate({ id: editingSummarization.id, data: payload });
    } else {
      createSummarizationMutation.mutate(payload);
    }
  };

  const handleSubmitVideo = (data: Partial<VideoProcessingRule>) => {
    if (!selectedTaskId) {
      toast.error("يرجى اختيار مهمة أولاً");
      return;
    }
    const payload = { ...data, taskId: selectedTaskId };
    if (editingVideo?.id) {
      updateVideoMutation.mutate({ id: editingVideo.id, data: payload });
    } else {
      createVideoMutation.mutate(payload);
    }
  };

  const handleSubmitAudio = (data: Partial<SummarizationRule>) => {
    if (!selectedTaskId) {
      toast.error("يرجى اختيار مهمة أولاً");
      return;
    }
    const payload = { ...data, taskId: selectedTaskId };
    if (editingAudio?.id) {
      updateAudioMutation.mutate({ id: editingAudio.id, data: payload });
    } else {
      createAudioMutation.mutate(payload);
    }
  };

  const getSectionCount = (sectionId: SectionType): number => {
    switch (sectionId) {
      case 'entities': return entityReplacements.length;
      case 'context': return contextRules.length;
      case 'training': return trainingExamples.length;
      case 'filters': return contentFilters.length;
      case 'templates': return publishingTemplates.length;
      case 'summarization': return summarizationRules.length;
      case 'video': return videoProcessingRules.length;
      case 'audio': return audioSummarizationRules.length;
      default: return 0;
    }
  };

  const toggleSection = (sectionId: SectionType, enabled: boolean) => {
    setSectionStates(prev => ({ ...prev, [sectionId]: enabled }));
  };

  const totalRules = useMemo(() => 
    entityReplacements.length + contextRules.length + trainingExamples.length + 
    contentFilters.length + publishingTemplates.length
  , [entityReplacements, contextRules, trainingExamples, contentFilters, publishingTemplates]);

  const activeRules = useMemo(() => 
    entityReplacements.filter((e: any) => e.isActive).length +
    contextRules.filter((c: any) => c.isActive).length +
    trainingExamples.filter((t: any) => t.isActive).length +
    contentFilters.filter((f: any) => f.isActive).length
  , [entityReplacements, contextRules, trainingExamples, contentFilters]);

  const isLoading = loadingEntities || loadingContext || loadingTraining || loadingFilters || loadingTemplates || loadingSummarization || loadingVideo || loadingAudioSummarization;

  const openAddDialog = (sectionId: SectionType) => {
    switch (sectionId) {
      case 'entities':
        setEditingEntity(null);
        setIsEntityDialogOpen(true);
        break;
      case 'context':
        setEditingContext(null);
        setIsContextDialogOpen(true);
        break;
      case 'training':
        setEditingTraining(null);
        setIsTrainingDialogOpen(true);
        break;
      case 'filters':
        setEditingFilter(null);
        setIsFilterDialogOpen(true);
        break;
      case 'templates':
        setEditingTemplate(null);
        setIsTemplateDialogOpen(true);
        break;
      case 'summarization':
        setEditingSummarization(null);
        setIsSummarizationDialogOpen(true);
        break;
      case 'video':
        setEditingVideo(null);
        setIsVideoDialogOpen(true);
        break;
      case 'audio':
        setEditingAudio(null);
        setIsAudioDialogOpen(true);
        break;
    }
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10">
                <Sparkles className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                  قواعد الذكاء الاصطناعي المتقدمة
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                  تخصيص معالجة النصوص بقواعد استبدال وسياق وتدريب
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Select
                value={selectedTaskId?.toString() || ""}
                onValueChange={(value) => setSelectedTaskId(value ? parseInt(value) : null)}
              >
                <SelectTrigger className="w-[240px] h-11 bg-card border-2">
                  <div className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="اختر مهمة..." />
                  </div>
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
            </div>
          </div>

          {selectedTaskId && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="p-4 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 border-blue-200/50 dark:border-blue-800/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">إجمالي القواعد</p>
                      <p className="text-2xl font-bold text-blue-600">{totalRules}</p>
                    </div>
                    <LayoutGrid className="h-8 w-8 text-blue-500/30" />
                  </div>
                </Card>
                <Card className="p-4 bg-gradient-to-br from-green-500/5 to-emerald-500/5 border-green-200/50 dark:border-green-800/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">القواعد النشطة</p>
                      <p className="text-2xl font-bold text-green-600">{activeRules}</p>
                    </div>
                    <ToggleRight className="h-8 w-8 text-green-500/30" />
                  </div>
                </Card>
                <Card className="p-4 bg-gradient-to-br from-violet-500/5 to-purple-500/5 border-violet-200/50 dark:border-violet-800/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">أمثلة التدريب</p>
                      <p className="text-2xl font-bold text-violet-600">{trainingExamples.length}</p>
                    </div>
                    <Brain className="h-8 w-8 text-violet-500/30" />
                  </div>
                </Card>
                <Card className="p-4 bg-gradient-to-br from-pink-500/5 to-rose-500/5 border-pink-200/50 dark:border-pink-800/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">القوالب</p>
                      <p className="text-2xl font-bold text-pink-600">{publishingTemplates.length}</p>
                    </div>
                    <FileText className="h-8 w-8 text-pink-500/30" />
                  </div>
                </Card>
              </div>

              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Loader className="h-8 w-8 animate-spin mb-3" />
                  <p>جاري التحميل...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <RuleSection
                    title={sections[0].label}
                    description={sections[0].description}
                    icon={sections[0].icon}
                    color={sections[0].color}
                    bgColor={sections[0].bgColor}
                    isEnabled={sectionStates.entities}
                    onToggleEnabled={(enabled) => toggleSection('entities', enabled)}
                    count={getSectionCount('entities')}
                    onAdd={() => openAddDialog('entities')}
                    addLabel="إضافة قاعدة"
                  >
                    <EntityList 
                      items={entityReplacements}
                      onEdit={(item) => { setEditingEntity(item); setIsEntityDialogOpen(true); }}
                      onDelete={(id) => deleteEntityMutation.mutate(id)}
                      searchQuery=""
                    />
                  </RuleSection>

                  <RuleSection
                    title={sections[1].label}
                    description={sections[1].description}
                    icon={sections[1].icon}
                    color={sections[1].color}
                    bgColor={sections[1].bgColor}
                    isEnabled={sectionStates.context}
                    onToggleEnabled={(enabled) => toggleSection('context', enabled)}
                    count={getSectionCount('context')}
                    onAdd={() => openAddDialog('context')}
                    addLabel="إضافة قاعدة"
                  >
                    <ContextList
                      items={contextRules}
                      onEdit={(item) => { setEditingContext(item); setIsContextDialogOpen(true); }}
                      onDelete={(id) => deleteContextMutation.mutate(id)}
                      searchQuery=""
                    />
                  </RuleSection>

                  <RuleSection
                    title={sections[2].label}
                    description={sections[2].description}
                    icon={sections[2].icon}
                    color={sections[2].color}
                    bgColor={sections[2].bgColor}
                    isEnabled={sectionStates.training}
                    onToggleEnabled={(enabled) => toggleSection('training', enabled)}
                    count={getSectionCount('training')}
                    onAdd={() => openAddDialog('training')}
                    addLabel="إضافة مثال"
                  >
                    <TrainingList
                      items={trainingExamples}
                      onEdit={(item) => { setEditingTraining(item); setIsTrainingDialogOpen(true); }}
                      onDelete={(id) => deleteTrainingMutation.mutate(id)}
                      searchQuery=""
                    />
                  </RuleSection>

                  <RuleSection
                    title={sections[3].label}
                    description={sections[3].description}
                    icon={sections[3].icon}
                    color={sections[3].color}
                    bgColor={sections[3].bgColor}
                    isEnabled={sectionStates.filters}
                    onToggleEnabled={(enabled) => toggleSection('filters', enabled)}
                    count={getSectionCount('filters')}
                    onAdd={() => openAddDialog('filters')}
                    addLabel="إضافة فلتر"
                  >
                    <FilterList
                      items={contentFilters}
                      onEdit={(item) => { setEditingFilter(item); setIsFilterDialogOpen(true); }}
                      onDelete={(id) => deleteFilterMutation.mutate(id)}
                      searchQuery=""
                    />
                  </RuleSection>

                  <RuleSection
                    title={sections[4].label}
                    description={sections[4].description}
                    icon={sections[4].icon}
                    color={sections[4].color}
                    bgColor={sections[4].bgColor}
                    isEnabled={sectionStates.templates}
                    onToggleEnabled={(enabled) => toggleSection('templates', enabled)}
                    count={getSectionCount('templates')}
                    onAdd={() => openAddDialog('templates')}
                    addLabel="إضافة قالب"
                  >
                    <TemplateList
                      items={publishingTemplates}
                      onEdit={(item) => { setEditingTemplate(item); setIsTemplateDialogOpen(true); }}
                      onDelete={(id) => deleteTemplateMutation.mutate(id)}
                      searchQuery=""
                    />
                  </RuleSection>

                  <RuleSection
                    title={sections[5].label}
                    description={sections[5].description}
                    icon={sections[5].icon}
                    color={sections[5].color}
                    bgColor={sections[5].bgColor}
                    isEnabled={sectionStates.summarization}
                    onToggleEnabled={(enabled) => {
                      toggleSection('summarization', enabled);
                      if (selectedTaskId) {
                        updateTaskSettingsMutation.mutate({ 
                          id: selectedTaskId, 
                          data: { summarizationEnabled: enabled } 
                        });
                      }
                    }}
                    count={getSectionCount('summarization')}
                    onAdd={() => openAddDialog('summarization')}
                    addLabel="إضافة قاعدة"
                    settingsPanel={
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                            <Sparkles className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                          </div>
                          <Label className="text-sm font-semibold">إعدادات الذكاء الاصطناعي</Label>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-xs font-medium text-muted-foreground">مزود الذكاء الاصطناعي</Label>
                            <Select
                              value={selectedTask?.summarizationProviderId?.toString() || ""}
                              onValueChange={(value) => {
                                if (selectedTaskId) {
                                  updateTaskSettingsMutation.mutate({
                                    id: selectedTaskId,
                                    data: { 
                                      summarizationProviderId: value ? parseInt(value) : null,
                                      summarizationModelId: null
                                    }
                                  });
                                }
                              }}
                            >
                              <SelectTrigger className="h-11 rounded-lg border-2 bg-background hover:bg-muted/50 transition-colors">
                                <SelectValue placeholder="اختر المزود" />
                              </SelectTrigger>
                              <SelectContent>
                                {providers.map((provider: any) => (
                                  <SelectItem key={provider.id} value={provider.id.toString()}>
                                    {provider.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-medium text-muted-foreground">المودل</Label>
                            <Select
                              value={selectedTask?.summarizationModelId?.toString() || ""}
                              onValueChange={(value) => {
                                if (selectedTaskId) {
                                  updateTaskSettingsMutation.mutate({
                                    id: selectedTaskId,
                                    data: { summarizationModelId: value ? parseInt(value) : null }
                                  });
                                }
                              }}
                              disabled={!selectedTask?.summarizationProviderId}
                            >
                              <SelectTrigger className="h-11 rounded-lg border-2 bg-background hover:bg-muted/50 transition-colors">
                                <SelectValue placeholder="اختر المودل" />
                              </SelectTrigger>
                              <SelectContent>
                                {summarizationModels.map((model: any) => (
                                  <SelectItem key={model.id} value={model.id.toString()}>
                                    <span className="flex items-center gap-2">
                                      <span className="text-xs text-muted-foreground">[{getProviderName(model.providerId)}]</span>
                                      {model.displayName}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    }
                  >
                    <SummarizationList
                      items={summarizationRules}
                      onEdit={(item) => { setEditingSummarization(item); setIsSummarizationDialogOpen(true); }}
                      onDelete={(id) => deleteSummarizationMutation.mutate(id)}
                      searchQuery=""
                    />
                  </RuleSection>

                  <RuleSection
                    title={sections[6].label}
                    description={sections[6].description}
                    icon={sections[6].icon}
                    color={sections[6].color}
                    bgColor={sections[6].bgColor}
                    isEnabled={sectionStates.video}
                    onToggleEnabled={(enabled) => {
                      toggleSection('video', enabled);
                      if (selectedTaskId) {
                        updateTaskSettingsMutation.mutate({ 
                          id: selectedTaskId, 
                          data: { videoProcessingEnabled: enabled } 
                        });
                      }
                    }}
                    count={getSectionCount('video')}
                    onAdd={() => openAddDialog('video')}
                    addLabel="إضافة قاعدة"
                    settingsPanel={
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm font-medium mb-2 block">مزود الذكاء الاصطناعي</Label>
                            <Select
                              value={selectedTask?.videoAiProviderId?.toString() || ""}
                              onValueChange={(value) => {
                                if (selectedTaskId) {
                                  updateTaskSettingsMutation.mutate({
                                    id: selectedTaskId,
                                    data: { 
                                      videoAiProviderId: value ? parseInt(value) : null,
                                      videoAiModelId: null
                                    }
                                  });
                                }
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="اختر المزود" />
                              </SelectTrigger>
                              <SelectContent>
                                {providers.map((provider: any) => (
                                  <SelectItem key={provider.id} value={provider.id.toString()}>
                                    {provider.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-sm font-medium mb-2 block">المودل</Label>
                            <Select
                              value={selectedTask?.videoAiModelId?.toString() || ""}
                              onValueChange={(value) => {
                                if (selectedTaskId) {
                                  updateTaskSettingsMutation.mutate({
                                    id: selectedTaskId,
                                    data: { videoAiModelId: value ? parseInt(value) : null }
                                  });
                                }
                              }}
                              disabled={!selectedTask?.videoAiProviderId}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="اختر المودل" />
                              </SelectTrigger>
                              <SelectContent>
                                {videoModels.map((model: any) => (
                                  <SelectItem key={model.id} value={model.id.toString()}>
                                    <span className="flex items-center gap-2">
                                      <span className="text-xs text-muted-foreground">[{getProviderName(model.providerId)}]</span>
                                      {model.displayName}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="border-t pt-4 mt-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Link2 className="h-4 w-4 text-cyan-600" />
                            <Label className="text-sm font-medium">معالجة الروابط</Label>
                          </div>

                          <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
                              <Label className="text-sm">تفعيل معالجة الروابط</Label>
                              <ToggleSwitch
                                checked={selectedTask?.linkProcessingEnabled || false}
                                onCheckedChange={(checked) => {
                                  if (selectedTaskId) {
                                    updateTaskSettingsMutation.mutate({
                                      id: selectedTaskId,
                                      data: { linkProcessingEnabled: checked }
                                    });
                                  }
                                }}
                                size="sm"
                              />
                            </div>

                            {selectedTask?.linkProcessingEnabled && (
                              <>
                                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                                  <Label className="text-sm">تنزيل الفيديو من الروابط</Label>
                                  <ToggleSwitch
                                    checked={selectedTask?.linkVideoDownloadEnabled !== false}
                                    onCheckedChange={(checked) => {
                                      if (selectedTaskId) {
                                        updateTaskSettingsMutation.mutate({
                                          id: selectedTaskId,
                                          data: { linkVideoDownloadEnabled: checked }
                                        });
                                      }
                                    }}
                                    size="sm"
                                  />
                                </div>

                                <div>
                                  <Label className="text-sm mb-2 block">جودة الفيديو</Label>
                                  <Select
                                    value={selectedTask?.linkVideoQuality || "high"}
                                    onValueChange={(value) => {
                                      if (selectedTaskId) {
                                        updateTaskSettingsMutation.mutate({
                                          id: selectedTaskId,
                                          data: { linkVideoQuality: value }
                                        });
                                      }
                                    }}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="high">عالية (1080p)</SelectItem>
                                      <SelectItem value="medium">متوسطة (720p)</SelectItem>
                                      <SelectItem value="low">منخفضة (480p)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    }
                  >
                    <VideoProcessingList
                      items={videoProcessingRules}
                      onEdit={(item) => { setEditingVideo(item); setIsVideoDialogOpen(true); }}
                      onDelete={(id) => deleteVideoMutation.mutate(id)}
                      searchQuery=""
                    />
                  </RuleSection>

                  <RuleSection
                    title={sections[7].label}
                    description={sections[7].description}
                    icon={sections[7].icon}
                    color={sections[7].color}
                    bgColor={sections[7].bgColor}
                    isEnabled={sectionStates.audio}
                    onToggleEnabled={(enabled) => {
                      toggleSection('audio', enabled);
                      if (selectedTaskId) {
                        updateTaskSettingsMutation.mutate({ 
                          id: selectedTaskId, 
                          data: { audioProcessingEnabled: enabled } 
                        });
                      }
                    }}
                    count={getSectionCount('audio')}
                    onAdd={() => openAddDialog('audio')}
                    addLabel="إضافة قاعدة"
                    settingsPanel={
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm font-medium mb-2 block">مزود الذكاء الاصطناعي</Label>
                            <Select
                              value={selectedTask?.audioAiProviderId?.toString() || ""}
                              onValueChange={(value) => {
                                if (selectedTaskId) {
                                  updateTaskSettingsMutation.mutate({
                                    id: selectedTaskId,
                                    data: { 
                                      audioAiProviderId: value ? parseInt(value) : null,
                                      audioAiModelId: null
                                    }
                                  });
                                }
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="اختر المزود" />
                              </SelectTrigger>
                              <SelectContent>
                                {providers.map((provider: any) => (
                                  <SelectItem key={provider.id} value={provider.id.toString()}>
                                    {provider.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-sm font-medium mb-2 block">المودل</Label>
                            <Select
                              value={selectedTask?.audioAiModelId?.toString() || ""}
                              onValueChange={(value) => {
                                if (selectedTaskId) {
                                  updateTaskSettingsMutation.mutate({
                                    id: selectedTaskId,
                                    data: { audioAiModelId: value ? parseInt(value) : null }
                                  });
                                }
                              }}
                              disabled={!selectedTask?.audioAiProviderId}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="اختر المودل" />
                              </SelectTrigger>
                              <SelectContent>
                                {audioModels.map((model: any) => (
                                  <SelectItem key={model.id} value={model.id.toString()}>
                                    <span className="flex items-center gap-2">
                                      <span className="text-xs text-muted-foreground">[{getProviderName(model.providerId)}]</span>
                                      {model.displayName}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                          <p>عند تفعيل هذه الميزة، سيتم:</p>
                          <ul className="list-disc list-inside mt-2 space-y-1">
                            <li>تفريغ المقاطع الصوتية والرسائل الصوتية إلى نص</li>
                            <li>تلخيص النص المُفرّغ باستخدام الذكاء الاصطناعي</li>
                            <li>إنشاء صفحة Telegraph للنص الكامل</li>
                          </ul>
                        </div>
                      </div>
                    }
                  >
                    <AudioSummarizationRuleList
                      items={audioSummarizationRules}
                      onEdit={(item) => { setEditingAudio(item); setIsAudioDialogOpen(true); }}
                      onDelete={(id) => deleteAudioMutation.mutate(id)}
                      searchQuery=""
                    />
                  </RuleSection>
                </div>
              )}
            </motion.div>
          )}

          {!selectedTaskId && (
            <Card className="p-12 text-center">
              <div className="p-4 rounded-full bg-muted/50 w-fit mx-auto mb-4">
                <Settings2 className="h-12 w-12 text-muted-foreground/50" />
              </div>
              <h3 className="text-xl font-semibold mb-2">اختر مهمة للبدء</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                يرجى اختيار مهمة من القائمة أعلاه لتتمكن من إعداد قواعد الذكاء الاصطناعي الخاصة بها
              </p>
            </Card>
          )}
        </div>

        <EntityDialog
          open={isEntityDialogOpen}
          onOpenChange={(open) => { setIsEntityDialogOpen(open); if (!open) setEditingEntity(null); }}
          onSubmit={handleSubmitEntity}
          editingData={editingEntity}
          isLoading={createEntityMutation.isPending || updateEntityMutation.isPending}
        />
        <ContextDialog
          open={isContextDialogOpen}
          onOpenChange={(open) => { setIsContextDialogOpen(open); if (!open) setEditingContext(null); }}
          onSubmit={handleSubmitContext}
          editingData={editingContext}
          isLoading={createContextMutation.isPending || updateContextMutation.isPending}
        />
        <TrainingDialog
          open={isTrainingDialogOpen}
          onOpenChange={(open) => { setIsTrainingDialogOpen(open); if (!open) setEditingTraining(null); }}
          onSubmit={handleSubmitTraining}
          editingData={editingTraining}
          isLoading={createTrainingMutation.isPending || updateTrainingMutation.isPending}
        />
        <FilterDialog
          open={isFilterDialogOpen}
          onOpenChange={(open) => { setIsFilterDialogOpen(open); if (!open) setEditingFilter(null); }}
          onSubmit={handleSubmitFilter}
          editingData={editingFilter}
          isLoading={createFilterMutation.isPending || updateFilterMutation.isPending}
        />
        <TemplateDialog
          open={isTemplateDialogOpen}
          onOpenChange={(open) => { setIsTemplateDialogOpen(open); if (!open) setEditingTemplate(null); }}
          onSubmit={handleSubmitTemplate}
          editingData={editingTemplate}
          isLoading={createTemplateMutation.isPending || updateTemplateMutation.isPending}
        />
        <SummarizationDialog
          open={isSummarizationDialogOpen}
          onOpenChange={(open) => { setIsSummarizationDialogOpen(open); if (!open) setEditingSummarization(null); }}
          onSubmit={handleSubmitSummarization}
          editingData={editingSummarization}
          isLoading={createSummarizationMutation.isPending || updateSummarizationMutation.isPending}
        />
        <VideoProcessingDialog
          open={isVideoDialogOpen}
          onOpenChange={(open) => { setIsVideoDialogOpen(open); if (!open) setEditingVideo(null); }}
          onSubmit={handleSubmitVideo}
          editingData={editingVideo}
          isLoading={createVideoMutation.isPending || updateVideoMutation.isPending}
        />
        <AudioSummarizationDialog
          open={isAudioDialogOpen}
          onOpenChange={(open) => { setIsAudioDialogOpen(open); if (!open) setEditingAudio(null); }}
          onSubmit={handleSubmitAudio}
          editingData={editingAudio}
          isLoading={createAudioMutation.isPending || updateAudioMutation.isPending}
        />
      </div>
    </TooltipProvider>
  );
}

function SummarizationList({ items, onEdit, onDelete, searchQuery }: { 
  items: any[]; 
  onEdit: (item: any) => void; 
  onDelete: (id: number) => void;
  searchQuery: string;
}) {
  const queryClient = useQueryClient();
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => 
      api.updateSummarizationRule(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["summarization-rules"] });
      toast.success("تم تحديث حالة القاعدة");
    },
    onError: () => toast.error("فشل في تحديث القاعدة"),
  });

  const filtered = items.filter((item: any) => 
    !searchQuery || 
    item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.prompt?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>لا توجد قواعد تلخيص</p>
        <p className="text-sm mt-1">أضف قاعدة جديدة للبدء</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filtered.map((rule: any) => (
        <div key={rule.id} className={`group flex items-start gap-4 p-4 rounded-xl border bg-card hover:shadow-md transition-all ${!rule.isActive ? 'opacity-60' : ''}`}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge className="gap-1">{rule.name}</Badge>
              <Badge variant="outline" className="text-xs">أسلوب: {summarizationStyles.find(s => s.value === rule.style)?.label || rule.style}</Badge>
              {rule.priority > 0 && (
                <Badge variant="outline" className="text-xs">أولوية: {rule.priority}</Badge>
              )}
              <Badge variant={rule.isActive ? "default" : "secondary"} className="text-xs">
                {rule.isActive ? "مفعّل" : "معطّل"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">{rule.prompt || 'بدون تعليمات'}</p>
            <div className="text-xs text-muted-foreground mt-2">الطول الأقصى: {rule.maxLength} حرف | النقاط الرئيسية: {rule.keyPointsCount}</div>
          </div>
          <div className="flex items-center gap-1 opacity-100 transition-opacity">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className={`h-8 w-8 border ${rule.isActive ? 'hover:bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800' : 'hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'}`}
                  onClick={() => toggleActiveMutation.mutate({ id: rule.id, isActive: !rule.isActive })}
                  disabled={toggleActiveMutation.isPending}
                >
                  {rule.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{rule.isActive ? 'تعطيل' : 'تفعيل'}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800" onClick={() => onEdit(rule)}>
                  <Edit className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>تعديل</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800" onClick={() => onDelete(rule.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>حذف</TooltipContent>
            </Tooltip>
          </div>
        </div>
      ))}
    </div>
  );
}

function AudioSummarizationRuleList({ items, onEdit, onDelete, searchQuery }: { 
  items: any[]; 
  onEdit: (item: any) => void; 
  onDelete: (id: number) => void;
  searchQuery: string;
}) {
  const queryClient = useQueryClient();
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => 
      api.updateSummarizationRule(id, { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audio-summarization-rules"] });
      toast.success("تم تحديث حالة القاعدة");
    },
    onError: () => toast.error("فشل في تحديث القاعدة"),
  });

  const filtered = items.filter((item: any) => 
    !searchQuery || 
    item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.prompt?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Mic className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>لا توجد قواعس تلخيص الصوت</p>
        <p className="text-sm mt-1">أضف قاعدة جديدة للبدء</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filtered.map((rule: any) => (
        <div key={rule.id} className={`group flex items-start gap-4 p-4 rounded-xl border bg-card hover:shadow-md transition-all ${!rule.isActive ? 'opacity-60' : ''}`}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge className="gap-1">{rule.name}</Badge>
              <Badge variant="outline" className="text-xs">أسلوب: {summarizationStyles.find(s => s.value === rule.style)?.label || rule.style}</Badge>
              {rule.priority > 0 && (
                <Badge variant="outline" className="text-xs">أولوية: {rule.priority}</Badge>
              )}
              <Badge variant={rule.isActive ? "default" : "secondary"} className="text-xs">
                {rule.isActive ? "مفعّل" : "معطّل"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">{rule.prompt || 'بدون تعليمات'}</p>
            <div className="text-xs text-muted-foreground mt-2">الطول الأقصى: {rule.maxLength} حرف | النقاط الرئيسية: {rule.keyPointsCount}</div>
          </div>
          <div className="flex items-center gap-1 opacity-100 transition-opacity">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className={`h-8 w-8 border ${rule.isActive ? 'hover:bg-green-500/10 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800' : 'hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800'}`}
                  onClick={() => toggleActiveMutation.mutate({ id: rule.id, isActive: !rule.isActive })}
                  disabled={toggleActiveMutation.isPending}
                >
                  {rule.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{rule.isActive ? 'تعطيل' : 'تفعيل'}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800" onClick={() => onEdit(rule)}>
                  <Edit className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>تعديل</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800" onClick={() => onDelete(rule.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>حذف</TooltipContent>
            </Tooltip>
          </div>
        </div>
      ))}
    </div>
  );
}

function VideoProcessingList({ items, onEdit, onDelete, searchQuery }: { 
  items: any[]; 
  onEdit: (item: any) => void; 
  onDelete: (id: number) => void;
  searchQuery: string;
}) {
  const filtered = items.filter((item: any) => 
    !searchQuery || 
    item.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Film className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>لا توجد قواعد معالجة فديو</p>
        <p className="text-sm mt-1">أضف قاعدة جديدة للبدء</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filtered.map((rule: any) => (
        <div key={rule.id} className={`group flex items-start gap-4 p-4 rounded-xl border bg-card hover:shadow-md transition-all ${!rule.isActive ? 'opacity-60' : ''}`}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge className="gap-1">{rule.name}</Badge>
              <Badge variant="outline" className="text-xs">صيغة: {rule.outputFormat.toUpperCase()}</Badge>
              {rule.priority > 0 && (
                <Badge variant="outline" className="text-xs">أولوية: {rule.priority}</Badge>
              )}
              <Badge variant={rule.isActive ? "default" : "secondary"} className="text-xs">
                {rule.isActive ? "مفعّل" : "معطّل"}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>أقصى مدة: {Math.floor(rule.maxDuration / 60)} دقيقة</p>
              <div className="flex gap-4 mt-2">
                {rule.extractFrames && <span className="text-green-600">✓ استخراج صور</span>}
                {rule.extractAudio && <span className="text-green-600">✓ استخراج صوت</span>}
                {rule.generateSubtitles && <span className="text-green-600">✓ ترجمات</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-100 transition-opacity">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800" onClick={() => onEdit(rule)}>
                  <Edit className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>تعديل</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800" onClick={() => onDelete(rule.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>حذف</TooltipContent>
            </Tooltip>
          </div>
        </div>
      ))}
    </div>
  );
}

function EntityList({ items, onEdit, onDelete, searchQuery }: { 
  items: any[]; 
  onEdit: (item: any) => void; 
  onDelete: (id: number) => void;
  searchQuery: string;
}) {
  const filtered = items.filter((item: any) => 
    !searchQuery || 
    item.originalText?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.replacementText?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <ArrowRightLeft className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>لا توجد قواعد استبدال</p>
        <p className="text-sm mt-1">أضف قاعدة جديدة للبدء</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <AnimatePresence>
        {filtered.map((entity: any) => (
          <motion.div
            key={entity.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className={`group flex items-center gap-4 p-4 rounded-xl border bg-card hover:shadow-md transition-all ${!entity.isActive ? 'opacity-60' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <Badge variant="outline" className="gap-1">
                    {entityTypes.find(t => t.value === entity.entityType)?.icon}
                    {entityTypes.find(t => t.value === entity.entityType)?.label}
                  </Badge>
                  <Badge variant={entity.isActive ? "default" : "secondary"} className="text-xs">
                    {entity.isActive ? "مفعّل" : "معطّل"}
                  </Badge>
                  {entity.priority > 0 && (
                    <Badge variant="outline" className="text-xs">أولوية: {entity.priority}</Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <code className="px-2 py-1 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 truncate max-w-[150px]">
                    {entity.originalText}
                  </code>
                  <ArrowRightLeft className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <code className="px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 truncate max-w-[150px]">
                    {entity.replacementText}
                  </code>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-100 transition-opacity">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800" onClick={() => onEdit(entity)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>تعديل</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800" onClick={() => onDelete(entity.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>حذف</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function ContextList({ items, onEdit, onDelete, searchQuery }: { 
  items: any[]; 
  onEdit: (item: any) => void; 
  onDelete: (id: number) => void;
  searchQuery: string;
}) {
  const filtered = items.filter((item: any) => 
    !searchQuery || 
    item.instructions?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Shield className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>لا توجد قواعد سياق</p>
        <p className="text-sm mt-1">أضف قاعدة جديدة للبدء</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filtered.map((rule: any) => (
        <div key={rule.id} className={`group flex items-start gap-4 p-4 rounded-xl border bg-card hover:shadow-md transition-all ${!rule.isActive ? 'opacity-60' : ''}`}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge className="gap-1">
                {contextRuleTypes.find(t => t.value === rule.ruleType)?.label}
              </Badge>
              <Badge variant="outline">
                {rule.targetSentiment}
              </Badge>
              {rule.priority > 0 && (
                <Badge variant="outline" className="text-xs">أولوية: {rule.priority}</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">{rule.instructions}</p>
          </div>
          <div className="flex items-center gap-1 opacity-100 transition-opacity">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800" onClick={() => onEdit(rule)}>
                  <Edit className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>تعديل</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800" onClick={() => onDelete(rule.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>حذف</TooltipContent>
            </Tooltip>
          </div>
        </div>
      ))}
    </div>
  );
}

function TrainingList({ items, onEdit, onDelete, searchQuery }: { 
  items: any[]; 
  onEdit: (item: any) => void; 
  onDelete: (id: number) => void;
  searchQuery: string;
}) {
  const filtered = items.filter((item: any) => 
    !searchQuery || 
    item.inputText?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.expectedOutput?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Brain className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>لا توجد أمثلة تدريب</p>
        <p className="text-sm mt-1">أضف مثال جديد للبدء</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filtered.map((example: any) => (
        <div key={example.id} className={`group flex items-start gap-4 p-4 rounded-xl border bg-card hover:shadow-md transition-all ${!example.isActive ? 'opacity-60' : ''}`}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">
                {exampleTypes.find(t => t.value === example.exampleType)?.label}
              </Badge>
              {example.useCount > 0 && (
                <span className="text-xs text-muted-foreground">استُخدم {example.useCount} مرة</span>
              )}
            </div>
            <div className="space-y-2">
              <div className="text-sm">
                <span className="text-muted-foreground text-xs">المُدخل: </span>
                <span className="line-clamp-1">{example.inputText}</span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground text-xs">المخرج: </span>
                <span className="line-clamp-1 text-green-600">{example.expectedOutput}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-100 transition-opacity">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800" onClick={() => onEdit(example)}>
                  <Edit className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>تعديل</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800" onClick={() => onDelete(example.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>حذف</TooltipContent>
            </Tooltip>
          </div>
        </div>
      ))}
    </div>
  );
}

function FilterList({ items, onEdit, onDelete, searchQuery }: { 
  items: any[]; 
  onEdit: (item: any) => void; 
  onDelete: (id: number) => void;
  searchQuery: string;
}) {
  const filtered = items.filter((item: any) => 
    !searchQuery || 
    item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.pattern?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Filter className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>لا توجد فلاتر محتوى</p>
        <p className="text-sm mt-1">أضف فلتر جديد للبدء</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filtered.map((filter: any) => (
        <div key={filter.id} className={`group flex items-start gap-4 p-4 rounded-xl border bg-card hover:shadow-md transition-all ${!filter.isActive ? 'opacity-60' : ''}`}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="font-medium">{filter.name}</span>
              <Badge variant={filter.filterType === 'block' ? 'destructive' : filter.filterType === 'allow' ? 'default' : 'secondary'}>
                {filterTypes.find(t => t.value === filter.filterType)?.label}
              </Badge>
              <Badge variant="outline">
                {matchTypes.find(t => t.value === filter.matchType)?.label}
              </Badge>
              <Badge variant="outline">
                {filterActions.find(t => t.value === filter.action)?.label}
              </Badge>
            </div>
            <code className="text-xs bg-muted px-2 py-1 rounded font-mono" dir="ltr">{filter.pattern}</code>
          </div>
          <div className="flex items-center gap-1 opacity-100 transition-opacity">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800" onClick={() => onEdit(filter)}>
                  <Edit className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>تعديل</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800" onClick={() => onDelete(filter.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>حذف</TooltipContent>
            </Tooltip>
          </div>
        </div>
      ))}
    </div>
  );
}

function TemplateList({ items, onEdit, onDelete, searchQuery }: { 
  items: any[]; 
  onEdit: (item: any) => void; 
  onDelete: (id: number) => void;
  searchQuery: string;
}) {
  const filtered = items.filter((item: any) => 
    !searchQuery || 
    item.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>لا توجد قوالب نشر</p>
        <p className="text-sm mt-1">أنشئ قالب جديد للبدء</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filtered.map((template: any) => (
        <div key={template.id} className="group flex items-start gap-4 p-4 rounded-xl border bg-card hover:shadow-md transition-all">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="font-medium">{template.name}</span>
              <Badge variant="outline">
                {templateTypes.find(t => t.value === template.templateType)?.label}
              </Badge>
              {template.isDefault && (
                <Badge className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30">افتراضي</Badge>
              )}
              {template.customFields?.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {template.customFields.length} حقل
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              {template.headerText && <span>رأس: {template.headerText.substring(0, 20)}...</span>}
              {template.footerText && <span>تذييل: {template.footerText.substring(0, 20)}...</span>}
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-100 transition-opacity">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800" onClick={() => onEdit(template)}>
                  <Edit className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>تعديل</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800" onClick={() => onDelete(template.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>حذف</TooltipContent>
            </Tooltip>
          </div>
        </div>
      ))}
    </div>
  );
}