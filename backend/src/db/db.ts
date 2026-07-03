import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema.js";
import * as dotenv from "dotenv";
dotenv.config();

const dbPath = process.env.DATABASE_URL || "sqlite.db";

// Connect to SQLite file (creates it if it does not exist)
export const sqlite = new Database(dbPath);

export const db = drizzle(sqlite, { schema });
