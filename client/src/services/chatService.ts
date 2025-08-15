const WEBHOOK_URL = "https://n8nflowhook.goflow.digital/webhook/landeiro-chat-ia";
const USER_EMAIL = "gabriel@goflow.digital";
const STORAGE_KEY = "landeiro_chat_history";

import type { ChatHistory, ChatThreadExtended, Message, WebhookRequest, WebhookResponse } from "@shared/schema";

export class ChatService {
  static generateThreadId(): string {
    return `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static generateThreadTitle(message: string): string {
    return message.length > 50 ? message.substring(0, 50) + "..." : message;
  }

  static getStoredHistory(): ChatHistory {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
    }
    return { threads: [], messages: {} };
  }

  static saveHistory(history: ChatHistory): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.error("Error saving chat history:", error);
    }
  }

  static createNewThread(): ChatThreadExtended {
    return {
      id: this.generateThreadId(),
      title: "Nova Conversa",
      email: USER_EMAIL,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  static createUserMessage(threadId: string, content: string): Message {
    return {
      id: this.generateMessageId(),
      threadId,
      content,
      sender: "user",
      timestamp: new Date(),
    };
  }

  static createAiMessage(threadId: string, content: string): Message {
    return {
      id: this.generateMessageId(),
      threadId,
      content,
      sender: "ai",
      timestamp: new Date(),
    };
  }

  static async sendMessage(
    message: string,
    threadId: string,
    sessionData: { diagnostico?: string; protocolo?: string } | null = null,
    chatId: string | null = null,
  ): Promise<WebhookResponse> {
    const request: WebhookRequest = {
      message,
      email: USER_EMAIL,
      chat_id: chatId || undefined,
    };

    // Add chat_id if provided
    if (chatId) {
      console.log("Sending message with chat_id:", chatId);
      request.chat_id = chatId;
    } else {
      console.log("Sending message without chat_id");
    }

    // Add session data if provided
    if (sessionData) {
      request.diagnostico = sessionData.diagnostico;
      request.protocolo = sessionData.protocolo;
    }

    try {
      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: WebhookResponse = await response.json();
      return data;
    } catch (error) {
      console.error("Error sending message to webhook:", error);
      throw new Error("Falha ao enviar mensagem. Verifique sua conexão e tente novamente.");
    }
  }

  static formatTimestamp(timestamp: Date | string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffHours < 1) {
      return "Agora mesmo";
    } else if (diffHours < 24) {
      const hours = Math.floor(diffHours);
      return `há ${hours} ${hours === 1 ? "hora" : "horas"}`;
    } else if (diffDays < 7) {
      const days = Math.floor(diffDays);
      return `há ${days} ${days === 1 ? "dia" : "dias"}`;
    } else {
      return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }
  }
}
