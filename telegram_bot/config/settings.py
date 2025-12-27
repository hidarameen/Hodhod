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
    Get database URL from DATABASE_URL secret.
    Handles multi-host URLs by using primary host only.
    """
    from urllib.parse import urlparse, urlunparse

    url = os.getenv("DATABASE_URL", "")
    if not url:
        return url

    if ',' not in url:
        if 'sslmode=' not in url:
            url += ('&' if '?' in url else '?') + 'sslmode=require'
        print(f"[Settings] Using DATABASE_URL")
        return url

    try:
        parsed = urlparse(url)
        hosts = parsed.netloc.split('@')[-1]
        primary_host = hosts.split(',')[0].strip()

        user_pass = parsed.netloc.split('@')[0] if '@' in parsed.netloc else ''
        new_netloc = f"{user_pass}@{primary_host}" if user_pass else primary_host

        sanitized_url = urlunparse((
            parsed.scheme,
            new_netloc,
            parsed.path,
            parsed.params,
            parsed.query,
            parsed.fragment
        ))

        if 'sslmode=' not in sanitized_url:
            sanitized_url += ('&' if '?' in sanitized_url else '?') + 'sslmode=require'

        print(f"[Settings] Using primary host from multi-host DATABASE_URL")
        return sanitized_url
    except Exception as e:
        print(f"[Settings] Error parsing DATABASE_URL: {e}")
        return url


class Settings:
    """Application settings"""

    # Telegram Configuration
    BOT_TOKEN: str = os.getenv("BOT_TOKEN") or ""
    API_ID: int = int(os.getenv("API_ID") or "0")
    API_HASH: str = os.getenv("API_HASH") or ""

    # Admin Configuration
    BOT_ADMIN_ID: int = int(os.getenv("BOT_ADMIN_ID") or "0")

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
            # Latest Frontier Models (December 2025)
            {"name": "gpt-5.2", "display": "GPT-5.2 (Latest)", "type": "text"},
            {"name": "gpt-5.2-pro", "display": "GPT-5.2 Pro", "type": "text"},
            
            # GPT-5 Series
            {"name": "gpt-5.1", "display": "GPT-5.1", "type": "text"},
            {"name": "gpt-5.1-codex", "display": "GPT-5.1 Codex", "type": "text"},
            {"name": "gpt-5.1-codex-max", "display": "GPT-5.1 Codex Max", "type": "text"},
            {"name": "gpt-5", "display": "GPT-5", "type": "text"},
            {"name": "gpt-5-pro", "display": "GPT-5 Pro", "type": "text"},
            {"name": "gpt-5-codex", "display": "GPT-5 Codex", "type": "text"},
            {"name": "gpt-5-mini", "display": "GPT-5 Mini", "type": "text"},
            {"name": "gpt-5-nano", "display": "GPT-5 Nano", "type": "text"},
            
            # Reasoning Models (o-series)
            {"name": "o3", "display": "o3 (Reasoning)", "type": "text"},
            {"name": "o3-pro", "display": "o3 Pro", "type": "text"},
            {"name": "o3-mini", "display": "o3 Mini", "type": "text"},
            {"name": "o3-deep-research", "display": "o3 Deep Research", "type": "text"},
            {"name": "o4-mini", "display": "o4 Mini", "type": "text"},
            {"name": "o4-mini-deep-research", "display": "o4 Mini Deep Research", "type": "text"},
            {"name": "o1-pro", "display": "o1 Pro", "type": "text"},
            
            # GPT-4 Series
            {"name": "gpt-4.1", "display": "GPT-4.1", "type": "text"},
            {"name": "gpt-4.1-mini", "display": "GPT-4.1 Mini", "type": "text"},
            {"name": "gpt-4.1-nano", "display": "GPT-4.1 Nano", "type": "text"},
            {"name": "gpt-4o", "display": "GPT-4o", "type": "text"},
            {"name": "gpt-4o-mini", "display": "GPT-4o Mini", "type": "text"},
            {"name": "gpt-4-turbo", "display": "GPT-4 Turbo", "type": "text"},
            {"name": "gpt-4-turbo-preview", "display": "GPT-4 Turbo Preview", "type": "text"},
            
            # Legacy Models (Supported)
            {"name": "gpt-4", "display": "GPT-4 (Legacy)", "type": "text"},
            {"name": "gpt-3.5-turbo", "display": "GPT-3.5 Turbo (Legacy)", "type": "text"},
        ],
        "groq": [
            # Production Models - نماذج الإنتاج
            {"name": "llama-3.1-8b-instant", "display": "LLaMA 3.1 8B Instant", "type": "text"},
            {"name": "llama-3.3-70b-versatile", "display": "LLaMA 3.3 70B Versatile", "type": "text"},
            {"name": "meta-llama/llama-guard-4-12b", "display": "LLaMA Guard 4 12B", "type": "text"},
            {"name": "openai/gpt-oss-120b", "display": "GPT OSS 120B", "type": "text"},
            {"name": "openai/gpt-oss-20b", "display": "GPT OSS 20B", "type": "text"},
            {"name": "whisper-large-v3", "display": "Whisper Large v3", "type": "audio"},
            {"name": "whisper-large-v3-turbo", "display": "Whisper Large v3 Turbo", "type": "audio"},
            
            # Preview Models - نماذج المعاينة
            {"name": "meta-llama/llama-4-maverick-17b-128e-instruct", "display": "Llama 4 Maverick 17B 128E", "type": "text"},
            {"name": "meta-llama/llama-4-scout-17b-16e-instruct", "display": "Llama 4 Scout 17B 16E", "type": "text"},
            {"name": "moonshotai/kimi-k2-instruct-0905", "display": "Kimi K2", "type": "text"},
            {"name": "openai/gpt-oss-safeguard-20b", "display": "Safety GPT OSS 20B", "type": "text"},
            {"name": "playai-tts", "display": "PlayAI TTS", "type": "tts"},
            {"name": "playai-tts-arabic", "display": "PlayAI TTS Arabic", "type": "tts"},
            {"name": "qwen/qwen3-32b", "display": "Qwen 3 32B", "type": "text"},
            
            # Legacy Models (Still Supported) - نماذج قديمة (مدعومة)
            {"name": "mixtral-8x7b-32768", "display": "Mixtral 8x7B", "type": "text"},
            {"name": "gemma-7b-it", "display": "Gemma 7B", "type": "text"},
            {"name": "llama-3.3-70b-specdec", "display": "LLaMA 3.3 70B SpecDec", "type": "text"},
            {"name": "llama-guard-3-8b", "display": "LLaMA Guard 3 8B", "type": "text"},
            {"name": "llama3-groq-70b-8192-tool-use-preview", "display": "LLaMA 3 Groq 70B Tool Use", "type": "text"},
            {"name": "llama3-groq-8b-8192-tool-use-preview", "display": "LLaMA 3 Groq 8B Tool Use", "type": "text"},
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