import { postingQueue } from "../src/queue/queue.js";
import Database from "better-sqlite3";
import path from "path";

const db = new Database(path.resolve('./sqlite.db'));

console.log("🔍 Checking SQLite for scheduled posts to add to BullMQ queue...");
const posts = db.prepare("SELECT * FROM posts WHERE status = 'scheduled'").all() as any[];

console.log(`Found ${posts.length} scheduled posts.`);

async function main() {
  for (const post of posts) {
    const delay = 0; // Trigger immediately for testing
    const jobId = `post_${post.id}`;
    
    console.log(`⏱️ Re-queueing post ${post.id} with ${delay}ms delay...`);
    await postingQueue.add(
      "publish-post",
      { postId: post.id },
      { 
        delay,
        jobId,
        removeOnComplete: true,
      }
    );
    console.log(`✅ Queued job: ${jobId}`);
  }
  
  console.log("🎉 Requeuing complete!");
  process.exit(0);
}

main().catch(err => {
  console.error("❌ Failed to requeue:", err);
  process.exit(1);
});
