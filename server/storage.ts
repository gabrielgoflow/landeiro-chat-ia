import { type User, type InsertUser, type ChatReview, type InsertChatReview, type ChatMessage, type InsertChatMessage, users, chatReviews, chatMessages } from "@shared/schema";
import { randomUUID } from "crypto";
import { eq, sql, and } from "drizzle-orm";
import { db } from "./db";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Chat Reviews
  createChatReview(review: InsertChatReview): Promise<ChatReview>;
  getChatReview(chatId: string): Promise<ChatReview | undefined>;
  
  // Chat Messages - structured history
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  getChatMessages(chatId: string, limit?: number): Promise<ChatMessage[]>;
  getThreadMessages(threadId: string, limit?: number): Promise<ChatMessage[]>;
  getSessionMessages(threadId: string, sessao: number, limit?: number): Promise<ChatMessage[]>;
  getChatStats(chatId: string): Promise<any>;
  getChatOverview(chatId: string): Promise<any>;
  getThreadSessions(threadId: string): Promise<any[]>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private reviews: Map<string, ChatReview>;
  private messages: Map<string, ChatMessage[]>;

  constructor() {
    this.users = new Map();
    this.reviews = new Map();
    this.messages = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createChatReview(insertReview: InsertChatReview): Promise<ChatReview> {
    const id = randomUUID();
    const review: ChatReview = {
      ...insertReview,
      id,
      sessao: insertReview.sessao || null,
      createdAt: new Date(),
    };
    this.reviews.set(insertReview.chatId, review);
    return review;
  }

  async getChatReview(chatId: string): Promise<ChatReview | undefined> {
    return this.reviews.get(chatId);
  }

  // Chat Messages implementation
  async createChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const id = randomUUID();
    const message: ChatMessage = {
      ...insertMessage,
      id,
      threadId: insertMessage.threadId || null,
      audioUrl: insertMessage.audioUrl || null,
      metadata: insertMessage.metadata || {},
      messageType: insertMessage.messageType || null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const chatMessages = this.messages.get(insertMessage.chatId) || [];
    chatMessages.push(message);
    this.messages.set(insertMessage.chatId, chatMessages);
    
    return message;
  }

  async getChatMessages(chatId: string, limit = 100): Promise<ChatMessage[]> {
    const messages = this.messages.get(chatId) || [];
    return messages.slice(-limit).sort((a, b) => 
      new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime()
    );
  }

  async getThreadMessages(threadId: string, limit = 100): Promise<ChatMessage[]> {
    const allMessages: ChatMessage[] = [];
    for (const messages of Array.from(this.messages.values())) {
      allMessages.push(...messages.filter((m: ChatMessage) => m.threadId === threadId));
    }
    return allMessages.slice(-limit).sort((a, b) => 
      new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime()
    );
  }

  async getSessionMessages(threadId: string, sessao: number, limit = 100): Promise<ChatMessage[]> {
    const allMessages: ChatMessage[] = [];
    for (const messages of Array.from(this.messages.values())) {
      allMessages.push(...messages.filter((m: ChatMessage) => 
        m.threadId === threadId && m.sessao === sessao
      ));
    }
    return allMessages.slice(-limit).sort((a, b) => 
      new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime()
    );
  }

  async getChatStats(chatId: string): Promise<any> {
    const messages = this.messages.get(chatId) || [];
    return {
      totalMessages: messages.length,
      userMessages: messages.filter(m => m.sender === 'user').length,
      assistantMessages: messages.filter(m => m.sender === 'assistant').length,
      audioMessages: messages.filter(m => m.messageType === 'audio').length,
      textMessages: messages.filter(m => m.messageType === 'text').length,
      firstMessage: messages.length > 0 ? messages[0].createdAt : null,
      lastMessage: messages.length > 0 ? messages[messages.length - 1].createdAt : null
    };
  }

  async getChatOverview(chatId: string): Promise<any> {
    const review = this.reviews.get(chatId);
    const messages = this.messages.get(chatId) || [];
    const stats = await this.getChatStats(chatId);
    
    return {
      chatId,
      status: review ? 'finalizado' : 'em_andamento',
      reviewId: review?.id || null,
      reviewCreated: review?.createdAt || null,
      ...stats
    };
  }

  async getThreadSessions(threadId: string): Promise<any[]> {
    // In-memory implementation - basic fallback
    // For full functionality, database implementation is recommended
    return [];
  }
}

// Database implementation
export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    if (!db) throw new Error("Database not connected");
    const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    if (!db) throw new Error("Database not connected");
    const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0];
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    if (!db) throw new Error("Database not connected");
    const result = await db.insert(users).values(insertUser).returning();
    return result[0];
  }

  async createChatReview(insertReview: InsertChatReview): Promise<ChatReview> {
    if (!db) throw new Error("Database not connected");
    const result = await db.insert(chatReviews).values(insertReview).returning();
    return result[0];
  }

  async getChatReview(chatId: string): Promise<ChatReview | undefined> {
    if (!db) throw new Error("Database not connected");
    const result = await db.select().from(chatReviews).where(eq(chatReviews.chatId, chatId)).limit(1);
    return result[0];
  }

  // Chat Messages Database implementation
  async createChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    if (!db) throw new Error("Database not connected");
    const result = await db.insert(chatMessages).values(insertMessage).returning();
    return result[0];
  }

  async getChatMessages(chatId: string, limit = 100): Promise<ChatMessage[]> {
    if (!db) throw new Error("Database not connected");
    const result = await db.select().from(chatMessages)
      .where(eq(chatMessages.chatId, chatId))
      .orderBy(chatMessages.createdAt)
      .limit(limit);
    return result;
  }

  async getThreadMessages(threadId: string, limit = 100): Promise<ChatMessage[]> {
    if (!db) throw new Error("Database not connected");
    const result = await db.select().from(chatMessages)
      .where(eq(chatMessages.threadId, threadId))
      .orderBy(chatMessages.createdAt)
      .limit(limit);
    return result;
  }

  async getSessionMessages(threadId: string, sessao: number, limit = 100): Promise<ChatMessage[]> {
    if (!db) throw new Error("Database not connected");
    const result = await db.select().from(chatMessages)
      .where(and(
        eq(chatMessages.threadId, threadId),
        eq(chatMessages.sessao, sessao)
      ))
      .orderBy(chatMessages.createdAt)
      .limit(limit);
    return result;
  }

  async getChatMessagesBySession(chatId: string, sessao: number, limit = 100): Promise<ChatMessage[]> {
    if (!db) throw new Error("Database not connected");
    const result = await db.select().from(chatMessages)
      .where(and(
        eq(chatMessages.chatId, chatId),
        eq(chatMessages.sessao, sessao)
      ))
      .orderBy(chatMessages.createdAt)
      .limit(limit);
    return result;
  }

  async getChatStats(chatId: string): Promise<any> {
    if (!db) throw new Error("Database not connected");
    
    // Use raw SQL for better performance with aggregations
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as total_messages,
        COUNT(CASE WHEN sender = 'user' THEN 1 END) as user_messages,
        COUNT(CASE WHEN sender = 'assistant' THEN 1 END) as assistant_messages,
        COUNT(CASE WHEN message_type = 'audio' THEN 1 END) as audio_messages,
        COUNT(CASE WHEN message_type = 'text' THEN 1 END) as text_messages,
        MIN(created_at) as first_message,
        MAX(created_at) as last_message
      FROM chat_messages 
      WHERE chat_id = ${chatId}
    `);

    const stats = (result as any)[0] || {};
    return {
      totalMessages: parseInt(stats.total_messages as string) || 0,
      userMessages: parseInt(stats.user_messages as string) || 0,
      assistantMessages: parseInt(stats.assistant_messages as string) || 0,
      audioMessages: parseInt(stats.audio_messages as string) || 0,
      textMessages: parseInt(stats.text_messages as string) || 0,
      firstMessage: stats.first_message || null,
      lastMessage: stats.last_message || null
    };
  }

  async getChatOverview(chatId: string): Promise<any> {
    if (!db) throw new Error("Database not connected");
    
    // Use the view we created for optimized overview queries
    const result = await db.execute(sql`
      SELECT * FROM v_chat_overview WHERE chat_id = ${chatId}
    `);

    return (result as any)[0] || null;
  }

  async getThreadSessions(threadId: string): Promise<any[]> {
    if (!db) throw new Error("Database not connected");
    
    // Get all sessions for a thread_id with their review status
    const result = await db.execute(sql`
      SELECT 
        ct.*,
        cr.id as review_id,
        cr.resumo_atendimento,
        cr.created_at as review_created,
        CASE WHEN cr.id IS NOT NULL THEN 'finalizado' ELSE 'em_andamento' END as status
      FROM chat_threads ct
      LEFT JOIN chat_reviews cr ON ct.chat_id = cr.chat_id
      WHERE ct.thread_id = ${threadId}
      ORDER BY ct.sessao ASC
    `);

    return result as any[];
  }
}

// Use database storage if available, otherwise memory storage
export const storage = (db && process.env.DATABASE_URL) ? new DatabaseStorage() : new MemStorage();
