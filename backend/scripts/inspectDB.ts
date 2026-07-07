import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve('./sqlite.db');
const db = new Database(dbPath);
const profiles = db.prepare("SELECT * FROM social_profiles").all();
console.log("SOCIAL PROFILES:", JSON.stringify(profiles, null, 2));
