import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, desc, and, sql } from "drizzle-orm";
import * as schema from "@shared/schema";
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
    const result = await database
      .update(schema.aiRules)
      .set(updates)
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
    await database
      .update(schema.aiEntityReplacements)
      .set({
        ...data,
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
    await database
      .update(schema.aiContextRules)
      .set({
        ...data,
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
    const result = await database
      .insert(schema.aiTrainingExamples)
      .values({
        taskId: data.taskId || null,
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
        name: data.name,
        filterType: data.filterType,
        matchType: data.matchType,
        pattern: data.pattern,
        contextDescription: data.contextDescription || null,
        sentimentTarget: data.sentimentTarget || null,
        action: data.action || 'skip',
        modifyInstructions: data.modifyInstructions || null,
        isActive: data.isActive ?? true,
        priority: data.priority ?? 0,
      })
      .returning();
    return result[0];
  }

  async updateContentFilter(id: number, data: any): Promise<void> {
    await database
      .update(schema.aiContentFilters)
      .set(data)
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
    
    const { customFields, ...templateData } = data;
    
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
    await database
      .update(schema.templateCustomFields)
      .set(data)
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
}

export const storage = new DbStorage();
