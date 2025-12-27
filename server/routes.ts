import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authServiceManager } from "./auth-service-manager";
import bcrypt from "bcryptjs";
import { insertUserSchema, insertForwardingTaskSchema, insertChannelSchema, insertAiRuleSchema } from "@shared/schema";
import { z } from "zod";
import { pushToGitHub, getGitHubInfo, listGitHubRepos, pushToGitHubRepo, getBranches, getFileChanges } from "./github-sync";

const handleError = (res: Response, error: unknown, message: string = "An error occurred") => {
  console.error(error);
  res.status(500).json({ error: message, details: error instanceof Error ? error.message : String(error) });
};

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // ============ Authentication ============
  
  app.post("/api/auth/admin-login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }
      
      const secretUsername = process.env.ADMIN_USERNAME;
      const secretPassword = process.env.ADMIN_PASSWORD;
      
      if (!secretUsername || !secretPassword) {
        console.error("[Auth] Admin credentials not configured in secrets");
        return res.status(500).json({ error: "Admin authentication not configured" });
      }
      
      if (username !== secretUsername || password !== secretPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      res.json({ 
        admin: true,
        username: secretUsername,
        message: "Admin login successful",
        token: Buffer.from(`${secretUsername}:${Date.now()}`).toString('base64')
      });
    } catch (error) {
      handleError(res, error, "Admin login failed");
    }
  });

  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword, message: "Login successful" });
    } catch (error) {
      handleError(res, error, "Login failed");
    }
  });

  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required" });
      }
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({ username, password: hashedPassword, role: "admin" });
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword, message: "Registration successful" });
    } catch (error) {
      handleError(res, error, "Registration failed");
    }
  });

  // ============ Dashboard ============
  app.get("/api/dashboard/stats", async (req: Request, res: Response) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      handleError(res, error, "Failed to get dashboard stats");
    }
  });

  // ============ Tasks ============
  app.get("/api/tasks", async (req: Request, res: Response) => {
    try {
      const tasks = await storage.getTasks();
      res.json(tasks);
    } catch (error) {
      handleError(res, error, "Failed to get tasks");
    }
  });

  app.post("/api/tasks", async (req: Request, res: Response) => {
    try {
      const parsed = insertForwardingTaskSchema.parse(req.body);
      const task = await storage.createTask(parsed);
      res.status(201).json({ task });
    } catch (error) {
      handleError(res, error, "Failed to create task");
    }
  });

  app.put("/api/tasks/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const task = await storage.updateTask(id, req.body);
      res.json({ task });
    } catch (error) {
      handleError(res, error, "Failed to update task");
    }
  });

  app.patch("/api/tasks/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      // Ensure all boolean fields are explicitly set for database update
      const taskData = {
        ...req.body,
        updatedAt: new Date()
      };
      
      // Log incoming data for debugging
      console.log(`[API] Updating task ${id}:`, {
        videoProcessingEnabled: taskData.videoProcessingEnabled,
        audioProcessingEnabled: taskData.audioProcessingEnabled,
        linkProcessingEnabled: taskData.linkProcessingEnabled
      });
      
      const task = await storage.updateTask(id, taskData);
      
      console.log(`[API] Task updated:`, {
        videoProcessingEnabled: task?.videoProcessingEnabled,
        audioProcessingEnabled: task?.audioProcessingEnabled,
        linkProcessingEnabled: task?.linkProcessingEnabled
      });
      
      res.json({ task });
    } catch (error) {
      handleError(res, error, "Failed to update task");
    }
  });

  app.post("/api/tasks/:id/toggle", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const task = await storage.toggleTask(id);
      res.json({ task });
    } catch (error) {
      handleError(res, error, "Failed to toggle task");
    }
  });

  app.delete("/api/tasks/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteTask(id);
      res.json({ message: "Task deleted" });
    } catch (error) {
      handleError(res, error, "Failed to delete task");
    }
  });

  // Task Rules endpoints
  app.get("/api/tasks/:taskId/rules", async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const rules = await storage.getTaskRules(taskId);
      res.json(rules);
    } catch (error) {
      handleError(res, error, "Failed to get task rules");
    }
  });

  app.post("/api/tasks/:taskId/rules", async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const data = { ...req.body, taskId };
      const parsed = insertAiRuleSchema.parse(data);
      const rule = await storage.createRule(parsed);
      res.status(201).json(rule);
    } catch (error) {
      handleError(res, error, "Failed to create rule");
    }
  });

  app.patch("/api/rules/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const rule = await storage.updateRule(id, req.body);
      res.json(rule);
    } catch (error) {
      handleError(res, error, "Failed to update rule");
    }
  });

  app.post("/api/rules/:id/toggle", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const rule = await storage.toggleRule(id);
      res.json(rule);
    } catch (error) {
      handleError(res, error, "Failed to toggle rule");
    }
  });

  app.delete("/api/rules/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteRule(id);
      res.json({ message: "Rule deleted" });
    } catch (error) {
      handleError(res, error, "Failed to delete rule");
    }
  });

  // ============ Summarization Rules ============
  app.get("/api/tasks/:taskId/summarization-rules", async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const allRules = await storage.getTaskRules(taskId);
      const rules = allRules.filter((r: any) => r.type === "summarize" || r.type === "audio_summarize");
      res.json(rules);
    } catch (error) {
      handleError(res, error, "Failed to get summarization rules");
    }
  });

  app.post("/api/tasks/:taskId/summarization-rules", async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const { maxLength, style, keyPointsCount, type, ...rest } = req.body;
      const config = {
        maxLength: maxLength || 300,
        style: style || 'balanced',
        keyPointsCount: keyPointsCount || 3
      };
      const data = { ...rest, taskId, type: type || "summarize", config };
      const rule = await storage.createRule(data);
      res.status(201).json(rule);
    } catch (error) {
      handleError(res, error, "Failed to create summarization rule");
    }
  });

  app.patch("/api/summarization-rules/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { maxLength, style, keyPointsCount, ...rest } = req.body;
      const updates = { ...rest };
      
      if (maxLength !== undefined || style !== undefined || keyPointsCount !== undefined) {
        updates.config = {
          maxLength: maxLength || 300,
          style: style || 'balanced',
          keyPointsCount: keyPointsCount || 3
        };
      }
      
      const rule = await storage.updateRule(id, updates);
      res.json(rule);
    } catch (error) {
      handleError(res, error, "Failed to update summarization rule");
    }
  });

  app.post("/api/summarization-rules/:id/toggle", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const rule = await storage.toggleRule(id);
      res.json(rule);
    } catch (error) {
      handleError(res, error, "Failed to toggle summarization rule");
    }
  });

  app.delete("/api/summarization-rules/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteRule(id);
      res.json({ message: "Summarization rule deleted" });
    } catch (error) {
      handleError(res, error, "Failed to delete summarization rule");
    }
  });

  // ============ Video Processing Rules ============
  app.get("/api/tasks/:taskId/video-processing-rules", async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const rules = await storage.getTaskRulesByType(taskId, "video_summarize");
      res.json(rules);
    } catch (error) {
      handleError(res, error, "Failed to get video processing rules");
    }
  });

  app.post("/api/tasks/:taskId/video-processing-rules", async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const data = { ...req.body, taskId, type: "video_summarize" };
      const rule = await storage.createRule(data);
      res.status(201).json(rule);
    } catch (error) {
      handleError(res, error, "Failed to create video processing rule");
    }
  });

  app.patch("/api/video-processing-rules/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const rule = await storage.updateRule(id, req.body);
      res.json(rule);
    } catch (error) {
      handleError(res, error, "Failed to update video processing rule");
    }
  });

  app.post("/api/video-processing-rules/:id/toggle", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const rule = await storage.toggleRule(id);
      res.json(rule);
    } catch (error) {
      handleError(res, error, "Failed to toggle video processing rule");
    }
  });

  app.delete("/api/video-processing-rules/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteRule(id);
      res.json({ message: "Video processing rule deleted" });
    } catch (error) {
      handleError(res, error, "Failed to delete video processing rule");
    }
  });

  // ============ Channels ============
  app.get("/api/channels", async (req: Request, res: Response) => {
    try {
      const channels = await storage.getChannels();
      res.json(channels);
    } catch (error) {
      handleError(res, error, "Failed to get channels");
    }
  });

  app.post("/api/channels", async (req: Request, res: Response) => {
    try {
      const parsed = insertChannelSchema.parse(req.body);
      const channel = await storage.createChannel(parsed);
      res.status(201).json({ channel });
    } catch (error) {
      handleError(res, error, "Failed to create channel");
    }
  });

  app.patch("/api/channels/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const channel = await storage.updateChannel(id, req.body);
      res.json(channel);
    } catch (error) {
      handleError(res, error, "Failed to update channel");
    }
  });

  app.delete("/api/channels/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteChannel(id);
      res.json({ message: "Channel deleted successfully" });
    } catch (error) {
      handleError(res, error, "Failed to delete channel");
    }
  });

  // ============ AI Config ============
  app.get("/api/ai/providers", async (req: Request, res: Response) => {
    try {
      const providers = await storage.getAiProviders();
      res.json(providers);
    } catch (error) {
      handleError(res, error, "Failed to get AI providers");
    }
  });

  app.get("/api/ai/models", async (req: Request, res: Response) => {
    try {
      const models = await storage.getAiModels();
      res.json(models);
    } catch (error) {
      handleError(res, error, "Failed to get AI models");
    }
  });

  app.patch("/api/ai/providers/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const provider = await storage.updateAiProvider(id, req.body);
      res.json(provider);
    } catch (error) {
      handleError(res, error, "Failed to update AI provider");
    }
  });

  app.post("/api/ai/providers/:id/toggle", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const provider = await storage.toggleAiProvider(id);
      res.json(provider);
    } catch (error) {
      handleError(res, error, "Failed to toggle AI provider");
    }
  });

  // ============ AI Model Management ============
  app.get("/api/ai-providers/:providerId/models", async (req: Request, res: Response) => {
    try {
      const providerId = parseInt(req.params.providerId);
      if (isNaN(providerId)) {
        return res.status(400).json({ error: "Invalid provider ID" });
      }
      const models = await storage.getAiModelsByProvider(providerId);
      res.json(models);
    } catch (error) {
      handleError(res, error, "Failed to get models for provider");
    }
  });

  app.patch("/api/ai/training-examples/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.updateTrainingExample(id, req.body);
      res.json({ success: true });
    } catch (error) {
      handleError(res, error, "Failed to update training example");
    }
  });

  app.post("/api/archive/reset-serial/:taskId", async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      await storage.resetSerialCounter(taskId);
      res.json({ success: true });
    } catch (error) {
      handleError(res, error, "Failed to reset serial counter");
    }
  });

  app.delete("/api/archive/messages/task/:taskId", async (req, res) => {
    try {
      const taskId = parseInt(req.params.taskId);
      await storage.deleteArchiveMessagesByTask(taskId);
      res.json({ success: true });
    } catch (error) {
      handleError(res, error, "Failed to delete archive messages");
    }
  });

  app.put("/api/ai-models/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid model ID" });
      }
      const model = await storage.updateModel(id, req.body);
      if (!model) {
        return res.status(404).json({ error: "Model not found" });
      }
      res.json(model);
    } catch (error) {
      handleError(res, error, "Failed to update AI model");
    }
  });

  app.get("/api/ai-models/:id/stats", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: "Invalid model ID" });
      }
      const stats = await storage.getModelUsageStats(id);
      res.json(stats);
    } catch (error) {
      handleError(res, error, "Failed to get model usage stats");
    }
  });

  // ============ AI Usage Statistics ============
  app.get("/api/ai-usage-stats", async (req: Request, res: Response) => {
    try {
      const filters: {
        providerId?: number;
        modelId?: number;
        taskId?: number;
        dateFrom?: Date;
        dateTo?: Date;
      } = {};
      
      if (req.query.providerId) {
        filters.providerId = parseInt(req.query.providerId as string);
      }
      if (req.query.modelId) {
        filters.modelId = parseInt(req.query.modelId as string);
      }
      if (req.query.taskId) {
        filters.taskId = parseInt(req.query.taskId as string);
      }
      if (req.query.dateFrom) {
        filters.dateFrom = new Date(req.query.dateFrom as string);
      }
      if (req.query.dateTo) {
        filters.dateTo = new Date(req.query.dateTo as string);
      }
      
      const stats = await storage.getUsageStats(filters);
      res.json(stats);
    } catch (error) {
      handleError(res, error, "Failed to get usage statistics");
    }
  });

  app.get("/api/ai-usage-stats/summary", async (req: Request, res: Response) => {
    try {
      const filters: {
        providerId?: number;
        dateFrom?: Date;
        dateTo?: Date;
      } = {};
      
      if (req.query.providerId) {
        filters.providerId = parseInt(req.query.providerId as string);
      }
      if (req.query.dateFrom) {
        filters.dateFrom = new Date(req.query.dateFrom as string);
      }
      if (req.query.dateTo) {
        filters.dateTo = new Date(req.query.dateTo as string);
      }
      
      const summary = await storage.getUsageStatsSummary(filters);
      res.json(summary);
    } catch (error) {
      handleError(res, error, "Failed to get usage statistics summary");
    }
  });

  app.post("/api/ai-usage-stats", async (req: Request, res: Response) => {
    try {
      const { providerId, modelId, modelName, taskId, requestCount, totalTokensInput, totalTokensOutput, totalCost, usageDate, avgLatency, errorCount, successCount } = req.body;
      
      if (!providerId || !modelName || !usageDate) {
        return res.status(400).json({ error: "providerId, modelName, and usageDate are required" });
      }
      
      const usage = await storage.recordUsage({
        providerId,
        modelId: modelId || null,
        modelName,
        taskId: taskId || null,
        requestCount: requestCount || 1,
        totalTokensInput: totalTokensInput || 0,
        totalTokensOutput: totalTokensOutput || 0,
        totalCost: totalCost || null,
        usageDate: new Date(usageDate),
        avgLatency: avgLatency || null,
        errorCount: errorCount || 0,
        successCount: successCount || 1,
      });
      
      res.status(201).json(usage);
    } catch (error) {
      handleError(res, error, "Failed to record usage statistics");
    }
  });

  // Settings
  app.get("/api/settings", async (req: Request, res: Response) => {
    try {
      const settings = await storage.getBotConfig();
      res.json(settings);
    } catch (error) {
      handleError(res, error, "Failed to get settings");
    }
  });

  app.post("/api/settings", async (req: Request, res: Response) => {
    try {
      const { key, value, description } = req.body;
      if (!key || !value) {
        return res.status(400).json({ error: "Key and value are required" });
      }
      await storage.setBotConfigValue(key, value, description);
      res.json({ message: "Setting saved successfully" });
    } catch (error) {
      handleError(res, error, "Failed to save setting");
    }
  });

  // AI Rules
  app.get("/api/ai/rules", async (req: Request, res: Response) => {
    try {
      const taskId = req.query.taskId ? parseInt(req.query.taskId as string) : undefined;
      if (taskId) {
        const rules = await storage.getTaskRules(taskId);
        res.json(rules);
      } else {
        res.status(400).json({ error: "taskId is required" });
      }
    } catch (error) {
      handleError(res, error, "Failed to get AI rules");
    }
  });

  app.post("/api/ai/rules", async (req: Request, res: Response) => {
    try {
      const parsed = insertAiRuleSchema.parse(req.body);
      const rule = await storage.createRule(parsed);
      res.status(201).json({ rule });
    } catch (error) {
      handleError(res, error, "Failed to create AI rule");
    }
  });

  // ============ Logs ============
  app.get("/api/logs", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const logs = await storage.getErrorLogs(limit);
      res.json(logs || []);
    } catch (error) {
      handleError(res, error, "Failed to get logs");
    }
  });

  // ============ Error Logs ============
  app.get("/api/error-logs", async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const minutes = req.query.minutes ? parseInt(req.query.minutes as string) : undefined;
      
      let logs;
      if (minutes) {
        const since = new Date(Date.now() - minutes * 60 * 1000);
        // We'll need to update storage to support time-based filtering if needed, 
        // but for now let's just use the existing getErrorLogs with a higher limit and filter in memory if necessary
        // Or better, add the storage method if it's missing.
        logs = await storage.getErrorLogs(limit || 1000);
        logs = logs.filter((log: any) => new Date(log.timestamp) >= since);
      } else {
        logs = await storage.getErrorLogs(limit);
      }
      res.json(logs);
    } catch (error) {
      handleError(res, error, "Failed to get error logs");
    }
  });

  // ============ Userbot ============
  
  app.get("/api/userbot/status", async (req: Request, res: Response) => {
    try {
      const session = await storage.getActiveUserbotSession();
      if (session && session.isActive) {
        res.json({ 
          status: "connected", 
          phoneNumber: session.phoneNumber,
          lastLoginAt: session.lastLoginAt 
        });
      } else {
        res.json({ status: "disconnected" });
      }
    } catch (error) {
      res.json({ status: "disconnected" });
    }
  });

  app.post("/api/userbot/login/start", async (req: Request, res: Response) => {
    try {
      const { phoneNumber } = req.body;
      if (!phoneNumber) {
        return res.status(400).json({ status: "error", message: "رقم الهاتف مطلوب" });
      }
      
      const phoneRegex = /^\+?[1-9]\d{6,14}$/;
      const cleanPhone = phoneNumber.replace(/[\s-]/g, '');
      if (!phoneRegex.test(cleanPhone)) {
        return res.status(400).json({ status: "error", message: "رقم الهاتف غير صالح" });
      }
      
      const response = await authServiceManager.startLogin(phoneNumber);
      res.json(response.data);
    } catch (error: any) {
      console.error("Login start error:", error);
      const errorMessage = error?.response?.data?.message || "فشل في إرسال رمز التحقق";
      res.json({ status: "error", message: errorMessage });
    }
  });

  app.post("/api/userbot/login/verify", async (req: Request, res: Response) => {
    try {
      const { phoneNumber, code } = req.body;
      if (!phoneNumber || !code) {
        return res.status(400).json({ status: "error", message: "رقم الهاتف ورمز التحقق مطلوبان" });
      }
      
      const response = await authServiceManager.verifyCode(phoneNumber, code);
      
      if (response.data.status === "success" && response.data.session_string) {
        await storage.activateUserbotSession(phoneNumber, response.data.session_string);
      }
      
      res.json(response.data);
    } catch (error: any) {
      console.error("Verify code error:", error);
      const errorMessage = error?.response?.data?.message || "رمز التحقق غير صحيح";
      res.json({ status: "error", message: errorMessage });
    }
  });

  app.post("/api/userbot/login/2fa", async (req: Request, res: Response) => {
    try {
      const { phoneNumber, password } = req.body;
      if (!phoneNumber || !password) {
        return res.status(400).json({ status: "error", message: "رقم الهاتف وكلمة المرور مطلوبان" });
      }
      
      const response = await authServiceManager.verify2FA(phoneNumber, password);
      
      if (response.data.status === "success" && response.data.session_string) {
        await storage.activateUserbotSession(phoneNumber, response.data.session_string);
      }
      
      res.json(response.data);
    } catch (error: any) {
      console.error("2FA verification error:", error);
      const errorMessage = error?.response?.data?.message || "كلمة المرور غير صحيحة";
      res.json({ status: "error", message: errorMessage });
    }
  });

  app.post("/api/userbot/login/cancel", async (req: Request, res: Response) => {
    try {
      const { phoneNumber } = req.body;
      if (!phoneNumber) {
        return res.status(400).json({ status: "error", message: "رقم الهاتف مطلوب" });
      }
      
      const response = await authServiceManager.cancelLogin(phoneNumber);
      res.json(response.data);
    } catch (error: any) {
      console.error("Cancel login error:", error);
      res.json({ status: "error", message: "فشل في إلغاء عملية تسجيل الدخول" });
    }
  });

  app.post("/api/userbot/logout", async (req: Request, res: Response) => {
    try {
      const session = await storage.getActiveUserbotSession();
      
      try {
        await authServiceManager.logout(session?.phoneNumber);
      } catch (authError) {
        console.warn("Auth service logout warning:", authError);
      }
      
      await storage.deactivateUserbotSession();
      
      res.json({ status: "success", message: "تم تسجيل الخروج بنجاح" });
    } catch (error) {
      handleError(res, error, "Failed to logout");
    }
  });

  // ============ GitHub Integration ============
  app.get("/api/github/info", async (req: Request, res: Response) => {
    try {
      const info = await getGitHubInfo();
      if (info) {
        res.json({ status: "connected", ...info });
      } else {
        res.status(400).json({ status: "disconnected", message: "GitHub not connected" });
      }
    } catch (error) {
      handleError(res, error, "Failed to get GitHub info");
    }
  });

  app.get("/api/github/repos", async (req: Request, res: Response) => {
    try {
      const repos = await listGitHubRepos();
      res.json({ repos });
    } catch (error) {
      handleError(res, error, "Failed to list repositories");
    }
  });

  app.get("/api/github/branches", async (req: Request, res: Response) => {
    try {
      const branches = await getBranches();
      res.json({ branches });
    } catch (error) {
      handleError(res, error, "Failed to get branches");
    }
  });

  app.get("/api/github/changes", async (req: Request, res: Response) => {
    try {
      const changes = await getFileChanges();
      res.json({ 
        status: "success",
        changes,
        summary: `${changes.modified.length} modified, ${changes.created.length} created, ${changes.deleted.length} deleted`
      });
    } catch (error) {
      handleError(res, error, "Failed to get file changes");
    }
  });

  app.post("/api/github/push", async (req: Request, res: Response) => {
    try {
      const { message, owner, repo, branch } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: "Commit message is required" });
      }

      if (!owner || !repo) {
        return res.status(400).json({ error: "Repository owner and name are required" });
      }

      const targetBranch = branch || "main";
      console.log("[GitHub] Received push request:", { owner, repo, branch: targetBranch, message });
      const result = await pushToGitHubRepo(owner, repo, message, targetBranch);

      if (result.success) {
        res.json({ status: "success", message: "Changes pushed successfully", branch: targetBranch });
      } else {
        res.status(500).json({ error: "Failed to push changes" });
      }
    } catch (error) {
      handleError(res, error, "Failed to push to GitHub");
    }
  });

  app.get("/api/github/linked-repo", async (req: Request, res: Response) => {
    try {
      const settings = await storage.getGithubSettings();
      if (settings) {
        res.json({ status: "linked", owner: settings.repoOwner, repo: settings.repoName });
      } else {
        res.json({ status: "not_linked" });
      }
    } catch (error) {
      handleError(res, error, "Failed to get linked repository");
    }
  });

  app.post("/api/github/link-repo", async (req: Request, res: Response) => {
    try {
      const { owner, repo } = req.body;
      if (!owner || !repo) {
        return res.status(400).json({ error: "Owner and repo name required" });
      }
      const settings = await storage.linkGithubRepository(owner, repo);
      res.json({ status: "success", settings });
    } catch (error) {
      handleError(res, error, "Failed to link repository");
    }
  });

  app.post("/api/github/unlink-repo", async (req: Request, res: Response) => {
    try {
      await storage.unlinkGithubRepository();
      res.json({ status: "success", message: "Repository unlinked" });
    } catch (error) {
      handleError(res, error, "Failed to unlink repository");
    }
  });

  // ============ Advanced AI Rules - Entity Replacements ============
  app.get("/api/tasks/:taskId/entity-replacements", async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const replacements = await storage.getEntityReplacements(taskId);
      res.json(replacements);
    } catch (error) {
      handleError(res, error, "Failed to get entity replacements");
    }
  });

  app.post("/api/tasks/:taskId/entity-replacements", async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const data = { ...req.body, taskId };
      const replacement = await storage.createEntityReplacement(data);
      res.json(replacement);
    } catch (error) {
      handleError(res, error, "Failed to create entity replacement");
    }
  });

  app.patch("/api/entity-replacements/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.updateEntityReplacement(id, req.body);
      res.json({ message: "Entity replacement updated" });
    } catch (error) {
      handleError(res, error, "Failed to update entity replacement");
    }
  });

  app.delete("/api/entity-replacements/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteEntityReplacement(id);
      res.json({ message: "Entity replacement deleted" });
    } catch (error) {
      handleError(res, error, "Failed to delete entity replacement");
    }
  });

  // ============ Advanced AI Rules - Context Rules ============
  app.get("/api/tasks/:taskId/context-rules", async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const rules = await storage.getContextRules(taskId);
      res.json(rules);
    } catch (error) {
      handleError(res, error, "Failed to get context rules");
    }
  });

  app.post("/api/tasks/:taskId/context-rules", async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const data = { ...req.body, taskId };
      const rule = await storage.createContextRule(data);
      res.json(rule);
    } catch (error) {
      handleError(res, error, "Failed to create context rule");
    }
  });

  app.patch("/api/context-rules/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.updateContextRule(id, req.body);
      res.json({ message: "Context rule updated" });
    } catch (error) {
      handleError(res, error, "Failed to update context rule");
    }
  });

  app.delete("/api/context-rules/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteContextRule(id);
      res.json({ message: "Context rule deleted" });
    } catch (error) {
      handleError(res, error, "Failed to delete context rule");
    }
  });

  // ============ Advanced AI Rules - Training Examples ============
  app.get("/api/training-examples", async (req: Request, res: Response) => {
    try {
      const taskId = req.query.taskId ? parseInt(req.query.taskId as string) : undefined;
      const exampleType = req.query.exampleType as string | undefined;
      const examples = await storage.getTrainingExamples(taskId, exampleType);
      res.json(examples);
    } catch (error) {
      handleError(res, error, "Failed to get training examples");
    }
  });

  app.post("/api/training-examples", async (req: Request, res: Response) => {
    try {
      const { taskId, exampleType, inputText, expectedOutput } = req.body;
      
      if (!taskId) {
        return res.status(400).json({ error: "taskId is required" });
      }
      
      if (!exampleType || !inputText || !expectedOutput) {
        return res.status(400).json({ error: "exampleType, inputText, and expectedOutput are required" });
      }
      
      const example = await storage.createTrainingExample(req.body);
      res.json(example);
    } catch (error) {
      handleError(res, error, "Failed to create training example");
    }
  });

  app.patch("/api/training-examples/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const updated = await storage.updateTrainingExample(id, req.body);
      res.json(updated);
    } catch (error) {
      handleError(res, error, "Failed to update training example");
    }
  });

  app.delete("/api/training-examples/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteTrainingExample(id);
      res.json({ message: "Training example deleted" });
    } catch (error) {
      handleError(res, error, "Failed to delete training example");
    }
  });

  // ============ Advanced AI Rules - Processing Config ============
  app.get("/api/processing-config", async (req: Request, res: Response) => {
    try {
      const taskId = req.query.taskId ? parseInt(req.query.taskId as string) : undefined;
      const config = await storage.getProcessingConfig(taskId);
      res.json(config || {});
    } catch (error) {
      handleError(res, error, "Failed to get processing config");
    }
  });

  app.post("/api/processing-config", async (req: Request, res: Response) => {
    try {
      const configId = await storage.saveProcessingConfig(req.body);
      res.json({ id: configId, message: "Processing config saved" });
    } catch (error) {
      handleError(res, error, "Failed to save processing config");
    }
  });

  // ============ AI Content Filters ============
  app.get("/api/tasks/:taskId/content-filters", async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const filters = await storage.getContentFilters(taskId);
      res.json(filters);
    } catch (error) {
      handleError(res, error, "Failed to get content filters");
    }
  });

  app.post("/api/tasks/:taskId/content-filters", async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const data = { ...req.body, taskId };
      const filter = await storage.createContentFilter(data);
      res.json(filter);
    } catch (error) {
      handleError(res, error, "Failed to create content filter");
    }
  });

  app.patch("/api/content-filters/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.updateContentFilter(id, req.body);
      res.json({ message: "Content filter updated" });
    } catch (error) {
      handleError(res, error, "Failed to update content filter");
    }
  });

  app.delete("/api/content-filters/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteContentFilter(id);
      res.json({ message: "Content filter deleted" });
    } catch (error) {
      handleError(res, error, "Failed to delete content filter");
    }
  });

  // ============ AI Publishing Templates ============
  app.get("/api/tasks/:taskId/publishing-templates", async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const templates = await storage.getPublishingTemplates(taskId);
      res.json(templates);
    } catch (error) {
      handleError(res, error, "Failed to get publishing templates");
    }
  });

  app.get("/api/tasks/:taskId/publishing-templates/default", async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const template = await storage.getDefaultPublishingTemplate(taskId);
      res.json(template || {});
    } catch (error) {
      handleError(res, error, "Failed to get default template");
    }
  });

  app.post("/api/tasks/:taskId/publishing-templates", async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const { customFields, ...templateData } = req.body;
      const data = { ...templateData, taskId };
      const template = await storage.createPublishingTemplate(data);
      
      // Save custom fields if provided
      if (customFields && Array.isArray(customFields) && customFields.length > 0) {
        for (const field of customFields) {
          await storage.createTemplateCustomField({
            ...field,
            templateId: template.id
          });
        }
      }
      
      // Return template with its fields
      const fullTemplate = await storage.getPublishingTemplate(template.id);
      res.json(fullTemplate);
    } catch (error) {
      handleError(res, error, "Failed to create publishing template");
    }
  });

  app.patch("/api/publishing-templates/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { customFields, fields, createdAt, updatedAt, id: _, taskId, ...templateData } = req.body;
      
      // Update template (all dangerous/metadata fields stripped)
      await storage.updatePublishingTemplate(id, templateData);
      
      // Handle custom fields if provided
      if (customFields && Array.isArray(customFields)) {
        // Get existing fields
        const existingFields = await storage.getTemplateCustomFields(id);
        const existingIds = new Set(existingFields.map(f => f.id));
        const newFieldIds = new Set(customFields.filter(f => f.id).map(f => f.id));
        
        // Delete fields that were removed
        for (const field of existingFields) {
          if (!newFieldIds.has(field.id)) {
            await storage.deleteTemplateCustomField(field.id);
          }
        }
        
        // Create or update fields
        for (const field of customFields) {
          if (field.id && existingIds.has(field.id)) {
            // Update existing field
            await storage.updateTemplateCustomField(field.id, field);
          } else {
            // Create new field
            await storage.createTemplateCustomField({
              ...field,
              templateId: id
            });
          }
        }
      }
      
      const updatedTemplate = await storage.getPublishingTemplate(id);
      res.json(updatedTemplate);
    } catch (error) {
      handleError(res, error, "Failed to update publishing template");
    }
  });

  app.delete("/api/publishing-templates/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deletePublishingTemplate(id);
      res.json({ message: "Publishing template deleted" });
    } catch (error) {
      handleError(res, error, "Failed to delete publishing template");
    }
  });

  // ============ Template Custom Fields ============
  app.get("/api/publishing-templates/:templateId/custom-fields", async (req: Request, res: Response) => {
    try {
      const templateId = parseInt(req.params.templateId);
      const fields = await storage.getTemplateCustomFields(templateId);
      res.json(fields);
    } catch (error) {
      handleError(res, error, "Failed to get custom fields");
    }
  });

  app.post("/api/publishing-templates/:templateId/custom-fields", async (req: Request, res: Response) => {
    try {
      const templateId = parseInt(req.params.templateId);
      const data = { ...req.body, templateId };
      const field = await storage.createTemplateCustomField(data);
      res.json(field);
    } catch (error) {
      handleError(res, error, "Failed to create custom field");
    }
  });

  app.patch("/api/custom-fields/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.updateTemplateCustomField(id, req.body);
      res.json({ message: "Custom field updated" });
    } catch (error) {
      handleError(res, error, "Failed to update custom field");
    }
  });

  app.delete("/api/custom-fields/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteTemplateCustomField(id);
      res.json({ message: "Custom field deleted" });
    } catch (error) {
      handleError(res, error, "Failed to delete custom field");
    }
  });

  app.post("/api/publishing-templates/:templateId/custom-fields/reorder", async (req: Request, res: Response) => {
    try {
      const templateId = parseInt(req.params.templateId);
      const { fieldOrders } = req.body;
      await storage.reorderTemplateCustomFields(templateId, fieldOrders);
      res.json({ message: "Custom fields reordered" });
    } catch (error) {
      handleError(res, error, "Failed to reorder custom fields");
    }
  });

  // ============ Message Archive ============
  app.delete("/api/archive/clear", async (req: Request, res: Response) => {
    try {
      const taskId = req.query.taskId ? parseInt(req.query.taskId as string) : undefined;
      await storage.clearArchive(taskId);
      res.json({ message: "Archive cleared successfully" });
    } catch (error) {
      handleError(res, error, "Failed to clear archive");
    }
  });

  app.get("/api/archive", async (req: Request, res: Response) => {
    try {
      const filters = {
        taskId: req.query.taskId ? parseInt(req.query.taskId as string) : undefined,
        search: req.query.search as string,
        classification: req.query.classification as string,
        province: req.query.province as string,
        specialist: req.query.specialist as string,
        newsType: req.query.newsType as string,
        status: req.query.status as string,
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        isPinned: req.query.isPinned === 'true' ? true : req.query.isPinned === 'false' ? false : undefined,
        isFlagged: req.query.isFlagged === 'true' ? true : req.query.isFlagged === 'false' ? false : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
        sortBy: req.query.sortBy as string,
        sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
      };
      const result = await storage.getArchiveMessages(filters);
      res.json(result);
    } catch (error) {
      handleError(res, error, "Failed to get archive messages");
    }
  });

  app.get("/api/archive/stats", async (req: Request, res: Response) => {
    try {
      const taskId = req.query.taskId ? parseInt(req.query.taskId as string) : undefined;
      const stats = await storage.getArchiveStats(taskId);
      res.json(stats);
    } catch (error) {
      handleError(res, error, "Failed to get archive stats");
    }
  });

  app.get("/api/archive/filters", async (req: Request, res: Response) => {
    try {
      const taskId = req.query.taskId ? parseInt(req.query.taskId as string) : undefined;
      const options = await storage.getArchiveFilterOptions(taskId);
      res.json(options);
    } catch (error) {
      handleError(res, error, "Failed to get filter options");
    }
  });

  app.get("/api/archive/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const message = await storage.getArchiveMessage(id);
      if (!message) {
        return res.status(404).json({ error: "Archive message not found" });
      }
      res.json(message);
    } catch (error) {
      handleError(res, error, "Failed to get archive message");
    }
  });

  app.put("/api/archive/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const message = await storage.updateArchiveMessage(id, req.body);
      res.json(message);
    } catch (error) {
      handleError(res, error, "Failed to update archive message");
    }
  });

  app.delete("/api/archive/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteArchiveMessage(id);
      res.json({ message: "Archive message deleted" });
    } catch (error) {
      handleError(res, error, "Failed to delete archive message");
    }
  });

  app.post("/api/archive/:id/toggle-pin", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const message = await storage.toggleArchivePin(id);
      res.json(message);
    } catch (error) {
      handleError(res, error, "Failed to toggle pin");
    }
  });

  app.post("/api/archive/:id/toggle-flag", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { reason } = req.body;
      const message = await storage.toggleArchiveFlag(id, reason);
      res.json(message);
    } catch (error) {
      handleError(res, error, "Failed to toggle flag");
    }
  });

  app.get("/api/tasks/:taskId/archive/serial", async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const serial = await storage.getCurrentSerialNumber(taskId);
      res.json({ taskId, currentSerial: serial });
    } catch (error) {
      handleError(res, error, "Failed to get serial number");
    }
  });

  app.post("/api/tasks/:taskId/archive/reset-serial", async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      await storage.resetSerialCounter(taskId);
      res.json({ message: "Serial counter reset", taskId });
    } catch (error) {
      handleError(res, error, "Failed to reset serial counter");
    }
  });

  app.delete("/api/tasks/:taskId/archive", async (req: Request, res: Response) => {
    try {
      const taskId = parseInt(req.params.taskId);
      const count = await storage.deleteArchiveMessagesByTask(taskId);
      res.json({ message: `Deleted ${count} archive messages`, count });
    } catch (error) {
      handleError(res, error, "Failed to delete task archive");
    }
  });

  // ============ Text-to-Speech (Groq PlayAI) ============
  
  // Get available TTS voices
  app.get("/api/tts/voices", async (req: Request, res: Response) => {
    try {
      const voices = [
        // Arabic voices (playai-tts-arabic model)
        { id: "Nasser-PlayAI", name: "ناصر", language: "ar", gender: "male", description: "صوت عربي رجالي", model: "playai-tts-arabic" },
        { id: "Salma-PlayAI", name: "سلمى", language: "ar", gender: "female", description: "صوت عربي نسائي", model: "playai-tts-arabic" },
        { id: "Shakir-PlayAI", name: "شاكر", language: "ar", gender: "male", description: "صوت عربي رجالي", model: "playai-tts-arabic" },
        { id: "Amina-PlayAI", name: "أمينة", language: "ar", gender: "female", description: "صوت عربي نسائي", model: "playai-tts-arabic" },
        
        // English voices (playai-tts model)
        { id: "Aaliyah-PlayAI", name: "Aaliyah", language: "en", gender: "female", description: "American female voice", model: "playai-tts" },
        { id: "Adelaide-PlayAI", name: "Adelaide", language: "en", gender: "female", description: "Australian female voice", model: "playai-tts" },
        { id: "Angelo-PlayAI", name: "Angelo", language: "en", gender: "male", description: "American male voice", model: "playai-tts" },
        { id: "Atlas-PlayAI", name: "Atlas", language: "en", gender: "male", description: "American male voice", model: "playai-tts" },
        { id: "Basil-PlayAI", name: "Basil", language: "en", gender: "male", description: "British male voice", model: "playai-tts" },
        { id: "Celeste-PlayAI", name: "Celeste", language: "en", gender: "female", description: "British female voice", model: "playai-tts" },
      ];
      res.json(voices);
    } catch (error) {
      handleError(res, error, "Failed to get TTS voices");
    }
  });

  // Check if Groq API key is configured
  app.get("/api/tts/status", async (req: Request, res: Response) => {
    try {
      // Check environment first, then database
      let hasApiKey = !!process.env.GROQ_API_KEY;
      
      if (!hasApiKey) {
        const providers = await storage.getAiProviders();
        const groqProvider = providers.find((p: any) => p.name.toLowerCase() === "groq");
        hasApiKey = !!(groqProvider && groqProvider.apiKey && groqProvider.isActive);
      }
      
      res.json({ 
        configured: hasApiKey,
        message: hasApiKey ? "Groq TTS is ready" : "GROQ_API_KEY not configured"
      });
    } catch (error) {
      handleError(res, error, "Failed to check TTS status");
    }
  });

  // Convert text to speech using Groq PlayAI
  app.post("/api/tts/speak", async (req: Request, res: Response) => {
    try {
      const { text, voice = "Nasser-PlayAI" } = req.body;
      
      if (!text || text.trim().length === 0) {
        return res.status(400).json({ error: "Text is required" });
      }

      // Try to get API key from environment first, then from database
      let apiKey = process.env.GROQ_API_KEY;
      
      if (!apiKey) {
        const providers = await storage.getAiProviders();
        const groqProvider = providers.find((p: any) => p.name.toLowerCase() === "groq");
        
        if (groqProvider && groqProvider.apiKey && groqProvider.isActive) {
          apiKey = groqProvider.apiKey;
        }
      }
      
      if (!apiKey) {
        return res.status(400).json({ 
          error: "GROQ_API_KEY not configured",
          needsApiKey: true
        });
      }

      // Limit text length to prevent abuse
      const maxLength = 4000;
      const trimmedText = text.slice(0, maxLength);

      // Determine model based on voice
      const isArabicVoice = voice.includes("Nasser") || voice.includes("Salma") || 
                           voice.includes("Shakir") || voice.includes("Amina");
      const model = isArabicVoice ? "playai-tts-arabic" : "playai-tts";

      const response = await fetch("https://api.groq.com/openai/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: model,
          input: trimmedText,
          voice: voice,
          response_format: "mp3"
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Groq TTS Error:", errorData);
        return res.status(response.status).json({ 
          error: "TTS conversion failed", 
          details: errorData 
        });
      }

      // Get audio buffer
      const audioBuffer = await response.arrayBuffer();
      
      // Return as base64 for easy client handling
      const base64Audio = Buffer.from(audioBuffer).toString('base64');
      
      res.json({
        audio: base64Audio,
        format: "mp3",
        voice: voice,
        model: model,
        textLength: trimmedText.length
      });
    } catch (error) {
      handleError(res, error, "Failed to convert text to speech");
    }
  });

  return httpServer;
}
