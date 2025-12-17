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

  async updateTrainingExample(id: number, data: any) {
    return this.request<any>(`/training-examples/${id}`, {
      method: "PATCH",
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

  // ============================================
  // Content Filters
  // ============================================
  
  async getContentFilters(taskId: number) {
    return this.request<any[]>(`/tasks/${taskId}/content-filters`);
  }

  async createContentFilter(data: any) {
    return this.request<any>(`/tasks/${data.taskId}/content-filters`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateContentFilter(id: number, data: any) {
    return this.request<any>(`/content-filters/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteContentFilter(id: number) {
    return this.request<{ message: string }>(`/content-filters/${id}`, {
      method: "DELETE",
    });
  }

  // ============================================
  // Publishing Templates
  // ============================================
  
  async getPublishingTemplates(taskId: number) {
    return this.request<any[]>(`/tasks/${taskId}/publishing-templates`);
  }

  async getPublishingTemplate(templateId: number) {
    return this.request<any>(`/publishing-templates/${templateId}`);
  }

  async createPublishingTemplate(data: any) {
    return this.request<any>(`/tasks/${data.taskId}/publishing-templates`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updatePublishingTemplate(id: number, data: any) {
    return this.request<any>(`/publishing-templates/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deletePublishingTemplate(id: number) {
    return this.request<{ message: string }>(`/publishing-templates/${id}`, {
      method: "DELETE",
    });
  }

  // ============================================
  // Template Custom Fields
  // ============================================
  
  async getTemplateCustomFields(templateId: number) {
    return this.request<any[]>(`/publishing-templates/${templateId}/custom-fields`);
  }

  async createTemplateCustomField(templateId: number, data: any) {
    return this.request<any>(`/publishing-templates/${templateId}/custom-fields`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateTemplateCustomField(id: number, data: any) {
    return this.request<any>(`/custom-fields/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async deleteTemplateCustomField(id: number) {
    return this.request<{ message: string }>(`/custom-fields/${id}`, {
      method: "DELETE",
    });
  }

  async reorderTemplateCustomFields(templateId: number, fieldOrders: { id: number; order: number }[]) {
    return this.request<{ message: string }>(`/publishing-templates/${templateId}/custom-fields/reorder`, {
      method: "POST",
      body: JSON.stringify({ fieldOrders }),
    });
  }

  // ============================================
  // Message Archive
  // ============================================
  
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
  } = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });
    return this.request<{ messages: any[]; total: number }>(`/archive?${params.toString()}`);
  }

  async getArchiveMessage(id: number) {
    return this.request<any>(`/archive/${id}`);
  }

  async getArchiveStats(taskId?: number) {
    const url = taskId ? `/archive/stats?taskId=${taskId}` : '/archive/stats';
    return this.request<{
      totalMessages: number;
      todayMessages: number;
      pinnedMessages: number;
      flaggedMessages: number;
      byClassification: { classification: string; count: number }[];
      byProvince: { province: string; count: number }[];
      byNewsType: { newsType: string; count: number }[];
      recentActivity: { date: string; count: number }[];
    }>(url);
  }

  async getArchiveFilterOptions(taskId?: number) {
    const url = taskId ? `/archive/filters?taskId=${taskId}` : '/archive/filters';
    return this.request<{
      classifications: string[];
      provinces: string[];
      newsTypes: string[];
      specialists: string[];
    }>(url);
  }

  async updateArchiveMessage(id: number, data: any) {
    return this.request<any>(`/archive/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteArchiveMessage(id: number) {
    return this.request<{ message: string }>(`/archive/${id}`, {
      method: "DELETE",
    });
  }

  async toggleArchivePin(id: number) {
    return this.request<any>(`/archive/${id}/toggle-pin`, {
      method: "POST",
    });
  }

  async toggleArchiveFlag(id: number, reason?: string) {
    return this.request<any>(`/archive/${id}/toggle-flag`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  }

  // ============================================
  // Summarization Rules
  // ============================================

  async getSummarizationRules(taskId: number) {
    return this.request<any[]>(`/tasks/${taskId}/summarization-rules`);
  }

  async createSummarizationRule(data: any) {
    return this.request<any>(`/tasks/${data.taskId}/summarization-rules`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateSummarizationRule(id: number, data: any) {
    return this.request<any>(`/summarization-rules/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async toggleSummarizationRule(id: number) {
    return this.request<any>(`/summarization-rules/${id}/toggle`, {
      method: "POST",
    });
  }

  async deleteSummarizationRule(id: number) {
    return this.request<{ message: string }>(`/summarization-rules/${id}`, {
      method: "DELETE",
    });
  }

  // ============================================
  // Video Processing Rules
  // ============================================

  async getVideoProcessingRules(taskId: number) {
    return this.request<any[]>(`/tasks/${taskId}/video-processing-rules`);
  }

  async createVideoProcessingRule(data: any) {
    return this.request<any>(`/tasks/${data.taskId}/video-processing-rules`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateVideoProcessingRule(id: number, data: any) {
    return this.request<any>(`/video-processing-rules/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async toggleVideoProcessingRule(id: number) {
    return this.request<any>(`/video-processing-rules/${id}/toggle`, {
      method: "POST",
    });
  }

  async deleteVideoProcessingRule(id: number) {
    return this.request<{ message: string }>(`/video-processing-rules/${id}`, {
      method: "DELETE",
    });
  }

  // Text-to-Speech (TTS)
  async getTTSVoices() {
    return this.request<{
      id: string;
      name: string;
      language: string;
      gender: string;
      description: string;
    }[]>("/tts/voices");
  }

  async getTTSStatus() {
    return this.request<{
      configured: boolean;
      message: string;
    }>("/tts/status");
  }

  async textToSpeech(text: string, voice: string = "Ahmad-PlayAI") {
    return this.request<{
      audio: string;
      format: string;
      voice: string;
      textLength: number;
      needsApiKey?: boolean;
    }>("/tts/speak", {
      method: "POST",
      body: JSON.stringify({ text, voice }),
    });
  }
}

export const api = new ApiClient();
