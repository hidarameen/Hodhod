import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, desc, and, sql } from "drizzle-orm";
import * as schema from "@shared/schema";
import fs from "fs";
import path from "path";
import type {
  User,
  InsertUser,
  Admin,
  InsertAdmin,
  ForwardingTask,
  InsertForwardingTask,
  Channel,
  InsertChannel,
  AiRule,
  InsertAiRule,
  TaskLog,
  InsertTaskLog,
  TaskStats,
  AiProvider,
  InsertAiProvider,
  AiModel,
  InsertAiModel,
  AiUsageStats,
  InsertAiUsageStats,
  UserbotSession,
  InsertUserbotSession,
  GitHubSettings,
  InsertGithubSettings,
} from "@shared/schema";

function getLocalDatabaseUrl(): string {
  let dbUrl = process.env.DATABASE_URL || "";
  if (!dbUrl) return "";
  
  if (dbUrl.includes(',')) {
    const atIndex = dbUrl.lastIndexOf('@');
    if (atIndex !== -1) {
      const beforeAt = dbUrl.substring(0, atIndex + 1);
      const afterAt = dbUrl.substring(atIndex + 1);
      
      const slashIndex = afterAt.indexOf('/');
      if (slashIndex !== -1) {
        const hostsSection = afterAt.substring(0, slashIndex);
        const pathSection = afterAt.substring(slashIndex);
        
        const primaryHost = hostsSection.split(',')[0].trim();
        dbUrl = beforeAt + primaryHost + pathSection;
        console.log('[DB] Using primary host from multi-host URL');
      }
    }
  }
  
  if (!dbUrl.includes('sslmode=')) {
    dbUrl += (dbUrl.includes('?') ? '&' : '?') + 'sslmode=require';
  }
  
  return dbUrl;
}

const connectionString = getLocalDatabaseUrl();
console.log('[DB] Connecting to database...');
const queryClient = postgres(connectionString);
export const database = drizzle(queryClient, { schema });

// Run migrations automatically on startup
async function runMigrations(): Promise<void> {
  try {
    console.log('[DB] Running database migrations...');
    
    // Create migrations tracking table if it doesn't exist
    await queryClient`
      CREATE TABLE IF NOT EXISTS _drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `;
    
    // Get all migration files
    const migrationsDir = path.join(process.cwd(), 'migrations');
    const files = fs.readdirSync(migrationsDir).filter((f: string) => f.endsWith('.sql')).sort();
    
    for (const file of files) {
      const hash = file;
      
      // Check if migration already ran
      const existing = await queryClient`SELECT * FROM _drizzle_migrations WHERE hash = ${hash}`;
      if (existing.length > 0) {
        console.log(`[DB] Migration ${file} already applied`);
        continue;
      }
      
      // Read and execute migration
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');
      
      // Split by statement breakpoints and filter out comments
      const statements = sql
        .split('--> statement-breakpoint')
        .map((stmt: string) => stmt.trim())
        .filter((stmt: string) => stmt && !stmt.startsWith('--'));
      
      console.log(`[DB] Applying migration ${file}...`);
      for (const statement of statements) {
        if (statement) {
          try {
            await queryClient.unsafe(statement);
          } catch (err: any) {
            // Ignore errors for IF NOT EXISTS clauses
            if (!err.message?.includes('already exists')) {
              console.warn(`[DB] Statement error (may be expected): ${err.message}`);
            }
          }
        }
      }
      
      // Record migration as completed - use ON CONFLICT to handle if already exists
      try {
        await queryClient`INSERT INTO _drizzle_migrations (hash) VALUES (${hash}) ON CONFLICT (hash) DO NOTHING`;
        console.log(`[DB] ✓ Migration ${file} completed`);
      } catch (err: any) {
        console.warn(`[DB] Could not record migration: ${err.message}`);
      }
    }
    
    console.log('[DB] All migrations applied successfully');
  } catch (error: any) {
    console.error('[DB] Migration error:', error);
    throw error;
  }
}

// Seed default AI providers and models
async function seedProviders(): Promise<void> {
  try {
    const providerCount = await queryClient`SELECT COUNT(*) as count FROM ai_providers`;
    if (providerCount[0]?.count > 0) {
      console.log('[DB] Providers already seeded');
      return;
    }
    
    console.log('[DB] Seeding default AI providers...');
    
    // Insert default providers
    const providers = [
      { name: 'openai', isActive: true, config: JSON.stringify({ baseUrl: 'https://api.openai.com/v1' }) },
      { name: 'groq', isActive: true, config: JSON.stringify({ baseUrl: 'https://api.groq.com/openai/v1' }) },
      { name: 'claude', isActive: true, config: JSON.stringify({ baseUrl: 'https://api.anthropic.com/v1' }) },
      { name: 'huggingface', isActive: true, config: JSON.stringify({ baseUrl: 'https://api-inference.huggingface.co' }) },
    ];
    
    for (const provider of providers) {
      await queryClient`
        INSERT INTO ai_providers (name, is_active, config, created_at)
        VALUES (${provider.name}, ${provider.isActive}, ${provider.config}, now())
        ON CONFLICT (name) DO NOTHING
      `;
    }
    
    console.log('[DB] ✓ AI providers seeded successfully');
  } catch (error: any) {
    console.warn('[DB] Warning seeding providers:', error?.message || error);
  }
}

// Seed default AI models
async function seedModels(): Promise<void> {
  try {
    const modelCount = await queryClient`SELECT COUNT(*) as count FROM ai_models`;
    if (modelCount[0]?.count > 0) {
      console.log('[DB] Models already seeded');
      return;
    }
    
    console.log('[DB] Seeding default AI models...');
    
    // Get provider IDs
    const providers = await queryClient`SELECT id, name FROM ai_providers`;
    const providerMap = new Map(providers.map((p: any) => [p.name, p.id]));
    
    const models = [
      // OpenAI - GPT-5.2 Series (Latest - Dec 2025)
      { providerId: providerMap.get('openai'), modelName: 'gpt-5.2-instant', displayName: 'GPT-5.2 Instant', isActive: true },
      { providerId: providerMap.get('openai'), modelName: 'gpt-5.2-thinking', displayName: 'GPT-5.2 Thinking', isActive: true },
      { providerId: providerMap.get('openai'), modelName: 'gpt-5.2-pro', displayName: 'GPT-5.2 Pro', isActive: true },
      
      // OpenAI - GPT-5.1 Series (Reasoning)
      { providerId: providerMap.get('openai'), modelName: 'gpt-5.1', displayName: 'GPT-5.1', isActive: true },
      { providerId: providerMap.get('openai'), modelName: 'gpt-5.1-chat', displayName: 'GPT-5.1 Chat', isActive: true },
      
      // OpenAI - GPT-5 Series
      { providerId: providerMap.get('openai'), modelName: 'gpt-5', displayName: 'GPT-5', isActive: true },
      { providerId: providerMap.get('openai'), modelName: 'gpt-5-mini', displayName: 'GPT-5 Mini', isActive: true },
      { providerId: providerMap.get('openai'), modelName: 'gpt-5-nano', displayName: 'GPT-5 Nano', isActive: true },
      { providerId: providerMap.get('openai'), modelName: 'gpt-5-codex', displayName: 'GPT-5 Codex', isActive: true },
      
      // OpenAI - GPT-4.1 Series
      { providerId: providerMap.get('openai'), modelName: 'gpt-4.1', displayName: 'GPT-4.1', isActive: true },
      { providerId: providerMap.get('openai'), modelName: 'gpt-4.1-mini', displayName: 'GPT-4.1 Mini', isActive: true },
      { providerId: providerMap.get('openai'), modelName: 'gpt-4.1-nano', displayName: 'GPT-4.1 Nano', isActive: true },
      
      // OpenAI - GPT-4o Series
      { providerId: providerMap.get('openai'), modelName: 'gpt-4o', displayName: 'GPT-4o', isActive: true },
      { providerId: providerMap.get('openai'), modelName: 'gpt-4o-mini', displayName: 'GPT-4o Mini', isActive: true },
      
      // OpenAI - O-Series (Advanced Reasoning)
      { providerId: providerMap.get('openai'), modelName: 'o3', displayName: 'o3', isActive: true },
      { providerId: providerMap.get('openai'), modelName: 'o4-mini', displayName: 'o4 Mini', isActive: true },
      { providerId: providerMap.get('openai'), modelName: 'o3-deep-research', displayName: 'o3 Deep Research', isActive: true },
      { providerId: providerMap.get('openai'), modelName: 'o4-mini-deep-research', displayName: 'o4 Mini Deep Research', isActive: true },
      { providerId: providerMap.get('openai'), modelName: 'o1-pro', displayName: 'o1 Pro', isActive: true },
      
      // OpenAI - Audio Models
      { providerId: providerMap.get('openai'), modelName: 'gpt-4o-transcribe', displayName: 'GPT-4o Transcribe', isActive: true },
      { providerId: providerMap.get('openai'), modelName: 'gpt-4o-mini-transcribe', displayName: 'GPT-4o Mini Transcribe', isActive: true },
      { providerId: providerMap.get('openai'), modelName: 'gpt-4o-mini-tts', displayName: 'GPT-4o Mini TTS', isActive: true },
      { providerId: providerMap.get('openai'), modelName: 'gpt-4o-audio', displayName: 'GPT-4o Audio', isActive: true },
      { providerId: providerMap.get('openai'), modelName: 'gpt-4o-mini-audio', displayName: 'GPT-4o Mini Audio', isActive: true },
      { providerId: providerMap.get('openai'), modelName: 'whisper-1', displayName: 'Whisper-1', isActive: true },
      
      // OpenAI - Vision & Image Generation
      { providerId: providerMap.get('openai'), modelName: 'gpt-image-1', displayName: 'GPT Image-1', isActive: true },
      
      // OpenAI - Search & Specialized
      { providerId: providerMap.get('openai'), modelName: 'gpt-4o-search-preview', displayName: 'GPT-4o Search', isActive: true },
      { providerId: providerMap.get('openai'), modelName: 'gpt-4o-mini-search-preview', displayName: 'GPT-4o Mini Search', isActive: true },
      { providerId: providerMap.get('openai'), modelName: 'computer-use-preview', displayName: 'Computer Use Preview', isActive: true },
      
      // OpenAI - Embeddings
      { providerId: providerMap.get('openai'), modelName: 'text-embedding-3-large', displayName: 'Text Embedding 3 Large', isActive: true },
      { providerId: providerMap.get('openai'), modelName: 'text-embedding-3-small', displayName: 'Text Embedding 3 Small', isActive: true },
      
      // Groq models
      { providerId: providerMap.get('groq'), modelName: 'llama-3.3-70b-versatile', displayName: 'LLaMA 3.3 70B', isActive: true },
      { providerId: providerMap.get('groq'), modelName: 'qwen/qwen3-32b', displayName: 'Qwen 3 32B', isActive: true },
      
      // Claude models
      { providerId: providerMap.get('claude'), modelName: 'claude-3-opus-20240229', displayName: 'Claude 3 Opus', isActive: true },
      { providerId: providerMap.get('claude'), modelName: 'claude-3-sonnet-20240229', displayName: 'Claude 3 Sonnet', isActive: true },
      
      // HuggingFace models
      { providerId: providerMap.get('huggingface'), modelName: 'meta-llama/Llama-2-70b-chat-hf', displayName: 'LLaMA 2 70B Chat', isActive: true },
    ];
    
    for (const model of models) {
      if (model.providerId) {
        await queryClient`
          INSERT INTO ai_models (provider_id, model_name, display_name, is_active, created_at)
          VALUES (${model.providerId}, ${model.modelName}, ${model.displayName}, ${model.isActive}, now())
          ON CONFLICT DO NOTHING
        `;
      }
    }
    
    console.log('[DB] ✓ AI models seeded successfully');
  } catch (error: any) {
    console.warn('[DB] Warning seeding models:', error?.message || error);
  }
}

// Ensure all tables are created on startup
export async function ensureTablesExist(): Promise<void> {
  try {
    console.log('[DB] Ensuring all tables exist...');
    
    // Run migrations automatically
    await runMigrations();
    
    // Seed default providers and models
    await seedProviders();
    await seedModels();
    
    // Verify tables exist
    const result = await queryClient`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' LIMIT 1`;
    
    if (result && result.length > 0) {
      console.log('[DB] Database tables verified - connection successful');
      return;
    }
    
    console.log('[DB] Warning: No tables found after migration');
  } catch (error: any) {
    console.error('[DB] Error ensuring tables exist:', error?.message || error);
    throw error;
  }
}

export interface IStorage {
  // User Management
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Admin Management
  getAdmins(): Promise<Admin[]>;
  getAdmin(telegramId: string): Promise<Admin | undefined>;
  createAdmin(admin: InsertAdmin): Promise<Admin>;
  deleteAdmin(id: number): Promise<void>;

  // Task Management
  getTasks(): Promise<ForwardingTask[]>;
  getTask(id: number): Promise<ForwardingTask | undefined>;
  createTask(task: InsertForwardingTask): Promise<ForwardingTask>;
  updateTask(id: number, task: Partial<InsertForwardingTask>): Promise<ForwardingTask | undefined>;
  deleteTask(id: number): Promise<void>;
  toggleTask(id: number): Promise<ForwardingTask | undefined>;

  // Channel Management
  getChannels(): Promise<Channel[]>;
  getChannel(id: number): Promise<Channel | undefined>;
  createChannel(channel: InsertChannel): Promise<Channel>;
  updateChannel(id: number, channel: Partial<InsertChannel>): Promise<Channel | undefined>;
  deleteChannel(id: number): Promise<void>;

  // AI Provider Management
  getAiProviders(): Promise<AiProvider[]>;
  getAiProvider(id: number): Promise<AiProvider | undefined>;
  getAiProviderByName(name: string): Promise<AiProvider | undefined>;
  createAiProvider(provider: InsertAiProvider): Promise<AiProvider>;
  updateAiProvider(id: number, provider: Partial<InsertAiProvider>): Promise<AiProvider | undefined>;
  toggleAiProvider(id: number): Promise<AiProvider | undefined>;

  // AI Model Management
  getAiModels(): Promise<AiModel[]>;
  getAiModelsByProvider(providerId: number): Promise<AiModel[]>;
  createAiModel(model: InsertAiModel): Promise<AiModel>;
  updateModel(id: number, updates: any): Promise<AiModel | undefined>;
  getModelUsageStats(modelId: number): Promise<any>;

  // AI Rule Management
  getTaskRules(taskId: number): Promise<AiRule[]>;
  getTaskRulesByType(taskId: number, type: string): Promise<AiRule[]>;
  createRule(rule: InsertAiRule): Promise<AiRule>;
  updateRule(id: number, rule: Partial<InsertAiRule>): Promise<AiRule | undefined>;
  toggleRule(id: number): Promise<AiRule | undefined>;
  deleteRule(id: number): Promise<void>;

  // Task Logs and Stats
  getTaskLogs(taskId: number, limit?: number): Promise<TaskLog[]>;
  getTaskStats(taskId: number, days?: number): Promise<TaskStats[]>;
  getAllLogs(limit?: number): Promise<TaskLog[]>;

  // Error Logs
  getErrorLogs(limit?: number): Promise<any[]>;
  createErrorLog(data: any): Promise<any>;

  // Bot Config / Settings
  getBotConfig(): Promise<{ key: string; value: string }[]>;
  getBotConfigValue(key: string): Promise<string | undefined>;
  setBotConfigValue(key: string, value: string, description?: string): Promise<void>;
  deleteBotConfig(key: string): Promise<void>;

  // Message Archive
  clearArchive(taskId?: number): Promise<void>;
  getArchiveMessages(filters: any): Promise<any>;
  getArchiveStats(taskId?: number): Promise<any>;
  getArchiveFilterOptions(taskId?: number): Promise<any>;
  getArchiveMessage(id: number): Promise<any>;
  updateArchiveMessage(id: number, data: any): Promise<any>;
  deleteArchiveMessage(id: number): Promise<void>;
  toggleArchivePin(id: number): Promise<any>;
  toggleArchiveFlag(id: number, reason?: string): Promise<any>;
  getCurrentSerialNumber(taskId: number): Promise<number>;

  // Userbot Sessions
  getActiveUserbotSession(): Promise<UserbotSession | undefined>;
  createUserbotSession(data: InsertUserbotSession): Promise<UserbotSession>;
  activateUserbotSession(phoneNumber: string, sessionString: string): Promise<void>;
  deactivateUserbotSession(): Promise<void>;
  cancelPendingLogin(phoneNumber: string): Promise<void>;

  // GitHub Settings
  getGithubSettings(): Promise<any>;
  linkGithubRepository(owner: string, repo: string): Promise<any>;
  unlinkGithubRepository(): Promise<void>;

  // Dashboard Stats
  getDashboardStats(): Promise<any>;

  // Advanced AI Rules - Entity Replacements
  getEntityReplacements(taskId: number): Promise<any[]>;
  createEntityReplacement(data: any): Promise<any>;
  updateEntityReplacement(id: number, data: any): Promise<void>;
  deleteEntityReplacement(id: number): Promise<void>;

  // Advanced AI Rules - Context Rules
  getContextRules(taskId: number): Promise<any[]>;
  createContextRule(data: any): Promise<any>;
  updateContextRule(id: number, data: any): Promise<void>;
  deleteContextRule(id: number): Promise<void>;

  // Advanced AI Rules - Training Examples
  getTrainingExamples(taskId?: number, exampleType?: string): Promise<any[]>;
  createTrainingExample(data: any): Promise<any>;
  deleteTrainingExample(id: number): Promise<void>;

  // Advanced AI Rules - Processing Config
  getProcessingConfig(taskId?: number): Promise<any>;
  saveProcessingConfig(data: any): Promise<number>;

  // AI Publishing Templates
  getPublishingTemplates(taskId: number): Promise<any[]>;
  getPublishingTemplate(id: number): Promise<any>;
  getDefaultPublishingTemplate(taskId: number): Promise<any>;
  createPublishingTemplate(data: any): Promise<any>;
  updatePublishingTemplate(id: number, data: any): Promise<void>;
  deletePublishingTemplate(id: number): Promise<void>;
  setDefaultPublishingTemplate(taskId: number, templateId: number): Promise<void>;

  // Template Custom Fields
  getTemplateCustomFields(templateId: number): Promise<any[]>;
  createTemplateCustomField(data: any): Promise<any>;
  updateTemplateCustomField(id: number, data: any): Promise<void>;
  deleteTemplateCustomField(id: number): Promise<void>;
  reorderTemplateCustomFields(templateId: number, fieldOrders: { id: number; order: number }[]): Promise<void>;

  // AI Usage Tracking
  getUsageStats(filters: any): Promise<any[]>;
  getUsageStatsSummary(filters: any): Promise<any>;
  recordUsage(data: any): Promise<any>;
}

export class DbStorage implements IStorage {
  // User Management
  async getUser(id: number): Promise<User | undefined> {
    const result = await database.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await database.select().from(schema.users).where(eq(schema.users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const result = await database.insert(schema.users).values(insertUser).returning();
    return result[0];
  }

  // Admin Management
  async getAdmins(): Promise<Admin[]> {
    return await database.select().from(schema.admins).orderBy(desc(schema.admins.createdAt));
  }

  async getAdmin(telegramId: string): Promise<Admin | undefined> {
    const result = await database.select().from(schema.admins).where(eq(schema.admins.telegramId, telegramId)).limit(1);
    return result[0];
  }

  async createAdmin(insertAdmin: InsertAdmin): Promise<Admin> {
    const result = await database.insert(schema.admins).values(insertAdmin).returning();
    return result[0];
  }

  async deleteAdmin(id: number): Promise<void> {
    await database.delete(schema.admins).where(eq(schema.admins.id, id));
  }

  // Task Management
  async getTasks(): Promise<ForwardingTask[]> {
    return await database.select().from(schema.forwardingTasks).orderBy(desc(schema.forwardingTasks.createdAt));
  }

  async getTask(id: number): Promise<ForwardingTask | undefined> {
    const result = await database.select().from(schema.forwardingTasks).where(eq(schema.forwardingTasks.id, id)).limit(1);
    return result[0];
  }

  async createTask(insertTask: InsertForwardingTask): Promise<ForwardingTask> {
    const result = await database.insert(schema.forwardingTasks).values(insertTask).returning();
    return result[0];
  }

  async updateTask(id: number, updates: Partial<InsertForwardingTask>): Promise<ForwardingTask | undefined> {
    const result = await database
      .update(schema.forwardingTasks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.forwardingTasks.id, id))
      .returning();
    return result[0];
  }

  async deleteTask(id: number): Promise<void> {
    await database.delete(schema.forwardingTasks).where(eq(schema.forwardingTasks.id, id));
  }

  async toggleTask(id: number): Promise<ForwardingTask | undefined> {
    const task = await this.getTask(id);
    if (!task) return undefined;
    
    const result = await database
      .update(schema.forwardingTasks)
      .set({ isActive: !task.isActive, updatedAt: new Date() })
      .where(eq(schema.forwardingTasks.id, id))
      .returning();
    return result[0];
  }

  // Channel Management
  async getChannels(): Promise<Channel[]> {
    return await database.select().from(schema.channels).where(eq(schema.channels.isActive, true));
  }

  async getChannel(id: number): Promise<Channel | undefined> {
    const result = await database.select().from(schema.channels).where(eq(schema.channels.id, id)).limit(1);
    return result[0];
  }

  async createChannel(insertChannel: InsertChannel): Promise<Channel> {
    const result = await database.insert(schema.channels).values(insertChannel).returning();
    return result[0];
  }

  async updateChannel(id: number, updates: Partial<InsertChannel>): Promise<Channel | undefined> {
    const result = await database
      .update(schema.channels)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.channels.id, id))
      .returning();
    return result[0];
  }

  async deleteChannel(id: number): Promise<void> {
    await database.delete(schema.channels).where(eq(schema.channels.id, id));
  }

  // AI Provider Management
  async getAiProviders(): Promise<AiProvider[]> {
    return await database.select().from(schema.aiProviders);
  }

  async getAiProvider(id: number): Promise<AiProvider | undefined> {
    const result = await database.select().from(schema.aiProviders).where(eq(schema.aiProviders.id, id)).limit(1);
    return result[0];
  }

  async createAiProvider(insertProvider: InsertAiProvider): Promise<AiProvider> {
    const result = await database.insert(schema.aiProviders).values(insertProvider).returning();
    return result[0];
  }

  async updateAiProvider(id: number, updates: Partial<InsertAiProvider>): Promise<AiProvider | undefined> {
    const result = await database
      .update(schema.aiProviders)
      .set(updates)
      .where(eq(schema.aiProviders.id, id))
      .returning();
    return result[0];
  }

  async getAiProviderByName(name: string): Promise<AiProvider | undefined> {
    const result = await database.select().from(schema.aiProviders).where(eq(schema.aiProviders.name, name)).limit(1);
    return result[0];
  }

  async toggleAiProvider(id: number): Promise<AiProvider | undefined> {
    const provider = await this.getAiProvider(id);
    if (!provider) return undefined;
    
    const result = await database
      .update(schema.aiProviders)
      .set({ isActive: !provider.isActive })
      .where(eq(schema.aiProviders.id, id))
      .returning();
    return result[0];
  }

  // AI Model Management
  async getAiModels(): Promise<AiModel[]> {
    return await database.select().from(schema.aiModels).where(eq(schema.aiModels.isActive, true));
  }

  async getAiModelsByProvider(providerId: number): Promise<AiModel[]> {
    return await database
      .select()
      .from(schema.aiModels)
      .where(and(eq(schema.aiModels.providerId, providerId), eq(schema.aiModels.isActive, true)));
  }

  async createAiModel(model: InsertAiModel): Promise<AiModel> {
    const result = await database.insert(schema.aiModels).values(model).returning();
    return result[0];
  }

  async updateModel(id: number, updates: any): Promise<AiModel | undefined> {
    const result = await database
      .update(schema.aiModels)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.aiModels.id, id))
      .returning();
    return result[0];
  }

  async getModelUsageStats(modelId: number): Promise<any> {
    const result = await database
      .select({
        totalRequests: sql`SUM(request_count)`,
        totalTokens: sql`SUM(total_tokens_input + total_tokens_output)`,
        totalErrors: sql`SUM(error_count)`,
        avgLatency: sql`AVG(avg_latency)`
      })
      .from(schema.aiUsageStats)
      .where(eq(schema.aiUsageStats.modelId, modelId));
    return result[0];
  }

  // AI Rule Management
  async getTaskRules(taskId: number): Promise<AiRule[]> {
    return await database.select().from(schema.aiRules).where(eq(schema.aiRules.taskId, taskId)).orderBy(desc(schema.aiRules.priority));
  }

  async getTaskRulesByType(taskId: number, type: string): Promise<AiRule[]> {
    return await database
      .select()
      .from(schema.aiRules)
      .where(and(eq(schema.aiRules.taskId, taskId), eq(schema.aiRules.type, type), eq(schema.aiRules.isActive, true)))
      .orderBy(desc(schema.aiRules.priority));
  }

  async createRule(insertRule: InsertAiRule): Promise<AiRule> {
    const result = await database.insert(schema.aiRules).values(insertRule).returning();
    return result[0];
  }

  async updateRule(id: number, updates: Partial<InsertAiRule>): Promise<AiRule | undefined> {
    const result = await database
      .update(schema.aiRules)
      .set(updates)
      .where(eq(schema.aiRules.id, id))
      .returning();
    return result[0];
  }

  async toggleRule(id: number): Promise<AiRule | undefined> {
    const rules = await database.select().from(schema.aiRules).where(eq(schema.aiRules.id, id)).limit(1);
    const rule = rules[0];
    if (!rule) return undefined;
    
    const result = await database
      .update(schema.aiRules)
      .set({ isActive: !rule.isActive })
      .where(eq(schema.aiRules.id, id))
      .returning();
    return result[0];
  }

  async deleteRule(id: number): Promise<void> {
    await database.delete(schema.aiRules).where(eq(schema.aiRules.id, id));
  }

  // Task Logs and Stats
  async getTaskLogs(taskId: number, limit: number = 50): Promise<TaskLog[]> {
    return await database
      .select()
      .from(schema.taskLogs)
      .where(eq(schema.taskLogs.taskId, taskId))
      .orderBy(desc(schema.taskLogs.timestamp))
      .limit(limit);
  }

  async getTaskStats(taskId: number, days: number = 7): Promise<TaskStats[]> {
    const startDate = format(subDays(new Date(), days), 'yyyy-MM-dd');
    return await database
      .select()
      .from(schema.taskStats)
      .where(and(eq(schema.taskStats.taskId, taskId), sql`${schema.taskStats.date} >= ${startDate}`))
      .orderBy(desc(schema.taskStats.date));
  }

  async getAllLogs(limit: number = 100): Promise<TaskLog[]> {
    return await database
      .select()
      .from(schema.taskLogs)
      .orderBy(desc(schema.taskLogs.timestamp))
      .limit(limit);
  }

  // Error Logs
  async getErrorLogs(limit: number = 50): Promise<any[]> {
    return await database
      .select()
      .from(schema.errorLogs)
      .orderBy(desc(schema.errorLogs.timestamp))
      .limit(limit);
  }

  async createErrorLog(data: any): Promise<any> {
    const result = await database.insert(schema.errorLogs).values(data).returning();
    return result[0];
  }

  // Bot Config / Settings
  async getBotConfig(): Promise<{ key: string; value: string }[]> {
    return await database.select({ key: schema.botConfig.key, value: schema.botConfig.value }).from(schema.botConfig);
  }

  async getBotConfigValue(key: string): Promise<string | undefined> {
    const result = await database.select().from(schema.botConfig).where(eq(schema.botConfig.key, key)).limit(1);
    return result[0]?.value;
  }

  async setBotConfigValue(key: string, value: string, description?: string): Promise<void> {
    await database
      .insert(schema.botConfig)
      .values({ key, value, description })
      .onConflictDoUpdate({
        target: schema.botConfig.key,
        set: { value, description, updatedAt: new Date() }
      });
  }

  async deleteBotConfig(key: string): Promise<void> {
    await database.delete(schema.botConfig).where(eq(schema.botConfig.key, key));
  }

  // Message Archive
  async clearArchive(taskId?: number): Promise<void> {
    if (taskId) {
      await database.delete(schema.messageArchive).where(eq(schema.messageArchive.taskId, taskId));
      await database
        .update(schema.archiveSerialCounter)
        .set({ lastSerial: 0, updatedAt: new Date() })
        .where(eq(schema.archiveSerialCounter.taskId, taskId));
    } else {
      await database.delete(schema.messageArchive);
      await database
        .update(schema.archiveSerialCounter)
        .set({ lastSerial: 0, updatedAt: new Date() });
    }
  }

  async getArchiveMessages(filters: any) {
    const { 
      taskId, search, classification, province, specialist, newsType, 
      status, dateFrom, dateTo, isPinned, isFlagged, hasMedia,
      limit = 50, offset = 0, sortBy = 'createdAt', sortOrder = 'desc' 
    } = filters;

    let conditions = [];
    if (taskId) conditions.push(eq(schema.messageArchive.taskId, taskId));
    if (classification) conditions.push(eq(schema.messageArchive.classification, classification));
    if (province) conditions.push(eq(schema.messageArchive.province, province));
    if (specialist) conditions.push(eq(schema.messageArchive.specialist, specialist));
    if (newsType) conditions.push(eq(schema.messageArchive.newsType, newsType));
    if (status) conditions.push(eq(schema.messageArchive.status, status));
    if (isPinned !== undefined) conditions.push(eq(schema.messageArchive.isPinned, isPinned));
    if (isFlagged !== undefined) conditions.push(eq(schema.messageArchive.isFlagged, isFlagged));
    if (hasMedia !== undefined) conditions.push(eq(schema.messageArchive.hasMedia, hasMedia));
    
    if (dateFrom) conditions.push(sql`${schema.messageArchive.createdAt} >= ${new Date(dateFrom)}`);
    if (dateTo) conditions.push(sql`${schema.messageArchive.createdAt} <= ${new Date(dateTo)}`);
    
    if (search) {
      conditions.push(sql`(${schema.messageArchive.title} ILIKE ${'%' + search + '%'} OR ${schema.messageArchive.originalText} ILIKE ${'%' + search + '%'} OR ${schema.messageArchive.processedText} ILIKE ${'%' + search + '%'})`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const messages = await database
      .select()
      .from(schema.messageArchive)
      .where(whereClause)
      .orderBy(sortOrder === 'desc' ? desc((schema.messageArchive as any)[sortBy]) : (schema.messageArchive as any)[sortBy])
      .limit(limit)
      .offset(offset);

    const totalResult = await database
      .select({ count: sql`count(*)` })
      .from(schema.messageArchive)
      .where(whereClause);

    return {
      messages,
      total: Number(totalResult[0].count),
      limit,
      offset
    };
  }

  async getArchiveStats(taskId?: number) {
    const conditions = taskId ? [eq(schema.messageArchive.taskId, taskId)] : [];
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const totalCount = await database.select({ count: sql`count(*)` }).from(schema.messageArchive).where(whereClause);
    const pinnedCount = await database.select({ count: sql`count(*)` }).from(schema.messageArchive).where(and(whereClause as any, eq(schema.messageArchive.isPinned, true)));
    const flaggedCount = await database.select({ count: sql`count(*)` }).from(schema.messageArchive).where(and(whereClause as any, eq(schema.messageArchive.isFlagged, true)));
    
    const byClassification = await database
      .select({ classification: schema.messageArchive.classification, count: sql`count(*)` })
      .from(schema.messageArchive)
      .where(whereClause)
      .groupBy(schema.messageArchive.classification);

    const byProvince = await database
      .select({ province: schema.messageArchive.province, count: sql`count(*)` })
      .from(schema.messageArchive)
      .where(whereClause)
      .groupBy(schema.messageArchive.province);

    const byNewsType = await database
      .select({ newsType: schema.messageArchive.newsType, count: sql`count(*)` })
      .from(schema.messageArchive)
      .where(whereClause)
      .groupBy(schema.messageArchive.newsType);

    const recentActivity = await database
      .select({ 
        date: sql`DATE(${schema.messageArchive.createdAt})`, 
        count: sql`count(*)` 
      })
      .from(schema.messageArchive)
      .where(whereClause)
      .groupBy(sql`DATE(${schema.messageArchive.createdAt})`)
      .orderBy(desc(sql`DATE(${schema.messageArchive.createdAt})`))
      .limit(14);

    return {
      total: Number(totalCount[0].count),
      pinned: Number(pinnedCount[0].count),
      flagged: Number(flaggedCount[0].count),
      byClassification,
      byProvince,
      byNewsType,
      recentActivity: recentActivity.map(r => ({ date: String(r.date), count: Number(r.count) }))
    };
  }

  async getArchiveFilterOptions(taskId?: number) {
    const conditions = taskId ? [eq(schema.messageArchive.taskId, taskId)] : [];
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const classifications = await database
      .selectDistinct({ value: schema.messageArchive.classification })
      .from(schema.messageArchive)
      .where(whereClause);

    const provinces = await database
      .selectDistinct({ value: schema.messageArchive.province })
      .from(schema.messageArchive)
      .where(whereClause);

    const newsTypes = await database
      .selectDistinct({ value: schema.messageArchive.newsType })
      .from(schema.messageArchive)
      .where(whereClause);

    const specialists = await database
      .selectDistinct({ value: schema.messageArchive.specialist })
      .from(schema.messageArchive)
      .where(whereClause);

    const sources = await database
      .selectDistinct({ value: schema.messageArchive.sourceChannelTitle })
      .from(schema.messageArchive)
      .where(whereClause);

    return {
      classifications: classifications.map(c => c.value).filter(Boolean),
      provinces: provinces.map(p => p.value).filter(Boolean),
      newsTypes: newsTypes.map(n => n.value).filter(Boolean),
      specialists: specialists.map(s => s.value).filter(Boolean),
      sources: sources.map(s => s.value).filter(Boolean)
    };
  }

  async getArchiveMessage(id: number) {
    const result = await database.select().from(schema.messageArchive).where(eq(schema.messageArchive.id, id)).limit(1);
    return result[0];
  }

  async updateArchiveMessage(id: number, data: any) {
    const result = await database
      .update(schema.messageArchive)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(schema.messageArchive.id, id))
      .returning();
    return result[0];
  }

  async deleteArchiveMessage(id: number) {
    await database.delete(schema.messageArchive).where(eq(schema.messageArchive.id, id));
  }

  async toggleArchivePin(id: number) {
    const message = await this.getArchiveMessage(id);
    if (!message) return undefined;
    
    const result = await database
      .update(schema.messageArchive)
      .set({ isPinned: !message.isPinned, updatedAt: new Date() })
      .where(eq(schema.messageArchive.id, id))
      .returning();
    return result[0];
  }

  async toggleArchiveFlag(id: number, reason?: string) {
    const message = await this.getArchiveMessage(id);
    if (!message) return undefined;
    
    const result = await database
      .update(schema.messageArchive)
      .set({ 
        isFlagged: !message.isFlagged, 
        flagReason: !message.isFlagged ? reason || null : null,
        updatedAt: new Date() 
      })
      .where(eq(schema.messageArchive.id, id))
      .returning();
    return result[0];
  }

  async getCurrentSerialNumber(taskId: number): Promise<number> {
    const result = await database
      .select({ lastSerial: schema.archiveSerialCounter.lastSerial })
      .from(schema.archiveSerialCounter)
      .where(eq(schema.archiveSerialCounter.taskId, taskId))
      .limit(1);
    
    return result[0]?.lastSerial || 0;
  }

  // Userbot Sessions
  async getActiveUserbotSession(): Promise<UserbotSession | undefined> {
    const result = await database
      .select()
      .from(schema.userbotSessions)
      .where(eq(schema.userbotSessions.isActive, true))
      .limit(1);
    return result[0];
  }

  async createUserbotSession(data: InsertUserbotSession): Promise<UserbotSession> {
    const result = await database.insert(schema.userbotSessions).values(data).returning();
    return result[0];
  }

  async activateUserbotSession(phoneNumber: string, sessionString: string): Promise<void> {
    // Deactivate all first
    await database.update(schema.userbotSessions).set({ isActive: false });
    
    // Activate specific one
    await database
      .update(schema.userbotSessions)
      .set({ 
        sessionString, 
        isActive: true, 
        status: 'active',
        lastLoginAt: new Date(),
        updatedAt: new Date() 
      })
      .where(eq(schema.userbotSessions.phoneNumber, phoneNumber));
  }

  async deactivateUserbotSession(): Promise<void> {
    await database.update(schema.userbotSessions).set({ isActive: false, status: 'expired' });
  }

  async cancelPendingLogin(phoneNumber: string): Promise<void> {
    await database.delete(schema.userbotSessions).where(eq(schema.userbotSessions.phoneNumber, phoneNumber));
  }

  // GitHub Settings
  async getGithubSettings(): Promise<any> {
    const result = await database.select().from(schema.githubSettings).limit(1);
    return result[0];
  }

  async linkGithubRepository(owner: string, repo: string): Promise<any> {
    await database.delete(schema.githubSettings);
    const result = await database.insert(schema.githubSettings).values({
      repoOwner: owner,
      repoName: repo,
    }).returning();
    return result[0];
  }

  async unlinkGithubRepository(): Promise<void> {
    await database.delete(schema.githubSettings);
  }

  // Dashboard Stats
  async getDashboardStats(): Promise<any> {
    const today = format(new Date(), 'yyyy-MM-dd');
    const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

    const totalTasks = await database.select({ count: sql`count(*)` }).from(schema.forwardingTasks);
    const activeTasks = await database.select({ count: sql`count(*)` }).from(schema.forwardingTasks).where(eq(schema.forwardingTasks.isActive, true));
    
    const todayStats = await database.select().from(schema.taskStats).where(eq(schema.taskStats.date, today));
    const yesterdayStats = await database.select().from(schema.taskStats).where(eq(schema.taskStats.date, yesterday));

    const todayTotal = todayStats.reduce((acc, curr) => acc + curr.messagesForwarded, 0);
    const yesterdayTotal = yesterdayStats.reduce((acc, curr) => acc + curr.messagesForwarded, 0);

    const todayChange = yesterdayTotal === 0 ? 100 : Math.round(((todayTotal - yesterdayTotal) / yesterdayTotal) * 100);

    return {
      totalTasks: Number(totalTasks[0].count),
      activeTasks: Number(activeTasks[0].count),
      messagesToday: todayTotal,
      messagesYesterday: yesterdayTotal,
      trend: todayChange,
      recentActivity: [] // Will be populated if needed
    };
  }

  // Advanced AI Rules - Entity Replacements
  async getEntityReplacements(taskId: number): Promise<any[]> {
    return await database
      .select()
      .from(schema.aiEntityReplacements)
      .where(eq(schema.aiEntityReplacements.taskId, taskId))
      .orderBy(desc(schema.aiEntityReplacements.priority));
  }

  async createEntityReplacement(data: any): Promise<any> {
    const result = await database.insert(schema.aiEntityReplacements).values(data).returning();
    return result[0];
  }

  async updateEntityReplacement(id: number, data: any): Promise<void> {
    await database.update(schema.aiEntityReplacements).set(data).where(eq(schema.aiEntityReplacements.id, id));
  }

  async deleteEntityReplacement(id: number): Promise<void> {
    await database.delete(schema.aiEntityReplacements).where(eq(schema.aiEntityReplacements.id, id));
  }

  // Advanced AI Rules - Context Rules
  async getContextRules(taskId: number): Promise<any[]> {
    return await database
      .select()
      .from(schema.aiContextRules)
      .where(eq(schema.aiContextRules.taskId, taskId))
      .orderBy(desc(schema.aiContextRules.priority));
  }

  async createContextRule(data: any): Promise<any> {
    const result = await database.insert(schema.aiContextRules).values(data).returning();
    return result[0];
  }

  async updateContextRule(id: number, data: any): Promise<void> {
    await database.update(schema.aiContextRules).set(data).where(eq(schema.aiContextRules.id, id));
  }

  async deleteContextRule(id: number): Promise<void> {
    await database.delete(schema.aiContextRules).where(eq(schema.aiContextRules.id, id));
  }

  // Advanced AI Rules - Training Examples
  async getTrainingExamples(taskId?: number, exampleType?: string): Promise<any[]> {
    let conditions = [];
    if (taskId) conditions.push(eq(schema.aiTrainingExamples.taskId, taskId));
    if (exampleType) conditions.push(eq(schema.aiTrainingExamples.exampleType, exampleType));
    
    return await database
      .select()
      .from(schema.aiTrainingExamples)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.aiTrainingExamples.createdAt));
  }

  async createTrainingExample(data: any): Promise<any> {
    const result = await database.insert(schema.aiTrainingExamples).values(data).returning();
    return result[0];
  }

  async deleteTrainingExample(id: number): Promise<void> {
    await database.delete(schema.aiTrainingExamples).where(eq(schema.aiTrainingExamples.id, id));
  }

  // Advanced AI Rules - Processing Config
  async getProcessingConfig(taskId?: number): Promise<any> {
    const result = await database
      .select()
      .from(schema.aiProcessingConfig)
      .where(taskId ? eq(schema.aiProcessingConfig.taskId, taskId) : eq(schema.aiProcessingConfig.configType, 'global'))
      .limit(1);
    return result[0];
  }

  async saveProcessingConfig(data: any): Promise<number> {
    const { id, ...rest } = data;
    if (id) {
      await database.update(schema.aiProcessingConfig).set({ ...rest, updatedAt: new Date() }).where(eq(schema.aiProcessingConfig.id, id));
      return id;
    } else {
      const result = await database.insert(schema.aiProcessingConfig).values(rest).returning();
      return result[0].id;
    }
  }

  // AI Publishing Templates
  async getPublishingTemplates(taskId: number): Promise<any[]> {
    return await database
      .select()
      .from(schema.aiPublishingTemplates)
      .where(eq(schema.aiPublishingTemplates.taskId, taskId))
      .orderBy(desc(schema.aiPublishingTemplates.isDefault), desc(schema.aiPublishingTemplates.createdAt));
  }

  async getPublishingTemplate(id: number): Promise<any> {
    const result = await database.select().from(schema.aiPublishingTemplates).where(eq(schema.aiPublishingTemplates.id, id)).limit(1);
    return result[0];
  }

  async getDefaultPublishingTemplate(taskId: number): Promise<any> {
    const result = await database
      .select()
      .from(schema.aiPublishingTemplates)
      .where(and(eq(schema.aiPublishingTemplates.taskId, taskId), eq(schema.aiPublishingTemplates.isDefault, true)))
      .limit(1);
    return result[0];
  }

  async createPublishingTemplate(data: any): Promise<any> {
    const result = await database.insert(schema.aiPublishingTemplates).values(data).returning();
    return result[0];
  }

  async updatePublishingTemplate(id: number, data: any): Promise<void> {
    await database.update(schema.aiPublishingTemplates).set({ ...data, updatedAt: new Date() }).where(eq(schema.aiPublishingTemplates.id, id));
  }

  async deletePublishingTemplate(id: number): Promise<void> {
    await database.delete(schema.aiPublishingTemplates).where(eq(schema.aiPublishingTemplates.id, id));
  }

  async setDefaultPublishingTemplate(taskId: number, templateId: number): Promise<void> {
    // Unset current default
    await database
      .update(schema.aiPublishingTemplates)
      .set({ isDefault: false })
      .where(eq(schema.aiPublishingTemplates.taskId, taskId));
    
    // Set new default
    await database
      .update(schema.aiPublishingTemplates)
      .set({ isDefault: true })
      .where(eq(schema.aiPublishingTemplates.id, templateId));
  }

  // Template Custom Fields
  async getTemplateCustomFields(templateId: number): Promise<any[]> {
    return await database
      .select()
      .from(schema.templateCustomFields)
      .where(eq(schema.templateCustomFields.templateId, templateId))
      .orderBy(schema.templateCustomFields.displayOrder);
  }

  async createTemplateCustomField(data: any): Promise<any> {
    const result = await database.insert(schema.templateCustomFields).values(data).returning();
    return result[0];
  }

  async updateTemplateCustomField(id: number, data: any): Promise<void> {
    await database.update(schema.templateCustomFields).set(data).where(eq(schema.templateCustomFields.id, id));
  }

  async deleteTemplateCustomField(id: number): Promise<void> {
    await database.delete(schema.templateCustomFields).where(eq(schema.templateCustomFields.id, id));
  }

  async reorderTemplateCustomFields(templateId: number, fieldOrders: { id: number; order: number }[]): Promise<void> {
    for (const item of fieldOrders) {
      await database
        .update(schema.templateCustomFields)
        .set({ displayOrder: item.order })
        .where(eq(schema.templateCustomFields.id, item.id));
    }
  }

  // AI Usage Tracking
  async getUsageStats(filters: any): Promise<any[]> {
    let conditions = [];
    if (filters.providerId) conditions.push(eq(schema.aiUsageStats.providerId, filters.providerId));
    if (filters.modelId) conditions.push(eq(schema.aiUsageStats.modelId, filters.modelId));
    if (filters.taskId) conditions.push(eq(schema.aiUsageStats.taskId, filters.taskId));
    if (filters.dateFrom) conditions.push(sql`${schema.aiUsageStats.usageDate} >= ${filters.dateFrom}`);
    if (filters.dateTo) conditions.push(sql`${schema.aiUsageStats.usageDate} <= ${filters.dateTo}`);

    return await database
      .select()
      .from(schema.aiUsageStats)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(schema.aiUsageStats.usageDate));
  }

  async getUsageStatsSummary(filters: any): Promise<any> {
    let conditions = [];
    if (filters.providerId) conditions.push(eq(schema.aiUsageStats.providerId, filters.providerId));
    if (filters.dateFrom) conditions.push(sql`${schema.aiUsageStats.usageDate} >= ${filters.dateFrom}`);
    if (filters.dateTo) conditions.push(sql`${schema.aiUsageStats.usageDate} <= ${filters.dateTo}`);

    const result = await database
      .select({
        totalRequests: sql`SUM(request_count)`,
        totalTokens: sql`SUM(total_tokens_input + total_tokens_output)`,
        totalTokensInput: sql`SUM(total_tokens_input)`,
        totalTokensOutput: sql`SUM(total_tokens_output)`,
        successCount: sql`SUM(success_count)`,
        errorCount: sql`SUM(error_count)`
      })
      .from(schema.aiUsageStats)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return result[0];
  }

  async recordUsage(data: any): Promise<any> {
    const result = await database.insert(schema.aiUsageStats).values(data).returning();
    return result[0];
  }
}

export const storage = new DbStorage();
