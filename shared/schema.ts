import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, uuid, smallint, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const chatThreads = pgTable("chat_threads", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  chatId: varchar("chat_id").notNull(),
  threadId: varchar("thread_id").notNull(),
  diagnostico: varchar("diagnostico"),
  protocolo: varchar("protocolo"),
  sessao: smallint("sessao"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  threadId: varchar("thread_id").notNull().references(() => chatThreads.id),
  content: text("content").notNull(),
  sender: varchar("sender", { enum: ["user", "ai"] }).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  chatId: varchar("chat_id").notNull(),
  threadId: varchar("thread_id"),
  sessao: integer("sessao").notNull(),
  messageId: varchar("message_id").notNull(),
  sender: varchar("sender", { enum: ["user", "assistant"] }).notNull(),
  content: text("content").notNull(),
  messageType: varchar("message_type").default("text"),
  audioUrl: varchar("audio_url"),
  metadata: jsonb("metadata").default(sql`'{}'`),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const chatReviews = pgTable("chat_reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  chatId: varchar("chat_id").notNull().unique(),
  resumoAtendimento: text("resumo_atendimento").notNull(),
  feedbackDireto: text("feedback_direto").notNull(),
  sinaisPaciente: text("sinais_paciente").array().notNull(),
  pontosPositivos: text("pontos_positivos").array().notNull(),
  pontosNegativos: text("pontos_negativos").array().notNull(),
  sessao: smallint("sessao"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertChatThreadSchema = createInsertSchema(chatThreads).pick({
  chatId: true,
  threadId: true,
  diagnostico: true,
  protocolo: true,
  sessao: true,
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  threadId: true,
  content: true,
  sender: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).pick({
  chatId: true,
  threadId: true,
  sessao: true,
  messageId: true,
  sender: true,
  content: true,
  messageType: true,
  audioUrl: true,
  metadata: true,
});

export const insertChatReviewSchema = createInsertSchema(chatReviews).pick({
  chatId: true,
  resumoAtendimento: true,
  feedbackDireto: true,
  sinaisPaciente: true,
  pontosPositivos: true,
  pontosNegativos: true,
  sessao: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type ChatThread = typeof chatThreads.$inferSelect;
export type InsertChatThread = z.infer<typeof insertChatThreadSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatReview = typeof chatReviews.$inferSelect;
export type InsertChatReview = z.infer<typeof insertChatReviewSchema>;
export type ChatReview = typeof chatReviews.$inferSelect;
export type InsertChatReview = z.infer<typeof insertChatReviewSchema>;

// Frontend-only types for localStorage
export type ChatThreadExtended = ChatThread & {
  openaiChatId?: string;
  sessionData?: {
    diagnostico?: string;
    protocolo?: string;
    sessao?: number;
  };
};

export type ChatHistory = {
  threads: ChatThreadExtended[];
  messages: { [threadId: string]: Message[] };
};

export type WebhookRequest = {
  message: string;
  email: string;
  thread?: string;
  chat_id?: string;
  diagnostico?: string;
  protocolo?: string;
};

export type WebhookResponse = {
  output: string;
  thread_id?: string;
};

export type ReviewResponse = {
  resumoAtendimento: string;
  feedbackDireto: string;
  sinaisPaciente: string[][];
  pontosPositivos: string[][];
  pontosNegativos: string[][];
};
