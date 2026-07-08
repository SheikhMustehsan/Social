import { chromium } from "playwright";
import path from "path";

async function main() {
  process.env.DISPLAY = ":99";
  const profileDir = path.resolve("/home/dccdev/Social/backend/data/sessions/server_profile_facebook");
  
  const args = [
    "--disable-blink-features=AutomationControlled",
    "--disable-infobars",
    "--start-maximized",
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-web-security",
    "--allow-running-insecure-content",
    "--profile-directory=Default",
  ];
  
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1280, height: 800 },
    locale: "en-US",
    args,
    ignoreHTTPSErrors: true,
  });

  const page = await context.newPage();
  
  page.on("console", msg => {
    if (msg.type() === "error") {
      console.log(`[Browser Console ERROR] ${msg.text()}`);
    }
  });

  console.log("➡️ Navigating to Meta Business Suite Home...");
  await page.goto("https://business.facebook.com/", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  console.log("Waiting 8 seconds for home page redirect...");
  await page.waitForTimeout(8000);

  const homeUrl = page.url();
  console.log(`🏠 Current URL: ${homeUrl}`);

  // Extract parameters
  const urlObj = new URL(homeUrl);
  const businessId = urlObj.searchParams.get("business_id");
  const assetId = urlObj.searchParams.get("asset_id");
  console.log(`Extracted business_id: ${businessId}, asset_id: ${assetId}`);

  if (businessId) {
    let composerUrl = `https://business.facebook.com/latest/composer?business_id=${businessId}&ref=composer`;
    if (assetId) {
      composerUrl += `&asset_id=${assetId}`;
    }
    
    console.log(`➡️ Navigating to Composer: ${composerUrl}`);
    await page.goto(composerUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    
    console.log("Waiting 10 seconds for composer to load...");
    await page.waitForTimeout(10000);
    
    const textboxCount = await page.locator("[role='textbox']").count();
    console.log(`[role='textbox'] elements found: ${textboxCount}`);
    
    const placeholders = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("*"))
        .filter(el => el.hasAttribute("placeholder") || el.outerHTML.toLowerCase().includes("write something"))
        .map(el => el.outerHTML.slice(0, 200));
    });
    console.log("Placeholders found:", placeholders);
    
    await page.screenshot({ path: "/home/dccdev/Social/backend/fb_composer_business_id.png" });
    console.log("Saved screenshot to /home/dccdev/Social/backend/fb_composer_business_id.png");
  } else {
    console.log("❌ Could not extract business_id.");
  }

  await context.close();
}

main().catch(console.error);
