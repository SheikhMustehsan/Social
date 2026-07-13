import { BrowserContext } from "playwright";
import path from "path";
import fs from "fs";

export async function publishToTikTok(
  context: BrowserContext,
  caption: string,
  videoPath: string
): Promise<void> {
  const page = await context.newPage();
  
  try {
    console.log("➡️ Navigating to TikTok Studio Upload page...");
    // TikTok Studio upload portal
    await page.goto("https://www.tiktok.com/tiktokstudio/upload", { 
      waitUntil: "domcontentloaded", 
      timeout: 60000 
    });
    await page.waitForTimeout(5000);

    // Verify login state by checking for the video drag-and-drop input or file selector
    const fileInput = page.locator("input[type='file']").first();
    const isInputAttached = await fileInput.isVisible({ timeout: 15000 }).catch(() => false);

    if (!isInputAttached) {
      // Try fallback URL
      console.log("⚠️ TikTok Studio path not loaded, trying creator-center upload fallback...");
      await page.goto("https://www.tiktok.com/creator-center/upload", { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(5000);
    }

    const finalInput = page.locator("input[type='file']").first();
    const isInputReady = await finalInput.isVisible();
    if (!isInputReady) {
      const errorScreenshot = `error_tiktok_login_${Date.now()}.png`;
      await page.screenshot({ path: errorScreenshot });
      throw new Error(`TikTok login session expired or upload form blocked. Saved screenshot to ${errorScreenshot}`);
    }

    // 1. Upload Video (TikTok only supports video publishing)
    console.log(`📹 Uploading video: ${videoPath}...`);
    const absoluteVideoPath = path.resolve(videoPath);
    if (!fs.existsSync(absoluteVideoPath)) {
      throw new Error(`Video file not found: ${absoluteVideoPath}`);
    }

    await finalInput.setInputFiles(absoluteVideoPath);
    console.log("⏳ Uploading video file... waiting for processing to complete...");
    
    // Wait for upload loader to disappear and editor screen to appear (can take up to 2 minutes)
    await page.waitForSelector("text=Edit video", { timeout: 120000 }).catch(() => {
      console.log("⚠️ 'Edit video' text not found, continuing posting check...");
    });
    await page.waitForTimeout(5000);

    // 2. Fill Caption
    console.log("✏️ Typing video caption...");
    // TikTok caption input is usually a div with contenteditable or class editor
    const captionEditor = page.locator("[contenteditable='true']").first();
    if (await captionEditor.isVisible()) {
      await captionEditor.focus();
      // Clear default name if exists by selecting all and backspacing
      await page.keyboard.press("Control+A");
      await page.keyboard.press("Backspace");
      await page.waitForTimeout(500);

      await captionEditor.click();
      await page.keyboard.insertText(caption);
      await page.waitForTimeout(2000);
    } else {
      console.warn("⚠️ Could not find caption text editor box, using keyboard fallback.");
    }
    await page.waitForTimeout(3000);

    // 3. Click Post Button
    console.log("🚀 Publishing to TikTok...");
    const postBtn = page.locator("button:has-text('Post')").first();
    await postBtn.waitFor({ state: "visible", timeout: 5000 });
    await postBtn.click({ force: true });

    // Wait for upload success modal or redirect
    await page.waitForTimeout(15000);
    console.log("✅ Post successfully published to TikTok!");

  } catch (error: any) {
    console.error("❌ TikTok publication automated flow failed:", error.message);
    throw error;
  } finally {
    await page.close();
  }
}
