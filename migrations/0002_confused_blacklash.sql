ALTER TABLE "ai_training_examples" ALTER COLUMN "task_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "forwarding_tasks" ADD COLUMN "audio_processing_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "forwarding_tasks" ADD COLUMN "audio_ai_provider_id" integer;--> statement-breakpoint
ALTER TABLE "forwarding_tasks" ADD COLUMN "audio_ai_model_id" integer;--> statement-breakpoint
ALTER TABLE "forwarding_tasks" ADD CONSTRAINT "forwarding_tasks_audio_ai_provider_id_ai_providers_id_fk" FOREIGN KEY ("audio_ai_provider_id") REFERENCES "public"."ai_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forwarding_tasks" ADD CONSTRAINT "forwarding_tasks_audio_ai_model_id_ai_models_id_fk" FOREIGN KEY ("audio_ai_model_id") REFERENCES "public"."ai_models"("id") ON DELETE no action ON UPDATE no action;