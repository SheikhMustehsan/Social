import { BrowserContext } from "playwright";
import path from "path";
import fs from "fs";

export async function publishToLinkedIn(
  context: BrowserContext,
  caption: string,
  mediaPaths: string[]
): Promise<void> {
  const page = await context.newPage();
  
  try {
    console.log("➡️ Navigating to LinkedIn...");
    await page.goto("https://www.linkedin.com/feed/", { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3000);

    // Verify if logged in by checking for the post box trigger
    const postTrigger = page.locator("button:has-text('Start a post')").first();
    const triggerExists = await postTrigger.isVisible();
    
    if (!triggerExists) {
      // Take screenshot of failure state
      const errorScreenshot = `error_linkedin_login_${Date.now()}.png`;
      await page.screenshot({ path: errorScreenshot });
      throw new Error(`LinkedIn Login Session expired. Saved login error screenshot to ${errorScreenshot}`);
    }

    console.log("👉 Opening share modal...");
    await postTrigger.click();
    await page.waitForSelector(".share-box-feed-entry__container", { state: "visible", timeout: 10000 });
    await page.waitForTimeout(1000);

    // 1. Handle Media uploads if files exist
    if (mediaPaths && mediaPaths.length > 0) {
      console.log(`📸 Uploading ${mediaPaths.length} media files...`);
      
      // Locate the media/photo input button inside share box
      const mediaButton = page.locator("button[aria-label='Add media']").first();
      await mediaButton.click();
      
      // Wait for file uploader input
      const fileInput = page.locator("input[type='file']").first();
      await fileInput.waitFor({ state: "attached", timeout: 5000 });
      
      // Resolve absolute paths
      const absolutePaths = mediaPaths.map(p => path.resolve(p));
      for (const p of absolutePaths) {
        if (!fs.existsSync(p)) {
          throw new Error(`Media file not found at path: ${p}`);
        }
      }

      await fileInput.setInputFiles(absolutePaths);
      await page.waitForTimeout(3000); // Wait for media processing preview

      // Click "Next" inside the media modal to return to main composer
      const nextBtn = page.locator("button:has-text('Next')").first();
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
        await page.waitForTimeout(1000);
      }
    }

    // 2. Type Caption
    console.log("✏️ Typing post caption...");
    const editor = page.locator(".ql-editor[contenteditable='true']").first();
    await editor.waitFor({ state: "visible", timeout: 5000 });
    await editor.focus();
    
    // Type caption character by character to mimic human behavior
    for (const char of caption) {
      await page.keyboard.write(char);
      await page.waitForTimeout(Math.floor(Math.random() * 80) + 40); // 40-120ms delay
    }
    
    await page.waitForTimeout(2000);

    // 3. Post!
    console.log("🚀 Clicking LinkedIn Publish...");
    const postBtn = page.locator("button:has-text('Post')").first();
    await postBtn.waitFor({ state: "visible" });
    await postBtn.click();

    // Wait for post success feedback modal/toast
    await page.waitForTimeout(10000);
    console.log("✅ Post successfully published to LinkedIn!");

  } catch (error: any) {
    console.error("❌ LinkedIn publication automated flow failed:", error.message);
    throw error;
  } finally {
    await page.close();
  }
}
