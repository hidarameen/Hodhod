# دليل الإعداد الشامل 🚀

هذا دليل مفصل لإعداد وتشغيل نظام بوت التوجيه الذكي.

## المتطلبات الأساسية 📋

### 1. برامج مطلوبة

- **Node.js** 18.0 أو أحدث
- **Python** 3.11 أو أحدث
- **PostgreSQL** 13 أو أحدث
- **FFmpeg** (لمعالجة الفيديو)
- **Git**

### 2. حسابات مطلوبة

- حساب Telegram (للحصول على API keys)
- حساب في BotFather (لإنشاء البوت)
- (اختياري) API keys لـ:
  - OpenAI
  - Groq
  - Anthropic (Claude)
  - HuggingFace

## خطوات الإعداد 🛠️

### الخطوة 1: إنشاء بوت Telegram

1. افتح Telegram وابحث عن **@BotFather**
2. أرسل الأمر `/newbot`
3. اتبع التعليمات لإنشاء البوت
4. احفظ **Bot Token** الذي تحصل عليه

### الخطوة 2: الحصول على API ID و API Hash

1. اذهب إلى https://my.telegram.org/
2. سجل الدخول برقم هاتفك
3. اذهب إلى "API development tools"
4. أنشئ تطبيق جديد
5. احفظ **API ID** و **API Hash**

### الخطوة 3: معرفة User ID الخاص بك

1. افتح بوت **@userinfobot** في Telegram
2. أرسل أي رسالة
3. سيرد عليك برقم User ID الخاص بك
4. احفظ هذا الرقم (ستستخدمه كـ BOT_ADMIN_ID)

### الخطوة 4: تثبيت المكتبات

#### Node.js
```bash
npm install
```

#### Python
```bash
cd telegram_bot
pip install -r requirements.txt
```

#### تثبيت FFmpeg

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

**Windows:**
قم بتحميل FFmpeg من الموقع الرسمي: https://ffmpeg.org/download.html

### الخطوة 5: إعداد قاعدة البيانات

#### إنشاء قاعدة بيانات PostgreSQL

```bash
# قم بتشغيل PostgreSQL
sudo service postgresql start

# أنشئ قاعدة بيانات جديدة
createdb telegram_bot

# أو عبر psql
psql -U postgres
CREATE DATABASE telegram_bot;
\q
```

### الخطوة 6: إعداد ملفات البيئة

#### 1. في المجلد الرئيسي (للواجهة Web)

أنشئ ملف `.env`:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/telegram_bot
NODE_ENV=development
```

#### 2. في مجلد telegram_bot (للبوت)

أنشئ ملف `telegram_bot/.env`:
```env
# Telegram Bot
BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
API_ID=12345678
API_HASH=abcdef1234567890abcdef1234567890
BOT_ADMIN_ID=987654321

# Database
DATABASE_URL=postgresql://username:password@localhost:5432/telegram_bot

# AI Providers (اختياري - أضف ما تحتاجه فقط)
OPENAI_API_KEY=sk-...
GROQ_API_KEY=gsk_...
ANTHROPIC_API_KEY=sk-ant-...
HUGGINGFACE_API_KEY=hf_...

# Redis (اختياري للمشاريع الكبيرة)
REDIS_URL=redis://localhost:6379/0

# Webhook (اختياري)
WEBHOOK_URL=https://yourdomain.com/webhook
WEBHOOK_PORT=8443
USE_WEBHOOK=false

# API Server
API_HOST=0.0.0.0
API_PORT=8000

# Workers
MAX_WORKERS=10
QUEUE_MAX_SIZE=1000
```

### الخطوة 7: إعداد قاعدة البيانات

```bash
# إنشاء الجداول
npm run db:push

# إضافة البيانات الافتراضية (AI providers and models)
npx tsx server/seed.ts
```

### الخطوة 8: إنشاء حساب مستخدم

```bash
# تشغيل الواجهة
npm run dev

# في متصفح آخر، افتح:
# http://localhost:5000/auth

# سجل حساب جديد:
# Username: admin
# Password: اختر كلمة مرور قوية
```

## التشغيل 🚀

### تشغيل الواجهة Web و API

```bash
npm run dev
```

ستعمل على: http://localhost:5000

### تشغيل بوت Telegram

```bash
cd telegram_bot
python main.py
```

## الاختبار ✅

### 1. اختبار البوت

1. افتح Telegram وابحث عن البوت الذي أنشأته
2. أرسل `/start`
3. يجب أن يرد عليك البوت بقائمة الأوامر

### 2. اختبار الواجهة

1. افتح http://localhost:5000
2. سجل الدخول
3. تحقق من ظهور لوحة التحكم

### 3. اختبار الاتصال بقاعدة البيانات

```bash
# في مجلد البوت
cd telegram_bot
python -c "import asyncio; from utils.database import db; asyncio.run(db.connect()); print('✅ Database connected')"
```

## إعداد الإنتاج (Production) 🏭

### 1. استخدام Webhook بدلاً من Polling

في ملف `telegram_bot/.env`:
```env
USE_WEBHOOK=true
WEBHOOK_URL=https://yourdomain.com/webhook
WEBHOOK_PORT=8443
```

### 2. استخدام Redis للـ Queues

```bash
# تثبيت Redis
sudo apt install redis-server

# تشغيل Redis
redis-server
```

في ملف `.env`:
```env
REDIS_URL=redis://localhost:6379/0
```

### 3. استخدام Process Manager

#### PM2 للنود
```bash
npm install -g pm2
pm2 start npm --name "telegram-web" -- run start
```

#### Systemd للبوت
أنشئ ملف `/etc/systemd/system/telegram-bot.service`:
```ini
[Unit]
Description=Telegram Forwarding Bot
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/telegram_bot
Environment="PATH=/usr/bin:/usr/local/bin"
ExecStart=/usr/bin/python3 main.py
Restart=always

[Install]
WantedBy=multi-user.target
```

ثم:
```bash
sudo systemctl enable telegram-bot
sudo systemctl start telegram-bot
sudo systemctl status telegram-bot
```

## حل المشاكل الشائعة 🔧

### البوت لا يستجيب

1. تأكد من صحة BOT_TOKEN
2. تأكد من أن BOT_ADMIN_ID صحيح
3. تحقق من السجلات: `telegram_bot/logs/bot.log`

### خطأ في قاعدة البيانات

1. تأكد من أن PostgreSQL يعمل
2. تأكد من صحة DATABASE_URL
3. تحقق من الصلاحيات
4. حاول إعادة إنشاء الجداول: `npm run db:push`

### معالجة الفيديو لا تعمل

1. تأكد من تثبيت ffmpeg: `ffmpeg -version`
2. تأكد من توفر مساحة كافية في `/tmp`
3. تحقق من حجم الفيديو (قد تحتاج لزيادة الحد الأقصى)

### الواجهة Web لا تعمل

1. تأكد من تشغيل `npm run dev`
2. تحقق من المنفذ 5000
3. افحص سجلات المتصفح (F12 > Console)

## الأمان 🔐

### نصائح أمنية

1. **لا تشارك** ملف `.env` أبداً
2. استخدم كلمات مرور قوية
3. فعّل HTTPS في الإنتاج
4. حدث المكتبات بانتظام:
   ```bash
   npm update
   pip install --upgrade -r requirements.txt
   ```
5. راجع السجلات بانتظام

### Firewall

```bash
# السماح فقط بالمنافذ الضرورية
sudo ufw allow 5000/tcp  # Webapp
sudo ufw allow 8443/tcp  # Webhook
sudo ufw allow 5432/tcp  # PostgreSQL (إذا كان على خادم منفصل)
sudo ufw enable
```

## النسخ الاحتياطي 💾

### قاعدة البيانات

```bash
# إنشاء نسخة احتياطية
pg_dump -U username telegram_bot > backup_$(date +%Y%m%d).sql

# استعادة من نسخة احتياطية
psql -U username telegram_bot < backup_20231130.sql
```

### ملفات البوت

```bash
# نسخ احتياطي للإعدادات والسجلات
tar -czf bot_backup_$(date +%Y%m%d).tar.gz telegram_bot/.env telegram_bot/logs/
```

## المراقبة والصيانة 📊

### مراقبة الأداء

```bash
# فحص استخدام CPU والذاكرة
top
htop

# فحص مساحة القرص
df -h

# فحص حالة PostgreSQL
sudo systemctl status postgresql

# فحص سجلات البوت
tail -f telegram_bot/logs/bot.log
```

### التحديثات

```bash
# تحديث المكتبات
git pull
npm install
cd telegram_bot && pip install -r requirements.txt

# إعادة تشغيل الخدمات
sudo systemctl restart telegram-bot
pm2 restart telegram-web
```

## الدعم 💬

للحصول على المساعدة:
- افتح Issue على GitHub
- راجع الوثائق في README.md
- تحقق من السجلات للأخطاء التفصيلية

---

**تم بنجاح! 🎉** الآن لديك نظام توجيه Telegram متكامل مع ذكاء صناعي!
