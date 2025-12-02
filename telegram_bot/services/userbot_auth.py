"""
Userbot Authentication Service
Handles phone login flow for Pyrogram/Pyrofork MTProto sessions
Uses database to store login state across process restarts

Features:
- Phone number validation and formatting
- OTP code sending and verification via database persistence
- 2FA password verification
- Session string export and management
- Proper cleanup on success/failure
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
    PhoneNumberFlood
)
from config.settings import settings
from utils.database import db

logger = logging.getLogger(__name__)

class UserbotAuthService:
    """Service for managing userbot authentication with database persistence"""
    
    def __init__(self):
        # Temporary in-memory cache for active clients only
        self.active_clients: Dict[str, Client] = {}
    
    async def start_login(self, phone_number: str) -> Dict[str, Any]:
        """
        Start the login flow by sending OTP code to phone
        Stores phone_code_hash in database for later retrieval
        Returns: {'status': 'code_sent', 'phone_code_hash': '...'}
        """
        try:
            phone_number = phone_number.strip().replace(" ", "")
            if not phone_number.startswith("+"):
                phone_number = "+" + phone_number
            
            logger.info(f"Starting login for phone: {phone_number[:5]}***")
            
            # Create client
            client = Client(
                name=f"userbot_session_{phone_number[-4:]}",
                api_id=settings.API_ID,
                api_hash=settings.API_HASH,
                in_memory=True
            )
            
            await client.connect()
            sent_code = await client.send_code(phone_number)
            
            # Store in memory for this process
            self.active_clients[phone_number] = client
            
            # Store in database for persistence
            await db.connect()
            login_state = {
                "phone_code_hash": sent_code.phone_code_hash,
                "status": "awaiting_code"
            }
            
            # Delete existing record if exists, then insert new one
            await db.execute(
                "DELETE FROM userbot_sessions WHERE phone_number = $1",
                phone_number
            )
            
            await db.execute(
                """INSERT INTO userbot_sessions (phone_number, login_state, status)
                   VALUES ($1, $2, $3)""",
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
        except ApiIdInvalid:
            logger.error("Invalid API ID or API Hash")
            return {
                "status": "error", 
                "error": "api_invalid",
                "message": "خطأ في إعدادات API - تحقق من API_ID و API_HASH"
            }
        except FloodWait as e:
            logger.error(f"Flood wait: {e.value} seconds")
            return {
                "status": "error",
                "error": "flood_wait",
                "message": f"يرجى الانتظار {e.value} ثانية قبل المحاولة مرة أخرى"
            }
        except Exception as e:
            logger.error(f"Login start error: {str(e)}")
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
            phone_number = phone_number.strip().replace(" ", "")
            if not phone_number.startswith("+"):
                phone_number = "+" + phone_number
            
            code = code.strip().replace(" ", "").replace("-", "")
            
            # Retrieve from database
            await db.connect()
            session_row = await db.fetchrow(
                "SELECT login_state FROM userbot_sessions WHERE phone_number = $1",
                phone_number
            )
            
            logger.info(f"Database lookup for {phone_number[:5]}***: {session_row}")
            
            if not session_row:
                logger.error(f"No session found for {phone_number[:5]}***")
                return {
                    "status": "error",
                    "error": "session_expired",
                    "message": "انتهت صلاحية الجلسة، يرجى البدء من جديد"
                }
            
            login_state = session_row.get('login_state') or session_row['login_state']
            
            logger.info(f"Login state raw: {login_state}, type: {type(login_state)}")
            
            if not login_state:
                logger.error(f"No login state for {phone_number[:5]}***")
                return {
                    "status": "error",
                    "error": "session_expired",
                    "message": "انتهت صلاحية الجلسة، يرجى البدء من جديد"
                }
            
            # Parse JSON
            try:
                if isinstance(login_state, str):
                    login_state = json.loads(login_state)
                elif isinstance(login_state, dict):
                    pass  # Already a dict
                else:
                    logger.error(f"Unexpected login_state type: {type(login_state)}")
                    login_state = {}
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse login_state JSON: {str(e)}")
                login_state = {}
            
            phone_code_hash = login_state.get("phone_code_hash")
            logger.info(f"Extracted phone_code_hash: {phone_code_hash[:10] if phone_code_hash else None}***")
            
            if not phone_code_hash:
                logger.error(f"No phone_code_hash in login_state: {login_state}")
                return {
                    "status": "error",
                    "error": "session_expired",
                    "message": "انتهت صلاحية الجلسة، يرجى البدء من جديد"
                }
            
            logger.info(f"Verifying code for {phone_number[:5]}***")
            
            # Get or create client
            client = self.active_clients.get(phone_number)
            if not client:
                logger.info(f"Creating new client for {phone_number[:5]}***")
                client = Client(
                    name=f"userbot_session_{phone_number[-4:]}",
                    api_id=settings.API_ID,
                    api_hash=settings.API_HASH,
                    in_memory=True
                )
                self.active_clients[phone_number] = client
            
            # Ensure client is connected
            if not client.is_connected:
                logger.info(f"Client disconnected, reconnecting...")
                await client.connect()
            else:
                logger.info(f"Client already connected")
            
            try:
                await client.sign_in(
                    phone_number=phone_number,
                    phone_code_hash=phone_code_hash,
                    phone_code=code
                )
                
                session_string = await client.export_session_string()
                me = await client.get_me()
                
                # Clean up
                if phone_number in self.active_clients:
                    del self.active_clients[phone_number]
                await client.disconnect()
                
                # Update database
                await db.execute(
                    """UPDATE userbot_sessions SET status = 'active', login_state = NULL
                       WHERE phone_number = $1""",
                    phone_number
                )
                
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
                # Update status in database
                await db.execute(
                    "UPDATE userbot_sessions SET status = 'awaiting_password' WHERE phone_number = $1",
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
            if phone_number in self.active_clients:
                try:
                    await self.active_clients[phone_number].disconnect()
                except:
                    pass
                del self.active_clients[phone_number]
            await db.execute(
                "UPDATE userbot_sessions SET status = 'error', error_message = 'code_expired' WHERE phone_number = $1",
                phone_number
            )
            return {
                "status": "error",
                "error": "code_expired",
                "message": "انتهت صلاحية رمز التحقق، يرجى طلب رمز جديد"
            }
        except Exception as e:
            logger.error(f"Code verification error: {str(e)}")
            return {
                "status": "error",
                "error": "unknown",
                "message": f"خطأ: {str(e)}"
            }
    
    async def verify_2fa(self, phone_number: str, password: str) -> Dict[str, Any]:
        """
        Verify 2FA password
        Retrieves client data from database
        Returns: {'status': 'success', 'session_string': '...'}
        """
        try:
            phone_number = phone_number.strip().replace(" ", "")
            if not phone_number.startswith("+"):
                phone_number = "+" + phone_number
            
            # Get client
            client = self.active_clients.get(phone_number)
            if not client:
                client = Client(
                    name=f"userbot_session_{phone_number[-4:]}",
                    api_id=settings.API_ID,
                    api_hash=settings.API_HASH,
                    in_memory=True
                )
                self.active_clients[phone_number] = client
            
            # Ensure client is connected
            if not client.is_connected:
                logger.info(f"Client disconnected, reconnecting...")
                await client.connect()
            
            logger.info(f"Verifying 2FA for {phone_number[:5]}***")
            
            await client.check_password(password)
            
            session_string = await client.export_session_string()
            me = await client.get_me()
            
            # Clean up
            if phone_number in self.active_clients:
                del self.active_clients[phone_number]
            await client.disconnect()
            
            # Update database
            await db.execute(
                """UPDATE userbot_sessions SET status = 'active', login_state = NULL, updated_at = NOW()
                   WHERE phone_number = $1""",
                phone_number
            )
            
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
        except Exception as e:
            logger.error(f"2FA verification error: {str(e)}")
            return {
                "status": "error",
                "error": "unknown",
                "message": f"خطأ: {str(e)}"
            }
    
    async def cancel_login(self, phone_number: str) -> Dict[str, Any]:
        """Cancel ongoing login process"""
        try:
            phone_number = phone_number.strip().replace(" ", "")
            if not phone_number.startswith("+"):
                phone_number = "+" + phone_number
            
            if phone_number in self.active_clients:
                try:
                    await self.active_clients[phone_number].disconnect()
                except:
                    pass
                del self.active_clients[phone_number]
            
            await db.execute(
                "UPDATE userbot_sessions SET status = 'cancelled', login_state = NULL WHERE phone_number = $1",
                phone_number
            )
            
            return {"status": "cancelled", "message": "تم إلغاء عملية تسجيل الدخول"}
            
        except Exception as e:
            logger.error(f"Cancel login error: {str(e)}")
            return {"status": "error", "message": str(e)}
    
    async def validate_session(self, session_string: str) -> Dict[str, Any]:
        """Validate an existing session string"""
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
            
        except Exception as e:
            logger.error(f"Session validation error: {str(e)}")
            return {
                "status": "invalid",
                "error": str(e)
            }

userbot_auth = UserbotAuthService()
