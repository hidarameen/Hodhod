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
from services.ai_pipeline import ai_pipeline
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
    r'https?://(?:www\.)?facebook\.com/share/v/[\w-]+',
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
DOWNLOAD_TIMEOUT = 90
MAX_RETRIES = 2

def _get_cookies_path(platform: Optional[str] = None) -> Optional[str]:
    """Get path to cookies file from environment variable.
    Supports YOUTUBE_COOKIES, INSTAGRAM_COOKIES, FACEBOOK_COOKIES, TIKTOK_COOKIES.
    Returns path to the specific cookies file or None."""
    
    # Map platforms to env vars
    env_vars = {
        'youtube': 'YOUTUBE_COOKIES',
        'instagram': 'INSTAGRAM_COOKIES',
        'facebook': 'FACEBOOK_COOKIES',
        'tiktok': 'TIKTOK_COOKIES'
    }
    
    # Try platform-specific cookies first
    env_var = None
    if platform:
        p_lower = platform.lower()
        if 'youtube' in p_lower: env_var = env_vars['youtube']
        elif 'instagram' in p_lower: env_var = env_vars['instagram']
        elif 'facebook' in p_lower: env_var = env_vars['facebook']
        elif 'tiktok' in p_lower: env_var = env_vars['tiktok']
    
    # If no specific platform or specific env var is empty, try YouTube as fallback for generic links
    cookies_content = ""
    target_path = "/tmp/cookies.txt"
    
    if env_var:
        cookies_content = os.environ.get(env_var, '')
        target_path = f"/tmp/{env_var.lower()}.txt"
    
    if not cookies_content:
        cookies_content = os.environ.get('YOUTUBE_COOKIES', '')
        target_path = "/tmp/youtube_cookies.txt"
        
    if not cookies_content:
        return None
    
    try:
        with open(target_path, 'w') as f:
            f.write(cookies_content)
        return target_path
    except Exception as e:
        error_logger.log_info(f"Failed to write cookies file: {str(e)}")
        return None

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
        CRITICAL: EXPLICITLY EXCLUDE audio-only formats
        Always download video+audio together"""
        formats = {
            "best": [
                # MUST have video stream (exclude audio-only with -vn negation)
                "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
                "bestvideo+bestaudio",
                "best",
            ],
            "high": [
                # 1080p max, must have video (no audio-only)
                "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best",
                "bestvideo[height<=1080]+bestaudio/bestvideo+bestaudio/best",
                "best[height<=1080]/best",
            ],
            "medium": [
                # 720p max, must have video (no audio-only)
                "bestvideo[height<=720]+bestaudio/best[height<=720]/best",
                "bestvideo[height<=720]+bestaudio/best",
                "best[height<=720]/best",
            ],
            "low": [
                # 480p max, must have video (no audio-only)
                "bestvideo[height<=480]+bestaudio/best[height<=480]/best",
                "bestvideo[height<=480]+bestaudio/best",
                "best[height<=480]/best",
            ],
        }
        return formats.get(quality, formats["high"])
    
    async def _verify_video_has_content(self, video_path: str) -> Dict[str, bool]:
        """Verify that video file contains both video and audio streams"""
        try:
            import ffmpeg
            probe = ffmpeg.probe(video_path)
            streams = probe.get('streams', [])
            
            has_video = any(s.get('codec_type') == 'video' for s in streams)
            has_audio = any(s.get('codec_type') == 'audio' for s in streams)
            
            error_logger.log_info(f"Video verification: has_video={has_video}, has_audio={has_audio}")
            return {'has_video': has_video, 'has_audio': has_audio}
        except Exception as e:
            error_logger.log_warning(f"Failed to verify video content: {str(e)}")
            return {'has_video': False, 'has_audio': False}

    @handle_errors("link_processor", "merge_video_audio")
    async def merge_video_audio(self, video_path: str, audio_path: str, output_path: str) -> bool:
        """Merge separate video and audio files into a single MP4 file"""
        try:
            import subprocess
            cmd = [
                "ffmpeg", "-y",
                "-i", video_path,
                "-i", audio_path,
                "-c:v", "copy",
                "-c:a", "aac",
                "-strict", "experimental",
                output_path
            ]
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            if process.returncode == 0 and os.path.exists(output_path):
                error_logger.log_info(f"Successfully merged video and audio: {output_path}")
                return True
            else:
                stderr_str = stderr.decode('utf-8', errors='ignore')
                error_logger.log_warning(f"Merge failed: {stderr_str}")
                return False
        except Exception as e:
            error_logger.log_error(f"Merge error: {str(e)}", error=e)
            return False

    async def get_video_info(self, url: str) -> Dict[str, Any]:
        """Get comprehensive video info using yt-dlp --dump-json
        Extracts: title, description, uploader, channel, platform, duration, thumbnail"""
        try:
            import json
            
            # Determine platform for cookies
            platform_hint = None
            if 'youtube' in url.lower(): platform_hint = 'youtube'
            elif 'instagram' in url.lower(): platform_hint = 'instagram'
            elif 'facebook' in url.lower() or 'fb.watch' in url.lower(): platform_hint = 'facebook'
            elif 'tiktok' in url.lower(): platform_hint = 'tiktok'
            
            cmd = [
                "yt-dlp",
                "--no-warnings",
                "--no-playlist",
                "--dump-json",
                "--socket-timeout", "15",
            ]
            
            cookies_path = _get_cookies_path(platform_hint)
            if cookies_path:
                cmd.extend(["--cookies", cookies_path])
            
            # Use general user agent to avoid some blocks
            cmd.extend(["--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"])
            
            cmd.append(url)
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=45
            )
            
            if process.returncode == 0 and stdout:
                info = json.loads(stdout.decode('utf-8', errors='ignore'))
                
                title = info.get('title', '') or ''
                description = info.get('description', '') or ''
                if len(description) > 1000:
                    description = description[:1000] + "..."
                
                uploader = info.get('uploader', '') or info.get('creator', '') or info.get('channel', '') or ''
                channel = info.get('channel', '') or info.get('uploader', '') or ''
                uploader_id = info.get('uploader_id', '') or info.get('channel_id', '') or ''
                
                platform = info.get('extractor_key', '') or info.get('extractor', '') or ''
                if not platform:
                    if 'youtube' in url.lower():
                        platform = 'YouTube'
                    elif 'facebook' in url.lower() or 'fb.watch' in url.lower():
                        platform = 'Facebook'
                    elif 'instagram' in url.lower():
                        platform = 'Instagram'
                    elif 'twitter' in url.lower() or 'x.com' in url.lower():
                        platform = 'Twitter/X'
                    elif 'tiktok' in url.lower():
                        platform = 'TikTok'
                
                thumbnail_url = info.get('thumbnail', '') or ''
                duration = int(info.get('duration', 0) or 0)
                
                upload_date = info.get('upload_date', '') or ''
                view_count = info.get('view_count', 0) or 0
                like_count = info.get('like_count', 0) or 0
                
                result = {
                    'title': title,
                    'description': description,
                    'uploader': uploader,
                    'channel': channel,
                    'uploader_id': uploader_id,
                    'platform': platform,
                    'thumbnail_url': thumbnail_url,
                    'duration': duration,
                    'upload_date': upload_date,
                    'view_count': view_count,
                    'like_count': like_count,
                    'original_url': url
                }
                
                error_logger.log_info(f"[VIDEO_INFO] title={title[:50]}, uploader={uploader}, platform={platform}, duration={duration}s")
                
                return result
                
        except Exception as e:
            error_logger.log_info(f"[VIDEO_INFO] Failed to get info: {str(e)}")
        
        return {
            'title': '', 'description': '', 'uploader': '', 'channel': '',
            'uploader_id': '', 'platform': '', 'thumbnail_url': '', 'duration': 0,
            'upload_date': '', 'view_count': 0, 'like_count': 0, 'original_url': url
        }

    @handle_errors("link_processor", "download_video")
    async def download_video(self, url: str, task_id: int, quality: str = "high") -> Optional[str]:
        """Download video from URL using yt-dlp with specified quality and format fallbacks.
        Automatically handles separate audio/video streams by downloading and merging them."""
        task_logger = TaskLogger(task_id)
        
        try:
            # Determine platform for cookies
            platform_hint = None
            if 'youtube' in url.lower(): platform_hint = 'youtube'
            elif 'instagram' in url.lower(): platform_hint = 'instagram'
            elif 'facebook' in url.lower() or 'fb.watch' in url.lower(): platform_hint = 'facebook'
            elif 'tiktok' in url.lower(): platform_hint = 'tiktok'
            
            await task_logger.log_info(f"🔗 DOWNLOADING VIDEO:")
            await task_logger.log_info(f"   URL: {url}")
            await task_logger.log_info(f"   Quality: {quality}")
            await task_logger.log_info(f"   Platform: {platform_hint or 'Generic'}")
            
            output_template = os.path.join(
                self.temp_dir,
                f"link_video_{task_id}_{int(asyncio.get_event_loop().time())}"
            )
            output_path = f"{output_template}.mp4"
            
            format_options = self._get_format_options(quality)
            format_options.append("best")
            cookies_path = _get_cookies_path(platform_hint)
            
            last_error = None
            for attempt, format_str in enumerate(format_options):
                await task_logger.log_info(f"   Attempt {attempt + 1}/{len(format_options)}: format={format_str[:50]}...")
                
                cmd = [
                    "yt-dlp", "--no-warnings", "--no-playlist",
                    "--format", format_str,
                    "--merge-output-format", "mp4",
                    "--output", output_path,
                    "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
                ]
                if cookies_path: cmd.extend(["--cookies", cookies_path])
                cmd.append(url)
                
                try:
                    process = await asyncio.create_subprocess_exec(*cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
                    await asyncio.wait_for(process.communicate(), timeout=DOWNLOAD_TIMEOUT)
                    
                    if process.returncode == 0:
                        found_path = self._find_downloaded_file(task_id, output_path)
                        if found_path:
                            verification = await self._verify_video_has_content(found_path)
                            if verification.get('has_video') and verification.get('has_audio'):
                                await task_logger.log_success(f"✓ Video downloaded successfully (video+audio)")
                                return found_path
                            elif verification.get('has_video') and not verification.get('has_audio'):
                                await task_logger.log_warning("Video downloaded but has NO audio. Attempting separate audio download...")
                                # Keep the video path
                                video_only_path = found_path
                                # Try downloading audio only
                                audio_only_path = f"{output_template}_audio.m4a"
                                audio_cmd = [
                                    "yt-dlp", "--no-warnings", "--no-playlist",
                                    "--format", "bestaudio",
                                    "--output", audio_only_path,
                                    url
                                ]
                                if cookies_path: 
                                    audio_cmd.insert(-1, "--cookies")
                                    audio_cmd.insert(-1, cookies_path)
                                
                                audio_proc = await asyncio.create_subprocess_exec(*audio_cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
                                await asyncio.wait_for(audio_proc.communicate(), timeout=60)
                                
                                if audio_proc.returncode == 0 and os.path.exists(audio_only_path):
                                    merged_path = f"{output_template}_merged.mp4"
                                    if await self.merge_video_audio(video_only_path, audio_only_path, merged_path):
                                        await task_logger.log_success("✓ Merged video and audio successfully")
                                        try: 
                                            os.remove(video_only_path)
                                            os.remove(audio_only_path)
                                        except: pass
                                        return merged_path
                except Exception as e:
                    last_error = str(e)
                    continue
            
            await task_logger.log_error(f"❌ All download attempts failed. Last error: {last_error}")
            return None
                
        except Exception as e:
            await task_logger.log_error(f"❌ Download error: {str(e)}")
            raise
    
    def _find_downloaded_file(self, task_id: int, expected_path: str) -> Optional[str]:
        """Find downloaded file, prioritizing video files over audio-only"""
        if os.path.exists(expected_path):
            return expected_path
        
        # Try expected extensions in order
        for ext in ['.mp4', '.mkv', '.webm', '.mov']:
            alt_path = expected_path.rsplit('.', 1)[0] + ext
            if os.path.exists(alt_path):
                return alt_path
        
        # Find by pattern, but prioritize video files over audio-only
        video_files = []
        audio_only_files = []
        
        for f in os.listdir(self.temp_dir):
            if f.startswith(f"link_video_{task_id}_"):
                found_path = os.path.join(self.temp_dir, f)
                if os.path.exists(found_path) and os.path.getsize(found_path) > 1000:
                    # Prioritize video files (mp4, mkv, webm, mov) over audio-only (m4a, mp3, aac)
                    if f.lower().endswith(('.mp4', '.mkv', '.webm', '.mov')):
                        video_files.append(found_path)
                    elif not f.lower().endswith(('.m4a', '.mp3', '.aac', '.wav')):
                        video_files.append(found_path)  # Unknown format, treat as video
                    else:
                        audio_only_files.append(found_path)
        
        # Return video file if available, otherwise audio-only
        if video_files:
            return video_files[0]
        elif audio_only_files:
            # If only audio-only file found, we'll handle it by downloading again with better format
            error_logger.log_warning(f"Only audio-only file found for task {task_id}, will retry with different format")
            return None
        
        return None
    
    @handle_errors("link_processor", "extract_audio")
    async def extract_audio(self, video_path: str) -> Optional[str]:
        """Extract audio from video file. If file is audio-only, convert directly to MP3"""
        try:
            import subprocess
            
            audio_path = video_path.rsplit(".", 1)[0] + ".mp3"
            
            # First, check if the file is audio-only or video with audio
            verification = await self._verify_video_has_content(video_path)
            is_audio_only = not verification.get('has_video')
            
            if is_audio_only:
                # File is audio-only, just convert to MP3 without -vn flag
                error_logger.log_info(f"File is audio-only, converting directly to MP3: {video_path}")
                cmd = [
                    "ffmpeg", "-y", "-i", video_path,
                    "-acodec", "libmp3lame", "-ar", "16000", "-ac", "1",
                    audio_path
                ]
            else:
                # File has video, extract audio only with -vn flag
                cmd = [
                    "ffmpeg", "-y", "-i", video_path,
                    "-vn", "-acodec", "libmp3lame", "-ar", "16000", "-ac", "1",
                    audio_path
                ]
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if os.path.exists(audio_path) and os.path.getsize(audio_path) > 1000:
                error_logger.log_info(f"Audio extracted/converted: {audio_path} (audio_only={is_audio_only})")
                return audio_path
            
            stderr_str = stderr.decode('utf-8', errors='ignore') if stderr else ""
            error_logger.log_warning(f"FFmpeg extraction failed: {stderr_str}")
            return None
            
        except Exception as e:
            error_logger.log_warning(f"Audio extraction error: {str(e)}")
            return None
    
    @handle_errors("link_processor", "generate_thumbnail")
    async def generate_thumbnail(self, video_path: str) -> Optional[str]:
        """Generate thumbnail from video - tries multiple positions for best result"""
        try:
            import ffmpeg
            
            thumb_path = video_path.rsplit(".", 1)[0] + "_thumb.jpg"
            
            for ss_time in [2, 5, 10, 1]:
                try:
                    stream = ffmpeg.input(video_path, ss=ss_time)
                    stream = ffmpeg.output(stream, thumb_path, vframes=1, vf='scale=320:-2', format='image2', vcodec='mjpeg')
                    ffmpeg.run(stream, overwrite_output=True, quiet=True, capture_stdout=True, capture_stderr=True)
                    
                    if os.path.exists(thumb_path) and os.path.getsize(thumb_path) > 500:
                        error_logger.log_info(f"Thumbnail generated at {ss_time}s: {thumb_path}")
                        return thumb_path
                except:
                    continue
            
            error_logger.log_warning("Could not generate thumbnail from video")
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
    
    def _cleanup_temp_files(self, file_paths: list):
        """Safely cleanup temporary files"""
        for file_path in file_paths:
            if file_path and os.path.exists(file_path):
                try:
                    os.remove(file_path)
                    error_logger.log_info(f"Cleaned up temp file: {file_path}")
                except Exception as e:
                    error_logger.log_warning(f"Failed to cleanup {file_path}: {str(e)}")
    
    @handle_errors("link_processor", "process_link")
    async def process_link(
        self,
        url: str,
        task_id: int,
        task_config: Dict[str, Any]
    ) -> Optional[Tuple[str, Optional[str], Optional[str], Optional[Dict[str, Any]]]]:
        """
        Full link processing pipeline:
        1. Get video info (title, description)
        2. Download video from URL
        3. Extract audio
        4. Transcribe with Whisper
        5. Summarize with AI
        6. Create Telegraph page with transcript
        7. Return video only if download is enabled
        
        Returns tuple of (summary, video_path, telegraph_url, video_info)
        - video_path is returned ONLY if linkVideoDownloadEnabled is True
        - video_path is NOT returned if download is disabled (file is deleted)
        - video_info contains title, description, duration
        """
        task_logger = TaskLogger(task_id)
        video_path = None
        audio_path = None
        downloaded_video_path = None
        result_video_path = None
        thumb_path = None
        video_info = {'title': '', 'description': '', 'duration': 0}
        
        try:
            await task_logger.log_info(f"Processing link: {url[:50]}...")
            
            # Step 0: Get video info (title, description)
            await task_logger.log_info("Step 0: Getting video info...")
            video_info = await self.get_video_info(url)
            if video_info.get('title'):
                await task_logger.log_success(f"✓ Video title: {video_info['title'][:50]}...")
            
            # Step 1: Download video
            quality = task_config.get("linkVideoQuality", "high")
            await task_logger.log_info(f"Step 1: Downloading video (quality: {quality})...")
            downloaded_video_path = await self.download_video(url, task_id, quality)
            
            if not downloaded_video_path:
                error_msg = f"❌ فشل في تحميل الفيديو من الرابط. قد يكون الفيديو محذوفاً أو محمياً أو غير متاح في منطقتك. الرابط: {url}"
                await task_logger.log_error(error_msg)
                error_logger.log_info(f"[LINK_PROCESS] Video download failed for URL: {url}")
                # Return error message instead of None for proper handling upstream
                return (error_msg, None, None, video_info)
            
            await task_logger.log_success(f"✓ Video downloaded: {downloaded_video_path}")
            video_path = downloaded_video_path
            
            # ✅ VERIFY video has BOTH video and audio streams
            await task_logger.log_info("Verifying video contains video + audio...")
            verification = await self._verify_video_has_content(video_path)
            
            if not verification.get('has_video'):
                error_msg = f"❌ Downloaded file has no video stream (audio-only). Trying alternative format..."
                await task_logger.log_warning(error_msg)
                # If audio-only, we'll retry with different format in next attempt
                return None
            
            if not verification.get('has_audio'):
                await task_logger.log_warning("⚠️ Video has no audio stream, will extract/add later")
            else:
                await task_logger.log_success("✅ Video verified: has both video and audio")
            
            # Track video for potential cleanup
            if video_path is None:
                await task_logger.log_error("Failed to set video path")
                return None
            
            # Step 2: Extract audio from video
            await task_logger.log_info("Step 2: Extracting audio from video...")
            audio_path = await self.extract_audio(video_path)
            
            if not audio_path:
                error_msg = "❌ فشل في استخراج الصوت من الفيديو"
                await task_logger.log_error(error_msg)
                error_logger.log_info("[LINK_PROCESS] Audio extraction failed")
                return (error_msg, None, None, video_info)
            
            await task_logger.log_success(f"✓ Audio extracted: {audio_path}")
            
            # Step 3: Transcribe with Whisper
            await task_logger.log_info("Step 3: Transcribing audio with Whisper...")
            transcript = await ai_manager.transcribe_audio(audio_path)
            
            if not transcript:
                error_msg = "❌ فشل في تحويل الصوت إلى نص (Whisper). الملف قد يكون طويلاً جداً أو معطوباً"
                await task_logger.log_error(error_msg)
                error_logger.log_info("[LINK_PROCESS] Transcription failed")
                return (error_msg, None, None, video_info)
            
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
            
            await task_logger.log_info(f"Processing transcript with AI Pipeline ({provider_name}/{model_name})...")
            # Apply BOTH video rules AND summarize rules
            video_rules = [r for r in rules if r["type"] == "video" and r["is_active"]]
            summarize_rules = [r for r in rules if r["type"] == "summarize" and r["is_active"]]
            all_applicable_rules = video_rules + summarize_rules
            
            # Prepare video source info for pipeline
            video_source_info = {
                'uploader': video_info.get('uploader', ''),
                'channel': video_info.get('channel', '') or video_info.get('uploader', ''),
                'platform': video_info.get('platform', ''),
                'title': video_info.get('title', '')
            }
            await task_logger.log_info(f"Using video source info: uploader={video_source_info['uploader']}, platform={video_source_info['platform']}")
            
            pipeline_result = await ai_pipeline.process(
                text=transcript,
                task_id=task_id,
                provider=provider_name,
                model=model_name,
                system_prompt=custom_rule,
                custom_rules=all_applicable_rules,
                video_source_info=video_source_info
            )
            summary = pipeline_result.final_text
            await task_logger.log_info(f"Pipeline processing complete: {len(summary)} chars (quality: {pipeline_result.quality_score:.2f})")
            
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
            download_enabled = task_config.get("link_video_download_enabled", True)
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
                f"telegraph={telegraph_url is not None}, "
                f"title={video_info.get('title', '')[:30]}"
            )
            await db.update_task_stats(task_id, "video")
            
            # ✅ ADD TRANSCRIPT TO VIDEO_INFO for field extraction
            video_info['transcript'] = transcript
            
            return (summary, result_video_path, telegraph_url, video_info)
            
        except Exception as e:
            await task_logger.log_error(f"Link processing error: {str(e)}")
            await db.update_task_stats(task_id, "error")
            raise
        finally:
            # Comprehensive cleanup of all temporary files
            # Don't delete result_video_path if it will be sent to user
            files_to_cleanup = []
            
            # Always cleanup audio (transcription done)
            if audio_path and os.path.exists(audio_path):
                files_to_cleanup.append(audio_path)
            
            # Cleanup thumbnail
            if thumb_path and os.path.exists(thumb_path):
                files_to_cleanup.append(thumb_path)
            
            # Cleanup video only if it's NOT going to be sent (result_video_path is None or different)
            if video_path and os.path.exists(video_path) and video_path != result_video_path:
                files_to_cleanup.append(video_path)
            
            if files_to_cleanup:
                self._cleanup_temp_files(files_to_cleanup)

link_processor = LinkProcessor()
