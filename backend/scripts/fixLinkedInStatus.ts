import Database from "better-sqlite3";
import path from "path";

const db = new Database(path.resolve("./sqlite.db"));
const result = db.prepare("UPDATE social_profiles SET status = 'connected' WHERE platform = 'linkedin'").run();
console.log(`✅ Updated ${result.changes} LinkedIn profile(s) to connected`);

const profiles = db.prepare("SELECT platform, profile_name, status FROM social_profiles").all();
console.log("Current profile statuses:", profiles);
