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
    const [updatedTask] = await database.update(schema.forwardingTasks)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(schema.forwardingTasks.id, id))
      .returning();
    return updatedTask;
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

  async getAiModel(id: number): Promise<AiModel | undefined> {
    const result = await database.select().from(schema.aiModels).where(eq(schema.aiModels.id, id)).limit(1);
    return result[0];
  }

  async updateModel(id: number, data: Partial<InsertAiModel>): Promise<AiModel | undefined> {
    const result = await database
      .update(schema.aiModels)
      .set(data)
      .where(eq(schema.aiModels.id, id))
      .returning();
    return result[0];
  }

  async getModelsByProvider(providerId: number): Promise<AiModel[]> {
    return await database
      .select()
      .from(schema.aiModels)
      .where(eq(schema.aiModels.providerId, providerId));
  }

  // AI Usage Statistics
  async getUsageStats(filters: {
    providerId?: number;
    modelId?: number;
    taskId?: number;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<AiUsageStats[]> {
    const conditions = [];
    
    if (filters.providerId) {
      conditions.push(eq(schema.aiUsageStats.providerId, filters.providerId));
    }
    if (filters.modelId) {
      conditions.push(eq(schema.aiUsageStats.modelId, filters.modelId));
    }
    if (filters.taskId) {
      conditions.push(eq(schema.aiUsageStats.taskId, filters.taskId));
    }
    if (filters.dateFrom) {
      conditions.push(sql`${schema.aiUsageStats.usageDate} >= ${filters.dateFrom}`);
    }
    if (filters.dateTo) {
      conditions.push(sql`${schema.aiUsageStats.usageDate} <= ${filters.dateTo}`);
    }
    
    if (conditions.length === 0) {
      return await database
        .select()
        .from(schema.aiUsageStats)
        .orderBy(desc(schema.aiUsageStats.usageDate))
        .limit(100);
    }
    
    return await database
      .select()
      .from(schema.aiUsageStats)
      .where(and(...conditions))
      .orderBy(desc(schema.aiUsageStats.usageDate))
      .limit(100);
  }

  async getUsageStatsSummary(filters: {
    providerId?: number;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<{
    totalRequests: number;
    totalTokensInput: number;
    totalTokensOutput: number;
    totalCost: string;
    byModel: Array<{ modelName: string; requests: number; tokens: number }>;
  }> {
    const conditions = [];
    
    if (filters.providerId) {
      conditions.push(eq(schema.aiUsageStats.providerId, filters.providerId));
    }
    if (filters.dateFrom) {
      conditions.push(sql`${schema.aiUsageStats.usageDate} >= ${filters.dateFrom}`);
    }
    if (filters.dateTo) {
      conditions.push(sql`${schema.aiUsageStats.usageDate} <= ${filters.dateTo}`);
    }
    
    let stats: AiUsageStats[];
    if (conditions.length === 0) {
      stats = await database.select().from(schema.aiUsageStats);
    } else {
      stats = await database
        .select()
        .from(schema.aiUsageStats)
        .where(and(...conditions));
    }
    
    let totalRequests = 0;
    let totalTokensInput = 0;
    let totalTokensOutput = 0;
    let totalCost = 0;
    const modelStats: Record<string, { requests: number; tokens: number }> = {};
    
    for (const stat of stats) {
      totalRequests += stat.requestCount;
      totalTokensInput += stat.totalTokensInput;
      totalTokensOutput += stat.totalTokensOutput;
      totalCost += parseFloat(stat.totalCost || '0');
      
      if (!modelStats[stat.modelName]) {
        modelStats[stat.modelName] = { requests: 0, tokens: 0 };
      }
      modelStats[stat.modelName].requests += stat.requestCount;
      modelStats[stat.modelName].tokens += stat.totalTokensInput + stat.totalTokensOutput;
    }
    
    const byModel = Object.entries(modelStats).map(([modelName, data]) => ({
      modelName,
      requests: data.requests,
      tokens: data.tokens,
    }));
    
    return {
      totalRequests,
      totalTokensInput,
      totalTokensOutput,
      totalCost: totalCost.toFixed(6),
      byModel,
    };
  }

  async getModelUsageStats(modelId: number): Promise<AiUsageStats[]> {
    return await database
      .select()
      .from(schema.aiUsageStats)
      .where(eq(schema.aiUsageStats.modelId, modelId))
      .orderBy(desc(schema.aiUsageStats.usageDate))
      .limit(30);
  }

  async recordUsage(data: InsertAiUsageStats): Promise<AiUsageStats> {
    const result = await database
      .insert(schema.aiUsageStats)
      .values(data)
      .returning();
    return result[0];
  }

  // AI Rule Management
  async getTaskRules(taskId: number): Promise<AiRule[]> {
    return await database
      .select()
      .from(schema.aiRules)
      .where(eq(schema.aiRules.taskId, taskId))
      .orderBy(desc(schema.aiRules.priority));
  }

  async getTaskRulesByType(taskId: number, type: string): Promise<AiRule[]> {
    return await database
      .select()
      .from(schema.aiRules)
      .where(and(eq(schema.aiRules.taskId, taskId), eq(schema.aiRules.type, type)))
      .orderBy(desc(schema.aiRules.priority));
  }

  async createRule(insertRule: InsertAiRule): Promise<AiRule> {
    const result = await database.insert(schema.aiRules).values(insertRule).returning();
    return result[0];
  }

  async updateRule(id: number, updates: Partial<InsertAiRule>): Promise<AiRule | undefined> {
    // Filter out fields that should not be updated (createdAt, id, taskId)
    const { createdAt, id: _, taskId, ...filteredUpdates } = updates as any;
    
    const result = await database
      .update(schema.aiRules)
      .set(filteredUpdates)
      .where(eq(schema.aiRules.id, id))
      .returning();
    return result[0];
  }

  async toggleRule(id: number): Promise<AiRule | undefined> {
    const rule = await database.select().from(schema.aiRules).where(eq(schema.aiRules.id, id)).limit(1);
    if (!rule[0]) return undefined;
    
    const result = await database
      .update(schema.aiRules)
      .set({ isActive: !rule[0].isActive })
      .where(eq(schema.aiRules.id, id))
      .returning();
    return result[0];
  }

  async deleteRule(id: number): Promise<void> {
    await database.delete(schema.aiRules).where(eq(schema.aiRules.id, id));
  }

  // Task Logs and Stats
  async getTaskLogs(taskId: number, limit: number = 100): Promise<TaskLog[]> {
    return await database
      .select()
      .from(schema.taskLogs)
      .where(eq(schema.taskLogs.taskId, taskId))
      .orderBy(desc(schema.taskLogs.timestamp))
      .limit(limit);
  }

  async getTaskStats(taskId: number, days: number = 7): Promise<TaskStats[]> {
    return await database
      .select()
      .from(schema.taskStats)
      .where(eq(schema.taskStats.taskId, taskId))
      .orderBy(desc(schema.taskStats.date))
      .limit(days);
  }

  async getAllLogs(limit: number = 100): Promise<TaskLog[]> {
    return await database
      .select()
      .from(schema.taskLogs)
      .orderBy(desc(schema.taskLogs.timestamp))
      .limit(limit);
  }

  // Error Logs
  async getErrorLogs(limit: number = 100): Promise<any[]> {
    return await database
      .select()
      .from(schema.errorLogs)
      .orderBy(desc(schema.errorLogs.timestamp))
      .limit(limit);
  }

  async createErrorLog(data: any): Promise<any> {
    const result = await database
      .insert(schema.errorLogs)
      .values(data)
      .returning();
    return result[0];
  }

  // Bot Config / Settings
  async getBotConfig(): Promise<{ key: string; value: string }[]> {
    const configs = await database.select().from(schema.botConfig);
    return configs.map(c => ({ key: c.key, value: c.value }));
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

  // Userbot Sessions
  async getActiveUserbotSession(): Promise<UserbotSession | undefined> {
    const result = await database
      .select()
      .from(schema.userbotSessions)
      .where(
        and(
          eq(schema.userbotSessions.isActive, true),
          eq(schema.userbotSessions.isPrimary, true)
        )
      )
      .limit(1);
    return result[0];
  }

  async createUserbotSession(data: InsertUserbotSession): Promise<UserbotSession> {
    // Deactivate any existing sessions for this phone number first
    await database
      .update(schema.userbotSessions)
      .set({ isActive: false, isPrimary: false })
      .where(eq(schema.userbotSessions.phoneNumber, data.phoneNumber));
    
    const result = await database
      .insert(schema.userbotSessions)
      .values({
        ...data,
        status: "pending",
      })
      .returning();
    return result[0];
  }

  async activateUserbotSession(phoneNumber: string, sessionString: string): Promise<void> {
    // First deactivate all other sessions
    await database
      .update(schema.userbotSessions)
      .set({ isActive: false, isPrimary: false })
      .where(eq(schema.userbotSessions.isActive, true));
    
    // Then activate the new session
    await database
      .update(schema.userbotSessions)
      .set({
        sessionString,
        isActive: true,
        isPrimary: true,
        status: "active",
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.userbotSessions.phoneNumber, phoneNumber));
  }

  async deactivateUserbotSession(): Promise<void> {
    await database
      .update(schema.userbotSessions)
      .set({
        isActive: false,
        isPrimary: false,
        status: "expired",
        sessionString: null,
        loginState: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.userbotSessions.isActive, true));
  }

  async cancelPendingLogin(phoneNumber: string): Promise<void> {
    await database
      .update(schema.userbotSessions)
      .set({
        status: "cancelled",
        loginState: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.userbotSessions.phoneNumber, phoneNumber),
          sql`${schema.userbotSessions.status} IN ('awaiting_code', 'awaiting_password')`
        )
      );
  }

  // GitHub Settings
  async getGithubSettings(): Promise<any> {
    const result = await database.select().from(schema.githubSettings).limit(1);
    return result[0] || null;
  }

  async linkGithubRepository(owner: string, repo: string): Promise<any> {
    const existing = await this.getGithubSettings();
    if (existing) {
      const result = await database
        .update(schema.githubSettings)
        .set({ repoOwner: owner, repoName: repo, updatedAt: new Date() })
        .where(eq(schema.githubSettings.id, existing.id))
        .returning();
      return result[0];
    } else {
      const result = await database
        .insert(schema.githubSettings)
        .values({ repoOwner: owner, repoName: repo })
        .returning();
      return result[0];
    }
  }

  async unlinkGithubRepository(): Promise<void> {
    await database.delete(schema.githubSettings);
  }

  // Dashboard Stats
  async getDashboardStats(): Promise<any> {
    const tasks = await this.getTasks();
    const channels = await this.getChannels();
    
    const activeTasks = tasks.filter(t => t.isActive).length;
    const totalForwarded = tasks.reduce((sum, t) => sum + t.totalForwarded, 0);
    
    return {
      totalTasks: tasks.length,
      activeTasks,
      inactiveTasks: tasks.length - activeTasks,
      totalChannels: channels.length,
      totalForwarded,
      aiEnabledTasks: tasks.filter(t => t.aiEnabled).length,
      videoEnabledTasks: tasks.filter(t => t.videoProcessingEnabled).length,
    };
  }

  // ============ Advanced AI Rules - Entity Replacements ============
  async getEntityReplacements(taskId: number): Promise<any[]> {
    return await database
      .select()
      .from(schema.aiEntityReplacements)
      .where(
        and(
          eq(schema.aiEntityReplacements.taskId, taskId),
          eq(schema.aiEntityReplacements.isActive, true)
        )
      )
      .orderBy(desc(schema.aiEntityReplacements.priority));
  }

  async createEntityReplacement(data: any): Promise<any> {
    const result = await database
      .insert(schema.aiEntityReplacements)
      .values({
        taskId: data.taskId,
        entityType: data.entityType || 'custom',
        originalText: data.originalText,
        replacementText: data.replacementText,
        caseSensitive: data.caseSensitive ?? false,
        useContext: data.useContext ?? true,
        isActive: data.isActive ?? true,
        priority: data.priority ?? 0,
      })
      .returning();
    return result[0];
  }

  async updateEntityReplacement(id: number, data: any): Promise<void> {
    const { createdAt, updatedAt, id: _, ...updateData } = data;
    await database
      .update(schema.aiEntityReplacements)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(schema.aiEntityReplacements.id, id));
  }

  async deleteEntityReplacement(id: number): Promise<void> {
    await database
      .delete(schema.aiEntityReplacements)
      .where(eq(schema.aiEntityReplacements.id, id));
  }

  // ============ Advanced AI Rules - Context Rules ============
  async getContextRules(taskId: number): Promise<any[]> {
    return await database
      .select()
      .from(schema.aiContextRules)
      .where(
        and(
          eq(schema.aiContextRules.taskId, taskId),
          eq(schema.aiContextRules.isActive, true)
        )
      )
      .orderBy(desc(schema.aiContextRules.priority));
  }

  async createContextRule(data: any): Promise<any> {
    const result = await database
      .insert(schema.aiContextRules)
      .values({
        taskId: data.taskId,
        ruleType: data.ruleType,
        triggerPattern: data.triggerPattern || null,
        targetSentiment: data.targetSentiment || 'neutral',
        instructions: data.instructions,
        examples: data.examples || null,
        isActive: data.isActive ?? true,
        priority: data.priority ?? 0,
      })
      .returning();
    return result[0];
  }

  async updateContextRule(id: number, data: any): Promise<void> {
    const { createdAt, updatedAt, id: _, ...updateData } = data;
    await database
      .update(schema.aiContextRules)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(schema.aiContextRules.id, id));
  }

  async deleteContextRule(id: number): Promise<void> {
    await database
      .delete(schema.aiContextRules)
      .where(eq(schema.aiContextRules.id, id));
  }

  // ============ Advanced AI Rules - Training Examples ============
  async getTrainingExamples(taskId?: number, exampleType?: string): Promise<any[]> {
    let query = database.select().from(schema.aiTrainingExamples);
    
    if (taskId && exampleType) {
      return await query.where(
        and(
          eq(schema.aiTrainingExamples.taskId, taskId),
          eq(schema.aiTrainingExamples.exampleType, exampleType),
          eq(schema.aiTrainingExamples.isActive, true)
        )
      ).orderBy(desc(schema.aiTrainingExamples.useCount));
    } else if (taskId) {
      return await query.where(
        and(
          eq(schema.aiTrainingExamples.taskId, taskId),
          eq(schema.aiTrainingExamples.isActive, true)
        )
      ).orderBy(desc(schema.aiTrainingExamples.useCount));
    } else if (exampleType) {
      return await query.where(
        and(
          eq(schema.aiTrainingExamples.exampleType, exampleType),
          eq(schema.aiTrainingExamples.isActive, true)
        )
      ).orderBy(desc(schema.aiTrainingExamples.useCount));
    }
    
    return await query
      .where(eq(schema.aiTrainingExamples.isActive, true))
      .orderBy(desc(schema.aiTrainingExamples.useCount))
      .limit(100);
  }

  async createTrainingExample(data: any): Promise<any> {
    if (!data.taskId) {
      throw new Error("taskId is required for training examples");
    }
    
    const result = await database
      .insert(schema.aiTrainingExamples)
      .values({
        taskId: data.taskId,
        exampleType: data.exampleType,
        inputText: data.inputText,
        expectedOutput: data.expectedOutput,
        explanation: data.explanation || null,
        tags: data.tags || null,
        isActive: data.isActive ?? true,
      })
      .returning();
    return result[0];
  }

  async updateTrainingExample(id: number, data: any): Promise<any> {
    const updateData: any = {};
    
    if (data.exampleType !== undefined) updateData.exampleType = data.exampleType;
    if (data.inputText !== undefined) updateData.inputText = data.inputText;
    if (data.expectedOutput !== undefined) updateData.expectedOutput = data.expectedOutput;
    if (data.explanation !== undefined) updateData.explanation = data.explanation;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    
    const result = await database
      .update(schema.aiTrainingExamples)
      .set(updateData)
      .where(eq(schema.aiTrainingExamples.id, id))
      .returning();
    return result[0];
  }

  async deleteTrainingExample(id: number): Promise<void> {
    await database
      .delete(schema.aiTrainingExamples)
      .where(eq(schema.aiTrainingExamples.id, id));
  }

  // ============ Advanced AI Rules - Processing Config ============
  async getProcessingConfig(taskId?: number): Promise<any> {
    if (taskId) {
      const result = await database
        .select()
        .from(schema.aiProcessingConfig)
        .where(eq(schema.aiProcessingConfig.taskId, taskId))
        .limit(1);
      if (result[0]) return result[0];
    }
    
    const globalConfig = await database
      .select()
      .from(schema.aiProcessingConfig)
      .where(
        and(
          eq(schema.aiProcessingConfig.configType, 'global'),
          sql`${schema.aiProcessingConfig.taskId} IS NULL`
        )
      )
      .limit(1);
    
    return globalConfig[0] || null;
  }

  async saveProcessingConfig(data: any): Promise<number> {
    const taskId = data.taskId || null;
    const configType = data.configType || (taskId ? 'task_specific' : 'global');
    
    let existing = null;
    if (taskId) {
      const result = await database
        .select()
        .from(schema.aiProcessingConfig)
        .where(eq(schema.aiProcessingConfig.taskId, taskId))
        .limit(1);
      existing = result[0];
    } else {
      const result = await database
        .select()
        .from(schema.aiProcessingConfig)
        .where(
          and(
            eq(schema.aiProcessingConfig.configType, 'global'),
            sql`${schema.aiProcessingConfig.taskId} IS NULL`
          )
        )
        .limit(1);
      existing = result[0];
    }
    
    if (existing) {
      await database
        .update(schema.aiProcessingConfig)
        .set({
          enableEntityExtraction: data.enableEntityExtraction ?? true,
          enableSentimentAnalysis: data.enableSentimentAnalysis ?? true,
          enableKeywordDetection: data.enableKeywordDetection ?? true,
          maxRetries: data.maxRetries ?? 3,
          timeoutSeconds: data.timeoutSeconds ?? 60,
          preserveFormatting: data.preserveFormatting ?? true,
          enableOutputValidation: data.enableOutputValidation ?? true,
          enableRuleVerification: data.enableRuleVerification ?? true,
          outputFormat: data.outputFormat ?? 'markdown',
          temperature: data.temperature?.toString() ?? '0.7',
          qualityLevel: data.qualityLevel ?? 'balanced',
          updatedAt: new Date(),
        })
        .where(eq(schema.aiProcessingConfig.id, existing.id));
      return existing.id;
    } else {
      const result = await database
        .insert(schema.aiProcessingConfig)
        .values({
          taskId: taskId,
          configType: configType,
          enableEntityExtraction: data.enableEntityExtraction ?? true,
          enableSentimentAnalysis: data.enableSentimentAnalysis ?? true,
          enableKeywordDetection: data.enableKeywordDetection ?? true,
          maxRetries: data.maxRetries ?? 3,
          timeoutSeconds: data.timeoutSeconds ?? 60,
          preserveFormatting: data.preserveFormatting ?? true,
          enableOutputValidation: data.enableOutputValidation ?? true,
          enableRuleVerification: data.enableRuleVerification ?? true,
          outputFormat: data.outputFormat ?? 'markdown',
          temperature: data.temperature?.toString() ?? '0.7',
          qualityLevel: data.qualityLevel ?? 'balanced',
        })
        .returning();
      return result[0].id;
    }
  }

  // ============ AI Content Filters ============
  async getContentFilters(taskId: number): Promise<any[]> {
    return await database
      .select()
      .from(schema.aiContentFilters)
      .where(
        and(
          eq(schema.aiContentFilters.taskId, taskId),
          eq(schema.aiContentFilters.isActive, true)
        )
      )
      .orderBy(desc(schema.aiContentFilters.priority));
  }

  async createContentFilter(data: any): Promise<any> {
    const result = await database
      .insert(schema.aiContentFilters)
      .values({
        taskId: data.taskId,
        name: data.filterName || data.name,
        filterType: data.filterType || 'block',
        matchType: data.matchType,
        pattern: data.pattern,
        contextDescription: data.contextDescription,
        sentimentTarget: data.sentimentTarget,
        action: data.action || 'skip',
        modifyInstructions: data.modifyInstructions,
        isActive: data.isActive ?? true,
        priority: data.priority ?? 0,
      })
      .returning();
    return result[0];
  }

  async updateContentFilter(id: number, data: any): Promise<void> {
    const { createdAt, updatedAt, id: _, ...updateData } = data;
    await database
      .update(schema.aiContentFilters)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(schema.aiContentFilters.id, id));
  }

  async deleteContentFilter(id: number): Promise<void> {
    await database
      .delete(schema.aiContentFilters)
      .where(eq(schema.aiContentFilters.id, id));
  }

  async incrementFilterMatchCount(id: number): Promise<void> {
    await database
      .update(schema.aiContentFilters)
      .set({ matchCount: sql`${schema.aiContentFilters.matchCount} + 1` })
      .where(eq(schema.aiContentFilters.id, id));
  }

  // ============ AI Publishing Templates ============
  async getPublishingTemplates(taskId: number): Promise<any[]> {
    const templates = await database
      .select()
      .from(schema.aiPublishingTemplates)
      .where(
        and(
          eq(schema.aiPublishingTemplates.taskId, taskId),
          eq(schema.aiPublishingTemplates.isActive, true)
        )
      )
      .orderBy(desc(schema.aiPublishingTemplates.isDefault));
    
    // Load custom fields for each template
    const templatesWithFields = await Promise.all(
      templates.map(async (template) => {
        const customFields = await this.getTemplateCustomFields(template.id);
        return { ...template, customFields };
      })
    );
    
    return templatesWithFields;
  }

  async getDefaultTemplate(taskId: number): Promise<any> {
    const result = await database
      .select()
      .from(schema.aiPublishingTemplates)
      .where(
        and(
          eq(schema.aiPublishingTemplates.taskId, taskId),
          eq(schema.aiPublishingTemplates.isDefault, true),
          eq(schema.aiPublishingTemplates.isActive, true)
        )
      )
      .limit(1);
    
    if (!result[0]) return null;
    
    // Load custom fields for the template
    const customFields = await this.getTemplateCustomFields(result[0].id);
    return { ...result[0], customFields };
  }

  async createPublishingTemplate(data: any): Promise<any> {
    if (data.isDefault) {
      await database
        .update(schema.aiPublishingTemplates)
        .set({ isDefault: false })
        .where(eq(schema.aiPublishingTemplates.taskId, data.taskId));
    }
    
    const result = await database
      .insert(schema.aiPublishingTemplates)
      .values({
        taskId: data.taskId,
        name: data.name,
        isDefault: data.isDefault ?? false,
        templateType: data.templateType || 'custom',
        headerText: data.headerText || null,
        headerFormatting: data.headerFormatting || 'none',
        footerText: data.footerText || null,
        footerFormatting: data.footerFormatting || 'none',
        fieldSeparator: data.fieldSeparator || '\n',
        useNewlineAfterHeader: data.useNewlineAfterHeader ?? true,
        useNewlineBeforeFooter: data.useNewlineBeforeFooter ?? true,
        maxLength: data.maxLength || null,
        extractionPrompt: data.extractionPrompt || null,
        isActive: data.isActive ?? true,
      })
      .returning();
    
    // Create custom fields if provided
    if (data.customFields && Array.isArray(data.customFields)) {
      for (const field of data.customFields) {
        await this.createTemplateCustomField({
          ...field,
          templateId: result[0].id
        });
      }
    }
    
    return result[0];
  }

  async updatePublishingTemplate(id: number, data: any): Promise<void> {
    if (data.isDefault && data.taskId) {
      await database
        .update(schema.aiPublishingTemplates)
        .set({ isDefault: false })
        .where(eq(schema.aiPublishingTemplates.taskId, data.taskId));
    }
    
    const { customFields, createdAt, updatedAt, id: _, ...templateData } = data;
    
    await database
      .update(schema.aiPublishingTemplates)
      .set({ ...templateData, updatedAt: new Date() })
      .where(eq(schema.aiPublishingTemplates.id, id));
    
    if (customFields && Array.isArray(customFields)) {
      await database
        .delete(schema.templateCustomFields)
        .where(eq(schema.templateCustomFields.templateId, id));
      
      for (let i = 0; i < customFields.length; i++) {
        const field = customFields[i];
        await this.createTemplateCustomField({
          templateId: id,
          fieldName: field.fieldName,
          fieldLabel: field.fieldLabel,
          extractionInstructions: field.extractionInstructions,
          defaultValue: field.defaultValue,
          useDefaultIfEmpty: field.useDefaultIfEmpty,
          formatting: field.formatting,
          displayOrder: i,
          showLabel: field.showLabel,
          labelSeparator: field.labelSeparator,
          prefix: field.prefix,
          suffix: field.suffix,
          fieldType: field.fieldType,
          isActive: field.isActive ?? true
        });
      }
    }
  }

  async deletePublishingTemplate(id: number): Promise<void> {
    // Custom fields are deleted automatically via cascade
    await database
      .delete(schema.aiPublishingTemplates)
      .where(eq(schema.aiPublishingTemplates.id, id));
  }

  // ============ Template Custom Fields ============
  async getTemplateCustomFields(templateId: number): Promise<any[]> {
    return await database
      .select()
      .from(schema.templateCustomFields)
      .where(
        and(
          eq(schema.templateCustomFields.templateId, templateId),
          eq(schema.templateCustomFields.isActive, true)
        )
      )
      .orderBy(schema.templateCustomFields.displayOrder);
  }

  async getTemplateCustomField(id: number): Promise<any> {
    const result = await database
      .select()
      .from(schema.templateCustomFields)
      .where(eq(schema.templateCustomFields.id, id))
      .limit(1);
    return result[0] || null;
  }

  async createTemplateCustomField(data: any): Promise<any> {
    const result = await database
      .insert(schema.templateCustomFields)
      .values({
        templateId: data.templateId,
        fieldName: data.fieldName,
        fieldLabel: data.fieldLabel,
        extractionInstructions: data.extractionInstructions,
        defaultValue: data.defaultValue || null,
        useDefaultIfEmpty: data.useDefaultIfEmpty ?? true,
        formatting: data.formatting || 'none',
        displayOrder: data.displayOrder || 0,
        showLabel: data.showLabel ?? false,
        labelSeparator: data.labelSeparator || ': ',
        prefix: data.prefix || null,
        suffix: data.suffix || null,
        fieldType: data.fieldType || 'extracted',
        isActive: data.isActive ?? true,
      })
      .returning();
    return result[0];
  }

  async updateTemplateCustomField(id: number, data: any): Promise<void> {
    const { createdAt, updatedAt, id: _, ...updateData } = data;
    await database
      .update(schema.templateCustomFields)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(schema.templateCustomFields.id, id));
  }

  async deleteTemplateCustomField(id: number): Promise<void> {
    await database
      .delete(schema.templateCustomFields)
      .where(eq(schema.templateCustomFields.id, id));
  }

  async reorderTemplateCustomFields(templateId: number, fieldOrders: { id: number; order: number }[]): Promise<void> {
    for (const { id, order } of fieldOrders) {
      await database
        .update(schema.templateCustomFields)
        .set({ displayOrder: order })
        .where(
          and(
            eq(schema.templateCustomFields.id, id),
            eq(schema.templateCustomFields.templateId, templateId)
          )
        );
    }
  }

  // ============ Message Archive ============
  async getArchiveMessages(filters: {
    taskId?: number;
    search?: string;
    classification?: string;
    province?: string;
    specialist?: string;
    newsType?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    isPinned?: boolean;
    isFlagged?: boolean;
    hasMedia?: boolean;
    limit?: number;
    offset?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<{ messages: any[]; total: number }> {
    const conditions: any[] = [];
    
    if (filters.taskId) {
      conditions.push(eq(schema.messageArchive.taskId, filters.taskId));
    }
    if (filters.classification) {
      conditions.push(eq(schema.messageArchive.classification, filters.classification));
    }
    if (filters.province) {
      conditions.push(eq(schema.messageArchive.province, filters.province));
    }
    if (filters.specialist) {
      conditions.push(eq(schema.messageArchive.specialist, filters.specialist));
    }
    if (filters.newsType) {
      conditions.push(eq(schema.messageArchive.newsType, filters.newsType));
    }
    if (filters.status) {
      conditions.push(eq(schema.messageArchive.status, filters.status));
    }
    if (filters.isPinned !== undefined) {
      conditions.push(eq(schema.messageArchive.isPinned, filters.isPinned));
    }
    if (filters.isFlagged !== undefined) {
      conditions.push(eq(schema.messageArchive.isFlagged, filters.isFlagged));
    }
    if (filters.hasMedia !== undefined) {
      conditions.push(eq(schema.messageArchive.hasMedia, filters.hasMedia));
    }
    if (filters.dateFrom) {
      conditions.push(sql`${schema.messageArchive.createdAt} >= ${filters.dateFrom}::timestamp`);
    }
    if (filters.dateTo) {
      conditions.push(sql`${schema.messageArchive.createdAt} <= ${filters.dateTo}::timestamp`);
    }
    if (filters.search) {
      conditions.push(sql`(
        ${schema.messageArchive.title} ILIKE ${'%' + filters.search + '%'} OR
        ${schema.messageArchive.originalText} ILIKE ${'%' + filters.search + '%'} OR
        ${schema.messageArchive.processedText} ILIKE ${'%' + filters.search + '%'} OR
        ${schema.messageArchive.publishedText} ILIKE ${'%' + filters.search + '%'}
      )`);
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    
    // Get total count
    const countResult = await database
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.messageArchive)
      .where(whereClause);
    const total = countResult[0]?.count || 0;

    // Get messages with pagination
    let query = database
      .select()
      .from(schema.messageArchive)
      .where(whereClause);

    // Apply sorting
    const sortColumn = filters.sortBy === 'serialNumber' ? schema.messageArchive.serialNumber :
                       filters.sortBy === 'title' ? schema.messageArchive.title :
                       schema.messageArchive.createdAt;
    
    if (filters.sortOrder === 'asc') {
      query = query.orderBy(sortColumn) as any;
    } else {
      query = query.orderBy(desc(sortColumn)) as any;
    }

    // Apply pagination
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    query = query.limit(limit).offset(offset) as any;

    const messages = await query;
    return { messages, total };
  }

  async getArchiveMessage(id: number): Promise<any> {
    const result = await database
      .select()
      .from(schema.messageArchive)
      .where(eq(schema.messageArchive.id, id))
      .limit(1);
    return result[0] || null;
  }

  async getArchiveMessageBySerial(taskId: number, serialNumber: number): Promise<any> {
    const result = await database
      .select()
      .from(schema.messageArchive)
      .where(
        and(
          eq(schema.messageArchive.taskId, taskId),
          eq(schema.messageArchive.serialNumber, serialNumber)
        )
      )
      .limit(1);
    return result[0] || null;
  }

  async createArchiveMessage(data: any): Promise<any> {
    const result = await database
      .insert(schema.messageArchive)
      .values({
        taskId: data.taskId,
        serialNumber: data.serialNumber,
        sourceMessageId: data.sourceMessageId,
        sourceChannelId: data.sourceChannelId,
        sourceChannelTitle: data.sourceChannelTitle,
        targetChannelId: data.targetChannelId,
        targetChannelTitle: data.targetChannelTitle,
        targetMessageId: data.targetMessageId,
        title: data.title,
        originalText: data.originalText,
        processedText: data.processedText,
        publishedText: data.publishedText,
        telegraphUrl: data.telegraphUrl,
        telegraphTitle: data.telegraphTitle,
        classification: data.classification,
        newsType: data.newsType,
        province: data.province,
        specialist: data.specialist,
        tags: data.tags,
        extractedFields: data.extractedFields,
        hasMedia: data.hasMedia || false,
        mediaType: data.mediaType,
        mediaCount: data.mediaCount || 0,
        mediaGroupId: data.mediaGroupId,
        processingDuration: data.processingDuration,
        aiProvider: data.aiProvider,
        aiModel: data.aiModel,
        templateName: data.templateName,
        status: data.status || 'published',
        isEdited: data.isEdited || false,
        isPinned: data.isPinned || false,
        isFlagged: data.isFlagged || false,
        flagReason: data.flagReason,
        notes: data.notes,
      })
      .returning();
    return result[0];
  }

  async updateArchiveMessage(id: number, data: any): Promise<any> {
    // Get current message to merge extractedFields
    const current = await this.getArchiveMessage(id);
    
    const updateData: any = { ...data, updatedAt: new Date() };
    
    // Mark as edited if content changed
    if (data.title !== undefined || data.processedText !== undefined || data.publishedText !== undefined) {
      updateData.isEdited = true;
      updateData.editedAt = new Date();
    }
    
    // Handle extractedFields - merge with existing if partial update
    if (data.extractedFields) {
      // If extractedFields is provided, merge with existing
      const currentExtracted = current?.extractedFields || {};
      updateData.extractedFields = { ...currentExtracted, ...data.extractedFields };
    }
    
    // Sync individual fields to extractedFields for consistency
    const fieldsToSync = ['classification', 'newsType', 'province', 'specialist', 'title'];
    const arabicFieldMap: Record<string, string> = {
      'classification': 'التصنيف_',
      'newsType': 'نوع_الخبر',
      'province': 'المحافظه_',
      'specialist': 'المختص',
      'title': 'العنوان'
    };
    
    // Check if any syncable field is being updated
    const hasFieldUpdates = fieldsToSync.some(f => data[f] !== undefined);
    
    if (hasFieldUpdates) {
      // Get current extractedFields or create new
      const currentExtracted = updateData.extractedFields || current?.extractedFields || {};
      
      // Sync each updated field to extractedFields
      for (const field of fieldsToSync) {
        if (data[field] !== undefined) {
          const arabicKey = arabicFieldMap[field];
          if (arabicKey) {
            currentExtracted[arabicKey] = data[field];
          }
          currentExtracted[field] = data[field];
        }
      }
      
      updateData.extractedFields = currentExtracted;
      updateData.isEdited = true;
      updateData.editedAt = new Date();
    }
    
    const result = await database
      .update(schema.messageArchive)
      .set(updateData)
      .where(eq(schema.messageArchive.id, id))
      .returning();
    return result[0];
  }

  async deleteArchiveMessage(id: number): Promise<void> {
    await database
      .delete(schema.messageArchive)
      .where(eq(schema.messageArchive.id, id));
  }

  async deleteArchiveMessagesByTask(taskId: number): Promise<number> {
    const result = await database
      .delete(schema.messageArchive)
      .where(eq(schema.messageArchive.taskId, taskId))
      .returning();
    return result.length;
  }

  async toggleArchivePin(id: number): Promise<any> {
    const message = await this.getArchiveMessage(id);
    if (!message) return null;
    
    return await this.updateArchiveMessage(id, { isPinned: !message.isPinned });
  }

  async toggleArchiveFlag(id: number, reason?: string): Promise<any> {
    const message = await this.getArchiveMessage(id);
    if (!message) return null;
    
    return await this.updateArchiveMessage(id, { 
      isFlagged: !message.isFlagged,
      flagReason: !message.isFlagged ? reason : null
    });
  }

  // ============ Archive Serial Counter ============
  async getNextSerialNumber(taskId: number): Promise<number> {
    // Try to get existing counter
    const existing = await database
      .select()
      .from(schema.archiveSerialCounter)
      .where(eq(schema.archiveSerialCounter.taskId, taskId))
      .limit(1);

    if (existing.length > 0) {
      // Increment and return
      const newSerial = existing[0].lastSerial + 1;
      await database
        .update(schema.archiveSerialCounter)
        .set({ lastSerial: newSerial, updatedAt: new Date() })
        .where(eq(schema.archiveSerialCounter.taskId, taskId));
      return newSerial;
    } else {
      // Create new counter
      await database
        .insert(schema.archiveSerialCounter)
        .values({ taskId, lastSerial: 1 });
      return 1;
    }
  }

  async getCurrentSerialNumber(taskId: number): Promise<number> {
    const existing = await database
      .select()
      .from(schema.archiveSerialCounter)
      .where(eq(schema.archiveSerialCounter.taskId, taskId))
      .limit(1);
    return existing[0]?.lastSerial || 0;
  }

  async resetSerialCounter(taskId: number): Promise<void> {
    await database
      .update(schema.archiveSerialCounter)
      .set({ lastSerial: 0, updatedAt: new Date() })
      .where(eq(schema.archiveSerialCounter.taskId, taskId));
  }

  // ============ Archive Statistics ============
  async getArchiveStats(taskId?: number): Promise<{
    totalMessages: number;
    todayMessages: number;
    pinnedMessages: number;
    flaggedMessages: number;
    byClassification: { classification: string; count: number }[];
    byProvince: { province: string; count: number }[];
    byNewsType: { newsType: string; count: number }[];
    recentActivity: { date: string; count: number }[];
  }> {
    const conditions: any[] = [];
    if (taskId) {
      conditions.push(eq(schema.messageArchive.taskId, taskId));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Total messages
    const totalResult = await database
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.messageArchive)
      .where(whereClause);
    const totalMessages = totalResult[0]?.count || 0;

    // Today's messages
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayConditions = [...conditions, sql`${schema.messageArchive.createdAt} >= ${today.toISOString()}::timestamp`];
    const todayResult = await database
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.messageArchive)
      .where(and(...todayConditions));
    const todayMessages = todayResult[0]?.count || 0;

    // Pinned messages
    const pinnedConditions = [...conditions, eq(schema.messageArchive.isPinned, true)];
    const pinnedResult = await database
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.messageArchive)
      .where(and(...pinnedConditions));
    const pinnedMessages = pinnedResult[0]?.count || 0;

    // Flagged messages
    const flaggedConditions = [...conditions, eq(schema.messageArchive.isFlagged, true)];
    const flaggedResult = await database
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.messageArchive)
      .where(and(...flaggedConditions));
    const flaggedMessages = flaggedResult[0]?.count || 0;

    // By classification
    const byClassification = await database
      .select({
        classification: schema.messageArchive.classification,
        count: sql<number>`count(*)::int`
      })
      .from(schema.messageArchive)
      .where(whereClause)
      .groupBy(schema.messageArchive.classification);

    // By province
    const byProvince = await database
      .select({
        province: schema.messageArchive.province,
        count: sql<number>`count(*)::int`
      })
      .from(schema.messageArchive)
      .where(whereClause)
      .groupBy(schema.messageArchive.province);

    // By news type
    const byNewsType = await database
      .select({
        newsType: schema.messageArchive.newsType,
        count: sql<number>`count(*)::int`
      })
      .from(schema.messageArchive)
      .where(whereClause)
      .groupBy(schema.messageArchive.newsType);

    // Recent activity (last 7 days)
    const recentActivity = await database
      .select({
        date: sql<string>`DATE(${schema.messageArchive.createdAt})::text`,
        count: sql<number>`count(*)::int`
      })
      .from(schema.messageArchive)
      .where(whereClause)
      .groupBy(sql`DATE(${schema.messageArchive.createdAt})`)
      .orderBy(desc(sql`DATE(${schema.messageArchive.createdAt})`))
      .limit(7);

    return {
      totalMessages,
      todayMessages,
      pinnedMessages,
      flaggedMessages,
      byClassification: byClassification.filter(c => c.classification) as any,
      byProvince: byProvince.filter(p => p.province) as any,
      byNewsType: byNewsType.filter(n => n.newsType) as any,
      recentActivity: recentActivity as any
    };
  }

  async getArchiveFilterOptions(taskId?: number): Promise<{
    classifications: string[];
    provinces: string[];
    newsTypes: string[];
    specialists: string[];
  }> {
    const conditions: any[] = [];
    if (taskId) {
      conditions.push(eq(schema.messageArchive.taskId, taskId));
    }
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

    return {
      classifications: classifications.map(c => c.value).filter(Boolean) as string[],
      provinces: provinces.map(p => p.value).filter(Boolean) as string[],
      newsTypes: newsTypes.map(n => n.value).filter(Boolean) as string[],
      specialists: specialists.map(s => s.value).filter(Boolean) as string[]
    };
  }
}

export const storage = new DbStorage();
