import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Globe, Hash, Users, Trash2, Loader, Edit, Send } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function ChannelsPage() {
  const { i18n, t } = useTranslation();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [channelToDelete, setChannelToDelete] = useState<{ id: number; title: string } | null>(null);
  const [formData, setFormData] = useState({
    type: "telegram_channel",
    identifier: "",
    title: "",
    description: "",
  });

  const { data: channels = [], isLoading } = useQuery({
    queryKey: ["channels"],
    queryFn: () => api.getChannels(),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => api.getTasks(),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => editingId ? api.updateChannel(editingId, data) : api.createChannel(data),
    onSuccess: () => {
      toast.success(editingId ? "تم تحديث المصدر بنجاح" : "تمت إضافة المصدر بنجاح");
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setIsOpen(false);
      setEditingId(null);
      setFormData({
        type: "telegram_channel",
        identifier: "",
        title: "",
        description: "",
      });
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل العملية");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteChannel(id),
    onMutate: async (deletedId) => {
      await queryClient.cancelQueries({ queryKey: ["channels"] });
      const previousChannels = queryClient.getQueryData(["channels"]);
      queryClient.setQueryData(["channels"], (old: any) => 
        old?.filter((channel: any) => channel.id !== deletedId) || []
      );
      return { previousChannels };
    },
    onSuccess: () => {
      toast.success("تم حذف المصدر بنجاح");
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (error: any, _, context) => {
      queryClient.setQueryData(["channels"], context?.previousChannels);
      toast.error(error.message || "فشل حذف المصدر");
    },
  });

  const handleCreate = async () => {
    if (!formData.title || !formData.identifier) {
      toast.error("يرجى ملء جميع الحقول");
      return;
    }
    createMutation.mutate(formData);
  };

  const handleEdit = (channel: any) => {
    setEditingId(channel.id);
    setFormData({
      type: channel.type,
      identifier: channel.identifier,
      title: channel.title,
      description: channel.description || "",
    });
    setIsOpen(true);
  };

  const handleCloseDialog = () => {
    setIsOpen(false);
    setEditingId(null);
    setFormData({
      type: "telegram_channel",
      identifier: "",
      title: "",
      description: "",
    });
  };

  const handleDeleteClick = (channel: any) => {
    setChannelToDelete({ id: channel.id, title: channel.title });
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (channelToDelete) {
      deleteMutation.mutate(channelToDelete.id);
      setDeleteDialogOpen(false);
      setChannelToDelete(null);
    }
  };

  const getTaskCount = (channelId: number) => {
    return tasks.filter((t: any) => 
      t.sourceChannels?.includes(channelId) || t.targetChannels?.includes(channelId)
    ).length;
  };

  const filteredChannels = channels.filter(c => {
    const matchesSearch = 
      c.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.identifier?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === "all" || c.type === selectedType;
    return matchesSearch && matchesType;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const typeConfig = {
    "telegram_channel": { 
      icon: Hash, 
      color: "from-blue-500 to-blue-600", 
      bgColor: "bg-blue-500/10",
      label: "قناة تلغرام",
      shortLabel: "قناة"
    },
    "telegram_group": { 
      icon: Users, 
      color: "from-purple-500 to-purple-600", 
      bgColor: "bg-purple-500/10",
      label: "مجموعة تلغرام",
      shortLabel: "مجموعة"
    },
    "website": { 
      icon: Globe, 
      color: "from-green-500 to-green-600", 
      bgColor: "bg-green-500/10",
      label: "موقع إلكتروني",
      shortLabel: "موقع"
    },
  };

  const types = [
    { value: "all", label: "الكل" },
    { value: "telegram_channel", label: "القنوات" },
    { value: "telegram_group", label: "المجموعات" },
    { value: "website", label: "المواقع" },
  ];

  return (
    <div className="space-y-6" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className={i18n.language === 'ar' ? 'text-right' : 'text-left'}>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground tracking-wide">المصادر والقنوات</h2>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">إدارة القنوات والمجموعات والمواقع الإلكترونية - {channels.length} مصادر</p>
        </div>
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleCloseDialog(); else setIsOpen(true); }}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground font-bold hover:bg-primary/90 w-full sm:w-auto" data-testid="button-add-channel">
              <Plus className="h-4 w-4 mr-2" /> إضافة مصدر
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? "تعديل المصدر" : "إضافة مصدر جديد"}</DialogTitle>
              <DialogDescription>{editingId ? "تحديث تفاصيل المصدر" : "أدخل تفاصيل المصدر الجديد"}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="type">نوع المصدر</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData({...formData, type: value})}>
                  <SelectTrigger id="type" className="mt-1" data-testid="select-channel-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="telegram_channel">قناة تلغرام</SelectItem>
                    <SelectItem value="telegram_group">مجموعة تلغرام</SelectItem>
                    <SelectItem value="website">موقع إلكتروني</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="identifier">المعرف أو الرابط</Label>
                <Input
                  id="identifier"
                  value={formData.identifier}
                  onChange={(e) => setFormData({...formData, identifier: e.target.value})}
                  placeholder={formData.type === "website" ? "https://example.com" : "@channelname or -1001234567890"}
                  className="mt-1"
                  data-testid="input-channel-identifier"
                />
              </div>

              <div>
                <Label htmlFor="title">الاسم</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  placeholder="اسم المصدر"
                  className="mt-1"
                  data-testid="input-channel-title"
                />
              </div>

              <div>
                <Label htmlFor="description">الوصف</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  placeholder="وصف المصدر"
                  className="mt-1"
                  data-testid="input-channel-description"
                />
              </div>

              <Button 
                onClick={handleCreate}
                className="w-full"
                disabled={createMutation.isPending}
                data-testid="button-submit-channel"
              >
                {createMutation.isPending && <Loader className="h-4 w-4 mr-2 animate-spin" />}
                {editingId ? "تحديث المصدر" : "إضافة المصدر"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-4">
        <div className="relative flex-1">
          <Search className={`absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ${i18n.language === 'ar' ? 'right-3' : 'left-3'}`} />
          <Input 
            placeholder="البحث في المصادر..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={i18n.language === 'ar' ? 'pr-10' : 'pl-10'}
            data-testid="input-search-channels"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {types.map((type) => (
            <Button
              key={type.value}
              variant={selectedType === type.value ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedType(type.value)}
              className="text-xs"
              data-testid={`button-filter-${type.value}`}
            >
              {type.label}
            </Button>
          ))}
        </div>
      </div>

      {filteredChannels.length === 0 ? (
        <Card className="border-dashed text-center py-12">
          <div className="space-y-2">
            <p className="text-muted-foreground">لا توجد مصادر تطابق البحث</p>
            <p className="text-xs text-muted-foreground">جرّب تغيير معايير البحث أو الفلاتر</p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredChannels.map((channel: any, index) => {
            const config = typeConfig[channel.type as keyof typeof typeConfig] || typeConfig["telegram_channel"];
            const IconComponent = config.icon;
            const taskCount = getTaskCount(channel.id);

            return (
              <motion.div
                key={channel.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card className={`border shadow-sm group hover:shadow-lg transition-all overflow-hidden`} data-testid={`card-channel-${channel.id}`}>
                  <div className={`h-1 bg-gradient-to-r ${config.color}`} />
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`h-10 w-10 rounded-full ${config.bgColor} flex items-center justify-center border border-primary/20`}>
                          <IconComponent className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-foreground truncate">{channel.title}</h3>
                            <Badge variant="secondary" className="text-xs flex-shrink-0">{config.shortLabel}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{config.label}</p>
                        </div>
                      </div>
                      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
                    </div>
                    
                    <div className="space-y-3">
                      <div className="text-xs text-muted-foreground break-all font-mono bg-muted/50 p-2 rounded border border-border">
                        {channel.identifier}
                      </div>
                      {channel.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{channel.description}</p>
                      )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-border flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <Send className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground">{taskCount}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleEdit(channel)}
                          className="h-8 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-500/10"
                          data-testid={`button-edit-channel-${channel.id}`}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => handleDeleteClick(channel)}
                          className="h-8 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-500/10"
                          data-testid={`button-delete-channel-${channel.id}`}
                          disabled={deleteMutation.isPending}
                        >
                          {deleteMutation.isPending ? <Loader className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="max-w-md" dir={i18n.language === 'ar' ? 'rtl' : 'ltr'}>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-bold">تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              هل أنت متأكد من حذف المصدر <span className="font-semibold text-foreground">"{channelToDelete?.title}"</span>؟ 
              <br />
              لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="m-0">إلغاء</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              حذف المصدر
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
