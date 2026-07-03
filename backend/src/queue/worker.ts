import { Worker, Job } from "bullmq";
import { db } from "../db/db.js";
import { posts, socialProfiles } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { syncChromeProfile } from "../workers/utils/profileSync.js";
import { launchBrowserWithProfile } from "../workers/utils/browserLauncher.js";
import { publishToFacebookSuite } from "../workers/publishers/facebook.js";
import { publishToLinkedIn } from "../workers/publishers/linkedin.js";
import { publishToTikTok } from "../workers/publishers/tiktok.js";
import { connection } from "./queue.js";
import path from "path";
import fs from "fs";

interface JobData {
  postId: string;
}

// Instantiate the BullMQ Worker to process social posting tasks
export const postingWorker = new Worker(
  "posting-queue",
  async (job: Job<JobData>) => {
    const { postId } = job.data;
    console.log(`🤖 Processing Job ${job.id} for Post ID: ${postId}`);

    // 1. Retrieve post and profile information from database
    const postRecord = await db
      .select({
        post: posts,
        profile: socialProfiles,
      })
      .from(posts)
      .innerJoin(socialProfiles, eq(posts.socialProfileId, socialProfiles.id))
      .where(eq(posts.id, postId))
      .limit(1);

    if (postRecord.length === 0) {
      console.warn(`⚠️ Post ${postId} not found in database. Skipping job.`);
      return;
    }

    const { post, profile } = postRecord[0];

    if (post.status === "published") {
      console.log(`⚠️ Post ${postId} is already published. Skipping.`);
      return;
    }

    // Update status to publishing
    await db.update(posts).set({ status: "publishing" }).where(eq(posts.id, postId));

    // Create an isolated temporary directory path for this running browser context
    // This avoids locks if we post to multiple networks or run browsers in parallel.
    const tempProfilePath = path.resolve(`./data/profiles/running_${postId}`);

    try {
      // 2. Synchronize Chrome Session Profile
      syncChromeProfile(profile.chromeProfilePath, tempProfilePath);

      // 3. Launch Persistent Playwright Browser Context
      const context = await launchBrowserWithProfile(tempProfilePath, {
        headless: true, // Set to false to debug/watch the posting locally
      });

      // 4. Dispatch to correct Platform Publisher
      const mediaList = post.mediaUrls as string[];
      
      if (profile.platform === "facebook" || profile.platform === "instagram") {
        const platformKey = profile.platform as "facebook" | "instagram";
        await publishToFacebookSuite(context, post.caption || "", mediaList, [platformKey]);
      } else if (profile.platform === "linkedin") {
        await publishToLinkedIn(context, post.caption || "", mediaList);
      } else if (profile.platform === "tiktok") {
        if (!mediaList || mediaList.length === 0) {
          throw new Error("TikTok requires a video file attachment to post");
        }
        await publishToTikTok(context, post.caption || "", mediaList[0]);
      } else {
        throw new Error(`Unsupported platform type: ${profile.platform}`);
      }

      // 5. Success cleanup and database update
      await context.close();
      await db.update(posts).set({
        status: "published",
        publishedAt: new Date(),
        errorMessage: null,
      }).where(eq(posts.id, postId));
      
      console.log(`🎉 Job succeeded! Post ${postId} is published.`);
    } catch (err: any) {
      console.error(`❌ Job failed for Post ${postId}:`, err.message);
      
      // Update database with failure log
      await db.update(posts).set({
        status: "failed",
        errorMessage: err.message,
      }).where(eq(posts.id, postId));

      throw err; // Rethrow to let BullMQ handle attempts/backoff
    } finally {
      // Always cleanup temporary browser profiles to save Linux disk space
      if (fs.existsSync(tempProfilePath)) {
        try {
          fs.rmSync(tempProfilePath, { recursive: true, force: true });
          console.log(`🧹 Cleaned up temporary profile workspace: ${tempProfilePath}`);
        } catch (cleanupErr) {
          console.error(`[WARN] Failed to delete temp workspace ${tempProfilePath}:`, cleanupErr);
        }
      }
    }
  },
  {
    connection,
    concurrency: 2, // Process up to 2 browser posting tasks concurrently on our server
  }
);

postingWorker.on("completed", (job) => {
  console.log(`✅ Queue Job ${job.id} completed.`);
});

postingWorker.on("failed", (job, err) => {
  console.error(`❌ Queue Job ${job?.id} failed with error:`, err.message);
});

postingWorker.on("error", (err) => {
  console.warn("⚠️ BullMQ Worker connection error:", err.message);
});
