# دليل تكامل الواجهة مع API 🔌

## نظرة عامة

تم بناء API Backend بالكامل وهو جاهز للاستخدام. هذا الدليل يوضح كيفية ربط الواجهة Web مع الـ API.

## API Client

تم إنشاء `client/src/lib/api.ts` الذي يحتوي على جميع الـ methods للتواصل مع الـ API.

### استخدام API Client

```typescript
import { api } from "@/lib/api";

// مثال: جلب الإحصائيات
const stats = await api.getDashboardStats();

// مثال: جلب جميع المهام
const tasks = await api.getTasks();

// مثال: إنشاء مهمة جديدة
const newTask = await api.createTask({
  name: "مهمة التوجيه 1",
  description: "توجيه من قناة أ إلى قناة ب",
  sourceChannels: [1, 2],
  targetChannels: [3, 4],
  isActive: true,
  aiEnabled: false,
  videoProcessingEnabled: false,
});
```

## تحديث الصفحات

### 1. Dashboard (dashboard.tsx)

استبدل mock data بـ API calls:

```typescript
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function Dashboard() {
  // جلب الإحصائيات
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => api.getDashboardStats(),
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      {/* استخدم stats.totalTasks بدلاً من الأرقام الثابتة */}
      <h3>{stats.totalTasks} Tasks</h3>
      {/* ... */}
    </div>
  );
}
```

### 2. Tasks Page (tasks.tsx)

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function TasksPage() {
  const queryClient = useQueryClient();

  // جلب المهام
  const { data: tasks, isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: () => api.getTasks(),
  });

  // حذف مهمة
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.deleteTask(id),
    onSuccess: () => {
      // تحديث البيانات بعد الحذف
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  // تفعيل/تعطيل مهمة
  const toggleMutation = useMutation({
    mutationFn: (id: number) => api.toggleTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  return (
    <div>
      {tasks?.map((task) => (
        <div key={task.id}>
          <h3>{task.name}</h3>
          <button onClick={() => toggleMutation.mutate(task.id)}>
            {task.isActive ? "تعطيل" : "تفعيل"}
          </button>
          <button onClick={() => deleteMutation.mutate(task.id)}>
            حذف
          </button>
        </div>
      ))}
    </div>
  );
}
```

### 3. Channels Page (channels.tsx)

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function ChannelsPage() {
  const queryClient = useQueryClient();

  // جلب القنوات
  const { data: channels } = useQuery({
    queryKey: ["channels"],
    queryFn: () => api.getChannels(),
  });

  // إضافة قناة
  const addChannelMutation = useMutation({
    mutationFn: (data: any) => api.createChannel(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channels"] });
    },
  });

  const handleAddChannel = async (formData: any) => {
    await addChannelMutation.mutateAsync({
      type: formData.type, // 'telegram_channel' | 'telegram_group' | 'website'
      identifier: formData.identifier,
      title: formData.title,
      description: formData.description,
    });
  };

  return (
    <div>
      {/* عرض القنوات */}
      {channels?.map((channel) => (
        <div key={channel.id}>{channel.title}</div>
      ))}
    </div>
  );
}
```

### 4. AI Config Page (ai-config.tsx)

```typescript
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function AIConfigPage() {
  // جلب مزودي AI
  const { data: providers } = useQuery({
    queryKey: ["ai-providers"],
    queryFn: () => api.getAiProviders(),
  });

  // جلب الموديلات
  const { data: models } = useQuery({
    queryKey: ["ai-models"],
    queryFn: () => api.getAiModels(),
  });

  return (
    <div>
      <h2>AI Providers</h2>
      {providers?.map((provider) => (
        <div key={provider.id}>
          {provider.name} - {provider.isActive ? "نشط" : "معطل"}
        </div>
      ))}

      <h2>AI Models</h2>
      {models?.map((model) => (
        <div key={model.id}>
          {model.displayName} ({model.modelName})
        </div>
      ))}
    </div>
  );
}
```

### 5. Auth Page (auth-page.tsx)

```typescript
import { useState } from "react";
import { api } from "@/lib/api";
import { useNavigate } from "wouter";

export default function AuthPage() {
  const [, navigate] = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await api.login(username, password);
      // حفظ بيانات المستخدم
      localStorage.setItem("user", JSON.stringify(response.user));
      // الانتقال للداشبورد
      navigate("/");
    } catch (error) {
      alert("خطأ في تسجيل الدخول");
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="اسم المستخدم"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="كلمة المرور"
      />
      <button type="submit">تسجيل الدخول</button>
    </form>
  );
}
```

## API Endpoints المتاحة

### Authentication
- `POST /api/auth/login` - تسجيل الدخول
- `POST /api/auth/register` - إنشاء حساب

### Dashboard
- `GET /api/dashboard/stats` - الإحصائيات العامة

### Tasks
- `GET /api/tasks` - جميع المهام
- `GET /api/tasks/:id` - مهمة محددة
- `POST /api/tasks` - إنشاء مهمة
- `PATCH /api/tasks/:id` - تحديث مهمة
- `POST /api/tasks/:id/toggle` - تفعيل/تعطيل
- `DELETE /api/tasks/:id` - حذف مهمة
- `GET /api/tasks/:id/stats` - إحصائيات المهمة
- `GET /api/tasks/:id/logs` - سجلات المهمة

### Channels
- `GET /api/channels` - جميع القنوات
- `GET /api/channels/:id` - قناة محددة
- `POST /api/channels` - إضافة قناة
- `PATCH /api/channels/:id` - تحديث قناة
- `DELETE /api/channels/:id` - حذف قناة

### AI
- `GET /api/ai/providers` - جميع مزودي AI
- `GET /api/ai/models` - جميع الموديلات
- `GET /api/ai/providers/:id/models` - موديلات مزود معين
- `GET /api/tasks/:id/rules` - قواعد AI للمهمة
- `POST /api/tasks/:id/rules` - إضافة قاعدة
- `PATCH /api/rules/:id` - تحديث قاعدة
- `DELETE /api/rules/:id` - حذف قاعدة

### Admins
- `GET /api/admins` - جميع المشرفين

## معالجة الأخطاء

```typescript
import { api } from "@/lib/api";
import { toast } from "sonner";

try {
  const tasks = await api.getTasks();
  // عرض البيانات
} catch (error) {
  // معالجة الخطأ
  toast.error("فشل في جلب البيانات");
  console.error(error);
}
```

## التحديث التلقائي

استخدم React Query لتحديث البيانات تلقائياً:

```typescript
const { data } = useQuery({
  queryKey: ["tasks"],
  queryFn: () => api.getTasks(),
  refetchInterval: 5000, // تحديث كل 5 ثواني
});
```

## الخطوات التالية

1. ✅ API Backend جاهز ويعمل
2. ✅ API Client تم إنشاؤه (`client/src/lib/api.ts`)
3. 🔨 قم بتحديث الصفحات لاستخدام API بدلاً من mock data
4. 🔨 أضف معالجة الأخطاء المناسبة
5. 🔨 أضف loading states
6. 🔨 أضف تحديث تلقائي للبيانات

## ملاحظات مهمة

- جميع الـ endpoints تعمل وتم اختبارها
- قاعدة البيانات تحتوي على:
  - 4 AI Providers (OpenAI, Groq, Claude, HuggingFace)
  - 12 AI Models جاهزة للاستخدام
- استخدم TypeScript types من `@shared/schema` للتأكد من صحة البيانات
- React Query مثبت بالفعل ويمكن استخدامه مباشرة

---

**نصيحة:** ابدأ بتحديث صفحة واحدة (مثل Tasks) ثم طبق نفس النمط على باقي الصفحات.
