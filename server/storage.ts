import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
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
  UserbotSession,
  InsertUserbotSession,
  GitHubSettings,
  InsertGithubSettings,
} from "@shared/schema";

/**
 * Sanitize DATABASE_URL that may contain multiple hosts
 * Some providers provide URLs with multiple hosts (primary,read)
 * which is not supported by standard URL parsers
 */
function sanitizeDatabaseUrl(url: string): string {
  if (!url) return url;
  
  // Pattern: protocol://credentials@host1:port,host2:port/database?params
  const multiHostPattern = /^(postgresql|postgres):\/\/([^@]+)@([^\/]+)\/(.+)$/;
  const match = url.match(multiHostPattern);
  
  if (!match) return url;
  
  const [, protocol, credentials, hosts, rest] = match;
  
  if (!hosts.includes(',')) return url;
  
  // Take only the first host (primary)
  const primaryHost = hosts.split(',')[0].trim();
  const sanitizedUrl = `${protocol}://${credentials}@${primaryHost}/${rest}`;
  
  console.log('[DB] Using primary host from multi-host URL');
  return sanitizedUrl;
}

// Database connection using neon http
const connectionString = sanitizeDatabaseUrl(process.env.DATABASE_URL!);
const queryClient = neon(connectionString);
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

  // GitHub Settings
  getGithubSettings(): Promise<any>;
  linkGithubRepository(owner: string, repo: string): Promise<any>;
  unlinkGithubRepository(): Promise<void>;

  // Dashboard Stats
  getDashboardStats(): Promise<any>;
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
        updatedAt: new Date(),
      })
      .where(eq(schema.userbotSessions.isActive, true));
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
}

export const storage = new DbStorage();
