import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.resolve('./sqlite.db');
const db = new Database(dbPath);

// Update Instagram tracked post
const instUpdate = db.prepare(`
  UPDATE moderation_rules 
  SET trigger_keyword = 'https://www.instagram.com/p/Dau2Yu0oyzd/' 
  WHERE type = 'tracked_post' AND platform = 'instagram'
`).run();
console.log("Instagram rules updated:", instUpdate.changes);

// Update TikTok tracked post
const ttUpdate = db.prepare(`
  UPDATE moderation_rules 
  SET trigger_keyword = 'https://www.tiktok.com/@dccdevelopers/video/7662738895599127826' 
  WHERE type = 'tracked_post' AND platform = 'tiktok'
`).run();
console.log("TikTok rules updated:", ttUpdate.changes);

// Verify
const rules = db.prepare("SELECT * FROM moderation_rules WHERE type = 'tracked_post'").all();
console.log("Updated tracked posts in DB:", JSON.stringify(rules, null, 2));
