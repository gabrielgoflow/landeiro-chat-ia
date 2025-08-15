import { useState, useEffect, useCallback } from "react";
import { ChatService } from "@/services/chatService.js";
import type { ChatHistory, ChatThreadExtended, Message } from "@shared/schema";

export function useChat() {
  const [chatHistory, setChatHistory] = useState<ChatHistory>({ threads: [], messages: {} });
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load chat history from localStorage on mount
  useEffect(() => {
    const history = ChatService.getStoredHistory();
    setChatHistory(history);
    
    // Set current thread to the most recent one if exists
    if (history.threads.length > 0) {
      const mostRecentThread = history.threads.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )[0];
      setCurrentThreadId(mostRecentThread.id);
    }
  }, []);

  // Save to localStorage whenever history changes
  useEffect(() => {
    ChatService.saveHistory(chatHistory);
  }, [chatHistory]);

  const startNewThread = useCallback(() => {
    const newThread = ChatService.createNewThread();
    
    setChatHistory(prev => ({
      threads: [newThread, ...prev.threads],
      messages: { ...prev.messages, [newThread.id]: [] }
    }));
    
    setCurrentThreadId(newThread.id);
    setError(null);
  }, []);

  const selectThread = useCallback((threadId: string) => {
    setCurrentThreadId(threadId);
    setError(null);
  }, []);

  const deleteThread = useCallback((threadId: string) => {
    setChatHistory(prev => {
      const newMessages = { ...prev.messages };
      delete newMessages[threadId];
      
      return {
        threads: prev.threads.filter(t => t.id !== threadId),
        messages: newMessages
      };
    });
    
    // If deleting current thread, switch to another or create new
    if (currentThreadId === threadId) {
      const remainingThreads = chatHistory.threads.filter(t => t.id !== threadId);
      if (remainingThreads.length > 0) {
        setCurrentThreadId(remainingThreads[0].id);
      } else {
        startNewThread();
      }
    }
  }, [currentThreadId, chatHistory.threads, startNewThread]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;
    
    let threadId = currentThreadId;
    
    // Create new thread if none exists
    if (!threadId) {
      const newThread = ChatService.createNewThread();
      threadId = newThread.id;
      
      setChatHistory(prev => ({
        threads: [newThread, ...prev.threads],
        messages: { ...prev.messages, [newThread.id]: [] }
      }));
      
      setCurrentThreadId(threadId);
    }

    // Add user message
    const userMessage = ChatService.createUserMessage(threadId, content);
    
    setChatHistory(prev => {
      // Update thread title if it's still "Nova Conversa"
      const updatedThreads = prev.threads.map(thread => {
        if (thread.id === threadId && thread.title === "Nova Conversa") {
          return {
            ...thread,
            title: ChatService.generateThreadTitle(content),
            updatedAt: new Date()
          };
        } else if (thread.id === threadId) {
          return { ...thread, updatedAt: new Date() };
        }
        return thread;
      });

      return {
        threads: updatedThreads,
        messages: {
          ...prev.messages,
          [threadId!]: [...(prev.messages[threadId!] || []), userMessage]
        }
      };
    });

    setIsLoading(true);
    setError(null);

    try {
      // Get current thread to access session data
      const currentThread = chatHistory.threads.find(t => t.id === threadId);
      const sessionData = currentThread?.sessionData || null;
      
      console.log('Current thread for message:', { threadId, sessionData });
      
      // Send to webhook and get AI response (using threadId as chat_id)
      const aiResponse = await ChatService.sendMessage(content, threadId, sessionData, threadId);
      const aiMessage = ChatService.createAiMessage(threadId, aiResponse.output || "Desculpe, não consegui processar sua mensagem.");

      setChatHistory(prev => ({
        threads: prev.threads.map(thread => 
          thread.id === threadId 
            ? { 
                ...thread, 
                openaiChatId: aiResponse.thread_id || thread.openaiChatId // Store OpenAI thread_id for future messages
              }
            : thread
        ),
        messages: {
          ...prev.messages,
          [threadId!]: [...prev.messages[threadId!], aiMessage]
        }
      }));

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro desconhecido";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [currentThreadId]);

  const getCurrentMessages = useCallback((): Message[] => {
    if (!currentThreadId) return [];
    return chatHistory.messages[currentThreadId] || [];
  }, [currentThreadId, chatHistory.messages]);

  const getCurrentThread = useCallback((): ChatThreadExtended | null => {
    if (!currentThreadId) return null;
    return chatHistory.threads.find(t => t.id === currentThreadId) || null;
  }, [currentThreadId, chatHistory.threads]);

  const loadMessageHistory = useCallback(async (threadId: string, openaiChatId: string) => {
    try {
      console.log('Loading message history for thread:', threadId, 'with OpenAI chat ID:', openaiChatId);
      // @ts-ignore - ChatService.getMessageHistory exists in JS file
      const messages = await ChatService.getMessageHistory(openaiChatId);
      
      setChatHistory(prev => ({
        ...prev,
        messages: {
          ...prev.messages,
          [threadId]: messages
        }
      }));
      
      console.log(`Loaded ${messages.length} messages for thread ${threadId}`);
    } catch (error) {
      console.error('Error loading message history:', error);
    }
  }, []);

  return {
    threads: chatHistory.threads,
    allMessages: chatHistory.messages,
    currentMessages: getCurrentMessages(),
    currentThread: getCurrentThread(),
    isLoading,
    error,
    startNewThread,
    selectThread,
    deleteThread,
    sendMessage,
    clearError: () => setError(null),
    loadMessageHistory
  };
}
