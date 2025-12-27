import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Archive,
  MessageSquare,
  Calendar as CalendarIcon,
  Pin,
  Flag,
  Search,
  Filter,
  ExternalLink,
  Edit,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  Loader,
  TrendingUp,
  TrendingDown,
  Clock,
  X,
  Save,
  RefreshCw,
  FileText,
  MapPin,
  Tag,
  User,
  Newspaper,
  Hash,
  LayoutGrid,
  LayoutList,
  Download,
  Printer,
  Share2,
  Copy,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Sparkles,
  Zap,
  BookOpen,
  FolderOpen,
  ArrowUpRight,
  ArrowDownRight,
  CheckCheck,
  XCircle,
  MoreHorizontal,
  Image,
  Video,
  FileAudio,
  File,
  Star,
  Activity,
  Volume2,
  Play,
  Pause,
  StopCircle,
  Settings,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfDay, endOfDay, subDays, startOfWeek, endOfWeek, differenceInDays, parseISO } from "date-fns";
import { ar } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip as RechartsTooltip, BarChart, Bar } from "recharts";
import { startOfMonth, endOfMonth } from "date-fns";

interface ArchiveMessage {
  id: number;
  taskId: number;
  serialNumber: number;
  title: string | null;
  originalText: string | null;
  processedText: string | null;
  publishedText: string | null;
  telegraphUrl: string | null;
  telegraphTitle: string | null;
  classification: string | null;
  newsType: string | null;
  province: string | null;
  specialist: string | null;
  tags: string[] | null;
  extractedFields: any | null;
  hasMedia: boolean;
  mediaType: string | null;
  mediaCount: number | null;
  status: string;
  isPinned: boolean;
  isFlagged: boolean;
  flagReason: string | null;
  notes: string | null;
  sourceChannelTitle: string | null;
  targetChannelTitle: string | null;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
}

interface ArchiveFilters {
  taskId?: number;
  search: string;
  classification: string;
  province: string;
  newsType: string;
  specialist: string;
  sourceChannelTitle: string;
  dateFrom: string;
  dateTo: string;
  isPinned?: boolean;
  isFlagged?: boolean;
  hasMedia?: boolean;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

type ViewMode = 'list' | 'grid' | 'compact';

const ITEMS_PER_PAGE = 20;
const STORAGE_KEY = 'archive-filters';

export default function ArchivePage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showAdvancedStats, setShowAdvancedStats] = useState(false);

  // TTS States
  const [ttsDialogOpen, setTtsDialogOpen] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState("Nasser-PlayAI");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [ttsMessage, setTtsMessage] = useState<ArchiveMessage | null>(null);

  // HTML Export States
  const [htmlExportDialogOpen, setHtmlExportDialogOpen] = useState(false);
  const [htmlExportType, setHtmlExportType] = useState<'day' | 'range' | 'month'>('day');
  const [htmlExportDate, setHtmlExportDate] = useState<Date>(new Date());
  const [htmlExportDateFrom, setHtmlExportDateFrom] = useState<Date>(new Date());
  const [htmlExportDateTo, setHtmlExportDateTo] = useState<Date>(new Date());
  const [htmlExportMonth, setHtmlExportMonth] = useState<Date>(new Date());
  const [htmlExportLoading, setHtmlExportLoading] = useState(false);
  const [htmlDatePickerOpen, setHtmlDatePickerOpen] = useState<'day' | 'from' | 'to' | 'month' | null>(null);

  const [filters, setFilters] = useState<ArchiveFilters>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return getDefaultFilters();
      }
    }
    return getDefaultFilters();
  });

  const [showFilters, setShowFilters] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<ArchiveMessage | null>(null);
  const [previewMessageId, setPreviewMessageId] = useState<number | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [clearArchiveDialogOpen, setClearArchiveDialogOpen] = useState(false);
  const [messageToDelete, setMessageToDelete] = useState<ArchiveMessage | null>(null);
  const [editForm, setEditForm] = useState({ 
    title: '',
    classification: '',
    newsType: '',
    province: '',
    specialist: '',
    originalText: '',
    summary: '',
    sourceChannelTitle: ''
  });
  const [datePickerOpen, setDatePickerOpen] = useState<'from' | 'to' | null>(null);
  const [searchDebounce, setSearchDebounce] = useState('');

  function getDefaultFilters(): ArchiveFilters {
    return {
      search: '',
      classification: '',
      province: '',
      newsType: '',
      specialist: '',
      sourceChannelTitle: '',
      dateFrom: '',
      dateTo: '',
      sortBy: 'createdAt',
      sortOrder: 'desc'
    };
  }

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(f => ({ ...f, search: searchDebounce }));
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchDebounce]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditDialogOpen(false);
        setSelectedIds(new Set());
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowFilters(true);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && selectedIds.size > 0) {
        e.preventDefault();
        setSelectAll(!selectAll);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectAll, selectedIds]);

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => api.getTasks(),
  });

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["archive-stats", filters.taskId],
    queryFn: () => api.getArchiveStats(filters.taskId),
    refetchInterval: 30000,
  });

  const { data: filterOptions } = useQuery({
    queryKey: ["archive-filter-options", filters.taskId],
    queryFn: () => api.getArchiveFilterOptions(filters.taskId),
  });

  const { data: ttsVoices } = useQuery({
    queryKey: ["tts-voices"],
    queryFn: () => api.getTTSVoices(),
  });

  const { data: ttsStatus } = useQuery({
    queryKey: ["tts-status"],
    queryFn: () => api.getTTSStatus(),
  });

  const textToSpeechMutation = useMutation({
    mutationFn: ({ text, voice }: { text: string; voice: string }) => 
      api.textToSpeech(text, voice),
    onSuccess: (data) => {
      if (data.needsApiKey) {
        toast.error("يجب تكوين GROQ_API_KEY في متغيرات البيئة");
        return;
      }

      // Convert base64 to audio URL
      const audioBlob = new Blob(
        [Uint8Array.from(atob(data.audio), c => c.charCodeAt(0))],
        { type: 'audio/mpeg' }
      );
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);

      // Create audio element
      const audio = new Audio(url);
      audio.onended = () => setIsPlaying(false);
      setAudioElement(audio);

      toast.success("تم توليد الصوت بنجاح");
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل توليد الصوت");
    },
  });

  const { data: archiveData, isLoading: loadingArchive, refetch: refetchArchive } = useQuery({
    queryKey: ["archive-messages", filters, page],
    queryFn: () => api.getArchiveMessages({
      ...filters,
      taskId: filters.taskId,
      limit: ITEMS_PER_PAGE,
      offset: (page - 1) * ITEMS_PER_PAGE,
    }),
  });

  const messages = archiveData?.messages || [];
  const totalMessages = archiveData?.total || 0;
  const totalPages = Math.ceil(totalMessages / ITEMS_PER_PAGE);

  const activityData = useMemo(() => {
    if (!stats?.recentActivity) return [];
    return stats.recentActivity.slice(0, 7).reverse().map((item: any) => ({
      date: format(parseISO(item.date), 'EEE', { locale: ar }),
      count: item.count,
      fullDate: item.date
    }));
  }, [stats]);

  const updateMessageMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => api.updateArchiveMessage(id, data),
    onSuccess: () => {
      toast.success("تم تحديث الرسالة بنجاح");
      queryClient.invalidateQueries({ queryKey: ["archive-messages"] });
      setEditDialogOpen(false);
    },
    onError: () => {
      toast.error("فشل تحديث الرسالة");
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: (id: number) => api.deleteArchiveMessage(id),
    onSuccess: () => {
      toast.success("تم حذف الرسالة");
      queryClient.invalidateQueries({ queryKey: ["archive-messages"] });
      queryClient.invalidateQueries({ queryKey: ["archive-stats"] });
      setDeleteDialogOpen(false);
      setMessageToDelete(null);
    },
    onError: () => {
      toast.error("فشل حذف الرسالة");
    },
  });

  const togglePinMutation = useMutation({
    mutationFn: (id: number) => api.toggleArchivePin(id),
    onSuccess: (data) => {
      toast.success(data.isPinned ? "تم تثبيت الرسالة" : "تم إلغاء تثبيت الرسالة");
      queryClient.invalidateQueries({ queryKey: ["archive-messages"] });
      queryClient.invalidateQueries({ queryKey: ["archive-stats"] });
    },
  });

  const toggleFlagMutation = useMutation({
    mutationFn: (id: number) => api.toggleArchiveFlag(id),
    onSuccess: (data) => {
      toast.success(data.isFlagged ? "تم تعليم الرسالة" : "تم إلغاء تعليم الرسالة");
      queryClient.invalidateQueries({ queryKey: ["archive-messages"] });
      queryClient.invalidateQueries({ queryKey: ["archive-stats"] });
    },
  });

  const clearArchiveMutation = useMutation({
    mutationFn: (taskId?: number) => api.clearArchive(taskId),
    onSuccess: () => {
      toast.success("تم تفريغ الأرشيف وتصفير رقم القيد بنجاح");
      queryClient.invalidateQueries({ queryKey: ["archive-messages"] });
      queryClient.invalidateQueries({ queryKey: ["archive-stats"] });
      setClearArchiveDialogOpen(false);
      setPage(1);
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل تفريغ الأرشيف");
    },
  });

  const handleTogglePreview = (message: ArchiveMessage) => {
    if (previewMessageId === message.id) {
      setPreviewMessageId(null);
      setSelectedMessage(null);
    } else {
      setPreviewMessageId(message.id);
      setSelectedMessage(message);
    }
  };

  const handleOpenEdit = (message: ArchiveMessage) => {
    setSelectedMessage(message);
    const ef = message.extractedFields || {};
    setEditForm({
      title: message.title || ef.title || ef.العنوان || '',
      classification: message.classification || ef.category || ef.التصنيف || ef.classification || '',
      newsType: message.newsType || ef.news_type || ef.نوع_الخبر || ef.newsType || '',
      province: message.province || ef.governorate || ef.المحافظة || ef.province || '',
      specialist: message.specialist || ef.specialist || ef.المختص || '',
      originalText: message.originalText || '',
      summary: ef.summary || ef.ملخص || ef.التلخيص || message.processedText || '',
      sourceChannelTitle: message.sourceChannelTitle || ef.source_channel_title || ef.المصدر || ''
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selectedMessage) return;
    updateMessageMutation.mutate({
      id: selectedMessage.id,
      data: editForm
    });
  };

  const handleOpenDelete = (message: ArchiveMessage) => {
    setMessageToDelete(message);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!messageToDelete) return;
    deleteMessageMutation.mutate(messageToDelete.id);
  };

  const handleBulkDelete = async () => {
    const idsToDelete = Array.from(selectedIds);
    for (const id of idsToDelete) {
      await api.deleteArchiveMessage(id);
    }
    toast.success(`تم حذف ${idsToDelete.length} رسالة`);
    setSelectedIds(new Set());
    setBulkDeleteDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ["archive-messages"] });
    queryClient.invalidateQueries({ queryKey: ["archive-stats"] });
  };

  const handleBulkPin = async () => {
    const idsToPin = Array.from(selectedIds);
    for (const id of idsToPin) {
      await api.toggleArchivePin(id);
    }
    toast.success(`تم تثبيت ${idsToPin.length} رسالة`);
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ["archive-messages"] });
  };

  const handleBulkFlag = async () => {
    const idsToFlag = Array.from(selectedIds);
    for (const id of idsToFlag) {
      await api.toggleArchiveFlag(id);
    }
    toast.success(`تم تعليم ${idsToFlag.length} رسالة`);
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ["archive-messages"] });
  };

  const handleCopyText = async (text: string, id: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("تم نسخ النص");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportCSV = () => {
    const headers = ['رقم القيد', 'العنوان', 'التصنيف', 'المحافظة', 'نوع الخبر', 'التاريخ', 'المصدر'];
    const rows = messages.map(m => [
      m.serialNumber,
      m.title || '',
      m.classification || '',
      m.province || '',
      m.newsType || '',
      format(new Date(m.createdAt), 'yyyy-MM-dd HH:mm'),
      m.sourceChannelTitle || ''
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `archive-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    toast.success("تم تصدير البيانات");
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportHTML = async () => {
    setHtmlExportLoading(true);
    try {
      let dateFrom: string;
      let dateTo: string;
      let periodLabel: string;

      if (htmlExportType === 'day') {
        dateFrom = format(htmlExportDate, 'yyyy-MM-dd');
        dateTo = format(htmlExportDate, 'yyyy-MM-dd');
        periodLabel = format(htmlExportDate, 'dd MMMM yyyy', { locale: ar });
      } else if (htmlExportType === 'range') {
        dateFrom = format(startOfDay(htmlExportDateFrom), 'yyyy-MM-dd');
        dateTo = format(endOfDay(htmlExportDateTo), 'yyyy-MM-dd');
        periodLabel = `${format(htmlExportDateFrom, 'dd/MM/yyyy')} - ${format(htmlExportDateTo, 'dd/MM/yyyy')}`;
      } else {
        dateFrom = format(startOfMonth(htmlExportMonth), 'yyyy-MM-dd');
        dateTo = format(endOfMonth(htmlExportMonth), 'yyyy-MM-dd');
        periodLabel = format(htmlExportMonth, 'MMMM yyyy', { locale: ar });
      }

      const response = await api.getArchiveMessages({
        taskId: filters.taskId,
        dateFrom,
        dateTo,
        classification: filters.classification,
        province: filters.province,
        newsType: filters.newsType,
        specialist: filters.specialist,
        search: filters.search,
        sortBy: 'serialNumber',
        sortOrder: 'asc',
        limit: 1000,
        offset: 0
      });

      const exportMessages = response?.messages || [];
      
      if (!exportMessages || exportMessages.length === 0) {
        toast.error("لا توجد رسائل في الفترة المحددة");
        setHtmlExportDialogOpen(false);
        setHtmlExportLoading(false);
        return;
      }

      // Create HTML content with compact view style
      let htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تقرير الأرشيف</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background-color: #f8fafc;
      direction: rtl;
      text-align: right;
    }
    body {
      padding: 20px;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 20px;
    }
    h1 {
      font-size: 28px;
      color: #1e293b;
      margin-bottom: 10px;
      font-weight: 700;
    }
    .period-info {
      font-size: 14px;
      color: #475569;
      margin: 5px 0;
    }
    .messages-container {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 20px;
    }
    .message-card {
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      background: white;
      transition: all 0.2s;
      overflow: hidden;
    }
    .message-card:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }
    .message-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border-bottom: 1px solid #f1f5f9;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    .message-header:hover {
      background-color: #f9fafb;
    }
    .serial-badge {
      background-color: #f1f5f9;
      border: 1px solid #cbd5e1;
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: 600;
      font-size: 12px;
      font-family: 'Courier New', monospace;
      flex-shrink: 0;
      min-width: 50px;
      text-align: center;
      color: #1e293b;
    }
    .message-title {
      flex: 1;
      font-weight: 600;
      font-size: 14px;
      color: #1e293b;
      word-break: break-word;
    }
    .message-date {
      font-size: 12px;
      color: #64748b;
      flex-shrink: 0;
    }
    .message-content {
      padding: 16px;
      background-color: #f9fafb;
      border-top: 1px solid #f1f5f9;
    }
    .message-text {
      font-size: 13px;
      color: #475569;
      line-height: 1.6;
      word-break: break-word;
      white-space: pre-wrap;
      max-height: 300px;
      overflow-y: auto;
      margin-bottom: 12px;
      padding: 12px;
      background: white;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }
    .badges-container {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .badge {
      display: inline-block;
      background-color: #e2e8f0;
      color: #1e293b;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      border: 1px solid #cbd5e1;
    }
    .badge.primary {
      background-color: #dbeafe;
      border-color: #93c5fd;
      color: #1e40af;
    }
    .badge.outline {
      background-color: white;
      border-color: #cbd5e1;
      color: #475569;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      color: #64748b;
      font-size: 12px;
    }
    .message-meta {
      font-size: 12px;
      color: #64748b;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
    }
    @media print {
      body {
        padding: 0;
        background: white;
      }
      .container {
        box-shadow: none;
        padding: 20px;
      }
      .message-card {
        page-break-inside: avoid;
        break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>تقرير الأرشيف</h1>
      <div class="period-info">الفترة: ${periodLabel}</div>
      <div class="period-info">عدد الرسائل: ${exportMessages.length}</div>
    </div>
    
    <div class="messages-container">
      ${exportMessages.map((msg, idx) => `
        <div class="message-card" data-msg-id="${idx}">
          <div class="message-header" style="cursor: pointer;" onclick="toggleMessage(this)">
            <div class="serial-badge">#${msg.serialNumber}</div>
            <div class="message-title">${msg.title || 'بدون عنوان'}</div>
            <div class="message-date">${format(new Date(msg.createdAt), 'MM/dd', { locale: ar })}</div>
          </div>
          <div class="message-content" style="display: none;">
            <div class="message-text">${msg.processedText || msg.originalText || 'لا يوجد محتوى'}</div>
            ${msg.originalText && msg.originalText !== (msg.processedText || msg.originalText) ? `
              <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0;">
                <div style="font-size: 12px; color: #64748b; margin-bottom: 6px; font-weight: 500;">النص الأصلي:</div>
                <div style="font-size: 12px; color: #475569; line-height: 1.6; word-break: break-word; white-space: pre-wrap; padding: 10px; background: white; border: 1px solid #e2e8f0; border-radius: 4px; max-height: 200px; overflow-y: auto;">
                  ${msg.originalText}
                </div>
              </div>
            ` : ''}
            <div class="badges-container">
              ${msg.classification ? `<div class="badge primary">${msg.classification}</div>` : ''}
              ${msg.newsType ? `<div class="badge outline">${msg.newsType}</div>` : ''}
              ${msg.province ? `<div class="badge outline">${msg.province}</div>` : ''}
              ${msg.sourceChannelTitle ? `<div class="badge outline">${msg.sourceChannelTitle}</div>` : ''}
            </div>
            <div class="message-meta">
              <span>${format(new Date(msg.createdAt), 'PPpp', { locale: ar })}</span>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
    
    <script>
      function toggleMessage(headerElement) {
        const card = headerElement.closest('.message-card');
        const content = card.querySelector('.message-content');
        const isVisible = content.style.display !== 'none';
        content.style.display = isVisible ? 'none' : 'block';
        card.style.borderColor = !isVisible ? '#2563eb' : '#e2e8f0';
      }
    </script>
    
    <div class="footer">
      تم التصدير: ${format(new Date(), 'yyyy-MM-dd HH:mm')}
    </div>
  </div>
</body>
</html>`;

      // Create and download HTML file
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `archive-report-${format(new Date(), 'yyyy-MM-dd-HHmm')}.html`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success(`تم تصدير ${exportMessages.length} رسالة بنجاح`);
      setHtmlExportDialogOpen(false);
    } catch (error) {
      console.error('HTML export error:', error);
      toast.error("حدث خطأ أثناء تصدير HTML");
    } finally {
      setHtmlExportLoading(false);
    }
  };

  const handleOpenTTS = (message: ArchiveMessage) => {
    setTtsMessage(message);
    setTtsDialogOpen(true);

    // Clean up previous audio
    if (audioElement) {
      audioElement.pause();
      audioElement.src = '';
    }
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(null);
    setIsPlaying(false);
  };

  const handleGenerateSpeech = () => {
    if (!ttsMessage) return;

    const text = ttsMessage.processedText || ttsMessage.originalText || '';
    if (!text || text.trim().length === 0) {
      toast.error("لا يوجد نص للقراءة");
      return;
    }

    // Limit to 4000 characters
    const trimmedText = text.slice(0, 4000);
    if (text.length > 4000) {
      toast.info("تم اقتصاص النص إلى 4000 حرف");
    }

    // Save preferred voice
    localStorage.setItem('preferred-tts-voice', selectedVoice);

    textToSpeechMutation.mutate({ text: trimmedText, voice: selectedVoice });
  };

  const handlePlayPause = () => {
    if (!audioElement) return;

    if (isPlaying) {
      audioElement.pause();
      setIsPlaying(false);
    } else {
      audioElement.play();
      setIsPlaying(true);
    }
  };

  const handleStopAudio = () => {
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
      setIsPlaying(false);
    }
  };

  const handleDownloadAudio = () => {
    if (!audioUrl) return;

    const link = document.createElement('a');
    link.href = audioUrl;
    link.download = `archive-${ttsMessage?.serialNumber || 'audio'}.mp3`;
    link.click();
    toast.success("تم تحميل الملف الصوتي");
  };

  const toggleSelectMessage = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(messages.map(m => m.id)));
    }
    setSelectAll(!selectAll);
  };

  const setQuickFilter = (type: 'today' | 'week' | 'month' | 'pinned' | 'flagged' | 'media') => {
    const today = new Date();
    switch (type) {
      case 'today':
        setFilters(f => ({
          ...f,
          dateFrom: format(startOfDay(today), 'yyyy-MM-dd'),
          dateTo: format(endOfDay(today), 'yyyy-MM-dd'),
          isPinned: undefined,
          isFlagged: undefined,
          hasMedia: undefined
        }));
        break;
      case 'week':
        setFilters(f => ({
          ...f,
          dateFrom: format(startOfWeek(today, { locale: ar }), 'yyyy-MM-dd'),
          dateTo: format(endOfWeek(today, { locale: ar }), 'yyyy-MM-dd'),
          isPinned: undefined,
          isFlagged: undefined,
          hasMedia: undefined
        }));
        break;
      case 'month':
        setFilters(f => ({
          ...f,
          dateFrom: format(subDays(today, 30), 'yyyy-MM-dd'),
          dateTo: format(today, 'yyyy-MM-dd'),
          isPinned: undefined,
          isFlagged: undefined,
          hasMedia: undefined
        }));
        break;
      case 'pinned':
        setFilters(f => ({
          ...f,
          isPinned: true,
          isFlagged: undefined,
          hasMedia: undefined,
          dateFrom: '',
          dateTo: ''
        }));
        break;
      case 'flagged':
        setFilters(f => ({
          ...f,
          isFlagged: true,
          isPinned: undefined,
          hasMedia: undefined,
          dateFrom: '',
          dateTo: ''
        }));
        break;
      case 'media':
        setFilters(f => ({
          ...f,
          hasMedia: true,
          isPinned: undefined,
          isFlagged: undefined
        }));
        break;
    }
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(getDefaultFilters());
    setSearchDebounce('');
    setPage(1);
  };

  const getMediaIcon = (type: string | null) => {
    switch (type) {
      case 'photo': return Image;
      case 'video': return Video;
      case 'audio': return FileAudio;
      default: return File;
    }
  };

  const getTaskName = (taskId: number) => {
    const task = tasks.find((t: any) => t.id === taskId);
    return task?.name || `مهمة #${taskId}`;
  };

  const todayChange = useMemo(() => {
    if (!stats?.recentActivity || stats.recentActivity.length < 2) return 0;
    const today = stats.recentActivity[0]?.count || 0;
    const yesterday = stats.recentActivity[1]?.count || 0;
    if (yesterday === 0) return today > 0 ? 100 : 0;
    return Math.round(((today - yesterday) / yesterday) * 100);
  }, [stats]);

  const statCards = [
    {
      title: "إجمالي الرسائل",
      value: stats?.totalMessages || 0,
      icon: Archive,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-gradient-to-br from-blue-500/20 to-blue-600/10",
      borderColor: "border-blue-500/20",
      trend: null,
      onClick: () => clearFilters()
    },
    {
      title: "رسائل اليوم",
      value: stats?.todayMessages || 0,
      icon: Zap,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-gradient-to-br from-emerald-500/20 to-emerald-600/10",
      borderColor: "border-emerald-500/20",
      trend: todayChange,
      onClick: () => setQuickFilter('today')
    },
    {
      title: "المثبتة",
      value: stats?.pinnedMessages || 0,
      icon: Star,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-gradient-to-br from-amber-500/20 to-amber-600/10",
      borderColor: "border-amber-500/20",
      trend: null,
      onClick: () => setQuickFilter('pinned')
    },
    {
      title: "المُعلَّمة",
      value: stats?.flaggedMessages || 0,
      icon: AlertCircle,
      color: "text-rose-600 dark:text-rose-400",
      bgColor: "bg-gradient-to-br from-rose-500/20 to-rose-600/10",
      borderColor: "border-rose-500/20",
      trend: null,
      onClick: () => setQuickFilter('flagged')
    }
  ];

  if (loadingStats && loadingArchive) {
    return (
      <div className="flex flex-col items-center justify-center p-12 gap-4">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
          <Loader className="h-12 w-12 animate-spin text-primary relative" />
        </div>
        <p className="text-muted-foreground animate-pulse">جاري تحميل الأرشيف...</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-6 print:space-y-4" dir="rtl">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="text-right">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3"
            >
              <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
                <Archive className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground tracking-wide">
                  أرشيف الرسائل
                </h2>
                <p className="text-muted-foreground mt-0.5 text-sm flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5" />
                  {totalMessages.toLocaleString('ar-EG')} رسالة مؤرشفة
                  {filters.taskId && (
                    <Badge variant="secondary" className="mr-2">
                      {getTaskName(filters.taskId)}
                    </Badge>
                  )}
                </p>
              </div>
            </motion.div>
          </div>

          {/* Toolbar */}
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap items-center gap-2 print:hidden"
          >
            {/* View Mode Toggle */}
            <div className="flex items-center border rounded-lg p-1 bg-muted/50">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => setViewMode('list')}
                  >
                    <LayoutList className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>عرض القائمة</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => setViewMode('grid')}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>عرض الشبكة</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === 'compact' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => setViewMode('compact')}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>عرض مضغوط</TooltipContent>
              </Tooltip>
            </div>

            <Separator orientation="vertical" className="h-8" />

            {/* Action Buttons */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setClearArchiveDialogOpen(true)}
                  className="gap-2 text-red-500 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="hidden sm:inline">تفريغ الأرشيف</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>تفريغ الأرشيف وتصفير رقم القيد</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCSV}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">CSV</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>تصدير CSV</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setHtmlExportDialogOpen(true)}
                  className="gap-2"
                >
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">HTML</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>تصدير HTML</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  className="gap-2"
                >
                  <Printer className="h-4 w-4" />
                  <span className="hidden sm:inline">طباعة</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>طباعة</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchArchive()}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span className="hidden sm:inline">تحديث</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>تحديث البيانات</TooltipContent>
            </Tooltip>

            <Button
              variant={showFilters ? "default" : "outline"}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              الفلاتر
              {Object.values(filters).some(v => v && v !== 'createdAt' && v !== 'desc') && (
                <Badge variant="secondary" className="mr-1 h-5 px-1.5">
                  {Object.values(filters).filter(v => v && v !== 'createdAt' && v !== 'desc').length}
                </Badge>
              )}
            </Button>
          </motion.div>
        </div>

        {/* Stats Cards with Charts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((stat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card 
                className={cn(
                  "border cursor-pointer transition-all duration-300 overflow-hidden group",
                  stat.borderColor,
                  "hover:shadow-lg hover:shadow-primary/5"
                )}
                onClick={stat.onClick}
              >
                <CardContent className={cn("p-4 relative", stat.bgColor)}>
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative">
                    <div className="flex justify-between items-start mb-3">
                      <div className={cn("p-2.5 rounded-xl bg-background/80 shadow-sm")}>
                        <stat.icon className={cn("h-5 w-5", stat.color)} />
                      </div>
                      {stat.trend !== null && (
                        <div className={cn(
                          "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
                          stat.trend >= 0 
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                            : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                        )}>
                          {stat.trend >= 0 ? (
                            <ArrowUpRight className="h-3 w-3" />
                          ) : (
                            <ArrowDownRight className="h-3 w-3" />
                          )}
                          {Math.abs(stat.trend)}%
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                        {stat.title}
                      </p>
                      <h3 className="text-3xl font-bold text-foreground mt-1 tabular-nums">
                        {stat.value.toLocaleString('ar-EG')}
                      </h3>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Activity Chart */}
        {activityData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="border shadow-sm overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">نشاط الأرشيف</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAdvancedStats(!showAdvancedStats)}
                  >
                    {showAdvancedStats ? 'إخفاء' : 'عرض المزيد'}
                  </Button>
                </div>
                <CardDescription>
                  آخر 7 أيام من النشاط
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-[120px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={activityData}>
                      <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis 
                        dataKey="date" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                      />
                      <RechartsTooltip 
                        contentStyle={{ 
                          background: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                          fontSize: '12px'
                        }}
                        formatter={(value: number) => [value, 'رسائل']}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="count" 
                        stroke="hsl(var(--primary))" 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorCount)" 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Bulk Actions Bar */}
        {/* Clear Archive Confirmation */}
      <AlertDialog open={clearArchiveDialogOpen} onOpenChange={setClearArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right">هل أنت متأكد من تفريغ الأرشيف؟</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              سيتم حذف جميع الرسائل في الأرشيف وتصفير رقم القيد ليعود إلى الصفر. هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction 
              onClick={() => clearArchiveMutation.mutate(filters.taskId)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              تأكيد الحذف
            </AlertDialogAction>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="sticky top-0 z-20"
            >
              <Card className="border-primary/50 bg-primary/5 shadow-lg">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <Badge variant="default" className="px-3 py-1">
                        {selectedIds.size} محدد
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedIds(new Set())}
                      >
                        <X className="h-4 w-4 ml-1" />
                        إلغاء التحديد
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBulkPin}
                        className="gap-1"
                      >
                        <Pin className="h-4 w-4" />
                        تثبيت
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBulkFlag}
                        className="gap-1"
                      >
                        <Flag className="h-4 w-4" />
                        تعليم
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setBulkDeleteDialogOpen(true)}
                        className="gap-1"
                      >
                        <Trash2 className="h-4 w-4" />
                        حذف
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Filters Section */}
        {/* Clear Archive Confirmation */}
      <AlertDialog open={clearArchiveDialogOpen} onOpenChange={setClearArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-right">هل أنت متأكد من تفريغ الأرشيف؟</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              سيتم حذف جميع الرسائل في الأرشيف وتصفير رقم القيد ليعود إلى الصفر. هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction 
              onClick={() => clearArchiveMutation.mutate(filters.taskId)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              تأكيد الحذف
            </AlertDialogAction>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <Card className="border shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Filter className="h-5 w-5 text-primary" />
                      فلترة البحث
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={clearFilters}>
                        <X className="h-4 w-4 ml-1" />
                        مسح الفلاتر
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setShowFilters(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* First Row: Task, Search */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm mb-2 block">المهمة</Label>
                      <Select
                        value={filters.taskId?.toString() || "all"}
                        onValueChange={(v) => {
                          setFilters(f => ({ ...f, taskId: v === "all" ? undefined : parseInt(v) }));
                          setPage(1);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="جميع المهام" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">جميع المهام</SelectItem>
                          {tasks.map((task: any) => (
                            <SelectItem key={task.id} value={task.id.toString()}>
                              {task.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-sm mb-2 block">بحث</Label>
                      <div className="relative">
                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="البحث في العنوان والمحتوى... (Ctrl+F)"
                          value={searchDebounce}
                          onChange={(e) => setSearchDebounce(e.target.value)}
                          className="pr-10"
                        />
                        {searchDebounce && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                            onClick={() => setSearchDebounce('')}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Second Row: Date Range & Classification */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <Label className="text-sm mb-2 block">من تاريخ</Label>
                      <Popover open={datePickerOpen === 'from'} onOpenChange={(open) => setDatePickerOpen(open ? 'from' : null)}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-right font-normal">
                            <CalendarIcon className="ml-2 h-4 w-4" />
                            {filters.dateFrom ? format(new Date(filters.dateFrom), 'PPP', { locale: ar }) : 'اختر تاريخ'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={filters.dateFrom ? new Date(filters.dateFrom) : undefined}
                            onSelect={(date) => {
                              setFilters(f => ({ ...f, dateFrom: date ? format(date, 'yyyy-MM-dd') : '' }));
                              setDatePickerOpen(null);
                              setPage(1);
                            }}
                            locale={ar}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label className="text-sm mb-2 block">إلى تاريخ</Label>
                      <Popover open={datePickerOpen === 'to'} onOpenChange={(open) => setDatePickerOpen(open ? 'to' : null)}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start text-right font-normal">
                            <CalendarIcon className="ml-2 h-4 w-4" />
                            {filters.dateTo ? format(new Date(filters.dateTo), 'PPP', { locale: ar }) : 'اختر تاريخ'}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={filters.dateTo ? new Date(filters.dateTo) : undefined}
                            onSelect={(date) => {
                              setFilters(f => ({ ...f, dateTo: date ? format(date, 'yyyy-MM-dd') : '' }));
                              setDatePickerOpen(null);
                              setPage(1);
                            }}
                            locale={ar}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div>
                      <Label className="text-sm mb-2 block">التصنيف</Label>
                      <Select
                        value={filters.classification || "all"}
                        onValueChange={(v) => {
                          setFilters(f => ({ ...f, classification: v === "all" ? "" : v }));
                          setPage(1);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="الكل" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">الكل</SelectItem>
                          {filterOptions?.classifications?.map((c: string) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm mb-2 block">المحافظة</Label>
                      <Select
                        value={filters.province || "all"}
                        onValueChange={(v) => {
                          setFilters(f => ({ ...f, province: v === "all" ? "" : v }));
                          setPage(1);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="الكل" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">الكل</SelectItem>
                          {filterOptions?.provinces?.map((p: string) => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Third Row: More Filters & Sort */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm mb-2 block">نوع الخبر</Label>
                      <Select
                        value={filters.newsType || "all"}
                        onValueChange={(v) => {
                          setFilters(f => ({ ...f, newsType: v === "all" ? "" : v }));
                          setPage(1);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="الكل" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">الكل</SelectItem>
                          {filterOptions?.newsTypes?.map((n: string) => (
                            <SelectItem key={n} value={n}>{n}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm mb-2 block">المختص</Label>
                      <Select
                        value={filters.specialist || "all"}
                        onValueChange={(v) => {
                          setFilters(f => ({ ...f, specialist: v === "all" ? "" : v }));
                          setPage(1);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="الكل" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">الكل</SelectItem>
                          {filterOptions?.specialists?.map((s: string) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm mb-2 block">المصدر</Label>
                      <Select
                        value={filters.sourceChannelTitle || "all"}
                        onValueChange={(v) => {
                          setFilters(f => ({ ...f, sourceChannelTitle: v === "all" ? "" : v }));
                          setPage(1);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="الكل" />
                        </SelectTrigger>
                        <SelectContent>
    const classifications = filterOptions?.classifications || [];
    const provinces = filterOptions?.provinces || [];
    const newsTypes = filterOptions?.newsTypes || [];
    const specialists = filterOptions?.specialists || [];
    const sources = filterOptions?.sources || [];
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Sort Options */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
                    <div>
                      <Label className="text-sm mb-2 block">حقل الترتيب</Label>
                      <Select
                        value={filters.sortBy}
                        onValueChange={(v) => {
                          setFilters(f => ({ ...f, sortBy: v }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="createdAt">التاريخ</SelectItem>
                          <SelectItem value="serialNumber">رقم القيد</SelectItem>
                          <SelectItem value="title">العنوان</SelectItem>
                          <SelectItem value="classification">التصنيف</SelectItem>
                          <SelectItem value="newsType">نوع الخبر</SelectItem>
                          <SelectItem value="province">المحافظة</SelectItem>
                          <SelectItem value="specialist">المختص</SelectItem>
                          <SelectItem value="sourceChannelTitle">المصدر</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm mb-2 block">اتجاه الترتيب</Label>
                      <Select
                        value={filters.sortOrder}
                        onValueChange={(v) => {
                          setFilters(f => ({ ...f, sortOrder: v as 'asc' | 'desc' }));
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="asc">تصاعدي</SelectItem>
                          <SelectItem value="desc">تنازلي</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Quick Filters */}
                  <div className="flex flex-wrap gap-2 pt-3">
                    <span className="text-sm text-muted-foreground ml-2 self-center">فلاتر سريعة:</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickFilter('today')}
                      className="gap-1"
                    >
                      <Zap className="h-3 w-3" />
                      اليوم
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickFilter('week')}
                      className="gap-1"
                    >
                      <CalendarIcon className="h-3 w-3" />
                      هذا الأسبوع
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickFilter('month')}
                      className="gap-1"
                    >
                      <CalendarIcon className="h-3 w-3" />
                      آخر 30 يوم
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickFilter('pinned')}
                      className="gap-1"
                    >
                      <Star className="h-3 w-3" />
                      المثبتة
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickFilter('flagged')}
                      className="gap-1"
                    >
                      <Flag className="h-3 w-3" />
                      المُعلَّمة
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setQuickFilter('media')}
                      className="gap-1"
                    >
                      <Image className="h-3 w-3" />
                      مع وسائط
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Archive Messages List */}
        <div className="space-y-4">
          {loadingArchive ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : messages.length === 0 ? (
            <Card className="border shadow-sm">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="p-4 rounded-full bg-muted mb-4">
                  <FolderOpen className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">لا توجد رسائل</h3>
                <p className="text-muted-foreground text-sm max-w-sm">
                  لم يتم العثور على رسائل مطابقة للفلاتر المحددة. جرب تغيير معايير البحث.
                </p>
                {Object.values(filters).some(v => v && v !== 'createdAt' && v !== 'desc') && (
                  <Button variant="outline" className="mt-4" onClick={clearFilters}>
                    مسح الفلاتر
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Select All */}
              <div className="flex items-center gap-2 print:hidden">
                <Checkbox
                  checked={selectAll}
                  onCheckedChange={handleSelectAll}
                  id="select-all"
                />
                <Label htmlFor="select-all" className="text-sm text-muted-foreground cursor-pointer">
                  تحديد الكل ({messages.length})
                </Label>
              </div>

              {/* Messages Grid/List */}
              <div className={cn(
                "grid gap-4",
                viewMode === 'grid' && "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
                viewMode === 'compact' && "gap-2"
              )}>
                {messages.map((message, index) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    layout
                  >
                    {viewMode === 'compact' ? (
                      /* Compact View */
                      <Collapsible open={previewMessageId === message.id}>
                        <div className={cn(
                          "rounded-lg border bg-card transition-colors",
                          selectedIds.has(message.id) && "bg-primary/5 border-primary/30",
                          message.isPinned && "border-amber-500/30",
                          message.isFlagged && "border-rose-500/30",
                          previewMessageId === message.id && "ring-2 ring-primary"
                        )}>
                          <div className={cn(
                            "flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors cursor-pointer",
                            previewMessageId === message.id && "border-b"
                          )}
                          onClick={() => handleTogglePreview(message)}
                          >
                            <Checkbox
                              checked={selectedIds.has(message.id)}
                              onCheckedChange={() => toggleSelectMessage(message.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="print:hidden"
                            />
                            <Badge variant="outline" className="font-mono shrink-0">
                              {message.serialNumber}
                            </Badge>
                            <span className="flex-1 truncate text-sm font-medium">
                              {message.title || 'بدون عنوان'}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              {message.isPinned && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />}
                              {message.isFlagged && <Flag className="h-3.5 w-3.5 text-rose-500 fill-rose-500" />}
                            </div>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {format(new Date(message.createdAt), 'MM/dd', { locale: ar })}
                            </span>
                            <div className="flex items-center gap-1 shrink-0 print:hidden">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); handleTogglePreview(message); }}>
                                {previewMessageId === message.id ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); handleOpenEdit(message); }}>
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          <CollapsibleContent>
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.2 }}
                              className="p-4 space-y-3 bg-muted/20"
                            >
                              <div className="text-sm whitespace-pre-wrap leading-relaxed">
                                {message.processedText || message.originalText || 'لا يوجد محتوى'}
                              </div>
                              
                              {message.originalText && message.originalText !== message.processedText && (
                                <div className="pt-3 border-t">
                                  <Label className="text-xs text-muted-foreground mb-2 block">النص الأصلي:</Label>
                                  <div className="text-xs text-muted-foreground whitespace-pre-wrap max-h-32 overflow-y-auto bg-muted/30 p-2 rounded">
                                    {message.originalText}
                                  </div>
                                </div>
                              )}
                              
                              <div className="flex flex-wrap items-center gap-1.5 pt-2">
                                {message.classification && (
                                  <Badge variant="secondary" className="gap-1 text-xs">
                                    <Tag className="h-2.5 w-2.5" />
                                    {message.classification}
                                  </Badge>
                                )}
                                {message.province && (
                                  <Badge variant="outline" className="gap-1 text-xs">
                                    <MapPin className="h-2.5 w-2.5" />
                                    {message.province}
                                  </Badge>
                                )}
                                {message.newsType && (
                                  <Badge variant="outline" className="gap-1 text-xs">
                                    <Newspaper className="h-2.5 w-2.5" />
                                    {message.newsType}
                                  </Badge>
                                )}
                              </div>
                              
                              <div className="flex items-center justify-between pt-2 border-t">
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(message.createdAt), 'PPpp', { locale: ar })}
                                </span>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopyText(message.processedText || message.originalText || '', message.id);
                                    }}
                                  >
                                    <Copy className="h-3 w-3 ml-1" />
                                    نسخ
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={(e) => { e.stopPropagation(); handleOpenEdit(message); }}
                                  >
                                    <Edit className="h-3 w-3 ml-1" />
                                    تعديل
                                  </Button>
                                </div>
                              </div>
                            </motion.div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    ) : (
                      /* List/Grid View */
                      <Card className={cn(
                        "border shadow-sm hover:shadow-md transition-all group overflow-hidden",
                        selectedIds.has(message.id) && "ring-2 ring-primary/50 bg-primary/5",
                        message.isPinned && "border-amber-500/50 bg-gradient-to-r from-amber-500/5 to-transparent",
                        message.isFlagged && "border-rose-500/50 bg-gradient-to-r from-rose-500/5 to-transparent",
                        previewMessageId === message.id && "ring-2 ring-primary"
                      )}>
                        <Collapsible open={previewMessageId === message.id}>
                          <CardContent className="p-4">
                            <div className="flex flex-col gap-3">
                              {/* Header Row */}
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3">
                                  <Checkbox
                                    checked={selectedIds.has(message.id)}
                                    onCheckedChange={() => toggleSelectMessage(message.id)}
                                    className="print:hidden"
                                  />
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge 
                                        variant="outline" 
                                        className="text-base font-mono px-3 py-1.5 cursor-pointer hover:bg-primary/10"
                                        onClick={() => handleCopyText(message.serialNumber.toString(), message.id)}
                                      >
                                        <Hash className="h-4 w-4 ml-1" />
                                        {message.serialNumber}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>انقر لنسخ رقم القيد</TooltipContent>
                                  </Tooltip>
                                  {message.hasMedia && (
                                    <Badge variant="secondary" className="gap-1">
                                      {(() => {
                                        const MediaIcon = getMediaIcon(message.mediaType);
                                        return <MediaIcon className="h-3 w-3" />;
                                      })()}
                                      {message.mediaCount}
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {message.isPinned && (
                                    <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                                  )}
                                  {message.isFlagged && (
                                    <Flag className="h-4 w-4 text-rose-500 fill-rose-500" />
                                  )}
                                </div>
                              </div>

                              {/* Title & Content */}
                              <div 
                                className="cursor-pointer" 
                                onClick={() => handleTogglePreview(message)}
                              >
                                <h3 className="font-semibold text-foreground line-clamp-2 mb-1.5 group-hover:text-primary transition-colors">
                                  {message.title || 'بدون عنوان'}
                                </h3>
                                <p className={cn(
                                  "text-sm text-muted-foreground transition-all whitespace-pre-wrap",
                                  previewMessageId === message.id ? "line-clamp-none" : "line-clamp-4"
                                )}>
                                  {message.processedText || message.originalText || 'لا يوجد محتوى'}
                                </p>
                                {/* Text length indicator */}
                                {(message.originalText || message.processedText) && 
                                  (message.originalText?.length || 0) > 200 && 
                                  previewMessageId !== message.id && (
                                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                    <FileText className="h-3 w-3" />
                                    <span>{(message.originalText || message.processedText || '').length} حرف</span>
                                    <span className="text-primary hover:underline">انقر لعرض النص كاملاً</span>
                                  </div>
                                )}
                              </div>

                            {/* Tags */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              {message.classification && (
                                <Badge variant="secondary" className="gap-1 text-xs">
                                  <Tag className="h-2.5 w-2.5" />
                                  {message.classification}
                                </Badge>
                              )}
                              {message.province && (
                                <Badge variant="outline" className="gap-1 text-xs">
                                  <MapPin className="h-2.5 w-2.5" />
                                  {message.province}
                                </Badge>
                              )}
                              {message.newsType && (
                                <Badge variant="outline" className="gap-1 text-xs">
                                  <Newspaper className="h-2.5 w-2.5" />
                                  {message.newsType}
                                </Badge>
                              )}
                              {message.specialist && (
                                <Badge variant="outline" className="gap-1 text-xs">
                                  <User className="h-2.5 w-2.5" />
                                  {message.specialist}
                                </Badge>
                              )}
                            </div>

                            {/* Expanded Content */}
                            <CollapsibleContent>
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3 }}
                                className="space-y-4 pt-4"
                              >
                                <Separator />
                                
                                {/* Original Text */}
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <Label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                      <FileText className="h-4 w-4" />
                                      النص الأصلي
                                    </Label>
                                    {message.originalText && (
                                      <Badge variant="outline" className="text-xs">
                                        {message.originalText.length} حرف
                                      </Badge>
                                    )}
                                  </div>
                                  <Card className="bg-muted/30 border-primary/20">
                                    <CardContent className="p-4">
                                      <div className="text-sm whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto">
                                        {message.originalText || 'لا يوجد نص أصلي'}
                                      </div>
                                      {message.originalText && message.originalText.length > 500 && (
                                        <div className="mt-3 pt-3 border-t flex justify-end">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-xs"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleCopyText(message.originalText || '', message.id);
                                            }}
                                          >
                                            <Copy className="h-3 w-3 ml-1" />
                                            نسخ النص الأصلي
                                          </Button>
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>
                                </div>


                                {/* Metadata */}
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="p-3 rounded-lg bg-muted/30">
                                    <Label className="text-xs text-muted-foreground">تاريخ الإنشاء</Label>
                                    <p className="text-sm font-medium mt-1">
                                      {format(new Date(message.createdAt), 'PPpp', { locale: ar })}
                                    </p>
                                  </div>
                                  {message.editedAt && (
                                    <div className="p-3 rounded-lg bg-muted/30">
                                      <Label className="text-xs text-muted-foreground">آخر تعديل</Label>
                                      <p className="text-sm font-medium mt-1">
                                        {format(new Date(message.editedAt), 'PPpp', { locale: ar })}
                                      </p>
                                    </div>
                                  )}
                                </div>

                                {/* Notes */}
                                {message.notes && (
                                  <div>
                                    <Label className="text-sm font-medium text-muted-foreground mb-2 block">
                                      ملاحظات
                                    </Label>
                                    <Card className="bg-muted/30">
                                      <CardContent className="p-3">
                                        <p className="text-sm">{message.notes}</p>
                                      </CardContent>
                                    </Card>
                                  </div>
                                )}
                              </motion.div>
                            </CollapsibleContent>

                            {/* Footer */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {format(new Date(message.createdAt), 'PPp', { locale: ar })}
                                {message.sourceChannelTitle && (
                                  <>
                                    <span className="mx-1">•</span>
                                    <span className="truncate max-w-[100px]">{message.sourceChannelTitle}</span>
                                  </>
                                )}
                              </div>

                              <div className="flex items-center gap-0.5 print:hidden">
                                {message.telegraphUrl && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
                                        <a href={message.telegraphUrl} target="_blank" rel="noopener noreferrer">
                                          <ExternalLink className="h-4 w-4" />
                                        </a>
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>فتح في Telegraph</TooltipContent>
                                  </Tooltip>
                                )}
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                      onClick={() => handleOpenTTS(message)}
                                    >
                                      <Volume2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>قراءة صوتية</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                      onClick={() => handleCopyText(message.processedText || message.originalText || '', message.id)}
                                    >
                                      {copiedId === message.id ? (
                                        <CheckCircle className="h-4 w-4 text-green-500" />
                                      ) : (
                                        <Copy className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>نسخ النص</TooltipContent>
                                </Tooltip>
                                <CollapsibleTrigger asChild>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0"
                                      >
                                        {previewMessageId === message.id ? (
                                          <Minimize2 className="h-4 w-4" />
                                        ) : (
                                          <Maximize2 className="h-4 w-4" />
                                        )}
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {previewMessageId === message.id ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
                                    </TooltipContent>
                                  </Tooltip>
                                </CollapsibleTrigger>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0"
                                      onClick={() => handleOpenEdit(message)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>تعديل</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className={cn("h-8 w-8 p-0", message.isPinned && "text-amber-500")}
                                      onClick={() => togglePinMutation.mutate(message.id)}
                                    >
                                      <Star className={cn("h-4 w-4", message.isPinned && "fill-current")} />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{message.isPinned ? 'إلغاء التثبيت' : 'تثبيت'}</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className={cn("h-8 w-8 p-0", message.isFlagged && "text-rose-500")}
                                      onClick={() => toggleFlagMutation.mutate(message.id)}
                                    >
                                      <Flag className={cn("h-4 w-4", message.isFlagged && "fill-current")} />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{message.isFlagged ? 'إلغاء التعليم' : 'تعليم'}</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                      onClick={() => handleOpenDelete(message)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>حذف</TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                        </Collapsible>
                      </Card>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 pt-6 print:hidden">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                    className="gap-1"
                  >
                    <ChevronRight className="h-4 w-4" />
                    السابق
                  </Button>

                  <div className="flex items-center gap-2">
                    {page > 2 && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => setPage(1)}>1</Button>
                        {page > 3 && <span className="text-muted-foreground">...</span>}
                      </>
                    )}
                    {page > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => setPage(page - 1)}>
                        {page - 1}
                      </Button>
                    )}
                    <Button variant="default" size="sm" className="pointer-events-none">
                      {page}
                    </Button>
                    {page < totalPages && (
                      <Button variant="ghost" size="sm" onClick={() => setPage(page + 1)}>
                        {page + 1}
                      </Button>
                    )}
                    {page < totalPages - 1 && (
                      <>
                        {page < totalPages - 2 && <span className="text-muted-foreground">...</span>}
                        <Button variant="ghost" size="sm" onClick={() => setPage(totalPages)}>
                          {totalPages}
                        </Button>
                      </>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="gap-1"
                  >
                    التالي
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Results Info */}
              <div className="text-center text-sm text-muted-foreground pt-2">
                عرض {((page - 1) * ITEMS_PER_PAGE) + 1} - {Math.min(page * ITEMS_PER_PAGE, totalMessages)} من {totalMessages.toLocaleString('ar-EG')} رسالة
              </div>
            </>
          )}
        </div>

        

        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-lg" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Edit className="h-5 w-5 text-primary" />
                تعديل الرسالة
                {selectedMessage && (
                  <Badge variant="outline" className="font-mono">
                    {selectedMessage.serialNumber}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                تعديل بيانات الرسالة والحقول المؤرشفة
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-4 py-4">
                {/* Title */}
                <div>
                  <Label htmlFor="edit-title" className="mb-2 block font-semibold">العنوان</Label>
                  <Input
                    id="edit-title"
                    value={editForm.title}
                    onChange={(e) => setEditForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="أدخل العنوان"
                  />
                </div>

                {/* Classification */}
                <div>
                  <Label htmlFor="edit-classification" className="mb-2 block">التصنيف</Label>
                  <Input
                    id="edit-classification"
                    value={editForm.classification}
                    onChange={(e) => setEditForm(f => ({ ...f, classification: e.target.value }))}
                    placeholder="التصنيف"
                  />
                </div>

                {/* News Type */}
                <div>
                  <Label htmlFor="edit-news-type" className="mb-2 block">نوع الخبر</Label>
                  <Input
                    id="edit-news-type"
                    value={editForm.newsType}
                    onChange={(e) => setEditForm(f => ({ ...f, newsType: e.target.value }))}
                    placeholder="نوع الخبر"
                  />
                </div>

                {/* Province */}
                <div>
                  <Label htmlFor="edit-province" className="mb-2 block">المحافظة</Label>
                  <Input
                    id="edit-province"
                    value={editForm.province}
                    onChange={(e) => setEditForm(f => ({ ...f, province: e.target.value }))}
                    placeholder="المحافظة"
                  />
                </div>

                {/* Date - Read Only */}
                {selectedMessage && (
                  <div>
                    <Label className="mb-2 block text-xs text-muted-foreground">التاريخ</Label>
                    <div className="p-2 rounded border bg-muted/50 text-sm">
                      {format(parseISO(selectedMessage.createdAt), 'dd MMM yyyy', { locale: ar })}
                    </div>
                  </div>
                )}

                {/* Specialist */}
                <div>
                  <Label htmlFor="edit-specialist" className="mb-2 block">المختص</Label>
                  <Input
                    id="edit-specialist"
                    value={editForm.specialist}
                    onChange={(e) => setEditForm(f => ({ ...f, specialist: e.target.value }))}
                    placeholder="المختص"
                  />
                </div>

                {/* Source */}
                <div>
                  <Label htmlFor="edit-source" className="mb-2 block">المصدر</Label>
                  <Input
                    id="edit-source"
                    value={editForm.sourceChannelTitle}
                    onChange={(e) => setEditForm(f => ({ ...f, sourceChannelTitle: e.target.value }))}
                    placeholder="المصدر"
                  />
                </div>

                {/* Summary */}
                <div>
                  <Label htmlFor="edit-summary" className="mb-2 block">الملخص</Label>
                  <Textarea
                    id="edit-summary"
                    value={editForm.summary}
                    onChange={(e) => setEditForm(f => ({ ...f, summary: e.target.value }))}
                    placeholder="أدخل الملخص..."
                    rows={2}
                  />
                </div>

                {/* Original Text */}
                <div>
                  <Label htmlFor="edit-original-text" className="mb-2 block">النص الأصلي</Label>
                  <Textarea
                    id="edit-original-text"
                    value={editForm.originalText}
                    onChange={(e) => setEditForm(f => ({ ...f, originalText: e.target.value }))}
                    placeholder="أدخل النص الأصلي..."
                    rows={4}
                  />
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button variant="outline">إلغاء</Button>
              </DialogClose>
              <Button
                onClick={handleSaveEdit}
                disabled={updateMessageMutation.isPending}
              >
                {updateMessageMutation.isPending ? (
                  <Loader className="h-4 w-4 animate-spin ml-2" />
                ) : (
                  <Save className="h-4 w-4 ml-2" />
                )}
                حفظ التغييرات
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-destructive" />
                تأكيد الحذف
              </AlertDialogTitle>
              <AlertDialogDescription>
                هل أنت متأكد من حذف هذه الرسالة؟ لا يمكن التراجع عن هذا الإجراء.
                {messageToDelete && (
                  <div className="mt-3 p-3 rounded-lg bg-muted">
                    <Badge variant="outline" className="font-mono">{messageToDelete.serialNumber}</Badge>
                    <p className="text-sm mt-2 line-clamp-2">{messageToDelete.title || 'بدون عنوان'}</p>
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirmDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMessageMutation.isPending ? (
                  <Loader className="h-4 w-4 animate-spin ml-2" />
                ) : (
                  <Trash2 className="h-4 w-4 ml-2" />
                )}
                حذف
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Bulk Delete Confirmation Dialog */}
        <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-destructive" />
                تأكيد حذف متعدد
              </AlertDialogTitle>
              <AlertDialogDescription>
                هل أنت متأكد من حذف {selectedIds.size} رسالة محددة؟ لا يمكن التراجع عن هذا الإجراء.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleBulkDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                <Trash2 className="h-4 w-4 ml-2" />
                حذف {selectedIds.size} رسالة
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Text-to-Speech Dialog */}
        <Dialog open={ttsDialogOpen} onOpenChange={setTtsDialogOpen}>
          <DialogContent className="sm:max-w-lg" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Volume2 className="h-5 w-5 text-primary" />
                القراءة الصوتية
                {ttsMessage && (
                  <Badge variant="outline" className="font-mono">
                    {ttsMessage.serialNumber}
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription>
                تحويل النص إلى صوت باستخدام تقنية Groq PlayAI
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* TTS Status Check */}
              {!ttsStatus?.configured && (
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-amber-900 dark:text-amber-100">
                        تحذير
                      </h4>
                      <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                        يجب تكوين GROQ_API_KEY في متغيرات البيئة لاستخدام القراءة الصوتية
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Voice Selection */}
              <div>
                <Label htmlFor="tts-voice" className="mb-2 block">
                  اختيار الصوت
                </Label>
                <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                  <SelectTrigger id="tts-voice">
                    <SelectValue placeholder="اختر الصوت" />
                  </SelectTrigger>
                  <SelectContent>
                    {ttsVoices?.map((voice) => (
                      <SelectItem key={voice.id} value={voice.id}>
                        <div className="flex items-center gap-2">
                          <span>{voice.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {voice.language}
                          </Badge>
                          {voice.gender && (
                            <span className="text-xs text-muted-foreground">
                              ({voice.gender === 'male' ? 'ذكر' : 'أنثى'})
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  سيتم حفظ اختيارك تلقائياً
                </p>
              </div>

              {/* Text Preview */}
              {ttsMessage && (
                <div>
                  <Label className="mb-2 block">معاينة النص</Label>
                  <ScrollArea className="h-32 rounded-md border p-3 bg-muted/30">
                    <p className="text-sm whitespace-pre-wrap">
                      {(ttsMessage.processedText || ttsMessage.originalText || '').slice(0, 500)}
                      {(ttsMessage.processedText || ttsMessage.originalText || '').length > 500 && '...'}
                    </p>
                  </ScrollArea>
                  <p className="text-xs text-muted-foreground mt-1">
                    عدد الأحرف: {(ttsMessage.processedText || ttsMessage.originalText || '').length}
                    {(ttsMessage.processedText || ttsMessage.originalText || '').length > 4000 && (
                      <span className="text-amber-600 mr-2">
                        (سيتم اقتصاص النص إلى 4000 حرف)
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* Audio Player */}
              {audioUrl && (
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handlePlayPause}
                          className="gap-1"
                        >
                          {isPlaying ? (
                            <>
                              <Pause className="h-4 w-4" />
                              إيقاف مؤقت
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4" />
                              تشغيل
                            </>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleStopAudio}
                          className="gap-1"
                        >
                          <StopCircle className="h-4 w-4" />
                          إيقاف
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownloadAudio}
                        className="gap-1"
                      >
                        <Download className="h-4 w-4" />
                        تحميل
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button variant="outline">إغلاق</Button>
              </DialogClose>
              <Button
                onClick={handleGenerateSpeech}
                disabled={textToSpeechMutation.isPending || !ttsStatus?.configured}
              >
                {textToSpeechMutation.isPending ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin ml-2" />
                    جاري التوليد...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 ml-2" />
                    توليد الصوت
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* HTML Export Dialog */}
        <Dialog open={htmlExportDialogOpen} onOpenChange={setHtmlExportDialogOpen}>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                تصدير HTML
              </DialogTitle>
              <DialogDescription>
                اختر الفترة الزمنية لتصدير الرسائل كملف HTML
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div>
                <Label className="mb-3 block">نوع التصدير</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={htmlExportType === 'day' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setHtmlExportType('day')}
                    className="flex flex-col h-auto py-3"
                  >
                    <CalendarIcon className="h-5 w-5 mb-1" />
                    يوم محدد
                  </Button>
                  <Button
                    variant={htmlExportType === 'range' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setHtmlExportType('range')}
                    className="flex flex-col h-auto py-3"
                  >
                    <CalendarIcon className="h-5 w-5 mb-1" />
                    نطاق تواريخ
                  </Button>
                  <Button
                    variant={htmlExportType === 'month' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setHtmlExportType('month')}
                    className="flex flex-col h-auto py-3"
                  >
                    <CalendarIcon className="h-5 w-5 mb-1" />
                    شهر كامل
                  </Button>
                </div>
              </div>

              {htmlExportType === 'day' && (
                <div>
                  <Label className="mb-2 block">اختر اليوم</Label>
                  <Popover open={htmlDatePickerOpen === 'day'} onOpenChange={(open) => setHtmlDatePickerOpen(open ? 'day' : null)}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-right">
                        <CalendarIcon className="ml-2 h-4 w-4" />
                        {format(htmlExportDate, 'dd MMMM yyyy', { locale: ar })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={htmlExportDate}
                        onSelect={(date) => {
                          if (date) setHtmlExportDate(date);
                          setHtmlDatePickerOpen(null);
                        }}
                        locale={ar}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              {htmlExportType === 'range' && (
                <div className="space-y-3">
                  <div>
                    <Label className="mb-2 block">من تاريخ</Label>
                    <Popover open={htmlDatePickerOpen === 'from'} onOpenChange={(open) => setHtmlDatePickerOpen(open ? 'from' : null)}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-right">
                          <CalendarIcon className="ml-2 h-4 w-4" />
                          {format(htmlExportDateFrom, 'dd MMMM yyyy', { locale: ar })}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={htmlExportDateFrom}
                          onSelect={(date) => {
                            if (date) setHtmlExportDateFrom(date);
                            setHtmlDatePickerOpen(null);
                          }}
                          locale={ar}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label className="mb-2 block">إلى تاريخ</Label>
                    <Popover open={htmlDatePickerOpen === 'to'} onOpenChange={(open) => setHtmlDatePickerOpen(open ? 'to' : null)}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-right">
                          <CalendarIcon className="ml-2 h-4 w-4" />
                          {format(htmlExportDateTo, 'dd MMMM yyyy', { locale: ar })}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={htmlExportDateTo}
                          onSelect={(date) => {
                            if (date) setHtmlExportDateTo(date);
                            setHtmlDatePickerOpen(null);
                          }}
                          locale={ar}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              )}

              {htmlExportType === 'month' && (
                <div>
                  <Label className="mb-2 block">اختر الشهر</Label>
                  <Popover open={htmlDatePickerOpen === 'month'} onOpenChange={(open) => setHtmlDatePickerOpen(open ? 'month' : null)}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-right">
                        <CalendarIcon className="ml-2 h-4 w-4" />
                        {format(htmlExportMonth, 'MMMM yyyy', { locale: ar })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={htmlExportMonth}
                        onSelect={(date) => {
                          if (date) setHtmlExportMonth(date);
                          setHtmlDatePickerOpen(null);
                        }}
                        locale={ar}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}

              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  سيتم تصدير الرسائل بتنسيق HTML احترافي مع تطبيق الفلاتر الحالية يتضمن:
                </p>
                <ul className="text-xs text-blue-600 dark:text-blue-300 mt-2 space-y-1 list-disc list-inside">
                  <li>العنوان ورقم القيد</li>
                  <li>التصنيف ونوع الخبر</li>
                  <li>المحافظة والتاريخ</li>
                  <li>المصدر والمختص</li>
                  <li>تطبيق فلاتر البحث والتصنيف والمصدر</li>
                </ul>
                {(filters.classification || filters.newsType || filters.province || filters.specialist || filters.sourceChannelTitle) && (
                  <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
                    <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">الفلاتر المفعلة:</p>
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      {filters.classification && <div>• التصنيف: {filters.classification}</div>}
                      {filters.newsType && <div>• نوع الخبر: {filters.newsType}</div>}
                      {filters.province && <div>• المحافظة: {filters.province}</div>}
                      {filters.specialist && <div>• المختص: {filters.specialist}</div>}
                      {filters.sourceChannelTitle && <div>• المصدر: {filters.sourceChannelTitle}</div>}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button variant="outline">إلغاء</Button>
              </DialogClose>
              <Button
                onClick={handleExportHTML}
                disabled={htmlExportLoading}
              >
                {htmlExportLoading ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin ml-2" />
                    جاري التصدير...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 ml-2" />
                    تصدير HTML
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}