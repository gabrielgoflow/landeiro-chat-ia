import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@shared/schema";

// Database connection setup
let db: ReturnType<typeof drizzle> | null = null;
let client: ReturnType<typeof postgres> | null = null;

if (process.env.DATABASE_URL) {
  try {
    client = postgres(process.env.DATABASE_URL, { 
      prepare: false // Required for Supabase
    });
    db = drizzle(client, { schema });
    console.log("✅ Connected to Supabase database");
  } catch (error) {
    console.error("❌ Failed to connect to database:", error);
  }
} else {
  console.warn("⚠️ DATABASE_URL not found - using in-memory storage");
}

export { db, client };