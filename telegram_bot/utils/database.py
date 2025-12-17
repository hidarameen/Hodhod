"""
Database connection and operations
PostgreSQL database handler with async support
"""
import asyncpg
from typing import List, Dict, Any, Optional
from config.settings import settings
from utils.error_handler import ErrorLogger
import json

error_logger = ErrorLogger("database")

class Database:
    """PostgreSQL database handler"""

    def __init__(self):
        self.pool: Optional[asyncpg.Pool] = None

    async def connect(self):
        """Initialize database connection pool"""
        try:
            self.pool = await asyncpg.create_pool(
                settings.DATABASE_URL,
                min_size=5,
                max_size=20,
                command_timeout=60
            )
            error_logger.log_info("Database connected successfully")
        except Exception as e:
            error_logger.log_info(f"Database connection error: {str(e)}")
            raise

    async def disconnect(self):
        """Close database connection pool"""
        if self.pool:
            await self.pool.close()
            error_logger.log_info("Database disconnected")

    async def execute(self, query: str, *args) -> str:
        """Execute a query without returning results"""
        if not self.pool:
            raise Exception("Database not connected")
        async with self.pool.acquire() as conn:
            return await conn.execute(query, *args)

    async def fetch(self, query: str, *args) -> List[Dict[str, Any]]:
        """Fetch multiple rows"""
        if not self.pool:
            raise Exception("Database not connected")
        async with self.pool.acquire() as conn:
            rows = await conn.fetch(query, *args)
            return [dict(row) for row in rows]

    async def fetchrow(self, query: str, *args) -> Optional[Dict[str, Any]]:
        """Fetch single row"""
        if not self.pool:
            raise Exception("Database not connected")
        async with self.pool.acquire() as conn:
            row = await conn.fetchrow(query, *args)
            return dict(row) if row else None

    async def fetchval(self, query: str, *args) -> Any:
        """Fetch single value"""
        if not self.pool:
            raise Exception("Database not connected")
        async with self.pool.acquire() as conn:
            return await conn.fetchval(query, *args)

    # Admin Management
    async def is_admin(self, telegram_id: int) -> bool:
        """Check if user is admin"""
        result = await self.fetchval(
            "SELECT COUNT(*) FROM admins WHERE telegram_id = $1",
            str(telegram_id)
        )
        return result > 0

    async def add_admin(self, telegram_id: int, username: Optional[str] = None, added_by: Optional[int] = None):
        """Add new admin"""
        return await self.execute(
            """INSERT INTO admins (telegram_id, username, added_by) 
               VALUES ($1, $2, $3) ON CONFLICT (telegram_id) DO NOTHING""",
            str(telegram_id), username or "", added_by
        )

    async def get_admins(self) -> List[Dict[str, Any]]:
        """Get all admins"""
        return await self.fetch("SELECT * FROM admins ORDER BY created_at DESC")

    # Task Management
    async def create_task(self, task_data: Dict[str, Any]) -> int:
        """Create new forwarding task"""
        source_channels = json.dumps(task_data["source_channels"]) if isinstance(task_data["source_channels"], list) else task_data["source_channels"]
        target_channels = json.dumps(task_data["target_channels"]) if isinstance(task_data["target_channels"], list) else task_data["target_channels"]

        return await self.fetchval(
            """INSERT INTO forwarding_tasks 
               (name, description, source_channels, target_channels, 
                ai_enabled, video_processing_enabled)
               VALUES ($1, $2, $3, $4, $5, $6) RETURNING id""",
            task_data["name"],
            task_data.get("description", ""),
            source_channels,
            target_channels,
            task_data.get("ai_enabled", False),
            task_data.get("video_processing_enabled", False)
        )

    def _parse_task_json_fields(self, task: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Parse JSON string fields in task to proper Python objects"""
        if task is None:
            return None

        result = dict(task)

        # Parse source_channels if it's a string
        if 'source_channels' in result and isinstance(result['source_channels'], str):
            try:
                result['source_channels'] = json.loads(result['source_channels'])
            except (json.JSONDecodeError, TypeError):
                result['source_channels'] = []

        # Parse target_channels if it's a string
        if 'target_channels' in result and isinstance(result['target_channels'], str):
            try:
                result['target_channels'] = json.loads(result['target_channels'])
            except (json.JSONDecodeError, TypeError):
                result['target_channels'] = []

        return result

    async def get_task(self, task_id: int) -> Optional[Dict[str, Any]]:
        """Get task by ID"""
        task = await self.fetchrow(
            "SELECT * FROM forwarding_tasks WHERE id = $1",
            task_id
        )
        return self._parse_task_json_fields(task) if task else None

    async def get_active_tasks(self) -> List[Dict[str, Any]]:
        """Get all active tasks"""
        tasks = await self.fetch(
            "SELECT * FROM forwarding_tasks WHERE is_active = true"
        )
        return [parsed for parsed in [self._parse_task_json_fields(task) for task in tasks] if parsed is not None]

    async def update_task(self, task_id: int, updates: Dict[str, Any]):
        """Update task"""
        set_clauses = []
        values = []
        idx = 1

        for key, value in updates.items():
            set_clauses.append(f"{key} = ${idx}")
            values.append(value)
            idx += 1

        values.append(task_id)
        query = f"UPDATE forwarding_tasks SET {', '.join(set_clauses)} WHERE id = ${idx}"

        return await self.execute(query, *values)

    async def delete_task(self, task_id: int):
        """Delete task"""
        return await self.execute(
            "DELETE FROM forwarding_tasks WHERE id = $1",
            task_id
        )

    async def increment_task_counter(self, task_id: int):
        """Increment task forwarded counter"""
        return await self.execute(
            """UPDATE forwarding_tasks 
               SET total_forwarded = total_forwarded + 1,
                   last_forwarded_at = NOW()
               WHERE id = $1""",
            task_id
        )

    # Channel Management
    async def add_channel(self, channel_data: Dict[str, Any]) -> int:
        """Add new channel/group/website"""
        metadata = json.dumps(channel_data.get("metadata", {})) if isinstance(channel_data.get("metadata"), dict) else channel_data.get("metadata", "{}")

        return await self.fetchval(
            """INSERT INTO channels (type, identifier, title, description, metadata)
               VALUES ($1, $2, $3, $4, $5) RETURNING id""",
            channel_data["type"],
            channel_data["identifier"],
            channel_data.get("title", ""),
            channel_data.get("description", ""),
            metadata
        )

    async def get_channels(self, channel_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get all channels, optionally filtered by type"""
        if channel_type:
            return await self.fetch(
                "SELECT * FROM channels WHERE type = $1 AND is_active = true",
                channel_type
            )
        return await self.fetch("SELECT * FROM channels WHERE is_active = true")

    async def get_channel(self, channel_id: int) -> Optional[Dict[str, Any]]:
        """Get channel by ID"""
        return await self.fetchrow(
            "SELECT * FROM channels WHERE id = $1",
            channel_id
        )

    # AI Providers and Models Management
    async def get_ai_provider(self, provider_id: int) -> Optional[Dict[str, Any]]:
        """Get AI provider by ID"""
        return await self.fetchrow(
            "SELECT * FROM ai_providers WHERE id = $1",
            provider_id
        )

    async def get_ai_provider_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Get AI provider by name"""
        return await self.fetchrow(
            "SELECT * FROM ai_providers WHERE name = $1",
            name
        )

    async def get_ai_model(self, model_id: int) -> Optional[Dict[str, Any]]:
        """Get AI model by ID"""
        return await self.fetchrow(
            "SELECT * FROM ai_models WHERE id = $1",
            model_id
        )

    async def get_active_providers(self) -> List[Dict[str, Any]]:
        """Get all active AI providers"""
        return await self.fetch(
            "SELECT * FROM ai_providers WHERE is_active = true"
        )

    # AI Rules Management
    async def add_ai_rule(self, rule_data: Dict[str, Any]) -> int:
        """Add AI rule for task"""
        config = json.dumps(rule_data.get("config")) if rule_data.get("config") else None

        return await self.fetchval(
            """INSERT INTO ai_rules (task_id, type, category, name, prompt, config, priority)
               VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id""",
            rule_data["task_id"],
            rule_data["type"],
            rule_data.get("category", "general"),
            rule_data["name"],
            rule_data["prompt"],
            config,
            rule_data.get("priority", 0)
        )

    async def get_task_rules(self, task_id: int) -> List[Dict[str, Any]]:
        """Get all active rules for a task"""
        return await self.fetch(
            """SELECT * FROM ai_rules 
               WHERE task_id = $1 AND is_active = true 
               ORDER BY priority DESC""",
            task_id
        )

    async def update_rule(self, rule_id: int, updates: Dict[str, Any]):
        """Update AI rule"""
        set_clauses = []
        values = []
        idx = 1

        allowed_fields = ['type', 'category', 'name', 'prompt', 'config', 'is_active', 'priority']

        for key in allowed_fields:
            if key in updates:
                value = updates[key]
                if key == 'config' and value is not None:
                    value = json.dumps(value) if isinstance(value, dict) else value
                set_clauses.append(f"{key} = ${idx}")
                values.append(value)
                idx += 1

        if not set_clauses:
            return

        values.append(rule_id)
        query = f"UPDATE ai_rules SET {', '.join(set_clauses)} WHERE id = ${idx}"

        return await self.execute(query, *values)

    async def delete_rule(self, rule_id: int):
        """Delete AI rule"""
        return await self.execute("DELETE FROM ai_rules WHERE id = $1", rule_id)

    # Statistics
    async def update_task_stats(self, task_id: int, stat_type: str, date_str: Optional[str] = None):
        """Update task statistics"""
        from datetime import datetime, date as date_type
        
        if date_str:
            stat_date = datetime.strptime(date_str, "%Y-%m-%d").date().isoformat()
        else:
            stat_date = datetime.utcnow().date().isoformat()

        column_map = {
            "forwarded": "messages_forwarded",
            "processed": "messages_processed",
            "ai": "ai_processed",
            "video": "video_processed",
            "error": "errors"
        }

        column = column_map.get(stat_type, "messages_forwarded")

        try:
            return await self.execute(
                f"""INSERT INTO task_stats (task_id, date, {column})
                    VALUES ($1, $2, 1)
                    ON CONFLICT (task_id, date) 
                    DO UPDATE SET {column} = task_stats.{column} + 1""",
                task_id, stat_date
            )
        except Exception as e:
            if "no unique or exclusion constraint" in str(e):
                update_result = await self.execute(
                    f"""UPDATE task_stats 
                       SET {column} = {column} + 1
                       WHERE task_id = $1 AND date = $2""",
                    task_id, stat_date
                )
                if update_result == "UPDATE 0":
                    await self.execute(
                        f"""INSERT INTO task_stats (task_id, date, {column})
                            VALUES ($1, $2, 1)""",
                        task_id, stat_date
                    )
                return update_result
            else:
                raise

    async def get_task_stats(self, task_id: int, days: int = 7) -> List[Dict[str, Any]]:
        """Get task statistics for last N days"""
        return await self.fetch(
            """SELECT * FROM task_stats 
               WHERE task_id = $1 
               ORDER BY date DESC 
               LIMIT $2""",
            task_id, days
        )

    # Queue Management
    async def add_queue_job(self, job_data: Dict[str, Any]) -> int:
        """Add job to queue"""
        payload = json.dumps(job_data["payload"]) if isinstance(job_data["payload"], dict) else job_data["payload"]

        return await self.fetchval(
            """INSERT INTO queue_jobs (task_id, type, payload, priority, max_attempts)
               VALUES ($1, $2, $3, $4, $5) RETURNING id""",
            job_data.get("task_id"),
            job_data["type"],
            payload,
            job_data.get("priority", 0),
            job_data.get("max_attempts", 3)
        )

    async def get_pending_jobs(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get pending jobs from queue"""
        return await self.fetch(
            """SELECT * FROM queue_jobs 
               WHERE status = 'pending' 
               ORDER BY priority DESC, created_at ASC 
               LIMIT $1""",
            limit
        )

    async def update_job_status(
        self, 
        job_id: int, 
        status: str, 
        result: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None
    ):
        """Update job status"""
        result_json = json.dumps(result) if result else None
        return await self.execute(
            """UPDATE queue_jobs 
               SET status = $1, result = $2, error = $3, 
                   processed_at = NOW(), attempts = attempts + 1
               WHERE id = $4""",
            status, result_json, error or "", job_id
        )

    # Bot Settings
    async def get_setting(self, key: str) -> Optional[str]:
        """Get bot config setting by key"""
        result = await self.fetchrow(
            "SELECT value FROM bot_config WHERE key = $1",
            key
        )
        return result["value"] if result else None

    async def set_setting(self, key: str, value: str, description: Optional[str] = None):
        """Set bot config setting"""
        return await self.execute(
            """INSERT INTO bot_config (key, value, description)
               VALUES ($1, $2, $3)
               ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()""",
            key, value, description or ""
        )

    # ============================================
    # Advanced AI Rules - Training Examples
    # ============================================

    async def get_training_examples(self, task_id: Optional[int] = None, 
                                     example_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get training examples for a task"""
        if task_id and example_type:
            return await self.fetch(
                """SELECT * FROM ai_training_examples 
                   WHERE task_id = $1 AND example_type = $2 AND is_active = true
                   ORDER BY use_count DESC, created_at DESC""",
                task_id, example_type
            )
        elif task_id:
            return await self.fetch(
                """SELECT * FROM ai_training_examples 
                   WHERE task_id = $1 AND is_active = true
                   ORDER BY use_count DESC, created_at DESC""",
                task_id
            )
        elif example_type:
            return await self.fetch(
                """SELECT * FROM ai_training_examples 
                   WHERE example_type = $1 AND is_active = true
                   ORDER BY use_count DESC, created_at DESC""",
                example_type
            )
        else:
            return await self.fetch(
                """SELECT * FROM ai_training_examples 
                   WHERE is_active = true
                   ORDER BY use_count DESC, created_at DESC
                   LIMIT 100"""
            )

    async def add_training_example(self, data: Dict[str, Any]) -> int:
        """Add new training example"""
        if not data.get("task_id"):
            raise ValueError("task_id is required for training examples")

        tags = json.dumps(data.get("tags", [])) if data.get("tags") else None

        return await self.fetchval(
            """INSERT INTO ai_training_examples 
               (task_id, example_type, input_text, expected_output, 
                explanation, tags, is_active)
               VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id""",
            data["task_id"],
            data["example_type"],
            data["input_text"],
            data["expected_output"],
            data.get("explanation"),
            tags,
            data.get("is_active", True)
        )

    async def update_training_example(self, example_id: int, data: Dict[str, Any]):
        """Update training example"""
        fields = []
        values = []
        param_count = 1

        allowed_fields = ['example_type', 'input_text', 'expected_output', 
                          'explanation', 'is_active']

        for field in allowed_fields:
            if field in data:
                fields.append(f"{field} = ${param_count}")
                values.append(data[field])
                param_count += 1

        if 'tags' in data:
            fields.append(f"tags = ${param_count}")
            values.append(json.dumps(data['tags']) if data['tags'] else None)
            param_count += 1

        if not fields:
            return

        values.append(example_id)
        query = f"UPDATE ai_training_examples SET {', '.join(fields)} WHERE id = ${param_count}"
        return await self.execute(query, *values)

    async def increment_example_use_count(self, example_id: int):
        """Increment use count for training example"""
        return await self.execute(
            "UPDATE ai_training_examples SET use_count = use_count + 1 WHERE id = $1",
            example_id
        )

    async def delete_training_example(self, example_id: int):
        """Delete training example"""
        return await self.execute(
            "DELETE FROM ai_training_examples WHERE id = $1",
            example_id
        )

    # ============================================
    # Advanced AI Rules - Entity Replacements
    # ============================================

    async def get_entity_replacements(self, task_id: int) -> List[Dict[str, Any]]:
        """Get entity replacement rules for a task"""
        return await self.fetch(
            """SELECT * FROM ai_entity_replacements 
               WHERE task_id = $1 AND is_active = true
               ORDER BY priority DESC, created_at ASC""",
            task_id
        )

    async def add_entity_replacement(self, data: Dict[str, Any]) -> int:
        """Add new entity replacement rule"""
        return await self.fetchval(
            """INSERT INTO ai_entity_replacements 
               (task_id, entity_type, original_text, replacement_text, 
                case_sensitive, use_context, is_active, priority)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id""",
            data["task_id"],
            data.get("entity_type", "custom"),
            data["original_text"],
            data["replacement_text"],
            data.get("case_sensitive", False),
            data.get("use_context", True),
            data.get("is_active", True),
            data.get("priority", 0)
        )

    async def update_entity_replacement(self, replacement_id: int, data: Dict[str, Any]):
        """Update entity replacement rule"""
        fields = []
        values = []
        param_count = 1

        allowed_fields = ['entity_type', 'original_text', 'replacement_text', 
                          'case_sensitive', 'use_context', 'is_active', 'priority']

        for field in allowed_fields:
            if field in data:
                fields.append(f"{field} = ${param_count}")
                values.append(data[field])
                param_count += 1

        if not fields:
            return

        values.append(replacement_id)
        query = f"UPDATE ai_entity_replacements SET {', '.join(fields)} WHERE id = ${param_count}"
        return await self.execute(query, *values)

    async def delete_entity_replacement(self, replacement_id: int):
        """Delete entity replacement rule"""
        return await self.execute(
            "DELETE FROM ai_entity_replacements WHERE id = $1",
            replacement_id
        )

    # ============================================
    # Advanced AI Rules - Context Rules
    # ============================================

    async def get_context_rules(self, task_id: int) -> List[Dict[str, Any]]:
        """Get context modification rules for a task"""
        return await self.fetch(
            """SELECT * FROM ai_context_rules 
               WHERE task_id = $1 AND is_active = true
               ORDER BY priority DESC, created_at ASC""",
            task_id
        )

    async def add_context_rule(self, data: Dict[str, Any]) -> int:
        """Add new context rule"""
        examples = json.dumps(data.get("examples", [])) if data.get("examples") else None

        return await self.fetchval(
            """INSERT INTO ai_context_rules 
               (task_id, rule_type, trigger_pattern, target_sentiment, 
                instructions, examples, is_active, priority)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id""",
            data["task_id"],
            data["rule_type"],
            data.get("trigger_pattern"),
            data.get("target_sentiment"),
            data["instructions"],
            examples,
            data.get("is_active", True),
            data.get("priority", 0)
        )

    async def update_context_rule(self, rule_id: int, data: Dict[str, Any]):
        """Update context rule"""
        fields = []
        values = []
        param_count = 1

        allowed_fields = ['rule_type', 'trigger_pattern', 'target_sentiment', 
                          'instructions', 'is_active', 'priority']

        for field in allowed_fields:
            if field in data:
                fields.append(f"{field} = ${param_count}")
                values.append(data[field])
                param_count += 1

        if 'examples' in data:
            fields.append(f"examples = ${param_count}")
            values.append(json.dumps(data['examples']) if data['examples'] else None)
            param_count += 1

        if not fields:
            return

        values.append(rule_id)
        query = f"UPDATE ai_context_rules SET {', '.join(fields)} WHERE id = ${param_count}"
        return await self.execute(query, *values)

    async def delete_context_rule(self, rule_id: int):
        """Delete context rule"""
        return await self.execute(
            "DELETE FROM ai_context_rules WHERE id = $1",
            rule_id
        )

    # ============================================
    # Advanced AI Rules - Training Examples
    # ============================================

    async def get_training_examples(self, task_id: Optional[int] = None, 
                                     example_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get training examples"""
        if task_id and example_type:
            return await self.fetch(
                """SELECT * FROM ai_training_examples 
                   WHERE task_id = $1 AND example_type = $2 AND is_active = true
                   ORDER BY use_count DESC, created_at DESC""",
                task_id, example_type
            )
        elif task_id:
            return await self.fetch(
                """SELECT * FROM ai_training_examples 
                   WHERE task_id = $1 AND is_active = true
                   ORDER BY use_count DESC, created_at DESC""",
                task_id
            )
        elif example_type:
            return await self.fetch(
                """SELECT * FROM ai_training_examples 
                   WHERE example_type = $1 AND is_active = true
                   ORDER BY use_count DESC, created_at DESC""",
                example_type
            )
        else:
            return await self.fetch(
                """SELECT * FROM ai_training_examples 
                   WHERE is_active = true
                   ORDER BY use_count DESC, created_at DESC
                   LIMIT 100"""
            )

    async def add_training_example(self, data: Dict[str, Any]) -> int:
        """Add new training example"""
        if not data.get("task_id"):
            raise ValueError("task_id is required for training examples")

        tags = json.dumps(data.get("tags", [])) if data.get("tags") else None

        return await self.fetchval(
            """INSERT INTO ai_training_examples 
               (task_id, example_type, input_text, expected_output, 
                explanation, tags, is_active)
               VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id""",
            data["task_id"],
            data["example_type"],
            data["input_text"],
            data["expected_output"],
            data.get("explanation"),
            tags,
            data.get("is_active", True)
        )

    async def increment_example_use_count(self, example_id: int):
        """Increment use count for training example"""
        return await self.execute(
            "UPDATE ai_training_examples SET use_count = use_count + 1 WHERE id = $1",
            example_id
        )

    async def delete_training_example(self, example_id: int):
        """Delete training example"""
        return await self.execute(
            "DELETE FROM ai_training_examples WHERE id = $1",
            example_id
        )

    # ============================================
    # Advanced AI Rules - Processing Config
    # ============================================

    async def get_processing_config(self, task_id: Optional[int] = None) -> Optional[Dict[str, Any]]:
        """Get processing configuration"""
        if task_id:
            config = await self.fetchrow(
                """SELECT * FROM ai_processing_config 
                   WHERE task_id = $1""",
                task_id
            )
            if config:
                return dict(config)

        global_config = await self.fetchrow(
            """SELECT * FROM ai_processing_config 
               WHERE config_type = 'global' AND task_id IS NULL"""
        )
        return dict(global_config) if global_config else None

    async def save_processing_config(self, data: Dict[str, Any]) -> int:
        """Save processing configuration"""
        task_id = data.get("task_id")
        config_type = data.get("config_type", "task_specific" if task_id else "global")

        existing = None
        if task_id:
            existing = await self.fetchrow(
                "SELECT id FROM ai_processing_config WHERE task_id = $1",
                task_id
            )
        else:
            existing = await self.fetchrow(
                "SELECT id FROM ai_processing_config WHERE config_type = 'global' AND task_id IS NULL"
            )

        if existing:
            return await self.fetchval(
                """UPDATE ai_processing_config SET
                   enable_entity_extraction = $1,
                   enable_sentiment_analysis = $2,
                   enable_keyword_detection = $3,
                   max_retries = $4,
                   timeout_seconds = $5,
                   preserve_formatting = $6,
                   enable_output_validation = $7,
                   enable_rule_verification = $8,
                   output_format = $9,
                   temperature = $10,
                   quality_level = $11,
                   updated_at = NOW()
                   WHERE id = $12 RETURNING id""",
                data.get("enable_entity_extraction", True),
                data.get("enable_sentiment_analysis", True),
                data.get("enable_keyword_detection", True),
                data.get("max_retries", 3),
                data.get("timeout_seconds", 60),
                data.get("preserve_formatting", True),
                data.get("enable_output_validation", True),
                data.get("enable_rule_verification", True),
                data.get("output_format", "markdown"),
                str(data.get("temperature", "0.7")),
                data.get("quality_level", "balanced"),
                existing["id"]
            )
        else:
            return await self.fetchval(
                """INSERT INTO ai_processing_config 
                   (task_id, config_type, enable_entity_extraction, enable_sentiment_analysis,
                    enable_keyword_detection, max_retries, timeout_seconds, preserve_formatting,
                    enable_output_validation, enable_rule_verification, output_format,
                    temperature, quality_level)
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id""",
                task_id,
                config_type,
                data.get("enable_entity_extraction", True),
                data.get("enable_sentiment_analysis", True),
                data.get("enable_keyword_detection", True),
                data.get("max_retries", 3),
                data.get("timeout_seconds", 60),
                data.get("preserve_formatting", True),
                data.get("enable_output_validation", True),
                data.get("enable_rule_verification", True),
                data.get("output_format", "markdown"),
                str(data.get("temperature", "0.7")),
                data.get("quality_level", "balanced")
            )

    # ============================================
    # AI Content Filters
    # ============================================

    async def get_content_filters(self, task_id: int) -> List[Dict[str, Any]]:
        """Get content filters for a task"""
        rows = await self.fetch(
            """SELECT * FROM ai_content_filters 
               WHERE task_id = $1 AND is_active = true
               ORDER BY priority DESC, created_at ASC""",
            task_id
        )
        return [dict(row) for row in rows]

    async def add_content_filter(self, data: Dict[str, Any]) -> int:
        """Add new content filter"""
        return await self.fetchval(
            """INSERT INTO ai_content_filters 
               (task_id, name, filter_type, match_type, pattern, context_description,
                sentiment_target, action, modify_instructions, is_active, priority)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id""",
            data["task_id"],
            data["name"],
            data["filter_type"],
            data["match_type"],
            data["pattern"],
            data.get("context_description"),
            data.get("sentiment_target"),
            data.get("action", "skip"),
            data.get("modify_instructions"),
            data.get("is_active", True),
            data.get("priority", 0)
        )

    async def update_content_filter(self, filter_id: int, data: Dict[str, Any]):
        """Update content filter"""
        fields = []
        values = []
        param_count = 1

        allowed_fields = ['name', 'filter_type', 'match_type', 'pattern', 
                          'context_description', 'sentiment_target', 'action',
                          'modify_instructions', 'is_active', 'priority']

        for field in allowed_fields:
            if field in data:
                fields.append(f"{field} = ${param_count}")
                values.append(data[field])
                param_count += 1

        if not fields:
            return

        values.append(filter_id)
        query = f"UPDATE ai_content_filters SET {', '.join(fields)} WHERE id = ${param_count}"
        return await self.execute(query, *values)

    async def delete_content_filter(self, filter_id: int):
        """Delete content filter"""
        return await self.execute(
            "DELETE FROM ai_content_filters WHERE id = $1",
            filter_id
        )

    async def increment_filter_match_count(self, filter_id: int):
        """Increment match count for content filter"""
        return await self.execute(
            "UPDATE ai_content_filters SET match_count = match_count + 1 WHERE id = $1",
            filter_id
        )

    # ============================================
    # AI Publishing Templates
    # ============================================

    async def get_publishing_templates(self, task_id: int) -> List[Dict[str, Any]]:
        """Get publishing templates for a task"""
        rows = await self.fetch(
            """SELECT * FROM ai_publishing_templates 
               WHERE task_id = $1 AND is_active = true
               ORDER BY is_default DESC, created_at ASC""",
            task_id
        )
        return [dict(row) for row in rows]

    async def get_default_template(self, task_id: int) -> Optional[Dict[str, Any]]:
        """Get default publishing template for a task"""
        row = await self.fetchrow(
            """SELECT * FROM ai_publishing_templates 
               WHERE task_id = $1 AND is_default = true AND is_active = true
               LIMIT 1""",
            task_id
        )
        return dict(row) if row else None

    async def add_publishing_template(self, data: Dict[str, Any]) -> int:
        """Add new publishing template"""
        if data.get("is_default"):
            await self.execute(
                "UPDATE ai_publishing_templates SET is_default = false WHERE task_id = $1",
                data["task_id"]
            )

        return await self.fetchval(
            """INSERT INTO ai_publishing_templates 
               (task_id, name, is_default, template_type, header_text,
                header_formatting, footer_text, footer_formatting, field_separator,
                use_newline_after_header, use_newline_before_footer, max_length,
                extraction_prompt, is_active)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id""",
            data["task_id"],
            data["name"],
            data.get("is_default", False),
            data.get("template_type", "custom"),
            data.get("header_text"),
            data.get("header_formatting", "none"),
            data.get("footer_text"),
            data.get("footer_formatting", "none"),
            data.get("field_separator", "\n"),
            data.get("use_newline_after_header", True),
            data.get("use_newline_before_footer", True),
            data.get("max_length"),
            data.get("extraction_prompt"),
            data.get("is_active", True)
        )

    async def update_publishing_template(self, template_id: int, data: Dict[str, Any]):
        """Update publishing template"""
        if data.get("is_default") and data.get("task_id"):
            await self.execute(
                "UPDATE ai_publishing_templates SET is_default = false WHERE task_id = $1",
                data["task_id"]
            )

        fields = []
        values = []
        param_count = 1

        allowed_fields = ['name', 'is_default', 'template_type', 'header_text',
                          'header_formatting', 'footer_text', 'footer_formatting',
                          'field_separator', 'use_newline_after_header', 
                          'use_newline_before_footer', 'max_length', 
                          'extraction_prompt', 'is_active']

        for field in allowed_fields:
            if field in data:
                fields.append(f"{field} = ${param_count}")
                values.append(data[field])
                param_count += 1

        fields.append(f"updated_at = NOW()")

        if not values:
            return

        values.append(template_id)
        query = f"UPDATE ai_publishing_templates SET {', '.join(fields)} WHERE id = ${param_count}"
        return await self.execute(query, *values)

    async def delete_publishing_template(self, template_id: int):
        """Delete publishing template"""
        return await self.execute(
            "DELETE FROM ai_publishing_templates WHERE id = $1",
            template_id
        )

    # ============================================
    # Template Custom Fields
    # ============================================

    async def get_template_custom_fields(self, template_id: int) -> List[Dict[str, Any]]:
        """Get custom fields for a publishing template"""
        rows = await self.fetch(
            """SELECT * FROM template_custom_fields 
               WHERE template_id = $1 AND is_active = true
               ORDER BY display_order ASC""",
            template_id
        )
        return [dict(row) for row in rows]

    async def get_default_template_with_fields(self, task_id: int) -> Optional[Dict[str, Any]]:
        """Get default publishing template for a task with its custom fields"""
        template = await self.fetchrow(
            """SELECT * FROM ai_publishing_templates 
               WHERE task_id = $1 AND is_default = true AND is_active = true
               LIMIT 1""",
            task_id
        )
        if not template:
            return None

        template_dict = dict(template)
        custom_fields = await self.get_template_custom_fields(template_dict['id'])
        template_dict['custom_fields'] = custom_fields
        # ✅ FIX: Also populate 'fields' key for consistency with _apply_publishing_template
        template_dict['fields'] = custom_fields
        return template_dict

    async def get_task_publishing_template(self, task_id: int) -> Optional[Dict[str, Any]]:
        """Get default publishing template for a task with fields formatted for AI extraction"""
        template = await self.fetchrow(
            """SELECT * FROM ai_publishing_templates 
               WHERE task_id = $1 AND is_default = true AND is_active = true
               LIMIT 1""",
            task_id
        )
        if not template:
            return None

        template_dict = dict(template)
        custom_fields = await self.get_template_custom_fields(template_dict['id'])
        
        # Format fields for AI extraction pipeline
        fields = []
        for field in custom_fields:
            fields.append({
                "field_name": field.get("field_name"),
                "field_label": field.get("field_label"),
                "field_type": field.get("field_type", "extracted"),
                "extraction_instructions": field.get("extraction_instructions", ""),
                "default_value": field.get("default_value", ""),
                "use_default_if_empty": field.get("use_default_if_empty", True),
                "formatting": field.get("formatting", "none"),
                "show_label": field.get("show_label", True),  # ✅ FIX: Default to True so labels SHOW
                "label_separator": field.get("label_separator", ": "),
                "prefix": field.get("prefix", ""),
                "suffix": field.get("suffix", ""),
                "display_order": field.get("display_order", 0),
                "is_active": field.get("is_active", True)
            })
        
        template_dict['fields'] = fields
        return template_dict

    async def add_template_custom_field(self, data: Dict[str, Any]) -> int:
        """Add new custom field to a template"""
        return await self.fetchval(
            """INSERT INTO template_custom_fields 
               (template_id, field_name, field_label, extraction_instructions,
                default_value, use_default_if_empty, formatting, display_order,
                show_label, label_separator, prefix, suffix, field_type, is_active)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING id""",
            data["template_id"],
            data["field_name"],
            data["field_label"],
            data["extraction_instructions"],
            data.get("default_value"),
            data.get("use_default_if_empty", True),
            data.get("formatting", "none"),
            data.get("display_order", 0),
            data.get("show_label", False),
            data.get("label_separator", ": "),
            data.get("prefix"),
            data.get("suffix"),
            data.get("field_type", "extracted"),
            data.get("is_active", True)
        )

    async def update_template_custom_field(self, field_id: int, data: Dict[str, Any]):
        """Update custom field"""
        fields = []
        values = []
        param_count = 1

        allowed_fields = ['field_name', 'field_label', 'extraction_instructions',
                          'default_value', 'use_default_if_empty', 'formatting',
                          'display_order', 'show_label', 'label_separator',
                          'prefix', 'suffix', 'field_type', 'is_active']

        for field in allowed_fields:
            if field in data:
                fields.append(f"{field} = ${param_count}")
                values.append(data[field])
                param_count += 1

        if not values:
            return

        values.append(field_id)
        query = f"UPDATE template_custom_fields SET {', '.join(fields)} WHERE id = ${param_count}"
        return await self.execute(query, *values)

    async def delete_template_custom_field(self, field_id: int):
        """Delete custom field"""
        return await self.execute(
            "DELETE FROM template_custom_fields WHERE id = $1",
            field_id
        )

    # ============================================
    # Message Archive
    # ============================================

    async def get_next_serial_number(self, task_id: int) -> int:
        """Get the next serial number for a task (رقم القيد)"""
        existing = await self.fetchrow(
            "SELECT last_serial FROM archive_serial_counter WHERE task_id = $1",
            task_id
        )

        if existing:
            new_serial = existing['last_serial'] + 1
            await self.execute(
                "UPDATE archive_serial_counter SET last_serial = $1, updated_at = NOW() WHERE task_id = $2",
                new_serial, task_id
            )
            return new_serial
        else:
            await self.execute(
                "INSERT INTO archive_serial_counter (task_id, last_serial) VALUES ($1, 1)",
                task_id
            )
            return 1

    async def create_archive_message(self, data: Dict[str, Any]) -> int:
        """Create a new archive message entry"""
        import json

        def to_int(val):
            """Convert value to int, handling strings"""
            if val is None:
                return None
            try:
                return int(val)
            except (ValueError, TypeError):
                return None

        tags_json = json.dumps(data.get('tags', [])) if data.get('tags') else None
        extracted_fields_json = json.dumps(data.get('extracted_fields', {})) if data.get('extracted_fields') else None

        return await self.fetchval(
            """INSERT INTO message_archive 
               (task_id, serial_number, source_message_id, source_channel_id, source_channel_title,
                target_channel_id, target_channel_title, target_message_id, title, original_text,
                processed_text, published_text, telegraph_url, telegraph_title, classification,
                news_type, province, specialist, tags, extracted_fields, has_media, media_type,
                media_count, media_group_id, processing_duration, ai_provider, ai_model, template_name,
                status, is_edited, is_pinned, is_flagged, flag_reason, notes)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34)
               RETURNING id""",
            to_int(data['task_id']),
            to_int(data['serial_number']),
            str(data.get('source_message_id')) if data.get('source_message_id') else None,
            str(data.get('source_channel_id')) if data.get('source_channel_id') else None,
            data.get('source_channel_title'),
            str(data.get('target_channel_id')) if data.get('target_channel_id') else None,
            data.get('target_channel_title'),
            str(data.get('target_message_id')) if data.get('target_message_id') else None,
            data.get('title'),
            data.get('original_text'),
            data.get('processed_text'),
            data.get('published_text'),
            data.get('telegraph_url'),
            data.get('telegraph_title'),
            data.get('classification'),
            data.get('news_type'),
            data.get('province'),
            data.get('specialist'),
            tags_json,
            extracted_fields_json,
            bool(data.get('has_media', False)),
            data.get('media_type'),
            to_int(data.get('media_count', 0)) or 0,
            data.get('media_group_id'),
            to_int(data.get('processing_duration')),
            data.get('ai_provider'),
            data.get('ai_model'),
            data.get('template_name'),
            data.get('status', 'published'),
            bool(data.get('is_edited', False)),
            bool(data.get('is_pinned', False)),
            bool(data.get('is_flagged', False)),
            data.get('flag_reason'),
            data.get('notes')
        )

    async def get_archive_message(self, message_id: int) -> Optional[Dict[str, Any]]:
        """Get archive message by ID"""
        return await self.fetchrow(
            "SELECT * FROM message_archive WHERE id = $1",
            message_id
        )

    async def update_archive_message(self, message_id: int, data: Dict[str, Any]):
        """Update archive message"""
        import json

        fields = []
        values = []
        param_count = 1

        for key, value in data.items():
            if key in ['id', 'created_at']:
                continue
            if key in ['tags', 'extracted_fields']:
                value = json.dumps(value) if value else None
            fields.append(f"{key} = ${param_count}")
            values.append(value)
            param_count += 1

        if not values:
            return

        fields.append(f"updated_at = NOW()")
        values.append(message_id)

        query = f"UPDATE message_archive SET {', '.join(fields)} WHERE id = ${param_count}"
        return await self.execute(query, *values)

    async def generate_title_from_text(self, text: str, ai_manager=None) -> Optional[str]:
        """Generate a title from text using AI"""
        if not text or len(text.strip()) < 10:
            return None

        if ai_manager:
            try:
                prompt = f"""قم بإنشاء عنوان قصير ومختصر (5-10 كلمات) لهذا النص:

{text[:500]}

أعد العنوان فقط بدون أي شرح أو علامات ترقيم إضافية."""

                title = await ai_manager.generate(
                    provider="groq",
                    model="mixtral-8x7b-32768",
                    prompt=prompt,
                    max_tokens=50,
                    temperature=0.3
                )
                if title:
                    return title.strip()[:200]
            except Exception:
                pass

        first_line = text.split('\n')[0].strip()
        if len(first_line) > 10:
            return first_line[:100] + ('...' if len(first_line) > 100 else '')
        return text[:100] + ('...' if len(text) > 100 else '')

# Global database instance
db = Database()