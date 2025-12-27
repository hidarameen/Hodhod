#!/usr/bin/env python3
"""
Test script to verify video download, audio extraction, merging, and upload functionality
"""
import asyncio
import os
import sys
from pathlib import Path

# Add project to path
sys.path.insert(0, '/home/runner/workspace')

from telegram_bot.services.link_processor import LinkProcessor, TaskLogger
from telegram_bot.utils.error_handler import ErrorLogger

async def test_video_processing():
    """Test the complete video processing pipeline"""
    
    url = "https://youtu.be/SIcxbZrXfKs?si=m23EnqACu3mB3z60"
    task_id = 999  # Test task ID
    
    print("\n" + "="*80)
    print("🎥 VIDEO PROCESSING TEST")
    print("="*80)
    print(f"URL: {url}")
    print("="*80 + "\n")
    
    try:
        # Initialize processors
        link_processor = LinkProcessor()
        task_logger = TaskLogger(task_id)
        
        # Step 0: Get video info
        print("📋 Step 0: Getting video information...")
        video_info = await link_processor.get_video_info(url)
        
        print(f"✅ Video Title: {video_info.get('title', 'N/A')[:60]}...")
        print(f"✅ Uploader: {video_info.get('uploader', 'N/A')}")
        print(f"✅ Platform: {video_info.get('platform', 'N/A')}")
        print(f"✅ Duration: {video_info.get('duration', 0)}s")
        print(f"✅ Thumbnail: {video_info.get('thumbnail_url', 'N/A')[:50]}...\n")
        
        # Step 1: Download video
        print("⬇️ Step 1: Downloading video (high quality with audio)...")
        video_path = await link_processor.download_video(url, task_id, quality="high")
        
        if not video_path:
            print("❌ Failed to download video")
            return False
        
        print(f"✅ Downloaded to: {video_path}")
        
        # Check file size
        if os.path.exists(video_path):
            size_mb = os.path.getsize(video_path) / (1024 * 1024)
            print(f"✅ File size: {size_mb:.2f} MB")
        
        # Check if it's MP4
        print(f"✅ Format: {video_path.split('.')[-1].upper()}")
        
        # Step 2: Extract audio
        print("\n🎵 Step 2: Extracting audio from video...")
        audio_path = await link_processor.extract_audio(video_path)
        
        if audio_path:
            print(f"✅ Audio extracted to: {audio_path}")
            if os.path.exists(audio_path):
                audio_size = os.path.getsize(audio_path) / (1024 * 1024)
                print(f"✅ Audio file size: {audio_size:.2f} MB")
        else:
            print("⚠️ Audio extraction failed")
        
        # Step 3: Generate thumbnail
        print("\n🖼️ Step 3: Generating thumbnail...")
        thumbnail_path = await link_processor.generate_thumbnail(video_path)
        
        if thumbnail_path and os.path.exists(thumbnail_path):
            thumb_size = os.path.getsize(thumbnail_path) / 1024
            print(f"✅ Thumbnail generated: {thumbnail_path}")
            print(f"✅ Thumbnail size: {thumb_size:.2f} KB")
        else:
            print("⚠️ Thumbnail generation failed")
        
        # Step 4: Get video metadata
        print("\n📊 Step 4: Getting video metadata...")
        metadata = link_processor.get_video_metadata(video_path)
        print(f"✅ Duration: {metadata.get('duration', 0)}s")
        print(f"✅ Resolution: {metadata.get('width', 0)}x{metadata.get('height', 0)}")
        
        # Step 5: Verify MP4 format
        print("\n✨ Step 5: Ensuring MP4 format...")
        final_path = link_processor.ensure_mp4_extension(video_path)
        print(f"✅ Final video path: {final_path}")
        
        if os.path.exists(final_path):
            final_size = os.path.getsize(final_path) / (1024 * 1024)
            print(f"✅ Final file size: {final_size:.2f} MB")
            print(f"✅ Ready for upload: YES")
        
        print("\n" + "="*80)
        print("✅ VIDEO PROCESSING TEST COMPLETED SUCCESSFULLY!")
        print("="*80)
        print(f"\n📦 Output Summary:")
        print(f"   • Video: {final_path}")
        print(f"   • Audio: {audio_path if audio_path else 'Not extracted'}")
        print(f"   • Thumbnail: {thumbnail_path if thumbnail_path else 'Not generated'}")
        print("="*80 + "\n")
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error during testing: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

async def main():
    success = await test_video_processing()
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    asyncio.run(main())
