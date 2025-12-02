import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Globe, Hash, Users, Trash2, Loader } from "lucide-react";
import { toast } from "sonner";

export default function ChannelsPage() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
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

  const createMutation = useMutation({
    mutationFn: (data: any) => api.createChannel(data),
    onSuccess: () => {
      toast.success("تمت إضافة المصدر بنجاح");
      queryClient.invalidateQueries({ queryKey: ["channels"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setIsOpen(false);
      setFormData({
        type: "telegram_channel",
        identifier: "",
        title: "",
        description: "",
      });
    },
    onError: (error: any) => {
      toast.error(error.message || "فشل إضافة المصدر");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteChannel(id),
    onSuccess: () => {
      toast.success("تم حذف المصدر");
      queryClient.invalidateQueries({ queryKey: ["channels"] });
    },
  });

  const handleCreate = async () => {
    if (!formData.title || !formData.identifier) {
      toast.error("يرجى ملء جميع الحقول");
      return;
    }
    createMutation.mutate(formData);
  };

  const filteredChannels = channels.filter(c => 
    c.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.identifier?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const typeIcon = {
    "telegram_channel": Hash,
    "telegram_group": Users,
    "website": Globe,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground tracking-wide">المصادر والقنوات</h2>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">إدارة القنوات والمجموعات والمواقع الإلكترونية</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground font-bold hover:bg-primary/90 w-full sm:w-auto" data-testid="button-add-channel">
              <Plus className="h-3 w-3 mr-2" /> إضافة مصدر
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>إضافة مصدر جديد</DialogTitle>
              <DialogDescription>أدخل تفاصيل المصدر الجديد</DialogDescription>
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
                إضافة المصدر
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="البحث في المصادر..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-channels"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredChannels.map((channel) => {
          const IconComponent = typeIcon[channel.type as keyof typeof typeIcon] || Globe;
          return (
            <Card key={channel.id} className="border shadow-sm group hover:shadow-md transition-all" data-testid={`card-channel-${channel.id}`}>
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                      <IconComponent className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground">{channel.title}</h3>
                      <p className="text-xs text-muted-foreground">
                        {channel.type === "telegram_channel" ? "قناة تلغرام" : 
                         channel.type === "telegram_group" ? "مجموعة تلغرام" : 
                         "موقع إلكتروني"}
                      </p>
                    </div>
                  </div>
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                </div>
                
                <div className="space-y-3">
                  <div className="text-sm text-muted-foreground break-all font-mono text-xs bg-muted/50 p-2 rounded">
                    {channel.identifier}
                  </div>
                  {channel.description && (
                    <p className="text-xs text-muted-foreground">{channel.description}</p>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-border flex justify-end gap-2">
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(channel.id)}
                    className="h-8 text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-500/10"
                    data-testid={`button-delete-channel-${channel.id}`}
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> حذف
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredChannels.length === 0 && (
        <div className="p-8 text-center text-muted-foreground">
          {channels.length === 0 ? "لا توجد مصادر حالياً. اضغط على 'إضافة مصدر' للبدء" : "لم يتم العثور على نتائج"}
        </div>
      )}
    </div>
  );
}
