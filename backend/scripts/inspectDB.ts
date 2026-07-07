import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve('./sqlite.db');
const db = new Database(dbPath);
const posts = db.prepare("SELECT id, caption, media_urls, status, error_message, created_at FROM posts ORDER BY created_at DESC LIMIT 5").all();
console.log("POSTS:", JSON.stringify(posts, null, 2));
