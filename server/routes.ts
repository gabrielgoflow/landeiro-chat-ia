import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertChatReviewSchema } from "@shared/schema";

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
  
  // put application routes here
  // prefix all routes with /api

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  const httpServer = createServer(app);

  return httpServer;
}
