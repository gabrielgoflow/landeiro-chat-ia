import { type User, type InsertUser, type ChatReview, type InsertChatReview } from "@shared/schema";
import { randomUUID } from "crypto";

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

export const storage = new MemStorage();
