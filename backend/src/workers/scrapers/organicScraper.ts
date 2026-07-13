import { db } from "../../db/db.js";
import { socialProfiles, socialAnalytics } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";
import { launchBrowserWithStorageState } from "../utils/browserLauncher.js";

declare const document: any;

/**
 * Scrapes basic organic metrics for connected profiles.
 * This is a highly experimental live-verify method.
 */
export async function scrapeOrganicMetrics(companyId: string, platform: "facebook" | "instagram") {
  console.log(`[OrganicScraper] Starting scrape for ${platform} - Company: ${companyId}`);

  const profiles = await db.query.socialProfiles.findMany({
    where: and(
      eq(socialProfiles.companyId, companyId),
      eq(socialProfiles.platform, platform)
    ),
  });

  if (profiles.length === 0) {
    console.log(`[OrganicScraper] No connected ${platform} profiles found for company ${companyId}.`);
    return;
  }

  for (const profile of profiles) {
    if (profile.status !== "connected" || !profile.chromeProfilePath) continue;

    console.log(`[OrganicScraper] Launching browser for profile ID: ${profile.id}`);
    const context = await launchBrowserWithStorageState(profile.chromeProfilePath, { headless: false });
    
    try {
      const page = await context.newPage();
      let followersCount = 0;
      let postsCount = 0;

      if (platform === "instagram") {
        await page.goto("https://www.instagram.com/", { waitUntil: "networkidle" });
        await page.waitForTimeout(3000);
        
        // Try to click on the Profile tab (the bottom left or side menu avatar)
        // Usually href contains the username.
        const profileLink = await page.$('a[href*="/"] img[alt*="profile"]');
        if (profileLink) {
          await profileLink.click();
          await page.waitForTimeout(3000);
          
          // Fallback parsing from meta tags or generic lists
          const headerLists = await page.$$("header ul li");
          if (headerLists.length >= 3) {
            const postsText = await headerLists[0].innerText();
            const followersText = await headerLists[1].innerText();
            
            postsCount = parseInt(postsText.replace(/[^0-9]/g, ""), 10) || 0;
            followersCount = parseInt(followersText.replace(/[^0-9]/g, ""), 10) || 0;
          }
        }
      } else if (platform === "facebook") {
        await page.goto("https://www.facebook.com/me", { waitUntil: "networkidle" });
        await page.waitForTimeout(3000);
        
        // Find follower text (e.g. "1.5K followers")
        const bodyText = await page.evaluate(() => document.body.innerText);
        const followerMatch = bodyText.match(/([\d,.]+[KMB]?)\s*followers?/i);
        
        if (followerMatch) {
          let numStr = followerMatch[1].replace(/,/g, "");
          let multiplier = 1;
          if (numStr.endsWith("K")) multiplier = 1000;
          if (numStr.endsWith("M")) multiplier = 1000000;
          numStr = numStr.replace(/[KMB]/, "");
          followersCount = Math.floor(parseFloat(numStr) * multiplier);
        }
      }

      console.log(`[OrganicScraper] Results for ${profile.id} -> Followers: ${followersCount}, Posts: ${postsCount}`);

      // Insert Analytics
      await db.insert(socialAnalytics).values({
        companyId,
        socialProfileId: profile.id,
        date: new Date(),
        followersCount,
        postsCount,
        reachCount: 0, // Requires Business Suite/Insights API which is too flaky to scrape generically without exact DOMs
        engagementCount: 0
      });

    } catch (e) {
      console.error(`[OrganicScraper] Error scraping ${platform} for profile ${profile.id}:`, e);
    } finally {
      await context.close();
    }
  }
}
