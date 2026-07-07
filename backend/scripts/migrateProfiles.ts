import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve('./sqlite.db');
const db = new Database(dbPath);

console.log(`📂 Migrating database: ${dbPath}`);

const profiles = db.prepare("SELECT id, platform, profile_name, chrome_profile_path FROM social_profiles").all() as any[];

for (const profile of profiles) {
  const platform = profile.platform.toLowerCase();
  let newPath = '';
  if (platform === 'facebook') {
    newPath = '/home/dccdev/Social/backend/data/sessions/server_profile_facebook';
  } else if (platform === 'instagram') {
    newPath = '/home/dccdev/Social/backend/data/sessions/server_profile_instagram';
  } else if (platform === 'linkedin') {
    newPath = '/home/dccdev/Social/backend/data/sessions/server_profile_linkedin';
  }

  if (newPath) {
    db.prepare("UPDATE social_profiles SET chrome_profile_path = ? WHERE id = ?").run(newPath, profile.id);
    console.log(`✅ Migrated profile "${profile.profile_name}" (${profile.platform}) -> ${newPath}`);
  }
}

console.log("🎉 Database migration completed!");
