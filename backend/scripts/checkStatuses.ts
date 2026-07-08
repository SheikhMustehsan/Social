import Database from "better-sqlite3";
import path from "path";

const db = new Database(path.resolve('./sqlite.db'));
const rows = db.prepare('select id, status, error_message from posts').all();
console.log("POST_STATUSES:", JSON.stringify(rows, null, 2));
