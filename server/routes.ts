import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertChatReviewSchema,
  insertChatMessageSchema,
} from "@shared/schema";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage.js";
import { ObjectPermission } from "./objectAcl.js";

export async function registerRoutes(app: Express): Promise<Server> {
  // Chat Reviews
  app.post("/api/reviews", async (req, res) => {
    try {
      const reviewData = insertChatReviewSchema.parse(req.body);
      const review = await storage.createChatReview(reviewData);
      res.status(201).json(review);
    } catch (error: any) {
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
      res.status(500).json({ error: error.message });
    }
  });

  // Object Storage Routes for Audio Messages
  app.post("/api/objects/upload", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error: any) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  app.post("/api/audio-messages", async (req, res) => {
    if (!req.body.audioURL) {
      return res.status(400).json({ error: "audioURL is required" });
    }

    try {
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
      res.status(500).json({ error: "Internal server error" });
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

  // Landeiro Chat IA endpoint - handles both text and audio responses
  app.post("/api/landeiro-chat-ia", async (req, res) => {
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

      console.log("Sending request to external AI service:", requestBody);

      // Make request to external AI service
      const webhookUrl =
        process.env.LANDEIRO_WEBHOOK_URL ||
        "https://hook.us2.make.com/o4kzajwfvqy7zpcgk54gxpkfj77nklbz";
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

      const aiData = await aiResponse.json();
      console.log("AI service response:", aiData);

      // Check if response contains base64 audio
      if (aiData.base64) {
        console.log(
          "Received base64 audio from AI service, length:",
          aiData.base64.length,
        );
        try {
          // Convert base64 to audio URL using Object Storage
          const objectStorageService = new ObjectStorageService();

          // Convert base64 to buffer
          const audioBuffer = Buffer.from(aiData.base64, "base64");
          console.log("Converted base64 to buffer, size:", audioBuffer.length);

          // Upload to Object Storage
          console.log("Uploading audio to Object Storage...");
          const audioURL = await objectStorageService.uploadAudioFromBuffer(
            audioBuffer,
            "audio/mp3",
          );
          console.log("Audio uploaded successfully, URL:", audioURL);

          // Return audio response with URL
          res.json({
            type: "audio",
            audioURL: audioURL,
            mimeType: "audio/mp3",
            text: aiData.message || "", // Include text if available
          });
        } catch (uploadError) {
          console.error(
            "Error uploading audio to Object Storage:",
            uploadError,
          );
          // Fallback to base64 if upload fails
          console.log("Falling back to base64 response");
          res.json({
            type: "audio",
            base64: aiData.base64,
            mimeType: "audio/mp3",
            text: aiData.message || "",
          });
        }
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

  const httpServer = createServer(app);

  return httpServer;
}
