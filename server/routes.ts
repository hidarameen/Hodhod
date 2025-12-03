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
      const task = await storage.updateTask(id, req.body);
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

  app.put("/api/ai/provider/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { apiKey } = req.body;
      if (!apiKey) {
        return res.status(400).json({ error: "API key is required" });
      }
      const provider = await storage.updateAiProvider(id, { apiKey });
      res.json({ provider });
    } catch (error) {
      handleError(res, error, "Failed to update AI provider");
    }
  });

  app.post("/api/ai/provider/toggle/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const provider = await storage.toggleAiProvider(id);
      res.json({ provider });
    } catch (error) {
      handleError(res, error, "Failed to toggle AI provider");
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

  // ============ Error Logs ============
  app.get("/api/error-logs", async (req: Request, res: Response) => {
    try {
      const logs = await storage.getErrorLogs();
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

  return httpServer;
}
