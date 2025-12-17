"""
Admin Handlers
Handle admin-only commands for bot management
"""
from pyrogram.client import Client
from pyrogram import filters
from pyrogram.types import Message
from utils.database import db
from utils.error_handler import handle_errors, ErrorLogger
from config.settings import settings

error_logger = ErrorLogger("admin_handler")

# Admin filter
async def admin_filter(_, __, message: Message) -> bool:
    """Filter to check if user is admin"""
    if not message.from_user:
        return False
    
    return await db.is_admin(message.from_user.id)

admin_only = filters.create(admin_filter)

def register_admin_handlers(app: Client):
    """Register admin command handlers"""
    
    @app.on_message(filters.command("start") & filters.private & admin_only)
    @handle_errors("admin_handler", "start_command")
    async def start_command(client: Client, message: Message):
        """Start command - welcome message"""
        welcome_text = """
🤖 **مرحباً بك في بوت التوجيه الذكي**

أوامر متاحة:
📋 /tasks - إدارة مهام التوجيه
📡 /channels - إدارة القنوات والمصادر
🤖 /ai - إعدادات الذكاء الصناعي
👥 /admins - إدارة المشرفين
📊 /stats - إحصائيات النظام
⚙️ /settings - الإعدادات

استخدم /help للمزيد من المعلومات
"""
        await message.reply_text(welcome_text)

    @app.on_message(filters.command("help") & filters.private & admin_only)
    @handle_errors("admin_handler", "help_command")
    async def help_command(client: Client, message: Message):
        """Help command - detailed instructions"""
        help_text = """
📖 **دليل استخدام البوت**

**إدارة المهام:**
• /create_task - إنشاء مهمة توجيه جديدة
• /list_tasks - عرض جميع المهام
• /toggle_task [id] - تفعيل/تعطيل مهمة
• /delete_task [id] - حذف مهمة
• /task_stats [id] - إحصائيات مهمة

**إدارة القنوات:**
• /add_channel - إضافة قناة/مجموعة
• /add_website - إضافة موقع إلكتروني
• /list_channels - عرض جميع المصادر

**إدارة الذكاء الصناعي:**
• /add_rule [task_id] - إضافة قاعدة AI لمهمة
• /list_rules [task_id] - عرض قواعد مهمة
• /toggle_ai [task_id] - تفعيل/تعطيل AI لمهمة

**إدارة المشرفين:**
• /add_admin [user_id] - إضافة مشرف جديد
• /list_admins - عرض جميع المشرفين

**إحصائيات:**
• /stats - إحصائيات النظام العامة
• /queue_stats - حالة نظام الطوابير
"""
        await message.reply_text(help_text)

    @app.on_message(filters.command("add_admin") & filters.private & admin_only)
    @handle_errors("admin_handler", "add_admin_command")
    async def add_admin_command(client: Client, message: Message):
        """Add new admin"""
        try:
            # Extract user ID from command
            parts = message.text.split()
            if len(parts) < 2:
                await message.reply_text(
                    "❌ الاستخدام: `/add_admin [user_id]`\n"
                    "مثال: `/add_admin 123456789`"
                )
                return
            
            new_admin_id = int(parts[1])
            
            # Check if already admin
            if await db.is_admin(new_admin_id):
                await message.reply_text("⚠️ هذا المستخدم مشرف بالفعل")
                return
            
            # Add admin
            await db.add_admin(
                telegram_id=new_admin_id,
                added_by=message.from_user.id if message.from_user else None
            )
            
            await message.reply_text(
                f"✅ تمت إضافة المشرف بنجاح!\n"
                f"User ID: `{new_admin_id}`"
            )
            
            error_logger.log_info(
                f"Admin {message.from_user.id if message.from_user else 'unknown'} added new admin {new_admin_id}"
            )
            
        except ValueError:
            await message.reply_text("❌ User ID غير صحيح")
        except Exception as e:
            await message.reply_text(f"❌ خطأ: {str(e)}")

    @app.on_message(filters.command("list_admins") & filters.private & admin_only)
    @handle_errors("admin_handler", "list_admins_command")
    async def list_admins_command(client: Client, message: Message):
        """List all admins"""
        admins = await db.get_admins()
        
        if not admins:
            await message.reply_text("📋 لا يوجد مشرفين حالياً")
            return
        
        text = "👥 **قائمة المشرفين:**\n\n"
        for admin in admins:
            username = f"@{admin['username']}" if admin['username'] else "N/A"
            text += f"• ID: `{admin['telegram_id']}` - {username}\n"
        
        await message.reply_text(text)

    @app.on_message(filters.command("stats") & filters.private & admin_only)
    @handle_errors("admin_handler", "stats_command")
    async def stats_command(client: Client, message: Message):
        """Show system statistics"""
        # Get statistics
        tasks = await db.get_active_tasks()
        channels = await db.get_channels()
        
        # Get queue stats
        from services.queue_system import queue_manager
        queue_stats = queue_manager.get_stats()
        
        text = f"""
📊 **إحصائيات النظام**

**المهام:**
• نشطة: {len([t for t in tasks if t['is_active']])}
• معطلة: {len([t for t in tasks if not t['is_active']])}
• إجمالي: {len(tasks)}

**المصادر:**
• القنوات: {len([c for c in channels if c['type'] in ['telegram_channel', 'telegram_group']])}
• المواقع: {len([c for c in channels if c['type'] == 'website'])}
• إجمالي: {len(channels)}

**نظام الطوابير:**
• Workers نشطة: {queue_stats['active_workers']}/{queue_stats['max_workers']}
• حالة النظام: {'🟢 يعمل' if queue_stats['is_running'] else '🔴 متوقف'}

🌐 **استخدم لوحة التحكم Web للمزيد من التفاصيل**
"""
        
        await message.reply_text(text)

    @app.on_message(filters.command("queue_stats") & filters.private & admin_only)
    @handle_errors("admin_handler", "queue_stats_command")
    async def queue_stats_command(client: Client, message: Message):
        """Show queue system statistics"""
        from services.queue_system import queue_manager
        
        stats = queue_manager.get_stats()
        
        # Get pending jobs count
        pending_jobs = await db.get_pending_jobs(limit=1000)
        
        text = f"""
⚙️ **إحصائيات نظام الطوابير**

**Workers:**
• نشطة: {stats['active_workers']}
• إجمالي: {stats['total_workers']}
• الحد الأقصى: {stats['max_workers']}

**المهام في الانتظار:**
• عدد المهام: {len(pending_jobs)}

**حالة النظام:**
• {' 🟢 يعمل بكفاءة' if stats['is_running'] else '🔴 متوقف'}
"""
        
        await message.reply_text(text)

    # Unauthorized access handler
    @app.on_message(filters.command(["start", "help", "tasks", "admins", "stats"]) & filters.private & ~admin_only)
    @handle_errors("admin_handler", "unauthorized_access")
    async def unauthorized_access(client: Client, message: Message):
        """Handle unauthorized access attempts"""
        user_id = message.from_user.id if message.from_user else "unknown"
        await message.reply_text(
            "⛔️ **الوصول محظور**\n\n"
            "هذا البوت مخصص للمشرفين فقط.\n"
            f"User ID الخاص بك: `{user_id}`"
        )
        
        error_logger.log_warning(
            f"Unauthorized access attempt by {user_id}"
        )
