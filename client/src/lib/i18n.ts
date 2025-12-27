import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: {
          "app": {
            "name": "Eagle",
            "subtitle": "Multi-Task Bot"
          },
          "nav": {
            "overview": "Overview",
            "tasks": "Forwarding Tasks",
            "channels": "Channels & Sources",
            "ai": "AI Neural Core",
            "settings": "System Settings",
            "disconnect": "Disconnect",
            "system_load": "System Load"
          },
          "dashboard": {
            "title": "System Overview",
            "subtitle": "Real-time metrics and operational status",
            "uptime": "UPTIME",
            "total_messages": "Total Messages",
            "active_tasks": "Active Tasks",
            "ai_operations": "AI Operations",
            "monitored_channels": "Monitored Channels",
            "throughput": "Throughput Analysis",
            "live_logs": "Live Logs"
          },
          "auth": {
            "admin_username": "Admin Username",
            "admin_password": "Admin Password",
            "username_placeholder": "Enter admin username",
            "initialize_session": "Initialize Session",
            "authenticating": "Authenticating..."
          },
          "common": {
            "latency": "LATENCY",
            "system_online": "System Online",
            "admin_user": "Admin User",
            "level_access": "Level 5 Access"
          }
        }
      },
      ar: {
        translation: {
          "app": {
            "name": "صقر",
            "subtitle": "بوت متعدد المهام"
          },
          "nav": {
            "overview": "نظرة عامة",
            "tasks": "مهام التوجيه",
            "channels": "القنوات والمصادر",
            "ai": "الذكاء الاصطناعي",
            "settings": "إعدادات النظام",
            "disconnect": "تسجيل الخروج",
            "system_load": "حمل النظام"
          },
          "auth": {
            "admin_username": "اسم المستخدم",
            "admin_password": "كلمة المرور",
            "username_placeholder": "أدخل اسم المستخدم",
            "initialize_session": "بدء الجلسة",
            "authenticating": "جاري التحقق..."
          },
          "dashboard": {
            "title": "لوحة القيادة",
            "subtitle": "المقاييس الحية وحالة النظام",
            "uptime": "وقت التشغيل",
            "total_messages": "إجمالي الرسائل",
            "active_tasks": "المهام النشطة",
            "ai_operations": "عمليات الذكاء الاصطناعي",
            "monitored_channels": "القنوات المراقبة",
            "throughput": "تحليل البيانات",
            "live_logs": "سجل الأحداث الحي"
          },
          "common": {
            "latency": "التأخير",
            "system_online": "النظام متصل",
            "admin_user": "المشرف",
            "level_access": "صلاحية مستوى 5"
          }
        }
      }
    },
    lng: "ar", 
    fallbackLng: "ar",
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;
