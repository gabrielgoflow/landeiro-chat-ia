import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const chatThreads = pgTable("chat_threads", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").notNull().references(() => chatThreads.id),
  content: text("content").notNull(),
  sender: varchar("sender", { enum: ["user", "ai"] }).notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertChatThreadSchema = createInsertSchema(chatThreads).pick({
  title: true,
  email: true,
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  threadId: true,
  content: true,
  sender: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type ChatThread = typeof chatThreads.$inferSelect;
export type InsertChatThread = z.infer<typeof insertChatThreadSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

// Frontend-only types for localStorage
export type ChatHistory = {
  threads: ChatThread[];
  messages: { [threadId: string]: Message[] };
};

export type WebhookRequest = {
  message: string;
  email: string;
  thread: string;
};

export type WebhookResponse = {
  output: string;
};
