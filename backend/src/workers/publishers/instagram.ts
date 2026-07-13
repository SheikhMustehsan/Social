import { BrowserContext } from "playwright";
import path from "path";
import fs from "fs";

export async function publishToInstagram(
  context: BrowserContext,
  caption: string,
  mediaPaths: string[]
): Promise<void> {
  const page = await context.newPage();

  try {
    console.log("➡️ Navigating to Instagram...");
    await page.goto("https://www.instagram.com/", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    
    // Give time for the feed to load
    await page.waitForTimeout(5000);

    // 1. Click Create / New Post
    console.log("➡️ Clicking Create button...");
    const createBtn = page.locator('a[href="#"]').filter({ hasText: 'Create' }).first();
    await createBtn.waitFor({ state: "visible", timeout: 15000 });
    await createBtn.click();
    
    // Check if a dropdown appears (sometimes asks "Post" or "Live video")
    // If there is a "Post" option, click it
    const postOption = page.locator('span').filter({ hasText: /^Post$/ }).first();
    const dropdownTriggered = await postOption.waitFor({ state: "visible", timeout: 3000 }).then(() => true).catch(() => false);
    if (dropdownTriggered) {
      console.log("➡️ Selecting 'Post' from Create dropdown...");
      await postOption.click();
    }

    // Wait for the "Create new post" modal
    const selectComputerBtn = page.locator('button:has-text("Select from computer")').first();
    await selectComputerBtn.waitFor({ state: "visible", timeout: 10000 });

    // 2. Upload Media
    console.log(`📸 Uploading ${mediaPaths.length} files to Instagram...`);
    const absolutePaths = mediaPaths.map(p => path.resolve(p));
    for (const p of absolutePaths) {
      if (!fs.existsSync(p)) {
        throw new Error(`Media file not found: ${p}`);
      }
    }

    const fileChooserPromise = page.waitForEvent("filechooser", { timeout: 10000 });
    await selectComputerBtn.click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(absolutePaths);
    
    // Wait for the photo to be rendered in the preview modal
    await page.waitForTimeout(3000);

    const dialog = page.locator('div[role="dialog"]').first();

    // 3. Navigate through the modals (Crop -> Filter -> Caption)
    console.log("➡️ Navigating Crop modal...");
    let nextBtn = dialog.locator('div[role="button"]:has-text("Next"), button:has-text("Next")').first();
    await nextBtn.waitFor({ state: "visible", timeout: 5000 });
    await nextBtn.click({ force: true });
    await page.waitForTimeout(2000);

    console.log("➡️ Navigating Filters modal...");
    // Note: Playwright needs to click the newly rendered Next button
    nextBtn = dialog.locator('div[role="button"]:has-text("Next"), button:has-text("Next")').first();
    await nextBtn.waitFor({ state: "visible", timeout: 5000 });
    await nextBtn.click({ force: true });
    await page.waitForTimeout(2000);

    // 4. Type Caption
    console.log("➡️ Typing caption...");
    // The Instagram caption box is a div with role textbox or aria-label "Write a caption..."
    const captionBox = page.locator('div[aria-label="Write a caption..."], div[role="textbox"]').first();
    await captionBox.waitFor({ state: "visible", timeout: 5000 });
    
    for (const char of caption) {
      await captionBox.type(char, { delay: 30 });
    }
    await page.waitForTimeout(1000);

    // 5. Share
    console.log("🚀 Clicking Share button...");
    const shareBtn = dialog.locator('div[role="button"]:has-text("Share"), button:has-text("Share")').first();
    await shareBtn.waitFor({ state: "visible", timeout: 5000 });
    await shareBtn.click({ force: true });

    // 6. Wait for success confirmation
    console.log("⏳ Waiting for upload to complete...");
    const successMessage = page.getByText("Your post has been shared.");
    await successMessage.waitFor({ state: "visible", timeout: 45000 });
    console.log("✅ Instagram native publication successful!");

    await page.waitForTimeout(3000);

  } catch (error: any) {
    const errorScreenshot = `error_instagram_${Date.now()}.png`;
    try {
      await page.screenshot({ path: errorScreenshot, fullPage: true });
    } catch (e) {}
    console.error(`❌ Instagram native publication failed. Screenshot saved to ${errorScreenshot}`, error);
    throw new Error(`Instagram native publication failed: ${error.message}`);
  } finally {
    await page.close();
  }
}
