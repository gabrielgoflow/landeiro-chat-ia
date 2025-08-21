import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertChatReviewSchema } from "@shared/schema";
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
        }
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
      const { message, chatId, email } = req.body;

      // Make request to external AI service
      const aiResponse = await fetch('https://hook.us2.make.com/o4kzajwfvqy7zpcgk54gxpkfj77nklbz', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          email: email || 'user@example.com',
          chat_id: chatId,
        }),
      });

      if (!aiResponse.ok) {
        throw new Error(`AI service responded with ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();

      // Check if response contains base64 audio
      if (aiData.base64) {
        // Return audio response
        res.json({
          type: 'audio',
          base64: aiData.base64,
          mimeType: 'audio/mp3', // Assume MP3 for base64 responses
          text: aiData.message || '', // Include text if available
        });
      } else {
        // Return text response  
        res.json({
          type: 'text',
          message: aiData.message || aiData.text || 'No response',
        });
      }

    } catch (error: any) {
      console.error('Error in landeiro-chat-ia:', error);
      res.status(500).json({ 
        error: 'Failed to get AI response',
        type: 'text',
        message: 'Desculpe, ocorreu um erro. Tente novamente.'
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
