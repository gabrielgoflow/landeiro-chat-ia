import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage.js";
import {
  insertChatReviewSchema,
  insertChatMessageSchema,
  insertSessionCostSchema,
  insertUserMetadataSchema,
} from "../shared/schema";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage.js";
import { ObjectPermission } from "./objectAcl.js";
import { SupabaseStorageService } from "./supabaseStorage.js";
import { isAdmin, requireAuth } from "./adminMiddleware.js";
import { AdminService } from "./adminService.js";
import { AccessValidator } from "./accessValidator.js";
import { trackChatCost } from "./costTracker.js";
import OpenAI from "openai";
import { Readable } from "stream";
import { db, supabaseClient } from "./db.js";
import { sendPasswordResetEmail } from "./emailService.js";
import { randomUUID } from "crypto";
import { sql } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  // Get user status (public endpoint for checking user status)
  app.get("/api/auth/user-status/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const status = await AdminService.getUserStatus(userId);
      res.json({ status });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Password Reset Endpoints
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email || typeof email !== "string" || !email.includes("@")) {
        return res.status(400).json({ error: "Email inválido" });
      }

      // Buscar usuário no Supabase Auth
      if (!supabaseClient) {
        return res.status(500).json({ error: "Serviço de autenticação não configurado" });
      }

      // Verificar se o email existe (sem revelar se existe ou não por segurança)
      const { data: users, error: listError } = await supabaseClient.auth.admin.listUsers();
      
      if (listError) {
        console.error("Erro ao listar usuários:", listError);
        // Por segurança, sempre retornar sucesso mesmo se houver erro
        return res.json({ 
          message: "Se o email existir, você receberá um link de reset de senha" 
        });
      }

      const user = users.users.find((u) => u.email === email.toLowerCase().trim());

      // Sempre retornar sucesso (não revelar se email existe)
      if (!user) {
        console.log(`Tentativa de reset para email não cadastrado: ${email}`);
        return res.json({ 
          message: "Se o email existir, você receberá um link de reset de senha" 
        });
      }

      // Gerar token único
      const token = randomUUID();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1); // Expira em 1 hora

      // Salvar token no banco de dados
      if (!db) {
        return res.status(500).json({ error: "Banco de dados não configurado" });
      }

      await db.execute(sql`
        INSERT INTO password_reset_tokens (user_id, email, token, expires_at)
        VALUES (${user.id}, ${email.toLowerCase().trim()}, ${token}, ${expiresAt.toISOString()})
      `);

      // Construir URL de reset
      const frontendUrl = process.env.VITE_FRONTEND_URL|| 
                         req.headers.origin || 
                         `http://localhost:${process.env.PORT || 5000}`;
      const resetUrl = `${frontendUrl}/reset-password/${token}`;

      // Enviar email
      try {
        await sendPasswordResetEmail(email, resetUrl);
        console.log(`Email de reset enviado para: ${email}`);
      } catch (emailError: any) {
        console.error("Erro ao enviar email:", emailError);
        // Não falhar a requisição se o email falhar (pode ser problema temporário)
      }

      res.json({ 
        message: "Se o email existir, você receberá um link de reset de senha" 
      });
    } catch (error: any) {
      console.error("Erro em /api/auth/forgot-password:", error);
      // Por segurança, sempre retornar sucesso
      res.json({ 
        message: "Se o email existir, você receberá um link de reset de senha" 
      });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "Token é obrigatório" });
      }

      if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
        return res.status(400).json({ 
          error: "A senha deve ter pelo menos 6 caracteres" 
        });
      }

      if (!db || !supabaseClient) {
        return res.status(500).json({ error: "Serviço não configurado" });
      }

      // Buscar token no banco
      const tokenResult = await db.execute(sql`
        SELECT id, user_id, email, expires_at, used_at
        FROM password_reset_tokens
        WHERE token = ${token}
      `);

      if (!tokenResult || (tokenResult as any).length === 0) {
        return res.status(400).json({ error: "Token inválido ou expirado" });
      }

      const tokenData = (tokenResult as any)[0];

      // Verificar se token já foi usado
      if (tokenData.used_at) {
        return res.status(400).json({ error: "Este token já foi usado" });
      }

      // Verificar se token expirou
      const expiresAt = new Date(tokenData.expires_at);
      if (expiresAt < new Date()) {
        return res.status(400).json({ error: "Token expirado" });
      }

      // Atualizar senha no Supabase Auth
      const { error: updateError } = await supabaseClient.auth.admin.updateUserById(
        tokenData.user_id,
        { password: newPassword }
      );

      if (updateError) {
        console.error("Erro ao atualizar senha:", updateError);
        return res.status(500).json({ 
          error: "Erro ao atualizar senha. Tente novamente." 
        });
      }

      // Marcar token como usado
      await db.execute(sql`
        UPDATE password_reset_tokens
        SET used_at = NOW()
        WHERE id = ${tokenData.id}
      `);

      res.json({ 
        message: "Senha redefinida com sucesso" 
      });
    } catch (error: any) {
      console.error("Erro em /api/auth/reset-password:", error);
      res.status(500).json({ 
        error: error.message || "Erro ao redefinir senha" 
      });
    }
  });

  // Chat Reviews
  app.post("/api/reviews", async (req, res) => {
    try {
      console.log("Received review data:", JSON.stringify(req.body, null, 2));
      const reviewData = insertChatReviewSchema.parse(req.body);
      console.log("Parsed review data:", JSON.stringify(reviewData, null, 2));
      const review = await storage.createChatReview(reviewData);
      res.status(201).json(review);
    } catch (error: any) {
      console.error("Error creating review:", error);
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/reviews/:chatId", async (req, res) => {
    try {
      const { chatId } = req.params;
      const review = await storage.getChatReview(chatId);
      if (!review) {
        return res.status(404).json({ error: "Review not found" });
      }
      res.json(review);
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || "";
      console.error("Error in /api/reviews/:chatId:", {
        chatId: req.params.chatId,
        error: errorMessage,
        errorType: error?.name || "Unknown"
      });
      
      // Detectar erros de autenticação, conexão ou circuit breaker transitórios
      if (errorMessage.includes("authentication") ||
          errorMessage.includes("password authentication failed") ||
          errorMessage.includes("JWT") ||
          errorMessage.includes("too many") ||
          errorMessage.includes("connection") ||
          errorMessage.includes("ECONNREFUSED") ||
          errorMessage.includes("timeout") ||
          errorMessage.includes("Circuit breaker") ||
          errorMessage.includes("circuit breaker open")) {
        // Retornar 503 (Service Unavailable) para erros transitórios
        // Permitir que a UI continue funcionando sem o review
        return res.status(503).json({ 
          error: "Serviço temporariamente indisponível",
          message: "Não foi possível buscar o review no momento. A navegação continua disponível.",
          retryAfter: 60 // Sugerir retry após 60 segundos
        });
      }
      
      // Para outros erros, retornar 500
      res.status(500).json({ error: errorMessage });
    }
  });

  // Access Validation
  app.get("/api/access/validate", async (req, res) => {
    try {
      const { userId, diagnosticoCodigo } = req.query;
      if (!userId || !diagnosticoCodigo) {
        return res.status(400).json({ error: "userId and diagnosticoCodigo are required" });
      }
      
      // Validar acesso (o AccessValidator já trata erros internamente)
      const result = await AccessValidator.canUserAccessDiagnostico(
        userId as string,
        diagnosticoCodigo as string
      );
      
      // Se houver erro temporário, retornar 503
      if (!result.canAccess && 
          result.reason?.includes("temporário") || 
          result.reason?.includes("conexão")) {
        return res.status(503).json({
          canAccess: false,
          reason: result.reason,
          retryAfter: 60
        });
      }
      
      res.json(result);
    } catch (error: any) {
      console.error("Error in /api/access/validate:", {
        userId: req.query.userId,
        diagnosticoCodigo: req.query.diagnosticoCodigo,
        error: error?.message || error?.toString(),
        errorType: error?.name || "Unknown"
      });
      
      const errorMessage = error?.message || error?.toString() || "";
      
      // Detectar erros de autenticação ou conexão transitórios
      if (errorMessage.includes("authentication") ||
          errorMessage.includes("password authentication failed") ||
          errorMessage.includes("JWT") ||
          errorMessage.includes("connection") ||
          errorMessage.includes("ECONNREFUSED") ||
          errorMessage.includes("timeout")) {
        return res.status(503).json({
          canAccess: false,
          reason: "Erro temporário de conexão com o banco de dados. Por favor, aguarde alguns instantes e tente novamente.",
          retryAfter: 60
        });
      }
      
      res.status(500).json({ 
        canAccess: false,
        reason: `Erro ao validar acesso: ${errorMessage}`
      });
    }
  });

  // Object Storage Routes for Audio Messages
  // Try Supabase Storage first, fallback to Replit Object Storage
  app.post("/api/objects/upload", async (req, res) => {
    // Check Supabase Storage configuration first
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (supabaseUrl && supabaseServiceKey) {
      try {
        const supabaseStorage = new SupabaseStorageService();
        
        if (supabaseStorage.isConfigured()) {
          console.log("Using Supabase Storage for audio upload");
          // For Supabase, we return a special indicator that the client should upload directly
          // The client will upload the file and we'll return the URL
          res.json({ 
            useSupabase: true,
            bucket: 'audios'
          });
          return;
        }
      } catch (error: any) {
        console.error("Error checking Supabase Storage:", error);
      }
    } else {
      console.log("Supabase Storage not configured. SUPABASE_URL:", supabaseUrl ? "set" : "not set", "SUPABASE_SERVICE_ROLE_KEY:", supabaseServiceKey ? "set" : "not set");
    }
    
    // Fallback to Replit Object Storage (only works in Replit environment)
    try {
      // Check if we're in a Replit environment
      const replitSidecar = process.env.REPLIT_SIDECAR_ENDPOINT || "http://127.0.0.1:1106";
      const privateObjectDir = process.env.PRIVATE_OBJECT_DIR;
      
      if (!privateObjectDir) {
        throw new Error("PRIVATE_OBJECT_DIR not set");
      }
      
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      console.log("Using Replit Object Storage for audio upload");
      res.json({ uploadURL, useSupabase: false });
    } catch (fallbackError: any) {
      console.error("Error getting upload URL from Replit Object Storage:", fallbackError);
      const errorMessage = fallbackError.message || "Failed to get upload URL";
      
      // Check if it's a configuration error or fetch failed (not in Replit)
      if (errorMessage.includes("PRIVATE_OBJECT_DIR") || 
          errorMessage.includes("fetch failed") || 
          errorMessage.includes("not in Replit") ||
          errorMessage.includes("Failed to sign object URL")) {
        res.status(500).json({ 
          error: "Object Storage não configurado. Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no arquivo .env para usar Supabase Storage.",
          code: "STORAGE_NOT_CONFIGURED",
          details: errorMessage,
          suggestion: "Adicione as seguintes variáveis ao arquivo .env na raiz do projeto:\nSUPABASE_URL=https://fnprdocklfpmndailkoo.supabase.co\nSUPABASE_SERVICE_ROLE_KEY=sua_service_role_key"
        });
      } else {
        res.status(500).json({ 
          error: errorMessage,
          code: "UPLOAD_ERROR"
        });
      }
    }
  });

  // New endpoint for Supabase direct upload
  app.post("/api/audio/upload", async (req, res) => {
    try {
      if (!req.body.audioBlob || !req.body.mimeType) {
        return res.status(400).json({ error: "audioBlob and mimeType are required" });
      }

      const supabaseStorage = new SupabaseStorageService();
      
      // Convert base64 to Buffer if needed
      let audioBuffer: Buffer;
      if (typeof req.body.audioBlob === 'string') {
        // Base64 string
        audioBuffer = Buffer.from(req.body.audioBlob, 'base64');
      } else {
        // Already a buffer
        audioBuffer = Buffer.from(req.body.audioBlob);
      }

      const publicUrl = await supabaseStorage.uploadAudio(
        audioBuffer,
        req.body.mimeType
      );

      res.json({ audioURL: publicUrl, objectPath: publicUrl });
    } catch (error: any) {
      console.error("Error uploading audio to Supabase:", error);
      res.status(500).json({ error: error.message || "Failed to upload audio" });
    }
  });

  app.post("/api/audio-messages", async (req, res) => {
    if (!req.body.audioURL) {
      return res.status(400).json({ error: "audioURL is required" });
    }

    try {
      // If it's a Supabase URL, just return it
      if (req.body.audioURL.includes('supabase.co') || req.body.audioURL.includes('supabase')) {
        res.status(200).json({
          objectPath: req.body.audioURL,
        });
        return;
      }

      // Otherwise, try Replit Object Storage
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.audioURL,
        {
          owner: "system", // For now, system owns all audio messages
          visibility: "private", // Audio messages are private
        },
      );

      res.status(200).json({
        objectPath: objectPath,
      });
    } catch (error: any) {
      console.error("Error setting audio message ACL:", error);
      // If it's a Supabase URL, return it anyway
      if (req.body.audioURL.includes('supabase.co') || req.body.audioURL.includes('supabase')) {
        res.status(200).json({
          objectPath: req.body.audioURL,
        });
      } else {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  // Audio Transcription endpoint using OpenAI Whisper
  app.post("/api/transcribe-audio", async (req, res) => {
    try {
      const { audioURL } = req.body;

      if (!audioURL) {
        return res.status(400).json({ error: "audioURL is required" });
      }

      // Check if OpenAI API key is configured
      if (!process.env.OPENAI_API_KEY) {
        console.error("OPENAI_API_KEY not configured");
        return res.json({
          transcription: "",
          error: "Transcription service not configured",
        });
      }

      // Initialize OpenAI client
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      let audioBuffer: Buffer;
      let fileExtension: string;

      // Check if it's a Supabase URL
      if (audioURL.includes('supabase.co') || audioURL.includes('supabase')) {
        try {
          const supabaseStorage = new SupabaseStorageService();
          const arrayBuffer = await supabaseStorage.getAudio(audioURL);
          audioBuffer = Buffer.from(arrayBuffer);
          
          // Determine file extension from URL
          const url = new URL(audioURL);
          const fileName = url.pathname.split('/').pop() || 'audio.webm';
          fileExtension = fileName.split('.').pop() || 'webm';
        } catch (supabaseError: any) {
          console.error("Error getting audio from Supabase:", supabaseError);
          return res.json({
            transcription: "",
            error: supabaseError.message || "Could not access audio file from Supabase",
          });
        }
      } else {
        // Use Replit Object Storage
        const objectStorageService = new ObjectStorageService();
        
        // Normalize the audio URL to get the object path
        let objectPath: string;
        if (audioURL.startsWith("http")) {
          // If it's a full URL, extract the path
          const url = new URL(audioURL);
          objectPath = url.pathname;
        } else {
          objectPath = audioURL;
        }

        // Get the file from object storage
        let objectFile;
        try {
          objectFile = await objectStorageService.getObjectEntityFile(objectPath);
        } catch (storageError: any) {
          console.error("Error accessing object storage:", storageError);
          // Return empty transcription instead of error to not block message sending
          return res.json({
            transcription: "",
            error: storageError.message || "Could not access audio file",
          });
        }

        // Download the file to a buffer
        const [buffer] = await objectFile.download();
        audioBuffer = buffer;
        
        // Determine file extension from object path or use default
        fileExtension = objectPath.includes(".mp3") ? "mp3" : 
                         objectPath.includes(".m4a") ? "m4a" : 
                         objectPath.includes(".webm") ? "webm" : "webm";
      }
      
      // For OpenAI Whisper API, we need to pass the file correctly
      // The SDK accepts File, Blob, Buffer, or Readable stream
      // Try using File constructor first, fallback to buffer if needed
      
      let audioFile: any;
      
      try {
        // Convert buffer to Uint8Array for File constructor
        const uint8Array = new Uint8Array(audioBuffer);
        
        // Create a File object (available in Node.js 18+)
        audioFile = new File(
          [uint8Array],
          `audio.${fileExtension}`,
          {
            type: `audio/${fileExtension === 'm4a' ? 'mp4' : fileExtension}`,
          }
        );
        
        console.log("Created File object:", {
          name: audioFile.name,
          type: audioFile.type,
          size: audioFile.size,
        });
      } catch (fileError) {
        console.error("Error creating File object, using buffer directly:", fileError);
        // Fallback: use buffer directly with metadata
        audioFile = audioBuffer;
      }

      // Transcribe using Whisper
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        language: "pt", // Portuguese
      });

      res.json({
        transcription: transcription.text,
      });
    } catch (error: any) {
      console.error("Error transcribing audio:", error);
      
      // Don't fail completely - return empty transcription so message can still be sent
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ error: "Audio file not found" });
      }
      
      // Return empty transcription instead of error to not block message sending
      res.json({
        transcription: "",
        error: error.message,
      });
    }
  });

  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(
        req.path,
      );
      objectStorageService.downloadObject(objectFile, res);
    } catch (error: any) {
      console.error("Error accessing object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Chat IA endpoint - handles both text and audio responses
  app.post("/api/landeiro-chat-ia", async (req, res) => {
    console.log("Received request to /api/landeiro-chat-ia:", req.body);
    try {
      const { message, chat_id, email, user_email } = req.body;

      // Include all required fields for the external AI service
      const requestBody: any = {
        message,
        email: user_email || email || "gabriel@goflow.digital",
        chat_id: chat_id, // Use chat_id as sent from frontend
      };

      // Add other fields from original request if they exist
      if (req.body.diagnostico) requestBody.diagnostico = req.body.diagnostico;
      if (req.body.protocolo) requestBody.protocolo = req.body.protocolo;
      if (req.body.sessao !== undefined && req.body.sessao !== null) {
        requestBody.sessao = req.body.sessao;
      }

      console.log("Received request body:", req.body);
      console.log("Sending request to external AI service:", requestBody);

      // Make request to external AI service
      const webhookUrl =
        process.env.LANDEIRO_WEBHOOK_URL ||
        "https://n8nflowhook.goflow.digital/webhook/landeiro-chat-ia";
      const aiResponse = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error("AI service error:", aiResponse.status, errorText);
        throw new Error(
          `AI service responded with ${aiResponse.status}: ${errorText}`,
        );
      }

      // Check if response has content
      const responseText = await aiResponse.text();
      if (!responseText || responseText.trim().length === 0) {
        throw new Error("Empty response from AI service");
      }

      let aiData;
      try {
        aiData = JSON.parse(responseText);
      } catch (parseError) {
        console.error("Error parsing AI response:", parseError, "Response:", responseText);
        throw new Error("Invalid JSON response from AI service");
      }
      console.log("AI service response:", aiData);

      // Track cost for this interaction
      const userMessage = typeof message === "string" ? message : JSON.stringify(message);
      const aiResponseText = aiData.output || aiData.response || aiData.message || aiData.text || "";
      
      // Track cost asynchronously (don't wait for it)
      if (chat_id) {
        trackChatCost(
          chat_id,
          userMessage,
          aiResponseText,
          aiData.cost, // Use actual cost if provided by API
          aiData.tokens_input, // Use actual input tokens if provided
          aiData.tokens_output // Use actual output tokens if provided
        ).catch((error) => {
          console.error("Error tracking cost:", error);
        });
      }

      // Check if response contains base64 audio
      if (aiData.base64) {
        console.log(
          "Received base64 audio from AI service, length:",
          aiData.base64.length,
        );

        // Always return base64 for assistant audio - simpler and more reliable
        res.json({
          type: "audio",
          base64: aiData.base64,
          mimeType: "audio/mp3",
          text: aiData.message || "",
        });
      } else {
        // Return text response - handle multiple possible response formats
        const messageText =
          aiData.output ||
          aiData.response ||
          aiData.message ||
          aiData.text ||
          "No response";
        res.json({
          type: "text",
          message: messageText,
        });
      }
    } catch (error: any) {
      console.error("Error in landeiro-chat-ia:", error);

      // For now, provide a fallback response until external API is fixed
      res.json({
        type: "text",
        message:
          "Entendo que você está tentando se comunicar comigo. No momento estou com dificuldades técnicas para processar sua mensagem adequadamente. Por favor, tente novamente em alguns instantes ou descreva em texto como posso ajudá-lo hoje.",
      });
    }
  });

  // Chat Messages Endpoints - for structured message history
  app.post("/api/chat-messages", async (req, res) => {
    try {
      const messageData = insertChatMessageSchema.parse(req.body);
      const message = await storage.createChatMessage(messageData);
      res.status(201).json(message);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/chat-messages/:chatId", async (req, res) => {
    try {
      const { chatId } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;
      const messages = await storage.getChatMessages(chatId, limit);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get messages for a specific session by thread_id and sessao
  app.get("/api/session-messages/:threadId/:sessao", async (req, res) => {
    try {
      const { threadId, sessao } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;
      const messages = await storage.getSessionMessages(
        threadId,
        parseInt(sessao),
        limit,
      );
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/thread-messages/:threadId", async (req, res) => {
    try {
      const { threadId } = req.params;
      const limit = parseInt(req.query.limit as string) || 100;
      const messages = await storage.getThreadMessages(threadId, limit);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/chat-stats/:chatId", async (req, res) => {
    try {
      const { chatId } = req.params;
      const stats = await storage.getChatStats(chatId);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/chat-overview/:chatId", async (req, res) => {
    try {
      const { chatId } = req.params;
      const overview = await storage.getChatOverview(chatId);
      if (!overview) {
        return res.status(404).json({ error: "Chat not found" });
      }
      res.json(overview);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/thread-sessions/:threadId", async (req, res) => {
    try {
      const { threadId } = req.params;
      const sessions = await storage.getThreadSessions(threadId);
      res.json(sessions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ===========================================
  // AUDIT LOGS
  // ===========================================

  // Create audit log (for user actions like delete thread)
  app.post("/api/audit-logs", requireAuth, async (req, res) => {
    try {
      const user = (req as any).user;
      const { action, targetUserId, details } = req.body;

      if (!action) {
        return res.status(400).json({ error: "Action é obrigatório" });
      }

      const auditLog = await AdminService.createAuditLog({
        adminUserId: user.id, // Usa o userId do usuário autenticado
        action: action,
        targetUserId: targetUserId || null,
        details: details || {},
      });

      res.json(auditLog);
    } catch (error: any) {
      console.error("[Audit Log] Error creating audit log:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===========================================
  // ADMIN ROUTES
  // ===========================================

  // Users Management
  app.get("/api/admin/users", isAdmin, async (req, res) => {
    try {
      console.log("[Admin API] GET /api/admin/users", req.query);
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const search = req.query.search as string | undefined;
      const result = await AdminService.getUsers(page, limit, search);
      console.log("[Admin API] Returning", result.users?.length || 0, "users");
      res.json(result);
    } catch (error: any) {
      console.error("[Admin API] Error getting users:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/users/:userId", isAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const userDetails = await AdminService.getUserDetails(userId);
      res.json(userDetails);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/users/:userId", isAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const metadata = insertUserMetadataSchema.parse(req.body);
      const updated = await AdminService.updateUserMetadata(userId, metadata);
      await AdminService.createAuditLog({
        adminUserId: (req as any).user.id,
        action: "update_user",
        targetUserId: userId,
        details: { metadata },
      });
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/admin/users/:userId/sessions", isAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const result = await AdminService.getSessions(page, limit, { userId });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/users/:userId/messages", isAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const messages = await AdminService.exportMessages(userId);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/users/:userId/diagnosticos", isAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const userDiagnosticos = await AdminService.getUserDiagnosticos(userId);
      res.json(userDiagnosticos);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/users/:userId/diagnosticos", isAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { diagnosticoId } = req.body;
      if (!diagnosticoId) {
        return res.status(400).json({ error: "diagnosticoId is required" });
      }
      const result = await AdminService.liberarDiagnostico(userId, diagnosticoId);
      await AdminService.createAuditLog({
        adminUserId: (req as any).user.id,
        action: "liberate_diagnostico",
        targetUserId: userId,
        details: { diagnosticoId },
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/users/:userId/access-date", isAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { dataFinalAcesso } = req.body;
      if (!dataFinalAcesso) {
        return res.status(400).json({ error: "dataFinalAcesso is required" });
      }
      const result = await AdminService.updateUserAccessDate(userId, new Date(dataFinalAcesso));
      await AdminService.createAuditLog({
        adminUserId: (req as any).user.id,
        action: "update_user_access_date",
        targetUserId: userId,
        details: { dataFinalAcesso },
      });
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create user
  app.post("/api/admin/users", isAdmin, async (req, res) => {
    try {
      const { email, password, fullName, dataFinalAcesso, status } = req.body;
      
      if (!email) {
        return res.status(400).json({ error: "Email é obrigatório" });
      }

      const result = await AdminService.createUser({
        email,
        password: password || undefined, // Senha será gerada automaticamente se não fornecida
        fullName,
        dataFinalAcesso: dataFinalAcesso ? new Date(dataFinalAcesso) : undefined,
        status: status || "ativo",
      });

      await AdminService.createAuditLog({
        adminUserId: (req as any).user.id,
        action: "create_user",
        targetUserId: result.userId,
        details: { email, fullName, passwordGenerated: !password },
      });

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bulk update user status from CSV
  app.post("/api/admin/users/bulk-update-status", isAdmin, async (req, res) => {
    try {
      const { csvData } = req.body;
      
      if (!csvData || typeof csvData !== "string") {
        return res.status(400).json({ error: "CSV data is required" });
      }

      // Parse CSV using papaparse
      const Papa = (await import("papaparse")).default;
      const parsed = Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim().toLowerCase(),
      });

      if (parsed.errors.length > 0) {
        return res.status(400).json({
          error: "Erro ao processar CSV",
          details: parsed.errors,
        });
      }

      // Validate headers
      const headers = parsed.meta.fields || [];
      if (!headers.includes("email") || !headers.includes("status")) {
        return res.status(400).json({
          error: "CSV deve conter as colunas: email, status",
        });
      }

      // Extract updates
      const updates = parsed.data
        .filter((row: any) => row.email && row.status)
        .map((row: any) => ({
          email: row.email.trim(),
          status: row.status.trim().toLowerCase(),
        }));

      if (updates.length === 0) {
        return res.status(400).json({ error: "Nenhum registro válido encontrado no CSV" });
      }

      const result = await AdminService.bulkUpdateUserStatus(updates);

      await AdminService.createAuditLog({
        adminUserId: (req as any).user.id,
        action: "bulk_update_user_status",
        details: {
          total: result.total,
          success: result.success,
          failed: result.failed,
        },
      });

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bulk create users from CSV
  app.post("/api/admin/users/bulk-create", isAdmin, async (req, res) => {
    try {
      const { csvData } = req.body;
      
      if (!csvData || typeof csvData !== "string") {
        return res.status(400).json({ error: "CSV data is required" });
      }

      // Parse CSV using papaparse
      const Papa = (await import("papaparse")).default;
      const parsed = Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim().toLowerCase(),
      });

      if (parsed.errors.length > 0) {
        return res.status(400).json({
          error: "Erro ao processar CSV",
          details: parsed.errors,
        });
      }

      // Validate headers
      const headers = parsed.meta.fields || [];
      if (!headers.includes("email")) {
        return res.status(400).json({
          error: "CSV deve conter a coluna: email (obrigatório). Colunas opcionais: senha, nome, datafinalacesso",
        });
      }

      // Extract users - senha é opcional, será gerada automaticamente se não fornecida
      const users = parsed.data
        .filter((row: any) => row.email)
        .map((row: any) => ({
          email: row.email.trim(),
          password: row.senha?.trim() || undefined, // Senha opcional
          fullName: row.nome?.trim() || undefined,
          dataFinalAcesso: row.datafinalacesso?.trim() || undefined,
        }));

      if (users.length === 0) {
        return res.status(400).json({ error: "Nenhum registro válido encontrado no CSV" });
      }

      const result = await AdminService.bulkCreateUsers(users);

      await AdminService.createAuditLog({
        adminUserId: (req as any).user.id,
        action: "bulk_create_users",
        details: {
          total: result.total,
          success: result.success,
          failed: result.failed,
        },
      });

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete user
  app.delete("/api/admin/users/:userId", isAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const result = await AdminService.deleteUser(userId);

      await AdminService.createAuditLog({
        adminUserId: (req as any).user.id,
        action: "delete_user",
        targetUserId: userId,
        details: { email: result.email },
      });

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Diagnosticos Management
  app.get("/api/admin/diagnosticos", isAdmin, async (req, res) => {
    try {
      const diagnosticos = await AdminService.getDiagnosticos();
      res.json(diagnosticos);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/diagnosticos/stats", isAdmin, async (req, res) => {
    try {
      const stats = await AdminService.getDiagnosticoStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/diagnosticos/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { ativo, apenas_teste } = req.body;
      const updated = await AdminService.updateDiagnostico(id, { 
        ativo, 
        apenasTeste: apenas_teste 
      });
      await AdminService.createAuditLog({
        adminUserId: (req as any).user.id,
        action: "update_diagnostico",
        details: { diagnosticoId: id, ativo, apenas_teste },
      });
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/diagnosticos", isAdmin, async (req, res) => {
    try {
      const { nome, codigo, ativo, apenas_teste } = req.body;

      if (!nome || !codigo) {
        return res.status(400).json({ error: "Nome e código são obrigatórios" });
      }

      const created = await AdminService.createDiagnostico({
        nome,
        codigo,
        ativo: ativo ?? true,
        apenasTeste: apenas_teste ?? false,
      });

      await AdminService.createAuditLog({
        adminUserId: (req as any).user.id,
        action: "create_diagnostico",
        details: { diagnosticoId: created.id, nome, codigo, ativo, apenas_teste },
      });

      res.status(201).json(created);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Sessions Management
  app.get("/api/admin/sessions", isAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const filters: any = {};
      
      if (req.query.userId) filters.userId = req.query.userId as string;
      if (req.query.diagnostico) filters.diagnostico = req.query.diagnostico as string;
      if (req.query.userEmail) filters.userEmail = req.query.userEmail as string;
      if (req.query.startDate) filters.startDate = req.query.startDate as string;
      if (req.query.endDate) filters.endDate = req.query.endDate as string;
      
      const result = await AdminService.getSessions(page, limit, filters);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/sessions/:chatId", isAdmin, async (req, res) => {
    try {
      const { chatId } = req.params;
      const sessionDetails = await AdminService.getSessionDetails(chatId);
      if (!sessionDetails) {
        return res.status(404).json({ error: "Session not found" });
      }
      res.json(sessionDetails);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/sessions/:chatId/messages", isAdmin, async (req, res) => {
    try {
      const { chatId } = req.params;
      const messages = await AdminService.getSessionMessages(chatId);
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Costs Management
  app.post("/api/admin/costs", isAdmin, async (req, res) => {
    try {
      const costData = insertSessionCostSchema.parse(req.body);
      const cost = await AdminService.createSessionCost(costData);
      await AdminService.createAuditLog({
        adminUserId: (req as any).user.id,
        action: "create_cost",
        targetUserId: costData.userId,
        details: { costId: cost.id },
      });
      res.status(201).json(cost);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get("/api/admin/costs", isAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const userId = req.query.userId as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const result = await AdminService.getCosts(page, limit, userId, startDate, endDate);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/costs/user/:userId", isAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const costs = await AdminService.getCosts(1, 1000, userId, startDate, endDate);
      res.json(costs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/costs/session/:chatId", isAdmin, async (req, res) => {
    try {
      const { chatId } = req.params;
      const sessionDetails = await AdminService.getSessionDetails(chatId);
      res.json({ cost: sessionDetails?.cost || null });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/costs/summary", isAdmin, async (req, res) => {
    try {
      const userId = req.query.userId as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const summary = await AdminService.getCostSummary(userId, startDate, endDate);
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Statistics
  app.get("/api/admin/stats", isAdmin, async (req, res) => {
    try {
      const stats = await AdminService.getSystemStats();
      res.json(stats);
    } catch (error: any) {
      console.error("Error in /api/admin/stats:", {
        error: error?.message || error?.toString(),
        errorType: error?.name || "Unknown"
      });
      const errorMessage = error?.message || error?.toString() || "";
      
      // Detectar erros de autenticação ou conexão transitórios
      if (errorMessage.includes("authentication") ||
          errorMessage.includes("password authentication failed") ||
          errorMessage.includes("JWT") ||
          errorMessage.includes("connection") ||
          errorMessage.includes("ECONNREFUSED") ||
          errorMessage.includes("timeout")) {
        return res.status(503).json({ 
          error: "Erro temporário de conexão com o banco de dados. Por favor, aguarde alguns instantes e tente novamente.",
          retryAfter: 60
        });
      }
      
      res.status(500).json({ error: errorMessage });
    }
  });

  app.get("/api/admin/stats/users/:userId", isAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const stats = await AdminService.getUserStats(userId);
      res.json(stats);
    } catch (error: any) {
      console.error("Error in /api/admin/stats/users/:userId:", {
        userId: req.params.userId,
        error: error?.message || error?.toString(),
        errorType: error?.name || "Unknown"
      });
      const errorMessage = error?.message || error?.toString() || "";
      
      // Detectar erros de autenticação ou conexão transitórios
      if (errorMessage.includes("authentication") ||
          errorMessage.includes("password authentication failed") ||
          errorMessage.includes("JWT") ||
          errorMessage.includes("connection") ||
          errorMessage.includes("ECONNREFUSED") ||
          errorMessage.includes("timeout")) {
        return res.status(503).json({ 
          error: "Erro temporário de conexão com o banco de dados. Por favor, aguarde alguns instantes e tente novamente.",
          retryAfter: 60
        });
      }
      
      res.status(500).json({ error: errorMessage });
    }
  });

  app.get("/api/admin/usage", isAdmin, async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const userId = req.query.userId as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const result = await AdminService.getUsageHistory(page, limit, userId, startDate, endDate);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Export
  app.get("/api/admin/export/messages", isAdmin, async (req, res) => {
    try {
      const userId = req.query.userId as string | undefined;
      const chatId = req.query.chatId as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const format = (req.query.format as string) || "json";

      const messages = await AdminService.exportMessages(userId, chatId, startDate, endDate);

      await AdminService.createAuditLog({
        adminUserId: (req as any).user.id,
        action: "export_messages",
        targetUserId: userId,
        details: { format, count: messages.length, filters: { chatId, startDate, endDate } },
      });

      if (format === "csv") {
        // Convert to CSV
        const headers = ["Data", "Usuário", "Sessão", "Remetente", "Mensagem", "Tipo"];
        const rows = messages.map((msg) => [
          msg.createdAt ? new Date(msg.createdAt).toISOString() : "",
          msg.userId,
          msg.sessao.toString(),
          msg.sender,
          msg.content.substring(0, 1000), // Limit content length
          msg.messageType || "text",
        ]);

        const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename=messages-${Date.now()}.csv`);
        res.send(csv);
      } else {
        res.json(messages);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/export/user/:userId/messages", isAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const format = (req.query.format as string) || "json";
      const messages = await AdminService.exportMessages(userId);

      await AdminService.createAuditLog({
        adminUserId: (req as any).user.id,
        action: "export_user_messages",
        targetUserId: userId,
        details: { format, count: messages.length },
      });

      if (format === "csv") {
        const headers = ["Data", "Usuário", "Sessão", "Remetente", "Mensagem", "Tipo"];
        const rows = messages.map((msg) => [
          msg.createdAt ? new Date(msg.createdAt).toISOString() : "",
          msg.userId,
          msg.sessao.toString(),
          msg.sender,
          msg.content.substring(0, 1000),
          msg.messageType || "text",
        ]);

        const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename=user-${userId}-messages-${Date.now()}.csv`);
        res.send(csv);
      } else {
        res.json(messages);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/export/session/:chatId/messages", isAdmin, async (req, res) => {
    try {
      const { chatId } = req.params;
      const format = (req.query.format as string) || "json";
      const messages = await AdminService.exportMessages(undefined, chatId);

      await AdminService.createAuditLog({
        adminUserId: (req as any).user.id,
        action: "export_session_messages",
        details: { chatId, format, count: messages.length },
      });

      if (format === "csv") {
        const headers = ["Data", "Usuário", "Sessão", "Remetente", "Mensagem", "Tipo"];
        const rows = messages.map((msg) => [
          msg.createdAt ? new Date(msg.createdAt).toISOString() : "",
          msg.userId,
          msg.sessao.toString(),
          msg.sender,
          msg.content.substring(0, 1000),
          msg.messageType || "text",
        ]);

        const csv = [headers, ...rows].map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", `attachment; filename=session-${chatId}-messages-${Date.now()}.csv`);
        res.send(csv);
      } else {
        res.json(messages);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
