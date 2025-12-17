"""
Userbot Authentication Service
Handles phone login flow for Pyrogram/Pyrofork MTProto sessions
Uses database to store login state across process restarts

Features:
- Phone number validation and formatting
- OTP code sending and verification via database persistence
- 2FA password verification
- Session string export and management
- Proper cleanup on success/failure/logout
- Handles restart scenarios gracefully
"""
import asyncio
import logging
import re
import json
from typing import Optional, Dict, Any
from pyrogram import Client
from pyrogram.errors import (
    PhoneCodeInvalid, 
    PhoneCodeExpired, 
    SessionPasswordNeeded,
    PasswordHashInvalid,
    FloodWait,
    PhoneNumberInvalid,
    ApiIdInvalid,
    PhoneNumberBanned,
    PhoneNumberFlood,
    AuthKeyUnregistered
)
from config.settings import settings
from utils.database import db

logger = logging.getLogger(__name__)

class UserbotAuthService:
    """Service for managing userbot authentication with database persistence"""
    
    def __init__(self):
        self.active_clients: Dict[str, Client] = {}
        self._db_connected = False
        self._connection_lock = asyncio.Lock()
    
    def _normalize_phone(self, phone_number: str) -> str:
        """Normalize phone number format"""
        phone_number = phone_number.strip().replace(" ", "").replace("-", "")
        if not phone_number.startswith("+"):
            phone_number = "+" + phone_number
        return phone_number
    
    async def _ensure_db_connected(self):
        """Ensure database connection is established (thread-safe)"""
        if self._db_connected and db.pool is not None:
            return
        
        async with self._connection_lock:
            if not self._db_connected or db.pool is None:
                await db.connect()
                self._db_connected = True
    
    async def _cleanup_existing_client(self, phone_number: str):
        """Clean up any existing client for the phone number"""
        if phone_number in self.active_clients:
            try:
                client = self.active_clients[phone_number]
                if client.is_connected:
                    await client.disconnect()
                logger.info(f"Cleaned up existing client for {phone_number[:5]}***")
            except Exception as e:
                logger.warning(f"Error cleaning up client: {str(e)}")
            finally:
                del self.active_clients[phone_number]
    
    async def _cleanup_all_clients(self):
        """Clean up all active clients"""
        for phone_number in list(self.active_clients.keys()):
            await self._cleanup_existing_client(phone_number)
    
    async def _clear_old_sessions_for_phone(self, phone_number: str):
        """Clear any old/stale session data for a phone number"""
        await self._ensure_db_connected()
        await db.execute(
            """UPDATE userbot_sessions 
               SET login_state = NULL, status = 'cancelled', updated_at = NOW()
               WHERE phone_number = $1 AND status IN ('awaiting_code', 'awaiting_password')""",
            phone_number
        )
    
    async def start_login(self, phone_number: str) -> Dict[str, Any]:
        """
        Start the login flow by sending OTP code to phone
        Stores phone_code_hash in database for later retrieval
        Returns: {'status': 'code_sent', 'phone_code_hash': '...'}
        """
        try:
            phone_number = self._normalize_phone(phone_number)
            
            logger.info(f"Starting login for phone: {phone_number[:5]}***")
            
            await self._cleanup_existing_client(phone_number)
            
            await self._ensure_db_connected()
            await self._clear_old_sessions_for_phone(phone_number)
            
            client = Client(
                name=f"userbot_session_{phone_number[-4:]}",
                api_id=settings.API_ID,
                api_hash=settings.API_HASH,
                in_memory=True
            )
            
            await client.connect()
            sent_code = await client.send_code(phone_number)
            
            self.active_clients[phone_number] = client
            
            login_state = {
                "phone_code_hash": sent_code.phone_code_hash,
                "status": "awaiting_code",
                "api_id": settings.API_ID,
                "api_hash": settings.API_HASH
            }
            
            existing = await db.fetchrow(
                "SELECT id FROM userbot_sessions WHERE phone_number = $1",
                phone_number
            )
            
            if existing:
                await db.execute(
                    """UPDATE userbot_sessions 
                       SET login_state = $1, status = $2, 
                           session_string = NULL, is_active = false, 
                           error_message = NULL, updated_at = NOW()
                       WHERE phone_number = $3""",
                    json.dumps(login_state),
                    "awaiting_code",
                    phone_number
                )
            else:
                await db.execute(
                    """INSERT INTO userbot_sessions 
                       (phone_number, login_state, status, is_active, is_primary)
                       VALUES ($1, $2, $3, false, false)""",
                    phone_number,
                    json.dumps(login_state),
                    "awaiting_code"
                )
            
            logger.info(f"OTP sent successfully to {phone_number[:5]}***")
            
            return {
                "status": "code_sent",
                "phone_number": phone_number,
                "phone_code_hash": sent_code.phone_code_hash,
                "message": "تم إرسال رمز التحقق إلى هاتفك"
            }
            
        except PhoneNumberInvalid:
            logger.error(f"Invalid phone number: {phone_number[:5]}***")
            return {
                "status": "error",
                "error": "phone_invalid",
                "message": "رقم الهاتف غير صحيح"
            }
        except PhoneNumberBanned:
            logger.error(f"Phone number banned: {phone_number[:5]}***")
            return {
                "status": "error",
                "error": "phone_banned",
                "message": "رقم الهاتف محظور من تلغرام"
            }
        except PhoneNumberFlood:
            logger.error(f"Phone number flood: {phone_number[:5]}***")
            return {
                "status": "error",
                "error": "phone_flood",
                "message": "تم تجاوز الحد المسموح به للمحاولات، يرجى الانتظار ساعة قبل المحاولة مرة أخرى"
            }
        except ApiIdInvalid:
            logger.error("Invalid API ID or API Hash")
            return {
                "status": "error", 
                "error": "api_invalid",
                "message": "خطأ في إعدادات API - تحقق من API_ID و API_HASH"
            }
        except FloodWait as e:
            wait_seconds = int(e.value) if isinstance(e.value, (int, float, str)) else 60
            logger.error(f"Flood wait: {wait_seconds} seconds")
            minutes = wait_seconds // 60
            if minutes > 0:
                return {
                    "status": "error",
                    "error": "flood_wait",
                    "message": f"يرجى الانتظار {minutes} دقيقة قبل المحاولة مرة أخرى"
                }
            return {
                "status": "error",
                "error": "flood_wait",
                "message": f"يرجى الانتظار {wait_seconds} ثانية قبل المحاولة مرة أخرى"
            }
        except Exception as e:
            logger.error(f"Login start error: {str(e)}")
            await self._cleanup_existing_client(phone_number)
            return {
                "status": "error",
                "error": "unknown",
                "message": f"خطأ: {str(e)}"
            }
    
    async def verify_code(self, phone_number: str, code: str) -> Dict[str, Any]:
        """
        Verify the OTP code
        Retrieves phone_code_hash from database
        Returns: {'status': 'success', 'session_string': '...'} or {'status': '2fa_required'}
        """
        try:
            phone_number = self._normalize_phone(phone_number)
            code = code.strip().replace(" ", "").replace("-", "")
            
            await self._ensure_db_connected()
            session_row = await db.fetchrow(
                "SELECT login_state, status FROM userbot_sessions WHERE phone_number = $1",
                phone_number
            )
            
            logger.info(f"Database lookup for {phone_number[:5]}***: found={session_row is not None}")
            
            if not session_row:
                logger.error(f"No session found for {phone_number[:5]}***")
                return {
                    "status": "error",
                    "error": "session_expired",
                    "message": "انتهت صلاحية الجلسة، يرجى البدء من جديد"
                }
            
            if session_row.get('status') not in ['awaiting_code', 'awaiting_password']:
                logger.error(f"Invalid session status: {session_row.get('status')}")
                return {
                    "status": "error",
                    "error": "session_expired",
                    "message": "انتهت صلاحية الجلسة، يرجى البدء من جديد"
                }
            
            login_state = session_row.get('login_state')
            
            if not login_state:
                logger.error(f"No login state for {phone_number[:5]}***")
                return {
                    "status": "error",
                    "error": "session_expired",
                    "message": "انتهت صلاحية الجلسة، يرجى البدء من جديد"
                }
            
            try:
                if isinstance(login_state, str):
                    login_state = json.loads(login_state)
                elif not isinstance(login_state, dict):
                    logger.error(f"Unexpected login_state type: {type(login_state)}")
                    login_state = {}
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse login_state JSON: {str(e)}")
                return {
                    "status": "error",
                    "error": "session_expired",
                    "message": "انتهت صلاحية الجلسة، يرجى البدء من جديد"
                }
            
            phone_code_hash = login_state.get("phone_code_hash")
            if not phone_code_hash:
                logger.error(f"No phone_code_hash in login_state")
                return {
                    "status": "error",
                    "error": "session_expired",
                    "message": "انتهت صلاحية الجلسة، يرجى البدء من جديد"
                }
            
            logger.info(f"Verifying code for {phone_number[:5]}***")
            
            client = self.active_clients.get(phone_number)
            
            if not client:
                logger.info(f"No active client found for {phone_number[:5]}***, creating new one...")
                client = Client(
                    name=f"userbot_session_{phone_number[-4:]}",
                    api_id=settings.API_ID,
                    api_hash=settings.API_HASH,
                    in_memory=True
                )
                await client.connect()
                self.active_clients[phone_number] = client
            elif not client.is_connected:
                logger.info(f"Client disconnected, reconnecting...")
                try:
                    await client.connect()
                except Exception as e:
                    logger.warning(f"Reconnect failed, creating new client: {str(e)}")
                    client = Client(
                        name=f"userbot_session_{phone_number[-4:]}",
                        api_id=settings.API_ID,
                        api_hash=settings.API_HASH,
                        in_memory=True
                    )
                    await client.connect()
                    self.active_clients[phone_number] = client
            
            try:
                await client.sign_in(
                    phone_number=phone_number,
                    phone_code_hash=phone_code_hash,
                    phone_code=code
                )
                
                session_string = await client.export_session_string()
                me = await client.get_me()
                
                await db.execute(
                    """UPDATE userbot_sessions 
                       SET status = 'active', login_state = NULL, 
                           session_string = $1, is_active = true, is_primary = true,
                           last_login_at = NOW(), updated_at = NOW()
                       WHERE phone_number = $2""",
                    session_string,
                    phone_number
                )
                
                await db.execute(
                    """UPDATE userbot_sessions 
                       SET is_active = false, is_primary = false, updated_at = NOW()
                       WHERE phone_number != $1 AND is_active = true""",
                    phone_number
                )
                
                await self._cleanup_existing_client(phone_number)
                
                logger.info(f"Login successful for {me.first_name} (@{me.username})")
                
                return {
                    "status": "success",
                    "session_string": session_string,
                    "user_id": me.id,
                    "first_name": me.first_name,
                    "username": me.username,
                    "message": f"تم تسجيل الدخول بنجاح كـ {me.first_name}"
                }
                
            except SessionPasswordNeeded:
                logger.info(f"2FA required for {phone_number[:5]}***")
                login_state["status"] = "awaiting_password"
                await db.execute(
                    """UPDATE userbot_sessions 
                       SET status = 'awaiting_password', login_state = $1, updated_at = NOW()
                       WHERE phone_number = $2""",
                    json.dumps(login_state),
                    phone_number
                )
                return {
                    "status": "2fa_required",
                    "message": "يتطلب هذا الحساب كلمة مرور التحقق بخطوتين"
                }
                
        except PhoneCodeInvalid:
            logger.error("Invalid phone code")
            return {
                "status": "error",
                "error": "code_invalid",
                "message": "رمز التحقق غير صحيح"
            }
        except PhoneCodeExpired:
            logger.error("Phone code expired")
            await self._cleanup_existing_client(phone_number)
            await db.execute(
                """UPDATE userbot_sessions 
                   SET status = 'error', login_state = NULL, 
                       error_message = 'code_expired', updated_at = NOW()
                   WHERE phone_number = $1""",
                phone_number
            )
            return {
                "status": "error",
                "error": "code_expired",
                "message": "انتهت صلاحية رمز التحقق، يرجى طلب رمز جديد"
            }
        except AuthKeyUnregistered:
            logger.error("Auth key unregistered - session expired")
            await self._cleanup_existing_client(phone_number)
            await db.execute(
                """UPDATE userbot_sessions 
                   SET status = 'error', login_state = NULL, 
                       error_message = 'auth_key_unregistered', updated_at = NOW()
                   WHERE phone_number = $1""",
                phone_number
            )
            return {
                "status": "error",
                "error": "session_expired",
                "message": "انتهت صلاحية الجلسة، يرجى البدء من جديد"
            }
        except Exception as e:
            logger.error(f"Code verification error: {str(e)}")
            return {
                "status": "error",
                "error": "unknown",
                "message": f"خطأ في التحقق: {str(e)}"
            }
    
    async def verify_2fa(self, phone_number: str, password: str) -> Dict[str, Any]:
        """
        Verify 2FA password
        Returns: {'status': 'success', 'session_string': '...'}
        """
        try:
            phone_number = self._normalize_phone(phone_number)
            
            await self._ensure_db_connected()
            
            session_row = await db.fetchrow(
                "SELECT login_state, status FROM userbot_sessions WHERE phone_number = $1",
                phone_number
            )
            
            if not session_row or session_row.get('status') != 'awaiting_password':
                return {
                    "status": "error",
                    "error": "session_expired",
                    "message": "انتهت صلاحية الجلسة، يرجى البدء من جديد"
                }
            
            client = self.active_clients.get(phone_number)
            if not client:
                logger.warning(f"No active client for 2FA, cannot proceed")
                return {
                    "status": "error",
                    "error": "session_expired",
                    "message": "انتهت صلاحية الجلسة، يرجى البدء من جديد"
                }
            
            if not client.is_connected:
                logger.info(f"Client disconnected during 2FA, reconnecting...")
                try:
                    await client.connect()
                except Exception as e:
                    logger.error(f"Failed to reconnect for 2FA: {str(e)}")
                    return {
                        "status": "error",
                        "error": "session_expired",
                        "message": "انتهت صلاحية الجلسة، يرجى البدء من جديد"
                    }
            
            logger.info(f"Verifying 2FA for {phone_number[:5]}***")
            
            await client.check_password(password)
            
            session_string = await client.export_session_string()
            me = await client.get_me()
            
            await db.execute(
                """UPDATE userbot_sessions 
                   SET status = 'active', login_state = NULL,
                       session_string = $1, is_active = true, is_primary = true,
                       last_login_at = NOW(), updated_at = NOW()
                   WHERE phone_number = $2""",
                session_string,
                phone_number
            )
            
            await db.execute(
                """UPDATE userbot_sessions 
                   SET is_active = false, is_primary = false, updated_at = NOW()
                   WHERE phone_number != $1 AND is_active = true""",
                phone_number
            )
            
            await self._cleanup_existing_client(phone_number)
            
            logger.info(f"2FA login successful for {me.first_name}")
            
            return {
                "status": "success",
                "session_string": session_string,
                "user_id": me.id,
                "first_name": me.first_name,
                "username": me.username,
                "message": f"تم تسجيل الدخول بنجاح كـ {me.first_name}"
            }
            
        except PasswordHashInvalid:
            logger.error("Invalid 2FA password")
            return {
                "status": "error",
                "error": "password_invalid",
                "message": "كلمة المرور غير صحيحة"
            }
        except AuthKeyUnregistered:
            logger.error("Auth key unregistered during 2FA")
            await self._cleanup_existing_client(phone_number)
            return {
                "status": "error",
                "error": "session_expired",
                "message": "انتهت صلاحية الجلسة، يرجى البدء من جديد"
            }
        except Exception as e:
            logger.error(f"2FA verification error: {str(e)}")
            return {
                "status": "error",
                "error": "unknown",
                "message": f"خطأ: {str(e)}"
            }
    
    async def cancel_login(self, phone_number: str) -> Dict[str, Any]:
        """Cancel ongoing login process and cleanup"""
        try:
            phone_number = self._normalize_phone(phone_number)
            
            await self._cleanup_existing_client(phone_number)
            
            await self._ensure_db_connected()
            await db.execute(
                """UPDATE userbot_sessions 
                   SET status = 'cancelled', login_state = NULL, updated_at = NOW()
                   WHERE phone_number = $1 AND status IN ('awaiting_code', 'awaiting_password')""",
                phone_number
            )
            
            logger.info(f"Login cancelled for {phone_number[:5]}***")
            
            return {"status": "cancelled", "message": "تم إلغاء عملية تسجيل الدخول"}
            
        except Exception as e:
            logger.error(f"Cancel login error: {str(e)}")
            return {"status": "error", "message": str(e)}
    
    async def logout(self, phone_number: Optional[str] = None) -> Dict[str, Any]:
        """
        Logout and cleanup session
        If phone_number is None, logs out the active session
        """
        try:
            await self._ensure_db_connected()
            
            if not phone_number:
                session_row = await db.fetchrow(
                    "SELECT phone_number FROM userbot_sessions WHERE is_active = true AND is_primary = true LIMIT 1"
                )
                if session_row:
                    phone_number = session_row['phone_number']
            
            if phone_number:
                phone_number = self._normalize_phone(phone_number)
                await self._cleanup_existing_client(phone_number)
            else:
                await self._cleanup_all_clients()
            
            await db.execute(
                """UPDATE userbot_sessions 
                   SET is_active = false, is_primary = false, 
                       session_string = NULL, status = 'expired',
                       login_state = NULL, updated_at = NOW()
                   WHERE is_active = true"""
            )
            
            logger.info(f"Logout successful")
            
            return {"status": "success", "message": "تم تسجيل الخروج بنجاح"}
            
        except Exception as e:
            logger.error(f"Logout error: {str(e)}")
            return {"status": "error", "message": str(e)}
    
    async def validate_session(self, session_string: str) -> Dict[str, Any]:
        """Validate an existing session string"""
        client = None
        try:
            client = Client(
                name="session_validator",
                api_id=settings.API_ID,
                api_hash=settings.API_HASH,
                session_string=session_string,
                in_memory=True
            )
            
            await client.connect()
            me = await client.get_me()
            await client.disconnect()
            
            return {
                "status": "valid",
                "user_id": me.id,
                "first_name": me.first_name,
                "username": me.username
            }
            
        except AuthKeyUnregistered:
            logger.error("Session validation failed: auth key unregistered")
            return {
                "status": "invalid",
                "error": "auth_key_unregistered"
            }
        except Exception as e:
            logger.error(f"Session validation error: {str(e)}")
            return {
                "status": "invalid",
                "error": str(e)
            }
        finally:
            if client and client.is_connected:
                try:
                    await client.disconnect()
                except:
                    pass
    
    async def get_login_status(self, phone_number: str) -> Dict[str, Any]:
        """Get current login status for a phone number"""
        try:
            phone_number = self._normalize_phone(phone_number)
            
            await self._ensure_db_connected()
            session_row = await db.fetchrow(
                """SELECT status, is_active, error_message 
                   FROM userbot_sessions WHERE phone_number = $1""",
                phone_number
            )
            
            if not session_row:
                return {"status": "not_found"}
            
            return {
                "status": session_row['status'],
                "is_active": session_row['is_active'],
                "error_message": session_row.get('error_message')
            }
            
        except Exception as e:
            logger.error(f"Get login status error: {str(e)}")
            return {"status": "error", "message": str(e)}

userbot_auth = UserbotAuthService()
