import { Worker, Job } from "bullmq";
import { db } from "../db/db.js";
import { posts, socialProfiles, syncJobs } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { launchBrowserWithStorageState, launchBrowserWithProfile } from "../workers/utils/browserLauncher.js";
import { publishToFacebookSuite } from "../workers/publishers/facebook.js";
import { publishToLinkedIn } from "../workers/publishers/linkedin.js";
import { publishToTikTok } from "../workers/publishers/tiktok.js";
import { publishToInstagram } from "../workers/publishers/instagram.js";
import { connection } from "./queue.js";
import fs from "fs";

import { scrapeAdsCSVReport } from "../workers/scrapers/adsScraper.js";
import { parseAndSaveAdsCSV } from "../workers/scrapers/csvParser.js";
import { scrapeOrganicMetrics } from "../workers/scrapers/organicScraper.js";
import { crawlAndReplyComments } from "../workers/moderation/commentCrawler.js";
import { scanInboxOnce } from "../workers/moderation/dmListener.js";

interface JobData {
  type: "publish_post" | "scrape_ads" | "crawl_comments" | "scan_dms" | "scrape_ads_all" | "scrape_organic_all";
  postId?: string;
  profileId?: string;
  dateRange?: "last_30_days" | "this_month" | "last_month";
  postUrl?: string;
}

// Instantiate the BullMQ Worker to process headed browser tasks
export const browserWorker = new Worker(
  "browser-queue",
  async (job: Job<JobData>) => {
    const { type } = job.data;
    console.log(`🤖 Processing Job ${job.id} of type: ${type}`);

    // If it's a posting job
    if (type === "publish_post") {
      const { postId } = job.data;
      if (!postId) return;
      
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

      await db.update(posts).set({ status: "publishing" }).where(eq(posts.id, postId));

      if (!fs.existsSync(profile.chromeProfilePath)) {
        const err = new Error(`Session file not found on server: ${profile.chromeProfilePath}. Please re-link this profile by uploading a fresh session file.`);
        await db.update(posts).set({ status: "failed", errorMessage: err.message }).where(eq(posts.id, postId));
        await db.update(socialProfiles).set({ status: "error" }).where(eq(socialProfiles.id, profile.id));
        throw err;
      }

      const isDirectory = fs.lstatSync(profile.chromeProfilePath).isDirectory();
      process.env.DISPLAY = ":99";

      const context = isDirectory
        ? await launchBrowserWithProfile(profile.chromeProfilePath, { headless: false })
        : await launchBrowserWithStorageState(profile.chromeProfilePath, { headless: false });

      try {
        const mediaList = post.mediaUrls as string[];

        if (profile.platform === "facebook") {
          await publishToFacebookSuite(context, post.caption || "", mediaList, ["facebook"], profile.profileId || undefined);
        } else if (profile.platform === "instagram") {
          await publishToInstagram(context, post.caption || "", mediaList);
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

        await db.update(posts).set({
          status: "published",
          publishedAt: new Date(),
          errorMessage: null,
        }).where(eq(posts.id, postId));

        if (profile.status !== "connected") {
          await db.update(socialProfiles).set({ status: "connected" }).where(eq(socialProfiles.id, profile.id));
        }

        if (!isDirectory) {
          try {
            await context.storageState({ path: profile.chromeProfilePath });
          } catch (err: any) {}
        }

        console.log(`🎉 Job succeeded! Post ${postId} is published.`);
      } catch (err: any) {
        console.error(`❌ Job failed for Post ${postId}:`, err.message);

        const errorScreenshot = `error_general_${profile.platform}_${Date.now()}.png`;
        try {
          const pages = context.pages();
          if (pages.length > 0) {
            const lastPage = pages[pages.length - 1];
            await lastPage.screenshot({ path: errorScreenshot, fullPage: true });
            err.message = `${err.message} (Saved screenshot to ${errorScreenshot})`;
          }
        } catch (screenshotErr: any) {}

        await db.update(posts).set({
          status: "failed",
          errorMessage: err.message,
        }).where(eq(posts.id, postId));

        if (/session expired|login session/i.test(err.message || "")) {
          await db.update(socialProfiles).set({ status: "error" }).where(eq(socialProfiles.id, profile.id));
        }

        throw err;
      } finally {
        await context.close().catch(() => {});
      }
    } 
    // If it's a scraping or moderation job
    else if (type === "scrape_ads" || type === "crawl_comments" || type === "scan_dms") {
      const { profileId, dateRange, postUrl } = job.data;
      if (!profileId) return;
      
      const profileRecord = await db.select().from(socialProfiles).where(eq(socialProfiles.id, profileId)).limit(1);
      if (profileRecord.length === 0) return;
      const profile = profileRecord[0];
      
      if (!fs.existsSync(profile.chromeProfilePath)) {
        throw new Error(`Session file not found on server: ${profile.chromeProfilePath}.`);
      }

      if (type === "scrape_ads") {
        // Find the adAccountId dynamically! Wait, we will add it to DB later.
        // For now, we will just call scrapeAdsCSVReport.
        // Wait, how do we pass adAccountId? It will be in the DB.
        // Let's just type cast it for now, assuming we will add it to the DB schema in the next step.
        const adAccountId = (profile as any).adAccountId;
        if (!adAccountId) throw new Error("No Ad Account ID linked to this profile.");
        const csvPath = await scrapeAdsCSVReport(profile.chromeProfilePath, adAccountId, dateRange);
        await parseAndSaveAdsCSV(csvPath, profile.companyId, profile.platform as "meta" | "tiktok" | "google" | "linkedin");
      } else if (type === "crawl_comments") {
        let url = postUrl;
        if (!url) {
          // If no specific postUrl provided, crawl the profile page
          url = profile.platform === 'facebook' ? `https://facebook.com/${profile.profileId}` : `https://instagram.com/${profile.profileId}`;
        }
        await crawlAndReplyComments(profile.chromeProfilePath, url, profile.id, (profile as any).companyId, profile.platform);
      } else if (type === "scan_dms") {
        await scanInboxOnce(profile.chromeProfilePath, profile.platform as any, profile.id);
      }
    } 
    // Handle global cron triggers
    else if (type === "scrape_ads_all" || type === "scrape_organic_all") {
      const allProfiles = await db.select().from(socialProfiles).where(eq(socialProfiles.status, "connected"));
      
      for (const profile of allProfiles) {
        // Log sync job start
        const [jobLog] = await db.insert(syncJobs).values({
          companyId: profile.companyId,
          jobType: type,
          status: "pending",
          startedAt: new Date()
        }).returning();

        try {
          if (type === "scrape_ads_all") {
            const adAccountId = (profile as any).adAccountId;
            if (adAccountId) {
              const csvPath = await scrapeAdsCSVReport(profile.chromeProfilePath, adAccountId, "this_month");
              await parseAndSaveAdsCSV(csvPath, profile.companyId, profile.platform as any);
            }
          } else if (type === "scrape_organic_all") {
            await scrapeOrganicMetrics(profile.companyId, profile.platform as any);
          }
          
          await db.update(syncJobs).set({ status: "success", completedAt: new Date() }).where(eq(syncJobs.id, jobLog.id));
        } catch (err: any) {
          console.error(`Error in ${type} for profile ${profile.id}:`, err);
          await db.update(syncJobs).set({ status: "failed", errorMessage: err.message, completedAt: new Date() }).where(eq(syncJobs.id, jobLog.id));
        }
      }
    }
  },
  {
    connection: connection as any,
    concurrency: 1, // Run one browser posting task at a time to avoid RAM exhaustion on server
  }
);

browserWorker.on("completed", (job) => {
  console.log(`✅ Queue Job ${job.id} completed.`);
});

browserWorker.on("failed", (job, err) => {
  console.error(`❌ Queue Job ${job?.id} failed with error:`, err.message);
});

browserWorker.on("error", (err) => {
  console.warn("⚠️ BullMQ Worker connection error:", err.message);
});
