CREATE TABLE "ai_content_filters" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"name" text NOT NULL,
	"filter_type" text NOT NULL,
	"match_type" text NOT NULL,
	"pattern" text NOT NULL,
	"context_description" text,
	"sentiment_target" text,
	"action" text DEFAULT 'skip' NOT NULL,
	"modify_instructions" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"match_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_context_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"rule_type" text NOT NULL,
	"trigger_pattern" text,
	"target_sentiment" text,
	"instructions" text NOT NULL,
	"examples" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_entity_replacements" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"entity_type" text NOT NULL,
	"original_text" text NOT NULL,
	"replacement_text" text NOT NULL,
	"case_sensitive" boolean DEFAULT false NOT NULL,
	"use_context" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_processing_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer,
	"config_type" text NOT NULL,
	"enable_entity_extraction" boolean DEFAULT true NOT NULL,
	"enable_sentiment_analysis" boolean DEFAULT true NOT NULL,
	"enable_keyword_detection" boolean DEFAULT true NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"timeout_seconds" integer DEFAULT 60 NOT NULL,
	"preserve_formatting" boolean DEFAULT true NOT NULL,
	"enable_output_validation" boolean DEFAULT true NOT NULL,
	"enable_rule_verification" boolean DEFAULT true NOT NULL,
	"output_format" text DEFAULT 'markdown' NOT NULL,
	"temperature" text DEFAULT '0.7' NOT NULL,
	"quality_level" text DEFAULT 'balanced' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_publishing_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"template_type" text NOT NULL,
	"header_text" text,
	"header_formatting" text,
	"footer_text" text,
	"footer_formatting" text,
	"field_separator" text DEFAULT '
',
	"use_newline_after_header" boolean DEFAULT true NOT NULL,
	"use_newline_before_footer" boolean DEFAULT true NOT NULL,
	"max_length" integer,
	"extraction_prompt" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_training_examples" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer,
	"example_type" text NOT NULL,
	"input_text" text NOT NULL,
	"expected_output" text NOT NULL,
	"explanation" text,
	"tags" jsonb,
	"use_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider_id" integer NOT NULL,
	"model_id" integer,
	"model_name" text NOT NULL,
	"task_id" integer,
	"request_count" integer DEFAULT 0 NOT NULL,
	"total_tokens_input" integer DEFAULT 0 NOT NULL,
	"total_tokens_output" integer DEFAULT 0 NOT NULL,
	"total_cost" text,
	"usage_date" timestamp NOT NULL,
	"avg_latency" integer,
	"error_count" integer DEFAULT 0 NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "archive_serial_counter" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"last_serial" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "archive_serial_counter_task_id_unique" UNIQUE("task_id")
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
CREATE TABLE "message_archive" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"serial_number" integer NOT NULL,
	"source_message_id" text,
	"source_channel_id" text,
	"source_channel_title" text,
	"target_channel_id" text,
	"target_channel_title" text,
	"target_message_id" text,
	"title" text,
	"original_text" text,
	"processed_text" text,
	"published_text" text,
	"telegraph_url" text,
	"telegraph_title" text,
	"classification" text,
	"news_type" text,
	"province" text,
	"specialist" text,
	"tags" jsonb,
	"extracted_fields" jsonb,
	"has_media" boolean DEFAULT false NOT NULL,
	"media_type" text,
	"media_count" integer DEFAULT 0,
	"media_group_id" text,
	"processing_duration" integer,
	"ai_provider" text,
	"ai_model" text,
	"template_name" text,
	"status" text DEFAULT 'published' NOT NULL,
	"is_edited" boolean DEFAULT false NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"is_flagged" boolean DEFAULT false NOT NULL,
	"flag_reason" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"edited_at" timestamp,
	"edited_by" text
);
--> statement-breakpoint
CREATE TABLE "template_custom_fields" (
	"id" serial PRIMARY KEY NOT NULL,
	"template_id" integer NOT NULL,
	"field_name" text NOT NULL,
	"field_label" text NOT NULL,
	"extraction_instructions" text NOT NULL,
	"default_value" text,
	"use_default_if_empty" boolean DEFAULT true NOT NULL,
	"formatting" text DEFAULT 'none' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"show_label" boolean DEFAULT false NOT NULL,
	"label_separator" text DEFAULT ': ',
	"prefix" text,
	"suffix" text,
	"field_type" text DEFAULT 'extracted' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_rules" ADD COLUMN "category" text DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_rules" ADD COLUMN "config" jsonb;--> statement-breakpoint
ALTER TABLE "ai_content_filters" ADD CONSTRAINT "ai_content_filters_task_id_forwarding_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."forwarding_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_context_rules" ADD CONSTRAINT "ai_context_rules_task_id_forwarding_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."forwarding_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_entity_replacements" ADD CONSTRAINT "ai_entity_replacements_task_id_forwarding_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."forwarding_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_processing_config" ADD CONSTRAINT "ai_processing_config_task_id_forwarding_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."forwarding_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_publishing_templates" ADD CONSTRAINT "ai_publishing_templates_task_id_forwarding_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."forwarding_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_training_examples" ADD CONSTRAINT "ai_training_examples_task_id_forwarding_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."forwarding_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_stats" ADD CONSTRAINT "ai_usage_stats_provider_id_ai_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."ai_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_stats" ADD CONSTRAINT "ai_usage_stats_model_id_ai_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."ai_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_stats" ADD CONSTRAINT "ai_usage_stats_task_id_forwarding_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."forwarding_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "archive_serial_counter" ADD CONSTRAINT "archive_serial_counter_task_id_forwarding_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."forwarding_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_archive" ADD CONSTRAINT "message_archive_task_id_forwarding_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."forwarding_tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "template_custom_fields" ADD CONSTRAINT "template_custom_fields_template_id_ai_publishing_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."ai_publishing_templates"("id") ON DELETE cascade ON UPDATE no action;