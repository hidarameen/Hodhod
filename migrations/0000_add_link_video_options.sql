CREATE TABLE "admins" (
        "id" serial PRIMARY KEY NOT NULL,
        "telegram_id" text NOT NULL,
        "username" text,
        "added_by" integer,
        "created_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "admins_telegram_id_unique" UNIQUE("telegram_id")
);
--> statement-breakpoint
CREATE TABLE "ai_models" (
        "id" serial PRIMARY KEY NOT NULL,
        "provider_id" integer NOT NULL,
        "model_name" text NOT NULL,
        "display_name" text NOT NULL,
        "capabilities" jsonb,
        "is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_providers" (
        "id" serial PRIMARY KEY NOT NULL,
        "name" text NOT NULL,
        "api_key" text,
        "is_active" boolean DEFAULT true NOT NULL,
        "config" jsonb,
        "created_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "ai_providers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "ai_rules" (
        "id" serial PRIMARY KEY NOT NULL,
        "task_id" integer NOT NULL,
        "type" text NOT NULL,
        "name" text NOT NULL,
        "prompt" text NOT NULL,
        "is_active" boolean DEFAULT true NOT NULL,
        "priority" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bot_config" (
        "id" serial PRIMARY KEY NOT NULL,
        "key" text NOT NULL,
        "value" text NOT NULL,
        "description" text,
        "updated_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "bot_config_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "channels" (
        "id" serial PRIMARY KEY NOT NULL,
        "type" text NOT NULL,
        "identifier" text NOT NULL,
        "title" text,
        "description" text,
        "metadata" jsonb,
        "is_active" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "error_logs" (
        "id" serial PRIMARY KEY NOT NULL,
        "component" text NOT NULL,
        "function" text NOT NULL,
        "error_type" text NOT NULL,
        "error_message" text NOT NULL,
        "stack_trace" text,
        "metadata" jsonb,
        "timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forwarding_tasks" (
        "id" serial PRIMARY KEY NOT NULL,
        "name" text NOT NULL,
        "description" text,
        "is_active" boolean DEFAULT true NOT NULL,
        "source_channels" jsonb NOT NULL,
        "target_channels" jsonb NOT NULL,
        "ai_enabled" boolean DEFAULT false NOT NULL,
        "ai_provider_id" integer,
        "ai_model_id" integer,
        "summarization_enabled" boolean DEFAULT false NOT NULL,
        "summarization_provider_id" integer,
        "summarization_model_id" integer,
        "video_processing_enabled" boolean DEFAULT false NOT NULL,
        "video_ai_provider_id" integer,
        "video_ai_model_id" integer,
        "link_processing_enabled" boolean DEFAULT false NOT NULL,
        "link_video_download_enabled" boolean DEFAULT true NOT NULL,
        "link_video_quality" text DEFAULT 'high' NOT NULL,
        "total_forwarded" integer DEFAULT 0 NOT NULL,
        "last_forwarded_at" timestamp,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "queue_jobs" (
        "id" serial PRIMARY KEY NOT NULL,
        "task_id" integer,
        "type" text NOT NULL,
        "status" text DEFAULT 'pending' NOT NULL,
        "priority" integer DEFAULT 0 NOT NULL,
        "payload" jsonb NOT NULL,
        "result" jsonb,
        "attempts" integer DEFAULT 0 NOT NULL,
        "max_attempts" integer DEFAULT 3 NOT NULL,
        "error" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "processed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "task_logs" (
        "id" serial PRIMARY KEY NOT NULL,
        "task_id" integer,
        "level" text NOT NULL,
        "message" text NOT NULL,
        "metadata" jsonb,
        "timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_stats" (
        "id" serial PRIMARY KEY NOT NULL,
        "task_id" integer NOT NULL,
        "date" text NOT NULL,
        "messages_forwarded" integer DEFAULT 0 NOT NULL,
        "messages_processed" integer DEFAULT 0 NOT NULL,
        "ai_processed" integer DEFAULT 0 NOT NULL,
        "video_processed" integer DEFAULT 0 NOT NULL,
        "errors" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "userbot_sessions" (
        "id" serial PRIMARY KEY NOT NULL,
        "phone_number" text NOT NULL,
        "session_string" text,
        "is_active" boolean DEFAULT false NOT NULL,
        "is_primary" boolean DEFAULT false NOT NULL,
        "status" text DEFAULT 'pending' NOT NULL,
        "login_state" jsonb,
        "last_login_at" timestamp,
        "error_message" text,
        "created_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
        "id" serial PRIMARY KEY NOT NULL,
        "username" text NOT NULL,
        "password" text NOT NULL,
        "role" text DEFAULT 'user' NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL,
        CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "github_settings" (
        "id" serial PRIMARY KEY NOT NULL,
        "repo_owner" text NOT NULL,
        "repo_name" text NOT NULL,
        "linked_at" timestamp DEFAULT now() NOT NULL,
        "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_provider_id_ai_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."ai_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_rules" ADD CONSTRAINT "ai_rules_task_id_forwarding_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."forwarding_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forwarding_tasks" ADD CONSTRAINT "forwarding_tasks_ai_provider_id_ai_providers_id_fk" FOREIGN KEY ("ai_provider_id") REFERENCES "public"."ai_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forwarding_tasks" ADD CONSTRAINT "forwarding_tasks_ai_model_id_ai_models_id_fk" FOREIGN KEY ("ai_model_id") REFERENCES "public"."ai_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forwarding_tasks" ADD CONSTRAINT "forwarding_tasks_summarization_provider_id_ai_providers_id_fk" FOREIGN KEY ("summarization_provider_id") REFERENCES "public"."ai_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forwarding_tasks" ADD CONSTRAINT "forwarding_tasks_summarization_model_id_ai_models_id_fk" FOREIGN KEY ("summarization_model_id") REFERENCES "public"."ai_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forwarding_tasks" ADD CONSTRAINT "forwarding_tasks_video_ai_provider_id_ai_providers_id_fk" FOREIGN KEY ("video_ai_provider_id") REFERENCES "public"."ai_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forwarding_tasks" ADD CONSTRAINT "forwarding_tasks_video_ai_model_id_ai_models_id_fk" FOREIGN KEY ("video_ai_model_id") REFERENCES "public"."ai_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_jobs" ADD CONSTRAINT "queue_jobs_task_id_forwarding_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."forwarding_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_logs" ADD CONSTRAINT "task_logs_task_id_forwarding_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."forwarding_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_stats" ADD CONSTRAINT "task_stats_task_id_forwarding_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."forwarding_tasks"("id") ON DELETE cascade ON UPDATE no action;