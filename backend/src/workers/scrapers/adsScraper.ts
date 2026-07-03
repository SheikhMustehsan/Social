import { BrowserContext } from "playwright";
import { launchBrowserWithProfile } from "../utils/browserLauncher.js";
import { syncChromeProfile } from "../utils/profileSync.js";
import path from "path";
import fs from "fs";

export async function scrapeAdsCSVReport(
  profilePath: string,
  adAccountId: string,
  dateRange: "last_30_days" | "this_month" | "last_month" = "last_30_days"
): Promise<string> {
  const tempProfilePath = path.resolve(`./data/profiles/running_ads_scraper_${Date.now()}`);
  const tempDownloadDir = path.resolve("./data/temp");
  
  if (!fs.existsSync(tempDownloadDir)) {
    fs.mkdirSync(tempDownloadDir, { recursive: true });
  }

  // Sync session profiles
  syncChromeProfile(profilePath, tempProfilePath);

  const context = await launchBrowserWithProfile(tempProfilePath, { headless: true });
  const page = await context.newPage();

  try {
    // Navigate directly to the Meta Ads Manager campaigns view for this specific ad account
    const adsManagerUrl = `https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${adAccountId}`;
    console.log(`➡️ Ads Scraper: Navigating to ${adsManagerUrl}...`);
    
    await page.goto(adsManagerUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(60000); // Ads manager is heavy, wait for full load

    // 1. Set Date Range
    console.log("👉 Setting Date Range in Ads Manager...");
    const datePicker = page.locator("[data-testid='date-picker-button'], button:has-text('Last 30 Days'), button:has-text('This Month')").first();
    if (await datePicker.isVisible()) {
      await datePicker.click();
      await page.waitForTimeout(1000);
      
      let dateOptionText = "Last 30 days";
      if (dateRange === "this_month") dateOptionText = "This month";
      if (dateRange === "last_month") dateOptionText = "Last month";

      const option = page.locator(`text=${dateOptionText}`).first();
      if (await option.isVisible()) {
        await option.click();
        await page.waitForTimeout(3000); // Wait for table refresh
      }
    }

    // 2. Trigger CSV Export Download
    console.log("📥 Initiating CSV Export Download...");
    // Find the export dropdown button
    const exportTrigger = page.locator("button[aria-label='Export'], button:has-text('Export')").first();
    await exportTrigger.waitFor({ state: "visible", timeout: 15000 });
    await exportTrigger.click();
    await page.waitForTimeout(1000);

    // Locate the specific export option
    const csvOption = page.locator("text=Export table data, text=Export as CSV, text=CSV").first();
    await csvOption.waitFor({ state: "visible", timeout: 5000 });

    // Setup listener to capture the downloaded file
    const downloadPromise = page.waitForEvent("download", { timeout: 30000 });
    await csvOption.click();
    
    const download = await downloadPromise;
    const finalDownloadPath = path.join(tempDownloadDir, `ads_report_${adAccountId}_${Date.now()}.csv`);
    
    await download.saveAs(finalDownloadPath);
    console.log(`✅ CSV Report downloaded successfully to: ${finalDownloadPath}`);

    return finalDownloadPath;
  } catch (error: any) {
    console.error("❌ Ads CSV scraper failed:", error.message);
    throw error;
  } finally {
    await context.close();
    if (fs.existsSync(tempProfilePath)) {
      fs.rmSync(tempProfilePath, { recursive: true, force: true });
    }
  }
}
