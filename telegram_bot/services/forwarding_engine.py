"""
Forwarding Engine
Core engine for message forwarding with AI processing support
Handles multiple sources and targets with parallel processing
Supports all media types including media groups, entities, and formatting
Full detailed logging for every operation
"""
import asyncio
import os
import traceback
from datetime import datetime
from typing import List, Dict, Any, Optional
from pyrogram.client import Client
from pyrogram.types import Message, MessageEntity, InputMediaPhoto, InputMediaVideo, InputMediaDocument, InputMediaAudio
from pyrogram.enums import MessageEntityType, MessageMediaType
from pyrogram.errors import FloodWait, RPCError, ChannelPrivate, ChatWriteForbidden
import re
from utils.error_handler import handle_errors, ErrorLogger, TaskLogger
from utils.database import db
from services.ai_providers import ai_manager
from services.queue_system import queue_manager
from services.telegraph_service import telegraph_manager
from services.link_processor import link_processor
from services.video_processor import video_processor
from services.ai_pipeline import ai_pipeline

error_logger = ErrorLogger("forwarding_engine")

def log_detailed(level: str, component: str, function: str, message: str, data: Optional[Dict[str, Any]] = None):
    """Log with full details"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    log_msg = f"[{timestamp}] [{level.upper()}] [{component}::{function}] {message}"
    if data:
        log_msg += f" | Data: {data}"
    print(log_msg)
    if level == "error":
        error_logger.log_warning(log_msg)
    else:
        error_logger.log_info(log_msg)

class ForwardingEngine:
    """Main forwarding engine"""
    
    def __init__(self, client: Client):
        self.client = client
        self.active_tasks: Dict[int, bool] = {}
        self.message_cache: Dict[str, Any] = {}
        self.media_group_cache: Dict[str, List[Message]] = {}
        self.media_group_lock = asyncio.Lock()
        self.media_group_tasks: Dict[str, asyncio.Task] = {}  # Track processing tasks
        self.media_group_config: Dict[str, Dict[str, Any]] = {}  # Store task config for each group
        log_detailed("info", "forwarding_engine", "__init__", "Forwarding engine initialized")
    
    @handle_errors("forwarding_engine", "forward_message")
    async def forward_message(
        self,
        message: Message,
        task_id: int,
        task_config: Dict[str, Any]
    ):
        """
        Forward message from source to targets
        Supports all media types including media groups with entities preservation
        """
        task_logger = TaskLogger(task_id)
        
        log_detailed("info", "forwarding_engine", "forward_message", "Starting message forward", {
            "task_id": task_id,
            "task_name": task_config.get('name'),
            "message_id": message.id,
            "chat_id": message.chat.id,
            "chat_title": message.chat.title,
            "has_text": bool(message.text),
            "has_caption": bool(message.caption),
            "has_media": bool(message.media),
            "media_type": str(message.media) if message.media else None,
            "media_group_id": message.media_group_id
        })
        
        try:
            # Get target channels
            target_channels = task_config.get("target_channels", [])
            
            log_detailed("info", "forwarding_engine", "forward_message", "Target channels", {
                "target_ids": target_channels,
                "count": len(target_channels)
            })
            
            if not target_channels:
                log_detailed("warning", "forwarding_engine", "forward_message", "No target channels configured")
                await task_logger.log_warning("No target channels configured")
                return
            
            # Check if this is part of a media group
            if message.media_group_id:
                log_detailed("info", "forwarding_engine", "forward_message", "Message is part of media group", {
                    "media_group_id": message.media_group_id
                })
                await self._handle_media_group(message, task_id, task_config, task_logger)
                return
            
            # Check if AI processing is enabled
            ai_enabled = task_config.get("ai_enabled", False)
            video_processing = task_config.get("video_processing_enabled", False)
            summarization_enabled = task_config.get("summarization_enabled", False)
            link_processing = task_config.get("link_processing_enabled", False)
            
            log_detailed("info", "forwarding_engine", "forward_message", "Processing options", {
                "ai_enabled": ai_enabled,
                "video_processing": video_processing,
                "summarization_enabled": summarization_enabled,
                "link_processing": link_processing
            })
            
            # Check for link processing (message contains only a URL)
            message_text = message.text or ""
            link_processed = False
            if link_processing and message_text and link_processor.is_video_link(message_text):
                log_detailed("info", "forwarding_engine", "forward_message", "Processing video link...")
                url = link_processor.extract_url(message_text)
                log_detailed("info", "forwarding_engine", "forward_message", f"Extracted URL: {url}")
                if url:
                    try:
                        link_result = await link_processor.process_link(url, task_id, task_config)
                        if link_result:
                            summary, video_path, telegraph_url = link_result
                            log_detailed("info", "forwarding_engine", "forward_message", f"Link processed: summary={len(summary)} chars, has_video={video_path is not None}, telegraph={telegraph_url}")
                            
                            # Send to all target channels
                            for target_id in target_channels:
                                target_channel = await db.get_channel(target_id)
                                if target_channel:
                                    try:
                                        target_identifier = int(target_channel["identifier"])
                                    except (ValueError, TypeError):
                                        target_identifier = target_channel["identifier"]
                                    
                                    # Create caption with summary and Telegraph link
                                    caption = f"🔗 **ملخص الفيديو من الرابط:**\n\n{summary}"
                                    
                                    if telegraph_url:
                                        caption += f"\n\n📄 [اقرأ النص الأصلي الكامل]({telegraph_url})"
                                    
                                    # Check if video should be sent
                                    if video_path:
                                        log_detailed("info", "forwarding_engine", "forward_message", f"Video from link: path={video_path[:50]}..., exists={os.path.exists(video_path)}")
                                        
                                        if os.path.exists(video_path):
                                            try:
                                                # Ensure mp4 extension
                                                video_path = link_processor.ensure_mp4_extension(video_path)
                                                
                                                # Get video metadata (duration, width, height)
                                                metadata = link_processor.get_video_metadata(video_path)
                                                duration = metadata.get('duration', 0)
                                                width = metadata.get('width', 0)
                                                height = metadata.get('height', 0)
                                                
                                                # Generate thumbnail
                                                thumb_path = await link_processor.generate_thumbnail(video_path)
                                                
                                                log_detailed("info", "forwarding_engine", "forward_message", f"Video metadata: duration={duration}s, {width}x{height}, thumb={thumb_path is not None}")
                                                
                                                # Truncate caption if too long (Telegram max is 1024)
                                                send_caption = caption
                                                if len(send_caption) > 1024:
                                                    send_caption = send_caption[:1020] + "..."
                                                
                                                log_detailed("info", "forwarding_engine", "forward_message", f"Sending video from link to {target_id} with caption ({len(send_caption)} chars)...")
                                                
                                                # Get filename from path
                                                file_name = os.path.basename(video_path)
                                                if not file_name.lower().endswith('.mp4'):
                                                    file_name = file_name.rsplit('.', 1)[0] + '.mp4'
                                                
                                                await self.client.send_video(
                                                    chat_id=target_identifier,
                                                    video=video_path,
                                                    caption=send_caption,
                                                    duration=duration,
                                                    width=width,
                                                    height=height,
                                                    thumb=thumb_path,
                                                    file_name=file_name,
                                                    supports_streaming=True
                                                )
                                                
                                                log_detailed("info", "forwarding_engine", "forward_message", f"✓ Video sent successfully to {target_id}")
                                                
                                                # Try to cleanup after sending
                                                try:
                                                    if os.path.exists(video_path):
                                                        os.remove(video_path)
                                                        log_detailed("info", "forwarding_engine", "forward_message", f"Cleaned up video file after sending")
                                                    if thumb_path and os.path.exists(thumb_path):
                                                        os.remove(thumb_path)
                                                        log_detailed("info", "forwarding_engine", "forward_message", f"Cleaned up thumbnail after sending")
                                                except Exception as cleanup_err:
                                                    log_detailed("warning", "forwarding_engine", "forward_message", f"Failed to cleanup video: {str(cleanup_err)}")
                                                
                                            except Exception as send_err:
                                                log_detailed("error", "forwarding_engine", "forward_message", f"Failed to send video: {str(send_err)}, sending summary as text instead")
                                                await self.client.send_message(
                                                    chat_id=target_identifier,
                                                    text=caption
                                                )
                                        else:
                                            log_detailed("error", "forwarding_engine", "forward_message", f"Video file not found (already deleted?): {video_path}")
                                            await self.client.send_message(
                                                chat_id=target_identifier,
                                                text=caption
                                            )
                                    else:
                                        # No video to send, send summary as text only
                                        log_detailed("info", "forwarding_engine", "forward_message", f"No video from link, sending summary as text only")
                                        await self.client.send_message(
                                            chat_id=target_identifier,
                                            text=caption
                                        )
                            
                            await db.increment_task_counter(task_id)
                            await db.update_task_stats(task_id, "forwarded")
                            await task_logger.log_success(f"Link processed and forwarded to {len(target_channels)} targets")
                            link_processed = True
                    except Exception as e:
                        log_detailed("error", "forwarding_engine", "forward_message", f"Link processing error: {str(e)}")
                        await task_logger.log_warning(f"Link processing failed, forwarding original: {str(e)}")
            
            # If link was processed successfully, return
            if link_processed:
                return
            
            # Check for video processing (message contains a video)
            video_processed = False
            video_summary = None
            telegraph_url = None
            if video_processing and message.video:
                log_detailed("info", "forwarding_engine", "forward_message", "Processing video message...")
                try:
                    video_result = await video_processor.process_video(
                        client=self.client,
                        message_id=message.id,
                        chat_id=message.chat.id,
                        task_id=task_id,
                        task_config=task_config
                    )
                    if video_result:
                        summary, transcript, telegraph_url = video_result
                        log_detailed("info", "forwarding_engine", "forward_message", f"Video processed successfully: summary={len(summary)} chars, telegraph={telegraph_url}")
                        video_summary = summary
                        video_processed = True
                except Exception as e:
                    log_detailed("error", "forwarding_engine", "forward_message", f"Video processing error: {str(e)}")
                    await task_logger.log_warning(f"Video processing failed, forwarding original with summary: {str(e)}")
                    video_summary = None
                    telegraph_url = None
            
            # If video was processed, forward the original video with summary as caption
            if video_processed and video_summary:
                log_detailed("info", "forwarding_engine", "forward_message", "Forwarding video with summary caption...")
                for target_id in target_channels:
                    target_channel = await db.get_channel(target_id)
                    if target_channel:
                        try:
                            target_identifier = int(target_channel["identifier"])
                        except (ValueError, TypeError):
                            target_identifier = target_channel["identifier"]
                        
                        # Create caption with summary and Telegraph link
                        caption = f"📹 **ملخص الفيديو:**\n\n{video_summary}"
                        
                        if telegraph_url:
                            caption += f"\n\n📄 [اقرأ النص الأصلي الكامل]({telegraph_url})"
                        
                        # Truncate caption if too long (Telegram limit is 1024 chars for caption)
                        if len(caption) > 1024:
                            caption = caption[:1020] + "..."
                        
                        try:
                            # Forward the original video with the summary caption
                            await self.client.copy_message(
                                chat_id=target_identifier,
                                from_chat_id=message.chat.id,
                                message_id=message.id,
                                caption=caption
                            )
                            log_detailed("info", "forwarding_engine", "forward_message", f"Video forwarded to target {target_id} with summary and Telegraph link")
                        except Exception as copy_err:
                            # Fallback: send just the summary text
                            log_detailed("warning", "forwarding_engine", "forward_message", f"Failed to copy video: {str(copy_err)}, sending summary as text")
                            await self.client.send_message(
                                chat_id=target_identifier,
                                text=caption
                            )
                
                await db.increment_task_counter(task_id)
                await db.update_task_stats(task_id, "forwarded")
                await task_logger.log_success(f"Video with summary forwarded to {len(target_channels)} targets")
                return
            
            # Generate cache key
            cache_key = f"{message.chat.id}_{message.id}"
            
            # Process message with AI/summarization (only once)
            processed_text = None
            if ai_enabled or summarization_enabled:
                if cache_key not in self.message_cache:
                    log_detailed("info", "forwarding_engine", "forward_message", "Processing message with AI...")
                    processed_text = await self._process_message(
                        message,
                        task_id,
                        task_config,
                        task_logger
                    )
                    self.message_cache[cache_key] = processed_text
                else:
                    processed_text = self.message_cache[cache_key]
                    log_detailed("info", "forwarding_engine", "forward_message", "Using cached processed text")
            
            # Forward to all targets in parallel
            log_detailed("info", "forwarding_engine", "forward_message", f"Forwarding to {len(target_channels)} targets in parallel...")
            
            forward_tasks = []
            for target_id in target_channels:
                task = asyncio.create_task(
                    self._forward_to_target(
                        message,
                        target_id,
                        processed_text,
                        task_logger
                    )
                )
                forward_tasks.append(task)
            
            # Wait for all forwards to complete
            results = await asyncio.gather(*forward_tasks, return_exceptions=True)
            
            # Count successful forwards
            successful = 0
            failed = 0
            for i, r in enumerate(results):
                if isinstance(r, Exception):
                    failed += 1
                    log_detailed("error", "forwarding_engine", "forward_message", f"Forward failed to target {target_channels[i]}", {
                        "error": str(r)
                    })
                else:
                    successful += 1
            
            log_detailed("info", "forwarding_engine", "forward_message", "Forward results", {
                "successful": successful,
                "failed": failed,
                "total": len(target_channels)
            })
            
            # Update statistics
            await db.increment_task_counter(task_id)
            await db.update_task_stats(task_id, "forwarded")
            
            await task_logger.log_success(
                f"Message forwarded to {successful}/{len(target_channels)} targets",
                {"message_id": message.id, "source": message.chat.id}
            )
            
            log_detailed("info", "forwarding_engine", "forward_message", "✅ Forward completed successfully")
            
            # Clean cache (keep last 100 messages)
            if len(self.message_cache) > 100:
                oldest_key = list(self.message_cache.keys())[0]
                del self.message_cache[oldest_key]
            
        except Exception as e:
            log_detailed("error", "forwarding_engine", "forward_message", f"Forward error: {str(e)}", {
                "traceback": traceback.format_exc()
            })
            await task_logger.log_error(f"Forward error: {str(e)}")
            await db.update_task_stats(task_id, "error")
            raise
    
    async def _handle_media_group(
        self,
        message: Message,
        task_id: int,
        task_config: Dict[str, Any],
        task_logger: TaskLogger
    ):
        """Handle media group messages (multiple photos/videos sent together)"""
        media_group_id = message.media_group_id
        cache_key = f"{message.chat.id}_{media_group_id}"
        
        log_detailed("info", "forwarding_engine", "_handle_media_group", "Handling media group", {
            "media_group_id": media_group_id,
            "cache_key": cache_key,
            "is_first_message": cache_key not in self.media_group_cache
        })
        
        async with self.media_group_lock:
            # Add message to cache
            if cache_key not in self.media_group_cache:
                self.media_group_cache[cache_key] = []
                self.media_group_config[cache_key] = {
                    "task_id": task_id,
                    "task_config": task_config,
                    "task_logger": task_logger
                }
                is_first = True
                log_detailed("info", "forwarding_engine", "_handle_media_group", "Created new media group cache - scheduling processing")
            else:
                is_first = False
            
            self.media_group_cache[cache_key].append(message)
            log_detailed("info", "forwarding_engine", "_handle_media_group", f"Added message to cache", {
                "cache_size": len(self.media_group_cache[cache_key]),
                "is_first": is_first
            })
        
        # Only first message in group schedules the processing
        if is_first:
            log_detailed("info", "forwarding_engine", "_handle_media_group", "Scheduling media group processing in 2.5 seconds...")
            # Schedule processing task
            task = asyncio.create_task(self._process_media_group_after_delay(cache_key))
            self.media_group_tasks[cache_key] = task
        else:
            log_detailed("info", "forwarding_engine", "_handle_media_group", "Media group processing already scheduled, just added message to cache")
    
    async def _process_media_group_after_delay(self, cache_key: str):
        """Process media group after waiting for all messages to arrive"""
        try:
            # Wait for all media in group to arrive
            log_detailed("info", "forwarding_engine", "_process_media_group_after_delay", f"Waiting 2.5 seconds for complete media group...", {
                "cache_key": cache_key
            })
            await asyncio.sleep(2.5)
            
            async with self.media_group_lock:
                if cache_key not in self.media_group_cache:
                    log_detailed("warning", "forwarding_engine", "_process_media_group_after_delay", "Cache expired or already processed")
                    return
                
                messages = self.media_group_cache.pop(cache_key)
                config = self.media_group_config.pop(cache_key, {})
                log_detailed("info", "forwarding_engine", "_process_media_group_after_delay", f"Processing {len(messages)} messages in group")
            
            task_id = config.get("task_id")
            task_config = config.get("task_config", {})
            task_logger = config.get("task_logger")
            
            # Create download wrapper for media group
            async def download_wrapper(fid):
                try:
                    result = await self.client.download_media(fid)
                    log_detailed("debug", "forwarding_engine", "_process_media_group_after_delay", f"Downloaded to: {result}")
                    return result
                except Exception as e:
                    log_detailed("error", "forwarding_engine", "_process_media_group_after_delay", f"Download error: {str(e)[:60]}")
                    return None
            
            # Process media group caption through AI if enabled
            processed_caption = None
            if task_config.get("summarization_enabled"):
                log_detailed("info", "forwarding_engine", "_process_media_group_after_delay", "Processing media group captions with AI...")
                # Collect all captions
                all_captions = []
                for msg in messages:
                    if msg.caption:
                        all_captions.append(msg.caption)
                combined_caption = "\n".join(all_captions) if all_captions else ""
                
                if combined_caption:
                    log_detailed("info", "forwarding_engine", "_process_media_group_after_delay", f"Processing {len(combined_caption)} chars of caption text")
                    # Process through AI
                    provider_id = task_config.get("summarization_provider_id") or task_config.get("summarizationProviderId")
                    model_id = task_config.get("summarization_model_id") or task_config.get("summarizationModelId")
                    
                    # Get AI rules for the task (only summarize type)
                    all_rules = await db.get_task_rules(task_id)
                    rules = [r for r in all_rules if r["type"] == "summarize" and r["is_active"]]
                    
                    if rules:
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
                        
                        processed_caption = combined_caption
                        for rule in rules:
                            log_detailed("info", "forwarding_engine", "_process_media_group_after_delay", f"Applying AI rule to media group: {rule['name']}")
                            processed_caption = await ai_manager.summarize_text(
                                processed_caption,
                                provider=provider_name,
                                model=model_name,
                                custom_rule=rule["prompt"]
                            )
                            await db.update_task_stats(task_id, "ai")
                        
                        log_detailed("info", "forwarding_engine", "_process_media_group_after_delay", "✅ Media group captions processed with AI")
            
            # Forward media group to all targets
            target_channels = task_config.get("target_channels", [])
            
            for target_id in target_channels:
                try:
                    log_detailed("info", "forwarding_engine", "_process_media_group_after_delay", f"Forwarding media group to target {target_id}")
                    await self._forward_media_group(
                        messages,
                        target_id,
                        task_logger or TaskLogger(task_id),
                        processed_caption=processed_caption,
                        download_func=download_wrapper
                    )
                except Exception as e:
                    log_detailed("error", "forwarding_engine", "_process_media_group_after_delay", f"Media group forward error: {str(e)}", {
                        "target_id": target_id,
                        "traceback": traceback.format_exc()
                    })
                    if task_logger:
                        await task_logger.log_error(f"Media group forward error: {str(e)}")
            
            # Update statistics
            if task_id:
                await db.increment_task_counter(task_id)
                await db.update_task_stats(task_id, "forwarded")
            
            log_detailed("info", "forwarding_engine", "_process_media_group_after_delay", "✅ Media group forwarded successfully")
        finally:
            # Clean up task reference
            async with self.media_group_lock:
                self.media_group_tasks.pop(cache_key, None)
    
    async def _forward_media_group(
        self,
        messages: List[Message],
        target_id: int,
        task_logger: TaskLogger,
        processed_caption: Optional[str] = None,
        download_func: Optional[Any] = None
    ):
        """Forward a media group to target"""
        log_detailed("info", "forwarding_engine", "_forward_media_group", f"Building media group for target {target_id}", {
            "message_count": len(messages)
        })
        
        target_channel = await db.get_channel(target_id)
        if not target_channel:
            log_detailed("error", "forwarding_engine", "_forward_media_group", f"Target channel not found: {target_id}")
            return
        
        target_identifier_str = target_channel["identifier"]
        
        # Convert identifier to integer for Pyrogram
        try:
            target_identifier = int(target_identifier_str)
        except (ValueError, TypeError):
            target_identifier = target_identifier_str
        
        log_detailed("info", "forwarding_engine", "_forward_media_group", f"Target: {target_channel['title']}", {
            "identifier": target_identifier,
            "identifier_type": type(target_identifier).__name__
        })
        
        # Use processed caption if provided (from AI processing), otherwise collect original captions
        first_caption_entities = None
        if processed_caption is not None:
            combined_caption = processed_caption
            caption_count = sum(1 for msg in messages if msg.caption)
        else:
            # Collect all captions from all messages (preserve all captions)
            all_captions = []
            for msg in messages:
                if msg.caption:
                    all_captions.append(msg.caption)
                    # Keep first caption entities if available
                    if first_caption_entities is None and msg.caption_entities:
                        first_caption_entities = msg.caption_entities
            
            # Combine all captions with separators
            combined_caption = "\n".join(all_captions) if all_captions else ""
            caption_count = len(all_captions)
        
        log_detailed("info", "forwarding_engine", "_forward_media_group", f"Combined captions from {caption_count} messages", {
            "caption_length": len(combined_caption),
            "caption_preview": combined_caption[:100] if combined_caption else "No caption",
            "is_processed": processed_caption is not None
        })
        
        # Create Telegraph page if caption was processed (shortened)
        final_caption = combined_caption
        if processed_caption:
            # Get original caption for comparison
            original_captions = []
            for msg in messages:
                if msg.caption:
                    original_captions.append(msg.caption)
            original_combined = "\n".join(original_captions) if original_captions else ""
            
            if original_combined and len(processed_caption) != len(original_combined):
                log_detailed("info", "forwarding_engine", "_forward_media_group", "Creating Telegraph page for original album content with media...")
                
                # Collect all media from the group
                all_photos = [msg.photo.file_id for msg in messages if msg.photo]
                all_videos = [{'file_id': msg.video.file_id, 'title': 'فيديو'} for msg in messages if msg.video]
                
                log_detailed("info", "forwarding_engine", "_forward_media_group", "Collected media for Telegraph", {
                    "photos": len(all_photos),
                    "videos": len(all_videos)
                })
                
                telegraph_url = await telegraph_manager.create_original_content_page(
                    original_combined,
                    photos_file_ids=all_photos if all_photos else None,
                    videos_info=all_videos if all_videos else None,
                    download_func=download_func if (all_photos or all_videos) else None
                )
                if telegraph_url:
                    final_caption = f"{processed_caption}\n\n📰 <a href=\"{telegraph_url}\">اقرأ كامل الخبر</a>"
                    log_detailed("info", "forwarding_engine", "_forward_media_group", "Added Telegraph link to album caption")
        
        # Build media list
        media_list = []
        for i, msg in enumerate(messages):
            # Only first media item gets the combined caption
            if i == 0:
                caption: str = final_caption or ""
                caption_entities: list = first_caption_entities or []
            else:
                caption = ""
                caption_entities = []
            
            log_detailed("debug", "forwarding_engine", "_forward_media_group", f"Processing media {i+1}", {
                "has_caption": bool(caption),
                "caption_preview": caption[:50] if caption else "No caption"
            })
            
            if msg.photo:
                media_list.append(InputMediaPhoto(
                    media=msg.photo.file_id,
                    caption=caption,
                    caption_entities=caption_entities
                ))
                log_detailed("debug", "forwarding_engine", "_forward_media_group", f"Added photo {i+1}")
            elif msg.video:
                media_list.append(InputMediaVideo(
                    media=msg.video.file_id,
                    caption=caption,
                    caption_entities=caption_entities
                ))
                log_detailed("debug", "forwarding_engine", "_forward_media_group", f"Added video {i+1}")
            elif msg.document:
                media_list.append(InputMediaDocument(
                    media=msg.document.file_id,
                    caption=caption,
                    caption_entities=caption_entities
                ))
                log_detailed("debug", "forwarding_engine", "_forward_media_group", f"Added document {i+1}")
            elif msg.audio:
                media_list.append(InputMediaAudio(
                    media=msg.audio.file_id,
                    caption=caption,
                    caption_entities=caption_entities
                ))
                log_detailed("debug", "forwarding_engine", "_forward_media_group", f"Added audio {i+1}")
        
        if media_list:
            log_detailed("info", "forwarding_engine", "_forward_media_group", f"Sending {len(media_list)} media items")
            await self.client.send_media_group(
                chat_id=target_identifier,
                media=media_list
            )
            log_detailed("info", "forwarding_engine", "_forward_media_group", f"✅ Media group sent to {target_channel['title']}")
            await task_logger.log_info(f"Media group sent to {target_identifier}")
    
    @handle_errors("forwarding_engine", "process_message")
    async def _check_content_filters(
        self,
        text: str,
        task_id: int,
        preprocessing_result: Any = None
    ) -> tuple:
        """
        Check content filters to determine if message should be processed
        Returns: (should_forward: bool, action: str, filter_matched: Optional[dict], modified_text: str)
        """
        try:
            filters = await db.get_content_filters(task_id)
            
            if not filters:
                return (True, "forward", None, text)
            
            for filter_rule in filters:
                filter_type = filter_rule.get("filter_type", "block")
                match_type = filter_rule.get("match_type", "contains")
                pattern = filter_rule.get("pattern", "")
                action = filter_rule.get("action", "skip")
                
                matched = False
                
                if match_type == "contains":
                    matched = pattern.lower() in text.lower()
                elif match_type == "exact":
                    matched = text.strip().lower() == pattern.lower()
                elif match_type == "regex":
                    try:
                        matched = bool(re.search(pattern, text, re.IGNORECASE))
                    except:
                        matched = False
                elif match_type == "sentiment" and preprocessing_result:
                    target_sentiment = filter_rule.get("sentiment_target", "any")
                    current_sentiment = getattr(preprocessing_result, 'sentiment', None)
                    if current_sentiment:
                        sentiment_value = getattr(current_sentiment, 'overall', 'neutral')
                        if target_sentiment == "any":
                            matched = True
                        else:
                            matched = sentiment_value == target_sentiment
                elif match_type == "context":
                    context_desc = filter_rule.get("context_description", "")
                    if context_desc and context_desc.lower() in text.lower():
                        matched = True
                
                if matched:
                    await db.increment_filter_match_count(filter_rule["id"])
                    log_detailed("info", "forwarding_engine", "_check_content_filters", 
                                f"Filter matched: {filter_rule['name']}", {
                                    "filter_type": filter_type,
                                    "action": action,
                                    "pattern": pattern[:50]
                                })
                    
                    if filter_type == "block":
                        return (False, "skip", filter_rule, text)
                    elif filter_type == "allow":
                        return (True, "forward", filter_rule, text)
                    elif filter_type == "require":
                        if action == "modify" and filter_rule.get("modify_instructions"):
                            return (True, "modify", filter_rule, text)
                        return (True, action, filter_rule, text)
            
            return (True, "forward", None, text)
            
        except Exception as e:
            log_detailed("error", "forwarding_engine", "_check_content_filters", f"Filter check error: {str(e)}")
            return (True, "forward", None, text)
    
    def _apply_formatting(self, text: str, formatting: str) -> str:
        """
        Apply Telegram entity formatting to text
        Supported: bold, italic, code, quote, spoiler, strikethrough, underline, none
        """
        if not text or formatting == "none":
            return text
        
        formatting_map = {
            "bold": f"**{text}**",
            "italic": f"__{text}__",
            "code": f"`{text}`",
            "quote": f"> {text}",
            "spoiler": f"||{text}||",
            "strikethrough": f"~~{text}~~",
            "underline": f"<u>{text}</u>",
        }
        
        return formatting_map.get(formatting, text)
    
    async def _extract_fields_with_ai(
        self, 
        text: str, 
        custom_fields: List[Dict[str, Any]], 
        task_id: int
    ) -> Dict[str, str]:
        """
        Use AI to extract custom fields from the text based on their instructions
        """
        from datetime import datetime
        
        extracted = {}
        fields_to_extract = []
        
        for field in custom_fields:
            field_type = field.get("field_type", "extracted")
            field_name = field.get("field_name", "")
            
            if field_type == "summary":
                # Summary is the processed text itself
                extracted[field_name] = text
            elif field_type == "date_today":
                # Use today's date
                extracted[field_name] = datetime.now().strftime("%Y-%m-%d")
            elif field_type == "static":
                # Use default value as static
                extracted[field_name] = field.get("default_value", "")
            elif field_type == "extracted":
                # Need AI extraction
                fields_to_extract.append(field)
        
        # Extract fields using AI if needed
        if fields_to_extract and ai_manager:
            try:
                # Build extraction prompt
                fields_prompt = "\n".join([
                    f"- {f['field_name']}: {f['extraction_instructions']}"
                    for f in fields_to_extract
                ])
                
                extraction_prompt = f"""قم باستخراج المعلومات التالية من النص المعطى.
أجب بتنسيق JSON فقط بدون أي نص إضافي.

الحقول المطلوب استخراجها:
{fields_prompt}

النص:
{text}

أجب بتنسيق JSON التالي فقط:
{{
  "field_name1": "القيمة المستخرجة",
  "field_name2": "القيمة المستخرجة"
}}

إذا لم تجد قيمة لحقل معين، اترك القيمة فارغة ""."""

                # Get AI provider and model for the task
                task_config = await db.get_task(task_id)
                provider_id = task_config.get("summarization_provider_id") if task_config else None
                model_id = task_config.get("summarization_model_id") if task_config else None
                
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
                
                # Call AI to extract fields
                ai_response = await ai_manager.generate_text(
                    provider=provider_name,
                    model=model_name,
                    prompt=extraction_prompt,
                    system_prompt="أنت مساعد لاستخراج المعلومات من النصوص. أجب بتنسيق JSON فقط."
                )
                
                if ai_response:
                    # Parse JSON response
                    import json
                    import re
                    
                    # Try to extract JSON from response
                    json_match = re.search(r'\{[^{}]*\}', ai_response, re.DOTALL)
                    if json_match:
                        try:
                            ai_extracted = json.loads(json_match.group())
                            for field in fields_to_extract:
                                field_name = field.get("field_name", "")
                                if field_name in ai_extracted:
                                    extracted[field_name] = ai_extracted[field_name]
                                elif field.get("use_default_if_empty") and field.get("default_value"):
                                    extracted[field_name] = field.get("default_value")
                                else:
                                    extracted[field_name] = ""
                        except json.JSONDecodeError:
                            log_detailed("warning", "forwarding_engine", "_extract_fields_with_ai", 
                                        "Failed to parse AI JSON response")
                            # Use defaults for all fields
                            for field in fields_to_extract:
                                field_name = field.get("field_name", "")
                                if field.get("use_default_if_empty") and field.get("default_value"):
                                    extracted[field_name] = field.get("default_value")
                                else:
                                    extracted[field_name] = ""
                
            except Exception as e:
                log_detailed("error", "forwarding_engine", "_extract_fields_with_ai", 
                            f"AI extraction error: {str(e)}")
                # Use defaults for all fields on error
                for field in fields_to_extract:
                    field_name = field.get("field_name", "")
                    if field.get("use_default_if_empty") and field.get("default_value"):
                        extracted[field_name] = field.get("default_value")
                    else:
                        extracted[field_name] = ""
        
        return extracted
    
    async def _apply_publishing_template(
        self,
        text: str,
        task_id: int,
        extracted_data: Dict[str, Any] = None
    ) -> str:
        """
        Apply publishing template to format the output with custom fields and formatting
        """
        try:
            template = await db.get_default_template_with_fields(task_id)
            
            if not template:
                return text
            
            custom_fields = template.get("custom_fields", [])
            header_text = template.get("header_text", "")
            header_formatting = template.get("header_formatting", "none")
            footer_text = template.get("footer_text", "")
            footer_formatting = template.get("footer_formatting", "none")
            field_separator = template.get("field_separator", "\n")
            use_newline_after_header = template.get("use_newline_after_header", True)
            use_newline_before_footer = template.get("use_newline_before_footer", True)
            max_length = template.get("max_length")
            
            # Extract custom fields using AI
            if custom_fields:
                extracted_data = await self._extract_fields_with_ai(text, custom_fields, task_id)
            else:
                extracted_data = extracted_data or {}
                extracted_data["summary"] = text
            
            result_parts = []
            
            # Add header if exists
            if header_text:
                formatted_header = self._apply_formatting(header_text.strip(), header_formatting)
                result_parts.append(formatted_header)
                if use_newline_after_header:
                    result_parts.append("")
            
            # Add custom fields in order
            field_parts = []
            for field in custom_fields:
                field_name = field.get("field_name", "")
                field_label = field.get("field_label", "")
                formatting = field.get("formatting", "none")
                show_label = field.get("show_label", False)
                label_separator = field.get("label_separator", ": ")
                prefix = field.get("prefix", "") or ""
                suffix = field.get("suffix", "") or ""
                
                # Get the extracted value
                value = extracted_data.get(field_name, "")
                
                if not value and field.get("use_default_if_empty"):
                    value = field.get("default_value", "")
                
                if value:
                    # Apply formatting to the value
                    formatted_value = self._apply_formatting(str(value), formatting)
                    
                    # Build the field text
                    if show_label and field_label:
                        field_text = f"{field_label}{label_separator}{prefix}{formatted_value}{suffix}"
                    else:
                        field_text = f"{prefix}{formatted_value}{suffix}"
                    
                    field_parts.append(field_text.strip())
            
            if field_parts:
                result_parts.append(field_separator.join(field_parts))
            
            # Add footer if exists
            if footer_text:
                if use_newline_before_footer:
                    result_parts.append("")
                formatted_footer = self._apply_formatting(footer_text.strip(), footer_formatting)
                result_parts.append(formatted_footer)
            
            # Join all parts
            result = "\n".join(filter(None, result_parts))
            
            # Apply max length
            if max_length and len(result) > max_length:
                result = result[:max_length - 3] + "..."
            
            log_detailed("info", "forwarding_engine", "_apply_publishing_template",
                        f"Template applied: {template['name']}", {
                            "output_length": len(result),
                            "fields_count": len(custom_fields),
                            "extracted_count": len(extracted_data)
                        })
            
            return result
            
        except Exception as e:
            log_detailed("error", "forwarding_engine", "_apply_publishing_template", 
                        f"Template error: {str(e)}", {"traceback": traceback.format_exc()})
            return text
    
    async def _process_message(
        self,
        message: Message,
        task_id: int,
        task_config: Dict[str, Any],
        task_logger: TaskLogger
    ) -> Optional[str]:
        """Process message with unified AI pipeline including content filters and publishing templates"""
        text = ""
        
        log_detailed("info", "forwarding_engine", "_process_message", "Starting message processing", {
            "task_id": task_id,
            "has_text": bool(message.text),
            "has_caption": bool(message.caption),
            "has_video": bool(message.video),
            "ai_enabled": task_config.get("ai_enabled"),
            "summarization_enabled": task_config.get("summarization_enabled")
        })
        
        try:
            text = message.text or message.caption or ""
            
            if not text:
                log_detailed("info", "forwarding_engine", "_process_message", "No text to process")
                return None
            
            log_detailed("info", "forwarding_engine", "_process_message", f"Text length: {len(text)} chars")
            
            if task_config.get("video_processing_enabled") and message.video:
                log_detailed("info", "forwarding_engine", "_process_message", "Video detected, adding to queue")
                await task_logger.log_info("Video detected, processing...")
                video_provider_id = task_config.get("video_ai_provider_id") or task_config.get("videoAiProviderId")
                video_model_id = task_config.get("video_ai_model_id") or task_config.get("videoAiModelId")
                await queue_manager.add_job(
                    "video_process",
                    {
                        "message_id": message.id,
                        "chat_id": message.chat.id,
                        "task_id": task_id,
                        "video_provider_id": video_provider_id,
                        "video_model_id": video_model_id
                    },
                    task_id=task_id,
                    priority=5
                )
                return None
            
            if not task_config.get("summarization_enabled"):
                log_detailed("info", "forwarding_engine", "_process_message", "Summarization not enabled for this task")
                return text
            
            provider_id = task_config.get("summarization_provider_id") or task_config.get("summarizationProviderId")
            model_id = task_config.get("summarization_model_id") or task_config.get("summarizationModelId")
            
            provider_name = "groq"
            model_name = "mixtral-8x7b-32768"
            
            if provider_id:
                provider_info = await db.get_ai_provider(provider_id)
                if provider_info:
                    provider_name = provider_info["name"]
                    log_detailed("info", "forwarding_engine", "_process_message", f"Using provider: {provider_name}")
            
            if model_id:
                model_info = await db.get_ai_model(model_id)
                if model_info:
                    model_name = model_info["model_name"]
                    log_detailed("info", "forwarding_engine", "_process_message", f"Using model: {model_name}")
            
            system_prompt = await db.get_setting("default_prompt")
            if system_prompt:
                log_detailed("info", "forwarding_engine", "_process_message", f"Using system prompt: {system_prompt[:80]}...")
            
            all_rules = await db.get_task_rules(task_id)
            rules = [r for r in all_rules if r["type"] == "summarize" and r["is_active"]]
            
            log_detailed("info", "forwarding_engine", "_process_message", 
                        f"🚀 Starting AI Pipeline processing with {len(rules)} rules")
            
            pipeline_result = await ai_pipeline.process(
                text=text,
                task_id=task_id,
                provider=provider_name,
                model=model_name,
                system_prompt=system_prompt,
                custom_rules=rules
            )
            
            log_detailed("info", "forwarding_engine", "_process_message", "📊 AI Pipeline completed", {
                "original_length": len(text),
                "final_length": len(pipeline_result.final_text),
                "stages": len(pipeline_result.stages),
                "rules_applied": pipeline_result.rules_applied_count,
                "quality_score": pipeline_result.quality_score,
                "total_time": f"{pipeline_result.total_time:.2f}s"
            })
            
            for stage in pipeline_result.stages:
                log_detailed("info", "forwarding_engine", "_process_message", 
                            f"  ├─ {stage.stage_name}: {'✅' if stage.success else '❌'} ({stage.processing_time:.2f}s)")
            
            if pipeline_result.entities_replaced:
                for entity_type, replacements in pipeline_result.entities_replaced.items():
                    log_detailed("info", "forwarding_engine", "_process_message",
                                f"  ├─ Entity replacements ({entity_type}): {len(replacements)}")
            
            processed_text = pipeline_result.final_text
            
            should_forward, action, filter_matched, processed_text = await self._check_content_filters(
                processed_text, task_id, pipeline_result.preprocessing
            )
            
            if not should_forward:
                log_detailed("info", "forwarding_engine", "_process_message", 
                            f"⛔ Message blocked by filter: {filter_matched['name'] if filter_matched else 'unknown'}")
                await task_logger.log_warning(f"Message blocked by content filter")
                return None
            
            if action == "modify" and filter_matched:
                log_detailed("info", "forwarding_engine", "_process_message", 
                            f"🔄 Applying filter modification: {filter_matched['name']}")
            
            processed_text = await self._apply_publishing_template(processed_text, task_id)
            
            await task_logger.log_info(
                f"AI Pipeline completed | From {len(text)} → {len(processed_text)} chars",
                {
                    "rules_applied": pipeline_result.rules_applied_count,
                    "quality_score": pipeline_result.quality_score,
                    "provider": provider_name,
                    "model": model_name
                }
            )
            await db.update_task_stats(task_id, "ai")
            
            reduction_percent = 100 - (len(processed_text) * 100 // len(text)) if len(text) > 0 else 0
            log_detailed("info", "forwarding_engine", "_process_message", "✅ Message processing completed", {
                "original_length": len(text),
                "processed_length": len(processed_text),
                "total_reduction": len(text) - len(processed_text),
                "reduction_percent": reduction_percent,
                "final_preview": processed_text[:150]
            })
            
            return processed_text
            
        except Exception as e:
            log_detailed("error", "forwarding_engine", "_process_message", f"AI processing error: {str(e)}", {
                "traceback": traceback.format_exc()
            })
            await task_logger.log_error(f"AI processing error: {str(e)}")
            return text
    
    @handle_errors("forwarding_engine", "forward_to_target")
    async def _forward_to_target(
        self,
        message: Message,
        target_id: int,
        processed_text: Optional[str],
        task_logger: TaskLogger
    ):
        """Forward message to a single target with full support for all media types and entities"""
        
        log_detailed("info", "forwarding_engine", "_forward_to_target", f"Forwarding to target {target_id}", {
            "message_id": message.id,
            "has_processed_text": bool(processed_text)
        })
        
        try:
            # Get target channel info from database
            target_channel = await db.get_channel(target_id)
            
            if not target_channel:
                log_detailed("error", "forwarding_engine", "_forward_to_target", f"Target channel not found: {target_id}")
                await task_logger.log_warning(f"Target channel {target_id} not found")
                return
            
            target_identifier_str = target_channel["identifier"]
            target_title = target_channel["title"]
            
            # Use target identifier as-is (already in correct format from database)
            try:
                target_identifier = int(target_identifier_str)
            except (ValueError, TypeError):
                target_identifier = target_identifier_str
            
            log_detailed("info", "forwarding_engine", "_forward_to_target", f"Target: {target_title}", {
                "identifier": target_identifier,
                "identifier_type": type(target_identifier).__name__
            })
            
            # Get original text/caption and entities
            original_text = message.text or message.caption or ""
            original_entities = message.entities or message.caption_entities
            
            # Determine if we should use processed text
            use_processed = processed_text and processed_text != original_text
            
            final_text = processed_text if use_processed else original_text
            final_entities = None if use_processed else original_entities
            
            # Create Telegraph page if text was processed
            telegraph_url = None
            if use_processed and original_text:
                print(f"\n{'='*100}")
                print(f"[🔗 TELEGRAPH] Starting Telegraph page creation")
                print(f"{'='*100}")
                
                # Collect media
                photos_ids = [message.photo.file_id] if message.photo else []
                videos_info = [{'file_id': message.video.file_id, 'title': 'فيديو'} if message.video else None]
                videos_info = [v for v in videos_info if v]
                
                print(f"[🔗 MEDIA] Photos: {len(photos_ids)}, Videos: {len(videos_info)}")
                
                # Create download wrapper
                async def download_wrapper(fid):
                    try:
                        result = await self.client.download_media(fid)
                        print(f"  [DOWN] Downloaded to: {result}")
                        return result
                    except Exception as e:
                        print(f"  [DOWN] Error: {str(e)[:60]}")
                        return None
                
                telegraph_url = await telegraph_manager.create_original_content_page(
                    original_text=original_text,
                    photos_file_ids=photos_ids if photos_ids else None,
                    videos_info=videos_info if videos_info else None,
                    download_func=download_wrapper if (photos_ids or videos_info) else None
                )
                
                if telegraph_url:
                    print(f"[🔗 RESULT] ✅ Telegraph page created: {telegraph_url}")
                    final_text = f"{final_text}\n\n📰 <a href=\"{telegraph_url}\">اقرأ كامل الخبر</a>"
                else:
                    print(f"[🔗 RESULT] ⚠️ Telegraph page creation failed")
                
                print(f"{'='*100}\n")
            
            log_detailed("info", "forwarding_engine", "_forward_to_target", "Text processing", {
                "original_length": len(original_text),
                "final_length": len(final_text) if final_text else 0,
                "use_processed": use_processed,
                "has_entities": bool(final_entities)
            })
            
            # Handle different message types with entity preservation
            if message.photo:
                log_detailed("info", "forwarding_engine", "_forward_to_target", "Sending photo...")
                await self.client.send_photo(
                    chat_id=target_identifier,
                    photo=message.photo.file_id,
                    caption=final_text or "",
                    caption_entities=final_entities or []
                )
            elif message.video:
                log_detailed("info", "forwarding_engine", "_forward_to_target", "Sending video...")
                await self.client.send_video(
                    chat_id=target_identifier,
                    video=message.video.file_id,
                    caption=final_text or "",
                    caption_entities=final_entities or [],
                    duration=message.video.duration,
                    width=message.video.width,
                    height=message.video.height
                )
            elif message.animation:
                log_detailed("info", "forwarding_engine", "_forward_to_target", "Sending animation...")
                await self.client.send_animation(
                    chat_id=target_identifier,
                    animation=message.animation.file_id,
                    caption=final_text or "",
                    caption_entities=final_entities or []
                )
            elif message.audio:
                log_detailed("info", "forwarding_engine", "_forward_to_target", "Sending audio...")
                await self.client.send_audio(
                    chat_id=target_identifier,
                    audio=message.audio.file_id,
                    caption=final_text or "",
                    caption_entities=final_entities or [],
                    duration=message.audio.duration,
                    performer=message.audio.performer,
                    title=message.audio.title
                )
            elif message.voice:
                log_detailed("info", "forwarding_engine", "_forward_to_target", "Sending voice...")
                await self.client.send_voice(
                    chat_id=target_identifier,
                    voice=message.voice.file_id,
                    caption=final_text or "",
                    caption_entities=final_entities or [],
                    duration=message.voice.duration
                )
            elif message.video_note:
                log_detailed("info", "forwarding_engine", "_forward_to_target", "Sending video note...")
                await self.client.send_video_note(
                    chat_id=target_identifier,
                    video_note=message.video_note.file_id,
                    duration=message.video_note.duration,
                    length=message.video_note.length
                )
            elif message.document:
                log_detailed("info", "forwarding_engine", "_forward_to_target", "Sending document...")
                await self.client.send_document(
                    chat_id=target_identifier,
                    document=message.document.file_id,
                    caption=final_text or "",
                    caption_entities=final_entities or [],
                    file_name=message.document.file_name
                )
            elif message.sticker:
                log_detailed("info", "forwarding_engine", "_forward_to_target", "Sending sticker...")
                await self.client.send_sticker(
                    chat_id=target_identifier,
                    sticker=message.sticker.file_id
                )
            elif message.poll:
                log_detailed("info", "forwarding_engine", "_forward_to_target", "Sending poll...")
                poll_options = [opt.text for opt in (message.poll.options or [])]
                await self.client.send_poll(
                    chat_id=target_identifier,
                    question=message.poll.question,
                    options=poll_options,
                    is_anonymous=message.poll.is_anonymous,
                    type=message.poll.type,
                    allows_multiple_answers=message.poll.allows_multiple_answers
                )
            elif message.contact:
                log_detailed("info", "forwarding_engine", "_forward_to_target", "Sending contact...")
                await self.client.send_contact(
                    chat_id=target_identifier,
                    phone_number=message.contact.phone_number,
                    first_name=message.contact.first_name,
                    last_name=message.contact.last_name
                )
            elif message.location:
                log_detailed("info", "forwarding_engine", "_forward_to_target", "Sending location...")
                await self.client.send_location(
                    chat_id=target_identifier,
                    latitude=message.location.latitude,
                    longitude=message.location.longitude
                )
            elif message.venue:
                log_detailed("info", "forwarding_engine", "_forward_to_target", "Sending venue...")
                await self.client.send_venue(
                    chat_id=target_identifier,
                    latitude=message.venue.location.latitude,
                    longitude=message.venue.location.longitude,
                    title=message.venue.title,
                    address=message.venue.address
                )
            elif message.dice:
                log_detailed("info", "forwarding_engine", "_forward_to_target", "Sending dice...")
                await self.client.send_dice(
                    chat_id=target_identifier,
                    emoji=message.dice.emoji
                )
            elif final_text:
                # Text message with entities preserved
                log_detailed("info", "forwarding_engine", "_forward_to_target", "Sending text message...")
                await self.client.send_message(
                    chat_id=target_identifier,
                    text=final_text,
                    entities=final_entities or [],
                    disable_web_page_preview=True
                )
            else:
                # Fallback: forward original message
                log_detailed("info", "forwarding_engine", "_forward_to_target", "Using fallback forward...")
                await message.forward(target_identifier)
            
            log_detailed("info", "forwarding_engine", "_forward_to_target", f"✅ Forwarded to {target_title}")
            await task_logger.log_info(
                f"Forwarded to {target_title or target_identifier}"
            )
            
        except ChannelPrivate:
            log_detailed("error", "forwarding_engine", "_forward_to_target", f"Channel is private or bot not member: {target_id}")
            await task_logger.log_error(f"Channel private or bot not member: {target_id}")
        except ChatWriteForbidden:
            log_detailed("error", "forwarding_engine", "_forward_to_target", f"Bot cannot write to channel: {target_id}")
            await task_logger.log_error(f"Bot cannot write to channel: {target_id}")
        except FloodWait as e:
            delay = float(e.value) if isinstance(e.value, (int, str)) else 5.0
            log_detailed("warning", "forwarding_engine", "_forward_to_target", f"FloodWait: {delay}s")
            await asyncio.sleep(delay)
            raise
        except Exception as e:
            log_detailed("error", "forwarding_engine", "_forward_to_target", f"Failed to forward: {str(e)}", {
                "target_id": target_id,
                "traceback": traceback.format_exc()
            })
            await task_logger.log_error(
                f"Failed to forward to {target_id}: {str(e)}"
            )
            raise
    
    async def start_task_monitoring(self, task_id: int):
        """Start monitoring a task"""
        self.active_tasks[task_id] = True
        log_detailed("info", "forwarding_engine", "start_task_monitoring", f"Started monitoring task {task_id}")
    
    async def stop_task_monitoring(self, task_id: int):
        """Stop monitoring a task"""
        self.active_tasks[task_id] = False
        log_detailed("info", "forwarding_engine", "stop_task_monitoring", f"Stopped monitoring task {task_id}")
    
    def is_task_active(self, task_id: int) -> bool:
        """Check if task is actively being monitored"""
        return self.active_tasks.get(task_id, False)

# Global forwarding engine (will be initialized with client)
forwarding_engine: Optional[ForwardingEngine] = None
