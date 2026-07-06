import { Worker, Job } from "bullmq";
import { db } from "../db/db.js";
import { posts, socialProfiles } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { launchBrowserWithStorageState } from "../workers/utils/browserLauncher.js";
import { publishToFacebookSuite } from "../workers/publishers/facebook.js";
import { publishToLinkedIn } from "../workers/publishers/linkedin.js";
import { publishToTikTok } from "../workers/publishers/tiktok.js";
import { connection } from "./queue.js";
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

    // The server has no display of its own, so profiles are linked via an uploaded
    // Playwright storageState (cookies + localStorage) captured on a machine that does
    // have a display, rather than a live Chrome user-data-dir synced from this machine.
    if (!fs.existsSync(profile.chromeProfilePath)) {
      const err = new Error(
        `Session file not found on server: ${profile.chromeProfilePath}. Please re-link this profile by uploading a fresh session file.`
      );
      await db.update(posts).set({ status: "failed", errorMessage: err.message }).where(eq(posts.id, postId));
      await db.update(socialProfiles).set({ status: "error" }).where(eq(socialProfiles.id, profile.id));
      throw err;
    }

    const context = await launchBrowserWithStorageState(profile.chromeProfilePath, {
      headless: true, // Set to false to debug/watch the posting locally (requires a display)
    });

    try {
      // 2. Dispatch to correct Platform Publisher
      const mediaList = post.mediaUrls as string[];

      if (profile.platform === "facebook" || profile.platform === "instagram") {
        const platformKey = profile.platform as "facebook" | "instagram";
        await publishToFacebookSuite(context, post.caption || "", mediaList, [platformKey], profile.profileId || undefined);
      } else if (profile.platform === "linkedin") {
        await publishToLinkedIn(context, post.caption || "", mediaList, profile.profileId || undefined);
      } else if (profile.platform === "tiktok") {
        if (!mediaList || mediaList.length === 0) {
          throw new Error("TikTok requires a video file attachment to post");
        }
        await publishToTikTok(context, post.caption || "", mediaList[0]);
      } else {
        throw new Error(`Unsupported platform type: ${profile.platform}`);
      }

      // 3. Success database update
      await db.update(posts).set({
        status: "published",
        publishedAt: new Date(),
        errorMessage: null,
      }).where(eq(posts.id, postId));

      // A successful publish proves the linked session is healthy again
      if (profile.status !== "connected") {
        await db.update(socialProfiles).set({ status: "connected" }).where(eq(socialProfiles.id, profile.id));
      }

      console.log(`🎉 Job succeeded! Post ${postId} is published.`);
    } catch (err: any) {
      console.error(`❌ Job failed for Post ${postId}:`, err.message);

      // Update database with failure log
      await db.update(posts).set({
        status: "failed",
        errorMessage: err.message,
      }).where(eq(posts.id, postId));

      // Flag the profile itself so Connected Profiles stops showing a stale "connected" badge
      if (/session expired|login session/i.test(err.message || "")) {
        await db.update(socialProfiles).set({ status: "error" }).where(eq(socialProfiles.id, profile.id));
      }

      throw err; // Rethrow to let BullMQ handle attempts/backoff
    } finally {
      // Closing the context also closes the underlying browser (see browserLauncher.ts)
      await context.close().catch(() => {});
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
