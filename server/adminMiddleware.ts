import type { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import { db } from "./db";
import { userMetadata } from "../shared/schema";
import { eq } from "drizzle-orm";

// Admin emails (fallback if user_metadata doesn't exist)
const ADMIN_EMAILS = ["admin@goflow.digital", "admin@nexialab.com.br", "admin@fernandalandeiro.com.br"];

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
  // Check if email matches any admin email (fastest check first)
  if (userEmail && ADMIN_EMAILS.includes(userEmail)) {
    console.log("[AdminMiddleware] Admin verified by email:", userEmail);
    return true;
  }

  // Check user_metadata table for admin role (with timeout)
  if (db) {
    try {
      // Add timeout to prevent hanging
      const metadataPromise = db
        .select()
        .from(userMetadata)
        .where(eq(userMetadata.userId, userId))
        .limit(1);

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("Database query timeout")), 5000);
      });

      const metadata = await Promise.race([metadataPromise, timeoutPromise]);

      if (metadata.length > 0 && metadata[0].role === "admin") {
        console.log("[AdminMiddleware] Admin verified by metadata for user:", userId);
        return true;
      }
    } catch (error: any) {
      // If timeout or other error, log but don't block
      console.error("[AdminMiddleware] Error checking user metadata:", error?.message || error);
      // If it's a timeout, we'll fall through to return false
      // But we already checked email above, so if email matches, we would have returned true
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

    // Verify token with Supabase (with timeout)
    const getUserPromise = supabase.auth.getUser(token);
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Token verification timeout")), 10000);
    });

    let user: any = null;
    let error: any = null;
    try {
      const result = await Promise.race([getUserPromise, timeoutPromise]);
      user = result.data?.user;
      error = result.error;
    } catch (timeoutError: any) {
      console.error("[AdminMiddleware] Token verification timeout:", timeoutError?.message);
      res.status(504).json({ error: "Timeout ao verificar autenticação. Tente novamente." });
      return;
    }

    if (error || !user) {
      console.log("[AdminMiddleware] Invalid token:", error?.message);
      res.status(401).json({ error: "Token inválido ou expirado" });
      return;
    }

    console.log("[AdminMiddleware] User authenticated:", user.email);

    // Check if user is admin (with timeout)
    const isAdminCheckPromise = isUserAdmin(user.id, user.email);
    const adminTimeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Admin check timeout")), 6000);
    });

    let isAdminUser: boolean;
    try {
      isAdminUser = await Promise.race([isAdminCheckPromise, adminTimeoutPromise]);
    } catch (timeoutError: any) {
      console.error("[AdminMiddleware] Admin check timeout:", timeoutError?.message);
      // If email matches admin list, allow access even if DB check times out
      if (user.email && ADMIN_EMAILS.includes(user.email)) {
        console.log("[AdminMiddleware] Admin access granted by email (DB timeout):", user.email);
        isAdminUser = true;
      } else {
        res.status(504).json({ error: "Timeout ao verificar permissões. Tente novamente." });
        return;
      }
    }

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
    console.error("[AdminMiddleware] Error:", error?.message || error);
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




