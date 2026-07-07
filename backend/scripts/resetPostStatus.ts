import Database from "better-sqlite3";
import path from "path";

const dbPath = path.resolve('./sqlite.db');
const db = new Database(dbPath);

console.log("🔄 Resetting posts in 'failed' or 'publishing' status back to 'scheduled'...");
const result = db.prepare("UPDATE posts SET status = 'scheduled', error_message = NULL WHERE status IN ('failed', 'publishing')").run();
console.log(`✅ Success! Updated ${result.changes} posts.`);
