import Database from "better-sqlite3";
import path from "path";

const db = new Database(path.resolve('./sqlite.db'));
const rows = db.prepare('select * from social_profiles').all();
console.log("SOCIAL_PROFILES:", JSON.stringify(rows, null, 2));
