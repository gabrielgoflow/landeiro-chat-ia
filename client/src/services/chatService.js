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

  static async getSessionMessages(chatId, sessao) {
    try {
      // Use session-specific endpoint for chat_id+session filtering
      const response = await fetch(`/api/session-messages/${chatId}/${sessao}`);

      if (!response.ok) {
        if (response.status === 404 || response.status === 500) {
          // No messages found for this session or error - return empty array
          console.log(`No messages found for chat ${chatId} session ${sessao} or error occurred`);
          return [];
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const messages = await response.json();
      console.log(`Loaded ${messages.length} session-specific messages for chat ${chatId} session ${sessao}`);

      // Transform messages to expected format
      return this.transformMessages(messages, `${chatId}_session_${sessao}`);
    } catch (error) {
      console.error('Error loading session messages:', error);
      return [];
    }
  }

  // Helper method to transform database messages to frontend format
  static transformMessages(messages, identifier) {
    const transformedMessages = messages.map((msg, index) => {
      const baseMessage = {
        id: msg.messageId || msg.message_id || msg.id,
        sender: msg.sender,
        timestamp: new Date(msg.createdAt || msg.created_at),
      };

      // Handle audio messages - check both camelCase and snake_case
      if (msg.messageType === 'audio' || msg.message_type === 'audio') {
        console.log(`Processing audio message [${index}] from ${msg.sender}:`, {
          messageType: msg.messageType || msg.message_type,
          audioUrl: msg.audioUrl || msg.audio_url,
          content: msg.content?.substring(0, 100) + '...',
          sender: msg.sender
        });
        
        // If content is a JSON string (as stored in DB), parse it
        let audioData = {};
        if (typeof msg.content === 'string') {
          try {
            audioData = JSON.parse(msg.content);
            console.log(`Parsed audio data from content for ${msg.sender}:`, {
              hasAudioBase64: !!audioData.audioBase64,
              hasAudioURL: !!audioData.audioURL,
              mimeType: audioData.mimeType
            });
          } catch (e) {
            console.warn('Failed to parse audio content as JSON:', msg.content?.substring(0, 50));
          }
        }
        
        const audioMessage = {
          ...baseMessage,
          type: 'audio',
          audioUrl: msg.audioUrl || msg.audio_url || audioData.audioURL,
          audioBase64: msg.audioBase64 || msg.audio_base64 || audioData.audioBase64,
          mimeType: msg.mimeType || msg.mime_type || audioData.mimeType || 'audio/webm',
          duration: msg.duration || audioData.duration || 0,
        };
        
        console.log(`Final audio message for ${msg.sender}:`, {
          hasAudioUrl: !!audioMessage.audioUrl,
          hasAudioBase64: !!audioMessage.audioBase64,
          mimeType: audioMessage.mimeType
        });
        
        return audioMessage;
      }

      // Handle text messages
      const textMessage = {
        ...baseMessage,
        content: msg.content,
        text: msg.content,
      };
      
      console.log(`Text message from ${msg.sender}:`, textMessage.content?.substring(0, 50) + '...');
      
      return textMessage;
    });

    console.log(`Transformed ${transformedMessages.length} messages for ${identifier}`);
    console.log('Message breakdown by sender:', {
      user: transformedMessages.filter(m => m.sender === 'user').length,
      assistant: transformedMessages.filter(m => m.sender === 'assistant').length,
      total: transformedMessages.length
    });
    
    return transformedMessages;
  }

  static async sendMessage(content, chatId, sessionData = null, threadId = null) {
    try {
      const payload = {
        user_email: USER_EMAIL,
        chat_id: chatId, // This is the session-specific chat ID
        chatId: chatId,  // Also include as chatId for compatibility
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