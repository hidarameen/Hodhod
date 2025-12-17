"""
AI Providers Integration
Support for OpenAI, Groq, Claude, and HuggingFace
"""
import asyncio
import re
from typing import Optional, Dict, Any
from config.settings import settings
from utils.error_handler import handle_errors, ErrorLogger
from services.rate_limiter import rate_limiter

error_logger = ErrorLogger("ai_providers")


def strip_thinking_tags(content: str) -> str:
    """
    Strip <think>...</think> tags from AI model responses.
    Some models like qwen/qwen3-32b include thinking tags in their output.
    """
    if not content:
        return content
    
    # Remove <think>...</think> blocks (including multiline)
    cleaned = re.sub(r'<think>.*?</think>\s*', '', content, flags=re.DOTALL | re.IGNORECASE)
    
    # Also handle unclosed <think> tags (just in case)
    cleaned = re.sub(r'<think>.*$', '', cleaned, flags=re.DOTALL | re.IGNORECASE)
    
    return cleaned.strip()

class AIProvider:
    """Base AI Provider class"""
    
    def __init__(self, provider_name: str, api_key: str):
        self.provider_name = provider_name
        self.api_key = api_key
    
    async def generate_text(
        self, 
        prompt: str, 
        model: str, 
        max_tokens: int = 8000,
        temperature: float = 0.7
    ) -> str:
        """Generate text from prompt"""
        raise NotImplementedError


class OpenAIProvider(AIProvider):
    """OpenAI API Integration"""
    
    def __init__(self, api_key: str):
        super().__init__("openai", api_key)
        self.client = None
    
    @handle_errors("ai_providers", "openai_generate")
    async def generate_text(
        self,
        prompt: str,
        model: str = "gpt-3.5-turbo",
        max_tokens: int = 8000,
        temperature: float = 0.7,
        tpm_limit: Optional[int] = None,
        rpm_limit: Optional[int] = None,
        tpd_limit: Optional[int] = None
    ) -> str:
        """Generate text using OpenAI with fallback support and rate limiting"""
        try:
            from openai import AsyncOpenAI
            
            # Check rate limits before proceeding
            if tpm_limit or rpm_limit or tpd_limit:
                estimated_tokens = len(prompt.split()) + max_tokens  # Rough estimate
                can_proceed, error_msg = await rate_limiter.can_request(
                    model, estimated_tokens, tpm_limit, rpm_limit, tpd_limit
                )
                if not can_proceed:
                    error_logger.log_warning(f"[OpenAI] ⚠️ Rate limit check failed: {error_msg}")
                    raise Exception(f"Rate limit exceeded: {error_msg}")
            
            if not self.client:
                self.client = AsyncOpenAI(api_key=self.api_key)
            
            error_logger.log_info(f"[OpenAI] 📥 INPUT | Model: {model} | Max Tokens: {max_tokens} | Input length: {len(prompt)} chars")
            error_logger.log_info(f"[OpenAI] 📝 PROMPT PREVIEW: {prompt[:500]}...")
            
            # Map models to their actual equivalents or fallbacks
            models_to_try = [model]
            
            # Build fallback chain based on model
            model_lower = model.lower()
            
            # GPT-5.x family (future/beta models)
            if "gpt-5" in model_lower:
                models_to_try.extend(["gpt-4o", "gpt-4-turbo", "gpt-4"])
            # GPT-4.1 family (future/beta models)
            elif "gpt-4.1" in model_lower:
                models_to_try.extend(["gpt-4o", "gpt-4-turbo", "gpt-4"])
            # O3 family (reasoning models)
            elif "o3" in model_lower:
                models_to_try.extend(["gpt-4o", "gpt-4-turbo", "gpt-4"])
            # O4 family (future reasoning)
            elif "o4" in model_lower:
                models_to_try.extend(["gpt-4o", "gpt-4-turbo", "gpt-4"])
            # Current stable models
            elif model_lower not in ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"]:
                # Unknown model, try fallbacks
                models_to_try.extend(["gpt-4o", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"])
            
            # Per-model max_tokens limits
            model_token_limits = {
                "gpt-5.1": 16000,
                "gpt-5": 16000,
                "gpt-5-mini": 16000,
                "gpt-5-nano": 16000,
                "gpt-5-pro": 16000,
                "gpt-5.1-codex": 16000,
                "gpt-5.1-codex-max": 16000,
                "gpt-4.1": 8192,
                "gpt-4.1-mini": 8192,
                "gpt-4.1-nano": 8192,
                "gpt-4o": 4096,
                "gpt-4o-mini": 4096,
                "gpt-4-turbo": 4096,
                "gpt-4": 8192,
                "o3": 4096,
                "o3-pro": 4096,
                "o3-mini": 4096,
                "o3-deep-research": 4096,
                "o4-mini": 4096,
                "gpt-3.5-turbo": 4096
            }
            
            last_error = None
            for try_model in models_to_try:
                try:
                    request_params = {
                        "model": try_model,
                        "messages": [{"role": "user", "content": prompt}]
                    }
                    
                    # Determine token parameters based on model
                    is_reasoning = "o3" in try_model.lower() or "o4" in try_model.lower()
                    is_future = "gpt-5" in try_model.lower() or "gpt-4.1" in try_model.lower()
                    
                    # Get model-specific token limit, default to 4096
                    model_limit = model_token_limits.get(try_model.lower(), 4096)
                    adjusted_tokens = min(max_tokens, model_limit)
                    
                    # Clamp max_tokens based on model limits
                    if is_reasoning or is_future:
                        # Reasoning/future models: use max_completion_tokens
                        request_params["max_completion_tokens"] = adjusted_tokens
                        error_logger.log_info(f"[OpenAI] Using max_completion_tokens={adjusted_tokens} for {try_model} (limit: {model_limit})")
                    else:
                        # All other models: use max_tokens
                        request_params["max_tokens"] = adjusted_tokens
                        request_params["temperature"] = temperature
                        error_logger.log_info(f"[OpenAI] Using max_tokens={adjusted_tokens} for {try_model} (limit: {model_limit})")
                    
                    error_logger.log_info(f"[OpenAI] 🚀 Trying model: {try_model}")
                    
                    response = await self.client.chat.completions.create(**request_params)
                    
                    finish_reason = response.choices[0].finish_reason if response.choices else 'NO_CHOICES'
                    usage_info = ""
                    if hasattr(response, 'usage') and response.usage:
                        usage_info = f" | Tokens: prompt={response.usage.prompt_tokens}, completion={response.usage.completion_tokens}, total={response.usage.total_tokens}"
                    
                    if not response.choices:
                        error_logger.log_warning(f"[OpenAI] ⚠️ No choices in response from {try_model}")
                        last_error = "no_choices"
                        continue
                    
                    choice = response.choices[0]
                    content = choice.message.content
                    
                    if hasattr(choice.message, 'reasoning') and choice.message.reasoning:
                        error_logger.log_info(f"[OpenAI] 🧠 Reasoning field (length: {len(choice.message.reasoning)})")
                    
                    if finish_reason == 'length':
                        error_logger.log_warning(f"[OpenAI] ⚠️ Output truncated! finish_reason=length. Consider increasing max_tokens.")
                    
                    if content and content.strip():
                        if try_model != model:
                            error_logger.log_info(f"[OpenAI] ℹ️ Using fallback model {try_model} instead of {model}")
                        error_logger.log_info(f"[OpenAI] ✅ SUCCESS | Model: {try_model} | Finish reason: {finish_reason}{usage_info}")
                        error_logger.log_info(f"[OpenAI] 📝 OUTPUT PREVIEW: {content[:300]}...")
                        return content.strip()
                    else:
                        error_logger.log_warning(f"[OpenAI] ⚠️ Empty content from {try_model}!")
                        if hasattr(choice.message, 'refusal') and choice.message.refusal:
                            error_logger.log_warning(f"[OpenAI] Model refused: {choice.message.refusal}")
                        last_error = "empty_content"
                        continue
                        
                except Exception as e:
                    error_msg = str(e)
                    error_logger.log_info(f"[OpenAI] ⚠️ Model {try_model} failed | Error: {error_msg[:100]}")
                    last_error = error_msg
                    continue
            
            # If all models failed
            error_logger.log_warning(f"[OpenAI] ❌ All models failed | Last error: {last_error}")
            raise Exception(f"All OpenAI models failed. Last error: {last_error}")
                
        except Exception as e:
            error_logger.log_warning(f"[OpenAI] ❌ Fatal error: {str(e)}")
            import traceback
            error_logger.log_warning(f"[OpenAI] Traceback: {traceback.format_exc()}")
            raise


class GroqProvider(AIProvider):
    """Groq API Integration"""
    
    def __init__(self, api_key: str):
        super().__init__("groq", api_key)
        self.client = None
    
    @handle_errors("ai_providers", "groq_generate")
    async def generate_text(
        self,
        prompt: str,
        model: str = "llama-3.1-8b-instant",
        max_tokens: int = 8000,
        temperature: float = 0.7
    ) -> str:
        """Generate text using Groq with fallback models"""
        try:
            from groq import AsyncGroq
            
            if not self.client:
                self.client = AsyncGroq(api_key=self.api_key)
            
            # Normalize old model names to new format
            model_mapping = {
                "gpt-oss-120b": "openai/gpt-oss-120b",
                "gpt-oss-20b": "openai/gpt-oss-20b",
                "qwen-3-32b": "qwen/qwen3-32b",
                "llama-4-scout": "meta-llama/llama-4-scout-17b-16e-instruct",
                "llama-4-maverick": "meta-llama/llama-4-maverick-17b-128e-instruct",
                "llama-3.3-70b": "llama-3.3-70b-versatile",
                "kimi-k2": "moonshotai/kimi-k2-instruct-0905"
            }
            if model in model_mapping:
                model = model_mapping[model]
            
            # Model-specific max_tokens limits
            model_max_tokens = {
                "openai/gpt-oss-120b": 65536,
                "openai/gpt-oss-20b": 65536,
                "qwen/qwen3-32b": 40960,
                "meta-llama/llama-4-scout-17b-16e-instruct": 8192,
                "meta-llama/llama-4-maverick-17b-128e-instruct": 8192,
                "llama-3.3-70b-versatile": 32768,
                "moonshotai/kimi-k2-instruct-0905": 16384,
                "llama-3.1-8b-instant": 131072
            }
            
            # Ensure max_tokens doesn't exceed model limit
            safe_max_tokens = min(max_tokens, model_max_tokens.get(model, max_tokens))
            
            # Log request details
            error_logger.log_info(f"[Groq] Starting request | Model: {model} | Max Tokens: {safe_max_tokens} | Temperature: {temperature} | Input length: {len(prompt)} chars")
            
            # Define fallback models in case primary fails
            # Using only available and confirmed working models
            approved_models = [
                "openai/gpt-oss-120b",
                "openai/gpt-oss-20b",
                "qwen/qwen3-32b",
                "meta-llama/llama-4-scout-17b-16e-instruct",
                "meta-llama/llama-4-maverick-17b-128e-instruct",
                "llama-3.3-70b-versatile",
                "moonshotai/kimi-k2-instruct-0905",
                "llama-3.1-8b-instant"
            ]
            
            models_to_try = [model]
            # Add all approved models as fallback (except the primary model to avoid duplication)
            for approved in approved_models:
                if approved.lower() != model.lower() and approved not in models_to_try:
                    models_to_try.append(approved)
            
            last_error = None
            rate_limit_hit = False
            for try_model in models_to_try:
                try:
                    # Get safe max_tokens for this model
                    model_safe_max = min(max_tokens, model_max_tokens.get(try_model, max_tokens))
                    
                    # Prepare request parameters
                    request_params = {
                        "model": try_model,
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": model_safe_max,
                        "temperature": temperature
                    }
                    
                    response = await self.client.chat.completions.create(**request_params)
                    
                    # Extract content safely
                    if response and response.choices and len(response.choices) > 0:
                        content = response.choices[0].message.content
                        if content and content.strip():
                            # Clean thinking tags from models like qwen/qwen3-32b
                            cleaned_content = strip_thinking_tags(content)
                            if cleaned_content:
                                if try_model != model:
                                    error_logger.log_info(f"[Groq] ℹ️ Using fallback model {try_model} instead of {model}")
                                error_logger.log_info(f"[Groq] ✅ Success | Model: {try_model} | Output length: {len(cleaned_content)} chars | First 100 chars: {cleaned_content[:100]}")
                                return cleaned_content
                            else:
                                error_logger.log_warning(f"[Groq] ⚠️ Content empty after stripping thinking tags | Model: {try_model}")
                                last_error = "empty_after_cleanup"
                                continue
                        else:
                            error_logger.log_warning(f"[Groq] ⚠️ Empty content from model {try_model}")
                            last_error = "empty_content"
                            continue
                    else:
                        error_logger.log_warning(f"[Groq] ⚠️ No choices in response | Model: {try_model}")
                        last_error = "no_choices"
                        continue
                        
                except Exception as e:
                    error_msg = str(e)
                    error_logger.log_info(f"[Groq] ⚠️ Model {try_model} failed | Error: {error_msg[:150]}")
                    
                    # Check for rate limit error
                    if "rate_limit" in error_msg.lower() or "429" in error_msg:
                        error_logger.log_warning(f"[Groq] ⏱️ RATE LIMIT HIT | Groq daily token limit reached. Please wait or upgrade plan.")
                        rate_limit_hit = True
                        last_error = f"Rate limit: {error_msg[:100]}"
                        # Don't continue trying other models if rate limited
                        break
                    # Check for model not found
                    elif "model" in error_msg.lower() and ("not found" in error_msg.lower() or "does not exist" in error_msg.lower()):
                        error_logger.log_warning(f"[Groq] ❌ Model {try_model} not available/doesn't exist")
                        last_error = f"Model not found: {try_model}"
                        continue
                    else:
                        last_error = error_msg
                        continue
            
            # If all models failed
            if rate_limit_hit:
                error_logger.log_warning(f"[Groq] ❌ Rate limit reached - cannot continue with Groq | {last_error}")
            else:
                error_logger.log_info(f"[Groq] ❌ All models failed | Last error: {last_error}")
            return ""
            
        except Exception as e:
            error_logger.log_info(f"[Groq] ❌ Fatal error | Error: {str(e)}")
            raise


class ClaudeProvider(AIProvider):
    """Anthropic Claude API Integration"""
    
    def __init__(self, api_key: str):
        super().__init__("claude", api_key)
        self.client = None
    
    @handle_errors("ai_providers", "claude_generate")
    async def generate_text(
        self,
        prompt: str,
        model: str = "claude-3-sonnet-20240229",
        max_tokens: int = 8000,
        temperature: float = 0.7
    ) -> str:
        """Generate text using Claude"""
        try:
            from anthropic import AsyncAnthropic
            
            if not self.client:
                self.client = AsyncAnthropic(api_key=self.api_key)
            
            response = await self.client.messages.create(
                model=model,
                max_tokens=max_tokens,
                temperature=temperature,
                messages=[{"role": "user", "content": prompt}]
            )
            
            # Extract text from response content safely
            text_content = ""
            if response.content and len(response.content) > 0:
                block = response.content[0]
                # Use getattr to safely access text attribute regardless of block type
                text_content = getattr(block, 'text', '') or ''
            return text_content
        except Exception as e:
            error_logger.log_info(f"Claude error: {str(e)}")
            raise


class HuggingFaceProvider(AIProvider):
    """HuggingFace Inference API Integration"""
    
    def __init__(self, api_key: str):
        super().__init__("huggingface", api_key)
    
    @handle_errors("ai_providers", "huggingface_generate")
    async def generate_text(
        self,
        prompt: str,
        model: str = "meta-llama/Llama-2-70b-chat-hf",
        max_tokens: int = 8000,
        temperature: float = 0.7
    ) -> str:
        """Generate text using HuggingFace"""
        try:
            # Try to import huggingface_hub, return error message if not available
            try:
                from huggingface_hub import AsyncInferenceClient  # type: ignore
            except ImportError:
                error_logger.log_warning("huggingface_hub not installed, skipping HuggingFace provider")
                return ""
            
            client = AsyncInferenceClient(token=self.api_key)
            
            response = await client.text_generation(
                prompt=prompt,
                model=model,
                max_new_tokens=max_tokens,
                temperature=temperature
            )
            
            return response or ""
        except Exception as e:
            error_logger.log_info(f"HuggingFace error: {str(e)}")
            raise


class AIManager:
    """AI Manager to handle all providers"""
    
    def __init__(self):
        self.providers: Dict[str, AIProvider] = {}
        # Providers will be loaded from database in initialize_from_database()
    
    async def initialize_from_database(self):
        """Initialize providers from database"""
        from utils.database import db
        try:
            active_providers = await db.get_active_providers()
            error_logger.log_info(f"[DB Init] Retrieved {len(active_providers)} active providers from database")
            
            for provider_info in active_providers:
                provider_name = provider_info.get("name", "").lower()
                api_key = provider_info.get("api_key")
                
                error_logger.log_info(f"[DB Init] Processing provider: {provider_name} | Has API key: {bool(api_key)}")
                
                if not api_key:
                    error_logger.log_warning(f"[DB Init] No API key found for provider: {provider_name}")
                    continue
                
                if provider_name == "openai":
                    self.providers["openai"] = OpenAIProvider(api_key)
                    error_logger.log_info(f"[DB Init] ✅ Loaded OpenAI provider from database")
                elif provider_name == "groq":
                    self.providers["groq"] = GroqProvider(api_key)
                    error_logger.log_info(f"[DB Init] ✅ Loaded Groq provider from database")
                elif provider_name == "claude":
                    self.providers["claude"] = ClaudeProvider(api_key)
                    error_logger.log_info(f"[DB Init] ✅ Loaded Claude provider from database")
                elif provider_name == "huggingface":
                    self.providers["huggingface"] = HuggingFaceProvider(api_key)
                    error_logger.log_info(f"[DB Init] ✅ Loaded HuggingFace provider from database")
            
            error_logger.log_info(f"[DB Init] Providers available: {list(self.providers.keys())}")
        except Exception as e:
            error_logger.log_warning(f"[DB Init] Failed to initialize providers from database: {str(e)}")
    
    @handle_errors("ai_manager", "generate")
    async def generate(
        self,
        provider: str,
        model: str,
        prompt: str,
        max_tokens: int = 8000,
        temperature: float = 0.7
    ) -> Optional[str]:
        """Generate text using specified provider"""
        if provider not in self.providers:
            error_logger.log_warning(f"Provider {provider} not available")
            return None
        
        return await self.providers[provider].generate_text(
            prompt=prompt,
            model=model,
            max_tokens=max_tokens,
            temperature=temperature
        )
    
    @handle_errors("ai_manager", "summarize_text")
    async def summarize_text(
        self,
        text: str,
        provider: str,
        model: str,
        custom_rule: Optional[str] = None,
        system_prompt: Optional[str] = None,
        max_tokens: Optional[int] = None
    ) -> str:
        """
        Summarize text using AI - combines system prompt and custom rule
        
        Args:
            text: The text to summarize
            provider: AI provider name (openai, groq, claude, huggingface)
            model: Model name to use
            custom_rule: Custom rule/prompt for summarization
            system_prompt: System prompt to override default
            max_tokens: Maximum tokens for response (auto-calculated if not provided)
        """
        if not text or not text.strip():
            error_logger.log_warning("[AIManager] Empty text provided for summarization")
            return text or ""
        
        text = text.strip()
        text_length = len(text)
        
        if text_length < 50:
            error_logger.log_info(f"[AIManager] Text too short for summarization ({text_length} chars), returning as-is")
            return text
        
        base_prompt = system_prompt or "قم بتلخيص النص التالي بشكل موجز ومفيد:"
        
        if custom_rule and custom_rule.strip():
            final_prompt = f"{base_prompt}\n\n{custom_rule.strip()}"
        else:
            final_prompt = base_prompt
            
        prompt = f"{final_prompt}\n\n{text}"
        
        if max_tokens is None:
            if text_length < 500:
                max_tokens = 300
            elif text_length < 1500:
                max_tokens = 600
            elif text_length < 4000:
                max_tokens = 8000
            else:
                max_tokens = 1500
        
        error_logger.log_info(f"[AIManager] Starting summarization | Provider: {provider} | Model: {model} | Input: {text_length} chars | Max tokens: {max_tokens}")
        
        result = None
        retry_count = 0
        max_retries = 2
        
        while retry_count <= max_retries:
            try:
                result = await self.generate(
                    provider=provider,
                    model=model,
                    prompt=prompt,
                    max_tokens=max_tokens
                )
                if result and result.strip():
                    break
            except Exception as e:
                error_logger.log_warning(f"[AIManager] Summarization attempt {retry_count + 1} failed: {str(e)}")
            retry_count += 1
            if retry_count <= max_retries:
                await asyncio.sleep(1)
        
        if result and result.strip():
            result = result.strip()
            result_length = len(result)
            if text_length > 0:
                reduction_percent = max(0, min(100, 100 - (result_length * 100 // text_length)))
            else:
                reduction_percent = 0
            
            error_logger.log_info(f"[AIManager] ✅ Summarization complete | Provider: {provider} | Model: {model} | Output: {result_length} chars | Reduction: {text_length - result_length} chars ({reduction_percent}%)")
            error_logger.log_info(f"[AIManager] Summary preview: {result[:150]}")
            return result
        else:
            error_logger.log_info(f"[AIManager] ⚠️ Summarization failed after {max_retries + 1} attempts, returning original text | Provider: {provider} | Model: {model}")
            return text
    
    @handle_errors("ai_manager", "transcribe_audio")
    async def transcribe_audio(
        self, 
        audio_file_path: str, 
        language: str = "auto",
        response_format: str = "text",
        prompt: Optional[str] = None
    ) -> str:
        """
        Transcribe audio using Groq Whisper API with OpenAI Whisper as fallback
        
        Args:
            audio_file_path: Path to audio file
            language: Language code (ar, en, fr, es, de, etc.) or "auto" for detection
            response_format: Output format (text, json, verbose_json, srt, vtt)
            prompt: Optional prompt to guide transcription style/context
            
        Supported languages with high accuracy:
            ar (Arabic), en (English), fr (French), es (Spanish), de (German),
            ru (Russian), zh (Chinese), ja (Japanese), ko (Korean), tr (Turkish),
            pt (Portuguese), it (Italian), nl (Dutch), pl (Polish), hi (Hindi),
            id (Indonesian), vi (Vietnamese), th (Thai), he (Hebrew), fa (Persian)
        """
        import os
        
        if not os.path.exists(audio_file_path):
            raise FileNotFoundError(f"Audio file not found: {audio_file_path}")
        
        file_size = os.path.getsize(audio_file_path)
        file_size_mb = file_size / (1024 * 1024)
        error_logger.log_info(f"[Whisper] Starting transcription | File: {audio_file_path} | Size: {file_size_mb:.2f}MB | Language: {language}")
        
        ext = os.path.splitext(audio_file_path)[1].lower()
        mime_types = {
            '.mp3': 'audio/mpeg',
            '.mp4': 'audio/mp4',
            '.m4a': 'audio/mp4',
            '.wav': 'audio/wav',
            '.ogg': 'audio/ogg',
            '.oga': 'audio/ogg',
            '.opus': 'audio/opus',
            '.flac': 'audio/flac',
            '.webm': 'audio/webm',
            '.aac': 'audio/aac'
        }
        mime_type = mime_types.get(ext, 'audio/mpeg')
        
        # Build default prompt if not provided - preserves English words in mixed Arabic/English text
        if not prompt:
            prompt = "أرجوك احتفظ بجميع الكلمات الإنجليزية كما هي بدون تحويلها إلى عربي. Keep all English words in English. اكتب الكلمات الإنجليزية بحروف لاتينية فقط."
        
        groq_error = None
        
        # Try Groq Whisper first
        try:
            groq_api_key = settings.GROQ_API_KEY or (self.providers["groq"].api_key if "groq" in self.providers else None)
            
            if groq_api_key:
                error_logger.log_info(f"[Whisper] Trying Groq Whisper API first...")
                from groq import Groq
                
                client = Groq(api_key=groq_api_key)
                
                transcribe_params = {
                    "model": "whisper-large-v3-turbo",
                    "response_format": response_format,
                    "prompt": prompt
                }
                
                if language != "auto":
                    transcribe_params["language"] = language
                    error_logger.log_info(f"[Whisper] Using specified language: {language}")
                else:
                    error_logger.log_info(f"[Whisper] Auto-detecting language...")
                
                with open(audio_file_path, "rb") as audio_file:
                    error_logger.log_info(f"[Whisper] Sending to Groq Whisper API (whisper-large-v3-turbo) | MIME: {mime_type}")
                    
                    transcript = client.audio.transcriptions.create(
                        file=(os.path.basename(audio_file_path), audio_file, mime_type),
                        **transcribe_params
                    )
                
                transcribed_text = transcript.text if hasattr(transcript, 'text') else str(transcript)
                
                if transcribed_text and transcribed_text.strip():
                    transcribed_text = transcribed_text.strip()
                    detected_lang = self._detect_text_language(transcribed_text)
                    error_logger.log_info(f"[Whisper] ✅ Groq transcription complete | Length: {len(transcribed_text)} chars | Detected language: {detected_lang}")
                    error_logger.log_info(f"[Whisper] Preview: {transcribed_text[:150]}...")
                    return transcribed_text
                else:
                    groq_error = "Empty transcription result from Groq"
                    error_logger.log_warning(f"[Whisper] ⚠️ {groq_error}")
            else:
                groq_error = "Groq API key not available"
                error_logger.log_warning(f"[Whisper] ⚠️ {groq_error}")
                
        except Exception as e:
            groq_error = str(e)
            error_logger.log_warning(f"[Whisper] ⚠️ Groq Whisper failed: {groq_error}")
        
        # Fallback to OpenAI Whisper
        error_logger.log_info(f"[Whisper] 🔄 Falling back to OpenAI Whisper API...")
        
        try:
            openai_api_key = settings.OPENAI_API_KEY or (self.providers["openai"].api_key if "openai" in self.providers else None)
            
            if not openai_api_key:
                raise Exception(f"OpenAI API key not available. Groq error: {groq_error}")
            
            from openai import OpenAI
            
            client = OpenAI(api_key=openai_api_key)
            
            with open(audio_file_path, "rb") as audio_file:
                error_logger.log_info(f"[Whisper] Sending to OpenAI Whisper API (whisper-1) | MIME: {mime_type} | Timeout: 120s")
                error_logger.log_info(f"[Whisper] Using prompt to preserve English words in mixed-language content")
                
                transcribe_kwargs = {
                    "model": "whisper-1",
                    "file": audio_file,
                    "response_format": "text",
                    "prompt": prompt
                }
                
                if language != "auto":
                    transcribe_kwargs["language"] = language
                
                # Create client with timeout to prevent hanging
                client_with_timeout = OpenAI(api_key=openai_api_key, timeout=120)
                
                transcript = client_with_timeout.audio.transcriptions.create(**transcribe_kwargs)
            
            transcribed_text = transcript if isinstance(transcript, str) else (transcript.text if hasattr(transcript, 'text') else str(transcript))
            
            if not transcribed_text or not transcribed_text.strip():
                error_logger.log_warning(f"[Whisper] ⚠️ Empty transcription result from OpenAI")
                raise Exception(f"Both Groq and OpenAI returned empty transcription. Groq error: {groq_error}")
            
            transcribed_text = transcribed_text.strip()
            detected_lang = self._detect_text_language(transcribed_text)
            error_logger.log_info(f"[Whisper] ✅ OpenAI transcription complete | Length: {len(transcribed_text)} chars | Detected language: {detected_lang}")
            error_logger.log_info(f"[Whisper] Preview: {transcribed_text[:150]}...")
            
            return transcribed_text
            
        except Exception as e:
            error_logger.log_info(f"[Whisper] ❌ OpenAI Whisper also failed: {str(e)}")
            raise Exception(f"Transcription failed with both providers. Groq: {groq_error}, OpenAI: {str(e)}")
    
    def _detect_text_language(self, text: str) -> str:
        """Detect the primary language of transcribed text"""
        if not text:
            return "unknown"
        
        sample = text[:500]
        
        arabic_chars = sum(1 for c in sample if '\u0600' <= c <= '\u06FF' or '\u0750' <= c <= '\u077F')
        hebrew_chars = sum(1 for c in sample if '\u0590' <= c <= '\u05FF')
        cjk_chars = sum(1 for c in sample if '\u4E00' <= c <= '\u9FFF' or '\u3040' <= c <= '\u30FF' or '\uAC00' <= c <= '\uD7AF')
        cyrillic_chars = sum(1 for c in sample if '\u0400' <= c <= '\u04FF')
        thai_chars = sum(1 for c in sample if '\u0E00' <= c <= '\u0E7F')
        latin_chars = sum(1 for c in sample if 'A' <= c <= 'Z' or 'a' <= c <= 'z')
        
        total_chars = len(sample.replace(' ', ''))
        if total_chars == 0:
            return "unknown"
        
        if arabic_chars / total_chars > 0.3:
            return "ar"
        elif hebrew_chars / total_chars > 0.3:
            return "he"
        elif cjk_chars / total_chars > 0.3:
            return "cjk"
        elif cyrillic_chars / total_chars > 0.3:
            return "ru"
        elif thai_chars / total_chars > 0.3:
            return "th"
        elif latin_chars / total_chars > 0.5:
            return "en/latin"
        
        return "mixed"

# Global AI manager instance
ai_manager = AIManager()
