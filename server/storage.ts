import { type User, type InsertUser, type ChatReview, type InsertChatReview, users, chatReviews } from "@shared/schema";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
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
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private reviews: Map<string, ChatReview>;

  constructor() {
    this.users = new Map();
    this.reviews = new Map();
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
      createdAt: new Date(),
    };
    this.reviews.set(insertReview.chatId, review);
    return review;
  }

  async getChatReview(chatId: string): Promise<ChatReview | undefined> {
    return this.reviews.get(chatId);
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
}

// Use database storage if available, otherwise memory storage
export const storage = (db && process.env.DATABASE_URL) ? new DatabaseStorage() : new MemStorage();
