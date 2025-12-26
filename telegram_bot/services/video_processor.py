"""
Video Processing Service
Convert video to audio, transcribe with Whisper, and summarize with AI
Enhanced with file size validation, timeout handling, and retry mechanisms
"""
import os
import asyncio
from typing import Dict, Any, Optional, Tuple
from utils.error_handler import handle_errors, ErrorLogger, TaskLogger
from utils.database import db
from services.ai_providers import ai_manager
from services.ai_pipeline import ai_pipeline
from services.telegraph_service import telegraph_manager

error_logger = ErrorLogger("video_processor")

MAX_VIDEO_SIZE_MB = 100
MAX_AUDIO_SIZE_MB = 25
EXTRACTION_TIMEOUT = 180
TRANSCRIPTION_TIMEOUT = 300
SUPPORTED_VIDEO_EXTENSIONS = {'.mp4', '.avi', '.mkv', '.mov', '.webm', '.flv', '.wmv', '.m4v'}

class VideoProcessor:
    """Process video messages with enhanced validation and error handling"""
    
    def __init__(self, temp_dir: str = "telegram_bot/temp"):
        self.temp_dir = temp_dir
        os.makedirs(temp_dir, exist_ok=True)
        error_logger.log_info("VideoProcessor initialized")
    
    def _get_file_size_mb(self, file_path: str) -> float:
        """Get file size in megabytes"""
        if os.path.exists(file_path):
            return os.path.getsize(file_path) / (1024 * 1024)
        return 0
    
    def _validate_video_file(self, video_path: str) -> Tuple[bool, str]:
        """Validate video file before processing"""
        if not video_path:
            return False, "Video path is empty"
        
        if not os.path.exists(video_path):
            return False, f"Video file not found: {video_path}"
        
        file_size_mb = self._get_file_size_mb(video_path)
        if file_size_mb > MAX_VIDEO_SIZE_MB:
            return False, f"Video too large: {file_size_mb:.1f}MB (max: {MAX_VIDEO_SIZE_MB}MB)"
        
        if file_size_mb < 0.001:
            return False, "Video file is empty or corrupted"
        
        ext = os.path.splitext(video_path)[1].lower()
        if ext not in SUPPORTED_VIDEO_EXTENSIONS:
            error_logger.log_warning(f"Unsupported video extension: {ext}, attempting anyway")
        
        return True, "Valid"
    
    @handle_errors("video_processor", "extract_audio")
    async def extract_audio(self, video_path: str, timeout: int = EXTRACTION_TIMEOUT) -> Optional[str]:
        """Extract audio from video file with timeout and validation"""
        try:
            is_valid, validation_msg = self._validate_video_file(video_path)
            if not is_valid:
                error_logger.log_warning(f"Video validation failed: {validation_msg}")
                return None
            
            import ffmpeg
            
            audio_path = video_path.rsplit(".", 1)[0] + ".mp3"
            
            error_logger.log_info(f"Extracting audio from video: {video_path} -> {audio_path}")
            
            def run_ffmpeg():
                stream = ffmpeg.input(video_path)
                stream = ffmpeg.output(
                    stream, 
                    audio_path, 
                    acodec='libmp3lame', 
                    ar='16000',
                    ac=1,
                    ab='64k'
                )
                ffmpeg.run(stream, overwrite_output=True, quiet=True)
            
            loop = asyncio.get_event_loop()
            await asyncio.wait_for(
                loop.run_in_executor(None, run_ffmpeg),
                timeout=timeout
            )
            
            if os.path.exists(audio_path):
                audio_size_mb = self._get_file_size_mb(audio_path)
                
                if audio_size_mb > MAX_AUDIO_SIZE_MB:
                    error_logger.log_warning(f"Audio file too large for transcription: {audio_size_mb:.1f}MB (max: {MAX_AUDIO_SIZE_MB}MB)")
                    return None
                
                if audio_size_mb < 0.001:
                    error_logger.log_warning("Audio extraction produced empty file")
                    if os.path.exists(audio_path):
                        os.remove(audio_path)
                    return None
                
                error_logger.log_info(f"Audio extracted successfully: {audio_path} ({audio_size_mb:.2f}MB)")
                return audio_path
            
            return None
            
        except asyncio.TimeoutError:
            error_logger.log_warning(f"Audio extraction timeout after {timeout}s")
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
        task_config: Dict[str, Any],
        caption_summary: Optional[str] = None,
        caption_text: Optional[str] = None,
        serial_number: Optional[str] = None
    ) -> Optional[Tuple[str, str, Optional[str]]]:
        """
        Process video: download -> extract audio -> transcribe -> summarize -> create Telegraph page
        Returns tuple of (combined_summary, transcript, telegraph_url)
        
        Enhanced with:
        - File size validation
        - Timeout handling for all operations
        - Better error recovery
        - Comprehensive logging
        - ✅ NEW: Caption and video summary merging
        
        Args:
            caption_summary: Pre-summarized caption text (if any)
            caption_text: Original caption text (if any)
        """
        task_logger = TaskLogger(task_id)
        video_path = None
        audio_path = None
        
        try:
            await task_logger.log_info("Starting video processing...")
            
            try:
                message = await asyncio.wait_for(
                    client.get_messages(chat_id, message_id),
                    timeout=30
                )
            except asyncio.TimeoutError:
                await task_logger.log_error("Timeout fetching message")
                return None
            
            if not message or not message.video:
                await task_logger.log_warning("Video not found in message")
                return None
            
            video_size_mb = (message.video.file_size or 0) / (1024 * 1024)
            if video_size_mb > MAX_VIDEO_SIZE_MB:
                await task_logger.log_warning(f"Video too large: {video_size_mb:.1f}MB (max: {MAX_VIDEO_SIZE_MB}MB)")
                return None
            
            await task_logger.log_info(f"Video info: {video_size_mb:.1f}MB, duration: {message.video.duration or 0}s")
            
            video_path = os.path.join(
                self.temp_dir,
                f"video_{message_id}_{int(asyncio.get_event_loop().time())}.mp4"
            )
            
            await task_logger.log_info("Downloading video...")
            download_timeout = max(60, int(video_size_mb * 10))
            try:
                await asyncio.wait_for(
                    message.download(file_name=video_path),
                    timeout=download_timeout
                )
            except asyncio.TimeoutError:
                await task_logger.log_error(f"Video download timeout after {download_timeout}s")
                return None
            
            is_valid, validation_msg = self._validate_video_file(video_path)
            if not is_valid:
                await task_logger.log_warning(f"Downloaded video validation failed: {validation_msg}")
                return None
            
            file_size_mb = self._get_file_size_mb(video_path)
            await task_logger.log_info(f"Video downloaded: {file_size_mb:.2f}MB")
            
            await task_logger.log_info("Extracting audio from video...")
            audio_path = await self.extract_audio(video_path)
            
            if not audio_path:
                await task_logger.log_warning("Failed to extract audio from video")
                return None
            
            await task_logger.log_info("Transcribing audio with Whisper...")
            try:
                transcript = await asyncio.wait_for(
                    ai_manager.transcribe_audio(audio_path),
                    timeout=TRANSCRIPTION_TIMEOUT
                )
            except asyncio.TimeoutError:
                await task_logger.log_error(f"Transcription timeout after {TRANSCRIPTION_TIMEOUT}s")
                return None
            
            if not transcript or not transcript.strip():
                await task_logger.log_warning("Transcription failed or returned empty result")
                return None
            
            transcript = transcript.strip()
            await task_logger.log_info(f"Transcription completed: {len(transcript)} characters")
            
            provider_id = task_config.get("video_ai_provider_id") or task_config.get("summarization_provider_id")
            model_id = task_config.get("video_ai_model_id") or task_config.get("summarization_model_id")
            
            # Get video rules specifically (not text summarization rules)
            rules = await db.get_task_rules(task_id)
            video_rule = next((r for r in rules if r["type"] == "video" and r["is_active"]), None)
            await task_logger.log_info(f"Found video rules: {len([r for r in rules if r['type'] == 'video'])}, active: {video_rule is not None}")
            
            provider_name = "groq"
            model_name = "llama-3.3-70b-versatile"
            
            if provider_id:
                provider_info = await db.get_ai_provider(provider_id)
                if provider_info:
                    provider_name = provider_info["name"]
            
            if model_id:
                model_info = await db.get_ai_model(model_id)
                if model_info:
                    model_name = model_info["model_name"]
            
            custom_rule = video_rule["prompt"] if video_rule else None
            if video_rule:
                await task_logger.log_info(f"Using video rule: {video_rule.get('name', 'unnamed')}")
            
            await task_logger.log_info(f"Summarizing merged content (caption + transcript) with AI Pipeline ({provider_name}/{model_name})...")
            
            # Combine caption and transcript for a single summarization
            merged_content = f"الكابشن المصاحب للفيديو:\n{caption_text}\n\nنص الفيديو المستخرج (Transcription):\n{transcript}" if caption_text else transcript
            
            # Apply BOTH video rules AND summarize rules
            video_rules = [r for r in rules if r["type"] == "video" and r["is_active"]]
            summarize_rules = [r for r in rules if r["type"] == "summarize" and r["is_active"]]
            all_applicable_rules = video_rules + summarize_rules
            
            # Video source info not available for direct video uploads
            # Only available when processing links via link_processor
            video_source_info = None
            
            pipeline_result = await ai_pipeline.process(
                text=merged_content,
                task_id=task_id,
                provider=provider_name,
                model=model_name,
                system_prompt=custom_rule,
                custom_rules=all_applicable_rules,
                video_source_info=video_source_info,
                fields_to_extract=True # Enable field extraction
            )
            combined_summary = pipeline_result.final_text
            await task_logger.log_info(f"Merged summary created: {len(combined_summary)} chars (quality: {pipeline_result.quality_score:.2f})")
            
            await task_logger.log_info("Creating Telegraph page for original transcript...")
            telegraph_url = None
            try:
                # ✅ FIX: Include caption in Telegraph page for full context
                full_content = f"الكابشن الأصلي:\n{caption_text}\n\n--- \n\nنص الفيديو:\n{transcript}" if caption_text else transcript
                telegraph_url = await telegraph_manager.create_text_page(
                    title="نص الفيديو الأصلي",
                    content=full_content,
                    description="النص المستخرج من الفيديو والملخص المصاحب"
                )
                if telegraph_url:
                    await task_logger.log_success(f"Telegraph page created: {telegraph_url}")
                else:
                    await task_logger.log_warning("Telegraph page creation returned empty URL")
            except Exception as telegraph_err:
                await task_logger.log_warning(f"Failed to create Telegraph page: {str(telegraph_err)}")
            
            summary_len = len(combined_summary) if combined_summary else 0
            await task_logger.log_success(f"Video processing completed. Summary: {summary_len} chars, Telegraph: {telegraph_url or 'N/A'}")
            await db.update_task_stats(task_id, "video")
            
            # ✅ NEW: Forward the video to targets AFTER processing
            from services.forwarding_engine import ForwardingEngine
            # Create a lightweight engine instance
            engine = ForwardingEngine(client)
            
            # Build extracted_data for template and archive
            # Ensure we have a valid extracted_data dict
            final_extracted_data = {}
            if pipeline_result and hasattr(pipeline_result, 'extracted_fields') and pipeline_result.extracted_fields:
                final_extracted_data = pipeline_result.extracted_fields.copy()
            
            # ✅ Ensure common fields are present for the template
            if "التلخيص" not in final_extracted_data and combined_summary:
                final_extracted_data["التلخيص"] = combined_summary
            
            if serial_number:
                final_extracted_data["serial_number"] = serial_number
                final_extracted_data["رقم_القيد"] = f"#{serial_number}"
            # ✅ Removed duplicated Telegraph link - it will be added by _forward_to_target via template or manually
            # if telegraph_url:
            #     final_extracted_data["telegraph_url"] = telegraph_url
            if caption_text:
                # Store original caption for extraction in template
                final_extracted_data["caption"] = caption_text
            
            # Get target channels
            target_channels = task_config.get("target_channels", [])
            for target_id in target_channels:
                try:
                    await engine._forward_to_target(
                        message=message,
                        target_id=target_id,
                        processed_text=combined_summary,
                        task_logger=task_logger,
                        task_id=task_id,
                        extracted_data=final_extracted_data
                    )
                except Exception as forward_err:
                    await task_logger.log_error(f"Error forwarding video to {target_id}: {str(forward_err)}")
            
            # Archive the message
            try:
                # Use engine._save_to_archive which takes correct parameters
                await engine._save_to_archive(
                    message=message,
                    task_id=task_id,
                    processed_text=combined_summary,
                    extracted_data=final_extracted_data,
                    task_config=task_config
                )
            except Exception as archive_err:
                await task_logger.log_error(f"Error archiving video: {str(archive_err)}")
            
            await task_logger.log_success(f"Video with summary forwarded to {len(target_channels)} targets")
            return (combined_summary, transcript, telegraph_url)
            
        except Exception as e:
            await task_logger.log_error(f"Video processing error: {str(e)}")
            await db.update_task_stats(task_id, "error")
            raise
        finally:
            self._cleanup_temp_files([video_path, audio_path])
    
    def _cleanup_temp_files(self, file_paths: list):
        """Safely cleanup temporary files"""
        for file_path in file_paths:
            if file_path and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                    error_logger.log_info(f"Cleaned up temp file: {file_path}")
                except Exception as e:
                    error_logger.log_warning(f"Failed to cleanup {file_path}: {str(e)}")
    
    async def cleanup_old_temp_files(self, max_age_hours: int = 24):
        """Cleanup old temporary files that might be left over"""
        import time
        try:
            current_time = time.time()
            max_age_seconds = max_age_hours * 3600
            cleaned = 0
            
            for filename in os.listdir(self.temp_dir):
                filepath = os.path.join(self.temp_dir, filename)
                if os.path.isfile(filepath):
                    file_age = current_time - os.path.getmtime(filepath)
                    if file_age > max_age_seconds:
                        try:
                            os.remove(filepath)
                            cleaned += 1
                        except Exception:
                            pass
            
            if cleaned > 0:
                error_logger.log_info(f"Cleaned up {cleaned} old temp files")
        except Exception as e:
            error_logger.log_warning(f"Temp cleanup error: {str(e)}")

video_processor = VideoProcessor()
