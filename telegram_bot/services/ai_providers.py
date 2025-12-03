"""
AI Providers Integration
Support for OpenAI, Groq, Claude, and HuggingFace
"""
import asyncio
from typing import Optional, Dict, Any, Tuple
from config.settings import settings
from utils.error_handler import handle_errors, ErrorLogger

error_logger = ErrorLogger("ai_providers")

class AIProvider:
    """Base AI Provider class"""
    
    def __init__(self, provider_name: str, api_key: str):
        self.provider_name = provider_name
        self.api_key = api_key
    
    async def generate_text(
        self, 
        prompt: str, 
        model: str, 
        max_tokens: int = 1000,
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
        max_tokens: int = 1000,
        temperature: float = 0.7
    ) -> str:
        """Generate text using OpenAI"""
        try:
            from openai import AsyncOpenAI
            
            if not self.client:
                self.client = AsyncOpenAI(api_key=self.api_key)
            
            response = await self.client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=max_tokens,
                temperature=temperature
            )
            
            return response.choices[0].message.content or ""
        except Exception as e:
            error_logger.log_info(f"OpenAI error: {str(e)}")
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
        model: str = "mixtral-8x7b-32768",
        max_tokens: int = 1000,
        temperature: float = 0.7
    ) -> str:
        """Generate text using Groq with fallback models"""
        try:
            from groq import AsyncGroq
            
            if not self.client:
                self.client = AsyncGroq(api_key=self.api_key)
            
            # Log request details
            error_logger.log_info(f"[Groq] Starting request | Model: {model} | Max Tokens: {max_tokens} | Temperature: {temperature} | Input length: {len(prompt)} chars")
            
            # Define fallback models in case primary fails
            models_to_try = [model]
            if "maverick" in model.lower():
                # If Maverick fails, try these alternatives
                models_to_try.extend([
                    "llama-3.3-70b-versatile",
                    "llama-3.1-8b-instant",
                    "mixtral-8x7b-32768"
                ])
            elif "gpt-oss" in model.lower():
                # If GPT OSS fails, try alternatives
                models_to_try.extend([
                    "llama-3.3-70b-versatile",
                    "llama-3.1-8b-instant"
                ])
            
            last_error = None
            for try_model in models_to_try:
                try:
                    # Prepare request parameters
                    request_params = {
                        "model": try_model,
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": max_tokens,
                        "temperature": temperature
                    }
                    
                    # Special handling for GPT OSS models
                    if "gpt-oss" in try_model.lower():
                        # GPT OSS needs higher max_tokens and specific parameters
                        request_params["max_tokens"] = min(8192, max_tokens * 2)
                        request_params["top_p"] = 1.0
                        error_logger.log_info(f"[Groq] GPT-OSS model detected | Adjusted max_tokens to {request_params['max_tokens']} | Added top_p=1.0")
                    
                    response = await self.client.chat.completions.create(**request_params)
                    
                    # Extract content safely
                    if response and response.choices and len(response.choices) > 0:
                        content = response.choices[0].message.content
                        if content and content.strip():
                            if try_model != model:
                                error_logger.log_info(f"[Groq] ℹ️ Using fallback model {try_model} instead of {model}")
                            error_logger.log_info(f"[Groq] ✅ Success | Model: {try_model} | Output length: {len(content)} chars | First 100 chars: {content[:100]}")
                            return content.strip()
                        else:
                            error_logger.log_warning(f"[Groq] ⚠️ Empty content from model {try_model} | Response: {response}")
                            last_error = "empty_content"
                            continue
                    else:
                        error_logger.log_warning(f"[Groq] ⚠️ No choices in response | Model: {try_model} | Response: {response}")
                        last_error = "no_choices"
                        continue
                        
                except Exception as e:
                    error_logger.log_info(f"[Groq] ⚠️ Model {try_model} failed | Error: {str(e)}")
                    last_error = str(e)
                    continue
            
            # If all models failed
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
        max_tokens: int = 1000,
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
        max_tokens: int = 1000,
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
        self._initialize_providers()
    
    def _initialize_providers(self):
        """Initialize all available providers from environment variables"""
        if settings.OPENAI_API_KEY:
            self.providers["openai"] = OpenAIProvider(settings.OPENAI_API_KEY)
        
        if settings.GROQ_API_KEY:
            self.providers["groq"] = GroqProvider(settings.GROQ_API_KEY)
        
        if settings.ANTHROPIC_API_KEY:
            self.providers["claude"] = ClaudeProvider(settings.ANTHROPIC_API_KEY)
        
        if settings.HUGGINGFACE_API_KEY:
            self.providers["huggingface"] = HuggingFaceProvider(settings.HUGGINGFACE_API_KEY)
    
    async def initialize_from_database(self):
        """Initialize providers from database"""
        from utils.database import db
        try:
            active_providers = await db.get_active_providers()
            for provider_info in active_providers:
                provider_name = provider_info.get("name", "").lower()
                api_key = provider_info.get("api_key")
                
                if not api_key:
                    error_logger.log_warning(f"No API key found for provider: {provider_name}")
                    continue
                
                if provider_name == "openai":
                    self.providers["openai"] = OpenAIProvider(api_key)
                    error_logger.log_info(f"Loaded OpenAI provider from database")
                elif provider_name == "groq":
                    self.providers["groq"] = GroqProvider(api_key)
                    error_logger.log_info(f"Loaded Groq provider from database")
                elif provider_name == "claude":
                    self.providers["claude"] = ClaudeProvider(api_key)
                    error_logger.log_info(f"Loaded Claude provider from database")
                elif provider_name == "huggingface":
                    self.providers["huggingface"] = HuggingFaceProvider(api_key)
                    error_logger.log_info(f"Loaded HuggingFace provider from database")
        except Exception as e:
            error_logger.log_warning(f"Failed to initialize providers from database: {str(e)}")
    
    @handle_errors("ai_manager", "generate")
    async def generate(
        self,
        provider: str,
        model: str,
        prompt: str,
        max_tokens: int = 1000,
        temperature: float = 0.7
    ) -> Optional[str]:
        """Generate text using specified provider"""
        if provider not in self.providers:
            available_providers = list(self.providers.keys()) if self.providers else []
            error_msg = f"Provider '{provider}' is not available. "
            if available_providers:
                error_msg += f"Available providers: {', '.join(available_providers)}. "
            else:
                error_msg += "No providers are configured. Please set up API keys for at least one provider (OpenAI, Groq, Claude, or HuggingFace). "
            error_msg += "Check your environment variables or database configuration."
            error_logger.log_warning(f"[AIManager] {error_msg}")
            raise ValueError(error_msg)
        
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
            custom_rule: Custom rule/prompt for summarization (also used for post-processing text replacements)
            system_prompt: System prompt to override default
            max_tokens: Maximum tokens for response (auto-calculated if not provided)
        """
        # Store custom_rule for post-processing
        self._current_custom_rule = custom_rule
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
                max_tokens = 1000
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
            
            # Lazy import to avoid circular import at module load time
            from services.ai_enhancement import ai_enhancer
            
            # Enhance result with validation, cleaning, quality scoring, and TEXT REPLACEMENTS
            enhanced_result, quality_score, metadata = await ai_enhancer.enhance_result(
                original_text=text,
                ai_result=result,
                task_type="summarization",
                custom_rule=custom_rule  # Pass custom_rule for direct text replacements
            )
            
            result_length = len(enhanced_result)
            if text_length > 0:
                reduction_percent = max(0, min(100, 100 - (result_length * 100 // text_length)))
            else:
                reduction_percent = 0
            
            error_logger.log_info(f"[AIManager] ✅ Summarization complete | Provider: {provider} | Model: {model} | Output: {result_length} chars | Reduction: {text_length - result_length} chars ({reduction_percent}%) | Quality: {quality_score:.2f}")
            error_logger.log_info(f"[AIManager] Metadata: {metadata}")
            error_logger.log_info(f"[AIManager] Summary preview: {enhanced_result[:150]}")
            return enhanced_result
        else:
            error_logger.log_info(f"[AIManager] ⚠️ Summarization failed after {max_retries + 1} attempts, returning original text | Provider: {provider} | Model: {model}")
            return text
    
    @handle_errors("ai_manager", "transcribe_audio")
    async def transcribe_audio(self, audio_file_path: str) -> str:
        """Transcribe audio using Groq Whisper API"""
        import os
        try:
            # Check file exists
            if not os.path.exists(audio_file_path):
                raise FileNotFoundError(f"Audio file not found: {audio_file_path}")
            
            file_size = os.path.getsize(audio_file_path)
            error_logger.log_info(f"[Whisper] Starting transcription | File: {audio_file_path} | Size: {file_size} bytes")
            
            # Use Groq Whisper API
            if "groq" not in self.providers:
                error_logger.log_warning(f"[Whisper] Groq provider not available, attempting to use Groq API directly")
                if not settings.GROQ_API_KEY:
                    raise Exception("Groq API key not configured for Whisper transcription")
            
            from groq import Groq
            
            # Create Groq client
            groq_api_key = settings.GROQ_API_KEY or (self.providers["groq"].api_key if "groq" in self.providers else None)
            if not groq_api_key:
                raise Exception("Groq API key not available")
            
            client = Groq(api_key=groq_api_key)
            
            # Open and transcribe audio file
            error_logger.log_info(f"[Whisper] Opening audio file for transcription...")
            with open(audio_file_path, "rb") as audio_file:
                error_logger.log_info(f"[Whisper] Sending to Groq Whisper API (whisper-large-v3-turbo)...")
                
                # Use Groq's Whisper API
                transcript = client.audio.transcriptions.create(
                    file=(os.path.basename(audio_file_path), audio_file, "audio/mpeg"),
                    model="whisper-large-v3-turbo",
                    language="ar"  # Arabic language
                )
            
            transcribed_text = transcript.text
            error_logger.log_info(f"[Whisper] ✅ Transcription complete | Length: {len(transcribed_text)} chars | Preview: {transcribed_text[:100]}")
            
            return transcribed_text
        except Exception as e:
            error_logger.log_info(f"[Whisper] ❌ Transcription error: {str(e)}")
            raise

# Global AI manager instance
ai_manager = AIManager()
