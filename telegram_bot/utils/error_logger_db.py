"""
Database error logging for telegram bot
Logs errors to PostgreSQL for visibility in web dashboard
"""
import asyncpg
from typing import Optional, Dict, Any
from config.settings import settings
import json
from datetime import datetime

class DatabaseErrorLogger:
    """Log errors to PostgreSQL database"""
    
    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None
    
    async def connect(self):
        """Connect to database"""
        try:
            self.pool = await asyncpg.create_pool(
                settings.DATABASE_URL,
                min_size=2,
                max_size=5,
                command_timeout=10
            )
        except Exception as e:
            print(f"Failed to connect to database for error logging: {e}")
    
    async def log_error(
        self,
        component: str,
        function: str,
        error_type: str,
        error_message: str,
        stack_trace: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """Log error to database"""
        if not self.pool:
            return
        
        try:
            async with self.pool.acquire() as conn:
                await conn.execute("""
                    INSERT INTO error_logs (component, function, error_type, error_message, stack_trace, metadata, timestamp)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                """,
                    component,
                    function,
                    error_type,
                    error_message,
                    stack_trace,
                    json.dumps(metadata) if metadata else None,
                    datetime.utcnow()
                )
        except Exception as e:
            print(f"Failed to log error to database: {e}")
    
    async def disconnect(self):
        """Close database connection"""
        if self.pool:
            await self.pool.close()

db_error_logger = DatabaseErrorLogger()
