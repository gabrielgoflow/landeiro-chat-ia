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
      
      // Log detailed info about each message
      messages.forEach((msg, index) => {
        console.log(`Message ${index} (${msg.sender}):`, {
          id: msg.message_id,
          type: msg.message_type,
          hasContent: !!msg.content,
          contentLength: msg.content ? msg.content.length : 0,
          contentPreview: msg.content ? msg.content.substring(0, 50) : 'null',
          isAssistant: msg.sender === 'assistant'
        });
      });

      // Transform messages to expected format
      const transformedMessages = this.transformMessages(messages, `${threadId}_session_${sessao}`);
      
      // Log assistant messages after transformation
      const assistantMessages = transformedMessages.filter(msg => msg.sender === 'assistant');
      console.log(`After transformation - found ${assistantMessages.length} assistant messages:`, 
        assistantMessages.map(msg => ({
          id: msg.id,
          type: msg.type,
          hasAudioBase64: !!msg.audioBase64,
          hasAudioUrl: !!msg.audioUrl
        }))
      );
      
      return transformedMessages;
    } catch (error) {
      console.error('Error loading session messages:', error);
      return [];
    }
  }

  // Helper method to transform database messages to frontend format
  static transformMessages(messages, identifier) {
    console.log(`🔄 TRANSFORMING ${messages.length} messages for ${identifier}`);
    
    const transformedMessages = messages.map(msg => {
      const baseMessage = {
        id: msg.messageId || msg.message_id,
        sender: msg.sender,
        timestamp: new Date(msg.createdAt || msg.created_at),
      };

      // Handle audio messages - check for explicit audio type OR content containing base64 audio
      const isExplicitAudio = msg.messageType === 'audio' || msg.message_type === 'audio';
      const hasAudioContent = msg.content && typeof msg.content === 'string' && 
        (msg.content.includes('base64,') || msg.content.startsWith('data:audio'));
      
      if (isExplicitAudio || hasAudioContent) {
        console.log('🎵 TRANSFORMING AUDIO MESSAGE:', {
          id: msg.message_id,
          sender: msg.sender,
          type: msg.message_type,
          isExplicitAudio,
          hasAudioContent,
          contentPreview: msg.content ? msg.content.substring(0, 50) : 'null'
        });
        console.log('Message content type:', typeof msg.content);
        console.log('Content preview:', msg.content ? msg.content.substring(0, 100) : 'null');
        
        let audioUrl = msg.audioUrl || msg.audio_url;
        let audioBase64 = msg.audioBase64 || msg.audio_base64;
        let mimeType = msg.mimeType || msg.mime_type || 'audio/webm';
        
        // If content contains base64 audio data directly (assistant messages)
        if (msg.content && typeof msg.content === 'string' && msg.content.includes('base64,')) {
          // Extract base64 audio from content - could be direct base64 or data URL
          if (msg.content.startsWith('data:audio')) {
            audioBase64 = msg.content;
            const mimeMatch = msg.content.match(/data:audio\/([^;]+)/);
            mimeType = mimeMatch ? `audio/${mimeMatch[1]}` : 'audio/mp3';
          } else if (msg.content.includes('base64,')) {
            const base64Part = msg.content.split('base64,')[1];
            audioBase64 = `data:audio/mp3;base64,${base64Part}`;
            mimeType = 'audio/mp3';
          }
        }
        // If content is a JSON string (user messages), parse it to extract audio data
        else if (msg.content && typeof msg.content === 'string' && msg.content.startsWith('{')) {
          try {
            const contentData = JSON.parse(msg.content);
            if (contentData.type === 'audio') {
              // audioBase64 already includes the data: prefix, use as-is
              audioBase64 = contentData.audioBase64;
              audioUrl = contentData.audioURL || contentData.audioUrl;
              mimeType = contentData.mimeType || mimeType;
              
              // Ensure audioBase64 has correct data URL format
              if (audioBase64 && !audioBase64.startsWith('data:')) {
                audioBase64 = `data:${mimeType};base64,${audioBase64}`;
              }
            }
          } catch (e) {
            console.warn('Failed to parse audio content JSON:', e);
          }
        }
        
        // If no audioBase64 but has audioUrl, we'll let the component handle loading from URL
        // For assistant messages, the audioUrl might be present but audioBase64 might be null
        
        const audioMessage = {
          ...baseMessage,
          type: 'audio',
          audioUrl,
          audioBase64,
          mimeType,
          duration: msg.duration || 0,
        };
        console.log('Transformed audio message result:', {
          id: audioMessage.id,
          sender: audioMessage.sender,
          hasAudioBase64: !!audioMessage.audioBase64,
          hasAudioUrl: !!audioMessage.audioUrl,
          mimeType: audioMessage.mimeType
        });
        return audioMessage;
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
        chat_id: chatId, // This is the session-specific chat ID
        chatId: chatId,  // Also include as chatId for compatibility
      };

      // Add session data if available
      if (sessionData) {
        payload.diagnostico = sessionData.diagnostico;
        payload.protocolo = sessionData.protocolo || 'tcc';
        payload.sessao = sessionData.sessao;
        payload.threadId = threadId; // Include threadId for AI response saving
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