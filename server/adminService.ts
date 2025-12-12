import { db, client } from "./db";
import { sql, eq, and, desc, asc, gte, lte, or, like, inArray } from "drizzle-orm";
import {
  userMetadata,
  sessionCosts,
  auditLogs,
  chatMessages,
  chatThreads,
  userChats,
  chatReviews,
  diagnosticos,
  userDiagnosticos,
  InsertSessionCost,
  InsertAuditLog,
  InsertUserMetadata,
  InsertDiagnostico,
  InsertUserDiagnostico,
} from "@shared/schema";
import type { UserMetadata, SessionCost, AuditLog, Diagnostico, UserDiagnostico } from "@shared/schema";
import { createClient } from "@supabase/supabase-js";

/**
 * Get Supabase Admin Client
 */
function getSupabaseAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase configuration not found");
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export class AdminService {
  /**
   * Get all users with pagination from Supabase Auth
   */
  static async getUsers(page: number = 1, limit: number = 50, search?: string) {
    try {
      console.log("[AdminService] Getting users, page:", page, "limit:", limit, "search:", search);
      
      const supabase = getSupabaseAdminClient();
      
      // Use Supabase Admin API to list users
      // Note: Supabase Admin API pagination works differently
      const perPage = 1000; // Fetch a large batch to filter/search
      const usersResponse = await supabase.auth.admin.listUsers({
        page: 1,
        perPage,
      });

      console.log("[AdminService] Supabase response:", {
        error: usersResponse.error?.message,
        usersCount: usersResponse.data?.users?.length || 0,
      });

      if (usersResponse.error) {
        console.error("[AdminService] Supabase error:", usersResponse.error);
        throw new Error(usersResponse.error.message);
      }

      let authUsers = usersResponse.data?.users || [];
      
      // Filter by search term if provided
      if (search) {
        const searchLower = search.toLowerCase();
        authUsers = authUsers.filter(
          (user) =>
            user.email?.toLowerCase().includes(searchLower) ||
            user.id.toLowerCase().includes(searchLower) ||
            user.user_metadata?.full_name?.toLowerCase().includes(searchLower)
        );
      }

      // Apply pagination after filtering
      const offset = (page - 1) * limit;
      const paginatedUsers = authUsers.slice(offset, offset + limit);
      const totalUsers = authUsers.length;

      console.log("[AdminService] Found", paginatedUsers.length, "users (total:", totalUsers, ")");

      // Get user metadata from our database
      const userIds = paginatedUsers.map((u) => u.id);
      let metadataMap = new Map();
      
      if (db && userIds.length > 0) {
        const metadata = await db
          .select()
          .from(userMetadata)
          .where(inArray(userMetadata.userId, userIds));
        
        metadata.forEach((m) => {
          metadataMap.set(m.userId, m);
        });
      }

      // Combine auth users with metadata
      const users = paginatedUsers.map((authUser) => {
        const metadata = metadataMap.get(authUser.id);
        return {
          userId: authUser.id,
          email: authUser.email,
          fullName: metadata?.fullName || authUser.user_metadata?.full_name || null,
          role: metadata?.role || "user",
          createdAt: authUser.created_at,
          lastSignIn: authUser.last_sign_in_at,
          emailConfirmed: authUser.email_confirmed_at !== null,
        };
      });

      console.log("[AdminService] Returning", users.length, "users, total:", totalUsers);

      return {
        users,
        total: totalUsers,
        page,
        limit,
        totalPages: Math.ceil(totalUsers / limit),
      };
    } catch (error: any) {
      console.error("Error getting users from Supabase Auth:", error);
      throw new Error(`Failed to get users: ${error.message}`);
    }
  }

  /**
   * Get user details by ID
   */
  static async getUserDetails(userId: string) {
    if (!db) throw new Error("Database not connected");

    try {
      // Get user from Supabase Auth
      const supabase = getSupabaseAdminClient();
      const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId);

      if (authError) {
        throw new Error(authError.message);
      }

      // Get user metadata from our database
      const metadata = await db
        .select()
        .from(userMetadata)
        .where(eq(userMetadata.userId, userId))
        .limit(1);

      // Get user sessions
      const sessions = await db
        .select({
          chatId: userChats.chatId,
          createdAt: userChats.createdAt,
        })
        .from(userChats)
        .where(eq(userChats.userId, userId));

      // Get user messages count
      const messagesCount = await db
        .select({
          count: sql<number>`count(*)`,
        })
        .from(chatMessages)
        .innerJoin(userChats, eq(chatMessages.chatId, userChats.chatId))
        .where(eq(userChats.userId, userId));

      // Get total cost
      const totalCost = await db
        .select({
          sum: sql<number>`coalesce(sum(${sessionCosts.costAmount}), 0)`,
        })
        .from(sessionCosts)
        .where(eq(sessionCosts.userId, userId));

      // Get sessions count by diagnostico
      const sessionsByDiagnostico = await db
        .select({
          diagnostico: chatThreads.diagnostico,
          count: sql<number>`count(*)`,
        })
        .from(chatThreads)
        .innerJoin(userChats, eq(chatThreads.chatId, userChats.chatId))
        .where(eq(userChats.userId, userId))
        .groupBy(chatThreads.diagnostico);

      return {
        authUser: {
          id: authUser.user.id,
          email: authUser.user.email,
          createdAt: authUser.user.created_at,
          lastSignIn: authUser.user.last_sign_in_at,
          emailConfirmed: authUser.user.email_confirmed_at !== null,
        },
        metadata: metadata[0] || null,
        sessions: sessions.length,
        messagesCount: Number(messagesCount[0]?.count || 0),
        totalCost: Number(totalCost[0]?.sum || 0),
        sessionsByDiagnostico: sessionsByDiagnostico.map((s) => ({
          diagnostico: s.diagnostico || "N/A",
          count: Number(s.count),
        })),
      };
    } catch (error: any) {
      console.error("Error getting user details:", error);
      throw new Error(`Failed to get user details: ${error.message}`);
    }
  }

  /**
   * Get all sessions with filters
   */
  static async getSessions(
    page: number = 1,
    limit: number = 50,
    filters?: {
      userId?: string;
      diagnostico?: string;
      userEmail?: string;
      startDate?: string;
      endDate?: string;
    }
  ) {
    if (!db) throw new Error("Database not connected");

    const offset = (page - 1) * limit;

    // If filtering by email, we need to get user IDs from Supabase Auth first
    let userIdsToFilter: string[] | undefined = undefined;
    if (filters?.userEmail) {
      console.log("[AdminService] Filtering by email:", filters.userEmail);
      const supabase = getSupabaseAdminClient();
      const { data: usersData, error } = await supabase.auth.admin.listUsers();
      
      if (error) {
        console.error("[AdminService] Error fetching users:", error);
        throw new Error(`Failed to fetch users: ${error.message}`);
      }
      
      const matchingUserIds = usersData?.users
        .filter((u) => u.email?.toLowerCase().includes(filters.userEmail!.toLowerCase()))
        .map((u) => u.id) || [];

      console.log("[AdminService] Found", matchingUserIds.length, "users matching email");

      if (matchingUserIds.length === 0) {
        // No users found with this email, return empty result
        console.log("[AdminService] No users found, returning empty result");
        return {
          sessions: [],
          total: 0,
          page,
          limit,
        };
      }
      
      userIdsToFilter = matchingUserIds;
    }

    // Use Drizzle ORM but add email via subquery or separate fetch
    // First, get sessions with Drizzle
    let query = db
      .select({
        chatId: chatThreads.chatId,
        threadId: chatThreads.threadId,
        sessao: chatThreads.sessao,
        diagnostico: chatThreads.diagnostico,
        protocolo: chatThreads.protocolo,
        createdAt: chatThreads.createdAt,
        userId: userChats.userId,
        status: sql<string>`CASE WHEN ${chatReviews.id} IS NOT NULL THEN 'finalizado' ELSE 'em_andamento' END`,
      })
      .from(chatThreads)
      .leftJoin(userChats, eq(chatThreads.chatId, userChats.chatId))
      .leftJoin(chatReviews, eq(chatThreads.chatId, chatReviews.chatId));

    const conditions = [];

    // Apply user filters - email filter takes precedence if both are provided
    if (userIdsToFilter) {
      conditions.push(inArray(userChats.userId, userIdsToFilter));
    } else if (filters?.userId) {
      conditions.push(eq(userChats.userId, filters.userId));
    }

    if (filters?.diagnostico) {
      conditions.push(eq(chatThreads.diagnostico, filters.diagnostico));
    }

    if (filters?.startDate) {
      conditions.push(gte(chatThreads.createdAt, new Date(filters.startDate)));
    }

    if (filters?.endDate) {
      conditions.push(lte(chatThreads.createdAt, new Date(filters.endDate)));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const sessions = await query
      .orderBy(desc(chatThreads.createdAt))
      .limit(limit)
      .offset(offset);

    console.log("[AdminService] Found", sessions.length, "sessions");

    // Get user emails directly from database using SQL query with auth.users
    const uniqueUserIds = Array.from(new Set(sessions.map((s) => s.userId).filter((id): id is string => Boolean(id))));
    const userEmailMap = new Map<string, string>();
    
    if (uniqueUserIds.length > 0 && client) {
      try {
        // Use postgres.js template literal syntax with ANY for array
        const emailQuery = await client`
          SELECT id, email 
          FROM auth.users 
          WHERE id = ANY(${uniqueUserIds}::uuid[])
        `;
        
        if (Array.isArray(emailQuery)) {
          emailQuery.forEach((row: any) => {
            if (row.id && row.email) {
              userEmailMap.set(row.id, row.email);
            }
          });
          console.log(`[AdminService] Mapped ${userEmailMap.size} user emails from database`);
        }
      } catch (error: any) {
        console.error("[AdminService] Error fetching emails from database:", error);
        // Fallback to Supabase Admin API if direct SQL fails
        try {
          const supabase = getSupabaseAdminClient();
          const { data: usersData } = await supabase.auth.admin.listUsers();
          if (usersData?.users) {
            usersData.users.forEach((user) => {
              if (uniqueUserIds.includes(user.id) && user.email) {
                userEmailMap.set(user.id, user.email);
              }
            });
            console.log(`[AdminService] Mapped ${userEmailMap.size} user emails from Supabase Admin API (fallback)`);
          }
        } catch (fallbackError: any) {
          console.error("[AdminService] Fallback also failed:", fallbackError);
        }
      }
    }

    // Enrich sessions with user email
    const sessionsWithEmail = sessions.map((session) => {
      const email = session.userId 
        ? (userEmailMap.get(session.userId) || "Email não encontrado") 
        : "Usuário não vinculado";
      console.log(`[AdminService] Session ${session.chatId}: userId=${session.userId}, email=${email}, mapSize=${userEmailMap.size}`);
      const enriched = {
        ...session,
        userEmail: email,
      };
      console.log(`[AdminService] Enriched session:`, JSON.stringify(enriched, null, 2));
      return enriched;
    });

    // Get total count (simplified for now)
    const totalCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(chatThreads)
      .leftJoin(userChats, eq(chatThreads.chatId, userChats.chatId));

    console.log(`[AdminService] Returning ${sessionsWithEmail.length} sessions with emails`);
    if (sessionsWithEmail.length > 0) {
      console.log(`[AdminService] First session in response:`, JSON.stringify(sessionsWithEmail[0], null, 2));
    }

    return {
      sessions: sessionsWithEmail,
      total: sessions.length,
      page,
      limit,
    };
  }

  /**
   * Get session details
   */
  static async getSessionDetails(chatId: string) {
    if (!db) throw new Error("Database not connected");

    const session = await db
      .select()
      .from(chatThreads)
      .where(eq(chatThreads.chatId, chatId))
      .limit(1);

    if (!session[0]) {
      return null;
    }

    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.chatId, chatId))
      .orderBy(chatMessages.createdAt);

    const review = await db
      .select()
      .from(chatReviews)
      .where(eq(chatReviews.chatId, chatId))
      .limit(1);

    const cost = await db
      .select()
      .from(sessionCosts)
      .where(eq(sessionCosts.chatId, chatId))
      .limit(1);

    return {
      session: session[0],
      messages: messages.length,
      review: review[0] || null,
      cost: cost[0] || null,
    };
  }

  /**
   * Get session messages
   */
  static async getSessionMessages(chatId: string) {
    if (!db) throw new Error("Database not connected");

    return await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.chatId, chatId))
      .orderBy(chatMessages.createdAt);
  }

  /**
   * Get all costs with filters
   */
  static async getCosts(
    page: number = 1,
    limit: number = 50,
    userId?: string,
    startDate?: string,
    endDate?: string
  ) {
    if (!db) throw new Error("Database not connected");

    const offset = (page - 1) * limit;

    let query = db.select().from(sessionCosts);

    const conditions = [];

    if (userId) {
      conditions.push(eq(sessionCosts.userId, userId));
    }

    if (startDate) {
      conditions.push(gte(sessionCosts.createdAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(sessionCosts.createdAt, new Date(endDate)));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const costs = await query
      .orderBy(desc(sessionCosts.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total cost
    const totalCost = await db
      .select({
        sum: sql<number>`coalesce(sum(${sessionCosts.costAmount}), 0)`,
      })
      .from(sessionCosts);

    return {
      costs,
      total: costs.length,
      totalCost: Number(totalCost[0]?.sum || 0),
      page,
      limit,
    };
  }

  /**
   * Get cost summary
   */
  static async getCostSummary(userId?: string, startDate?: string, endDate?: string) {
    if (!db) throw new Error("Database not connected");

    let query = db
      .select({
        totalCost: sql<number>`coalesce(sum(${sessionCosts.costAmount}), 0)`,
        totalSessions: sql<number>`count(distinct ${sessionCosts.chatId})`,
        totalApiCalls: sql<number>`sum(${sessionCosts.apiCalls})`,
        totalTokensInput: sql<number>`coalesce(sum(${sessionCosts.tokensInput}), 0)`,
        totalTokensOutput: sql<number>`coalesce(sum(${sessionCosts.tokensOutput}), 0)`,
      })
      .from(sessionCosts);

    const conditions = [];

    if (userId) {
      conditions.push(eq(sessionCosts.userId, userId));
    }

    if (startDate) {
      conditions.push(gte(sessionCosts.createdAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(sessionCosts.createdAt, new Date(endDate)));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const summary = await query;

    return summary[0] || {
      totalCost: 0,
      totalSessions: 0,
      totalApiCalls: 0,
      totalTokensInput: 0,
      totalTokensOutput: 0,
    };
  }

  /**
   * Create session cost
   */
  static async createSessionCost(cost: InsertSessionCost): Promise<SessionCost> {
    if (!db) throw new Error("Database not connected");

    const result = await db.insert(sessionCosts).values(cost).returning();
    return result[0];
  }

  /**
   * Get system statistics
   */
  static async getSystemStats() {
    if (!db) throw new Error("Database not connected");

    try {
      const [
        totalUsers,
        totalSessions,
        totalMessages,
        totalCost,
      ] = await Promise.all([
        db.select({ count: sql<number>`count(distinct ${userMetadata.userId})` }).from(userMetadata),
        db.select({ count: sql<number>`count(*)` }).from(chatThreads),
        db.select({ count: sql<number>`count(*)` }).from(chatMessages),
        db.select({ sum: sql<number>`coalesce(sum(${sessionCosts.costAmount}), 0)` }).from(sessionCosts),
      ]);

      return {
        totalUsers: Number(totalUsers[0]?.count || 0),
        totalSessions: Number(totalSessions[0]?.count || 0),
        totalMessages: Number(totalMessages[0]?.count || 0),
        totalCost: Number(totalCost[0]?.sum || 0),
      };
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || "";
      console.error("Error in getSystemStats:", {
        error: errorMessage,
        errorType: error?.name || "Unknown"
      });
      
      // Detectar erros de autenticação ou conexão transitórios
      if (errorMessage.includes("authentication") ||
          errorMessage.includes("password authentication failed") ||
          errorMessage.includes("JWT") ||
          errorMessage.includes("connection") ||
          errorMessage.includes("ECONNREFUSED") ||
          errorMessage.includes("timeout")) {
        throw new Error("Erro temporário de conexão com o banco de dados");
      }
      
      throw error;
    }
  }

  /**
   * Get user statistics
   */
  static async getUserStats(userId: string) {
    if (!db) throw new Error("Database not connected");

    const [
      sessions,
      messages,
      cost,
    ] = await Promise.all([
      db
        .select({ count: sql<number>`count(distinct ${userChats.chatId})` })
        .from(userChats)
        .where(eq(userChats.userId, userId)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(chatMessages)
        .innerJoin(userChats, eq(chatMessages.chatId, userChats.chatId))
        .where(eq(userChats.userId, userId)),
      db
        .select({ sum: sql<number>`coalesce(sum(${sessionCosts.costAmount}), 0)` })
        .from(sessionCosts)
        .where(eq(sessionCosts.userId, userId)),
    ]);

    return {
      sessions: Number(sessions[0]?.count || 0),
      messages: Number(messages[0]?.count || 0),
      cost: Number(cost[0]?.sum || 0),
    };
  }

  /**
   * Get usage history
   */
  static async getUsageHistory(
    page: number = 1,
    limit: number = 50,
    userId?: string,
    startDate?: string,
    endDate?: string
  ) {
    if (!db) throw new Error("Database not connected");

    const offset = (page - 1) * limit;

    let query = db
      .select({
        chatId: chatMessages.chatId,
        userId: userChats.userId,
        sender: chatMessages.sender,
        messageType: chatMessages.messageType,
        createdAt: chatMessages.createdAt,
      })
      .from(chatMessages)
      .innerJoin(userChats, eq(chatMessages.chatId, userChats.chatId));

    const conditions = [];

    if (userId) {
      conditions.push(eq(userChats.userId, userId));
    }

    if (startDate) {
      conditions.push(gte(chatMessages.createdAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(chatMessages.createdAt, new Date(endDate)));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    const history = await query
      .orderBy(desc(chatMessages.createdAt))
      .limit(limit)
      .offset(offset);

    return {
      history,
      total: history.length,
      page,
      limit,
    };
  }

  /**
   * Export messages for audit
   */
  static async exportMessages(
    userId?: string,
    chatId?: string,
    startDate?: string,
    endDate?: string
  ) {
    if (!db) throw new Error("Database not connected");

    let query = db
      .select({
        id: chatMessages.id,
        chatId: chatMessages.chatId,
        threadId: chatMessages.threadId,
        sessao: chatMessages.sessao,
        sender: chatMessages.sender,
        content: chatMessages.content,
        messageType: chatMessages.messageType,
        audioUrl: chatMessages.audioUrl,
        createdAt: chatMessages.createdAt,
        userId: userChats.userId,
      })
      .from(chatMessages)
      .innerJoin(userChats, eq(chatMessages.chatId, userChats.chatId));

    const conditions = [];

    if (userId) {
      conditions.push(eq(userChats.userId, userId));
    }

    if (chatId) {
      conditions.push(eq(chatMessages.chatId, chatId));
    }

    if (startDate) {
      conditions.push(gte(chatMessages.createdAt, new Date(startDate)));
    }

    if (endDate) {
      conditions.push(lte(chatMessages.createdAt, new Date(endDate)));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return await query.orderBy(chatMessages.createdAt);
  }

  /**
   * Create audit log
   */
  static async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    if (!db) throw new Error("Database not connected");

    const result = await db.insert(auditLogs).values(log).returning();
    return result[0];
  }

  /**
   * Update user metadata
   */
  static async updateUserMetadata(userId: string, metadata: Partial<InsertUserMetadata>) {
    if (!db) throw new Error("Database not connected");

    const result = await db
      .update(userMetadata)
      .set({ ...metadata, updatedAt: new Date() })
      .where(eq(userMetadata.userId, userId))
      .returning();

    return result[0];
  }

  /**
   * Get all diagnosticos
   */
  static async getDiagnosticos() {
    if (!db) throw new Error("Database not connected");

    return await db
      .select()
      .from(diagnosticos)
      .orderBy(diagnosticos.nome);
  }

  /**
   * Update diagnostico (activate/deactivate)
   */
  static async updateDiagnostico(id: string, data: { ativo?: boolean }) {
    if (!db) throw new Error("Database not connected");

    const result = await db
      .update(diagnosticos)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(diagnosticos.id, id))
      .returning();

    return result[0];
  }

  /**
   * Get user diagnosticos (liberated diagnosticos for a user)
   */
  static async getUserDiagnosticos(userId: string) {
    if (!db) throw new Error("Database not connected");

    return await db
      .select({
        id: userDiagnosticos.id,
        userId: userDiagnosticos.userId,
        diagnosticoId: userDiagnosticos.diagnosticoId,
        liberadoEm: userDiagnosticos.liberadoEm,
        createdAt: userDiagnosticos.createdAt,
        diagnostico: {
          id: diagnosticos.id,
          nome: diagnosticos.nome,
          codigo: diagnosticos.codigo,
          ativo: diagnosticos.ativo,
        },
      })
      .from(userDiagnosticos)
      .innerJoin(diagnosticos, eq(userDiagnosticos.diagnosticoId, diagnosticos.id))
      .where(eq(userDiagnosticos.userId, userId));
  }

  /**
   * Liberate diagnostico for user
   */
  static async liberarDiagnostico(userId: string, diagnosticoId: string) {
    if (!db) throw new Error("Database not connected");

    // Check if already liberated
    const existing = await db
      .select()
      .from(userDiagnosticos)
      .where(
        and(
          eq(userDiagnosticos.userId, userId),
          eq(userDiagnosticos.diagnosticoId, diagnosticoId)
        )
      )
      .limit(1);

    if (existing && existing.length > 0) {
      return existing[0];
    }

    const result = await db
      .insert(userDiagnosticos)
      .values({
        userId: userId,
        diagnosticoId: diagnosticoId,
      })
      .returning();

    return result[0];
  }

  /**
   * Update user access date
   */
  static async updateUserAccessDate(userId: string, dataFinalAcesso: Date) {
    if (!db) throw new Error("Database not connected");

    // Check if user metadata exists
    const existing = await db
      .select()
      .from(userMetadata)
      .where(eq(userMetadata.userId, userId))
      .limit(1);

    if (existing && existing.length > 0) {
      // Update existing
      const result = await db
        .update(userMetadata)
        .set({ dataFinalAcesso, updatedAt: new Date() })
        .where(eq(userMetadata.userId, userId))
        .returning();

      return result[0];
    } else {
      // Create new
      const result = await db
        .insert(userMetadata)
        .values({
          userId: userId,
          dataFinalAcesso: dataFinalAcesso,
        })
        .returning();

      return result[0];
    }
  }

  /**
   * Get diagnostico statistics (how many users have each diagnostico)
   */
  static async getDiagnosticoStats() {
    if (!db) throw new Error("Database not connected");

    const stats = await db
      .select({
        diagnosticoId: diagnosticos.id,
        nome: diagnosticos.nome,
        codigo: diagnosticos.codigo,
        ativo: diagnosticos.ativo,
        totalUsuarios: sql<number>`count(distinct ${userDiagnosticos.userId})`,
      })
      .from(diagnosticos)
      .leftJoin(userDiagnosticos, eq(diagnosticos.id, userDiagnosticos.diagnosticoId))
      .groupBy(diagnosticos.id, diagnosticos.nome, diagnosticos.codigo, diagnosticos.ativo)
      .orderBy(asc(diagnosticos.nome));

    return stats;
  }
}




