"""
Configuration settings for the Telegram Bot
Centralized configuration management with environment variables
Supports both Bot mode and Userbot mode for channel monitoring
"""
import os
import re
from typing import Optional
from dotenv import load_dotenv

load_dotenv()


def get_database_url() -> str:
    """
    Get database URL, preferring local Replit database if available.
    Falls back to DATABASE_URL with multi-host sanitization.
    """
    pghost = os.getenv("PGHOST")
    pguser = os.getenv("PGUSER")
    pgpassword = os.getenv("PGPASSWORD")
    pgdatabase = os.getenv("PGDATABASE")
    pgport = os.getenv("PGPORT", "5432")
    
    if pghost and pguser and pgpassword and pgdatabase:
        local_url = f"postgresql://{pguser}:{pgpassword}@{pghost}:{pgport}/{pgdatabase}"
        print(f"[Settings] Using local Replit database")
        return local_url
    
    url = os.getenv("DATABASE_URL", "")
    if not url:
        return url
    
    if ',' not in url:
        return url
    
    pattern = r'^(postgresql|postgres)://([^@]+)@([^/]+)/(.+)$'
    match = re.match(pattern, url)
    
    if not match:
        return url
    
    protocol, credentials, hosts, rest = match.groups()
    primary_host = hosts.split(',')[0].strip()
    sanitized_url = f"{protocol}://{credentials}@{primary_host}/{rest}"
    
    print(f"[Settings] Using primary host from multi-host DATABASE_URL")
    return sanitized_url


class Settings:
    """Application settings"""
    
    # Telegram Configuration
    BOT_TOKEN: str = os.getenv("BOT_TOKEN", "")
    API_ID: int = int(os.getenv("API_ID", "0"))
    API_HASH: str = os.getenv("API_HASH", "")
    BOT_ADMIN_ID: int = int(os.getenv("BOT_ADMIN_ID", "0"))
    
    # Userbot Configuration (Required for receiving channel messages)
    # Bots cannot receive messages from channels - need user session
    PHONE_NUMBER: Optional[str] = os.getenv("PHONE_NUMBER")
    SESSION_STRING: Optional[str] = os.getenv("SESSION_STRING")
    
    # Database (use local Replit database if available)
    DATABASE_URL: str = get_database_url()
    
    # AI Providers
    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY")
    GROQ_API_KEY: Optional[str] = os.getenv("GROQ_API_KEY")
    ANTHROPIC_API_KEY: Optional[str] = os.getenv("ANTHROPIC_API_KEY")
    HUGGINGFACE_API_KEY: Optional[str] = os.getenv("HUGGINGFACE_API_KEY")
    
    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    
    # Webhook
    WEBHOOK_URL: str = os.getenv("WEBHOOK_URL", "")
    WEBHOOK_PORT: int = int(os.getenv("WEBHOOK_PORT", "8443"))
    USE_WEBHOOK: bool = os.getenv("USE_WEBHOOK", "true").lower() == "true"
    
    # API Server
    API_HOST: str = os.getenv("API_HOST", "0.0.0.0")
    API_PORT: int = int(os.getenv("API_PORT", "8000"))
    
    # Worker Configuration
    MAX_WORKERS: int = int(os.getenv("MAX_WORKERS", "10"))
    QUEUE_MAX_SIZE: int = int(os.getenv("QUEUE_MAX_SIZE", "1000"))
    
    # AI Models Configuration
    AI_MODELS = {
        "openai": [
            {"name": "gpt-4-turbo-preview", "display": "GPT-4 Turbo", "type": "text"},
            {"name": "gpt-4", "display": "GPT-4", "type": "text"},
            {"name": "gpt-3.5-turbo", "display": "GPT-3.5 Turbo", "type": "text"},
        ],
        "groq": [
            {"name": "mixtral-8x7b-32768", "display": "Mixtral 8x7B", "type": "text"},
            {"name": "llama2-70b-4096", "display": "LLaMA 2 70B", "type": "text"},
            {"name": "gemma-7b-it", "display": "Gemma 7B", "type": "text"},
        ],
        "claude": [
            {"name": "claude-3-opus-20240229", "display": "Claude 3 Opus", "type": "text"},
            {"name": "claude-3-sonnet-20240229", "display": "Claude 3 Sonnet", "type": "text"},
            {"name": "claude-3-haiku-20240307", "display": "Claude 3 Haiku", "type": "text"},
        ],
        "huggingface": [
            {"name": "meta-llama/Llama-2-70b-chat-hf", "display": "LLaMA 2 70B Chat", "type": "text"},
            {"name": "mistralai/Mixtral-8x7B-Instruct-v0.1", "display": "Mixtral 8x7B Instruct", "type": "text"},
            {"name": "google/flan-t5-xxl", "display": "FLAN-T5 XXL", "type": "text"},
        ]
    }
    
    # Whisper Model for Video Processing
    WHISPER_MODEL = "whisper-large-v3-turbo"
    
    @classmethod
    def is_userbot_mode(cls) -> bool:
        """Check if userbot mode is available (phone number or session string set)"""
        return bool(cls.PHONE_NUMBER or cls.SESSION_STRING)
    
    @classmethod
    def validate(cls) -> bool:
        """Validate critical settings"""
        required = [cls.API_ID, cls.API_HASH, cls.DATABASE_URL]
        if not all(required):
            return False
        
        # Need either BOT_TOKEN or PHONE_NUMBER/SESSION_STRING
        if not cls.BOT_TOKEN and not cls.is_userbot_mode():
            return False
        
        return True
    
    @classmethod
    def get_mode_description(cls) -> str:
        """Get description of current mode"""
        if cls.is_userbot_mode():
            return "Userbot Mode (Can receive channel messages)"
        elif cls.BOT_TOKEN:
            return "Bot Mode (Limited - Cannot receive channel messages passively)"
        else:
            return "No authentication configured"

settings = Settings()
