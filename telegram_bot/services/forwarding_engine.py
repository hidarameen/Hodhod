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
from typing import List, Dict, Any, Optional, Tuple
from pyrogram.client import Client
from pyrogram.types import Message, MessageEntity, InputMediaPhoto, InputMediaVideo, InputMediaDocument, InputMediaAudio
from pyrogram.enums import MessageEntityType, MessageMediaType, ParseMode
from pyrogram.errors import FloodWait, RPCError, ChannelPrivate, ChatWriteForbidden
import re
from utils.error_handler import handle_errors, ErrorLogger, TaskLogger
from utils.database import db
from services.ai_providers import ai_manager
from services.queue_system import queue_manager
from services.telegraph_service import telegraph_manager
from services.link_processor import link_processor
from services.video_processor import video_processor
from services.audio_processor import audio_processor
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

            # Check if processing is enabled (read from correct database column names)
            ai_enabled = task_config.get("aiEnabled", False) or task_config.get("ai_enabled", False)
            video_processing = task_config.get("videoProcessingEnabled", False) or task_config.get("video_processing_enabled", False)
            audio_processing = task_config.get("audioProcessingEnabled", False) or task_config.get("audio_processing_enabled", False)
            summarization_enabled = task_config.get("summarizationEnabled", False) or task_config.get("summarization_enabled", False)
            link_processing = task_config.get("linkProcessingEnabled", False) or task_config.get("link_processing_enabled", False)

            log_detailed("info", "forwarding_engine", "forward_message", "Processing options", {
                "ai_enabled": ai_enabled,
                "video_processing": video_processing,
                "audio_processing": audio_processing,
                "summarization_enabled": summarization_enabled,
                "link_processing": link_processing
            })

            # Generate serial number EARLY so it's available for all processing types
            serial_number = await db.get_next_serial_number(task_id)
            log_detailed("info", "forwarding_engine", "forward_message", f"Assigned serial number #{serial_number} (early generation)")
            
            # Ensure serial is always in initial_extracted_data
            initial_extracted_data = {
                "serial_number": serial_number,
                "record_number": serial_number,
                "رقم_القيد": f"#{serial_number}",
                "رقم_القيد_": f"#{serial_number}"
            }
            log_detailed("info", "forwarding_engine", "forward_message", f"📌 Injected serial #{serial_number} into initial_extracted_data")

            # Check for link processing (message contains only a URL)
            message_text = message.text or ""
            link_processed = False
            summary = ""
            caption = ""
            extracted_data = initial_extracted_data.copy()
            if link_processing and message_text and link_processor.is_video_link(message_text):
                log_detailed("info", "forwarding_engine", "forward_message", "Processing video link...")
                url = link_processor.extract_url(message_text)
                log_detailed("info", "forwarding_engine", "forward_message", f"Extracted URL: {url}")
                if url:
                    try:
                        link_result = await link_processor.process_link(url, task_id, task_config)
                        if link_result:
                            summary, video_path, telegraph_url, video_info = link_result
                            video_title = video_info.get('title', '') if video_info else ''
                            log_detailed("info", "forwarding_engine", "forward_message", f"Link processed: summary={len(summary)} chars, has_video={video_path is not None}, telegraph={telegraph_url}, title={video_title[:30]}")

                            # Apply content filters to summary (same as regular text processing)
                            should_forward, action, filter_matched, filtered_summary = await self._check_content_filters(
                                summary, task_id, None
                            )
                            
                            if not should_forward:
                                log_detailed("info", "forwarding_engine", "forward_message", f"⛔ Link summary blocked by filter: {filter_matched['name'] if filter_matched else 'unknown'}")
                                await task_logger.log_warning(f"Link summary blocked by content filter")
                                return
                            
                            summary = filtered_summary
                            log_detailed("info", "forwarding_engine", "forward_message", f"✅ Link summary passed content filters, final length: {len(summary)} chars")

                            # ✅ COMPREHENSIVE FIX: Extract fields from ALL video data (title, description, transcript)
                            # This ensures التصنيف, نوع_الخبر, المحافظة, المصدر are populated from actual video content
                            template_data = initial_extracted_data.copy()
                            
                            # Get ALL video data for field extraction
                            transcript = video_info.get('transcript', '') if video_info else ''
                            video_title = video_info.get('title', '') if video_info else ''
                            video_description = video_info.get('description', '') if video_info else ''
                            uploader = video_info.get('uploader', '') if video_info else ''
                            platform = video_info.get('platform', '') if video_info else ''
                            channel = video_info.get('channel', '') if video_info else ''
                            
                            log_detailed("info", "forwarding_engine", "forward_message", f"📝 Video data available:", {
                                "transcript_chars": len(transcript),
                                "title": video_title[:50] if video_title else "EMPTY",
                                "description_chars": len(video_description),
                                "uploader": uploader or "EMPTY",
                                "platform": platform or "EMPTY"
                            })
                            
                            # ✅ FIX: Build comprehensive source info with fallbacks
                            if video_info:
                                # Build source info with multiple fallbacks
                                source_parts = []
                                if uploader and uploader.strip():
                                    source_parts.append(uploader.strip())
                                elif channel and channel.strip():
                                    source_parts.append(channel.strip())
                                
                                if platform and platform.strip():
                                    if source_parts:
                                        source_parts.append(f"({platform.strip()})")
                                    else:
                                        source_parts.append(platform.strip())
                                
                                source_info = " ".join(source_parts) if source_parts else "غير محدد"
                                template_data['المصدر'] = source_info
                                template_data['source'] = source_info
                                log_detailed("info", "forwarding_engine", "forward_message", f"✅ Added video source to template: {source_info}")
                            
                            # ✅ FIX: Build COMBINED extraction text from ALL sources (title + description + transcript)
                            # This gives AI more context to extract fields accurately
                            extraction_parts = []
                            if video_title and video_title.strip():
                                extraction_parts.append(f"عنوان الفيديو: {video_title.strip()}")
                            if video_description and video_description.strip():
                                extraction_parts.append(f"وصف الفيديو: {video_description.strip()}")
                            if transcript and transcript.strip():
                                # Limit transcript to first 3000 chars to avoid overwhelming AI
                                transcript_text = transcript.strip()[:3000]
                                extraction_parts.append(f"محتوى الفيديو المُفرّغ: {transcript_text}")
                            
                            combined_extraction_text = "\n\n".join(extraction_parts) if extraction_parts else transcript
                            
                            log_detailed("info", "forwarding_engine", "forward_message", 
                                        f"🤖 Built combined extraction text: {len(combined_extraction_text)} chars from {len(extraction_parts)} sources")
                            
                            # Get template and fields
                            template = await db.get_task_publishing_template(task_id)
                            # ✅ FIX: get_task_publishing_template returns 'fields' NOT 'custom_fields'
                            fields_to_extract = template.get("fields", []) if template else []
                            
                            # ✅ FIX: Check extraction conditions with better logging
                            if not template:
                                log_detailed("warning", "forwarding_engine", "forward_message", 
                                            "⚠️ NO TEMPLATE found for this task - cannot extract fields!")
                            elif not fields_to_extract:
                                log_detailed("warning", "forwarding_engine", "forward_message", 
                                            "⚠️ Template has NO fields defined - cannot extract fields!")
                            elif not combined_extraction_text:
                                log_detailed("warning", "forwarding_engine", "forward_message", 
                                            "⚠️ No video content available (title/description/transcript all empty) - cannot extract fields!")
                            
                            # ✅ FIX: Try to extract fields even with partial data
                            if template and fields_to_extract and combined_extraction_text:
                                provider_name = None
                                model_name = None
                                provider_id = task_config.get("summarization_provider_id") or task_config.get("summarizationProviderId")
                                model_id = task_config.get("summarization_model_id") or task_config.get("summarizationModelId")
                                
                                log_detailed("debug", "forwarding_engine", "forward_message", 
                                            f"📋 Template found with {len(fields_to_extract)} fields to extract", {
                                                "provider_id": provider_id, "model_id": model_id,
                                                "fields": [f.get('field_name') for f in fields_to_extract]
                                            })
                                
                                if provider_id:
                                    provider_info = await db.get_ai_provider(provider_id)
                                    if provider_info:
                                        provider_name = provider_info["name"]
                                
                                if model_id:
                                    model_info = await db.get_ai_model(model_id)
                                    if model_info:
                                        model_name = model_info.get("name") or model_info.get("model_name")
                                
                                log_detailed("debug", "forwarding_engine", "forward_message", 
                                            f"🔧 Provider/Model resolved", {
                                                "provider_name": provider_name, "model_name": model_name
                                            })
                                
                                if provider_name and model_name:
                                    # ✅ CRITICAL FIX: Use combined_extraction_text which includes title, description AND transcript
                                    extracted_data = await self._extract_fields_with_ai(
                                        combined_extraction_text,  # ✅ Use ALL video data (title + description + transcript)
                                        task_id,
                                        provider_name,
                                        model_name,
                                        fields_to_extract,
                                        serial_number=serial_number,
                                        processed_text=summary,  # Use summary as processed text for التلخيص field
                                        original_text=combined_extraction_text,  # Use combined text for field extraction
                                        video_metadata={  # ✅ NEW: Pass video metadata for better extraction
                                            'title': video_title,
                                            'description': video_description,
                                            'uploader': uploader,
                                            'platform': platform,
                                            'channel': channel
                                        }
                                    )
                                    # Merge with template_data
                                    template_data.update(extracted_data)
                                    log_detailed("info", "forwarding_engine", "forward_message", 
                                                f"✅ Extracted {len(extracted_data)} fields from link summary", {
                                                    "fields": list(extracted_data.keys()),
                                                    "values_preview": {k: str(v)[:50] for k, v in extracted_data.items() if v}
                                                })
                                else:
                                    log_detailed("warning", "forwarding_engine", "forward_message", 
                                                "❌ No AI provider/model configured for field extraction - using defaults")
                                    # ✅ FIX: Add default values for fields when AI is not available
                                    for field in fields_to_extract:
                                        field_name = field.get("field_name", "")
                                        default_value = field.get("default_value", "")
                                        if default_value:
                                            template_data[field_name] = default_value
                                            log_detailed("debug", "forwarding_engine", "forward_message", 
                                                        f"Using default for {field_name}: {default_value}")
                            
                            # ✅ FIX: Use template_data (which contains merged extracted data) for template application
                            # Apply publishing template to the summary
                            log_detailed("info", "forwarding_engine", "forward_message", "Applying publishing template to link summary...", {
                                "template_data_keys": list(template_data.keys()),
                                "template_data_count": len(template_data)
                            })
                            template_res = await self._apply_publishing_template(
                                summary, 
                                task_id, 
                                template_data,  # ✅ CRITICAL FIX: Use template_data which contains all merged extracted fields
                                original_text=summary  # Pass summary as original for consistent extraction
                            )
                            
                            # Unpack template result
                            if isinstance(template_res, tuple):
                                template_result, extracted_fields_updated = template_res
                                # Update extracted_data for archiving
                                if extracted_fields_updated:
                                    template_data.update(extracted_fields_updated)
                            else:
                                template_result = template_res

                            if template_result and template_result.strip():
                                caption = template_result
                                log_detailed("info", "forwarding_engine", "forward_message", f"Publishing template applied to link summary: {len(caption)} chars")
                            else:
                                # Fallback to default format if no template
                                caption = f'🔗 <b>ملخص الفيديو من الرابط:</b>\n\n{summary}'
                                log_detailed("info", "forwarding_engine", "forward_message", "No publishing template, using default format")

                            # Add Telegraph link after template
                            if telegraph_url:
                                caption += f'\n\n📄 <a href="{telegraph_url}">اقرأ النص الأصلي الكامل</a>'

                            # Send to all target channels
                            for target_id in target_channels:
                                target_channel = await db.get_channel(target_id)
                                if target_channel:
                                    try:
                                        target_identifier = int(target_channel["identifier"])
                                    except (ValueError, TypeError):
                                        target_identifier = target_channel["identifier"]

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

                                                # Get filename from video title or path
                                                if video_title:
                                                    safe_title = "".join(c for c in video_title if c.isalnum() or c in (' ', '-', '_', '.'))[:50]
                                                    file_name = f"{safe_title}.mp4" if safe_title else "video.mp4"
                                                else:
                                                    file_name = os.path.basename(video_path)
                                                    if not file_name.lower().endswith('.mp4'):
                                                        file_name = file_name.rsplit('.', 1)[0] + '.mp4'

                                                log_detailed("info", "forwarding_engine", "forward_message", f"Using file_name: {file_name}")

                                                await self.client.send_video(
                                                    chat_id=target_identifier,
                                                    video=video_path,
                                                    caption=send_caption,
                                                    parse_mode=ParseMode.HTML,
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
                                                    text=caption,
                                                    parse_mode=ParseMode.HTML
                                                )
                                        else:
                                            log_detailed("error", "forwarding_engine", "forward_message", f"Video file not found (already deleted?): {video_path}")
                                            await self.client.send_message(
                                                chat_id=target_identifier,
                                                text=caption,
                                                parse_mode=ParseMode.HTML
                                            )
                                    else:
                                        # No video to send, send summary as text only
                                        log_detailed("info", "forwarding_engine", "forward_message", f"No video from link, sending summary as text only")
                                        await self.client.send_message(
                                            chat_id=target_identifier,
                                            text=caption,
                                            parse_mode=ParseMode.HTML
                                        )

                            await db.increment_task_counter(task_id)
                            await db.update_task_stats(task_id, "forwarded")
                            await task_logger.log_success(f"Link processed and forwarded to {len(target_channels)} targets")
                            link_processed = True
                    except Exception as e:
                        log_detailed("error", "forwarding_engine", "forward_message", f"Link processing error: {str(e)}")
                        await task_logger.log_warning(f"Link processing failed, forwarding original: {str(e)}")

            # If link was processed successfully, save to archive and return
            if link_processed:
                # Save link to archive
                try:
                    await self._save_to_archive(
                        message=message,
                        task_id=task_id,
                        task_config=task_config,
                        original_text=message_text,
                        processed_text=summary if 'summary' in dir() else caption,
                        target_channels=target_channels,
                        extracted_data=extracted_data if 'extracted_data' in dir() else initial_extracted_data,
                        serial_number=serial_number
                    )
                except Exception as archive_err:
                    log_detailed("warning", "forwarding_engine", "forward_message",
                                f"Failed to save link to archive: {str(archive_err)}")
                return

            # Check for video processing (message contains a video)
            video_processed = False
            video_summary = None
            telegraph_url = None
            video_transcript = None  # ✅ FIX: Store transcript for field extraction
            if video_processing and message.video:
                log_detailed("info", "forwarding_engine", "forward_message", "Processing video message...")
                try:
                    # ✅ FIX: Extract caption summary and text for video processing
                    # This ensures the caption fields are not empty after processing
                    caption_text = message.caption or ""
                    caption_summary = None
                    if ai_enabled and summarization_enabled and caption_text:
                        log_detailed("info", "forwarding_engine", "forward_message", "Summarizing caption before video processing...")
                        processed_res = await self._process_message(caption_text, task_id, task_config, serial_number)
                        if processed_res:
                            caption_summary, _ = processed_res

                    video_result = await video_processor.process_video(
                        client=self.client,
                        message_id=message.id,
                        chat_id=message.chat.id,
                        task_id=task_id,
                        task_config=task_config,
                        caption_summary=caption_summary,
                        caption_text=caption_text
                    )
                    if video_result:
                        summary, transcript, telegraph_url = video_result
                        video_transcript = transcript  # ✅ FIX: Store transcript for later use
                        log_detailed("info", "forwarding_engine", "forward_message", f"Video processed successfully: summary={len(summary)} chars, telegraph={telegraph_url}")
                        
                        # Apply content filters to summary (same as regular text processing)
                        should_forward, action, filter_matched, filtered_summary = await self._check_content_filters(
                            summary, task_id, None
                        )
                        
                        if not should_forward:
                            log_detailed("info", "forwarding_engine", "forward_message", f"⛔ Video summary blocked by filter: {filter_matched['name'] if filter_matched else 'unknown'}")
                            await task_logger.log_warning(f"Video summary blocked by content filter")
                            video_summary = None
                            video_processed = False
                        else:
                            summary = filtered_summary
                            log_detailed("info", "forwarding_engine", "forward_message", f"✅ Video summary passed content filters, final length: {len(summary)} chars")
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
                
                # ✅ FIX: Extract fields from video summary BEFORE applying template
                # This ensures التصنيف, نوع_الخبر, المحافظة, المصدر are populated
                log_detailed("info", "forwarding_engine", "forward_message", "Extracting fields from video summary...")
                template = await db.get_task_publishing_template(task_id)
                # ✅ CRITICAL FIX: Use "fields" key NOT "custom_fields" (matches link processing)
                fields_to_extract = template.get("fields", []) or template.get("custom_fields", []) if template else []
                
                # ✅ CRITICAL FIX: Create template_data from initial_extracted_data (contains serial number)
                template_data = initial_extracted_data.copy()
                
                if template and fields_to_extract:
                    # Get AI provider/model for extraction
                    provider_name = None
                    model_name = None
                    provider_id = task_config.get("summarization_provider_id") or task_config.get("summarizationProviderId")
                    model_id = task_config.get("summarization_model_id") or task_config.get("summarizationModelId")
                    
                    if provider_id:
                        provider_info = await db.get_ai_provider(provider_id)
                        if provider_info:
                            provider_name = provider_info["name"]
                    
                    if model_id:
                        model_info = await db.get_ai_model(model_id)
                        if model_info:
                            model_name = model_info.get("name") or model_info.get("model_name")
                    
                    # ✅ CRITICAL FIX: Extract fields from TRANSCRIPT (full text), not just summary
                    # This ensures التصنيف, نوع_الخبر, المحافظة, المصدر are extracted correctly
                    if provider_name and model_name:
                        # Use transcript for field extraction (has more context)
                        extraction_text = video_transcript if video_transcript else video_summary
                        text_source = "transcript" if video_transcript else "summary"
                        log_detailed("debug", "forwarding_engine", "forward_message", 
                                    f"Using {text_source} for field extraction ({len(extraction_text)} chars)")
                        
                        extracted_data = await self._extract_fields_with_ai(
                            extraction_text,  # ✅ Use full transcript for better field extraction
                            task_id,
                            provider_name,
                            model_name,
                            fields_to_extract,
                            serial_number=serial_number,
                            processed_text=video_summary,  # Keep summary for التلخيص field
                            original_text=extraction_text  # Use extraction text as original
                        )
                        # ✅ CRITICAL FIX: Merge with template_data (which contains merged extracted fields)
                        template_data.update(extracted_data)
                        log_detailed("info", "forwarding_engine", "forward_message", 
                                    f"✅ Extracted {len(extracted_data)} fields from video summary", {
                                        "fields": list(extracted_data.keys()),
                                        "values_preview": {k: str(v)[:50] for k, v in extracted_data.items() if v}
                                    })
                    else:
                        log_detailed("warning", "forwarding_engine", "forward_message", 
                                    "❌ No AI provider/model configured for field extraction - using defaults")
                        # ✅ FIX: Add default values for fields when AI is not available
                        for field in fields_to_extract:
                            field_name = field.get("field_name", "")
                            default_value = field.get("default_value", "")
                            if default_value:
                                template_data[field_name] = default_value
                                log_detailed("debug", "forwarding_engine", "forward_message", 
                                            f"Using default for {field_name}: {default_value}")
                else:
                    log_detailed("debug", "forwarding_engine", "forward_message", 
                                "No template or fields configured for extraction")
                
                # ✅ CRITICAL FIX: Add summary to template_data BEFORE applying template
                # This ensures the summary field is available for template processing
                template_data["التلخيص"] = video_summary
                template_data["summary"] = video_summary
                log_detailed("debug", "forwarding_engine", "forward_message", 
                            f"✅ Added summary to template_data: {len(video_summary)} chars")
                
                # ✅ FIX: Use template_data (which contains merged extracted data) for template application
                # Apply publishing template to the video summary
                log_detailed("info", "forwarding_engine", "forward_message", "Applying publishing template to video summary...", {
                    "template_data_keys": list(template_data.keys()),
                    "template_data_count": len(template_data)
                })
                # ✅ CRITICAL: Pass video_summary as TEXT and template_data as EXTRACTED_DATA
                template_result, extracted_data = await self._apply_publishing_template(
                    video_summary,  # The processed text (for summary field)
                    task_id,
                    extracted_data=template_data  # All extracted fields including summary
                )
                if template_result and template_result.strip():
                    caption = template_result
                    log_detailed("info", "forwarding_engine", "forward_message", f"Publishing template applied to video summary: {len(caption)} chars")
                else:
                    # Fallback to default format if no template
                    caption = f'📹 <b>ملخص الفيديو:</b>\n\n{video_summary}'
                    log_detailed("info", "forwarding_engine", "forward_message", "No publishing template, using default format")

                # ✅ CRITICAL FIX: Add Telegraph link BEFORE truncating to ensure it doesn't get cut off
                telegraph_link = ""
                if telegraph_url:
                    telegraph_link = f'\n\n📰 <a href="{telegraph_url}">اقرأ كامل الخبر</a>'
                    log_detailed("info", "forwarding_engine", "forward_message", f"✅ Telegraph link prepared: {telegraph_url}")

                # Calculate the space we need for the Telegraph link
                max_caption_length = 1024
                reserved_for_link = len(telegraph_link) + 10  # Extra buffer
                max_content_length = max_caption_length - reserved_for_link if telegraph_link else max_caption_length
                
                # Truncate caption if too long (Telegram limit is 1024 chars for caption)
                if len(caption) > max_content_length:
                    caption = caption[:max(max_content_length - 3, 100)] + "..."
                    log_detailed("info", "forwarding_engine", "forward_message", f"Truncated caption to {len(caption)} chars to make room for Telegraph link")

                # Now add the Telegraph link if it wasn't truncated away
                if telegraph_link and len(caption) + len(telegraph_link) <= max_caption_length:
                    caption += telegraph_link
                    log_detailed("info", "forwarding_engine", "forward_message", f"✅ Added Telegraph link to video caption")
                elif telegraph_link:
                    # Link is too long, but try to add a short version
                    short_link = f'\n\n<a href="{telegraph_url}">اقرأ الخبر</a>'
                    if len(caption) + len(short_link) <= max_caption_length:
                        caption += short_link
                        log_detailed("info", "forwarding_engine", "forward_message", f"✅ Added short Telegraph link version")

                for target_id in target_channels:
                    target_channel = await db.get_channel(target_id)
                    if target_channel:
                        try:
                            target_identifier = int(target_channel["identifier"])
                        except (ValueError, TypeError):
                            target_identifier = target_channel["identifier"]

                        try:
                            # Forward the original video with the summary caption (HTML format)
                            await self.client.copy_message(
                                chat_id=target_identifier,
                                from_chat_id=message.chat.id,
                                message_id=message.id,
                                caption=caption,
                                parse_mode=ParseMode.HTML
                            )
                            log_detailed("info", "forwarding_engine", "forward_message", f"Video forwarded to target {target_id} with summary and Telegraph link")
                        except Exception as copy_err:
                            # Fallback: send just the summary text
                            log_detailed("warning", "forwarding_engine", "forward_message", f"Failed to copy video: {str(copy_err)}, sending summary as text")
                            await self.client.send_message(
                                chat_id=target_identifier,
                                text=caption,
                                parse_mode=ParseMode.HTML
                            )

                await db.increment_task_counter(task_id)
                await db.update_task_stats(task_id, "forwarded")
                await task_logger.log_success(f"Video with summary forwarded to {len(target_channels)} targets")
                
                # Save video to archive
                try:
                    await self._save_to_archive(
                        message=message,
                        task_id=task_id,
                        task_config=task_config,
                        original_text=transcript if transcript else (message.caption or ""),
                        processed_text=video_summary,
                        target_channels=target_channels,
                        extracted_data=extracted_data,
                        serial_number=serial_number
                    )
                except Exception as archive_err:
                    log_detailed("warning", "forwarding_engine", "forward_message",
                                f"Failed to save video to archive: {str(archive_err)}")
                return

            # Check for audio processing (message contains audio, voice, or audio document)
            # Always try to process audio if present, regardless of flag setting
            audio_processed = False
            audio_summary = None
            audio_telegraph_url = None
            audio_transcript = None
            has_audio = message.audio or message.voice
            
            # Also check if document is an audio file
            if not has_audio and message.document and message.document.file_name:
                has_audio = audio_processor.is_audio_file(message.document.file_name)
                if has_audio:
                    log_detailed("info", "forwarding_engine", "forward_message", f"Detected audio file in document: {message.document.file_name}")
            
            if has_audio:
                log_detailed("info", "forwarding_engine", "forward_message", "Processing audio message...")
                try:
                    audio_result = await audio_processor.process_audio(
                        client=self.client,
                        message_id=message.id,
                        chat_id=message.chat.id,
                        task_id=task_id,
                        task_config=task_config
                    )
                    if audio_result:
                        summary, audio_transcript, audio_telegraph_url = audio_result
                        log_detailed("info", "forwarding_engine", "forward_message", f"Audio processed successfully: summary={len(summary)} chars, telegraph={audio_telegraph_url}")
                        
                        should_forward, action, filter_matched, filtered_summary = await self._check_content_filters(
                            summary, task_id, None
                        )
                        
                        if not should_forward:
                            log_detailed("info", "forwarding_engine", "forward_message", f"⛔ Audio summary blocked by filter: {filter_matched['name'] if filter_matched else 'unknown'}")
                            await task_logger.log_warning(f"Audio summary blocked by content filter")
                            audio_summary = None
                            audio_processed = False
                        else:
                            summary = filtered_summary
                            log_detailed("info", "forwarding_engine", "forward_message", f"✅ Audio summary passed content filters, final length: {len(summary)} chars")
                            audio_summary = summary
                            audio_processed = True
                except Exception as e:
                    log_detailed("error", "forwarding_engine", "forward_message", f"Audio processing error: {str(e)}")
                    await task_logger.log_warning(f"Audio processing failed, forwarding original: {str(e)}")
                    audio_summary = None
                    audio_telegraph_url = None

            # If audio was processed, forward the original audio with summary as caption
            if audio_processed and audio_summary:
                log_detailed("info", "forwarding_engine", "forward_message", "Forwarding audio with summary caption...")
                
                # ✅ FIX: Extract fields from audio summary BEFORE applying template
                log_detailed("info", "forwarding_engine", "forward_message", "Extracting fields from audio summary...")
                template = await db.get_task_publishing_template(task_id)
                fields_to_extract = template.get("custom_fields", []) if template else []
                
                # ✅ CRITICAL FIX: Create template_data from initial_extracted_data (contains serial number)
                template_data = initial_extracted_data.copy()
                
                if template and fields_to_extract:
                    provider_name = None
                    model_name = None
                    provider_id = task_config.get("summarization_provider_id") or task_config.get("summarizationProviderId")
                    model_id = task_config.get("summarization_model_id") or task_config.get("summarizationModelId")
                    
                    if provider_id:
                        provider_info = await db.get_ai_provider(provider_id)
                        if provider_info:
                            provider_name = provider_info["name"]
                    
                    if model_id:
                        model_info = await db.get_ai_model(model_id)
                        if model_info:
                            model_name = model_info.get("name") or model_info.get("model_name")
                    
                    if provider_name and model_name:
                        extracted_data = await self._extract_fields_with_ai(
                            audio_summary,
                            task_id,
                            provider_name,
                            model_name,
                            fields_to_extract,
                            serial_number=serial_number,
                            processed_text=audio_summary,
                            original_text=message.caption or ""
                        )
                        # ✅ CRITICAL FIX: Merge with template_data (which contains merged extracted fields)
                        template_data.update(extracted_data)
                        log_detailed("info", "forwarding_engine", "forward_message", 
                                    f"✅ Extracted {len(extracted_data)} fields from audio summary", {
                                        "fields": list(extracted_data.keys()),
                                        "values_preview": {k: str(v)[:50] for k, v in extracted_data.items() if v}
                                    })
                    else:
                        log_detailed("warning", "forwarding_engine", "forward_message", 
                                    "❌ No AI provider/model configured for field extraction - using defaults")
                        # ✅ FIX: Add default values for fields when AI is not available
                        for field in fields_to_extract:
                            field_name = field.get("field_name", "")
                            default_value = field.get("default_value", "")
                            if default_value:
                                template_data[field_name] = default_value
                                log_detailed("debug", "forwarding_engine", "forward_message", 
                                            f"Using default for {field_name}: {default_value}")
                
                # ✅ CRITICAL FIX: Add summary to template_data BEFORE applying template
                # This ensures the summary field is available for template processing
                template_data["التلخيص"] = audio_summary
                template_data["summary"] = audio_summary
                log_detailed("debug", "forwarding_engine", "forward_message", 
                            f"✅ Added summary to template_data: {len(audio_summary)} chars")
                
                # ✅ FIX: Use template_data (which contains merged extracted data) for template application
                log_detailed("info", "forwarding_engine", "forward_message", "Applying publishing template to audio summary...", {
                    "template_data_keys": list(template_data.keys()),
                    "template_data_count": len(template_data)
                })
                # ✅ CRITICAL: Pass audio_summary as TEXT and template_data as EXTRACTED_DATA
                template_result, extracted_data = await self._apply_publishing_template(
                    audio_summary,  # The processed text (for summary field)
                    task_id,
                    extracted_data=template_data  # All extracted fields including summary
                )
                if template_result and template_result.strip():
                    caption = template_result
                    log_detailed("info", "forwarding_engine", "forward_message", f"Publishing template applied to audio summary: {len(caption)} chars")
                else:
                    caption = f'🎙️ <b>ملخص المقطع الصوتي:</b>\n\n{audio_summary}'
                    log_detailed("info", "forwarding_engine", "forward_message", "No publishing template, using default format")

                # Add Telegraph link after template
                if audio_telegraph_url:
                    caption += f'\n\n📰 <a href="{audio_telegraph_url}">اقرأ كامل الخبر</a>'
                    log_detailed("info", "forwarding_engine", "forward_message", f"✅ Added Telegraph link to audio caption: {audio_telegraph_url}")

                if len(caption) > 1024:
                    caption = caption[:1020] + "..."

                for target_id in target_channels:
                    target_channel = await db.get_channel(target_id)
                    if target_channel:
                        try:
                            target_identifier = int(target_channel["identifier"])
                        except (ValueError, TypeError):
                            target_identifier = target_channel["identifier"]

                        try:
                            await self.client.copy_message(
                                chat_id=target_identifier,
                                from_chat_id=message.chat.id,
                                message_id=message.id,
                                caption=caption,
                                parse_mode=ParseMode.HTML
                            )
                            log_detailed("info", "forwarding_engine", "forward_message", f"Audio forwarded to target {target_id} with summary and Telegraph link")
                        except Exception as copy_err:
                            log_detailed("warning", "forwarding_engine", "forward_message", f"Failed to copy audio: {str(copy_err)}, sending summary as text")
                            await self.client.send_message(
                                chat_id=target_identifier,
                                text=caption,
                                parse_mode=ParseMode.HTML
                            )

                await db.increment_task_counter(task_id)
                await db.update_task_stats(task_id, "forwarded")
                await task_logger.log_success(f"Audio with summary forwarded to {len(target_channels)} targets")
                
                # Save audio to archive
                try:
                    await self._save_to_archive(
                        message=message,
                        task_id=task_id,
                        task_config=task_config,
                        original_text=audio_transcript if audio_transcript else "",
                        processed_text=audio_summary,
                        target_channels=target_channels,
                        extracted_data=extracted_data,
                        serial_number=serial_number
                    )
                except Exception as archive_err:
                    log_detailed("warning", "forwarding_engine", "forward_message",
                                f"Failed to save audio to archive: {str(archive_err)}")
                return

            # Generate cache key
            cache_key = f"{message.chat.id}_{message.id}"

            # Use the serial number generated earlier (no need to generate again)

            # Process message with AI/summarization (only once)
            processed_text = None
            extracted_data = None
            if ai_enabled or summarization_enabled:
                if cache_key not in self.message_cache:
                    log_detailed("info", "forwarding_engine", "forward_message", "Processing message with AI...")
                    result = await self._process_message(
                        message,
                        task_id,
                        task_config,
                        task_logger,
                        serial_number=serial_number
                    )
                    # _process_message may return tuple (text, data) or just text
                    if isinstance(result, tuple):
                        processed_text, extracted_data = result
                    else:
                        processed_text = result
                    self.message_cache[cache_key] = (processed_text, extracted_data)
                else:
                    cached = self.message_cache[cache_key]
                    if isinstance(cached, tuple):
                        processed_text, extracted_data = cached
                    else:
                        processed_text = cached
                    log_detailed("info", "forwarding_engine", "forward_message", "Using cached processed text")
            else:
                # Even without AI processing, add serial number to extracted_data
                extracted_data = {"serial_number": serial_number} if serial_number else {}

            # CRITICAL: Ensure serial number is in extracted_data
            if not extracted_data:
                extracted_data = {}
            if serial_number is not None:
                extracted_data["serial_number"] = serial_number
                log_detailed("info", "forwarding_engine", "forward_message",
                            f"✅ Serial number set in extracted_data: {serial_number}")

            # ✅ NEW: Handle regular message Telegraph links if needed
            # (Though usually text messages don't have them unless processed via link_processor)
            if not link_processed and not video_processed and not audio_processed:
                # Check if we have a transcript/telegraph from AI processing (unlikely but possible)
                telegraph_url = extracted_data.get("telegraph_url")
                if telegraph_url and final_text:
                    final_text = f"{final_text}\n\n📰 <a href=\"{telegraph_url}\">اقرأ كامل الخبر</a>"
                    log_detailed("info", "forwarding_engine", "forward_message", "✅ Added Telegraph link to final text")

            # Forward to all targets in parallel
            log_detailed("info", "forwarding_engine", "forward_message", f"Forwarding to {len(target_channels)} targets in parallel...")

            forward_tasks = []
            for target_id in target_channels:
                task = asyncio.create_task(
                    self._forward_to_target(
                        message,
                        target_id,
                        processed_text,
                        task_logger,
                        task_id=task_id,
                        extracted_data=extracted_data
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

            # Save to archive if forwarding was successful
            if successful > 0:
                try:
                    await self._save_to_archive(
                        message=message,
                        task_id=task_id,
                        task_config=task_config,
                        original_text=message.text or message.caption or "",
                        processed_text=processed_text or "",
                        target_channels=target_channels,
                        extracted_data=extracted_data,
                        serial_number=serial_number
                    )
                except Exception as archive_err:
                    log_detailed("warning", "forwarding_engine", "forward_message",
                                f"Failed to save to archive: {str(archive_err)}")

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

            # ✅ FIX 1: Generate serial number EARLY for media groups (same as regular messages)
            serial_number = await db.get_next_serial_number(task_id)
            log_detailed("info", "forwarding_engine", "_process_media_group_after_delay", 
                        f"Assigned serial number #{serial_number} for media group")
            
            # Process media group caption through AI if enabled
            processed_caption = None
            extracted_data = {}
            original_caption = None
            
            # Collect all captions first (needed regardless of summarization)
            all_captions = []
            for msg in messages:
                if msg.caption:
                    all_captions.append(msg.caption)
            combined_caption = "\n".join(all_captions) if all_captions else ""
            original_caption = combined_caption
            
            # ✅ FIX 2: Check BOTH key names for summarization (same as regular messages line 107)
            summarization_enabled = task_config.get("summarizationEnabled", False) or task_config.get("summarization_enabled", False)
            ai_enabled = task_config.get("aiEnabled", False) or task_config.get("ai_enabled", False)
            
            if combined_caption and (ai_enabled or summarization_enabled):
                log_detailed("info", "forwarding_engine", "_process_media_group_after_delay", 
                            "Processing media group captions with AI Pipeline (same as regular messages)...", {
                                "ai_enabled": ai_enabled,
                                "summarization_enabled": summarization_enabled,
                                "caption_length": len(combined_caption)
                            })
                
                # ✅ CRITICAL FIX: Use AI Pipeline for media groups (same as regular messages)
                # This ensures consistent processing across all content types
                provider_id = task_config.get("summarization_provider_id") or task_config.get("summarizationProviderId")
                model_id = task_config.get("summarization_model_id") or task_config.get("summarizationModelId")

                provider_name = None
                model_name = None

                if provider_id:
                    provider_info = await db.get_ai_provider(provider_id)
                    if provider_info:
                        provider_name = provider_info["name"]
                        if not provider_info.get("api_key"):
                            log_detailed("error", "forwarding_engine", "_process_media_group_after_delay", 
                                        f"Provider {provider_name} has no API key configured")
                            provider_name = None

                if model_id:
                    model_info = await db.get_ai_model(model_id)
                    if model_info:
                        model_name = model_info.get("name") or model_info.get("model_name")

                # Get AI rules for the task
                all_rules = await db.get_task_rules(task_id)
                rules = [r for r in all_rules if r["type"] == "summarize" and r["is_active"]]

                # ✅ Get template fields for combined extraction (same as regular messages)
                fields_to_extract = []
                try:
                    template = await db.get_task_publishing_template(task_id)
                    # ✅ CRITICAL FIX: get_task_publishing_template() returns 'fields' NOT 'custom_fields'
                    if template and template.get("fields"):
                        fields_to_extract = template.get("fields", [])
                        log_detailed("info", "forwarding_engine", "_process_media_group_after_delay", 
                                    f"✅ Loaded {len(fields_to_extract)} template fields for combined extraction", {
                                        "field_names": [f.get("field_name") for f in fields_to_extract]
                                    })
                    else:
                        log_detailed("warning", "forwarding_engine", "_process_media_group_after_delay", 
                                    f"No template fields found (template={bool(template)}, has_fields={template.get('fields') if template else False})")
                except Exception as e:
                    log_detailed("warning", "forwarding_engine", "_process_media_group_after_delay", 
                                f"Could not load template fields: {str(e)}", {
                                    "error": str(e)
                                })

                # ✅ Use AI Pipeline if provider/model available (SAME AS REGULAR MESSAGES)
                if provider_name and model_name:
                    log_detailed("info", "forwarding_engine", "_process_media_group_after_delay",
                                f"🚀 Starting AI Pipeline for media group | Provider: {provider_name} | Model: {model_name}", {
                                    "rules_count": len(rules),
                                    "fields_count": len(fields_to_extract)
                                })
                    
                    system_prompt = await db.get_setting("default_prompt")
                    
                    pipeline_result = await ai_pipeline.process(
                        text=combined_caption,
                        task_id=task_id,
                        provider=provider_name,
                        model=model_name,
                        system_prompt=system_prompt,
                        custom_rules=rules,
                        fields_to_extract=fields_to_extract,
                        serial_number=serial_number
                    )

                    processed_caption = pipeline_result.final_text
                    extracted_data = pipeline_result.extracted_fields or {}
                    
                    # ✅ CRITICAL: Log all extracted fields
                    log_detailed("info", "forwarding_engine", "_process_media_group_after_delay", 
                                f"✅ AI Pipeline completed for media group", {
                                    "original_length": len(combined_caption),
                                    "processed_length": len(processed_caption),
                                    "rules_applied": pipeline_result.rules_applied_count,
                                    "extracted_fields_count": len(extracted_data),
                                    "extracted_field_names": list(extracted_data.keys()),
                                    "extracted_data_preview": {k: str(v)[:50] if v else "" for k, v in extracted_data.items()}
                                })
                    await db.update_task_stats(task_id, "ai")
                else:
                    # No AI provider/model configured - use original
                    log_detailed("warning", "forwarding_engine", "_process_media_group_after_delay", 
                                "No AI provider/model configured, using original caption")
                    processed_caption = combined_caption
            else:
                # Even if AI disabled, set processed_caption to combined
                processed_caption = combined_caption
                log_detailed("info", "forwarding_engine", "_process_media_group_after_delay", 
                            "AI processing disabled, using original caption")
            
            # ✅ CRITICAL: Ensure extracted_data is properly populated
            # If AI Pipeline was used, it's already in extracted_data
            # If not, populate from template or use defaults
            if not extracted_data:
                extracted_data = {}
            
            # ✅ Ensure summary field is set from processed_caption
            if processed_caption and "التلخيص" not in extracted_data:
                extracted_data["التلخيص"] = processed_caption
            if processed_caption and "summary" not in extracted_data:
                extracted_data["summary"] = processed_caption
            
            # ✅ Ensure serial number is always in extracted_data
            if serial_number is not None:
                val_str = str(serial_number).strip()
                if val_str and val_str != "0":
                    prefix_val = f"#{val_str}" if not val_str.startswith("#") else val_str
                    extracted_data["رقم_القيد"] = prefix_val
                    extracted_data["رقم_القيد_"] = prefix_val
                    extracted_data["serial_number"] = val_str
                else:
                    # If serial is 0 or empty, don't add it to extracted_data or set it to empty
                    extracted_data["رقم_القID"] = ""
                    extracted_data["رقم_القيد_"] = ""
                    extracted_data["serial_number"] = ""
            
            log_detailed("info", "forwarding_engine", "_process_media_group_after_delay", 
                       f"✅ Media group field extraction complete", {
                           "extracted_fields_count": len(extracted_data),
                           "has_summary": bool(extracted_data.get("التلخيص") or extracted_data.get("summary")),
                           "summary_length": len(extracted_data.get("التلخيص") or extracted_data.get("summary") or ""),
                           "serial_number": serial_number
                       })

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
                        download_func=download_wrapper,
                        task_id=task_id,
                        extracted_data=extracted_data
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
        download_func: Optional[Any] = None,
        task_id: Optional[int] = None,
        extracted_data: Optional[Dict[str, Any]] = None
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

        # Collect original captions first (needed for comparison and telegraph)
        first_caption_entities = None
        original_combined_caption = None
        all_original_captions = []
        for msg in messages:
            if msg.caption:
                all_original_captions.append(msg.caption)
                # Keep first caption entities if available
                if first_caption_entities is None and msg.caption_entities:
                    first_caption_entities = msg.caption_entities
        
        original_combined_caption = "\n".join(all_original_captions) if all_original_captions else ""
        
        # Use processed caption if provided (from AI processing), otherwise use original
        # ✅ CRITICAL: Keep track of BOTH original and processed separately!
        combined_caption = processed_caption if processed_caption is not None else original_combined_caption
        caption_count = len(all_original_captions)

        log_detailed("info", "forwarding_engine", "_forward_media_group", f"Combined captions from {caption_count} messages", {
            "caption_length": len(combined_caption),
            "caption_preview": combined_caption[:100] if combined_caption else "No caption",
            "is_processed": processed_caption is not None,
            "original_length": len(original_combined_caption)
        })

        # ✅ FIXED: Apply template using PROCESSED caption (or original if no processing), pass ORIGINAL for reference
        template_applied_caption = combined_caption
        if task_id and combined_caption:
            log_detailed("debug", "forwarding_engine", "_forward_media_group",
                        "Attempting to apply publishing template to media group caption...")
            template_result, _ = await self._apply_publishing_template(
                combined_caption,  # Use processed_caption (already in combined_caption)
                task_id, 
                extracted_data=extracted_data or {},
                original_text=original_combined_caption  # Pass original for comparison
            )
            # ✅ CRITICAL FIX: Always use template_result if it's not None (even if empty)
            if template_result is not None:
                template_applied_caption = template_result
                combined_caption = template_applied_caption
                first_caption_entities = None  # Reset entities since text was modified
                log_detailed("info", "forwarding_engine", "_forward_media_group",
                            "✅ Template applied to media group caption", {
                                "original_length": len(combined_caption),
                                "final_length": len(template_applied_caption),
                                "has_content": bool(template_applied_caption)
                            })
            else:
                log_detailed("warning", "forwarding_engine", "_forward_media_group",
                            "⚠️ Template returned None, using original caption")

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
                    # ✅ CRITICAL FIX: Use combined_caption (with template) NOT processed_caption (summary only)
                    final_caption = f'{combined_caption}\n\n📰 <a href="{telegraph_url}">اقرأ كامل الخبر</a>'
                    log_detailed("info", "forwarding_engine", "_forward_media_group", "✅ Added Telegraph link to album caption (with template applied)", {
                        "caption_with_template": len(combined_caption),
                        "final_caption": len(final_caption)
                    })

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

    async def _apply_summarization_rules(self, text: str, task_id: int) -> str:
        """
        ✅ FIXED: Apply user-defined summarization rules to summary text
        Rules support: maxLength, style, keyPointsCount
        """
        try:
            if not text:
                return text
            
            # Get summarization rules for this task
            ai_rules = await db.get_task_rules(task_id)
            if not ai_rules:
                return text
            
            # Convert Row objects to dicts and filter
            summarization_rules = []
            for r in ai_rules:
                # Convert Row to dict if needed
                rule_dict = dict(r) if hasattr(r, '__iter__') and not isinstance(r, dict) else r
                if isinstance(rule_dict, dict) and rule_dict.get('type') == 'summarize' and rule_dict.get('is_active'):
                    summarization_rules.append(rule_dict)
            
            if not summarization_rules:
                log_detailed("debug", "forwarding_engine", "_apply_summarization_rules", "No active summarization rules found")
                return text
            
            # Apply each active rule sorted by priority
            processed_text = text
            original_length = len(text)
            
            for rule in sorted(summarization_rules, key=lambda r: r.get('priority', 0), reverse=True):
                rule_name = rule.get('name', 'Unknown')
                rule_config = rule.get('config', {})
                
                # Parse config if it's a string (JSON)
                if isinstance(rule_config, str):
                    try:
                        import json
                        rule_config = json.loads(rule_config)
                    except:
                        rule_config = {}
                
                # Extract all config options
                max_length = rule_config.get('maxLength') or rule_config.get('max_length')
                style = rule_config.get('style', 'balanced')
                key_points = rule_config.get('keyPointsCount', 0)
                
                log_detailed("debug", "forwarding_engine", "_apply_summarization_rules",
                            f"📋 Processing rule: {rule_name}", {
                                "max_length": max_length,
                                "style": style,
                                "key_points": key_points,
                                "current_text_length": len(processed_text)
                            })
                
                # ✅ FIXED: Apply max_length truncation ONLY if specified
                if max_length and isinstance(max_length, (int, float)) and max_length > 0:
                    if len(processed_text) > max_length:
                        # Truncate to max_length, but try to end at a word boundary
                        processed_text = processed_text[:int(max_length)].rsplit(' ', 1)[0]
                        if not processed_text.endswith(('...', '،', '.', '؟')):
                            processed_text += '...'
                        
                        log_detailed("info", "forwarding_engine", "_apply_summarization_rules",
                                    f"✅ Applied max_length truncation: {rule_name}", {
                                        "original_length": original_length,
                                        "max_length_rule": max_length,
                                        "processed_length": len(processed_text),
                                        "reduction": f"{100 - (len(processed_text) * 100 // original_length)}%" if original_length > 0 else "0%"
                                    })
            
            return processed_text
            
        except Exception as e:
            log_detailed("warning", "forwarding_engine", "_apply_summarization_rules",
                        f"Error applying summarization rules: {str(e)}")
            return text

    def _apply_formatting(self, text: str, formatting: str) -> str:
        """
        Apply Telegram HTML entity formatting to text
        Supported: bold, italic, code, quote, spoiler, strikethrough, underline, none
        Uses HTML format for full compatibility with Telegram
        """
        if not text or formatting == "none":
            return text

        formatting_map = {
            "bold": f"<b>{text}</b>",
            "italic": f"<i>{text}</i>",
            "code": f"<code>{text}</code>",
            "spoiler": f"<tg-spoiler>{text}</tg-spoiler>",
            "strikethrough": f"<s>{text}</s>",
            "underline": f"<u>{text}</u>",
            "quote": f"<blockquote>{text}</blockquote>",
        }

        return formatting_map.get(formatting, text)

    def _parse_html_to_entities(self, html_text: str) -> tuple:
        """
        Parse HTML text and create MessageEntity objects for formatting.
        Pyrogram's HTML parser doesn't fully support all tags (especially blockquote),
        so we manually parse and create entities.

        Returns: (plain_text, list of MessageEntity)
        """
        import re
        from pyrogram.types import MessageEntity

        # Tag patterns with their entity types
        tag_patterns = [
            (r'<blockquote>(.*?)</blockquote>', MessageEntityType.BLOCKQUOTE),
            (r'<b>(.*?)</b>', MessageEntityType.BOLD),
            (r'<strong>(.*?)</strong>', MessageEntityType.BOLD),
            (r'<i>(.*?)</i>', MessageEntityType.ITALIC),
            (r'<em>(.*?)</em>', MessageEntityType.ITALIC),
            (r'<u>(.*?)</u>', MessageEntityType.UNDERLINE),
            (r'<s>(.*?)</s>', MessageEntityType.STRIKETHROUGH),
            (r'<code>(.*?)</code>', MessageEntityType.CODE),
            (r'<tg-spoiler>(.*?)</tg-spoiler>', MessageEntityType.SPOILER),
        ]

        # Link pattern is special - needs to extract href
        link_pattern = r'<a href="([^"]+)">([^<]+)</a>'

        entities = []
        plain_text = html_text

        # First pass: collect all tags with their positions in original text
        tag_info = []

        # Process regular tags
        for pattern, entity_type in tag_patterns:
            for match in re.finditer(pattern, html_text, re.DOTALL):
                tag_info.append({
                    'full_match': match.group(0),
                    'content': match.group(1),
                    'entity_type': entity_type,
                    'start': match.start(),
                    'url': None
                })

        # Process links
        for match in re.finditer(link_pattern, html_text, re.DOTALL):
            tag_info.append({
                'full_match': match.group(0),
                'content': match.group(2),  # Link text
                'entity_type': MessageEntityType.TEXT_LINK,
                'start': match.start(),
                'url': match.group(1)  # URL
            })

        # Sort by position in original text
        tag_info.sort(key=lambda x: x['start'])

        # Second pass: build plain text and calculate entity offsets
        current_offset = 0
        offset_adjustment = 0

        for tag in tag_info:
            original_start = tag['start']
            tag_full = tag['full_match']
            content = tag['content']

            # Calculate the adjusted offset in plain text
            adjusted_start = original_start - offset_adjustment

            # Create entity
            if tag['entity_type'] == MessageEntityType.TEXT_LINK:
                entity = MessageEntity(
                    type=tag['entity_type'],
                    offset=adjusted_start,
                    length=len(content),
                    url=tag['url']
                )
            else:
                entity = MessageEntity(
                    type=tag['entity_type'],
                    offset=adjusted_start,
                    length=len(content)
                )
            entities.append(entity)

            # Update offset adjustment (difference between full tag and content)
            offset_adjustment += len(tag_full) - len(content)

        # Remove all HTML tags from text
        plain_text = html_text
        for pattern, _ in tag_patterns:
            plain_text = re.sub(pattern, r'\1', plain_text, flags=re.DOTALL)
        plain_text = re.sub(link_pattern, r'\2', plain_text, flags=re.DOTALL)

        # Recalculate entity offsets after all substitutions
        entities_final = []
        for tag in tag_info:
            # Find the content position in the final plain text
            content = tag['content']

            # Search for content, considering it might appear multiple times
            # Use approximate position based on original position ratio
            approx_pos = int(tag['start'] * len(plain_text) / len(html_text)) if len(html_text) > 0 else 0

            # Search nearby the approximate position
            search_start = max(0, approx_pos - len(content) - 50)
            search_end = min(len(plain_text), approx_pos + len(content) + 50)

            search_region = plain_text[search_start:search_end]
            pos_in_region = search_region.find(content)

            if pos_in_region >= 0:
                actual_offset = search_start + pos_in_region
            else:
                # Fallback: search in entire text
                actual_offset = plain_text.find(content)
                if actual_offset < 0:
                    continue  # Skip if content not found

            if tag['entity_type'] == MessageEntityType.TEXT_LINK:
                entity = MessageEntity(
                    type=tag['entity_type'],
                    offset=actual_offset,
                    length=len(content),
                    url=tag['url']
                )
            else:
                entity = MessageEntity(
                    type=tag['entity_type'],
                    offset=actual_offset,
                    length=len(content)
                )
            entities_final.append(entity)

        log_detailed("debug", "forwarding_engine", "_parse_html_to_entities",
                    f"Parsed HTML to entities", {
                        "html_length": len(html_text),
                        "plain_length": len(plain_text),
                        "entities_count": len(entities_final),
                        "entity_types": [str(e.type) for e in entities_final]
                    })

        return plain_text, entities_final

    def _escape_html(self, text: str) -> str:
        """Escape HTML special characters"""
        if not text:
            return text
        return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    async def _extract_fields_with_ai(
        self,
        text: str,
        task_id: int,
        provider_name: str,
        model_name: str,
        fields: List[Dict[str, Any]],
        serial_number: Optional[int] = None,
        processed_text: Optional[str] = None,
        original_text: Optional[str] = None,
        video_metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Extract custom fields using AI based on template field definitions
        Uses original_text for extraction if provided, falls back to text otherwise
        
        Args:
            text: Main text for extraction
            task_id: Task ID
            provider_name: AI provider name
            model_name: AI model name
            fields: List of fields to extract
            serial_number: Optional serial number
            processed_text: Processed/summarized text for summary fields
            original_text: Original text for field extraction
            video_metadata: Optional video metadata (title, description, uploader, platform)
        """
        extracted = {}

        # Always add serial number FIRST (unified field name)
        if serial_number is not None:
            extracted["serial_number"] = serial_number
            log_detailed("debug", "forwarding_engine", "_extract_fields_with_ai",
                        f"Set serial number: {serial_number}")

        if not fields:
            return extracted

        # Separate fields that need AI extraction from auto-populated ones
        fields_to_extract = []

        for field in fields:
            field_type = field.get("field_type", "extracted")
            field_name = field.get("field_name", "")

            if field_type == "summary" or field_type == "content":
                # ✅ FIX: Summary/Content MUST use processed_text (AI-summarized), NEVER original
                # This is the critical fix to prevent original caption from appearing in summary field
                if processed_text:
                    summary_text = processed_text
                    log_detailed("info", "forwarding_engine", "_extract_fields_with_ai",
                                f"✅ Using AI-processed text for {field_type}: {field_name} ({len(summary_text)} chars)")
                else:
                    # Fallback to text only if processed_text not available
                    summary_text = text
                    log_detailed("warning", "forwarding_engine", "_extract_fields_with_ai",
                                f"⚠️ No processed_text available, using original text for {field_type}: {field_name}")
                extracted[field_name] = summary_text
            elif field_type == "date_today":
                # Use today's date
                extracted[field_name] = datetime.now().strftime("%Y-%m-%d")
                log_detailed("debug", "forwarding_engine", "_extract_fields_with_ai",
                            f"Set date field: {field_name} = {extracted[field_name]}")
            elif field_type == "date_time":
                # Use current date and time
                extracted[field_name] = datetime.now().strftime("%Y-%m-%d %H:%M")
                log_detailed("debug", "forwarding_engine", "_extract_fields_with_ai",
                            f"Set datetime field: {field_name} = {extracted[field_name]}")
            elif field_type == "static":
                # Use default value as static
                extracted[field_name] = field.get("default_value", "")
                log_detailed("debug", "forwarding_engine", "_extract_fields_with_ai",
                            f"Set static field: {field_name} = {extracted[field_name]}")
            elif field_type == "extracted":
                # ✅ FIXED: Only use default if use_default_if_empty is true AND field is empty after AI extraction
                # Always add to AI extraction queue FIRST
                fields_to_extract.append(field)

        # Extract fields using AI if needed
        if fields_to_extract and ai_manager:
            try:
                # Build extraction prompt with clear field instructions
                fields_prompt = ""
                json_fields = {}
                
                for f in fields_to_extract:
                    field_name = f.get('field_name', '')
                    instructions = f.get('extraction_instructions', '').strip()
                    default_val = f.get('default_value', '')
                    
                    # Add default value hint to instructions
                    if default_val:
                        fields_prompt += f"\n• {field_name}:\n  {instructions}\n  (القيمة الافتراضية إذا لم تجد: {default_val})\n"
                    else:
                        fields_prompt += f"\n• {field_name}:\n  {instructions}\n"
                    json_fields[field_name] = "القيمة المستخرجة"
                
                # Create JSON template for response
                json_template = "{\n" + ",\n".join([f'  "{k}": "{v}"' for k, v in json_fields.items()]) + "\n}"

                # Use original_text for extraction if available (it has more details), fallback to text
                extraction_source_text = original_text if original_text else text
                
                # ✅ FIX: Build video metadata section if available
                video_metadata_section = ""
                if video_metadata:
                    metadata_parts = []
                    if video_metadata.get('title'):
                        metadata_parts.append(f"عنوان الفيديو: {video_metadata['title']}")
                    if video_metadata.get('uploader'):
                        metadata_parts.append(f"صاحب الفيديو/القناة: {video_metadata['uploader']}")
                    if video_metadata.get('channel'):
                        metadata_parts.append(f"اسم القناة: {video_metadata['channel']}")
                    if video_metadata.get('platform'):
                        metadata_parts.append(f"المنصة: {video_metadata['platform']}")
                    if video_metadata.get('description'):
                        desc = video_metadata['description'][:500]  # Limit description
                        metadata_parts.append(f"وصف الفيديو: {desc}")
                    
                    if metadata_parts:
                        video_metadata_section = "\n\n📹 معلومات الفيديو الإضافية:\n" + "\n".join(metadata_parts)
                
                extraction_prompt = f"""أنت متخصص في استخراج المعلومات من النصوص العربية والفيديوهات. قم بقراءة المحتوى التالي بعناية واستخرج المعلومات المطلوبة بدقة.

الحقول المطلوب استخراجها وتعليمات الاستخراج:
{fields_prompt}

📄 المحتوى المراد استخراج المعلومات منه:
---
{extraction_source_text}
---{video_metadata_section}

أجب بـ JSON فقط بدون أي نص إضافي أو شرح. استخدم هذا التنسيق بالضبط:
{json_template}

⚠️ تعليمات مهمة جداً:
1. ابحث في العنوان والوصف ومحتوى الفيديو معاً للعثور على المعلومات
2. استخرج القيم بناءً على تعليمات كل حقل بدقة
3. إذا وجدت القيمة في أي مكان (العنوان، الوصف، أو المحتوى)، استخرجها
4. ابحث عن الكلمات المفتاحية بعناية:
   * "المصدر": اسم القناة، صاحب الفيديو، المنصة، أو أي مصدر مذكور
   * "المحافظة": أسماء المحافظات والمدن العراقية (بغداد، الموصل، البصرة، كربلاء، النجف، الأنبار، صلاح الدين، ديالى، كركوك، ذي قار، واسط، ميسان، المثنى، القادسية، بابل، السليمانية، أربيل، دهوك، نينوى، النجف، إلخ)
   * "التصنيف": نوع الخبر (سياسي، رياضي، ثقافي، اقتصادي، اجتماعي، أمني، صحي، تعليمي، فني، ديني، إلخ)
   * "نوع_الخبر": شكل المحتوى (خبر، تحليل، تقرير، مقال، مقابلة، تصريح، بيان، إلخ)
5. إذا كان العنوان أو الوصف يحتوي على اسم مدينة/محافظة، استخدمها للحقل "المحافظة"
6. إذا كان هناك اسم قناة أو صاحب فيديو، استخدمه للحقل "المصدر"
7. حلل موضوع المحتوى لتحديد "التصنيف" و"نوع_الخبر"
8. إذا لم تجد قيمة بعد البحث الشامل، استخدم القيمة الافتراضية إذا ذُكرت، وإلا اترك الحقل بقيمة فارغة ""
9. تأكد من أن الـ JSON صحيح ويمكن فحصه
10. لا تضف أي تفسيرات أو نصوص إضافية"""

                # ✅ FIX: Use the provider/model passed to the function directly instead of re-fetching
                # This avoids redundant database calls and ensures consistency
                provider_name_for_ai = provider_name
                model_name_for_ai = model_name
                
                if not provider_name_for_ai or not model_name_for_ai:
                    log_detailed("error", "forwarding_engine", "_extract_fields_with_ai", 
                                "❌ No AI provider/model configured for field extraction")
                    # ✅ FIX: Return extracted (not extracted_data) and use defaults
                    for field in fields_to_extract:
                        field_name = field.get("field_name", "")
                        default_value = field.get("default_value", "")
                        if default_value:
                            extracted[field_name] = default_value
                            log_detailed("debug", "forwarding_engine", "_extract_fields_with_ai",
                                        f"Using default for {field_name}: {default_value}")
                        else:
                            extracted[field_name] = ""
                    return extracted

                # Call AI to extract fields - use generate method (not generate_text)
                log_detailed("debug", "forwarding_engine", "_extract_fields_with_ai",
                            f"Extracting fields with {provider_name_for_ai}/{model_name_for_ai}", {
                                "fields_count": len(fields_to_extract),
                                "prompt_length": len(extraction_prompt)
                            })

                ai_response = await ai_manager.generate(
                    provider=provider_name_for_ai,
                    model=model_name_for_ai,
                    prompt=extraction_prompt,
                    max_tokens=8000,
                    temperature=0.1
                )

                if ai_response:
                    # Parse JSON response
                    import json
                    import re

                    log_detailed("debug", "forwarding_engine", "_extract_fields_with_ai",
                                f"AI response received", {"response_length": len(ai_response), "response_preview": ai_response[:500]})

                    # Try to extract JSON from response - use greedy match for nested objects
                    json_match = re.search(r'\{[\s\S]*\}', ai_response, re.DOTALL)
                    if json_match:
                        try:
                            ai_extracted = json.loads(json_match.group())
                            log_detailed("info", "forwarding_engine", "_extract_fields_with_ai",
                                        f"AI extracted fields", {"ai_extracted": ai_extracted})
                            for field in fields_to_extract:
                                field_name = field.get("field_name", "")
                                default_value = field.get("default_value", "")
                                use_default = field.get("use_default_if_empty", True)
                                
                                if field_name in ai_extracted:
                                    # Get the value from AI response
                                    extracted_value = ai_extracted[field_name]
                                    # Check if value is not empty
                                    if extracted_value and str(extracted_value).strip():
                                        extracted[field_name] = str(extracted_value).strip()
                                        log_detailed("debug", "forwarding_engine", "_extract_fields_with_ai",
                                                    f"Field {field_name}: Using AI value: {extracted_value}")
                                    else:
                                        # Value is empty, use default if available
                                        if use_default and default_value:
                                            extracted[field_name] = default_value
                                            log_detailed("debug", "forwarding_engine", "_extract_fields_with_ai",
                                                        f"Field {field_name}: AI returned empty, using default: {default_value}")
                                        else:
                                            extracted[field_name] = ""
                                            log_detailed("debug", "forwarding_engine", "_extract_fields_with_ai",
                                                        f"Field {field_name}: AI returned empty, no default")
                                else:
                                    # Field not in AI response, use default
                                    if use_default and default_value:
                                        extracted[field_name] = default_value
                                        log_detailed("debug", "forwarding_engine", "_extract_fields_with_ai",
                                                    f"Field {field_name}: Not in AI response, using default: {default_value}")
                                    else:
                                        extracted[field_name] = ""
                                        log_detailed("debug", "forwarding_engine", "_extract_fields_with_ai",
                                                    f"Field {field_name}: Not in AI response, no default")
                            log_detailed("info", "forwarding_engine", "_extract_fields_with_ai",
                                        f"Final extracted fields", {"extracted": extracted})
                        except json.JSONDecodeError as je:
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

        # ✅ ENSURE SUMMARY FIELDS ARE ALWAYS POPULATED if processed_text available
        if processed_text:
            # Check if we have any summary fields in the template
            for field in fields:
                field_type = field.get("field_type", "")
                field_name = field.get("field_name", "")
                if field_type == "summary" or field_type == "content":
                    if field_name not in extracted:
                        extracted[field_name] = processed_text
                        log_detailed("debug", "forwarding_engine", "_extract_fields_with_ai",
                                    f"✅ Fallback: Assigned processed_text to {field_name}")

        return extracted

    async def _apply_publishing_template(
        self,
        text: str,
        task_id: int,
        extracted_data: Optional[Dict[str, Any]] = None,
        original_text: Optional[str] = None
    ) -> Tuple[str, Dict[str, Any]]:
        """
        Apply publishing template to format the output with custom fields and formatting
        Args:
            text: The processed/summarized text (used for summary field)
            task_id: Task ID
            extracted_data: Pre-extracted data like serial number
            original_text: The original text before summarization (used for field extraction like source, classification)
        Returns: (formatted_text, extracted_data_dict)
        """
        try:
            template = await db.get_default_template_with_fields(task_id)

            if not template:
                log_detailed("debug", "forwarding_engine", "_apply_publishing_template",
                            f"No template found for task {task_id}, returning original text")
                return (text, extracted_data or {})
            
            # ✅ CHECK IF TEMPLATE IS ENABLED - CRITICAL FIX
            template_active = template.get("is_active", True)
            template_name = template.get("name", "Unknown")
            
            if not template_active:
                log_detailed("info", "forwarding_engine", "_apply_publishing_template",
                            f"⛔ SKIPPING DISABLED TEMPLATE '{template_name}' (is_active=false)")
                return (text, extracted_data or {})

            # ✅ FIX: Load fields from EITHER "fields" OR "custom_fields" key
            custom_fields = template.get("fields", []) or template.get("custom_fields", [])
            
            log_detailed("info", "forwarding_engine", "_apply_publishing_template",
                        f"📋 Loaded {len(custom_fields)} template fields for combined extraction")
            
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
                # Check if any fields require AI extraction
                fields_need_ai = any(f.get("field_type") == "extracted" for f in custom_fields)
                
                provider_name = None
                model_name = None
                
                # Only check for AI provider/model if we have fields that need extraction
                if fields_need_ai:
                    task_config = await db.get_task(task_id)
                    provider_id = task_config.get("summarization_provider_id") if task_config else None
                    model_id = task_config.get("summarization_model_id") if task_config else None

                    if provider_id:
                        provider_info = await db.get_ai_provider(provider_id)
                        if provider_info:
                            provider_name = provider_info["name"]

                    if model_id:
                        model_info = await db.get_ai_model(model_id)
                        if model_info:
                            model_name = model_info.get("name") or model_info.get("model_name")
                    
                    if not provider_name or not model_name:
                        log_detailed("error", "forwarding_engine", "_apply_publishing_template", "No AI provider/model configured for field extraction")
                        # Still continue with non-extracted fields (summary, date_today, static)
                        provider_name = None
                        model_name = None

                # Get serial number from extracted_data
                current_serial = None
                if extracted_data:
                    current_serial = extracted_data.get("serial_number")
                
                log_detailed("debug", "forwarding_engine", "_apply_publishing_template",
                            f"Extracted serial from data: {current_serial}", {
                                "extracted_data_keys": list(extracted_data.keys()) if extracted_data else []
                            })
                
                # Check if fields were already extracted by pipeline (combined extraction)
                # This skips the second AI call if fields are already present
                fields_already_extracted = False
                if extracted_data:
                    # Check if we have any of the custom fields already
                    for field in custom_fields:
                        field_name = field.get("field_name", "")
                        if field_name and field_name in extracted_data and extracted_data[field_name]:
                            fields_already_extracted = True
                            break
                
                if fields_already_extracted:
                    log_detailed("info", "forwarding_engine", "_apply_publishing_template",
                                f"✅ Using pre-extracted fields from pipeline (skipping second AI call)", {
                                    "existing_fields": list(extracted_data.keys())
                                })
                    # Just ensure summary and serial are properly set
                    if "التلخيص" not in extracted_data and text:
                        extracted_data["التلخيص"] = text
                    if current_serial is not None:
                        extracted_data["serial_number"] = current_serial
                else:
                    # Extract new fields with AI (fallback for non-combined extraction)
                    extraction_text = original_text if original_text else text
                    log_detailed("info", "forwarding_engine", "_apply_publishing_template",
                                f"📋 Using {'original' if original_text else 'summarized'} text for field extraction", {
                                    "extraction_text_length": len(extraction_text),
                                    "summary_text_length": len(text)
                                })
                    
                    new_extracted = await self._extract_fields_with_ai(
                        extraction_text,  # Fallback text
                        task_id,
                        provider_name,
                        model_name,
                        custom_fields,
                        serial_number=current_serial,
                        processed_text=text,  # Use summarized text for summary field
                        original_text=extraction_text  # Use original text for field extraction
                    )
                    
                    # Merge with existing extracted_data instead of replacing
                    if extracted_data:
                        extracted_data.update(new_extracted)
                    else:
                        extracted_data = new_extracted
                
                # Double-check serial number is present
                if current_serial is not None:
                    val_str = str(current_serial).strip()
                    if val_str and val_str != "0":
                        extracted_data["serial_number"] = val_str
                        log_detailed("debug", "forwarding_engine", "_apply_publishing_template",
                                    f"Force-set serial in extracted_data: {val_str}")
                    else:
                        extracted_data["serial_number"] = ""
            else:
                extracted_data = extracted_data or {}
                # Ensure at least the summary is present if no custom fields
                if "summary" not in extracted_data:
                    extracted_data["summary"] = text
            
            # Double-check serial number is in extracted_data
            if extracted_data and "serial_number" not in extracted_data:
                # This should not happen, but as a safety measure
                log_detailed("warning", "forwarding_engine", "_apply_publishing_template",
                            "Serial number missing from extracted_data, this should not happen!")
                extracted_data["serial_number"] = 0

            result_parts = []

            # Add header if exists
            if header_text:
                formatted_header = self._apply_formatting(header_text.strip(), header_formatting)
                result_parts.append(formatted_header)
                if use_newline_after_header:
                    result_parts.append("")

            # ✅ LOG SUMMARY: Verify summary/التلخيص is in extracted_data BEFORE building template
            if extracted_data:
                has_summary = extracted_data.get("التلخيص") or extracted_data.get("summary")
                if has_summary:
                    log_detailed("info", "forwarding_engine", "_apply_publishing_template",
                                f"✅ Summary field present in extracted_data: {len(has_summary)} chars")
                else:
                    log_detailed("warning", "forwarding_engine", "_apply_publishing_template",
                                f"⚠️ WARNING: Summary field NOT found in extracted_data! Keys: {list(extracted_data.keys())}")
            
            # Add custom fields in order
            field_parts = []
            log_detailed("debug", "forwarding_engine", "_apply_publishing_template",
                        f"Starting to process {len(custom_fields)} fields", {
                            "extracted_data_keys": list(extracted_data.keys()) if extracted_data else []
                        })
            for field in custom_fields:
                field_name = field.get("field_name", "")
                field_label = field.get("field_label", "")
                formatting = field.get("formatting", "none")
                show_label = field.get("show_label", True)  # ✅ FIX: Default to True so labels SHOW
                label_separator = field.get("label_separator", ": ")
                prefix = field.get("prefix", "") or ""
                suffix = field.get("suffix", "") or ""
                is_active = field.get("is_active", True)

                # Skip inactive fields
                if not is_active:
                    continue

                # Get field type to handle special types
                field_type = field.get("field_type", "extracted")
                
                # Handle special field types FIRST
                if field_type == "date_today":
                    # Generate current date in Arabic-friendly format
                    from datetime import datetime
                    value = datetime.now().strftime("%Y-%m-%d")
                elif field_type == "summary":
                    # ✅ CRITICAL FIX: Summary fields MUST use extracted_data which has processed text
                    # Try both Arabic and English names for summary field
                    value = (extracted_data.get(field_name, "") or 
                             extracted_data.get("التلخيص", "") or 
                             extracted_data.get("summary", "") if extracted_data else "")
                    
                    if not value:
                        # Fallback only if not in extracted_data
                        value = text if text else ""
                        log_detailed("warning", "forwarding_engine", "_apply_publishing_template",
                                    f"⚠️ Summary field '{field_name}' NOT in extracted_data, fallback to text: {len(value)} chars")
                    else:
                        log_detailed("info", "forwarding_engine", "_apply_publishing_template",
                                    f"✅ Summary field '{field_name}' using extracted value: {len(value)} chars")
                elif field_type == "static":
                    # ✅ FIXED: For static fields, ALWAYS use default_value (never from extracted_data)
                    # Exception: Serial number can come from extracted_data
                    if field_name in ["serial_number", "رقم_القيد", "record_number", "رقم_القيد_"]:
                        # Try all possible keys for serial number
                        current_val = ""
                        if extracted_data is not None:
                            # Try Arabic field name variants
                            current_val = (extracted_data.get("رقم_القيد") or 
                                           extracted_data.get("رقم_القيد_") or 
                                           extracted_data.get("serial_number") or
                                           extracted_data.get("record_number") or "")
                        
                        # Clean the value and ensure # prefix
                        if current_val and str(current_val).strip() not in ["", "0", "---", "-"]:
                            val_str = str(current_val).strip()
                            if val_str and not val_str.startswith("#"):
                                value = f"#{val_str}"
                            else:
                                value = val_str
                        else:
                            # Last resort fallback if extracted_data somehow lost it or has placeholder
                            value = field.get("default_value", "")
                            if value in ["0", "---", "-"]: value = ""
                            
                        log_detailed("debug", "forwarding_engine", "_apply_publishing_template", f"📌 Serial field '{field_name}' resolved to: {value}")
                    else:
                        # For all other static fields, use default_value ONLY
                        value = field.get("default_value", "")
                else:
                    # For 'extracted' type - get from extracted_data
                    value = extracted_data.get(field_name, "")
                    # Fallback to default if no value
                    if not value and field.get("use_default_if_empty"):
                        value = field.get("default_value", "")

                # Log field extraction status
                log_detailed("debug", "forwarding_engine", "_apply_publishing_template",
                            f"Processing field: {field_name}", {
                                "has_value": bool(value),
                                "value_preview": str(value)[:50] if value else "empty",
                                "field_type": field.get("field_type", "extracted"),
                                "use_default_if_empty": field.get("use_default_if_empty"),
                                "is_active": is_active
                            })

                # Add ALL active fields, even if empty (unless completely missing)
                # The field should appear if it's active, regardless of value
                if is_active:
                    # Convert to string and apply formatting
                    formatted_value = self._apply_formatting(str(value), formatting) if value else ""

                    log_detailed("debug", "forwarding_engine", "_apply_publishing_template",
                                f"Field formatted: {field_name}", {
                                    "formatting": formatting,
                                    "original_length": len(str(value)) if value else 0,
                                    "formatted_length": len(formatted_value),
                                    "has_html_tags": any(tag in formatted_value for tag in ['<b>', '<i>', '<blockquote>']),
                                    "formatted_preview": formatted_value[:100] if len(formatted_value) > 100 else formatted_value
                                })

                    # Build the field text (don't strip - preserves formatting)
                    if show_label and field_label:
                        field_text = f"{field_label}{label_separator}{prefix}{formatted_value}{suffix}"
                    else:
                        field_text = f"{prefix}{formatted_value}{suffix}"

                    # Always add the field if it's active (show_label determines if we include label)
                    field_parts.append(field_text)

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
                            "extracted_count": len(extracted_data),
                            "field_parts_count": len(field_parts),
                            "result_parts_count": len(result_parts),
                            "result_preview": result[:200] if result else "EMPTY"
                        })

            return (result, extracted_data)

        except Exception as e:
            log_detailed("error", "forwarding_engine", "_apply_publishing_template",
                        f"Template error: {str(e)}", {"traceback": traceback.format_exc()})
            return (text, extracted_data or {})

    async def _process_message(
        self,
        message: Message,
        task_id: int,
        task_config: Dict[str, Any],
        task_logger: TaskLogger,
        serial_number: Optional[int] = None
    ) -> Optional[Tuple[Optional[str], Dict[str, Any]]]:
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
                extracted = {"serial_number": serial_number} if serial_number else {}
                return (None, extracted) if serial_number else None

            log_detailed("info", "forwarding_engine", "_process_message", f"Text length: {len(text)} chars")

            if (task_config.get("videoProcessingEnabled") or task_config.get("video_processing_enabled")) and message.video:
                log_detailed("info", "forwarding_engine", "_process_message", "Video detected, adding to queue")
                await task_logger.log_info("Video detected, processing...")
                
                # ✅ FIX: Ensure we have a serial number for the video even if it's sent to queue
                if not serial_number:
                    serial_number = await db.get_next_serial_number(task_id)
                    log_detailed("info", "forwarding_engine", "_process_message", f"Assigned serial #{serial_number} for video message")

                # ✅ NEW: If there's a caption AND summarization is enabled, summarize the caption first
                caption_summary = None
                caption_text = message.caption or ""
                if caption_text and task_config.get("summarization_enabled"):
                    log_detailed("info", "forwarding_engine", "_process_message", 
                                f"Caption found ({len(caption_text)} chars), summarizing...")
                    try:
                        # Get summarization provider/model
                        provider_id = task_config.get("summarization_provider_id") or task_config.get("summarizationProviderId")
                        model_id = task_config.get("summarization_model_id") or task_config.get("summarizationModelId")
                        
                        provider_name = None
                        model_name = None
                        
                        if provider_id:
                            provider_info = await db.get_ai_provider(provider_id)
                            if provider_info:
                                provider_name = provider_info["name"]
                        
                        if model_id:
                            model_info = await db.get_ai_model(model_id)
                            if model_info:
                                model_name = model_info.get("name") or model_info.get("model_name")
                        
                        if provider_name and model_name:
                            # Get summarize rules for caption
                            all_rules = await db.get_task_rules(task_id)
                            rules = [r for r in all_rules if r["type"] == "summarize" and r["is_active"]]
                            
                            pipeline_result = await ai_pipeline.process(
                                text=caption_text,
                                task_id=task_id,
                                provider=provider_name,
                                model=model_name,
                                custom_rules=rules
                            )
                            caption_summary = pipeline_result.final_text
                            log_detailed("info", "forwarding_engine", "_process_message", 
                                        f"✅ Caption summary created: {len(caption_summary)} chars")
                        else:
                            log_detailed("warning", "forwarding_engine", "_process_message", 
                                        "No AI provider/model for caption summarization")
                    except Exception as e:
                        log_detailed("error", "forwarding_engine", "_process_message", 
                                    f"Caption summarization error: {str(e)}")
                
                video_provider_id = task_config.get("video_ai_provider_id")
                video_model_id = task_config.get("video_ai_model_id")
                await queue_manager.add_job(
                    "video_process",
                    {
                        "message_id": message.id,
                        "chat_id": message.chat.id,
                        "task_id": task_id,
                        "video_provider_id": video_provider_id,
                        "video_model_id": video_model_id,
                        "caption_text": caption_text,  # ✅ NEW: Pass caption for potential reuse
                        "caption_summary": caption_summary,  # ✅ NEW: Pass pre-summarized caption
                        "serial_number": serial_number # ✅ Pass assigned serial number
                    },
                    task_id=task_id,
                    priority=5
                )
                extracted = {"serial_number": serial_number} if serial_number else {}
                return (None, extracted) if serial_number else None

            # Apply AI Pipeline if AI is enabled (regardless of summarization_enabled)
            # summarization_enabled controls whether to SUMMARIZE, but ai_enabled controls whether to apply AI RULES
            if not task_config.get("ai_enabled"):
                log_detailed("info", "forwarding_engine", "_process_message", "AI not enabled for this task")
                extracted = {"serial_number": serial_number} if serial_number else {}
                return (text, extracted)

            provider_id = task_config.get("summarization_provider_id") or task_config.get("summarizationProviderId")
            model_id = task_config.get("summarization_model_id") or task_config.get("summarizationModelId")

            log_detailed("info", "forwarding_engine", "_process_message", f"Retrieved IDs from task_config", {
                "provider_id": provider_id,
                "model_id": model_id,
                "config_keys": list(task_config.keys())
            })

            provider_name = None
            model_name = None

            if provider_id:
                provider_info = await db.get_ai_provider(provider_id)
                if provider_info:
                    provider_name = provider_info["name"]
                    log_detailed("info", "forwarding_engine", "_process_message", f"✅ Using provider: {provider_name}")
                else:
                    log_detailed("error", "forwarding_engine", "_process_message", f"Provider {provider_id} not found in DB")
            else:
                log_detailed("error", "forwarding_engine", "_process_message", f"No provider_id configured for this task")

            if model_id:
                model_info = await db.get_ai_model(model_id)
                if model_info:
                    model_name = model_info.get("name") or model_info.get("model_name")
                    log_detailed("info", "forwarding_engine", "_process_message", f"✅ Using model: {model_name}")
                else:
                    log_detailed("error", "forwarding_engine", "_process_message", f"Model {model_id} not found in DB")
            else:
                log_detailed("error", "forwarding_engine", "_process_message", f"No model_id configured for this task")

            if not provider_name or not model_name:
                log_detailed("error", "forwarding_engine", "_process_message", "AI processing skipped - no provider/model configured")
                extracted = {"serial_number": serial_number} if serial_number else {}
                return (text, extracted)

            system_prompt = await db.get_setting("default_prompt")
            if system_prompt:
                log_detailed("info", "forwarding_engine", "_process_message", f"Using system prompt: {system_prompt[:80]}...")

            all_rules = await db.get_task_rules(task_id)
            rules = [r for r in all_rules if r["type"] == "summarize" and r["is_active"]]

            log_detailed("info", "forwarding_engine", "_process_message",
                        f"📋 Fetched rules from database", {
                            "total_rules": len(all_rules),
                            "summarization_rules": len(rules),
                            "rule_types": list(set(r.get("type") for r in all_rules))
                        })
            
            for i, rule in enumerate(rules, 1):
                log_detailed("info", "forwarding_engine", "_process_message",
                            f"📌 Rule #{i}: {rule.get('name', 'unnamed')}", {
                                "id": rule.get("id"),
                                "type": rule.get("type"),
                                "priority": rule.get("priority"),
                                "config": str(rule.get("config", {}))[:200]
                            })

            # Get publishing template fields for combined extraction
            fields_to_extract = []
            try:
                template = await db.get_task_publishing_template(task_id)
                if template and template.get("fields"):
                    fields_to_extract = template.get("fields", [])
                    log_detailed("info", "forwarding_engine", "_process_message", 
                                f"📋 Loaded {len(fields_to_extract)} template fields for combined extraction")
            except Exception as e:
                log_detailed("warning", "forwarding_engine", "_process_message", 
                            f"Could not load template fields: {str(e)}")

            log_detailed("info", "forwarding_engine", "_process_message",
                        f"🚀 Starting AI Pipeline processing (combined summarization + extraction)", {
                            "text_input_length": len(text),
                            "rules_count": len(rules),
                            "fields_count": len(fields_to_extract),
                            "provider": provider_name,
                            "model": model_name
                        })

            pipeline_result = await ai_pipeline.process(
                text=text,
                task_id=task_id,
                provider=provider_name,
                model=model_name,
                system_prompt=system_prompt,
                custom_rules=rules,
                fields_to_extract=fields_to_extract,
                serial_number=serial_number
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

            # ✅ NOTE: Summarization rules are now applied in AI Pipeline (post-processing)
            # This ensures rules are applied IMMEDIATELY after AI output, before template

            # NOTE: Publishing template is now applied in _forward_to_target as the LAST step
            # This ensures it works for both AI and non-AI forwarding

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

            # Use extracted fields from pipeline (already includes serial number)
            extracted = pipeline_result.extracted_fields or {}
            if serial_number and "serial_number" not in extracted:
                extracted["serial_number"] = serial_number
            
            # ✅ FIXED: Add PROCESSED (rules-applied) text as summary for template
            if processed_text and "التلخيص" not in extracted:
                extracted["التلخيص"] = processed_text
            
            log_detailed("info", "forwarding_engine", "_process_message", 
                        f"📦 Combined extraction complete | Fields: {len(extracted)}", {
                            "field_names": list(extracted.keys())
                        })
            
            return (processed_text, extracted)

        except Exception as e:
            log_detailed("error", "forwarding_engine", "_process_message", f"AI processing error: {str(e)}", {
                "traceback": traceback.format_exc()
            })
            await task_logger.log_error(f"AI processing error: {str(e)}")
            # Return tuple with serial number on error too
            extracted = {"serial_number": serial_number} if serial_number else {}
            return (text, extracted)

    @handle_errors("forwarding_engine", "forward_to_target")
    async def _forward_to_target(
        self,
        message: Message,
        target_id: int,
        processed_text: Optional[str],
        task_logger: TaskLogger,
        task_id: Optional[int] = None,
        extracted_data: Optional[Dict[str, Any]] = None
    ):
        """Forward message to a single target with full support for all media types and entities"""

        log_detailed("info", "forwarding_engine", "_forward_to_target", f"Forwarding to target {target_id}", {
            "message_id": message.id,
            "has_processed_text": bool(processed_text),
            "task_id": task_id
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

            # ALWAYS apply publishing template as the LAST step (even without AI)
            # This ensures template is applied to ALL forwarded messages
            if task_id and final_text:
                log_detailed("info", "forwarding_engine", "_forward_to_target",
                            "🔧 [TEMPLATE STAGE 1] Starting publishing template application...", {
                                "task_id": task_id,
                                "text_length": len(final_text),
                                "original_text_length": len(original_text),
                                "has_entities": bool(final_entities),
                                "extracted_data": extracted_data
                            })
                # Pass original_text for field extraction (source, classification, etc.)
                # Pass final_text (summarized) for summary field
                template_result = await self._apply_publishing_template(final_text, task_id, extracted_data, original_text=original_text)
                # Unpack the tuple: (formatted_text, extracted_data_dict)
                template_applied_text, extracted_data = template_result if isinstance(template_result, tuple) else (template_result, extracted_data)

                log_detailed("info", "forwarding_engine", "_forward_to_target",
                            "🔧 [TEMPLATE STAGE 2] Template function returned", {
                                "returned_length": len(template_applied_text) if template_applied_text else 0,
                                "is_empty": not template_applied_text,
                                "is_same_as_input": template_applied_text == final_text,
                                "has_html_formatting": any(tag in (template_applied_text or "") for tag in ['<b>', '<i>', '<blockquote>', '<u>', '<s>', '<a href=']),
                                "preview": (template_applied_text or "")[:150],
                                "extracted_data_updated": True
                            })

                if template_applied_text and template_applied_text != final_text:
                    final_text = template_applied_text
                    final_entities = None  # Reset entities since text was modified by template
                    log_detailed("info", "forwarding_engine", "_forward_to_target",
                                "✅ [TEMPLATE STAGE 3] Template applied successfully", {
                                    "original_length": len(original_text),
                                    "template_length": len(final_text),
                                    "has_html_formatting": any(tag in final_text for tag in ['<b>', '<i>', '<blockquote>', '<u>', '<s>']),
                                    "entities_reset": True
                                })
                elif not template_applied_text:
                    log_detailed("warning", "forwarding_engine", "_forward_to_target",
                                "⚠️ [TEMPLATE STAGE 3] Template returned empty result")
                else:
                    log_detailed("debug", "forwarding_engine", "_forward_to_target",
                                "ℹ️ [TEMPLATE STAGE 3] Template returned same text (no changes)")

            # Create Telegraph page if text was processed
            telegraph_url = None
            if use_processed and original_text:
                log_detailed("info", "forwarding_engine", "_forward_to_target",
                            "🔗 [TELEGRAPH STAGE 1] Starting Telegraph page creation")

                # Collect media
                photos_ids = [message.photo.file_id] if message.photo else []
                videos_info = [{'file_id': message.video.file_id, 'title': 'فيديو'} if message.video else None]
                videos_info = [v for v in videos_info if v]

                # Create download wrapper
                async def download_wrapper(fid):
                    try:
                        result = await self.client.download_media(fid)
                        log_detailed("debug", "forwarding_engine", "_forward_to_target",
                                    "Downloaded media", {"path": result})
                        return result
                    except Exception as e:
                        log_detailed("warning", "forwarding_engine", "_forward_to_target",
                                    f"Media download failed: {str(e)[:60]}")
                        return None

                telegraph_url = await telegraph_manager.create_original_content_page(
                    original_text=original_text,
                    photos_file_ids=photos_ids if photos_ids else None,
                    videos_info=videos_info if videos_info else None,
                    download_func=download_wrapper if (photos_ids or videos_info) else None
                )

                if telegraph_url:
                    log_detailed("info", "forwarding_engine", "_forward_to_target",
                                "🔗 [TELEGRAPH STAGE 2] Telegraph page created, adding link")
                    final_text_before_link = final_text
                    final_text = f'{final_text}\n\n📰 <a href="{telegraph_url}">اقرأ كامل الخبر</a>'
                    log_detailed("info", "forwarding_engine", "_forward_to_target",
                                "🔗 [TELEGRAPH STAGE 3] Link added to text", {
                                    "url": telegraph_url,
                                    "text_before_link": len(final_text_before_link),
                                    "text_after_link": len(final_text),
                                    "new_content": final_text[len(final_text_before_link):] if len(final_text) > len(final_text_before_link) else "N/A"
                                })
                else:
                    log_detailed("warning", "forwarding_engine", "_forward_to_target",
                                "⚠️ [TELEGRAPH STAGE 2] Telegraph page creation failed")

            log_detailed("info", "forwarding_engine", "_forward_to_target", "Text processing", {
                "original_length": len(original_text),
                "final_length": len(final_text) if final_text else 0,
                "use_processed": use_processed,
                "has_entities": bool(final_entities)
            })

            # Determine if we should use parse_mode (when template applied) or entities
            use_parse_mode = not final_entities

            # Check if caption has HTML tags for entity parsing
            caption_has_html = any(tag in (final_text or "") for tag in ['<b>', '<i>', '<blockquote>', '<u>', '<s>', '<a href='])

            # Prepare caption entities if HTML present
            caption_plain = final_text
            caption_entities_parsed = None
            if use_parse_mode and caption_has_html and final_text:
                caption_plain, caption_entities_parsed = self._parse_html_to_entities(final_text)

            # Handle different message types with entity preservation
            if message.photo:
                log_detailed("info", "forwarding_engine", "_forward_to_target", "Sending photo...")
                if caption_entities_parsed:
                    await self.client.send_photo(
                        chat_id=target_identifier,
                        photo=message.photo.file_id,
                        caption=caption_plain or "",
                        caption_entities=caption_entities_parsed
                    )
                elif final_entities:
                    await self.client.send_photo(
                        chat_id=target_identifier,
                        photo=message.photo.file_id,
                        caption=final_text or "",
                        caption_entities=final_entities
                    )
                else:
                    await self.client.send_photo(
                        chat_id=target_identifier,
                        photo=message.photo.file_id,
                        caption=final_text or ""
                    )
            elif message.video:
                log_detailed("info", "forwarding_engine", "_forward_to_target", "Sending video...")
                if caption_entities_parsed:
                    await self.client.send_video(
                        chat_id=target_identifier,
                        video=message.video.file_id,
                        caption=caption_plain or "",
                        caption_entities=caption_entities_parsed,
                        duration=message.video.duration,
                        width=message.video.width,
                        height=message.video.height
                    )
                elif final_entities:
                    await self.client.send_video(
                        chat_id=target_identifier,
                        video=message.video.file_id,
                        caption=final_text or "",
                        caption_entities=final_entities,
                        duration=message.video.duration,
                        width=message.video.width,
                        height=message.video.height
                    )
                else:
                    await self.client.send_video(
                        chat_id=target_identifier,
                        video=message.video.file_id,
                        caption=final_text or "",
                        duration=message.video.duration,
                        width=message.video.width,
                        height=message.video.height
                    )
            elif message.animation:
                log_detailed("info", "forwarding_engine", "_forward_to_target", "Sending animation...")
                if caption_entities_parsed:
                    await self.client.send_animation(
                        chat_id=target_identifier,
                        animation=message.animation.file_id,
                        caption=caption_plain or "",
                        caption_entities=caption_entities_parsed
                    )
                elif final_entities:
                    await self.client.send_animation(
                        chat_id=target_identifier,
                        animation=message.animation.file_id,
                        caption=final_text or "",
                        caption_entities=final_entities
                    )
                else:
                    await self.client.send_animation(
                        chat_id=target_identifier,
                        animation=message.animation.file_id,
                        caption=final_text or ""
                    )
            elif message.audio:
                log_detailed("info", "forwarding_engine", "_forward_to_target", "Sending audio...")
                if caption_entities_parsed:
                    await self.client.send_audio(
                        chat_id=target_identifier,
                        audio=message.audio.file_id,
                        caption=caption_plain or "",
                        caption_entities=caption_entities_parsed,
                        duration=message.audio.duration,
                        performer=message.audio.performer,
                        title=message.audio.title
                    )
                elif final_entities:
                    await self.client.send_audio(
                        chat_id=target_identifier,
                        audio=message.audio.file_id,
                        caption=final_text or "",
                        caption_entities=final_entities,
                        duration=message.audio.duration,
                        performer=message.audio.performer,
                        title=message.audio.title
                    )
                else:
                    await self.client.send_audio(
                        chat_id=target_identifier,
                        audio=message.audio.file_id,
                        caption=final_text or "",
                        duration=message.audio.duration,
                        performer=message.audio.performer,
                        title=message.audio.title
                    )
            elif message.voice:
                log_detailed("info", "forwarding_engine", "_forward_to_target", "Sending voice...")
                if caption_entities_parsed:
                    await self.client.send_voice(
                        chat_id=target_identifier,
                        voice=message.voice.file_id,
                        caption=caption_plain or "",
                        caption_entities=caption_entities_parsed,
                        duration=message.voice.duration
                    )
                elif final_entities:
                    await self.client.send_voice(
                        chat_id=target_identifier,
                        voice=message.voice.file_id,
                        caption=final_text or "",
                        caption_entities=final_entities,
                        duration=message.voice.duration
                    )
                else:
                    await self.client.send_voice(
                        chat_id=target_identifier,
                        voice=message.voice.file_id,
                        caption=final_text or "",
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
                if caption_entities_parsed:
                    await self.client.send_document(
                        chat_id=target_identifier,
                        document=message.document.file_id,
                        caption=caption_plain or "",
                        caption_entities=caption_entities_parsed,
                        file_name=message.document.file_name
                    )
                elif final_entities:
                    await self.client.send_document(
                        chat_id=target_identifier,
                        document=message.document.file_id,
                        caption=final_text or "",
                        caption_entities=final_entities,
                        file_name=message.document.file_name
                    )
                else:
                    await self.client.send_document(
                        chat_id=target_identifier,
                        document=message.document.file_id,
                        caption=final_text or "",
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
                # Text message with entities preserved or manually parsed
                has_html = any(tag in final_text for tag in ['<b>', '<i>', '<blockquote>', '<u>', '<s>', '<a href='])

                log_detailed("info", "forwarding_engine", "_forward_to_target",
                            "📤 [SEND STAGE 1] Preparing text message...", {
                                "use_parse_mode": use_parse_mode,
                                "has_html_tags": has_html,
                                "text_length": len(final_text),
                                "text_preview": final_text[:200] if len(final_text) > 200 else final_text
                            })

                if use_parse_mode and has_html:
                    # Use manual entity parsing since Pyrogram doesn't support blockquote in parse_mode
                    plain_text, parsed_entities = self._parse_html_to_entities(final_text)

                    log_detailed("info", "forwarding_engine", "_forward_to_target",
                                "📤 [SEND STAGE 2] Sending with manually parsed entities", {
                                    "chat_id": target_identifier,
                                    "plain_text_length": len(plain_text),
                                    "entities_count": len(parsed_entities),
                                    "entity_types": [str(e.type) for e in parsed_entities],
                                    "plain_text_preview": plain_text[:150]
                                })

                    await self.client.send_message(
                        chat_id=target_identifier,
                        text=plain_text,
                        entities=parsed_entities,
                        disable_web_page_preview=True
                    )
                elif use_parse_mode:
                    # No HTML tags - send plain text
                    log_detailed("info", "forwarding_engine", "_forward_to_target",
                                "📤 [SEND STAGE 2] Sending plain text (no HTML)", {
                                    "chat_id": target_identifier,
                                    "text_length": len(final_text)
                                })
                    await self.client.send_message(
                        chat_id=target_identifier,
                        text=final_text,
                        disable_web_page_preview=True
                    )
                else:
                    log_detailed("info", "forwarding_engine", "_forward_to_target",
                                "📤 [SEND STAGE 2] Sending with original entities", {
                                    "chat_id": target_identifier,
                                    "entities_count": len(final_entities) if final_entities else 0
                                })
                    await self.client.send_message(
                        chat_id=target_identifier,
                        text=final_text,
                        entities=final_entities,
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

    async def _save_to_archive(
        self,
        message: Message,
        task_id: int,
        task_config: Dict[str, Any],
        original_text: str,
        processed_text: str,
        target_channels: List[int],
        extracted_data: Optional[Dict[str, Any]] = None,
        telegraph_url: Optional[str] = None,
        serial_number: Optional[int] = None
    ):
        """Save processed message to archive with serial number"""
        import time
        start_time = time.time()

        try:
            # Use provided serial number or get next one
            if serial_number is None:
                serial_number = await db.get_next_serial_number(task_id)

            log_detailed("info", "forwarding_engine", "_save_to_archive",
                        f"Saving message to archive with serial #{serial_number}", {
                            "task_id": task_id,
                            "message_id": message.id
                        })

            # Get source channel info
            source_channel_title = message.chat.title if message.chat else "Unknown"
            source_channel_id = str(message.chat.id) if message.chat else None

            # Get first target channel info
            target_channel_title = None
            target_channel_id = None
            if target_channels:
                first_target = await db.get_channel(target_channels[0])
                if first_target:
                    target_channel_title = first_target.get("title")
                    target_channel_id = first_target.get("identifier")

            # Extract metadata from extracted_data or text
            classification = None
            news_type = None
            province = None
            specialist = None
            title = None
            summarized_text = processed_text  # Use processed text by default

            if extracted_data:
                classification = extracted_data.get("التصنيف_") or extracted_data.get("التصنيف") or extracted_data.get("classification")
                news_type = extracted_data.get("نوع_الخبر") or extracted_data.get("news_type")
                province = extracted_data.get("المحافظه_") or extracted_data.get("المحافظة") or extracted_data.get("province")
                specialist = extracted_data.get("المختص") or extracted_data.get("specialist")
                title = extracted_data.get("العنوان") or extracted_data.get("title")

            # Apply summarization rule if configured
            try:
                if task_config.get("summarization_rule_id"):
                    rule_info = await db.get_rule(task_config["summarization_rule_id"])
                    if rule_info and rule_info.get("config"):
                        from services.ai_rule_engine import ai_rule_engine
                        rule_result = await ai_rule_engine.apply_summarization_rule(
                            processed_text or original_text,
                            rule_info.get("config"),
                            task_config
                        )
                        if rule_result and rule_result.get("text"):
                            summarized_text = rule_result["text"]
                            log_detailed("info", "forwarding_engine", "_save_to_archive", 
                                       f"Applied summarization rule, text reduced from {len(processed_text or original_text)} to {len(summarized_text)} chars")
            except Exception as summarize_err:
                log_detailed("warning", "forwarding_engine", "_save_to_archive", 
                           f"Summarization rule failed: {str(summarize_err)}, using original text")

            # Generate title using AI if not extracted
            if not title:
                try:
                    # Use AI to generate a proper title
                    from services.ai_providers import ai_manager
                    
                    text_for_title = summarized_text or processed_text or original_text
                    title_prompt = f"""أنت متخصص في كتابة العناوين الإخبارية الاحترافية.
قم بإنشاء عنوان قصير واحترافي (لا يزيد عن 10 كلمات) للنص التالي:

{text_for_title[:800]}

أجب بالعنوان فقط بدون شرح أو تفسير."""
                    
                    # Get AI provider/model from task config
                    provider_name = None
                    model_name = None
                    
                    if task_config.get("summarization_provider_id"):
                        provider_info = await db.get_ai_provider(task_config["summarization_provider_id"])
                        if provider_info:
                            provider_name = provider_info.get("name")
                    
                    if task_config.get("summarization_model_id"):
                        model_info = await db.get_ai_model(task_config["summarization_model_id"])
                        if model_info:
                            model_name = model_info.get("name") or model_info.get("model_name")
                    
                    if not provider_name or not model_name:
                        raise Exception("No AI provider/model configured for this task")
                    
                    generated_title = await ai_manager.generate(
                        provider=provider_name,
                        model=model_name,
                        prompt=title_prompt,
                        max_tokens=100,
                        temperature=0.5
                    )
                    
                    if generated_title:
                        title = generated_title.strip()[:100]  # Limit to 100 chars
                        log_detailed("info", "forwarding_engine", "_save_to_archive", 
                                    f"Generated title using AI: {title[:50]}")
                except Exception as title_err:
                    log_detailed("warning", "forwarding_engine", "_save_to_archive",
                                f"Failed to generate AI title: {str(title_err)}, using fallback")
                    # Fallback: use first line or first 50 chars
                    title = (text_for_title.split('\n')[0] or text_for_title)[:80]

            # Get AI provider/model info
            ai_provider = None
            ai_model = None
            template_name = None

            if task_config.get("summarization_provider_id"):
                provider_info = await db.get_ai_provider(task_config["summarization_provider_id"])
                if provider_info:
                    ai_provider = provider_info.get("name")

            if task_config.get("summarization_model_id"):
                model_info = await db.get_ai_model(task_config["summarization_model_id"])
                if model_info:
                    ai_model = model_info.get("name") or model_info.get("model_name")

            # Get template name
            default_template = await db.get_default_template_with_fields(task_id)
            if default_template:
                template_name = default_template.get("name")

            # Determine media info
            has_media = bool(message.media)
            media_type = None
            media_count = 0

            if message.photo:
                media_type = "photo"
                media_count = 1
            elif message.video:
                media_type = "video"
                media_count = 1
            elif message.document:
                media_type = "document"
                media_count = 1
            elif message.audio:
                media_type = "audio"
                media_count = 1

            # Calculate processing duration
            processing_duration = int((time.time() - start_time) * 1000)

            # Apply publishing template to get the full formatted text with all fields
            # This ensures published_text in archive matches what was actually sent to Telegram
            published_text = processed_text
            try:
                # Ensure extracted_data has serial number
                if extracted_data is None:
                    extracted_data = {}
                extracted_data["serial_number"] = serial_number
                extracted_data["رقم_القيد"] = f"#{serial_number}"
                extracted_data["رقم_القيد_"] = f"#{serial_number}"
                
                # Apply the publishing template to get formatted text with all fields
                template_result = await self._apply_publishing_template(
                    processed_text or original_text,
                    task_id,
                    extracted_data,
                    original_text=original_text
                )
                
                # Unpack the result
                if isinstance(template_result, tuple):
                    formatted_text, updated_extracted_data = template_result
                    extracted_data = updated_extracted_data
                else:
                    formatted_text = template_result
                
                # Use the formatted template text as published_text
                if formatted_text and formatted_text.strip():
                    published_text = formatted_text
                    log_detailed("info", "forwarding_engine", "_save_to_archive",
                                f"Applied publishing template for archive", {
                                    "original_length": len(processed_text or ""),
                                    "formatted_length": len(published_text)
                                })
                else:
                    # Fallback: just add serial number header
                    if published_text:
                        published_text = f"📋 رقم القيد: #{serial_number}\n\n{published_text}"
            except Exception as template_err:
                log_detailed("warning", "forwarding_engine", "_save_to_archive",
                            f"Failed to apply template for archive: {str(template_err)}, using fallback")
                # Fallback: just add serial number header
                if published_text:
                    published_text = f"📋 رقم القيد: #{serial_number}\n\n{published_text}"

            # Create archive entry
            # ✅ FIX: Keep processed_text as pure summary (no source/date/fields)
            # published_text contains the template-formatted output sent to channel
            archive_data = {
                "task_id": task_id,
                "serial_number": serial_number,
                "source_message_id": str(message.id),
                "source_channel_id": source_channel_id,
                "source_channel_title": source_channel_title,
                "target_channel_id": target_channel_id,
                "target_channel_title": target_channel_title,
                "target_message_id": None,  # We don't have this info here
                "title": title,
                "original_text": original_text,
                "processed_text": processed_text,  # Pure summary/AI output - NO fields added
                "published_text": published_text,  # Template applied - includes fields separately
                "telegraph_url": telegraph_url,
                "telegraph_title": title if telegraph_url else None,
                "classification": classification,
                "news_type": news_type,
                "province": province,
                "specialist": specialist,
                "tags": [],
                "extracted_fields": extracted_data or {},
                "has_media": has_media,
                "media_type": media_type,
                "media_count": media_count,
                "media_group_id": message.media_group_id,
                "processing_duration": processing_duration,
                "ai_provider": ai_provider,
                "ai_model": ai_model,
                "template_name": template_name,
                "status": "published"
            }

            archive_id = await db.create_archive_message(archive_data)

            log_detailed("info", "forwarding_engine", "_save_to_archive",
                        f"✅ Message saved to archive", {
                            "archive_id": archive_id,
                            "serial_number": serial_number,
                            "title": title[:50] if title else None,
                            "has_classification": bool(classification),
                            "has_province": bool(province)
                        })

            return archive_id

        except Exception as e:
            log_detailed("error", "forwarding_engine", "_save_to_archive",
                        f"Failed to save to archive: {str(e)}", {
                            "traceback": traceback.format_exc()
                        })
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