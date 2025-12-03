/**
 * API Client for Backend Communication
 * Provides typed methods for all API endpoints
 */

const API_BASE = "/api";

interface ApiError {
  error: string;
  details?: unknown;
}

class ApiClient {
  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error: ApiError = await response.json();
      throw new Error(error.error || "API request failed");
    }

    return response.json();
  }

  // Authentication
  async login(username: string, password: string) {
    return this.request<{ user: any; message: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  }

  async register(username: string, password: string) {
    return this.request<{ user: any; message: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  }

  // Dashboard
  async getDashboardStats() {
    return this.request<{
      totalTasks: number;
      activeTasks: number;
      inactiveTasks: number;
      totalChannels: number;
      totalForwarded: number;
      aiEnabledTasks: number;
      videoEnabledTasks: number;
    }>("/dashboard/stats");
  }

  // Tasks
  async getTasks() {
    return this.request<any[]>("/tasks");
  }

  async getTask(id: number) {
    return this.request<any>(`/tasks/${id}`);
  }

  async createTask(data: any) {
    return this.request<any>("/tasks", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateTask(id: number, data: any) {
    return this.request<any>(`/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async toggleTask(id: number) {
    return this.request<any>(`/tasks/${id}/toggle`, {
      method: "POST",
    });
  }

  async deleteTask(id: number) {
    return this.request<{ message: string }>(`/tasks/${id}`, {
      method: "DELETE",
    });
  }

  async getTaskStats(id: number, days: number = 7) {
    return this.request<any[]>(`/tasks/${id}/stats?days=${days}`);
  }

  async getTaskLogs(id: number, limit: number = 100) {
    return this.request<any[]>(`/tasks/${id}/logs?limit=${limit}`);
  }

  async getErrorLogs(limit: number = 100) {
    return this.request<any[]>(`/error-logs?limit=${limit}`);
  }

  // Channels
  async getChannels() {
    return this.request<any[]>("/channels");
  }

  async getChannel(id: number) {
    return this.request<any>(`/channels/${id}`);
  }

  async createChannel(data: any) {
    return this.request<any>("/channels", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateChannel(id: number, data: any) {
    return this.request<any>(`/channels/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteChannel(id: number) {
    return this.request<{ message: string }>(`/channels/${id}`, {
      method: "DELETE",
    });
  }

  // AI Providers and Models
  async getAiProviders() {
    return this.request<any[]>("/ai/providers");
  }

  async getAiModels() {
    return this.request<any[]>("/ai/models");
  }

  async getProviderModels(providerId: number) {
    return this.request<any[]>(`/ai/providers/${providerId}/models`);
  }

  // AI Rules
  async getTaskRules(taskId: number) {
    return this.request<any[]>(`/tasks/${taskId}/rules`);
  }

  async createRule(taskId: number, data: any) {
    return this.request<any>(`/tasks/${taskId}/rules`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateRule(ruleId: number, data: any) {
    return this.request<any>(`/rules/${ruleId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async toggleRule(ruleId: number) {
    return this.request<any>(`/rules/${ruleId}/toggle`, {
      method: "POST",
    });
  }

  async deleteRule(ruleId: number) {
    return this.request<{ message: string }>(`/rules/${ruleId}`, {
      method: "DELETE",
    });
  }

  // Admins
  async getAdmins() {
    return this.request<any[]>("/admins");
  }

  async createAdmin(data: { telegramId: string; username?: string; addedBy?: number }) {
    return this.request<any>("/admins", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async deleteAdmin(id: number) {
    return this.request<{ message: string }>(`/admins/${id}`, {
      method: "DELETE",
    });
  }

  // AI Provider Management
  async updateAiProvider(id: number, data: { apiKey?: string; isActive?: boolean; config?: any }) {
    return this.request<any>(`/ai/providers/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async toggleAiProvider(id: number) {
    return this.request<any>(`/ai/providers/${id}/toggle`, {
      method: "POST",
    });
  }

  // Settings / Bot Config
  async getSettings() {
    return this.request<{ key: string; value: string }[]>("/settings");
  }

  async getSetting(key: string) {
    return this.request<{ key: string; value: string }>(`/settings/${key}`);
  }

  async saveSetting(key: string, value: string, description?: string) {
    return this.request<{ message: string }>("/settings", {
      method: "POST",
      body: JSON.stringify({ key, value, description }),
    });
  }

  async deleteSetting(key: string) {
    return this.request<{ message: string }>(`/settings/${key}`, {
      method: "DELETE",
    });
  }

  // Logs
  async getLogs(limit: number = 100) {
    return this.request<any[]>(`/logs?limit=${limit}`);
  }

  // Health
  async healthCheck() {
    return this.request<{ status: string; timestamp: string }>("/health");
  }

  // ============================================
  // Advanced AI Rules - Entity Replacements
  // ============================================
  
  async getEntityReplacements(taskId: number) {
    return this.request<any[]>(`/tasks/${taskId}/entity-replacements`);
  }

  async createEntityReplacement(data: any) {
    return this.request<any>(`/tasks/${data.taskId}/entity-replacements`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateEntityReplacement(id: number, data: any) {
    return this.request<any>(`/entity-replacements/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteEntityReplacement(id: number) {
    return this.request<{ message: string }>(`/entity-replacements/${id}`, {
      method: "DELETE",
    });
  }

  // ============================================
  // Advanced AI Rules - Context Rules
  // ============================================
  
  async getContextRules(taskId: number) {
    return this.request<any[]>(`/tasks/${taskId}/context-rules`);
  }

  async createContextRule(data: any) {
    return this.request<any>(`/tasks/${data.taskId}/context-rules`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateContextRule(id: number, data: any) {
    return this.request<any>(`/context-rules/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteContextRule(id: number) {
    return this.request<{ message: string }>(`/context-rules/${id}`, {
      method: "DELETE",
    });
  }

  // ============================================
  // Advanced AI Rules - Training Examples
  // ============================================
  
  async getTrainingExamples(taskId?: number | null) {
    const url = taskId ? `/training-examples?taskId=${taskId}` : `/training-examples`;
    return this.request<any[]>(url);
  }

  async createTrainingExample(data: any) {
    return this.request<any>(`/training-examples`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async deleteTrainingExample(id: number) {
    return this.request<{ message: string }>(`/training-examples/${id}`, {
      method: "DELETE",
    });
  }

  // ============================================
  // Advanced AI Rules - Processing Config
  // ============================================
  
  async getProcessingConfig(taskId?: number) {
    const url = taskId ? `/processing-config?taskId=${taskId}` : `/processing-config`;
    return this.request<any>(url);
  }

  async saveProcessingConfig(data: any) {
    return this.request<any>(`/processing-config`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiClient();
