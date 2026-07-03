import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db, sqlite } from "./db.js";
import * as dotenv from "dotenv";
dotenv.config();

async function runMigrations() {
  console.log("🚀 Running Drizzle SQLite migrations...");
  try {
    migrate(db, { migrationsFolder: "./src/db/migrations" });
    console.log("✅ SQLite Migrations completed successfully!");
  } catch (error) {
    console.error("❌ SQLite Migration failed:", error);
    process.exit(1);
  } finally {
    sqlite.close();
  }
}

runMigrations();
