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
  const [skipNextReload, setSkipNextReload] = useState(false);

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
      let chatData = null;
      
      // First try getUserChats method
      try {
        const userChats = await SupabaseService.getUserChats(user.id);
        chatData = userChats.find(chat => chat.chat_id === chatId);
      } catch (userChatsError) {
        console.log('getUserChats failed, trying alternative search:', userChatsError);
      }
      
      // If not found in user chats, search in thread sessions
      if (!chatData) {
        console.log('Chat not found in user chats, searching in thread sessions for:', chatId);
        
        try {
          // Search in the known main thread
          const knownThreadId = 'thread_MhnbDaLNDSujRvcmDTQXJMZe';
          let sessionsResponse = await fetch(`/api/thread-sessions/${knownThreadId}`);
          if (sessionsResponse.ok) {
            const sessions = await sessionsResponse.json();
            chatData = sessions.find(session => session.chat_id === chatId);
            
            if (chatData) {
              console.log('Found session in known thread:', chatData);
            }
          }
          
          // If still not found, try the newer thread
          if (!chatData) {
            const newerThreadId = 'thread_mdHsOPv65Qlbm4UeR7UKupuW';
            sessionsResponse = await fetch(`/api/thread-sessions/${newerThreadId}`);
            if (sessionsResponse.ok) {
              const sessions = await sessionsResponse.json();
              chatData = sessions.find(session => session.chat_id === chatId);
              
              if (chatData) {
                console.log('Found session in newer thread:', chatData);
              }
            }
          }
        } catch (sessionSearchError) {
          console.log('Thread session search failed:', sessionSearchError);
        }
      }
      
      if (!chatData) {
        console.warn('Chat not found in Supabase:', chatId);
        return null;
      }

      const newThread = {
        id: chatData.chat_id,
        title: `${chatData.diagnostico} - TCC`,
        threadId: chatData.thread_id,
        openaiChatId: chatData.chat_id,
        sessionData: {
          diagnostico: chatData.diagnostico,
          protocolo: chatData.protocolo || 'tcc',
          sessao: chatData.sessao
        },
        createdAt: new Date(chatData.created_at),
        updatedAt: new Date(chatData.updated_at || chatData.created_at)
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

  const startNewThread = useCallback(async (sessionData = null, onChatCreated = null) => {
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
          
          // Notify that a new chat was created (for sidebar refresh)
          if (onChatCreated) {
            console.log('Calling onChatCreated callback to refresh sidebar');
            onChatCreated(newThread);
          }
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
      
      // If we have session info, use session-specific loading by chat_id + sessao
      const currentThread = chatHistory.threads.find(t => t.id === chatId);
      if (currentThread?.sessionData?.sessao) {
        console.log(`Using session-specific loading for chat ${chatId} session ${currentThread.sessionData.sessao}`);
        const historyMessages = await ChatService.getSessionMessages(chatId, currentThread.sessionData.sessao);
        
        // Update chat history with loaded messages (even if empty array)
        setChatHistory(prev => ({
          ...prev,
          messages: {
            ...prev.messages,
            [chatId]: historyMessages || []
          }
        }));

        console.log(`Loaded ${historyMessages.length} session-specific messages for chat ${chatId}`);
        return; // Exit early to avoid fallback call
      }
      
      // Only use fallback if session-specific loading didn't happen
      console.log('Using fallback individual chat messages loading for:', chatId);
      const historyMessages = await ChatService.getMessageHistory(chatId);
      
      // Only update if there are no existing messages or if loaded messages are newer
      setChatHistory(prev => {
        const existingMessages = prev.messages[chatId] || [];
        const loadedMessages = historyMessages || [];
        
        // If we have more messages locally than from DB, preserve local messages
        if (existingMessages.length > loadedMessages.length) {
          console.log(`Preserving local messages (${existingMessages.length}) over DB messages (${loadedMessages.length})`);
          return prev;
        }
        
        return {
          ...prev,
          messages: {
            ...prev.messages,
            [chatId]: loadedMessages
          }
        };
      });

      console.log(`Loaded ${historyMessages.length} messages from chat_messages table for session:`, chatId);
    } catch (error) {
      console.error('Error loading chat history:', error);
      setError('Erro ao carregar histórico da conversa');
    } finally {
      setIsLoading(false);
    }
  }, [chatHistory.threads]);

  const selectThread = useCallback(async (threadId) => {
    console.log('Selecting thread:', threadId);
    
    // NUNCA limpar mensagens - sempre preservar o histórico local
    console.log('Preserving all existing messages during navigation');
    
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
    
    // Sempre carregar mensagens da base se não temos mensagens locais
    const existingMessages = chatHistory.messages[threadId] || [];
    if (existingMessages.length === 0) {
      console.log('Loading fresh messages from database...');
      await loadChatHistory(threadId);
    } else {
      console.log('Using existing local messages, skipping database load');
    }
  }, [chatHistory.threads, loadChatHistory, createThreadFromSupabase]);

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
    setSkipNextReload(true); // Evita reload automático durante envio

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
          audioBase64: aiResponse.base64, // Use 'base64' from webhook response
          mimeType: aiResponse.mimeType || 'audio/mp3',
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
          content: JSON.stringify({
            type: 'audio',
            audioBase64: aiResponse.base64, // Use 'base64' from webhook response
            mimeType: aiResponse.mimeType || 'audio/mp3',
            duration: 0
          }),
          messageType: 'audio',
          audioUrl: null,
          metadata: { mimeType: aiResponse.mimeType || 'audio/mp3' }
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

      // Update state immediately for real-time UI
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

      // Force a UI update to ensure messages are visible immediately
      setTimeout(() => {
        setChatHistory(prev => ({
          ...prev,
          messages: {
            ...prev.messages,
            [threadId]: [...prev.messages[threadId]]
          }
        }));
      }, 100);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Erro desconhecido";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setSkipNextReload(false); // Reset flag após envio completo
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
    clearError: () => setError(null),
    clearMessages: (chatId) => {
      console.log('Clearing messages for chat:', chatId);
      setChatHistory(prev => ({
        ...prev,
        messages: {
          ...prev.messages,
          [chatId]: []
        }
      }));
    }
  };
}