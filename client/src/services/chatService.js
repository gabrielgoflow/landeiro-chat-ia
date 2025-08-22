import { ChatMessageService } from './chatMessageService.js';

const USER_EMAIL = "user@example.com";

export class ChatService {
  static generateThreadId() {
    return `thread_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static generateMessageId() {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  static saveChatHistory(chatHistory) {
    try {
      localStorage.setItem("chatHistory", JSON.stringify({
        threads: chatHistory.threads || [],
        messages: chatHistory.messages || {},
        timestamp: Date.now()
      }));
    } catch (error) {
      console.error("Error saving chat history:", error);
    }
  }

  static loadChatHistory() {
    try {
      const stored = localStorage.getItem("chatHistory");
      if (!stored) return { threads: [], messages: {} };
      
      const parsed = JSON.parse(stored);
      return {
        threads: Array.isArray(parsed.threads) ? parsed.threads : [],
        messages: typeof parsed.messages === 'object' ? parsed.messages : {}
      };
    } catch (error) {
      console.error("Error loading chat history:", error);
      return { threads: [], messages: {} };
    }
  }

  static getStoredHistory() {
    return this.loadChatHistory();
  }

  static saveHistory(chatHistory) {
    return this.saveChatHistory(chatHistory);
  }

  static clearChatHistory() {
    try {
      localStorage.removeItem("chatHistory");
      console.log("Chat history cleared");
    } catch (error) {
      console.error("Error clearing chat history:", error);
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

      // Transform messages to expected format
      return this.transformMessages(messages, chatId);
    } catch (error) {
      console.error('Error loading message history:', error);
      return [];
    }
  }

  static async getSessionMessages(threadId, sessao) {
    try {
      // Use session-specific endpoint for thread+session filtering
      const response = await fetch(`/api/session-messages/${threadId}/${sessao}`);

      if (!response.ok) {
        if (response.status === 404 || response.status === 500) {
          // No messages found for this session or error - return empty array
          console.log(`No messages found for thread ${threadId} session ${sessao} or error occurred`);
          return [];
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const messages = await response.json();
      console.log(`Loaded ${messages.length} session-specific messages for thread ${threadId} session ${sessao}`);

      // Transform messages to expected format
      return this.transformMessages(messages, `${threadId}_session_${sessao}`);
    } catch (error) {
      console.error('Error loading session messages:', error);
      return [];
    }
  }

  // Helper method to transform database messages to frontend format
  static transformMessages(messages, identifier) {
    const transformedMessages = messages.map(msg => {
      const baseMessage = {
        id: msg.messageId || msg.message_id,
        sender: msg.sender,
        timestamp: new Date(msg.createdAt || msg.created_at),
      };

      // Handle audio messages
      if (msg.messageType === 'audio' || msg.message_type === 'audio') {
        // For audio messages, the base64 is stored in content field
        const base64Data = msg.content;
        const metadata = msg.metadata || {};
        
        return {
          ...baseMessage,
          type: 'audio',
          audioUrl: msg.audioUrl || msg.audio_url,
          audioBase64: base64Data ? `data:audio/mp3;base64,${base64Data}` : null, // Format as data URI
          mimeType: metadata.mimeType || msg.mimeType || msg.mime_type || 'audio/mp3',
          duration: msg.duration || 0,
          content: metadata.text || 'Mensagem de áudio', // Use text from metadata for display
        };
      }

      // Handle text messages
      return {
        ...baseMessage,
        content: msg.content,
        text: msg.content,
      };
    });

    console.log(`Transformed ${transformedMessages.length} messages for ${identifier}`);
    return transformedMessages;
  }

  static async sendMessage(content, chatId, sessionData = null, threadId = null) {
    try {
      const payload = {
        user_email: USER_EMAIL,
        chat_id: chatId,
      };

      // Add session data if available
      if (sessionData) {
        payload.diagnostico = sessionData.diagnostico;
        payload.protocolo = sessionData.protocolo || 'tcc';
        payload.sessao = sessionData.sessao;
      }

      // Handle audio content
      if (typeof content === 'object' && content.type === 'audio') {
        payload.message = JSON.stringify({
          type: 'audio',
          audioBase64: content.audioBase64,
          audioURL: content.audioURL,
          mimeType: content.mimeType || 'audio/webm',
          duration: content.duration || 0,
        });
      } else {
        // Handle text content
        payload.message = content;
      }

      console.log('Sending to webhook with payload:', payload);

      const response = await fetch('/api/landeiro-chat-ia', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('AI response received:', result);

      return result;
    } catch (error) {
      console.error('Error sending message to AI:', error);
      throw error;
    }
  }

  static generateThreadTitle(content) {
    const maxLength = 50;
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength).trim() + "...";
  }

  static formatTimestamp(timestamp) {
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return new Date().toLocaleTimeString('pt-BR', { 
          hour: '2-digit', 
          minute: '2-digit' 
        });
      }
      return date.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } catch (error) {
      console.error('Error formatting timestamp:', error);
      return new Date().toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
  }
}