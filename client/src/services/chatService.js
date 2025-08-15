const WEBHOOK_URL = "https://n8nflowhook.goflow.digital/webhook/landeiro-chat-ia";
const USER_EMAIL = "gabriel@goflow.digital";
const STORAGE_KEY = "landeiro_chat_history";

export class ChatService {
  static generateThreadId() {
    return `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static generateThreadTitle(message) {
    return message.length > 50 ? message.substring(0, 50) + "..." : message;
  }

  static getStoredHistory() {
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

  static saveHistory(history) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.error("Error saving chat history:", error);
    }
  }

  static createNewThread(sessionData = null) {
    const thread = {
      id: this.generateThreadId(),
      title: "Nova Conversa",
      email: USER_EMAIL,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Add session data if provided
    if (sessionData) {
      thread.sessionData = {
        diagnostico: sessionData.diagnostico,
        protocolo: sessionData.protocolo
      };
      thread.title = `${sessionData.diagnostico} - ${sessionData.protocolo}`;
    }

    return thread;
  }

  static createUserMessage(threadId, content) {
    return {
      id: this.generateMessageId(),
      threadId,
      content,
      sender: "user",
      timestamp: new Date(),
    };
  }

  static createAiMessage(threadId, content) {
    return {
      id: this.generateMessageId(),
      threadId,
      content,
      sender: "ai",
      timestamp: new Date(),
    };
  }

  static async sendMessage(message, threadId, sessionData = null, chatId = null) {
    const request = {
      message,
      email: USER_EMAIL,
    };

    // Add chat_id if provided
    if (chatId) {
      request.chat_id = chatId;
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

      const data = await response.json();
      return data.output || "Desculpe, não consegui processar sua mensagem.";
    } catch (error) {
      console.error("Error sending message to webhook:", error);
      throw new Error("Falha ao enviar mensagem. Verifique sua conexão e tente novamente.");
    }
  }

  static formatTimestamp(timestamp) {
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