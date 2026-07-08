import { BrowserContext } from "playwright";
import path from "path";
import fs from "fs";

export async function publishToLinkedIn(
  context: BrowserContext,
  caption: string,
  mediaPaths: string[],
  pageIdentifier?: string
): Promise<void> {
  const page = await context.newPage();

  try {
    // One LinkedIn login can administer many Company Pages. If we know the target Page,
    // go straight to that Page's admin composer instead of the personal feed - otherwise
    // this would always post as the person, never as the Page.
    let targetUrl = "https://www.linkedin.com/feed/";
    if (pageIdentifier) {
      const slugMatch = pageIdentifier.match(/linkedin\.com\/company\/([^/?#]+)/i);
      const companySlug = slugMatch ? slugMatch[1] : pageIdentifier.trim();
      targetUrl = `https://www.linkedin.com/company/${companySlug}/admin/page-posts/published/`;
    }

    console.log(`➡️ Navigating to LinkedIn ${pageIdentifier ? `Company Page admin (${pageIdentifier})` : "personal feed"}...`);
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(3000);

    // Verify if logged in / has admin access by checking for the post box trigger.
    // NOTE: the Company Page admin dashboard's trigger wording/selector may differ from
    // the personal feed's "Start a post" button - adjust to match LinkedIn's current UI
    // if this fails to find it despite valid credentials and admin access.
    const postTrigger = page.locator("button:has-text('Start a post'), button:has-text('Create a post')").first();
    
    try {
      await postTrigger.waitFor({ state: "visible", timeout: 25000 });
    } catch (err) {
      const currentUrl = page.url();
      const errorScreenshot = `error_linkedin_login_${Date.now()}.png`;
      await page.screenshot({ path: errorScreenshot });
      if (pageIdentifier) {
        throw new Error(
          `Could not open the post composer for LinkedIn Company Page "${pageIdentifier}". Current URL: ${currentUrl}. This means either the login session expired, the account lacks admin access to that Page, or the Page URL/ID is wrong. Saved screenshot to ${errorScreenshot}`
        );
      }
      throw new Error(`LinkedIn Login Session expired. Current URL: ${currentUrl}. Saved login error screenshot to ${errorScreenshot}`);
    }

    console.log("👉 Opening share modal...");
    await postTrigger.click();
    // The personal feed's inline composer uses .share-box-feed-entry__container, but the
    // Company Page admin dashboard opens a real [role="dialog"] modal instead - match both.
    await page.waitForSelector('.share-box-feed-entry__container, [role="dialog"]', { state: "visible", timeout: 10000 });
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
      const nextBtn = page.getByRole("button", { name: "Next" });
      try {
        await nextBtn.waitFor({ state: "visible", timeout: 8000 });
        await nextBtn.click();
        await page.waitForTimeout(1000);
      } catch (e) {
        console.log("No Next button found, proceeding...");
      }
    }

    // 2. Write Caption
    console.log("✏️ Typing post caption...");
    const editor = page.locator("div[role='textbox']").first();
    await editor.waitFor({ state: "visible", timeout: 15000 });
    await editor.click();
    await page.waitForTimeout(500);

    // Clear any existing text
    await editor.fill("");
    
    // Type caption character by character to mimic human behavior
    for (const char of caption) {
      await editor.type(char, { delay: 30 });
    }
    await page.waitForTimeout(2000);

    // 3. Post!
    console.log("🚀 Clicking LinkedIn Publish...");
    const postBtn = page.getByRole("button", { name: "Post", exact: true }).first();
    await postBtn.waitFor({ state: "visible", timeout: 10000 });
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
