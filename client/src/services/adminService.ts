import { supabase } from "@/lib/supabase.js";

const API_BASE = "/api/admin";

// Get auth token from Supabase
async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

// Make authenticated request
async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const token = await getAuthToken();
  if (!token) {
    throw new Error("Não autenticado");
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    // Check if response is JSON
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    } else {
      // Response is HTML or other format
      const text = await response.text();
      console.error("Non-JSON error response:", text.substring(0, 200));
      throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
    }
  }

  // Verify response is JSON before parsing
  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    const text = await response.text();
    console.error("Non-JSON response received:", text.substring(0, 200));
    throw new Error("Resposta inválida do servidor (não é JSON)");
  }

  return response.json();
}

export const adminService = {
  // Users
  async getUsers(page = 1, limit = 50, search?: string) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (search) params.append("search", search);
    return apiRequest(`/users?${params}`);
  },

  async getUserDetails(userId: string) {
    return apiRequest(`/users/${userId}`);
  },

  async updateUser(userId: string, metadata: { fullName?: string; role?: string }) {
    return apiRequest(`/users/${userId}`, {
      method: "PUT",
      body: JSON.stringify(metadata),
    });
  },

  async getUserSessions(userId: string, page = 1, limit = 50) {
    return apiRequest(`/users/${userId}/sessions?page=${page}&limit=${limit}`);
  },

  async getUserMessages(userId: string) {
    return apiRequest(`/users/${userId}/messages`);
  },

  // Sessions
  async getSessions(page = 1, limit = 50, filters?: {
    userId?: string;
    diagnostico?: string;
    userEmail?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (filters?.userId) params.append("userId", filters.userId);
    if (filters?.diagnostico) params.append("diagnostico", filters.diagnostico);
    if (filters?.userEmail) params.append("userEmail", filters.userEmail);
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);
    return apiRequest(`/sessions?${params}`);
  },

  async getSessionDetails(chatId: string) {
    return apiRequest(`/sessions/${chatId}`);
  },

  async getSessionMessages(chatId: string) {
    return apiRequest(`/sessions/${chatId}/messages`);
  },

  // Costs
  async getCosts(page = 1, limit = 50, filters?: {
    userId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (filters?.userId) params.append("userId", filters.userId);
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);
    return apiRequest(`/costs?${params}`);
  },

  async getCostSummary(filters?: {
    userId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const params = new URLSearchParams();
    if (filters?.userId) params.append("userId", filters.userId);
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);
    return apiRequest(`/costs/summary?${params}`);
  },

  async getUserCosts(userId: string, startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append("startDate", startDate);
    if (endDate) params.append("endDate", endDate);
    return apiRequest(`/costs/user/${userId}?${params}`);
  },

  async getSessionCost(chatId: string) {
    return apiRequest(`/costs/session/${chatId}`);
  },

  async createCost(cost: {
    chatId: string;
    userId: string;
    sessao: number;
    costAmount?: string;
    tokensInput?: number;
    tokensOutput?: number;
    apiCalls?: number;
  }) {
    return apiRequest("/costs", {
      method: "POST",
      body: JSON.stringify(cost),
    });
  },

  // Statistics
  async getSystemStats() {
    return apiRequest("/stats");
  },

  async getUserStats(userId: string) {
    return apiRequest(`/stats/users/${userId}`);
  },

  // Usage
  async getUsageHistory(page = 1, limit = 50, filters?: {
    userId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (filters?.userId) params.append("userId", filters.userId);
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);
    return apiRequest(`/usage?${params}`);
  },

  // Export
  async exportMessages(filters?: {
    userId?: string;
    chatId?: string;
    startDate?: string;
    endDate?: string;
    format?: "json" | "csv";
  }) {
    const params = new URLSearchParams();
    if (filters?.userId) params.append("userId", filters.userId);
    if (filters?.chatId) params.append("chatId", filters.chatId);
    if (filters?.startDate) params.append("startDate", filters.startDate);
    if (filters?.endDate) params.append("endDate", filters.endDate);
    if (filters?.format) params.append("format", filters.format);

    const token = await getAuthToken();
    if (!token) {
      throw new Error("Não autenticado");
    }

    const response = await fetch(`${API_BASE}/export/messages?${params}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    if (filters?.format === "csv") {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `messages-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } else {
      return response.json();
    }
  },

  async exportUserMessages(userId: string, format: "json" | "csv" = "json") {
    const token = await getAuthToken();
    if (!token) {
      throw new Error("Não autenticado");
    }

    const response = await fetch(`${API_BASE}/export/user/${userId}/messages?format=${format}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    if (format === "csv") {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `user-${userId}-messages-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } else {
      return response.json();
    }
  },

  async exportSessionMessages(chatId: string, format: "json" | "csv" = "json") {
    const token = await getAuthToken();
    if (!token) {
      throw new Error("Não autenticado");
    }

    const response = await fetch(`${API_BASE}/export/session/${chatId}/messages?format=${format}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    if (format === "csv") {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `session-${chatId}-messages-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } else {
      return response.json();
    }
  },

  // Diagnosticos
  async getDiagnosticos() {
    return apiRequest("/diagnosticos");
  },

  async getDiagnosticoStats() {
    return apiRequest("/diagnosticos/stats");
  },

  async updateDiagnostico(id: string, data: { ativo?: boolean; apenas_teste?: boolean; max_sessoes?: number }) {
    return apiRequest(`/diagnosticos/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async createDiagnostico(data: {
    nome: string;
    codigo: string;
    ativo?: boolean;
    apenas_teste?: boolean;
    max_sessoes?: number;
  }) {
    return apiRequest("/diagnosticos", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getUserDiagnosticos(userId: string) {
    return apiRequest(`/users/${userId}/diagnosticos`);
  },

  async liberarDiagnostico(userId: string, diagnosticoId: string) {
    return apiRequest(`/users/${userId}/diagnosticos`, {
      method: "POST",
      body: JSON.stringify({ diagnosticoId }),
    });
  },

  async updateUserAccessDate(userId: string, dataFinalAcesso: string) {
    return apiRequest(`/users/${userId}/access-date`, {
      method: "PUT",
      body: JSON.stringify({ dataFinalAcesso }),
    });
  },

  async deleteUser(userId: string) {
    return apiRequest(`/users/${userId}`, {
      method: "DELETE",
    });
  },

  async createUser(data: {
    email: string;
    password?: string;
    fullName?: string;
    dataFinalAcesso?: string;
    status?: string;
  }): Promise<{
    userId: string;
    email: string;
    password?: string;
    metadata: any;
  }> {
    return apiRequest("/users", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async bulkUpdateUserStatus(file: File): Promise<{
    total: number;
    success: number;
    failed: number;
    results: Array<{
      email: string;
      success: boolean;
      error?: string;
      userId?: string;
    }>;
  }> {
    const text = await file.text();
    const token = await getAuthToken();
    if (!token) {
      throw new Error("Não autenticado");
    }

    const response = await fetch(`${API_BASE}/users/bulk-update-status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ csvData: text }),
    });

    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      } else {
        throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
      }
    }

    return response.json();
  },

  async bulkCreateUsers(file: File): Promise<{
    total: number;
    success: number;
    failed: number;
    results: Array<{
      email: string;
      success: boolean;
      error?: string;
      userId?: string;
      generatedPassword?: string;
    }>;
  }> {
    const text = await file.text();
    const token = await getAuthToken();
    if (!token) {
      throw new Error("Não autenticado");
    }

    const response = await fetch(`${API_BASE}/users/bulk-create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ csvData: text }),
    });

    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      } else {
        throw new Error(`Erro HTTP ${response.status}: ${response.statusText}`);
      }
    }

    return response.json();
  },
};




