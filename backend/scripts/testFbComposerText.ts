import { chromium } from "playwright";
import path from "path";
import fs from "fs";

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
  
  // Extract business_id and asset_id automatically via home redirect
  console.log("➡️ Establishing Meta Business Suite context via Home redirect...");
  await page.goto("https://business.facebook.com/", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  
  await page.waitForURL(url => url.href.includes("business_id"), { timeout: 15000 }).catch(() => null);
  
  const currentUrl = page.url();
  const urlObj = new URL(currentUrl);
  const businessId = urlObj.searchParams.get("business_id");
  const assetId = urlObj.searchParams.get("asset_id");
  
  if (!businessId || !assetId) {
    console.error("❌ Failed to resolve business_id or asset_id. Exiting.");
    await context.close();
    return;
  }
  
  const composerUrl = `https://business.facebook.com/latest/composer?business_id=${businessId}&asset_id=${assetId}&ref=composer`;
  console.log(`➡️ Navigating to Composer: ${composerUrl}`);
  await page.goto(composerUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  
  console.log("Waiting 10 seconds for composer to load...");
  await page.waitForTimeout(10000);

  // 1. Upload Media
  console.log("📸 Uploading file...");
  const addMediaBtn = page.getByRole("button", { name: /add photo/i }).first();
  const exists = await addMediaBtn.count();
  if (exists > 0) {
    const fileChooserPromise = page.waitForEvent("filechooser", { timeout: 5000 }).catch(() => null);
    await addMediaBtn.evaluate(el => (el as HTMLElement).click());
    
    let fileChooser = await fileChooserPromise;
    if (!fileChooser) {
      const firstMenuItem = page.locator("[role='menuitem']").first();
      if (await firstMenuItem.count() > 0) {
        const menuFileChooserPromise = page.waitForEvent("filechooser", { timeout: 10000 });
        await firstMenuItem.click();
        fileChooser = await menuFileChooserPromise;
      }
    }
    
    if (fileChooser) {
      const dummyPath = path.resolve("./data/uploads/7836e118-a14e-422d-b60d-afccf88f163a.jpg");
      await fileChooser.setFiles([dummyPath]);
      console.log("File uploaded! Waiting 15 seconds for upload/preview...");
      await page.waitForTimeout(15000);
    }
  }

  // 2. Type Caption
  console.log("✏️ Typing caption...");
  const textEditor = page.locator("[role='textbox']").first();
  await textEditor.waitFor({ state: "visible", timeout: 10000 });
  const uniqueCaption = `Automated integration test post: ${new Date().toISOString()}`;
  await textEditor.fill(uniqueCaption);
  await page.waitForTimeout(3000);

  // 3. Click Publish
  console.log("🚀 Clicking Publish...");
  const publishBtn = page.locator("button:has-text('Publish')").first();
  await publishBtn.waitFor({ state: "visible", timeout: 5000 });
  
  await page.screenshot({ path: "/home/dccdev/Social/backend/fb_before_publish.png" });
  console.log("Saved fb_before_publish.png screenshot.");

  await publishBtn.click();
  console.log("Publish clicked. Waiting 20 seconds for publication to complete...");
  await page.waitForTimeout(20000);

  await page.screenshot({ path: "/home/dccdev/Social/backend/fb_after_publish.png" });
  console.log("Saved fb_after_publish.png screenshot.");

  await context.close();
}

main().catch(console.error);
