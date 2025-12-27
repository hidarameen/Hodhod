"""
Rate Limiting Service for AI Model Requests
Enforces TPM (Tokens Per Minute), RPM (Requests Per Minute), and TPD (Tokens Per Day) limits
"""

import asyncio
import time
from typing import Dict, Optional, Tuple
from datetime import datetime, timedelta
from utils.error_handler import ErrorLogger

error_logger = ErrorLogger("rate_limiter")


class RateLimiter:
    """Manages rate limits for AI models"""
    
    def __init__(self):
        self.token_buckets: Dict[str, Dict] = {}  # model_name -> {tokens, last_refill_time}
        self.request_counters: Dict[str, Dict] = {}  # model_name -> {count, window_start}
        self.daily_token_counters: Dict[str, Dict] = {}  # model_name -> {tokens, date}
        self.lock = asyncio.Lock()
    
    async def can_request(
        self,
        model_name: str,
        estimated_tokens: int,
        tpm_limit: Optional[int] = None,
        rpm_limit: Optional[int] = None,
        tpd_limit: Optional[int] = None
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if a request can be made within rate limits
        
        Args:
            model_name: Name of the AI model
            estimated_tokens: Estimated tokens for this request
            tpm_limit: Tokens Per Minute limit
            rpm_limit: Requests Per Minute limit
            tpd_limit: Tokens Per Day limit
            
        Returns:
            (can_request, error_message)
        """
        async with self.lock:
            # Check RPM (Requests Per Minute)
            if rpm_limit:
                can_request, msg = self._check_rpm(model_name, rpm_limit)
                if not can_request:
                    error_logger.log_warning(f"[RateLimiter] RPM limit exceeded for {model_name}: {msg}")
                    return False, msg
            
            # Check TPM (Tokens Per Minute)
            if tpm_limit:
                can_request, msg = self._check_tpm(model_name, estimated_tokens, tpm_limit)
                if not can_request:
                    error_logger.log_warning(f"[RateLimiter] TPM limit exceeded for {model_name}: {msg}")
                    return False, msg
            
            # Check TPD (Tokens Per Day)
            if tpd_limit:
                can_request, msg = self._check_tpd(model_name, estimated_tokens, tpd_limit)
                if not can_request:
                    error_logger.log_warning(f"[RateLimiter] TPD limit exceeded for {model_name}: {msg}")
                    return False, msg
            
            # All limits OK, record the request
            self._record_request(model_name, estimated_tokens)
            return True, None
    
    def _check_rpm(self, model_name: str, rpm_limit: int) -> Tuple[bool, Optional[str]]:
        """Check Requests Per Minute limit"""
        now = time.time()
        
        if model_name not in self.request_counters:
            self.request_counters[model_name] = {"count": 0, "window_start": now}
        
        counter = self.request_counters[model_name]
        window_elapsed = now - counter["window_start"]
        
        # Reset window if 60 seconds have passed
        if window_elapsed >= 60:
            counter["count"] = 0
            counter["window_start"] = now
        
        if counter["count"] >= rpm_limit:
            seconds_until_reset = 60 - window_elapsed
            return False, f"RPM limit {rpm_limit} reached. Reset in {seconds_until_reset:.1f}s"
        
        return True, None
    
    def _check_tpm(self, model_name: str, tokens: int, tpm_limit: int) -> Tuple[bool, Optional[str]]:
        """Check Tokens Per Minute limit"""
        now = time.time()
        
        if model_name not in self.token_buckets:
            self.token_buckets[model_name] = {"tokens": tpm_limit, "last_refill": now}
        
        bucket = self.token_buckets[model_name]
        elapsed = now - bucket["last_refill"]
        
        # Refill tokens (1 token per (60/tpm_limit) milliseconds)
        if elapsed > 0:
            refill_rate = tpm_limit / 60  # tokens per second
            refill_tokens = refill_rate * elapsed
            bucket["tokens"] = min(tpm_limit, bucket["tokens"] + refill_tokens)
            bucket["last_refill"] = now
        
        if bucket["tokens"] < tokens:
            tokens_needed = tokens - bucket["tokens"]
            wait_time = tokens_needed / (tpm_limit / 60)
            return False, f"TPM limit {tpm_limit}. Need {tokens_needed} more tokens. Wait {wait_time:.1f}s"
        
        return True, None
    
    def _check_tpd(self, model_name: str, tokens: int, tpd_limit: int) -> Tuple[bool, Optional[str]]:
        """Check Tokens Per Day limit"""
        today = datetime.now().date().isoformat()
        
        if model_name not in self.daily_token_counters:
            self.daily_token_counters[model_name] = {"tokens": 0, "date": today}
        
        counter = self.daily_token_counters[model_name]
        
        # Reset if day has changed
        if counter["date"] != today:
            counter["tokens"] = 0
            counter["date"] = today
        
        if counter["tokens"] + tokens > tpd_limit:
            remaining = tpd_limit - counter["tokens"]
            return False, f"TPD limit {tpd_limit} exceeded. {remaining} tokens remaining today"
        
        return True, None
    
    def _record_request(self, model_name: str, tokens: int):
        """Record a successful request"""
        # Update RPM counter
        if model_name in self.request_counters:
            self.request_counters[model_name]["count"] += 1
        
        # Update TPD counter
        today = datetime.now().date().isoformat()
        if model_name in self.daily_token_counters:
            if self.daily_token_counters[model_name]["date"] == today:
                self.daily_token_counters[model_name]["tokens"] += tokens
        
        # Update TPM bucket (already decremented by _check_tpm)
        if model_name in self.token_buckets:
            self.token_buckets[model_name]["tokens"] -= tokens
        
        error_logger.log_info(f"[RateLimiter] Request recorded for {model_name}: {tokens} tokens")
    
    async def get_wait_time(
        self,
        model_name: str,
        estimated_tokens: int,
        tpm_limit: Optional[int] = None,
        rpm_limit: Optional[int] = None,
        tpd_limit: Optional[int] = None
    ) -> float:
        """
        Get the wait time (in seconds) until a request can be made
        Returns 0 if request can be made immediately
        """
        async with self.lock:
            wait_times = []
            
            # Check each limit and collect wait times
            if rpm_limit:
                now = time.time()
                if model_name in self.request_counters:
                    counter = self.request_counters[model_name]
                    window_elapsed = now - counter["window_start"]
                    if counter["count"] >= rpm_limit and window_elapsed < 60:
                        wait_times.append(60 - window_elapsed)
            
            if tpm_limit:
                now = time.time()
                if model_name in self.token_buckets:
                    bucket = self.token_buckets[model_name]
                    if bucket["tokens"] < estimated_tokens:
                        tokens_needed = estimated_tokens - bucket["tokens"]
                        wait_time = tokens_needed / (tpm_limit / 60)
                        wait_times.append(wait_time)
            
            if tpd_limit:
                today = datetime.now().date().isoformat()
                if model_name in self.daily_token_counters:
                    counter = self.daily_token_counters[model_name]
                    if counter["date"] == today and counter["tokens"] + estimated_tokens > tpd_limit:
                        remaining_tokens = tpd_limit - counter["tokens"]
                        if remaining_tokens <= 0:
                            # Wait until tomorrow
                            now = datetime.now()
                            tomorrow = (now + timedelta(days=1)).replace(hour=0, minute=0, second=0)
                            wait_time = (tomorrow - now).total_seconds()
                            wait_times.append(wait_time)
            
            return max(wait_times) if wait_times else 0


# Global rate limiter instance
rate_limiter = RateLimiter()
