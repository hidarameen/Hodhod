"""
Audio Processing Service
Transcribe audio/voice messages with Whisper and summarize with AI
Enhanced with file size validation, timeout handling, and retry mechanisms
"""
import os
import asyncio
import subprocess
from typing import Dict, Any, Optional, Tuple
from utils.error_handler import handle_errors, ErrorLogger, TaskLogger
from utils.database import db
from services.ai_providers import ai_manager
from services.ai_pipeline import ai_pipeline
from services.telegraph_service import telegraph_manager

error_logger = ErrorLogger("audio_processor")

MAX_AUDIO_SIZE_MB = 25
MAX_AUDIO_SIZE_FOR_COMPRESSION_MB = 500
TRANSCRIPTION_TIMEOUT = 120
SUPPORTED_AUDIO_EXTENSIONS = {'.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.opus', '.oga', '.wma', '.alac', '.ape', '.mid', '.midi', '.webm', '.m4b', '.ac3', '.dsd', '.dsf', '.dff', '.iff', '.aiff', '.aifc', '.au', '.snd', '.caf', '.dts', '.dtshd', '.mka', '.mkv', '.mov', '.mp4', '.m4v'}

class AudioProcessor:
    """Process audio/voice messages with enhanced validation and error handling"""
    
    def __init__(self, temp_dir: str = "telegram_bot/temp"):
        self.temp_dir = temp_dir
        os.makedirs(temp_dir, exist_ok=True)
        error_logger.log_info("AudioProcessor initialized")
    
    def is_audio_file(self, file_name: str) -> bool:
        """Check if a file is an audio file based on extension"""
        if not file_name:
            return False
        ext = os.path.splitext(file_name)[1].lower()
        return ext in SUPPORTED_AUDIO_EXTENSIONS
    
    def _get_file_size_mb(self, file_path: str) -> float:
        """Get file size in megabytes"""
        if os.path.exists(file_path):
            return os.path.getsize(file_path) / (1024 * 1024)
        return 0
    
    def _validate_audio_file(self, audio_path: str, skip_size_check: bool = False) -> Tuple[bool, str]:
        """Validate audio file before processing"""
        if not audio_path:
            return False, "Audio path is empty"
        
        if not os.path.exists(audio_path):
            return False, f"Audio file not found: {audio_path}"
        
        file_size_mb = self._get_file_size_mb(audio_path)
        
        if file_size_mb < 0.001:
            return False, "Audio file is empty or corrupted"
        
        ext = os.path.splitext(audio_path)[1].lower()
        if ext not in SUPPORTED_AUDIO_EXTENSIONS:
            error_logger.log_warning(f"Unsupported audio extension: {ext}, attempting anyway")
        
        return True, "Valid"
    
    @handle_errors("audio_processor", "process_audio")
    async def process_audio(
        self,
        client,
        message_id: int,
        chat_id: int,
        task_id: int,
        task_config: Dict[str, Any]
    ) -> Optional[Tuple[str, str, Optional[str]]]:
        """
        Process audio: download -> transcribe -> summarize -> create Telegraph page
        Returns tuple of (summary, transcript, telegraph_url)
        
        Enhanced with:
        - File size validation
        - Timeout handling for all operations
        - Better error recovery
        - Comprehensive logging
        """
        task_logger = TaskLogger(task_id)
        audio_path = None
        
        try:
            await task_logger.log_info("Starting audio processing...")
            
            try:
                message = await asyncio.wait_for(
                    client.get_messages(chat_id, message_id),
                    timeout=30
                )
            except asyncio.TimeoutError:
                await task_logger.log_error("Timeout fetching message")
                return None
            
            if not message:
                await task_logger.log_warning("Message not found")
                return None
            
            has_audio = message.audio or message.voice
            audio_obj = None
            is_document_audio = False
            
            # Check if message has audio or voice
            if has_audio:
                audio_obj = message.audio or message.voice
            # Check if message has a document that is an audio file
            elif message.document and self.is_audio_file(message.document.file_name or ""):
                audio_obj = message.document
                has_audio = True
                is_document_audio = True
                await task_logger.log_info(f"Detected audio document: {message.document.file_name}")
            
            if not has_audio or not audio_obj:
                await task_logger.log_warning("Audio not found in message")
                return None
            
            audio_size_mb = (audio_obj.file_size or 0) / (1024 * 1024)
            
            # Documents don't have duration attribute, only audio/voice do
            duration = getattr(audio_obj, 'duration', None) or 0
            await task_logger.log_info(f"Audio info: {audio_size_mb:.1f}MB, duration: {duration}s")
            
            # Determine file extension
            if message.voice:
                ext = ".ogg"
            elif message.document and message.document.file_name:
                # Use the actual file extension from document
                ext = os.path.splitext(message.document.file_name)[1].lower() or ".m4a"
            else:
                ext = ".mp3"
            
            audio_path = os.path.join(
                self.temp_dir,
                f"audio_{message_id}_{int(asyncio.get_event_loop().time())}{ext}"
            )
            
            await task_logger.log_info("Downloading audio...")
            download_timeout = max(60, int(audio_size_mb * 10))
            try:
                await asyncio.wait_for(
                    message.download(file_name=audio_path),
                    timeout=download_timeout
                )
            except asyncio.TimeoutError:
                await task_logger.log_error(f"Audio download timeout after {download_timeout}s")
                return None
            
            is_valid, validation_msg = self._validate_audio_file(audio_path)
            if not is_valid:
                await task_logger.log_warning(f"Audio validation failed: {validation_msg}")
                return None
            
            # Always convert audio to MP3 format for Whisper API compatibility
            # MP3 is widely supported by both Groq and OpenAI Whisper
            current_size_mb = self._get_file_size_mb(audio_path)
            current_ext = os.path.splitext(audio_path)[1].lower()
            
            # Always convert to MP3 regardless of original format
            needs_processing = True
            reason = f"converting {current_ext} to MP3"
            if current_size_mb > MAX_AUDIO_SIZE_MB:
                reason = f"{current_size_mb:.1f}MB + converting to MP3"
            
            if needs_processing:
                await task_logger.log_info(f"Audio processing: {reason}...")
                
                # Always use MP3 for output (widely supported)
                compressed_path = os.path.join(
                    self.temp_dir,
                    f"audio_compressed_{message_id}_{int(asyncio.get_event_loop().time())}.mp3"
                )
                
                # Choose bitrates based on file size
                # Small files: high quality conversion only
                # Large files: progressive compression
                if current_size_mb <= MAX_AUDIO_SIZE_MB:
                    # File is small, just convert to MP3 with good quality
                    bitrates = ["128k", "64k", "32k"]
                else:
                    # File is large, need aggressive compression
                    bitrates = ["32k", "16k", "8k", "4k"]
                
                compression_successful = False
                for bitrate in bitrates:
                    await task_logger.log_info(f"Converting to MP3 with bitrate {bitrate}...")
                    if self._compress_audio(audio_path, compressed_path, bitrate=bitrate):
                        compressed_size = self._get_file_size_mb(compressed_path)
                        if compressed_size <= MAX_AUDIO_SIZE_MB:
                            await task_logger.log_info(f"✅ Audio converted: {current_size_mb:.1f}MB → {compressed_size:.1f}MB (bitrate: {bitrate})")
                            os.remove(audio_path)
                            audio_path = compressed_path
                            compression_successful = True
                            break
                        else:
                            await task_logger.log_info(f"Bitrate {bitrate} not sufficient: {compressed_size:.1f}MB (trying lower...)")
                            os.remove(compressed_path)
                    else:
                        await task_logger.log_info(f"Conversion with {bitrate} failed (trying lower...)")
                
                if not compression_successful:
                    await task_logger.log_error(f"Could not convert audio to MP3 under {MAX_AUDIO_SIZE_MB}MB")
                    if os.path.exists(compressed_path):
                        try:
                            os.remove(compressed_path)
                        except:
                            pass
                    return None
            
            await task_logger.log_info("Audio downloaded, starting transcription...")
            
            try:
                transcript = await asyncio.wait_for(
                    asyncio.get_event_loop().run_in_executor(
                        None,
                        lambda: asyncio.run(ai_manager.transcribe_audio(audio_path))
                    ),
                    timeout=TRANSCRIPTION_TIMEOUT
                )
            except asyncio.TimeoutError:
                await task_logger.log_error(f"Transcription timeout after {TRANSCRIPTION_TIMEOUT}s")
                return None
            except Exception as e:
                await task_logger.log_error(f"Transcription error: {str(e)}")
                return None
            
            if not transcript or len(transcript.strip()) < 10:
                await task_logger.log_warning("Transcription too short or empty")
                return None
            
            await task_logger.log_info(f"Transcription complete: {len(transcript)} chars")
            
            provider_id = task_config.get("audio_ai_provider_id") or task_config.get("ai_provider_id")
            model_id = task_config.get("audio_ai_model_id") or task_config.get("ai_model_id")
            
            provider_name = None
            model_name = None
            
            if provider_id:
                # Use configured provider
                provider = await db.get_ai_provider(provider_id)
                model = await db.get_ai_model(model_id) if model_id else None
                
                if not provider:
                    await task_logger.log_warning("Configured AI provider not found, using fallback")
                    provider_name = "groq"
                    model_name = "whisper-large-v3-turbo"
                else:
                    provider_name = provider.get("name", "groq")
                    model_name = model.get("model_name", "whisper-large-v3-turbo") if model else "whisper-large-v3-turbo"
            else:
                # No provider configured, use fallback (Groq)
                await task_logger.log_info("No audio provider configured, using fallback: Groq")
                provider_name = "groq"
                model_name = "whisper-large-v3-turbo"
            
            await task_logger.log_info(f"Summarizing with {provider_name}/{model_name}...")
            
            try:
                # Pass task_config so summarization rules and templates are applied
                result = await ai_pipeline.process_audio_summary(
                    transcript=transcript,
                    task_id=task_id,
                    provider=provider_name,
                    model=model_name,
                    config=task_config
                )
                
                if result.success and result.final_text:
                    summary = result.final_text
                    await task_logger.log_info(f"AI summarization successful: {len(summary)} chars")
                else:
                    summary = self._simple_summarize(transcript)
                    await task_logger.log_warning("AI summarization failed, using simple extraction")
            except Exception as e:
                await task_logger.log_warning(f"AI summarization error: {str(e)}")
                summary = self._simple_summarize(transcript)
            
            await task_logger.log_info(f"Summary generated: {len(summary)} chars")
            
            telegraph_url = None
            try:
                telegraph_title = "تفريغ المقطع الصوتي"
                # Format HTML without extra whitespace/indentation
                telegraph_content = (
                    "<h3>📝 النص الكامل المُفرّغ من المقطع الصوتي</h3>"
                    f"<p>{transcript.replace(chr(10), '<br/>')}</p>"
                    "<hr/>"
                    "<h3>📋 الملخص</h3>"
                    f"<p>{summary.replace(chr(10), '<br/>')}</p>"
                )
                telegraph_url = await telegraph_manager.create_page(
                    title=telegraph_title,
                    content=telegraph_content
                )
                if telegraph_url:
                    await task_logger.log_info(f"Telegraph page created: {telegraph_url}")
                else:
                    await task_logger.log_warning("Telegraph page creation returned no URL")
            except Exception as e:
                await task_logger.log_warning(f"Failed to create Telegraph page: {str(e)}")
                error_logger.log_warning(f"Telegraph creation error: {str(e)}")
            
            await task_logger.log_success("Audio processing completed successfully")
            return summary, transcript, telegraph_url
            
        except Exception as e:
            await task_logger.log_error(f"Audio processing error: {str(e)}")
            error_logger.log_warning(f"Audio processing error: {str(e)}")
            return None
        finally:
            if audio_path and os.path.exists(audio_path):
                try:
                    os.remove(audio_path)
                    error_logger.log_info(f"Cleaned up temp audio: {audio_path}")
                except Exception:
                    pass
    
    def _compress_audio(self, audio_path: str, output_path: str, bitrate: str = "32k") -> bool:
        """Compress audio file using ffmpeg to reduce size below 25MB limit"""
        try:
            cmd = [
                "ffmpeg",
                "-i", audio_path,
                "-b:a", bitrate,
                "-ac", "1",
                "-ar", "16000",
                output_path,
                "-y"
            ]
            result = subprocess.run(cmd, capture_output=True, timeout=600)
            return result.returncode == 0
        except Exception as e:
            error_logger.log_warning(f"Audio compression failed: {str(e)}")
            return False
    
    def _simple_summarize(self, text: str, max_length: int = 500) -> str:
        """Simple text summarization fallback"""
        if len(text) <= max_length:
            return text
        
        sentences = text.replace('؟', '.').replace('!', '.').split('.')
        sentences = [s.strip() for s in sentences if s.strip()]
        
        if len(sentences) <= 3:
            return text[:max_length] + "..."
        
        result = []
        current_length = 0
        for sentence in sentences[:5]:
            if current_length + len(sentence) > max_length:
                break
            result.append(sentence)
            current_length += len(sentence)
        
        return '. '.join(result) + '.'


audio_processor = AudioProcessor()
