import { db } from "./db";
import { diagnosticos, userMetadata, chatThreads, userChats } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

export class AccessValidator {
  /**
   * Verifica se o usuário pode acessar um diagnóstico específico
   * Valida apenas: se o transtorno está ativo e se a data final de acesso é válida
   */
  static async canUserAccessDiagnostico(
    userId: string,
    diagnosticoCodigo: string
  ): Promise<{ canAccess: boolean; reason?: string }> {
    if (!db) {
      throw new Error("Database not connected");
    }

    try {
      // 1. Verificar se o diagnóstico existe e está ativo
      const diagnostico = await db
        .select()
        .from(diagnosticos)
        .where(eq(diagnosticos.codigo, diagnosticoCodigo))
        .limit(1);

      if (!diagnostico || diagnostico.length === 0) {
        return {
          canAccess: false,
          reason: "Diagnóstico não encontrado",
        };
      }

      if (!diagnostico[0].ativo) {
        return {
          canAccess: false,
          reason: "Diagnóstico não está ativo",
        };
      }

      // 2. Verificar data final de acesso do usuário
      // Se o transtorno está ativo, ele já está liberado para todos
      // A única validação necessária é a data final de acesso
      const metadata = await db
        .select()
        .from(userMetadata)
        .where(eq(userMetadata.userId, userId))
        .limit(1);

      if (metadata && metadata.length > 0 && metadata[0].dataFinalAcesso) {
        const dataFinal = new Date(metadata[0].dataFinalAcesso);
        const agora = new Date();

        if (agora > dataFinal) {
          return {
            canAccess: false,
            reason: "Data final de acesso expirada",
          };
        }
      }

      // 3. Verificar se o usuário já possui um chat para este diagnóstico
      // Buscar threads do usuário com este diagnóstico
      const existingChats = await db
        .select({
          threadId: chatThreads.threadId,
          maxSessao: sql<number>`max(${chatThreads.sessao})`,
        })
        .from(chatThreads)
        .innerJoin(userChats, eq(chatThreads.chatId, userChats.chatId))
        .where(
          and(
            eq(userChats.userId, userId),
            eq(chatThreads.diagnostico, diagnosticoCodigo)
          )
        )
        .groupBy(chatThreads.threadId);

      // Se já existe um chat para este diagnóstico
      if (existingChats && existingChats.length > 0) {
        // Verificar se já atingiu o máximo de 10 sessões
        const maxSessao = existingChats[0].maxSessao || 0;
        if (maxSessao >= 10) {
          return {
            canAccess: false,
            reason: "Limite de 10 sessões atingido para este diagnóstico",
          };
        }
        
        return {
          canAccess: false,
          reason: "Você já possui um chat para este diagnóstico. Cada usuário pode ter apenas 1 chat por diagnóstico.",
        };
      }

      // Se chegou aqui, o transtorno está ativo, a data de acesso é válida e não existe chat para este diagnóstico
      return { canAccess: true };
    } catch (error: any) {
      console.error("Error validating access:", error);
      return {
        canAccess: false,
        reason: `Erro ao validar acesso: ${error.message}`,
      };
    }
  }

  /**
   * Verifica se a data final de acesso do usuário é válida
   */
  static async isUserAccessValid(userId: string): Promise<boolean> {
    if (!db) {
      throw new Error("Database not connected");
    }

    try {
      const metadata = await db
        .select()
        .from(userMetadata)
        .where(eq(userMetadata.userId, userId))
        .limit(1);

      if (!metadata || metadata.length === 0 || !metadata[0].dataFinalAcesso) {
        // Se não tem data definida, permite acesso (comportamento padrão)
        return true;
      }

      const dataFinal = new Date(metadata[0].dataFinalAcesso);
      const agora = new Date();

      return agora <= dataFinal;
    } catch (error: any) {
      console.error("Error checking user access:", error);
      return false;
    }
  }
}

