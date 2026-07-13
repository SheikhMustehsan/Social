import { browserQueue } from "./queue.js";

// Schedules repeatable jobs for scraping ads and organic metrics
export async function setupCronJobs() {
  console.log("⏰ Setting up recurring cron jobs...");
  
  // Every night at 2:00 AM
  await browserQueue.add("scrape_ads_cron", { type: "scrape_ads_all", dateRange: "this_month" }, {
    repeat: { pattern: "0 2 * * *" }
  });

  // Every night at 3:00 AM
  await browserQueue.add("scrape_organic_cron", { type: "scrape_organic_all" }, {
    repeat: { pattern: "0 3 * * *" }
  });

  // Every hour for Auto-Moderation
  await browserQueue.add("scan_dms_cron", { type: "scan_dms_all" }, {
    repeat: { pattern: "0 * * * *" }
  });
  
  await browserQueue.add("crawl_comments_cron", { type: "crawl_comments_all" }, {
    repeat: { pattern: "0 * * * *" }
  });

  console.log("✅ Cron jobs scheduled.");
}
