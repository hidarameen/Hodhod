"""
Link Processing Service
Download videos from social media links and process them
Supports YouTube, Twitter/X, Instagram, TikTok, Facebook, and more via yt-dlp
"""
import os
import re
import asyncio
import subprocess
from typing import Dict, Any, Optional, Tuple
from utils.error_handler import handle_errors, ErrorLogger, TaskLogger
from utils.database import db
from services.ai_providers import ai_manager
from services.telegraph_service import telegraph_manager

error_logger = ErrorLogger("link_processor")

URL_PATTERNS = [
    r'https?://(?:www\.)?youtube\.com/watch\?v=[\w-]+',
    r'https?://youtu\.be/[\w-]+',
    r'https?://(?:www\.)?twitter\.com/\w+/status/\d+',
    r'https?://(?:www\.)?x\.com/\w+/status/\d+',
    r'https?://(?:www\.)?instagram\.com/(?:p|reel|tv)/[\w-]+',
    r'https?://(?:www\.)?tiktok\.com/@[\w.-]+/video/\d+',
    r'https?://(?:vm\.)?tiktok\.com/[\w-]+',
    r'https?://(?:www\.)?facebook\.com/[\w.]+/videos/\d+',
    r'https?://fb\.watch/[\w-]+',
    r'https?://(?:www\.)?vimeo\.com/\d+',
    r'https?://(?:www\.)?dailymotion\.com/video/[\w-]+',
    r'https?://(?:www\.)?reddit\.com/r/\w+/comments/[\w/]+',
    r'https?://(?:www\.)?linkedin\.com/posts/[\w-]+',
    r'https?://(?:www\.)?twitch\.tv/videos/\d+',
]

class LinkProcessor:
    """Process video links from social media"""
    
    def __init__(self, temp_dir: str = "telegram_bot/temp"):
        self.temp_dir = temp_dir
        os.makedirs(temp_dir, exist_ok=True)
        error_logger.log_info("LinkProcessor initialized")
    
    def is_video_link(self, text: str) -> bool:
        """Check if text contains only a video link (no other text)"""
        if not text:
            return False
        
        text = text.strip()
        
        for pattern in URL_PATTERNS:
            if re.match(pattern, text):
                return len(text.split()) == 1
        
        if re.match(r'^https?://[^\s]+$', text) and len(text.split()) == 1:
            return True
        
        return False
    
    def extract_url(self, text: str) -> Optional[str]:
        """Extract URL from text"""
        if not text:
            return None
        
        text = text.strip()
        
        url_match = re.match(r'^(https?://[^\s]+)$', text)
        if url_match:
            return url_match.group(1)
        
        return None
    
    @handle_errors("link_processor", "download_video")
    async def download_video(self, url: str, task_id: int, quality: str = "high") -> Optional[str]:
        """Download video from URL using yt-dlp with specified quality"""
        task_logger = TaskLogger(task_id)
        
        try:
            # Full URL logging for debugging
            await task_logger.log_info(f"🔗 DOWNLOADING VIDEO:")
            await task_logger.log_info(f"   URL: {url}")
            await task_logger.log_info(f"   Quality: {quality}")
            error_logger.log_info(f"[LINK_DOWNLOAD] URL={url}, Quality={quality}")
            
            output_path = os.path.join(
                self.temp_dir,
                f"link_video_{task_id}_{asyncio.get_event_loop().time():.0f}.mp4"
            )
            
            # Quality format mapping
            quality_formats = {
                "best": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
                "high": "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
                "medium": "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
                "low": "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
            }
            
            format_str = quality_formats.get(quality, quality_formats["high"])
            
            cmd = [
                "yt-dlp",
                "--quiet",
                "--no-warnings",
                "--no-playlist",
                "--format", format_str,
                "--merge-output-format", "mp4",
                "--max-filesize", "50M",
                "--restrict-filenames",
                "--output", output_path,
                url
            ]
            
            await task_logger.log_info(f"   yt-dlp command: {' '.join(cmd)}")
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=120
            )
            
            # Log stdout and stderr for debugging
            if stdout:
                stdout_str = stdout.decode()
                await task_logger.log_info(f"yt-dlp stdout: {stdout_str[:200]}")
            
            if stderr:
                stderr_str = stderr.decode()
                await task_logger.log_warning(f"yt-dlp stderr: {stderr_str[:200]}")
                error_logger.log_info(f"[LINK_DOWNLOAD] stderr={stderr_str[:200]}")
            
            if process.returncode != 0:
                error_msg = stderr.decode() if stderr else "Unknown error"
                await task_logger.log_error(f"❌ yt-dlp failed with return code {process.returncode}: {error_msg[:200]}")
                error_logger.log_info(f"[LINK_DOWNLOAD] FAILED - returncode={process.returncode}, error={error_msg[:200]}")
                return None
            
            if os.path.exists(output_path):
                size = os.path.getsize(output_path)
                await task_logger.log_success(f"✓ Video downloaded successfully: {size} bytes → {output_path}")
                error_logger.log_info(f"[LINK_DOWNLOAD] SUCCESS - size={size}, path={output_path}")
                return output_path
            else:
                # Fallback: search for any newly created .mp4 file
                await task_logger.log_info(f"Output path not found, searching temp directory...")
                for f in os.listdir(self.temp_dir):
                    if f.startswith(f"link_video_{task_id}_") and f.endswith(".mp4"):
                        found_path = os.path.join(self.temp_dir, f)
                        if os.path.exists(found_path):
                            size = os.path.getsize(found_path)
                            await task_logger.log_success(f"✓ Found video file: {found_path} ({size} bytes)")
                            return found_path
                
                await task_logger.log_error(f"❌ Video file not found after download - expected: {output_path}")
                error_logger.log_info(f"[LINK_DOWNLOAD] FAILED - file not found at {output_path}")
                return None
                
        except asyncio.TimeoutError:
            await task_logger.log_error("❌ Video download timeout (120s)")
            error_logger.log_info(f"[LINK_DOWNLOAD] TIMEOUT - url={url}")
            return None
        except Exception as e:
            await task_logger.log_error(f"❌ Download error: {str(e)}")
            error_logger.log_info(f"[LINK_DOWNLOAD] EXCEPTION - error={str(e)}")
            raise
    
    @handle_errors("link_processor", "extract_audio")
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
    
    @handle_errors("link_processor", "process_link")
    async def process_link(
        self,
        url: str,
        task_id: int,
        task_config: Dict[str, Any]
    ) -> Optional[Tuple[str, Optional[str], Optional[str]]]:
        """
        Full link processing pipeline:
        1. Download video from URL
        2. Extract audio
        3. Transcribe with Whisper
        4. Summarize with AI
        5. Create Telegraph page with transcript
        6. Return video only if download is enabled
        
        Returns tuple of (summary, video_path, telegraph_url)
        - video_path is returned ONLY if linkVideoDownloadEnabled is True
        - video_path is NOT returned if download is disabled (file is deleted)
        """
        task_logger = TaskLogger(task_id)
        video_path = None
        audio_path = None
        downloaded_video_path = None
        result_video_path = None
        
        try:
            await task_logger.log_info(f"Processing link: {url[:50]}...")
            
            # Step 1: Download video
            quality = task_config.get("linkVideoQuality", "high")
            await task_logger.log_info(f"Step 1: Downloading video (quality: {quality})...")
            downloaded_video_path = await self.download_video(url, task_id, quality)
            
            if not downloaded_video_path:
                await task_logger.log_error("Failed to download video")
                return None
            
            await task_logger.log_success(f"✓ Video downloaded: {downloaded_video_path}")
            video_path = downloaded_video_path
            
            # Step 2: Extract audio from video
            await task_logger.log_info("Step 2: Extracting audio from video...")
            audio_path = await self.extract_audio(video_path)
            
            if not audio_path:
                await task_logger.log_error("Failed to extract audio")
                return None
            
            await task_logger.log_success(f"✓ Audio extracted: {audio_path}")
            
            # Step 3: Transcribe with Whisper
            await task_logger.log_info("Step 3: Transcribing audio with Whisper...")
            transcript = await ai_manager.transcribe_audio(audio_path)
            
            if not transcript:
                await task_logger.log_error("Transcription failed")
                return None
            
            await task_logger.log_success(f"✓ Transcription completed: {len(transcript)} chars")
            
            # Step 4: Summarize with AI
            await task_logger.log_info("Step 4: Summarizing transcript with AI...")
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
            
            summary = await ai_manager.summarize_text(
                transcript,
                provider=provider_name,
                model=model_name,
                custom_rule=custom_rule
            )
            
            await task_logger.log_success(f"✓ Summary generated: {len(summary)} chars")
            
            # Step 5: Create Telegraph page
            await task_logger.log_info("Step 5: Creating Telegraph page...")
            telegraph_url = None
            try:
                telegraph_url = await telegraph_manager.create_text_page(
                    title="نص الفيديو من الرابط",
                    content=transcript,
                    description="النص المستخرج من فيديو الرابط باستخدام Whisper"
                )
                await task_logger.log_success(f"✓ Telegraph page created: {telegraph_url}")
            except Exception as telegraph_err:
                await task_logger.log_warning(f"Telegraph creation failed: {str(telegraph_err)}")
            
            # Step 6: Handle video based on download enabled flag
            await task_logger.log_info("Step 6: Checking if video should be sent...")
            download_enabled = task_config.get("linkVideoDownloadEnabled") or task_config.get("link_video_download_enabled", True)
            await task_logger.log_info(f"Download enabled flag: {download_enabled}")
            
            if download_enabled:
                if video_path and os.path.exists(video_path):
                    result_video_path = video_path
                    await task_logger.log_success(f"✓ Video WILL be sent to target: {video_path}")
                else:
                    await task_logger.log_warning(f"Video path invalid or doesn't exist: {video_path}")
            else:
                await task_logger.log_info("Download disabled - video will NOT be sent, deleting temporary file...")
                if video_path and os.path.exists(video_path):
                    try:
                        os.remove(video_path)
                        await task_logger.log_success(f"✓ Temporary video deleted")
                    except Exception as e:
                        await task_logger.log_warning(f"Failed to delete temp video: {str(e)}")
                result_video_path = None
            
            # Final summary
            await task_logger.log_success(
                f"✓ Link processing completed: "
                f"summary={len(summary)} chars, "
                f"video_sent={result_video_path is not None}, "
                f"telegraph={telegraph_url is not None}"
            )
            await db.update_task_stats(task_id, "video")
            
            return (summary, result_video_path, telegraph_url)
            
        except Exception as e:
            await task_logger.log_error(f"Link processing error: {str(e)}")
            await db.update_task_stats(task_id, "error")
            raise
        finally:
            try:
                # Cleanup: only delete audio file, NOT video (video is handled above)
                if audio_path and os.path.exists(audio_path):
                    os.remove(audio_path)
                    error_logger.log_info(f"Cleaned up audio file: {audio_path}")
            except Exception:
                pass

link_processor = LinkProcessor()
