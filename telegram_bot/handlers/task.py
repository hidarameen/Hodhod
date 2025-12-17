"""
Task Management Handlers
Handle task creation, management, and monitoring
"""
from pyrogram.client import Client
from pyrogram import filters
from pyrogram.types import Message
from utils.database import db
from utils.error_handler import handle_errors, ErrorLogger
from handlers.admin import admin_only
import json

error_logger = ErrorLogger("task_handler")

def register_task_handlers(app: Client):
    """Register task management handlers"""
    
    @app.on_message(filters.command("create_task") & filters.private & admin_only)
    @handle_errors("task_handler", "create_task_command")
    async def create_task_command(client: Client, message: Message):
        """Create new forwarding task - interactive wizard"""
        await message.reply_text(
            "📝 **إنشاء مهمة توجيه جديدة**\n\n"
            "الرجاء استخدام لوحة التحكم Web لإنشاء مهام جديدة بسهولة أكبر.\n\n"
            "أو أرسل البيانات بالتنسيق التالي:\n"
            "```\n"
            "/create_task name=[اسم المهمة] sources=[1,2,3] targets=[4,5,6]\n"
            "```\n\n"
            "حيث:\n"
            "• name: اسم المهمة\n"
            "• sources: أرقام ID للقنوات المصدر (مفصولة بفواصل)\n"
            "• targets: أرقام ID للقنوات الهدف (مفصولة بفواصل)"
        )

    @app.on_message(filters.command("list_tasks") & filters.private & admin_only)
    @handle_errors("task_handler", "list_tasks_command")
    async def list_tasks_command(client: Client, message: Message):
        """List all forwarding tasks"""
        tasks = await db.fetch("SELECT * FROM forwarding_tasks ORDER BY created_at DESC")
        
        if not tasks:
            await message.reply_text("📋 لا توجد مهام حالياً\n\nاستخدم /create_task لإنشاء مهمة جديدة")
            return
        
        text = "📋 **قائمة مهام التوجيه:**\n\n"
        
        for task in tasks:
            status_icon = "🟢" if task['is_active'] else "🔴"
            ai_icon = "🤖" if task['ai_enabled'] else ""
            video_icon = "🎥" if task['video_processing_enabled'] else ""
            
            source_channels = task.get('source_channels') or []
            target_channels = task.get('target_channels') or []
            source_count = len(source_channels) if isinstance(source_channels, list) else 0
            target_count = len(target_channels) if isinstance(target_channels, list) else 0
            
            text += f"{status_icon} **{task['name']}** {ai_icon}{video_icon}\n"
            text += f"   ID: `{task['id']}`\n"
            text += f"   المصادر: {source_count} | الأهداف: {target_count}\n"
            text += f"   تم توجيهه: {task['total_forwarded']} رسالة\n\n"
        
        text += "\n💡 استخدم `/task_stats [id]` لعرض إحصائيات مهمة معينة"
        
        await message.reply_text(text)

    @app.on_message(filters.command("toggle_task") & filters.private & admin_only)
    @handle_errors("task_handler", "toggle_task_command")
    async def toggle_task_command(client: Client, message: Message):
        """Toggle task active status"""
        try:
            parts = message.text.split() if message.text else []
            if len(parts) < 2:
                await message.reply_text(
                    "❌ الاستخدام: `/toggle_task [task_id]`\n"
                    "مثال: `/toggle_task 1`"
                )
                return
            
            task_id = int(parts[1])
            
            # Get current task
            task = await db.get_task(task_id)
            if not task:
                await message.reply_text("❌ المهمة غير موجودة")
                return
            
            # Toggle status
            new_status = not task['is_active']
            await db.update_task(task_id, {"is_active": new_status})
            
            status_text = "✅ نشطة" if new_status else "⏸ معطلة"
            await message.reply_text(
                f"تم تحديث حالة المهمة **{task['name']}**\n"
                f"الحالة الجديدة: {status_text}"
            )
            
            # Update forwarding engine
            from services.forwarding_engine import forwarding_engine
            if forwarding_engine:
                if new_status:
                    await forwarding_engine.start_task_monitoring(task_id)
                else:
                    await forwarding_engine.stop_task_monitoring(task_id)
            
        except ValueError:
            await message.reply_text("❌ Task ID غير صحيح")
        except Exception as e:
            await message.reply_text(f"❌ خطأ: {str(e)}")

    @app.on_message(filters.command("delete_task") & filters.private & admin_only)
    @handle_errors("task_handler", "delete_task_command")
    async def delete_task_command(client: Client, message: Message):
        """Delete a task"""
        try:
            parts = message.text.split() if message.text else []
            if len(parts) < 2:
                await message.reply_text(
                    "❌ الاستخدام: `/delete_task [task_id]`\n"
                    "مثال: `/delete_task 1`"
                )
                return
            
            task_id = int(parts[1])
            
            # Get task
            task = await db.get_task(task_id)
            if not task:
                await message.reply_text("❌ المهمة غير موجودة")
                return
            
            # Delete task
            await db.delete_task(task_id)
            
            await message.reply_text(
                f"🗑 تم حذف المهمة **{task['name']}** بنجاح"
            )
            
            user_id = message.from_user.id if message.from_user else "unknown"
            error_logger.log_info(f"Task {task_id} deleted by admin {user_id}")
            
        except ValueError:
            await message.reply_text("❌ Task ID غير صحيح")
        except Exception as e:
            await message.reply_text(f"❌ خطأ: {str(e)}")

    @app.on_message(filters.command("task_stats") & filters.private & admin_only)
    @handle_errors("task_handler", "task_stats_command")
    async def task_stats_command(client: Client, message: Message):
        """Show task statistics"""
        try:
            parts = message.text.split() if message.text else []
            if len(parts) < 2:
                await message.reply_text(
                    "❌ الاستخدام: `/task_stats [task_id]`\n"
                    "مثال: `/task_stats 1`"
                )
                return
            
            task_id = int(parts[1])
            
            # Get task
            task = await db.get_task(task_id)
            if not task:
                await message.reply_text("❌ المهمة غير موجودة")
                return
            
            # Get statistics
            stats = await db.get_task_stats(task_id, days=7)
            
            status_icon = "🟢" if task['is_active'] else "🔴"
            
            text = f"""
📊 **إحصائيات المهمة: {task['name']}**

**الحالة:** {status_icon} {'نشطة' if task['is_active'] else 'معطلة'}

**إحصائيات عامة:**
• إجمالي الرسائل الموجهة: {task['total_forwarded']}
• آخر توجيه: {task['last_forwarded_at'] or 'لم يتم بعد'}

**الإعدادات:**
• الذكاء الصناعي: {'🤖 مفعل' if task['ai_enabled'] else '❌ معطل'}
• معالجة الفيديو: {'🎥 مفعلة' if task['video_processing_enabled'] else '❌ معطلة'}

**إحصائيات آخر 7 أيام:**
"""
            
            if stats:
                for stat in stats:
                    text += f"\n📅 {stat['date']}:\n"
                    text += f"   • موجهة: {stat['messages_forwarded']}\n"
                    text += f"   • معالجة: {stat['messages_processed']}\n"
                    if task['ai_enabled']:
                        text += f"   • AI: {stat['ai_processed']}\n"
                    if task['video_processing_enabled']:
                        text += f"   • فيديو: {stat['video_processed']}\n"
                    if stat['errors'] > 0:
                        text += f"   • ⚠️ أخطاء: {stat['errors']}\n"
            else:
                text += "\n📋 لا توجد إحصائيات بعد"
            
            await message.reply_text(text)
            
        except ValueError:
            await message.reply_text("❌ Task ID غير صحيح")
        except Exception as e:
            await message.reply_text(f"❌ خطأ: {str(e)}")

    @app.on_message(filters.command("test_task") & filters.private & admin_only)
    @handle_errors("task_handler", "test_task_command")
    async def test_task_command(client: Client, message: Message):
        """Test a task"""
        try:
            parts = message.text.split() if message.text else []
            if len(parts) < 2:
                await message.reply_text(
                    "❌ الاستخدام: `/test_task [task_id]`\n"
                    "مثال: `/test_task 1`"
                )
                return
            
            task_id = int(parts[1])
            
            # Get task
            task = await db.get_task(task_id)
            if not task:
                await message.reply_text("❌ المهمة غير موجودة")
                return
            
            source_channels = task.get('source_channels') or []
            target_channels = task.get('target_channels') or []
            source_count = len(source_channels) if isinstance(source_channels, list) else 0
            target_count = len(target_channels) if isinstance(target_channels, list) else 0
            
            await message.reply_text(
                f"🧪 **اختبار المهمة: {task['name']}**\n\n"
                f"أرسل رسالة اختبار إلى القناة المصدر وسيتم توجيهها تلقائياً.\n\n"
                f"المصادر: {source_count}\n"
                f"الأهداف: {target_count}"
            )
            
        except ValueError:
            await message.reply_text("❌ Task ID غير صحيح")
        except Exception as e:
            await message.reply_text(f"❌ خطأ: {str(e)}")
