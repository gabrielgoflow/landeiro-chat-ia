const WEBHOOK_URL =
  "https://n8nflowhook.goflow.digital/webhook/landeiro-chat-ia";
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
        protocolo: 'tcc', // Always TCC
      };
      thread.title = `${sessionData.diagnostico} - TCC`;
    }

    return thread;
  }

  static createUserMessage(threadId, content) {
    const baseMessage = {
      id: this.generateMessageId(),
      threadId,
      sender: "user",
      timestamp: new Date(),
    };

    // Handle audio messages
    if (typeof content === 'object' && content.type === 'audio') {
      return {
        ...baseMessage,
        type: 'audio',
        audioBase64: content.audioBase64,
        audioUrl: content.audioUrl || content.audioURL, // Support both formats
        audioURL: content.audioURL, // Include audioURL for API requests
        mimeType: content.mimeType || 'audio/webm',
        duration: content.duration || 0,
      };
    }

    // Handle text messages
    return {
      ...baseMessage,
      content,
      text: content, // Add text field for compatibility
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

  static async getMessageHistory(chatId) {
    try {
      // Use our chat_messages table instead of OpenAI Assistant messages
      const response = await fetch(`/api/chat-messages/${chatId}`);

      if (!response.ok) {
        if (response.status === 404 || response.status === 500) {
          // No messages found for this session or error - return empty array
          console.log(`No messages found for session ${chatId} or error occurred`);
          return [];
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const messages = await response.json();
      console.log(`Loaded ${messages.length} messages from chat_messages table for session:`, chatId);

      // Transform database messages to our frontend format
      const transformedMessages = messages.map(msg => {
        const baseMessage = {
          id: msg.messageId || msg.message_id,
          sender: msg.sender,
          timestamp: new Date(msg.createdAt || msg.created_at),
        };

        // Handle audio messages
        if (msg.messageType === 'audio' || msg.message_type === 'audio') {
          return {
            ...baseMessage,
            type: 'audio',
            audioUrl: msg.audioUrl || msg.audio_url,
            audioURL: msg.audioUrl || msg.audio_url, // Include both for compatibility
            mimeType: 'audio/mp3', // Default to mp3 for stored audio
            duration: 0,
          };
        }

        // Handle text messages
        return {
          ...baseMessage,
          text: msg.content,
          content: msg.content,
        };
      });

      console.log(`Transformed ${transformedMessages.length} messages for session ${chatId}`);
      return transformedMessages;
    } catch (error) {
      console.error("Error fetching message history:", error);
      throw error;
    }
  }

  static async sendMessage(
    message,
    threadId,
    sessionData = null,
    chatId = null,
  ) {
    // Handle audio messages - send as JSON string
    let messageToSend = message;
    if (typeof message === 'object' && message.type === 'audio') {
      messageToSend = JSON.stringify(message);
    }
    
    const request = {
      message: messageToSend,
      email: USER_EMAIL,
      chatId: chatId, // Use chatId instead of chat_id for consistency
    };

    // Add session data if provided
    if (sessionData) {
      request.diagnostico = sessionData.diagnostico;
      request.protocolo = sessionData.protocolo;
    }

    console.log("Sending request to landeiro-chat-ia:", request);

    try {
      // Use the new landeiro-chat-ia endpoint
      const response = await fetch("/api/landeiro-chat-ia", {
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
      console.log("Received response from landeiro-chat-ia:", data);

      // Handle audio or text response
      if (data.type === 'audio') {
        return {
          type: 'audio',
          audioBase64: `data:${data.mimeType};base64,${data.base64}`,
          mimeType: data.mimeType,
          message: data.text || '', // Optional text with audio
        };
      } else {
        return data.message || "Desculpe, não consegui processar sua mensagem.";
      }
    } catch (error) {
      console.error("Error sending message to landeiro-chat-ia:", error);
      throw new Error(
        "Falha ao enviar mensagem. Verifique sua conexão e tente novamente.",
      );
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
