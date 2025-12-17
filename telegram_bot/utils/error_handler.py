"""
Advanced Error Handling and Logging System
Comprehensive error tracking with detailed logging for each component
"""
import traceback
import logging
from datetime import datetime
from typing import Optional, Dict, Any
from functools import wraps
import asyncio
from logging.handlers import RotatingFileHandler

# Configure logging
import os

# Create logs directory if it doesn't exist
log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'logs')
os.makedirs(log_dir, exist_ok=True)
log_file = os.path.join(log_dir, 'bot.log')

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        RotatingFileHandler(log_file, maxBytes=5*1024*1024, backupCount=2),
        logging.StreamHandler()
    ]
)

class ErrorLogger:
    """Centralized error logging system"""
    
    def __init__(self, component: str):
        self.component = component
        self.logger = logging.getLogger(component)
    
    async def log_error(
        self,
        function: str,
        error: Exception,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """Log error to database and file"""
        error_data = {
            "component": self.component,
            "function": function,
            "error_type": type(error).__name__,
            "error_message": str(error),
            "stack_trace": traceback.format_exc(),
            "metadata": metadata or {},
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Log to file
        self.logger.error(
            f"Error in {function}: {error_data['error_message']}\n"
            f"Stack trace: {error_data['stack_trace']}"
        )
        
        # TODO: Log to database
        # await db.insert_error_log(error_data)
        
        return error_data
    
    def log_info(self, message: str, metadata: Optional[Dict[str, Any]] = None):
        """Log informational message"""
        self.logger.info(f"{message} | {metadata or {}}")
    
    def log_warning(self, message: str, metadata: Optional[Dict[str, Any]] = None):
        """Log warning message"""
        self.logger.warning(f"{message} | {metadata or {}}")


def handle_errors(component: str, function_name: Optional[str] = None):
    """
    Decorator for comprehensive error handling
    Usage: @handle_errors("bot", "start_command")
    """
    def decorator(func):
        error_logger = ErrorLogger(component)
        fname = function_name or func.__name__
        
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                await error_logger.log_error(fname, e, {
                    "args": str(args)[:200],  # Limit size
                    "kwargs": str(kwargs)[:200]
                })
                # Re-raise in development, suppress in production
                raise
        
        @wraps(func)
        def sync_wrapper(*args, **kwargs):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                # For sync functions, we can't await
                error_logger.logger.error(
                    f"Error in {fname}: {str(e)}\n{traceback.format_exc()}"
                )
                raise
        
        return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper
    
    return decorator


class TaskLogger:
    """Logging system for forwarding tasks"""
    
    def __init__(self, task_id: int):
        self.task_id = task_id
        self.logger = logging.getLogger(f"task_{task_id}")
    
    async def log_event(
        self,
        level: str,
        message: str,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """Log task event to database"""
        log_data = {
            "task_id": self.task_id,
            "level": level,
            "message": message,
            "metadata": metadata or {},
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Log to file
        if level == "error":
            self.logger.error(message)
        elif level == "warning":
            self.logger.warning(message)
        else:
            self.logger.info(message)
        
        # TODO: Log to database
        # await db.insert_task_log(log_data)
        
        return log_data
    
    async def log_success(self, message: str, metadata: Optional[Dict[str, Any]] = None):
        """Log successful operation"""
        await self.log_event("success", message, metadata)
    
    async def log_error(self, message: str, metadata: Optional[Dict[str, Any]] = None):
        """Log error"""
        await self.log_event("error", message, metadata)
    
    async def log_info(self, message: str, metadata: Optional[Dict[str, Any]] = None):
        """Log information"""
        await self.log_event("info", message, metadata)
    
    async def log_warning(self, message: str, metadata: Optional[Dict[str, Any]] = None):
        """Log warning"""
        await self.log_event("warning", message, metadata)
