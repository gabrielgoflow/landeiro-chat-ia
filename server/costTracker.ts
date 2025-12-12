import { AdminService } from "./adminService.js";
import { db } from "./db";
import { userChats, chatThreads, sessionCosts } from "../shared/schema";
import { eq } from "drizzle-orm";

/**
 * Estimate cost based on message length (rough estimation)
 * This is a placeholder - in production, you'd get actual costs from the AI service
 */
function estimateCost(inputTokens?: number, outputTokens?: number): number {
  // Rough estimation: $0.002 per 1K input tokens, $0.006 per 1K output tokens (GPT-4 pricing example)
  // Adjust these values based on your actual AI service pricing
  const inputCostPer1K = 0.002;
  const outputCostPer1K = 0.006;

  const inputCost = inputTokens ? (inputTokens / 1000) * inputCostPer1K : 0;
  const outputCost = outputTokens ? (outputTokens / 1000) * outputCostPer1K : 0;

  return inputCost + outputCost;
}

/**
 * Estimate tokens from text (rough estimation: ~4 characters per token)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Track cost for a chat interaction
 */
export async function trackSessionCost(
  chatId: string,
  userId: string,
  sessao: number,
  userMessage: string,
  aiResponse: string,
  actualCost?: number,
  actualTokensInput?: number,
  actualTokensOutput?: number
): Promise<void> {
  try {
    if (!db) {
      console.warn("Database not connected, skipping cost tracking");
      return;
    }

    // Calculate or use provided tokens
    const tokensInput = actualTokensInput || estimateTokens(userMessage);
    const tokensOutput = actualTokensOutput || estimateTokens(aiResponse);

    // Calculate or use provided cost
    const costAmount = actualCost !== undefined
      ? actualCost
      : estimateCost(tokensInput, tokensOutput);

    // Check if cost record already exists for this session
    const existingCost = await db
      .select()
      .from(sessionCosts)
      .where(eq(sessionCosts.chatId, chatId))
      .limit(1);

    if (existingCost.length > 0) {
      // Update existing cost record
      const currentCost = Number(existingCost[0].costAmount || 0);
      const currentTokensInput = existingCost[0].tokensInput || 0;
      const currentTokensOutput = existingCost[0].tokensOutput || 0;
      const currentApiCalls = existingCost[0].apiCalls || 0;

      await db
        .update(sessionCosts)
        .set({
          costAmount: (currentCost + costAmount).toString(),
          tokensInput: (currentTokensInput + tokensInput),
          tokensOutput: (currentTokensOutput + tokensOutput),
          apiCalls: currentApiCalls + 1,
          costBreakdown: {
            ...(existingCost[0].costBreakdown as object || {}),
            [new Date().toISOString()]: {
              cost: costAmount,
              tokensInput,
              tokensOutput,
            },
          },
          updatedAt: new Date(),
        })
        .where(eq(sessionCosts.chatId, chatId));
    } else {
      // Create new cost record
      await AdminService.createSessionCost({
        chatId,
        userId,
        sessao,
        costAmount: costAmount.toString(),
        tokensInput,
        tokensOutput,
        apiCalls: 1,
        costBreakdown: {
          [new Date().toISOString()]: {
            cost: costAmount,
            tokensInput,
            tokensOutput,
          },
        },
      });
    }
  } catch (error) {
    // Don't fail the request if cost tracking fails
    console.error("Error tracking session cost:", error);
  }
}

/**
 * Get user ID from chat ID
 */
async function getUserIdFromChatId(chatId: string): Promise<string | null> {
  if (!db) return null;

  try {
    const result = await db
      .select({ userId: userChats.userId })
      .from(userChats)
      .where(eq(userChats.chatId, chatId))
      .limit(1);

    return result[0]?.userId || null;
  } catch (error) {
    console.error("Error getting user ID from chat ID:", error);
    return null;
  }
}

/**
 * Get session number from chat ID
 */
async function getSessaoFromChatId(chatId: string): Promise<number> {
  if (!db) return 1;

  try {
    const result = await db
      .select({ sessao: chatThreads.sessao })
      .from(chatThreads)
      .where(eq(chatThreads.chatId, chatId))
      .limit(1);

    return result[0]?.sessao || 1;
  } catch (error) {
    console.error("Error getting sessao from chat ID:", error);
    return 1;
  }
}

/**
 * Track cost for a chat message interaction
 */
export async function trackChatCost(
  chatId: string,
  userMessage: string,
  aiResponse: string,
  actualCost?: number,
  actualTokensInput?: number,
  actualTokensOutput?: number
): Promise<void> {
  try {
    const userId = await getUserIdFromChatId(chatId);
    if (!userId) {
      console.warn(`User ID not found for chat ${chatId}, skipping cost tracking`);
      return;
    }

    const sessao = await getSessaoFromChatId(chatId);
    await trackSessionCost(
      chatId,
      userId,
      sessao,
      userMessage,
      aiResponse,
      actualCost,
      actualTokensInput,
      actualTokensOutput
    );
  } catch (error) {
    console.error("Error in trackChatCost:", error);
  }
}

