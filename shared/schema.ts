import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, jsonb, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users and Admins
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  telegramId: text("telegram_id").notNull().unique(),
  username: text("username"),
  addedBy: integer("added_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Channels and Sources
export const channels = pgTable("channels", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // 'telegram_channel' | 'telegram_group' | 'website'
  identifier: text("identifier").notNull(), // channel ID or URL
  title: text("title"),
  description: text("description"),
  metadata: jsonb("metadata"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// AI Providers and Models
export const aiProviders = pgTable("ai_providers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // 'openai' | 'groq' | 'huggingface' | 'claude'
  displayName: text("display_name"),
  apiKey: text("api_key"),
  baseUrl: text("base_url"),
  isActive: boolean("is_active").notNull().default(true),
  config: jsonb("config"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const aiModels = pgTable("ai_models", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").notNull().references(() => aiProviders.id),
  modelName: text("model_name").notNull(),
  displayName: text("display_name").notNull(),
  capabilities: jsonb("capabilities"),
  
  // Rate limits
  tpmLimit: integer("tpm_limit"), // Tokens Per Minute
  rpmLimit: integer("rpm_limit"), // Requests Per Minute
  tpdLimit: integer("tpd_limit"), // Tokens Per Day
  
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Forwarding Tasks
export const forwardingTasks = pgTable("forwarding_tasks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  
  // Source and target channels (arrays of channel IDs)
  sourceChannels: jsonb("source_channels").notNull(), // [1, 2, 3]
  targetChannels: jsonb("target_channels").notNull(), // [4, 5, 6]
  
  // AI Configuration (master toggle)
  aiEnabled: boolean("ai_enabled").notNull().default(false),
  aiProviderId: integer("ai_provider_id").references(() => aiProviders.id),
  aiModelId: integer("ai_model_id").references(() => aiModels.id),
  
  // Text Summarization
  summarizationEnabled: boolean("summarization_enabled").notNull().default(false),
  summarizationProviderId: integer("summarization_provider_id").references(() => aiProviders.id),
  summarizationModelId: integer("summarization_model_id").references(() => aiModels.id),
  
  // Video Processing
  videoProcessingEnabled: boolean("video_processing_enabled").notNull().default(false),
  videoAiProviderId: integer("video_ai_provider_id").references(() => aiProviders.id),
  videoAiModelId: integer("video_ai_model_id").references(() => aiModels.id),
  
  // Audio Processing (voice messages and audio files)
  audioProcessingEnabled: boolean("audio_processing_enabled").notNull().default(false),
  audioAiProviderId: integer("audio_ai_provider_id").references(() => aiProviders.id),
  audioAiModelId: integer("audio_ai_model_id").references(() => aiModels.id),
  
  // Link Processing (download videos from social media links)
  linkProcessingEnabled: boolean("link_processing_enabled").notNull().default(false),
  linkVideoDownloadEnabled: boolean("link_video_download_enabled").notNull().default(true),
  linkVideoQuality: text("link_video_quality").notNull().default("high"), // 'low' | 'medium' | 'high' | 'best'
  
  // Platform Cookies
  youtubeCookies: text("youtube_cookies"),
  facebookCookies: text("facebook_cookies"),
  tiktokCookies: text("tiktok_cookies"),
  xCookies: text("x_cookies"),
  instagramCookies: text("instagram_cookies"),

  // Statistics
  totalForwarded: integer("total_forwarded").notNull().default(0),
  lastForwardedAt: timestamp("last_forwarded_at"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// AI Rules for Tasks (Enhanced with multiple rule types)
export const aiRules = pgTable("ai_rules", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => forwardingTasks.id, { onDelete: 'cascade' }),
  type: text("type").notNull(), // 'summarize' | 'audio_summarize' | 'video_summarize' | 'transform' | 'filter' | 'entity_replace' | 'context_neutralize' | 'sentiment_adjust' | 'format'
  category: text("category").notNull().default("general"), // 'preprocessing' | 'processing' | 'postprocessing' | 'general'
  name: text("name").notNull(),
  prompt: text("prompt").notNull(),
  config: jsonb("config"), // Additional configuration for the rule
  isActive: boolean("is_active").notNull().default(true),
  priority: integer("priority").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Entity Replacement Rules (for name substitutions like "محمد مصطفى" → "البطل محمد مصطفى")
export const aiEntityReplacements = pgTable("ai_entity_replacements", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => forwardingTasks.id, { onDelete: 'cascade' }),
  entityType: text("entity_type").notNull(), // 'person' | 'organization' | 'location' | 'event' | 'custom'
  originalText: text("original_text").notNull(),
  replacementText: text("replacement_text").notNull(),
  caseSensitive: boolean("case_sensitive").notNull().default(false),
  useContext: boolean("use_context").notNull().default(true), // AI analyzes context before replacing
  isActive: boolean("is_active").notNull().default(true),
  priority: integer("priority").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Context Rules (for sentiment/tone adjustments)
export const aiContextRules = pgTable("ai_context_rules", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => forwardingTasks.id, { onDelete: 'cascade' }),
  ruleType: text("rule_type").notNull(), // 'neutralize_negative' | 'enhance_positive' | 'formal_tone' | 'remove_bias' | 'custom'
  triggerPattern: text("trigger_pattern"), // Regex or keywords that trigger this rule
  targetSentiment: text("target_sentiment"), // 'neutral' | 'positive' | 'formal' | 'professional'
  instructions: text("instructions").notNull(), // AI instructions for this context rule
  examples: jsonb("examples"), // Example transformations for AI learning
  isActive: boolean("is_active").notNull().default(true),
  priority: integer("priority").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// AI Training Examples (for learning user preferences)
export const aiTrainingExamples = pgTable("ai_training_examples", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => forwardingTasks.id, { onDelete: 'cascade' }),
  exampleType: text("example_type").notNull(), // 'correction' | 'preference' | 'style' | 'terminology'
  inputText: text("input_text").notNull(),
  expectedOutput: text("expected_output").notNull(),
  explanation: text("explanation"), // Why this transformation is preferred
  tags: jsonb("tags"), // ['politics', 'sports', 'formal']
  useCount: integer("use_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// AI Processing Configuration (global and per-task settings)
export const aiProcessingConfig = pgTable("ai_processing_config", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").references(() => forwardingTasks.id, { onDelete: 'cascade' }),
  configType: text("config_type").notNull(), // 'global' | 'task_specific'
  
  // Preprocessing options
  enableEntityExtraction: boolean("enable_entity_extraction").notNull().default(true),
  enableSentimentAnalysis: boolean("enable_sentiment_analysis").notNull().default(true),
  enableKeywordDetection: boolean("enable_keyword_detection").notNull().default(true),
  
  // Processing options
  maxRetries: integer("max_retries").notNull().default(3),
  timeoutSeconds: integer("timeout_seconds").notNull().default(60),
  preserveFormatting: boolean("preserve_formatting").notNull().default(true),
  
  // Postprocessing options
  enableOutputValidation: boolean("enable_output_validation").notNull().default(true),
  enableRuleVerification: boolean("enable_rule_verification").notNull().default(true),
  outputFormat: text("output_format").notNull().default("markdown"), // 'plain' | 'markdown' | 'html'
  
  // Quality settings
  temperature: text("temperature").notNull().default("0.7"),
  qualityLevel: text("quality_level").notNull().default("balanced"), // 'fast' | 'balanced' | 'high_quality'
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// AI Usage Statistics
export const aiUsageStats = pgTable("ai_usage_stats", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").notNull().references(() => aiProviders.id),
  modelId: integer("model_id").references(() => aiModels.id),
  modelName: text("model_name").notNull(),
  taskId: integer("task_id").references(() => forwardingTasks.id),
  
  // Usage metrics
  requestCount: integer("request_count").notNull().default(0),
  totalTokensInput: integer("total_tokens_input").notNull().default(0),
  totalTokensOutput: integer("total_tokens_output").notNull().default(0),
  totalCost: text("total_cost"),
  
  // Time tracking
  usageDate: timestamp("usage_date").notNull(),
  
  // Additional metadata
  avgLatency: integer("avg_latency"),
  errorCount: integer("error_count").notNull().default(0),
  successCount: integer("success_count").notNull().default(0),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Task Logs
export const taskLogs = pgTable("task_logs", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").references(() => forwardingTasks.id, { onDelete: 'cascade' }),
  level: text("level").notNull(), // 'info' | 'warning' | 'error' | 'success'
  message: text("message").notNull(),
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Error Logs
export const errorLogs = pgTable("error_logs", {
  id: serial("id").primaryKey(),
  component: text("component").notNull(), // 'bot' | 'api' | 'worker' | 'webhook'
  function: text("function").notNull(),
  errorType: text("error_type").notNull(),
  errorMessage: text("error_message").notNull(),
  stackTrace: text("stack_trace"),
  metadata: jsonb("metadata"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Task Statistics
export const taskStats = pgTable("task_stats", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => forwardingTasks.id, { onDelete: 'cascade' }),
  date: text("date").notNull(), // YYYY-MM-DD
  messagesForwarded: integer("messages_forwarded").notNull().default(0),
  messagesProcessed: integer("messages_processed").notNull().default(0),
  aiProcessed: integer("ai_processed").notNull().default(0),
  videoProcessed: integer("video_processed").notNull().default(0),
  errors: integer("errors").notNull().default(0),
});

// Queue Jobs
export const queueJobs = pgTable("queue_jobs", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").references(() => forwardingTasks.id, { onDelete: 'cascade' }),
  type: text("type").notNull(), // 'forward' | 'ai_process' | 'video_process'
  status: text("status").notNull().default("pending"), // 'pending' | 'processing' | 'completed' | 'failed'
  priority: integer("priority").notNull().default(0),
  payload: jsonb("payload").notNull(),
  result: jsonb("result"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(3),
  error: text("error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  processedAt: timestamp("processed_at"),
});

// Bot Configuration
export const botConfig = pgTable("bot_config", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Userbot Sessions for MTProto authentication
export const userbotSessions = pgTable("userbot_sessions", {
  id: serial("id").primaryKey(),
  phoneNumber: text("phone_number").notNull(),
  sessionString: text("session_string"),
  isActive: boolean("is_active").notNull().default(false),
  isPrimary: boolean("is_primary").notNull().default(false),
  status: text("status").notNull().default("pending"), // 'pending' | 'awaiting_code' | 'awaiting_password' | 'active' | 'expired' | 'error'
  loginState: jsonb("login_state"), // temporary state during login flow
  lastLoginAt: timestamp("last_login_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// GitHub Repository Settings
export const githubSettings = pgTable("github_settings", {
  id: serial("id").primaryKey(),
  repoOwner: text("repo_owner").notNull(),
  repoName: text("repo_name").notNull(),
  linkedAt: timestamp("linked_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// AI Content Filters (for filtering messages before forwarding based on context/content)
export const aiContentFilters = pgTable("ai_content_filters", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => forwardingTasks.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  filterType: text("filter_type").notNull(), // 'allow' | 'block' | 'require'
  matchType: text("match_type"),
  pattern: text("pattern").notNull(), // The pattern/keywords to match
  contextDescription: text("context_description"),
  sentimentTarget: text("sentiment_target"),
  action: text("action").notNull().default("skip"), // 'skip' | 'forward' | 'modify' | 'flag'
  modifyInstructions: text("modify_instructions"),
  priority: integer("priority").notNull().default(0),
  matchCount: integer("match_count").notNull().default(0), // Stats: how many times matched
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// AI Publishing Templates (for controlling final message format)
export const aiPublishingTemplates = pgTable("ai_publishing_templates", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => forwardingTasks.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  templateType: text("template_type").notNull(), // 'news' | 'report' | 'interview' | 'summary' | 'custom'
  
  // Template structure with formatting
  headerText: text("header_text"), // Static header text
  headerFormatting: text("header_formatting"), // 'bold' | 'italic' | 'code' | 'quote' | 'spoiler' | 'strikethrough' | 'underline' | 'none'
  footerText: text("footer_text"), // Static footer text
  footerFormatting: text("footer_formatting"), // 'bold' | 'italic' | 'code' | 'quote' | 'spoiler' | 'strikethrough' | 'underline' | 'none'
  
  // Global settings
  fieldSeparator: text("field_separator").default("\n"), // Separator between fields
  useNewlineAfterHeader: boolean("use_newline_after_header").notNull().default(true),
  useNewlineBeforeFooter: boolean("use_newline_before_footer").notNull().default(true),
  
  maxLength: integer("max_length"), // Maximum output length
  
  // General AI extraction prompt (optional override)
  extractionPrompt: text("extraction_prompt"), // Custom AI prompt for extracting all fields
  
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Template Custom Fields (dynamic fields with individual formatting and AI instructions)
export const templateCustomFields = pgTable("template_custom_fields", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").notNull().references(() => aiPublishingTemplates.id, { onDelete: 'cascade' }),
  
  // Field identification
  fieldName: text("field_name").notNull(), // Internal name like 'news_type', 'province', 'source'
  fieldLabel: text("field_label").notNull(), // Display label like 'نوع الخبر', 'المحافظة', 'المصدر'
  
  // AI extraction instructions
  extractionInstructions: text("extraction_instructions").notNull(), // AI instructions for extracting this field
  defaultValue: text("default_value"), // Default if extraction fails (e.g., today's date)
  useDefaultIfEmpty: boolean("use_default_if_empty").notNull().default(true),
  
  // Formatting options (Telegram entities)
  formatting: text("formatting").notNull().default("none"), // 'bold' | 'italic' | 'code' | 'quote' | 'spoiler' | 'strikethrough' | 'underline' | 'none'
  
  // Field position and display
  displayOrder: integer("display_order").notNull().default(0),
  showLabel: boolean("show_label").notNull().default(false), // Whether to show "نوع الخبر: " prefix
  labelSeparator: text("label_separator").default(": "), // Separator after label
  prefix: text("prefix"), // Text before the value (e.g., emoji)
  suffix: text("suffix"), // Text after the value
  
  // Special field types
  fieldType: text("field_type").notNull().default("extracted"), // 'extracted' | 'summary' | 'static' | 'date_today'
  
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Message Archive (for storing processed and forwarded messages with serial numbering)
export const messageArchive = pgTable("message_archive", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => forwardingTasks.id, { onDelete: 'cascade' }),
  
  // Serial number per task (رقم القيد)
  serialNumber: integer("serial_number").notNull(),
  
  // Message identification
  sourceMessageId: text("source_message_id"), // Original Telegram message ID
  sourceChannelId: text("source_channel_id"), // Source channel identifier
  sourceChannelTitle: text("source_channel_title"), // Source channel name
  targetChannelId: text("target_channel_id"), // Target channel identifier
  targetChannelTitle: text("target_channel_title"), // Target channel name
  targetMessageId: text("target_message_id"), // Forwarded message ID
  
  // Content
  title: text("title"), // AI-generated or manual title (عنوان الملخص)
  originalText: text("original_text"), // Original message text
  processedText: text("processed_text"), // AI-processed/summarized text
  publishedText: text("published_text"), // Final published text with template applied
  
  // Telegraph integration
  telegraphUrl: text("telegraph_url"), // Link to full original text on Telegraph
  telegraphTitle: text("telegraph_title"), // Telegraph page title
  
  // Extracted metadata (from AI)
  classification: text("classification"), // التصنيف (نوع الخبر)
  newsType: text("news_type"), // نوع الخبر (عاجل، تقرير، الخ)
  province: text("province"), // المحافظة
  specialist: text("specialist"), // المختص
  tags: jsonb("tags"), // Array of tags/keywords
  extractedFields: jsonb("extracted_fields"), // All AI-extracted fields as JSON
  
  // Media information
  hasMedia: boolean("has_media").notNull().default(false),
  mediaType: text("media_type"), // 'photo' | 'video' | 'document' | 'audio' | 'media_group'
  mediaCount: integer("media_count").default(0),
  mediaGroupId: text("media_group_id"),
  
  // Processing metadata
  processingDuration: integer("processing_duration"), // Processing time in ms
  aiProvider: text("ai_provider"), // Which AI provider was used
  aiModel: text("ai_model"), // Which AI model was used
  templateName: text("template_name"), // Publishing template used
  
  // Status and flags
  status: text("status").notNull().default("published"), // 'pending' | 'published' | 'edited' | 'deleted' | 'flagged'
  isEdited: boolean("is_edited").notNull().default(false),
  isPinned: boolean("is_pinned").notNull().default(false),
  isFlagged: boolean("is_flagged").notNull().default(false),
  flagReason: text("flag_reason"),
  
  // Notes and comments
  notes: text("notes"), // Admin notes
  
  // Audit fields
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Archive Serial Counter (for tracking serial numbers per task)
export const archiveSerialCounter = pgTable("archive_serial_counter", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => forwardingTasks.id, { onDelete: 'cascade' }).unique(),
  lastSerial: integer("last_serial").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Insert Schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertAdminSchema = createInsertSchema(admins).omit({ id: true, createdAt: true });
export const insertChannelSchema = createInsertSchema(channels).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAiProviderSchema = createInsertSchema(aiProviders).omit({ id: true, createdAt: true });
export const insertAiModelSchema = createInsertSchema(aiModels).omit({ id: true });
export const insertForwardingTaskSchema = createInsertSchema(forwardingTasks).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true, 
  totalForwarded: true, 
  lastForwardedAt: true 
});
export const insertAiRuleSchema = createInsertSchema(aiRules).omit({ id: true, createdAt: true });
export const insertAiEntityReplacementSchema = createInsertSchema(aiEntityReplacements).omit({ id: true, createdAt: true });
export const insertAiContextRuleSchema = createInsertSchema(aiContextRules).omit({ id: true, createdAt: true });
export const insertAiTrainingExampleSchema = createInsertSchema(aiTrainingExamples).omit({ id: true, createdAt: true, useCount: true });
export const insertAiProcessingConfigSchema = createInsertSchema(aiProcessingConfig).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAiUsageStatsSchema = createInsertSchema(aiUsageStats).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTaskLogSchema = createInsertSchema(taskLogs).omit({ id: true, timestamp: true });
export const insertErrorLogSchema = createInsertSchema(errorLogs).omit({ id: true, timestamp: true });
export const insertTaskStatsSchema = createInsertSchema(taskStats).omit({ id: true });
export const insertQueueJobSchema = createInsertSchema(queueJobs).omit({ 
  id: true, 
  createdAt: true, 
  processedAt: true,
  attempts: true,
  result: true,
  error: true
});
export const insertBotConfigSchema = createInsertSchema(botConfig).omit({ id: true, updatedAt: true });
export const insertUserbotSessionSchema = createInsertSchema(userbotSessions).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  lastLoginAt: true,
  sessionString: true,
  isActive: true,
  isPrimary: true,
  status: true,
  loginState: true,
  errorMessage: true
});
export const insertGithubSettingsSchema = createInsertSchema(githubSettings).omit({ id: true, linkedAt: true, updatedAt: true });
export const insertAiContentFilterSchema = createInsertSchema(aiContentFilters).omit({ id: true, createdAt: true, matchCount: true });
export const insertAiPublishingTemplateSchema = createInsertSchema(aiPublishingTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTemplateCustomFieldSchema = createInsertSchema(templateCustomFields).omit({ id: true, createdAt: true });
export const insertMessageArchiveSchema = createInsertSchema(messageArchive).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true
});
export const insertArchiveSerialCounterSchema = createInsertSchema(archiveSerialCounter).omit({ 
  id: true, 
  updatedAt: true 
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Admin = typeof admins.$inferSelect;
export type InsertAdmin = z.infer<typeof insertAdminSchema>;

export type Channel = typeof channels.$inferSelect;
export type InsertChannel = z.infer<typeof insertChannelSchema>;

export type AiProvider = typeof aiProviders.$inferSelect;
export type InsertAiProvider = z.infer<typeof insertAiProviderSchema>;

export type AiModel = typeof aiModels.$inferSelect;
export type InsertAiModel = z.infer<typeof insertAiModelSchema>;

export type ForwardingTask = typeof forwardingTasks.$inferSelect;
export type InsertForwardingTask = z.infer<typeof insertForwardingTaskSchema>;

export type AiRule = typeof aiRules.$inferSelect;
export type InsertAiRule = z.infer<typeof insertAiRuleSchema>;

export type AiEntityReplacement = typeof aiEntityReplacements.$inferSelect;
export type InsertAiEntityReplacement = z.infer<typeof insertAiEntityReplacementSchema>;

export type AiContextRule = typeof aiContextRules.$inferSelect;
export type InsertAiContextRule = z.infer<typeof insertAiContextRuleSchema>;

export type AiTrainingExample = typeof aiTrainingExamples.$inferSelect;
export type InsertAiTrainingExample = z.infer<typeof insertAiTrainingExampleSchema>;

export type AiProcessingConfig = typeof aiProcessingConfig.$inferSelect;
export type InsertAiProcessingConfig = z.infer<typeof insertAiProcessingConfigSchema>;

export type AiUsageStats = typeof aiUsageStats.$inferSelect;
export type InsertAiUsageStats = z.infer<typeof insertAiUsageStatsSchema>;

export type TaskLog = typeof taskLogs.$inferSelect;
export type InsertTaskLog = z.infer<typeof insertTaskLogSchema>;

export type ErrorLog = typeof errorLogs.$inferSelect;
export type InsertErrorLog = z.infer<typeof insertErrorLogSchema>;

export type TaskStats = typeof taskStats.$inferSelect;
export type InsertTaskStats = z.infer<typeof insertTaskStatsSchema>;

export type QueueJob = typeof queueJobs.$inferSelect;
export type InsertQueueJob = z.infer<typeof insertQueueJobSchema>;

export type BotConfig = typeof botConfig.$inferSelect;
export type InsertBotConfig = z.infer<typeof insertBotConfigSchema>;

export type UserbotSession = typeof userbotSessions.$inferSelect;
export type InsertUserbotSession = z.infer<typeof insertUserbotSessionSchema>;

export type GitHubSettings = typeof githubSettings.$inferSelect;
export type InsertGithubSettings = z.infer<typeof insertGithubSettingsSchema>;

export type AiContentFilter = typeof aiContentFilters.$inferSelect;
export type InsertAiContentFilter = z.infer<typeof insertAiContentFilterSchema>;

export type AiPublishingTemplate = typeof aiPublishingTemplates.$inferSelect;
export type InsertAiPublishingTemplate = z.infer<typeof insertAiPublishingTemplateSchema>;

export type MessageArchive = typeof messageArchive.$inferSelect;
export type InsertMessageArchive = z.infer<typeof insertMessageArchiveSchema>;

export type ArchiveSerialCounter = typeof archiveSerialCounter.$inferSelect;
export type InsertArchiveSerialCounter = z.infer<typeof insertArchiveSerialCounterSchema>;
