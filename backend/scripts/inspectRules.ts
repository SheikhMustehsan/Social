import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve('./sqlite.db');
const db = new Database(dbPath);
const rules = db.prepare("SELECT * FROM moderation_rules").all();
console.log("RULES:", JSON.stringify(rules, null, 2));

const profiles = db.prepare("SELECT * FROM social_profiles").all();
console.log("PROFILES:", JSON.stringify(profiles, null, 2));
