import Database from 'better-sqlite3';
import path from 'path';
import crypto from 'crypto';

const dbPath = path.resolve('./sqlite.db');
const db = new Database(dbPath);

console.log(`📂 Connecting to database: ${dbPath}`);

const companyId = "33ffae96-9061-40d5-a6c3-8f3efdbd6996";

// 1. Insert Instagram profile
const igId = crypto.randomUUID();
const igExists = db.prepare("SELECT id FROM social_profiles WHERE company_id = ? AND platform = 'instagram'").get(companyId);
if (!igExists) {
  db.prepare(`
    INSERT INTO social_profiles (id, company_id, platform, profile_name, profile_id, chrome_profile_path, status, created_at)
    VALUES (?, ?, 'instagram', 'Buzzin Tech', 'Buzzin Tech', '/home/dccdev/Social/backend/data/sessions/server_profile_instagram', 'connected', ?)
  `).run(igId, Math.floor(Date.now() / 1000));
  console.log("✅ Inserted Instagram profile!");
} else {
  console.log("ℹ️ Instagram profile already exists.");
}

// 2. Insert LinkedIn profile
const liId = crypto.randomUUID();
const liExists = db.prepare("SELECT id FROM social_profiles WHERE company_id = ? AND platform = 'linkedin'").get(companyId);
if (!liExists) {
  db.prepare(`
    INSERT INTO social_profiles (id, company_id, platform, profile_name, profile_id, chrome_profile_path, status, created_at)
    VALUES (?, ?, 'linkedin', 'Buzzin Tech', 'https://www.linkedin.com/company/31184548', '/home/dccdev/Social/backend/data/sessions/server_profile_linkedin', 'connected', ?)
  `).run(liId, Math.floor(Date.now() / 1000));
  console.log("✅ Inserted LinkedIn profile!");
} else {
  console.log("ℹ️ LinkedIn profile already exists.");
}

console.log("🎉 Profiles insertion finished!");
