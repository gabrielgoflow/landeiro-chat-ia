import type { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import { db } from "./db";
import { userMetadata } from "../shared/schema";
import { eq } from "drizzle-orm";

// Admin email (fallback if user_metadata doesn't exist)
const ADMIN_EMAIL = "admin@goflow.digital";

/**
 * Get Supabase client for auth verification
 */
function getSupabaseAuthClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Extract JWT token from Authorization header
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Verify if user is admin
 */
async function isUserAdmin(userId: string, userEmail?: string): Promise<boolean> {
  // Check if email matches admin email
  if (userEmail === ADMIN_EMAIL) {
    return true;
  }

  // Check user_metadata table for admin role
  if (db) {
    try {
      const metadata = await db
        .select()
        .from(userMetadata)
        .where(eq(userMetadata.userId, userId))
        .limit(1);

      if (metadata.length > 0 && metadata[0].role === "admin") {
        return true;
      }
    } catch (error) {
      console.error("Error checking user metadata:", error);
    }
  }

  return false;
}

/**
 * Middleware to verify admin authentication
 */
export async function isAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    console.log("[AdminMiddleware] Checking admin access for:", req.path);
    const token = extractToken(req);

    if (!token) {
      console.log("[AdminMiddleware] No token provided");
      res.status(401).json({ error: "Token de autenticação não fornecido" });
      return;
    }

    const supabase = getSupabaseAuthClient();
    if (!supabase) {
      console.error("[AdminMiddleware] Supabase not configured");
      res.status(500).json({ error: "Configuração do Supabase não encontrada" });
      return;
    }

    // Verify token with Supabase
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.log("[AdminMiddleware] Invalid token:", error?.message);
      res.status(401).json({ error: "Token inválido ou expirado" });
      return;
    }

    console.log("[AdminMiddleware] User authenticated:", user.email);

    // Check if user is admin
    const isAdminUser = await isUserAdmin(user.id, user.email);

    if (!isAdminUser) {
      console.log("[AdminMiddleware] User is not admin:", user.email);
      res.status(403).json({ error: "Acesso negado. Apenas administradores podem acessar esta rota." });
      return;
    }

    console.log("[AdminMiddleware] Admin access granted for:", user.email);

    // Attach user info to request
    (req as any).user = user;
    (req as any).isAdmin = true;

    next();
  } catch (error: any) {
    console.error("[AdminMiddleware] Error:", error);
    res.status(500).json({ error: "Erro ao verificar autenticação" });
  }
}

/**
 * Middleware to verify authentication (not necessarily admin)
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req);

    if (!token) {
      res.status(401).json({ error: "Token de autenticação não fornecido" });
      return;
    }

    const supabase = getSupabaseAuthClient();
    if (!supabase) {
      res.status(500).json({ error: "Configuração do Supabase não encontrada" });
      return;
    }

    // Verify token with Supabase
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      res.status(401).json({ error: "Token inválido ou expirado" });
      return;
    }

    // Attach user info to request
    (req as any).user = user;

    next();
  } catch (error: any) {
    console.error("Error in auth middleware:", error);
    res.status(500).json({ error: "Erro ao verificar autenticação" });
  }
}




