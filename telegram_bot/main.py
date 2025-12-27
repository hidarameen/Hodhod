"""
Main Bot Application
Telegram Userbot with Pyrofork - Full Logging Support
Runs in userbot mode to receive channel messages (bot_token cannot receive channel_post)
"""
import asyncio
import signal
import sys
import traceback
from datetime import datetime
from typing import Dict, Any

# Use Pyrofork (maintained Pyrogram fork)
from pyrogram.client import Client
from pyrogram.types import Message
from pyrogram import filters
from pyrogram.errors import FloodWait, RPCError, AuthKeyUnregistered
from config.settings import settings
from utils.database import db
from utils.error_handler import ErrorLogger
from utils.channel_utils import normalize_channel_id
from utils.error_logger_db import db_error_logger
from services.queue_system import queue_manager
from services.forwarding_engine import ForwardingEngine
from services.video_processor import video_processor
from services.ai_providers import ai_manager
from handlers import admin, task

error_logger = ErrorLogger("main")

def log_detailed(level: str, component: str, function: str, message: str, data: dict | None = None):
    """Log with full details - single output only to avoid duplication"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    log_msg = f"[{timestamp}] [{level.upper()}] [{component}::{function}] {message}"
    if data:
        log_msg += f" | Data: {data}"
    print(log_msg)

# Global client - will be initialized with session from database
app: Client | None = None
session_string: str | None = None

async def get_active_session() -> str | None:
    """Load active session string from database"""
    try:
        await db.connect()
        assert db.pool is not None, "Database pool not initialized"
        result = await db.pool.fetchrow("""
            SELECT session_string FROM userbot_sessions 
            WHERE is_active = true AND is_primary = true AND session_string IS NOT NULL
            ORDER BY updated_at DESC LIMIT 1
        """)
        if result and result['session_string']:
            log_detailed("info", "session", "load", "Found active session in database")
            return result['session_string']
        log_detailed("info", "session", "load", "No active session found - userbot login required")
        return None
    except Exception as e:
        log_detailed("error", "session", "load", f"Failed to load session: {str(e)}")
        return None

def create_client(session: str | None = None) -> Client:
    """Create Pyrogram client with optional session"""
    log_detailed("info", "main", "init", "Creating Pyrofork client", {
        "api_id": settings.API_ID,
        "has_session": bool(session),
        "api_hash_set": bool(settings.API_HASH)
    })
    
    if session:
        return Client(
            name="userbot_forwarder",
            api_id=settings.API_ID,
            api_hash=settings.API_HASH,
            session_string=session,
            in_memory=True
        )
    else:
        return Client(
            name="userbot_forwarder",
            api_id=settings.API_ID,
            api_hash=settings.API_HASH,
            in_memory=True
        )

# Global forwarding engine instance
forwarding_engine: ForwardingEngine | None = None
is_running = True

def normalize_task_config(task: Dict[str, Any]) -> Dict[str, Any]:
    """Convert API camelCase field names to Python snake_case for forwarding engine"""
    config = dict(task)
    
    # Map camelCase field names from API to snake_case for Python
    field_mappings = {
        'summarizationProviderId': 'summarization_provider_id',
        'summarizationModelId': 'summarization_model_id',
        'aiProviderId': 'ai_provider_id',
        'aiModelId': 'ai_model_id',
        'videoAiProviderId': 'video_ai_provider_id',
        'videoAiModelId': 'video_ai_model_id',
        'videoProcessingEnabled': 'video_processing_enabled',
        'audioProcessingEnabled': 'audio_processing_enabled',
        'linkProcessingEnabled': 'link_processing_enabled',
        'aiEnabled': 'ai_enabled',
        'summarizationEnabled': 'summarization_enabled',
    }
    
    # Apply mappings
    for camel_name, snake_name in field_mappings.items():
        if camel_name in config:
            config[snake_name] = config[camel_name]
    
    return config

def register_handlers(client: Client):
    """Register all message handlers on the client dynamically"""
    log_detailed("info", "handlers", "register", "Registering message handlers...")
    
    @client.on_message(filters.channel | filters.group)
    async def handle_channel_message(c: Client, message: Message):
        """Handle incoming messages from monitored channels"""
        global forwarding_engine
        
        chat_id = str(message.chat.id)
        chat_title = message.chat.title or "Unknown"
        message_id = message.id
        message_type = "text" if message.text else "media" if message.media else "other"
        
        log_detailed("info", "message_handler", "receive", f"📩 New message received", {
            "chat_id": chat_id,
            "chat_title": chat_title,
            "message_id": message_id,
            "message_type": message_type,
            "has_text": bool(message.text),
            "has_caption": bool(message.caption),
            "media_type": str(message.media) if message.media else None,
            "media_group_id": message.media_group_id
        })
        
        try:
            # Find tasks with this chat as source
            log_detailed("info", "message_handler", "process", "Fetching active tasks...")
            tasks = await db.get_active_tasks()
            log_detailed("info", "message_handler", "process", f"Found {len(tasks)} tasks to check")
            
            matched_task = None
            for task_item in tasks:
                if not task_item['is_active']:
                    continue
                
                source_channels = task_item.get('source_channels', [])
                log_detailed("debug", "message_handler", "match", f"Checking task: {task_item['name']}", {
                    "task_id": task_item['id'],
                    "source_channels": source_channels
                })
                
                # Check if this channel is in task sources
                for source_id in source_channels:
                    source_channel = await db.get_channel(source_id)
                    
                    if source_channel:
                        log_detailed("debug", "message_handler", "match", "Comparing channel", {
                            "source_id": source_id,
                            "source_identifier": source_channel['identifier'],
                            "incoming_chat_id": chat_id,
                            "match": source_channel['identifier'] == chat_id
                        })
                        
                        if source_channel['identifier'] == chat_id:
                            matched_task = task_item
                            log_detailed("info", "message_handler", "match", f"✅ Task matched!", {
                                "task_name": task_item['name'],
                                "task_id": task_item['id']
                            })
                            break
                
                if matched_task:
                    break
            
            if matched_task:
                if forwarding_engine:
                    log_detailed("info", "message_handler", "forward", "Starting message forwarding...", {
                        "task_id": matched_task['id'],
                        "target_channels": matched_task.get('target_channels', [])
                    })
                    
                    await forwarding_engine.forward_message(
                        message=message,
                        task_id=matched_task['id'],
                        task_config=normalize_task_config(matched_task)
                    )
                    
                    log_detailed("info", "message_handler", "forward", "✅ Message forwarded successfully")
                else:
                    log_detailed("error", "message_handler", "forward", "Forwarding engine not initialized!")
            else:
                log_detailed("info", "message_handler", "skip", f"No matching task for chat: {chat_title}", {
                    "chat_id": chat_id
                })
            
        except Exception as e:
            error_msg = str(e)
            trace = traceback.format_exc()
            log_detailed("error", "message_handler", "error", f"Message handling error: {error_msg}", {
                "chat_id": chat_id,
                "message_id": message_id,
                "traceback": trace
            })
            # Log to database
            await db_error_logger.log_error(
                component="bot",
                function="handle_channel_message",
                error_type=type(e).__name__,
                error_message=error_msg,
                stack_trace=trace,
                metadata={"chat_id": chat_id, "message_id": message_id}
            )
    
    @client.on_message(filters.command("status") & filters.private)
    async def check_status_cmd(c: Client, message: Message):
        """Check bot status"""
        user_id = message.from_user.id
        log_detailed("info", "command", "status", f"Status check requested", {"user_id": user_id})
        
        try:
            tasks = await db.get_active_tasks()
            active_tasks = [t for t in tasks if t['is_active']]
            channels = await db.get_channels()
            
            status_msg = f"""
👤 **حالة اليوزربوت**

✅ اليوزربوت يعمل بنجاح
📊 إحصائيات:
- المهام النشطة: {len(active_tasks)}
- إجمالي القنوات: {len(channels)}
- نظام العمال: يعمل

⏰ الوقت: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
"""
            await message.reply(status_msg)
            
        except Exception as e:
            log_detailed("error", "command", "status", f"Status check error: {str(e)}")
            await message.reply(f"❌ خطأ: {str(e)}")
    
    log_detailed("info", "handlers", "register", "✅ All handlers registered successfully")

async def initialize_bot():
    """Initialize all bot components"""
    global forwarding_engine
    
    # Connect to database error logger
    await db_error_logger.connect()
    
    log_detailed("info", "main", "initialize_bot", "Starting bot initialization...")
    
    try:
        # Connect to database
        log_detailed("info", "database", "connect", "Connecting to database...")
        await db.connect()
        log_detailed("info", "database", "connect", "Database connected successfully")
        
        # Initialize AI providers from database
        log_detailed("info", "ai_manager", "init", "Loading AI providers from database...")
        await ai_manager.initialize_from_database()
        log_detailed("info", "ai_manager", "init", "AI providers loaded successfully")
        
        # Initialize admin if not exists
        if settings.BOT_ADMIN_ID:
            log_detailed("info", "admin", "check", f"Checking admin status for ID: {settings.BOT_ADMIN_ID}")
            if not await db.is_admin(settings.BOT_ADMIN_ID):
                await db.add_admin(settings.BOT_ADMIN_ID, "Main Admin")
                log_detailed("info", "admin", "add", f"Main admin added: {settings.BOT_ADMIN_ID}")
            else:
                log_detailed("info", "admin", "check", f"Admin already exists: {settings.BOT_ADMIN_ID}")
        
        # Initialize forwarding engine
        log_detailed("info", "forwarding_engine", "init", "Initializing forwarding engine...")
        assert app is not None, "Pyrogram client not initialized"
        forwarding_engine = ForwardingEngine(app)
        
        # Make it accessible globally
        import services.forwarding_engine as fe_module
        fe_module.forwarding_engine = forwarding_engine
        log_detailed("info", "forwarding_engine", "init", "Forwarding engine initialized successfully")
        
        # Register queue job handlers
        log_detailed("info", "queue_manager", "register", "Registering job handlers...")
        queue_manager.register_handler("forward", handle_forward_job)
        queue_manager.register_handler("ai_process", handle_ai_job)
        queue_manager.register_handler("video_process", handle_video_job)
        log_detailed("info", "queue_manager", "register", "All handlers registered: forward, ai_process, video_process")
        
        # Start queue manager
        log_detailed("info", "queue_manager", "start", "Starting queue manager...")
        await queue_manager.start()
        log_detailed("info", "queue_manager", "start", "Queue manager started with 10 workers")
        
        # Load and monitor active tasks
        await load_active_tasks()
        
        log_detailed("info", "main", "initialize_bot", "✅ Bot initialization completed successfully")
        
    except Exception as e:
        log_detailed("error", "main", "initialize_bot", f"Initialization error: {str(e)}", {
            "traceback": traceback.format_exc()
        })
        raise

async def warmup_channel_peers():
    """
    Warm up channel peers by loading all dialogs first, then verifying channels.
    This populates Pyrogram's peer cache to resolve PEER_ID_INVALID errors.
    NOTE: Failures here don't block bot startup - they're non-critical.
    """
    log_detailed("info", "warmup", "start", "Starting channel peer warmup...")
    
    try:
        assert app is not None, "Pyrogram client not initialized"
        
        # Step 1: Load ALL dialogs to populate the peer cache
        log_detailed("info", "warmup", "dialogs", "Loading all dialogs to populate peer cache...")
        dialog_count = 0
        cached_ids = set()
        
        async for dialog in app.get_dialogs():
            dialog_count += 1
            cached_ids.add(dialog.chat.id)
            if dialog_count % 50 == 0:
                log_detailed("debug", "warmup", "dialogs", f"Loaded {dialog_count} dialogs...")
        
        log_detailed("info", "warmup", "dialogs", f"✅ Cached {dialog_count} dialogs in peer cache")
        
        # Step 2: Verify channels from database are accessible
        channels = await db.get_channels()
        log_detailed("info", "warmup", "channels", f"Found {len(channels)} channels to verify")
        
        if not channels:
            log_detailed("info", "warmup", "skip", "No channels to verify - skipping")
            return
        
        warmed_up = 0
        failed = 0
        
        for channel in channels:
            channel_id = channel.get('identifier', '')
            channel_title = channel.get('title', 'Unknown')
            
            if not channel_id:
                log_detailed("debug", "warmup", "skip", f"Channel {channel_title} has no identifier - skipping")
                continue
            
            try:
                chat_id = int(channel_id)
                
                # Check if already in cache from dialogs
                if chat_id in cached_ids:
                    log_detailed("info", "warmup", "cached", f"✅ {channel_title} already in peer cache")
                    warmed_up += 1
                    continue
                
                # Try to get the chat to add it to cache
                chat = await app.get_chat(chat_id)
                chat_title = getattr(chat, 'title', 'Unknown')
                log_detailed("info", "warmup", "success", f"✅ Warmed up: {chat_title} ({chat_id})")
                warmed_up += 1
                
            except Exception as e:
                error_msg = str(e)
                if 'CHANNEL_INVALID' in error_msg or 'PEER_ID_INVALID' in error_msg:
                    log_detailed("warning", "warmup", "failed", f"❌ Failed to warm up {channel_title}: {error_msg[:80]}")
                elif 'CHANNEL_PRIVATE' in error_msg or 'private' in error_msg.lower():
                    log_detailed("debug", "warmup", "private", f"⏭ Channel {channel_title} is private/inaccessible")
                else:
                    log_detailed("warning", "warmup", "failed", f"❌ Failed to warm up {channel_title}: {error_msg[:80]}")
                failed += 1
        
        log_detailed("info", "warmup", "complete", f"✅ Warmup complete: {warmed_up} success, {failed} failed")
        
    except Exception as e:
        # Don't let warmup errors crash the bot
        log_detailed("warning", "warmup", "error", f"Warmup encountered error but bot will continue: {str(e)[:100]}")

async def load_active_tasks():
    """Load and start monitoring active tasks"""
    global forwarding_engine
    
    log_detailed("info", "tasks", "load", "Loading active tasks from database...")
    
    try:
        tasks = await db.get_active_tasks()
        log_detailed("info", "tasks", "load", f"Found {len(tasks)} tasks in database")
        
        active_count = 0
        for task_item in tasks:
            task_id = task_item['id']
            task_name = task_item['name']
            is_active = task_item['is_active']
            source_channels = task_item.get('source_channels', [])
            target_channels = task_item.get('target_channels', [])
            
            log_detailed("info", "tasks", "check", f"Checking task: {task_name}", {
                "task_id": task_id,
                "is_active": is_active,
                "source_channels": source_channels,
                "target_channels": target_channels
            })
            
            if is_active and forwarding_engine:
                await forwarding_engine.start_task_monitoring(task_id)
                active_count += 1
                log_detailed("info", "tasks", "monitor", f"Started monitoring task: {task_name}", {
                    "task_id": task_id
                })
        
        log_detailed("info", "tasks", "load", f"Loaded {active_count} active tasks for monitoring")
        
    except Exception as e:
        log_detailed("error", "tasks", "load", f"Error loading tasks: {str(e)}", {
            "traceback": traceback.format_exc()
        })

# Queue job handlers
async def handle_forward_job(job: dict) -> dict:
    """Handle message forwarding job"""
    job_id = job.get('id', 'unknown')
    log_detailed("info", "job_handler", "forward", f"Processing forward job", {"job_id": job_id})
    
    try:
        payload = job['payload']
        task_id = job.get('task_id')
        
        log_detailed("info", "job_handler", "forward", "Job payload received", {
            "task_id": task_id,
            "payload_keys": list(payload.keys()) if payload else []
        })
        
        if task_id is None:
            log_detailed("error", "job_handler", "forward", "Task ID is missing")
            return {"status": "error", "message": "Task ID is required"}
        
        task_config = await db.get_task(task_id)
        
        if not task_config:
            log_detailed("error", "job_handler", "forward", f"Task not found: {task_id}")
            return {"status": "error", "message": "Task not found"}
        
        log_detailed("info", "job_handler", "forward", f"Forward job completed", {"task_id": task_id})
        return {"status": "success", "task_id": task_id}
        
    except Exception as e:
        log_detailed("error", "job_handler", "forward", f"Forward job error: {str(e)}", {
            "traceback": traceback.format_exc()
        })
        raise

async def handle_ai_job(job: dict) -> dict:
    """Handle AI processing job"""
    import json
    job_id = job.get('id', 'unknown')
    log_detailed("info", "job_handler", "ai_process", f"Processing AI job", {"job_id": job_id})
    
    try:
        payload = job['payload']
        # Parse JSON payload if it's a string
        if isinstance(payload, str):
            payload = json.loads(payload)
        
        log_detailed("info", "job_handler", "ai_process", "AI job completed", {
            "payload_keys": list(payload.keys()) if isinstance(payload, dict) else []
        })
        return {"status": "success"}
    except Exception as e:
        log_detailed("error", "job_handler", "ai_process", f"AI job error: {str(e)}", {
            "traceback": traceback.format_exc()
        })
        raise

async def handle_video_job(job: dict) -> dict:
    """Handle video processing job"""
    import json
    job_id = job.get('id', 'unknown')
    log_detailed("info", "job_handler", "video_process", f"Processing video job", {"job_id": job_id})
    
    try:
        payload = job['payload']
        
        # Parse JSON payload if it's a string (payload is stored as JSON string in database)
        if isinstance(payload, str):
            log_detailed("info", "job_handler", "video_process", "Parsing JSON payload from database")
            payload = json.loads(payload)
        
        if not isinstance(payload, dict):
            raise ValueError(f"Payload must be dict, got {type(payload).__name__}")
        
        task_id = job.get('task_id')
        
        if task_id is None:
            log_detailed("error", "job_handler", "video_process", "Task ID is missing")
            return {"status": "error", "message": "Task ID is required"}
        
        task_config = await db.get_task(task_id)
        
        if not task_config:
            log_detailed("error", "job_handler", "video_process", f"Task not found: {task_id}")
            return {"status": "error", "message": "Task not found"}
        
        message_id = payload.get('message_id')
        chat_id = payload.get('chat_id')
        
        if not message_id or not chat_id:
            log_detailed("error", "job_handler", "video_process", "Missing message_id or chat_id in payload", {
                "message_id": message_id,
                "chat_id": chat_id,
                "payload_keys": list(payload.keys())
            })
            return {"status": "error", "message": "message_id and chat_id are required"}
        
        log_detailed("info", "job_handler", "video_process", "Starting video processing", {
            "message_id": message_id,
            "chat_id": chat_id,
            "task_id": task_id
        })
        
        # ✅ NEW: Pass caption_summary, caption_text, and serial_number for merging
        caption_summary = payload.get('caption_summary')
        caption_text = payload.get('caption_text')
        serial_number = payload.get('serial_number')
        if serial_number is not None:
            serial_number = str(serial_number)
        
        result = await video_processor.process_video(
            client=app,
            message_id=message_id,
            chat_id=chat_id,
            task_id=task_id,
            task_config=task_config,
            caption_summary=caption_summary,
            caption_text=caption_text,
            serial_number=serial_number
        )
        
        log_detailed("info", "job_handler", "video_process", "Video job completed successfully", {
            "result_length": len(result) if result else 0
        })
        return {"status": "success", "result": result}
        
    except Exception as e:
        log_detailed("error", "job_handler", "video_process", f"Video job error: {str(e)}", {
            "traceback": traceback.format_exc()
        })
        raise

async def shutdown():
    """Gracefully shutdown bot"""
    global is_running
    is_running = False
    
    log_detailed("info", "main", "shutdown", "Starting graceful shutdown...")
    
    try:
        # Stop queue manager
        log_detailed("info", "queue_manager", "stop", "Stopping queue manager...")
        await queue_manager.stop()
        log_detailed("info", "queue_manager", "stop", "Queue manager stopped")
        
        # Disconnect database
        log_detailed("info", "database", "disconnect", "Disconnecting database...")
        await db.disconnect()
        log_detailed("info", "database", "disconnect", "Database disconnected")
        
        log_detailed("info", "main", "shutdown", "✅ Bot shutdown completed")
        
    except Exception as e:
        log_detailed("error", "main", "shutdown", f"Shutdown error: {str(e)}", {
            "traceback": traceback.format_exc()
        })

async def main():
    """Main entry point for userbot mode"""
    global is_running, app, session_string
    
    try:
        # Validate settings
        log_detailed("info", "main", "startup", "Validating settings...")
        if not settings.validate():
            log_detailed("error", "main", "startup", "❌ Invalid configuration. Check your environment variables")
            return
        
        log_detailed("info", "main", "startup", "🤖 Starting Telegram Forwarding Userbot...", {
            "bot_admin": settings.BOT_ADMIN_ID,
            "api_id": settings.API_ID
        })
        
        # Load session from database
        log_detailed("info", "session", "check", "Checking for active userbot session...")
        session_string = await get_active_session()
        
        if not session_string:
            log_detailed("warning", "session", "missing", "⚠️ No active session found! Please login via the web interface.")
            print("\n" + "="*60)
            print("⚠️  USERBOT LOGIN REQUIRED")
            print("="*60)
            print("No active userbot session found.")
            print("Please go to the web interface Settings page to login")
            print("with your phone number to enable message forwarding.")
            print("="*60 + "\n")
            
            # Still start the database and queue for API access
            await db.connect()
            
            # Wait for session to be added via API
            while is_running:
                await asyncio.sleep(10)
                session_string = await get_active_session()
                if session_string:
                    log_detailed("info", "session", "detected", "Session detected! Starting userbot...")
                    break
            
            if not session_string:
                return
        
        # Create client with session
        app = create_client(session_string)
        
        # Initialize components
        await initialize_bot()
        
        # Start the userbot
        log_detailed("info", "pyrogram", "start", "Starting Pyrofork userbot client...")
        await app.start()
        
        # Get user info
        me = await app.get_me()
        log_detailed("info", "pyrogram", "connected", "✅ Userbot connected to Telegram", {
            "user_id": me.id,
            "username": me.username,
            "first_name": me.first_name
        })
        
        # Register message handlers on the client
        register_handlers(app)
        
        # Warm up channel peers AFTER Pyrogram is connected
        log_detailed("info", "warmup", "post_connect", "Starting post-connection warmup...")
        await warmup_channel_peers()
        
        print(f"\n{'='*50}")
        print(f"👤 Userbot started: {me.first_name} (@{me.username or 'N/A'})")
        print(f"📊 User ID: {me.id}")
        print(f"✅ Ready to forward messages from channels")
        print(f"{'='*50}\n")
        
        # Keep userbot running using Pyrogram's idle
        log_detailed("info", "main", "idle", "Userbot is now running and waiting for messages...")
        
        # Use Pyrogram's idle() for proper event handling
        from pyrogram import idle
        await idle()
        
    except AuthKeyUnregistered:
        log_detailed("error", "main", "auth_error", "Session expired or invalid. Please login again via the web interface.")
        # Mark session as expired in database
        try:
            if db.pool is not None:
                await db.pool.execute("""
                    UPDATE userbot_sessions SET is_active = false, status = 'expired' 
                    WHERE is_primary = true
                """)
        except:
            pass
    except FloodWait as e:
        log_detailed("error", "main", "flood", f"Flood wait: {e.value} seconds")
        wait_time = int(e.value) if isinstance(e.value, (int, float)) else 5
        await asyncio.sleep(wait_time)
    except RPCError as e:
        error_code = e.CODE if hasattr(e, 'CODE') else None
        error_msg = str(e)
        
        # Handle AUTH_KEY_DUPLICATED specifically
        if error_code == 406 or 'AUTH_KEY_DUPLICATED' in error_msg:
            log_detailed("error", "main", "auth_duplicated", "Session is being used elsewhere. Marking as expired...")
            try:
                if db.pool is not None:
                    await db.pool.execute("""
                        UPDATE userbot_sessions SET is_active = false, status = 'duplicated' 
                        WHERE is_primary = true
                    """)
                    log_detailed("info", "main", "auth_duplicated", "Session marked as expired. Please login again via Settings.")
            except Exception as db_error:
                log_detailed("error", "main", "db_error", f"Failed to mark session as expired: {str(db_error)}")
        else:
            log_detailed("error", "main", "rpc_error", f"RPC Error: {error_msg}", {
                "error_code": error_code
            })
    except KeyboardInterrupt:
        log_detailed("info", "main", "interrupt", "Userbot stopped by user (Ctrl+C)")
    except Exception as e:
        log_detailed("error", "main", "fatal", f"Fatal error: {str(e)}", {
            "traceback": traceback.format_exc()
        })
    finally:
        log_detailed("info", "main", "cleanup", "Cleaning up...")
        await shutdown()
        if app:
            try:
                await app.stop()
                log_detailed("info", "pyrogram", "stop", "Pyrofork client stopped")
            except Exception as e:
                log_detailed("error", "pyrogram", "stop", f"Error stopping client: {str(e)}")

def signal_handler(signum, frame):
    """Handle termination signals"""
    global is_running
    log_detailed("info", "main", "signal", f"Received signal {signum}, shutting down...")
    is_running = False

if __name__ == "__main__":
    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    log_detailed("info", "main", "entry", "Bot script started")
    asyncio.run(main())
