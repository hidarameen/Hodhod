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
  apiKey: text("api_key"),
  isActive: boolean("is_active").notNull().default(true),
  config: jsonb("config"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const aiModels = pgTable("ai_models", {
  id: serial("id").primaryKey(),
  providerId: integer("provider_id").notNull().references(() => aiProviders.id),
  modelName: text("model_name").notNull(),
  displayName: text("display_name").notNull(),
  capabilities: jsonb("capabilities"), // ['text', 'image', 'audio']
  isActive: boolean("is_active").notNull().default(true),
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

  // Link Processing (download videos from social media links)
  linkProcessingEnabled: boolean("link_processing_enabled").notNull().default(false),
  linkVideoDownloadEnabled: boolean("link_video_download_enabled").notNull().default(true),
  linkVideoQuality: text("link_video_quality").notNull().default("high"), // 'low' | 'medium' | 'high' | 'best'

  // Statistics
  totalForwarded: integer("total_forwarded").notNull().default(0),
  lastForwardedAt: timestamp("last_forwarded_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// AI Rules for Tasks
export const aiRules = pgTable("ai_rules", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => forwardingTasks.id, { onDelete: 'cascade' }),
  type: text("type").notNull(), // 'summarize' | 'transform' | 'filter'
  name: text("name").notNull(),
  prompt: text("prompt").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  priority: integer("priority").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Export aiRules as taskRules for compatibility
export const taskRules = aiRules;

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