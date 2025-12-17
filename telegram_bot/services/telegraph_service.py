"""
Telegraph Service - Creates Telegraph pages with comprehensive logging
"""
from typing import Optional, List, Dict, Any, Callable
from telegraph import Telegraph
import os
import traceback
import asyncio
from datetime import datetime

class TelegraphManager:
    def __init__(self):
        print("\n" + "="*100)
        print("[📡 TELEGRAPH] 🚀 Initializing Telegraph Service...")
        print("="*100)
        self.telegraph = Telegraph()
        try:
            acc = self.telegraph.create_account(short_name="NewsBot")
            token = acc.get('access_token', 'unknown')[:20]
            print(f"[📡 TELEGRAPH] ✅ Account ready: {token}...")
        except Exception as e:
            print(f"[📡 TELEGRAPH] ⚠️  Account ready")
        print("="*100 + "\n")
    
    def _extract_url_from_response(self, resp: Any) -> Optional[str]:
        """Helper function to safely extract URL/src from upload response"""
        try:
            # Log response details
            print(f"    [EXTRACT] resp type: {type(resp).__name__}")
            
            # Handle string response (direct URL or path)
            if isinstance(resp, str):
                print(f"    [EXTRACT] String response: {resp[:40]}")
                return resp if (resp.startswith('/') or resp.startswith('http')) else None
            
            # Handle list response - check type first!
            if isinstance(resp, (list, tuple)):
                print(f"    [EXTRACT] List/tuple response, len={len(resp)}")
                if len(resp) == 0:
                    return None
                item = resp[0]
                print(f"    [EXTRACT] First item type: {type(item).__name__}")
                
                # First check if it's a string
                if isinstance(item, str):
                    print(f"    [EXTRACT] String item: {item[:40]}")
                    return item
                
                # Try to get 'src' using safe method
                try:
                    if hasattr(item, 'get') and callable(getattr(item, 'get')):
                        src = item.get('src')
                        print(f"    [EXTRACT] Got src via .get(): {src}")
                        return src
                except Exception as e:
                    print(f"    [EXTRACT] .get() failed: {type(e).__name__}: {str(e)[:40]}")
                
                return None
            
            # Handle dict response
            if isinstance(resp, dict):
                print(f"    [EXTRACT] Dict response, has src={('src' in resp)}")
                return resp.get('src')
            
            print(f"    [EXTRACT] Unknown response type, returning None")
            return None
        except Exception as e:
            import traceback
            print(f"  [⚠️] Response parse error ({type(e).__name__}): {str(e)}")
            print(f"    Full traceback: {traceback.format_exc()[:200]}")
            return None
    
    async def _upload_media(self, file_path: str, media_type: str = "photo") -> Optional[str]:
        """Upload a media file to Telegraph and return the URL using direct HTTP request"""
        import requests
        
        try:
            print(f"  [{media_type.upper()}] Uploading file: {file_path}")
            
            if not os.path.exists(file_path):
                print(f"  [{media_type.upper()}] ❌ File does not exist")
                return None
            
            file_size = os.path.getsize(file_path)
            print(f"  [{media_type.upper()}] File size: {file_size} bytes")
            
            # Use direct HTTP upload to Telegraph API
            with open(file_path, 'rb') as f:
                response = requests.post(
                    'https://telegra.ph/upload',
                    files={'file': ('file', f, 'image/jpeg')}
                )
            
            print(f"  [{media_type.upper()}] HTTP Status: {response.status_code}")
            print(f"  [{media_type.upper()}] Response text: {response.text[:200]}")
            
            if response.status_code != 200:
                print(f"  [{media_type.upper()}] ❌ HTTP error: {response.status_code}")
                return None
            
            # Parse JSON response
            try:
                resp = response.json()
                print(f"  [{media_type.upper()}] JSON response: {resp}")
            except Exception as json_err:
                print(f"  [{media_type.upper()}] ❌ JSON parse error: {json_err}")
                return None
            
            # Handle different response formats
            src = None
            
            # Check for error
            if isinstance(resp, dict) and 'error' in resp:
                print(f"  [{media_type.upper()}] ❌ API error: {resp['error']}")
                return None
            
            # If response is a list
            if isinstance(resp, list) and len(resp) > 0:
                first_item = resp[0]
                print(f"  [{media_type.upper()}] First item: {first_item}")
                
                if isinstance(first_item, dict) and 'src' in first_item:
                    src = first_item['src']
                elif isinstance(first_item, str):
                    src = first_item
            elif isinstance(resp, dict) and 'src' in resp:
                src = resp['src']
            elif isinstance(resp, str):
                src = resp
            
            print(f"  [{media_type.upper()}] Extracted src: {src}")
            
            if src and isinstance(src, str):
                url = f"https://telegra.ph{src}" if src.startswith('/') else src
                print(f"  [{media_type.upper()}] ✅ Final URL: {url}")
                return url
            else:
                print(f"  [{media_type.upper()}] ⚠️  No valid URL extracted")
                return None
        except Exception as e:
            import traceback
            print(f"  [{media_type.upper()}] ❌ Upload error: {type(e).__name__}: {str(e)}")
            print(f"  [{media_type.upper()}] Full traceback:\n{traceback.format_exc()}")
            return None
    
    async def create_original_content_page(
        self,
        original_text: str,
        photos_file_ids: Optional[List[str]] = None,
        videos_info: Optional[List[Dict[str, Any]]] = None,
        page_title: str = "الخبر الأصلي",
        download_func: Optional[Callable] = None
    ) -> Optional[str]:
        """Create Telegraph page with original content and try to attach media"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print("\n" + "="*100)
        print(f"[📱 TELEGRAPH-PAGE] [{timestamp}] Creating Telegraph page")
        print(f"[📋 PARAMS] photos={len(photos_file_ids) if photos_file_ids else 0}, videos={len(videos_info) if videos_info else 0}, has_download_func={download_func is not None}")
        print("="*100)
        
        try:
            # 1. Validate text
            print(f"\n[📱 PAGE-1️⃣] TEXT VALIDATION")
            if not original_text or len(original_text) < 10:
                print(f"  ❌ Text invalid (length: {len(original_text)})")
                return None
            print(f"  ✅ Text valid: {len(original_text)} chars")
            
            # ✅ CHECK IF TEXT NEEDS SPLITTING (Telegraph has 64KB limit)
            text_bytes = len(original_text.encode('utf-8'))
            if text_bytes > 40000:
                print(f"  ⚠️ Text is large ({text_bytes} bytes), will split into multiple pages")
                chunks = self._split_text_into_chunks(original_text, max_bytes=35000)
                print(f"  📄 Split into {len(chunks)} pages")
                
                # Create first page with all chunks
                all_urls = []
                for i, chunk in enumerate(chunks):
                    chunk_title = f"{page_title} ({i+1}/{len(chunks)})"
                    chunk_url = await self._create_single_page(chunk, chunk_title, photos_file_ids if i == 0 else None, videos_info if i == 0 else None, download_func)
                    if chunk_url:
                        all_urls.append(chunk_url)
                        # Add navigation to next page
                        if i < len(chunks) - 1:
                            print(f"  ✅ Page {i+1} created: {chunk_url}")
                
                if all_urls:
                    print(f"  ✅ All {len(all_urls)} pages created successfully")
                    return all_urls[0]  # Return first page URL
                else:
                    return None
            
            # Text is small enough, create single page
            return await self._create_single_page(original_text, page_title, photos_file_ids, videos_info, download_func)
        
        except Exception as e:
            print(f"\n[📱 PAGE-❌] CRITICAL ERROR")
            print(f"  Type: {type(e).__name__}")
            print(f"  Message: {str(e)[:100]}")
            for line in traceback.format_exc().split('\n')[:3]:
                if line.strip():
                    print(f"  {line}")
            print("="*100 + "\n")
            return None
    
    async def _create_single_page(
        self,
        page_text: str,
        page_title: str,
        photos_file_ids: Optional[List[str]] = None,
        videos_info: Optional[List[Dict[str, Any]]] = None,
        download_func: Optional[Callable] = None
    ) -> Optional[str]:
        """Create a single Telegraph page with text and optional media"""
        try:
            # 2. Build HTML with text only first
            print(f"\n[📱 PAGE-2️⃣] BUILDING HTML")
            html_parts = []
            html_parts.append(f"<p><strong>{page_title}</strong></p>")
            text_html = self._text_to_html(page_text)
            html_parts.append(text_html)
            print(f"  ✅ HTML text added, current size: {len(''.join(html_parts))} bytes")
            
            # 3. Try to add photos
            print(f"\n[📷 PHOTOS-CHECK] photos_file_ids={photos_file_ids}, download_func={download_func is not None}")
            if photos_file_ids and download_func:
                print(f"\n[📷 PHOTOS] Processing {len(photos_file_ids)} photo(s)")
                photos_added = 0
                for idx, photo_id in enumerate(photos_file_ids, 1):
                    try:
                        print(f"  [📷 {idx}] Downloading photo_id: {photo_id[:20] if isinstance(photo_id, str) else photo_id}...")
                        file_path = await asyncio.wait_for(download_func(photo_id), timeout=15)
                        if file_path and os.path.exists(file_path):
                            size = os.path.getsize(file_path)
                            print(f"  [📷 {idx}] ✅ Downloaded {size} bytes → {file_path}")
                            # Try direct upload
                            try:
                                url = await self._upload_media(file_path, "photo")
                                if url:
                                    html_parts.append(f'<p><img src="{url}" style="max-width:100%"></p>')
                                    photos_added += 1
                                    print(f"  [📷 {idx}] ✅ Uploaded to Telegraph, HTML size now: {len(''.join(html_parts))}")
                                else:
                                    print(f"  [📷 {idx}] ⚠️  Upload returned None/empty URL")
                            except Exception as e:
                                print(f"  [📷 {idx}] ❌ Upload exception: {type(e).__name__}: {str(e)[:60]}")
                            # Cleanup
                            try:
                                os.remove(file_path)
                            except:
                                pass
                        else:
                            print(f"  [📷 {idx}] ❌ Download failed or file not found: {file_path}")
                    except asyncio.TimeoutError:
                        print(f"  [📷 {idx}] ❌ Download timeout (15s)")
                    except Exception as e:
                        print(f"  [📷 {idx}] ❌ Error: {type(e).__name__}: {str(e)[:50]}")
                print(f"  [📷 SUMMARY] Added {photos_added}/{len(photos_file_ids)} photos")
            elif not photos_file_ids:
                print(f"  [📷 SKIP] photos_file_ids is None/empty")
            elif not download_func:
                print(f"  [📷 SKIP] download_func is None")
            
            # 4. Try to add videos
            print(f"\n[🎥 VIDEOS-CHECK] videos_info={len(videos_info) if videos_info else 0}, download_func={download_func is not None}")
            if videos_info and download_func:
                print(f"\n[🎥 VIDEOS] Processing {len(videos_info)} video(s)")
                videos_added = 0
                for idx, vinfo in enumerate(videos_info, 1):
                    try:
                        if not isinstance(vinfo, dict):
                            print(f"  [🎥 {idx}] ⚠️  vinfo is not dict: {type(vinfo).__name__}")
                            continue
                        video_id = vinfo.get('file_id')
                        if not video_id:
                            print(f"  [🎥 {idx}] ⚠️  No file_id in vinfo")
                            continue
                        print(f"  [🎥 {idx}] Downloading video_id: {video_id[:20] if isinstance(video_id, str) else video_id}...")
                        file_path = await asyncio.wait_for(download_func(video_id), timeout=30)
                        if file_path and os.path.exists(file_path):
                            size = os.path.getsize(file_path)
                            print(f"  [🎥 {idx}] ✅ Downloaded {size} bytes")
                            try:
                                url = await self._upload_media(file_path, "video")
                                if url:
                                    title = vinfo.get('title', f'فيديو {idx}')
                                    html_parts.append(f'<p><a href="{url}">▶️ {title}</a></p>')
                                    videos_added += 1
                                    print(f"  [🎥 {idx}] ✅ Uploaded to Telegraph, HTML size now: {len(''.join(html_parts))}")
                                else:
                                    print(f"  [🎥 {idx}] ⚠️  Upload returned None/empty URL")
                            except Exception as e:
                                print(f"  [🎥 {idx}] ❌ Upload exception: {type(e).__name__}: {str(e)[:60]}")
                            try:
                                os.remove(file_path)
                            except:
                                pass
                        else:
                            print(f"  [🎥 {idx}] ❌ Download failed: {file_path}")
                    except asyncio.TimeoutError:
                        print(f"  [🎥 {idx}] ❌ Download timeout (30s)")
                    except Exception as e:
                        print(f"  [🎥 {idx}] ❌ Error: {type(e).__name__}: {str(e)[:50]}")
                print(f"  [🎥 SUMMARY] Added {videos_added}/{len(videos_info)} videos")
            elif not videos_info:
                print(f"  [🎥 SKIP] videos_info is None/empty")
            elif not download_func:
                print(f"  [🎥 SKIP] download_func is None")
            
            # 5. Add footer
            html_parts.append("<hr><p><em>📰 نظام التحليل الذكي</em></p>")
            html_content = "".join(html_parts)
            
            # 6. Create page
            print(f"\n[📱 PAGE-3️⃣] CREATING ON TELEGRAPH")
            print(f"  Title: {page_title}")
            print(f"  Size: {len(html_content)} bytes")
            
            response = self.telegraph.create_page(
                title=page_title[:100],
                html_content=html_content,
                return_content=True
            )
            
            # Safe response handling
            path = None
            if isinstance(response, dict):
                path = response.get('path')
            
            if path:
                page_url = f"https://telegra.ph/{path}"
                print(f"\n[📱 PAGE-✅] SUCCESS")
                print(f"  URL: {page_url}")
                media_info = ""
                if photos_file_ids:
                    media_info += f"photos={len(photos_file_ids)} "
                if videos_info:
                    media_info += f"videos={len(videos_info)}"
                print(f"  Content: {len(page_text)} chars + media ({media_info})")
                print("="*100 + "\n")
                return page_url
            else:
                print(f"\n[📱 PAGE-❌] Response invalid")
                print(f"  Response: {response}")
                return None
        
        except Exception as e:
            print(f"\n[📱 PAGE-❌] ERROR in _create_single_page")
            print(f"  Type: {type(e).__name__}")
            print(f"  Message: {str(e)[:100]}")
            for line in traceback.format_exc().split('\n')[:3]:
                if line.strip():
                    print(f"  {line}")
            print("="*100 + "\n")
            return None

    async def create_page(
        self,
        title: str,
        content: str,
        description: str = ""
    ) -> Optional[str]:
        """Create a Telegraph page with content (alias for create_text_page)"""
        return await self.create_text_page(title, content, description)
    
    def _split_text_into_chunks(self, text: str, max_bytes: int = 50000) -> List[str]:
        """
        Split text into chunks that fit within Telegraph's size limit.
        Telegraph has a 64KB limit, but we use 50KB to be safe with HTML overhead.
        For Arabic text (3 bytes per char in UTF-8), this is roughly 16,000 chars per chunk.
        """
        chunks = []
        current_chunk = ""
        
        paragraphs = text.split("\n")
        
        for para in paragraphs:
            test_chunk = current_chunk + "\n" + para if current_chunk else para
            if len(test_chunk.encode('utf-8')) > max_bytes:
                if current_chunk:
                    chunks.append(current_chunk)
                if len(para.encode('utf-8')) > max_bytes:
                    words = para.split(" ")
                    current_chunk = ""
                    for word in words:
                        test_word = current_chunk + " " + word if current_chunk else word
                        if len(test_word.encode('utf-8')) > max_bytes:
                            if current_chunk:
                                chunks.append(current_chunk)
                            current_chunk = word
                        else:
                            current_chunk = test_word
                else:
                    current_chunk = para
            else:
                current_chunk = test_chunk
        
        if current_chunk:
            chunks.append(current_chunk)
        
        return chunks if chunks else [text]

    def _text_to_html(self, text: str) -> str:
        """Convert plain text to proper HTML with paragraph tags"""
        if not text:
            return ""
        
        # Split into paragraphs (by double newlines or paragraph breaks)
        paragraphs = [p.strip() for p in text.split('\n') if p.strip()]
        
        # Wrap each paragraph in <p> tags
        html_parts = []
        for para in paragraphs:
            # Escape any special HTML characters in the text
            para = para.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            # Replace remaining single newlines with <br> if there are any
            para_html = para.replace('\n', '<br>')
            html_parts.append(f"<p>{para_html}</p>")
        
        return "".join(html_parts)
    
    async def create_text_page(
        self,
        title: str,
        content: str,
        description: str = ""
    ) -> Optional[str]:
        """Create a simple Telegraph page with text content, splitting into multiple pages if needed"""
        try:
            print(f"\n[📱 TELEGRAPH-TEXT] Creating text page: {title[:50]}")
            print(f"  📊 Content size: {len(content)} chars, {len(content.encode('utf-8'))} bytes")
            
            if not content or len(content) < 10:
                print(f"  ❌ Content too short: {len(content)} chars")
                return None
            
            content_bytes = len(content.encode('utf-8'))
            max_safe_bytes = 50000
            
            if content_bytes <= max_safe_bytes:
                html_content = self._text_to_html(content)
                
                if description:
                    html_content = f"<p><em>{description}</em></p><hr>" + html_content
                
                response = self.telegraph.create_page(
                    title=title[:100],
                    html_content=html_content,
                    author_name="نظام التحليل الذكي"
                )
                
                if response and 'url' in response:
                    url = response['url']
                    print(f"  ✅ Telegraph page created: {url}")
                    return url
                else:
                    print(f"  ❌ No URL in response: {response}")
                    return None
            
            print(f"  ⚠️ Content too large ({content_bytes} bytes), splitting into multiple pages...")
            chunks = self._split_text_into_chunks(content, max_safe_bytes - 5000)
            print(f"  📄 Split into {len(chunks)} parts")
            
            page_urls = []
            for i, chunk in enumerate(chunks):
                part_num = i + 1
                total_parts = len(chunks)
                part_title = f"{title} (جزء {part_num}/{total_parts})"
                
                html_content = self._text_to_html(chunk)
                
                if i == 0 and description:
                    html_content = f"<p><em>{description}</em></p><hr>" + html_content
                
                html_content = f"<p><strong>📄 الجزء {part_num} من {total_parts}</strong></p><hr>" + html_content
                
                try:
                    response = self.telegraph.create_page(
                        title=part_title[:100],
                        html_content=html_content,
                        author_name="نظام التحليل الذكي"
                    )
                    
                    if response and 'url' in response:
                        page_urls.append(response['url'])
                        print(f"  ✅ Part {part_num}/{total_parts} created: {response['url']}")
                    else:
                        print(f"  ❌ Part {part_num} failed: no URL in response")
                except Exception as e:
                    print(f"  ❌ Part {part_num} error: {str(e)}")
            
            if not page_urls:
                print(f"  ❌ Failed to create any pages")
                return None
            
            if len(page_urls) > 1:
                print(f"  🔗 Creating index page with links to all parts...")
                index_html = f"<p><strong>📚 فهرس الأجزاء ({len(page_urls)} أجزاء)</strong></p><hr>"
                if description:
                    index_html += f"<p><em>{description}</em></p>"
                for i, url in enumerate(page_urls):
                    index_html += f'<p>📄 <a href="{url}">الجزء {i+1} من {len(page_urls)}</a></p>'
                
                preview_text = self._text_to_html(content[:1000])
                index_html += f"<hr><p><strong>معاينة المحتوى:</strong></p>{preview_text}"
                
                try:
                    index_response = self.telegraph.create_page(
                        title=f"{title} - الفهرس",
                        html_content=index_html,
                        author_name="نظام التحليل الذكي"
                    )
                    
                    if index_response and 'url' in index_response:
                        index_url = index_response['url']
                        print(f"  ✅ Index page created: {index_url}")
                        return index_url
                except Exception as e:
                    print(f"  ⚠️ Index page error: {str(e)}, returning first page URL")
            
            print(f"  ✅ Returning first page URL: {page_urls[0]}")
            return page_urls[0]
                
        except Exception as e:
            print(f"  ❌ Error creating Telegraph page: {str(e)}")
            import traceback
            print(f"  Traceback: {traceback.format_exc()[:500]}")
            return None

telegraph_manager = TelegraphManager()
