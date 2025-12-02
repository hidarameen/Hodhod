"""
Video Processing Service
Convert video to audio, transcribe with Whisper, and summarize with AI
"""
import os
import asyncio
from typing import Dict, Any, Optional, Tuple
from utils.error_handler import handle_errors, ErrorLogger, TaskLogger
from utils.database import db
from services.ai_providers import ai_manager
from services.telegraph_service import telegraph_manager

error_logger = ErrorLogger("video_processor")

class VideoProcessor:
    """Process video messages"""
    
    def __init__(self, temp_dir: str = "telegram_bot/temp"):
        self.temp_dir = temp_dir
        os.makedirs(temp_dir, exist_ok=True)
        error_logger.log_info("VideoProcessor initialized")
    
    @handle_errors("video_processor", "extract_audio")
    async def extract_audio(self, video_path: str) -> Optional[str]:
        """Extract audio from video file"""
        try:
            import ffmpeg
            
            audio_path = video_path.rsplit(".", 1)[0] + ".mp3"
            
            stream = ffmpeg.input(video_path)
            stream = ffmpeg.output(stream, audio_path, acodec='libmp3lame', ar='16000')
            ffmpeg.run(stream, overwrite_output=True, quiet=True)
            
            if os.path.exists(audio_path):
                error_logger.log_info(f"Audio extracted: {audio_path}")
                return audio_path
            return None
            
        except Exception as e:
            error_logger.log_info(f"Audio extraction error: {str(e)}")
            return None
    
    @handle_errors("video_processor", "process_video")
    async def process_video(
        self,
        client,
        message_id: int,
        chat_id: int,
        task_id: int,
        task_config: Dict[str, Any]
    ) -> Optional[Tuple[str, str, Optional[str]]]:
        """
        Process video: download -> extract audio -> transcribe -> summarize -> create Telegraph page
        Returns tuple of (summary, transcript, telegraph_url)
        """
        task_logger = TaskLogger(task_id)
        video_path = None
        audio_path = None
        
        try:
            await task_logger.log_info("Starting video processing...")
            
            message = await client.get_messages(chat_id, message_id)
            if not message or not message.video:
                await task_logger.log_warning("Video not found")
                return None
            
            video_path = os.path.join(
                self.temp_dir,
                f"video_{message_id}_{asyncio.get_event_loop().time():.0f}.mp4"
            )
            
            await task_logger.log_info("Downloading video...")
            await message.download(file_name=video_path)
            
            file_size = os.path.getsize(video_path) if os.path.exists(video_path) else 0
            await task_logger.log_info(f"Video downloaded: {file_size} bytes")
            
            await task_logger.log_info("Extracting audio from video...")
            audio_path = await self.extract_audio(video_path)
            
            if not audio_path:
                await task_logger.log_warning("Failed to extract audio")
                return None
            
            await task_logger.log_info("Transcribing audio with Whisper...")
            transcript = await ai_manager.transcribe_audio(audio_path)
            
            if not transcript:
                await task_logger.log_warning("Transcription failed")
                return None
            
            await task_logger.log_info(f"Transcription completed: {len(transcript)} characters")
            
            provider_id = task_config.get("video_ai_provider_id") or task_config.get("summarization_provider_id")
            model_id = task_config.get("video_ai_model_id") or task_config.get("summarization_model_id")
            
            rules = await db.get_task_rules(task_id)
            summarize_rule = next((r for r in rules if r["type"] == "summarize" and r["is_active"]), None)
            
            provider_name = "groq"
            model_name = "mixtral-8x7b-32768"
            
            if provider_id:
                provider_info = await db.get_ai_provider(provider_id)
                if provider_info:
                    provider_name = provider_info["name"]
            
            if model_id:
                model_info = await db.get_ai_model(model_id)
                if model_info:
                    model_name = model_info["model_name"]
            
            custom_rule = summarize_rule["prompt"] if summarize_rule else None
            
            await task_logger.log_info(f"Summarizing transcript with AI ({provider_name}/{model_name})...")
            summary = await ai_manager.summarize_text(
                transcript,
                provider=provider_name,
                model=model_name,
                custom_rule=custom_rule
            )
            
            # Create Telegraph page with original transcript
            await task_logger.log_info("Creating Telegraph page for original transcript...")
            telegraph_url = None
            try:
                telegraph_url = await telegraph_manager.create_text_page(
                    title="نص الفيديو الأصلي",
                    content=transcript,
                    description="النص المستخرج من الفيديو باستخدام Whisper"
                )
                await task_logger.log_success(f"Telegraph page created: {telegraph_url}")
            except Exception as telegraph_err:
                await task_logger.log_warning(f"Failed to create Telegraph page: {str(telegraph_err)}")
            
            await task_logger.log_success(f"Video processing completed. Summary: {len(summary)} chars, Telegraph: {telegraph_url}")
            await db.update_task_stats(task_id, "video")
            
            return (summary, transcript, telegraph_url)
            
        except Exception as e:
            await task_logger.log_error(f"Video processing error: {str(e)}")
            await db.update_task_stats(task_id, "error")
            raise
        finally:
            try:
                if video_path and os.path.exists(video_path):
                    os.remove(video_path)
                if audio_path and os.path.exists(audio_path):
                    os.remove(audio_path)
            except Exception:
                pass

video_processor = VideoProcessor()
