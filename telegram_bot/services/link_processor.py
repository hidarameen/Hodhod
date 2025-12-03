"""
Link Processing Service
Download videos from social media links and process them
Supports YouTube, Twitter/X, Instagram, TikTok, Facebook, and more via yt-dlp
Enhanced with better format handling, retry mechanisms, and URL extraction
"""
import os
import re
import asyncio
import subprocess
from typing import Dict, Any, Optional, Tuple, List
from utils.error_handler import handle_errors, ErrorLogger, TaskLogger
from utils.database import db
from services.ai_providers import ai_manager
from services.telegraph_service import telegraph_manager

error_logger = ErrorLogger("link_processor")

URL_PATTERNS = [
    r'https?://(?:www\.)?youtube\.com/watch\?v=[\w-]+',
    r'https?://(?:www\.)?youtube\.com/shorts/[\w-]+',
    r'https?://youtu\.be/[\w-]+',
    r'https?://(?:www\.)?twitter\.com/\w+/status/\d+',
    r'https?://(?:www\.)?x\.com/\w+/status/\d+',
    r'https?://(?:www\.)?instagram\.com/(?:p|reel|reels|tv)/[\w-]+',
    r'https?://(?:www\.)?tiktok\.com/@[\w.-]+/video/\d+',
    r'https?://(?:vm\.)?tiktok\.com/[\w-]+',
    r'https?://(?:www\.)?tiktok\.com/t/[\w-]+',
    r'https?://(?:www\.)?facebook\.com/[\w.]+/videos/\d+',
    r'https?://(?:www\.)?facebook\.com/watch/?\?v=\d+',
    r'https?://fb\.watch/[\w-]+',
    r'https?://(?:www\.)?vimeo\.com/\d+',
    r'https?://(?:www\.)?dailymotion\.com/video/[\w-]+',
    r'https?://(?:www\.)?reddit\.com/r/\w+/comments/[\w/]+',
    r'https?://(?:www\.)?linkedin\.com/posts/[\w-]+',
    r'https?://(?:www\.)?twitch\.tv/videos/\d+',
    r'https?://(?:www\.)?streamable\.com/[\w-]+',
    r'https?://(?:www\.)?rumble\.com/[\w-]+\.html',
]

GENERIC_URL_PATTERN = r'https?://[^\s<>"\']+(?:video|watch|clip|reel|shorts?)[\w/\?=&-]*'

MAX_VIDEO_SIZE_MB = 50
DOWNLOAD_TIMEOUT = 180
MAX_RETRIES = 2

class LinkProcessor:
    """Process video links from social media with enhanced error handling"""
    
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
    
    def _get_format_options(self, quality: str) -> List[str]:
        """Get list of format options to try in order of preference
        Prioritizes formats with embedded audio to avoid merge issues"""
        formats = {
            "best": [
                "best[ext=mp4][acodec!=none][vcodec!=none]",
                "bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio",
                "best[ext=mp4]",
                "best",
            ],
            "high": [
                "best[height<=1080][ext=mp4][acodec!=none][vcodec!=none]",
                "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio",
                "best[height<=1080][ext=mp4]",
                "best[height<=1080]",
                "best",
            ],
            "medium": [
                "best[height<=720][ext=mp4][acodec!=none][vcodec!=none]",
                "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio",
                "best[height<=720][ext=mp4]",
                "best[height<=720]",
                "best",
            ],
            "low": [
                "best[height<=480][ext=mp4][acodec!=none][vcodec!=none]",
                "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=480]+bestaudio",
                "best[height<=480][ext=mp4]",
                "best[height<=480]",
                "worst[height>=360]",
            ],
        }
        return formats.get(quality, formats["high"])

    @handle_errors("link_processor", "download_video")
    async def download_video(self, url: str, task_id: int, quality: str = "high") -> Optional[str]:
        """Download video from URL using yt-dlp with specified quality and format fallbacks"""
        task_logger = TaskLogger(task_id)
        
        try:
            await task_logger.log_info(f"🔗 DOWNLOADING VIDEO:")
            await task_logger.log_info(f"   URL: {url}")
            await task_logger.log_info(f"   Quality: {quality}")
            error_logger.log_info(f"[LINK_DOWNLOAD] URL={url}, Quality={quality}")
            
            output_template = os.path.join(
                self.temp_dir,
                f"link_video_{task_id}_{int(asyncio.get_event_loop().time())}"
            )
            output_path = f"{output_template}.mp4"
            
            format_options = self._get_format_options(quality)
            
            last_error = None
            for attempt, format_str in enumerate(format_options):
                await task_logger.log_info(f"   Attempt {attempt + 1}/{len(format_options)}: format={format_str[:50]}...")
                
                cmd = [
                    "yt-dlp",
                    "--no-warnings",
                    "--no-playlist",
                    "--format", format_str,
                    "--merge-output-format", "mp4",
                    "--audio-quality", "0",
                    "--embed-metadata",
                    "--max-filesize", f"{MAX_VIDEO_SIZE_MB}M",
                    "--restrict-filenames",
                    "--socket-timeout", "30",
                    "--retries", "3",
                    "--output", output_path,
                    url
                ]
                
                try:
                    process = await asyncio.create_subprocess_exec(
                        *cmd,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    
                    stdout, stderr = await asyncio.wait_for(
                        process.communicate(),
                        timeout=DOWNLOAD_TIMEOUT
                    )
                    
                    if process.returncode == 0:
                        found_path = self._find_downloaded_file(task_id, output_path)
                        if found_path:
                            size_mb = os.path.getsize(found_path) / (1024 * 1024)
                            await task_logger.log_success(f"✓ Video downloaded: {size_mb:.2f}MB → {found_path}")
                            error_logger.log_info(f"[LINK_DOWNLOAD] SUCCESS - size={size_mb:.2f}MB, format={format_str[:30]}")
                            return found_path
                    
                    stderr_str = stderr.decode() if stderr else ""
                    if "Requested format is not available" in stderr_str:
                        await task_logger.log_warning(f"Format not available, trying next...")
                        last_error = "Format not available"
                        continue
                    elif "Video unavailable" in stderr_str or "Private video" in stderr_str:
                        await task_logger.log_error("❌ Video is private or unavailable")
                        return None
                    else:
                        last_error = stderr_str[:200] if stderr_str else f"Return code {process.returncode}"
                        await task_logger.log_warning(f"Download attempt failed: {last_error[:100]}")
                        continue
                        
                except asyncio.TimeoutError:
                    await task_logger.log_warning(f"Timeout on attempt {attempt + 1}, trying next format...")
                    last_error = "Timeout"
                    continue
            
            await task_logger.log_error(f"❌ All download attempts failed. Last error: {last_error}")
            error_logger.log_info(f"[LINK_DOWNLOAD] FAILED - all formats failed, last_error={last_error}")
            return None
                
        except asyncio.TimeoutError:
            await task_logger.log_error(f"❌ Video download timeout ({DOWNLOAD_TIMEOUT}s)")
            error_logger.log_info(f"[LINK_DOWNLOAD] TIMEOUT - url={url}")
            return None
        except Exception as e:
            await task_logger.log_error(f"❌ Download error: {str(e)}")
            error_logger.log_info(f"[LINK_DOWNLOAD] EXCEPTION - error={str(e)}")
            raise
    
    def _find_downloaded_file(self, task_id: int, expected_path: str) -> Optional[str]:
        """Find downloaded file, checking expected path and alternatives"""
        if os.path.exists(expected_path):
            return expected_path
        
        for ext in ['.mp4', '.mkv', '.webm', '.mov']:
            alt_path = expected_path.rsplit('.', 1)[0] + ext
            if os.path.exists(alt_path):
                return alt_path
        
        for f in os.listdir(self.temp_dir):
            if f.startswith(f"link_video_{task_id}_"):
                found_path = os.path.join(self.temp_dir, f)
                if os.path.exists(found_path) and os.path.getsize(found_path) > 1000:
                    return found_path
        
        return None
    
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
    
    @handle_errors("link_processor", "generate_thumbnail")
    async def generate_thumbnail(self, video_path: str) -> Optional[str]:
        """Generate thumbnail from video at 1 second mark"""
        try:
            import ffmpeg
            
            thumb_path = video_path.rsplit(".", 1)[0] + "_thumb.jpg"
            
            stream = ffmpeg.input(video_path, ss=1)
            stream = ffmpeg.output(stream, thumb_path, vframes=1, vf='scale=320:-1', format='image2', vcodec='mjpeg')
            ffmpeg.run(stream, overwrite_output=True, quiet=True, capture_stdout=True, capture_stderr=True)
            
            if os.path.exists(thumb_path) and os.path.getsize(thumb_path) > 100:
                error_logger.log_info(f"Thumbnail generated: {thumb_path}")
                return thumb_path
            return None
            
        except Exception as e:
            error_logger.log_info(f"Thumbnail generation error: {str(e)}")
            return None
    
    def get_video_metadata(self, video_path: str) -> Dict[str, Any]:
        """Get video duration, width, height using ffprobe"""
        try:
            import ffmpeg
            
            probe = ffmpeg.probe(video_path)
            video_stream = next(
                (stream for stream in probe['streams'] if stream['codec_type'] == 'video'),
                None
            )
            
            if video_stream:
                duration = int(float(probe.get('format', {}).get('duration', 0)))
                width = int(video_stream.get('width', 0))
                height = int(video_stream.get('height', 0))
                
                error_logger.log_info(f"Video metadata: duration={duration}s, {width}x{height}")
                return {
                    'duration': duration,
                    'width': width,
                    'height': height
                }
        except Exception as e:
            error_logger.log_info(f"Failed to get video metadata: {str(e)}")
        
        return {'duration': 0, 'width': 0, 'height': 0}
    
    def ensure_mp4_extension(self, video_path: str) -> str:
        """Ensure video file has .mp4 extension, rename if needed"""
        if not video_path:
            return video_path
            
        if video_path.lower().endswith('.mp4'):
            return video_path
        
        new_path = video_path.rsplit('.', 1)[0] + '.mp4'
        try:
            if os.path.exists(video_path):
                os.rename(video_path, new_path)
                error_logger.log_info(f"Renamed video to mp4: {new_path}")
                return new_path
        except Exception as e:
            error_logger.log_info(f"Failed to rename video: {str(e)}")
        
        return video_path
    
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
            
            # Get video rules specifically (not text summarization rules)
            rules = await db.get_task_rules(task_id)
            video_rule = next((r for r in rules if r["type"] == "video" and r["is_active"]), None)
            await task_logger.log_info(f"Found video rules: {len([r for r in rules if r['type'] == 'video'])}, active: {video_rule is not None}")
            
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
            
            custom_rule = video_rule["prompt"] if video_rule else None
            if video_rule:
                await task_logger.log_info(f"Using video rule: {video_rule.get('name', 'unnamed')}")
            
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
