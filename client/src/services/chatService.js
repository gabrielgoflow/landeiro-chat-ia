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
      const response = await fetch(
        "https://n8nflowhook.goflow.digital/webhook/landeiro-chat-ia-get-history",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: chatId,
            email: USER_EMAIL,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log("Raw response from history endpoint:", data);

      // Transform OpenAI messages to our format
      const messages = [];
      if (data && data.data) {
        // Sort by created_at ascending (oldest first)
        const sortedMessages = data.data.sort(
          (a, b) => a.created_at - b.created_at,
        );
        console.log("Sorted messages from OpenAI:", sortedMessages);

        let firstUserMessageSkipped = false;
        
        for (const msg of sortedMessages) {
          const messageText = msg.content[0]?.text?.value || "";
          
          // Check if message is an audio message (JSON string)
          let transformedMsg;
          try {
            const audioData = JSON.parse(messageText);
            if (audioData.type === 'audio') {
              // This is an audio message
              transformedMsg = {
                id: msg.id,
                type: 'audio',
                audioBase64: audioData.audioBase64,
                audioUrl: audioData.audioUrl || audioData.audioURL, // Support both formats
                audioURL: audioData.audioURL, // Include audioURL for consistency
                mimeType: audioData.mimeType || 'audio/webm',
                duration: audioData.duration || 0,
                sender: msg.role === "user" ? "user" : "assistant",
                timestamp: new Date(msg.created_at * 1000),
              };
            } else {
              throw new Error('Not audio message');
            }
          } catch {
            // Regular text message
            transformedMsg = {
              id: msg.id,
              text: messageText,
              content: messageText, // Add content for compatibility
              sender: msg.role === "user" ? "user" : "assistant",
              timestamp: new Date(msg.created_at * 1000),
            };
          }
          
          // Skip the first user message (it's always duplicated)
          if (msg.role === "user" && !firstUserMessageSkipped) {
            firstUserMessageSkipped = true;
            console.log("Skipped first user message:", transformedMsg);
            continue;
          }
          
          messages.push(transformedMsg);
          console.log("Transformed message:", transformedMsg);
        }
      } else {
        console.log("No data array found in response:", data);
      }

      console.log("Final messages array:", messages);
      return messages;
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
      chat_id: chatId,
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
