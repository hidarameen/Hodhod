import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useTranslation } from "react-i18next";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader, Trash2, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function ErrorLogsPage() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<string>("");
  const [selectedError, setSelectedError] = useState<any>(null);

  const { data: errors = [], isLoading, refetch } = useQuery({
    queryKey: ["error-logs"],
    queryFn: () => api.getErrorLogs(50), // تقليل العدد المسترجع إلى 50 خطأ فقط
    refetchInterval: 20000, // التحديث كل 20 ثانية بدلاً من 5
  });

  const filteredErrors = errors.filter(
    (error: any) =>
      error.component?.toLowerCase().includes(filter.toLowerCase()) ||
      error.errorMessage?.toLowerCase().includes(filter.toLowerCase()) ||
      error.function?.toLowerCase().includes(filter.toLowerCase())
  );

  const getComponentColor = (component: string) => {
    switch (component) {
      case "bot":
        return "bg-red-500/10 text-red-600 dark:text-red-400";
      case "api":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
      case "worker":
        return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400";
      case "webhook":
        return "bg-purple-500/10 text-purple-600 dark:text-purple-400";
      default:
        return "bg-gray-500/10 text-gray-600 dark:text-gray-400";
    }
  };

  const getErrorTypeColor = (type: string) => {
    if (type?.includes("WARN")) return "bg-yellow-500/10 text-yellow-600";
    if (type?.includes("ERROR")) return "bg-red-500/10 text-red-600";
    if (type?.includes("INFO")) return "bg-blue-500/10 text-blue-600";
    return "bg-gray-500/10 text-gray-600";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground tracking-wide">سجل الأخطاء</h2>
        <p className="text-muted-foreground mt-1 text-sm md:text-base">عرض وتتبع جميع أخطاء النظام والبوت</p>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="ابحث عن الأخطاء..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="flex-1"
          data-testid="input-error-filter"
        />
        <Button variant="outline" onClick={() => refetch()} data-testid="button-refresh-errors">
          تحديث
        </Button>
      </div>

      <Card className="border shadow-sm">
        <CardHeader className="border-b">
          <CardTitle>
            إجمالي الأخطاء: {filteredErrors.length}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-muted-foreground">المكون</TableHead>
                <TableHead className="text-muted-foreground">الدالة</TableHead>
                <TableHead className="text-muted-foreground hidden md:table-cell">نوع الخطأ</TableHead>
                <TableHead className="text-muted-foreground">الرسالة</TableHead>
                <TableHead className="text-muted-foreground hidden lg:table-cell">الوقت</TableHead>
                <TableHead className="text-right text-muted-foreground">الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredErrors.map((error: any, idx: number) => (
                <TableRow key={idx} className="hover:bg-muted/50 transition-colors" data-testid={`row-error-${idx}`}>
                  <TableCell>
                    <Badge className={getComponentColor(error.component)}>
                      {error.component}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{error.function}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge className={getErrorTypeColor(error.errorType)} variant="secondary">
                      {error.errorType}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm">
                    {error.errorMessage}
                  </TableCell>
                  <TableCell className="text-sm hidden lg:table-cell text-muted-foreground">
                    {new Date(error.timestamp).toLocaleString("ar-SA")}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => setSelectedError(error)}
                      data-testid={`button-view-error-${idx}`}
                    >
                      <AlertCircle className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {filteredErrors.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">لا توجد أخطاء حالياً. النظام يعمل بشكل صحيح! ✅</div>
          )}
        </CardContent>
      </Card>

      {selectedError && (
        <Dialog open={!!selectedError} onOpenChange={() => setSelectedError(null)}>
          <DialogContent className="max-w-2xl max-h-96 overflow-y-auto">
            <DialogHeader>
              <DialogTitle>تفاصيل الخطأ</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <div>
                <span className="font-semibold">المكون:</span>
                <Badge className="ml-2">{selectedError.component}</Badge>
              </div>
              <div>
                <span className="font-semibold">الدالة:</span>
                <code className="ml-2 bg-muted p-1 rounded">{selectedError.function}</code>
              </div>
              <div>
                <span className="font-semibold">نوع الخطأ:</span>
                <code className="ml-2 bg-muted p-1 rounded">{selectedError.errorType}</code>
              </div>
              <div>
                <span className="font-semibold">الرسالة:</span>
                <p className="mt-1 p-2 bg-red-500/10 rounded">{selectedError.errorMessage}</p>
              </div>
              {selectedError.stackTrace && (
                <div>
                  <span className="font-semibold">Stack Trace:</span>
                  <pre className="mt-1 p-2 bg-muted rounded overflow-x-auto text-xs max-h-32 overflow-y-auto">
                    {selectedError.stackTrace}
                  </pre>
                </div>
              )}
              {selectedError.metadata && (
                <div>
                  <span className="font-semibold">البيانات الإضافية:</span>
                  <pre className="mt-1 p-2 bg-muted rounded overflow-x-auto text-xs max-h-32 overflow-y-auto">
                    {JSON.stringify(selectedError.metadata, null, 2)}
                  </pre>
                </div>
              )}
              <div>
                <span className="font-semibold">الوقت:</span>
                <span className="ml-2 text-muted-foreground">
                  {new Date(selectedError.timestamp).toLocaleString("ar-SA")}
                </span>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
