-- Add new columns to ai_rules table
ALTER TABLE "ai_rules" ADD COLUMN IF NOT EXISTS "category" text DEFAULT 'general' NOT NULL;
ALTER TABLE "ai_rules" ADD COLUMN IF NOT EXISTS "config" jsonb;

--> statement-breakpoint
-- Create Entity Replacement Rules table
CREATE TABLE IF NOT EXISTS "ai_entity_replacements" (
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
-- Create Context Rules table
CREATE TABLE IF NOT EXISTS "ai_context_rules" (
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
-- Create Training Examples table
CREATE TABLE IF NOT EXISTS "ai_training_examples" (
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
-- Create Processing Configuration table
CREATE TABLE IF NOT EXISTS "ai_processing_config" (
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
-- Add foreign key constraints
ALTER TABLE "ai_entity_replacements" ADD CONSTRAINT "ai_entity_replacements_task_id_forwarding_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."forwarding_tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_context_rules" ADD CONSTRAINT "ai_context_rules_task_id_forwarding_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."forwarding_tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_training_examples" ADD CONSTRAINT "ai_training_examples_task_id_forwarding_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."forwarding_tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "ai_processing_config" ADD CONSTRAINT "ai_processing_config_task_id_forwarding_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."forwarding_tasks"("id") ON DELETE cascade ON UPDATE no action;
