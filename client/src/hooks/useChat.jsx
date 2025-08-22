import { useState, useEffect, useCallback } from "react";
import { ChatService } from "@/services/chatService.js";
import { SupabaseService } from "@/services/supabaseService.js";
import { ChatMessageService } from "@/services/chatMessageService.js";
import { useAuth } from "@/hooks/useAuth.jsx";

export function useChat() {
  const { user } = useAuth();
  const [chatHistory, setChatHistory] = useState({ threads: [], messages: {} });
  const [currentThreadId, setCurrentThreadId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

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

  const createThreadFromSupabase = useCallback(async (chatId) => {
    try {
      if (!user) return null;
      
      console.log('Creating thread from Supabase data for:', chatId);
      const userChats = await SupabaseService.getUserChats(user.id);
      const chatData = userChats.find(chat => chat.chat_id === chatId);
      
      if (!chatData) {
        console.warn('Chat not found in Supabase:', chatId);
        return null;
      }

      const newThread = {
        id: chatData.chat_threads?.chat_id || chatData.id, // Use internal chat_id as local ID
        title: `${chatData.diagnostico} - TCC`,
        threadId: chatData.thread_id,
        openaiChatId: chatData.chat_id, // This is the OpenAI chat_id for webhook
        sessionData: {
          diagnostico: chatData.diagnostico,
          protocolo: 'tcc', // Always TCC
          sessao: chatData.sessao
        },
        createdAt: new Date(chatData.created_at),
        updatedAt: new Date(chatData.created_at)
      };

      // Add thread to local storage
      setChatHistory(prev => ({
        threads: [newThread, ...prev.threads.filter(t => t.id !== chatId)],
        messages: { ...prev.messages, [chatId]: [] }
      }));

      console.log('Thread created from Supabase:', newThread);
      return newThread;
    } catch (error) {
      console.error('Error creating thread from Supabase:', error);
      return null;
    }
  }, [user]);

  const startNewThread = useCallback(async (sessionData = null) => {
    const newThread = ChatService.createNewThread(sessionData);
    
    // Save to local storage first
    setChatHistory(prev => ({
      threads: [newThread, ...prev.threads],
      messages: { ...prev.messages, [newThread.id]: [] }
    }));
    
    setCurrentThreadId(newThread.id);
    setError(null);

    // Save to Supabase if user is authenticated and session data exists
    if (user && sessionData) {
      try {
        // Novos chats sempre começam com sessão = 1
        const sessionNumber = 1;
        console.log('Creating new chat with session:', sessionNumber);

        const { data: chatThreadData, error: chatThreadError } = await SupabaseService.createChatThread(
          newThread.id, // chat_id (internal thread ID)
          '', // thread_id will be empty initially - filled later by OpenAI
          sessionData.diagnostico,
          sessionData.protocolo,
          sessionNumber // sempre começa com sessão 1
        );

        if (!chatThreadError && chatThreadData) {
          // Create user_chat relationship
          await SupabaseService.createUserChat(
            user.id,
            newThread.id, // using internal chat ID as OpenAI chat_id for now
            chatThreadData.id
          );
          
          // Update local thread with session number
          setChatHistory(prev => ({
            ...prev,
            threads: prev.threads.map(t => 
              t.id === newThread.id 
                ? { ...t, sessionData: { ...t.sessionData, sessao: sessionNumber } }
                : t
            )
          }));
          
          console.log(`Thread saved to Supabase successfully - Session ${sessionNumber}`);
        } else {
          console.error('Error saving to Supabase:', chatThreadError);
        }
      } catch (error) {
        console.error('Error saving thread to Supabase:', error);
        // Don't show error to user, just log it
      }
    }
  }, [user]);

  const loadChatHistory = useCallback(async (chatId, sessao = null) => {
    try {
      setIsLoading(true);
      console.log('Loading chat history for:', chatId, 'session:', sessao);
      
      // If we have session info, try to find thread and use session-specific loading
      const currentThread = chatHistory.threads.find(t => t.id === chatId);
      if (currentThread?.threadId && currentThread?.sessionData?.sessao) {
        console.log(`Using session-specific loading for thread ${currentThread.threadId} session ${currentThread.sessionData.sessao}`);
        const historyMessages = await ChatService.getSessionMessages(currentThread.threadId, currentThread.sessionData.sessao);
        
        // Update chat history with loaded messages (even if empty array)
        setChatHistory(prev => ({
          ...prev,
          messages: {
            ...prev.messages,
            [chatId]: historyMessages || []
          }
        }));

        console.log(`Loaded ${historyMessages.length} session-specific messages for chat ${chatId}`);
      } else {
        // Fallback to individual chat messages
        const historyMessages = await ChatService.getMessageHistory(chatId);
        
        // Update chat history with loaded messages (even if empty array)
        setChatHistory(prev => ({
          ...prev,
          messages: {
            ...prev.messages,
            [chatId]: historyMessages || []
          }
        }));

        console.log(`Loaded ${historyMessages.length} messages for chat ${chatId}`);
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      setError('Erro ao carregar histórico da conversa');
    } finally {
      setIsLoading(false);
    }
  }, [chatHistory.threads]);

  const selectThread = useCallback(async (threadId) => {
    console.log('Selecting thread:', threadId);
    
    // Check if thread exists locally
    const existingThread = chatHistory.threads.find(t => t.id === threadId);
    
    if (!existingThread) {
      console.log('Thread not found locally, creating from Supabase...');
      const createdThread = await createThreadFromSupabase(threadId);
      if (!createdThread) {
        console.log('Failed to create thread from Supabase');
        return;
      }
    }
    
    setCurrentThreadId(threadId);
    setError(null);
    
    // Check if we already have messages for this thread
    const existingMessages = chatHistory.messages[threadId];
    console.log('Existing messages for thread:', existingMessages?.length || 0);
    
    // Always load fresh messages from chat_messages table for the specific session
    console.log('Loading fresh messages from chat_messages table...');
    await loadChatHistory(threadId);
  }, [chatHistory.threads, chatHistory.messages, loadChatHistory, createThreadFromSupabase]);

  // Method to force reload a thread (useful for new sessions)
  const reloadThread = useCallback(async (threadId) => {
    console.log('Force reloading thread:', threadId);
    
    // Clear existing messages for this thread
    setChatHistory(prev => ({
      ...prev,
      messages: { ...prev.messages, [threadId]: [] }
    }));
    
    // Remove thread from local storage to force recreation
    setChatHistory(prev => ({
      threads: prev.threads.filter(t => t.id !== threadId),
      messages: prev.messages
    }));
    
    // Recreate thread and load history
    await selectThread(threadId);
  }, [selectThread]);

  const deleteThread = useCallback(async (threadId) => {
    setChatHistory(prev => {
      const newMessages = { ...prev.messages };
      delete newMessages[threadId];
      
      return {
        threads: prev.threads.filter(t => t.id !== threadId),
        messages: newMessages
      };
    });
    
    // Delete from Supabase if user is authenticated
    if (user) {
      try {
        await SupabaseService.deleteChatThread(threadId);
        console.log('Thread deleted from Supabase successfully');
      } catch (error) {
        console.error('Error deleting thread from Supabase:', error);
        // Don't show error to user, just log it
      }
    }
    
    // If deleting current thread, switch to another or create new
    if (currentThreadId === threadId) {
      const remainingThreads = chatHistory.threads.filter(t => t.id !== threadId);
      if (remainingThreads.length > 0) {
        setCurrentThreadId(remainingThreads[0].id);
      } else {
        startNewThread();
      }
    }
  }, [currentThreadId, chatHistory.threads, startNewThread, user]);

  const sendMessage = useCallback(async (content) => {
    // Handle both text messages and audio messages
    if (typeof content === 'string' && !content.trim()) return;
    if (typeof content === 'object' && !content.type) return;
    
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
          // Generate title from text content or use default for audio
          const titleContent = typeof content === 'string' ? content : 'Mensagem de áudio';
          return {
            ...thread,
            title: ChatService.generateThreadTitle(titleContent),
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
          [threadId]: [...(prev.messages[threadId] || []), userMessage]
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
      
      // Save user message to chat_messages table
      await ChatMessageService.saveMessage({
        chatId: threadId,
        threadId: currentThread?.threadId || '',
        sessao: sessionData?.sessao || 1,
        messageId: userMessage.id,
        sender: 'user',
        content: typeof content === 'string' ? content : JSON.stringify(content),
        messageType: typeof content === 'object' && content.type === 'audio' ? 'audio' : 'text',
        audioUrl: typeof content === 'object' && content.audioUrl ? content.audioUrl : null,
        metadata: {}
      });
      
      // Send to webhook and get AI response (using threadId as chat_id)
      const aiResponse = await ChatService.sendMessage(content, threadId, sessionData, threadId);
      
      // Handle audio or text response from AI
      let aiMessage;
      if (typeof aiResponse === 'object' && aiResponse.type === 'audio') {
        // Create audio message from AI response
        aiMessage = ChatService.createUserMessage(threadId, {
          type: 'audio',
          audioBase64: aiResponse.audioBase64,
          mimeType: aiResponse.mimeType,
          duration: 0
        });
        aiMessage.sender = 'assistant'; // Override sender for AI audio messages
        
        // Save AI audio message to chat_messages table
        await ChatMessageService.saveMessage({
          chatId: threadId,
          threadId: currentThread?.threadId || '',
          sessao: sessionData?.sessao || 1,
          messageId: aiMessage.id,
          sender: 'assistant',
          content: aiResponse.message || 'Mensagem de áudio',
          messageType: 'audio',
          audioUrl: null, // We store base64 in content for audio messages
          metadata: { mimeType: aiResponse.mimeType, audioBase64: aiResponse.audioBase64 }
        });
      } else {
        // Create text message
        const messageText = typeof aiResponse === 'string' ? aiResponse : aiResponse.message;
        aiMessage = ChatService.createAiMessage(threadId, messageText);
        
        // Save AI text message to chat_messages table
        await ChatMessageService.saveMessage({
          chatId: threadId,
          threadId: currentThread?.threadId || '',
          sessao: sessionData?.sessao || 1,
          messageId: aiMessage.id,
          sender: 'assistant',
          content: messageText,
          messageType: 'text',
          audioUrl: null,
          metadata: {}
        });
      }

      setChatHistory(prev => ({
        threads: prev.threads.map(thread => 
          thread.id === threadId 
            ? { 
                ...thread, 
                threadId: aiResponse?.thread_id || thread.threadId // Store OpenAI thread_id for history loading
              }
            : thread
        ),
        messages: {
          ...prev.messages,
          [threadId]: [...prev.messages[threadId], aiMessage]
        }
      }));

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro desconhecido";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [currentThreadId, chatHistory]);

  const getCurrentMessages = useCallback(() => {
    if (!currentThreadId) return [];
    return chatHistory.messages[currentThreadId] || [];
  }, [currentThreadId, chatHistory.messages]);

  const getCurrentThread = useCallback(() => {
    if (!currentThreadId) return null;
    return chatHistory.threads.find(t => t.id === currentThreadId) || null;
  }, [currentThreadId, chatHistory.threads]);

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
    createThreadFromSupabase,
    reloadThread,
    clearError: () => setError(null)
  };
}