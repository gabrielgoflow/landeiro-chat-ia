import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, uuid, smallint, integer, decimal, boolean } from "drizzle-orm/pg-core";
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
  sessionStartedAt: timestamp("session_started_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userChats = pgTable("user_chats", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull(),
  chatId: varchar("chat_id").notNull(),
  chatThreadsId: uuid("chat_threads_id"),
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
  chatId: varchar("chat_id").notNull(),
  resumoAtendimento: text("resumo_atendimento").notNull(),
  feedbackDireto: text("feedback_direto").notNull(),
  sinaisPaciente: text("sinais_paciente").array().notNull(),
  pontosPositivos: text("pontos_positivos").array().notNull(),
  pontosNegativos: text("pontos_negativos").array().notNull(),
  sessao: smallint("sessao"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sessionCosts = pgTable("session_costs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  chatId: varchar("chat_id").notNull(),
  userId: uuid("user_id").notNull(),
  sessao: integer("sessao").notNull(),
  costAmount: decimal("cost_amount", { precision: 10, scale: 2 }),
  tokensInput: integer("tokens_input"),
  tokensOutput: integer("tokens_output"),
  apiCalls: integer("api_calls").default(0),
  costBreakdown: jsonb("cost_breakdown").default(sql`'{}'`),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userMetadata = pgTable("user_metadata", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull().unique(),
  fullName: varchar("full_name"),
  role: varchar("role").default("user"),
  status: varchar("status").default("ativo"),
  dataFinalAcesso: timestamp("data_final_acesso"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const diagnosticos = pgTable("diagnosticos", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  nome: varchar("nome").notNull(),
  codigo: varchar("codigo").notNull().unique(),
  ativo: boolean("ativo").default(true),
  apenasTeste: boolean("apenas_teste").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const userDiagnosticos = pgTable("user_diagnosticos", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: uuid("user_id").notNull(),
  diagnosticoId: uuid("diagnostico_id").notNull(),
  liberadoEm: timestamp("liberado_em").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  adminUserId: uuid("admin_user_id").notNull(),
  action: varchar("action").notNull(),
  targetUserId: uuid("target_user_id"),
  details: jsonb("details").default(sql`'{}'`),
  createdAt: timestamp("created_at").defaultNow(),
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

export const insertSessionCostSchema = createInsertSchema(sessionCosts).pick({
  chatId: true,
  userId: true,
  sessao: true,
  costAmount: true,
  tokensInput: true,
  tokensOutput: true,
  apiCalls: true,
  costBreakdown: true,
});

export const insertUserMetadataSchema = createInsertSchema(userMetadata).pick({
  userId: true,
  fullName: true,
  role: true,
  status: true,
  dataFinalAcesso: true,
});

export const insertDiagnosticoSchema = createInsertSchema(diagnosticos).pick({
  nome: true,
  codigo: true,
  ativo: true,
  apenasTeste: true,
});

export const insertUserDiagnosticoSchema = createInsertSchema(userDiagnosticos).pick({
  userId: true,
  diagnosticoId: true,
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).pick({
  adminUserId: true,
  action: true,
  targetUserId: true,
  details: true,
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
export type SessionCost = typeof sessionCosts.$inferSelect;
export type InsertSessionCost = z.infer<typeof insertSessionCostSchema>;
export type UserMetadata = typeof userMetadata.$inferSelect;
export type InsertUserMetadata = z.infer<typeof insertUserMetadataSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type Diagnostico = typeof diagnosticos.$inferSelect;
export type InsertDiagnostico = z.infer<typeof insertDiagnosticoSchema>;
export type UserDiagnostico = typeof userDiagnosticos.$inferSelect;
export type InsertUserDiagnostico = z.infer<typeof insertUserDiagnosticoSchema>;

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
