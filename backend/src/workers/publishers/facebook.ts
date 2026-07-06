import { BrowserContext } from "playwright";
import path from "path";
import fs from "fs";

export async function publishToFacebookSuite(
  context: BrowserContext,
  caption: string,
  mediaPaths: string[],
  placements: ("facebook" | "instagram")[] = ["facebook"],
  pageIdentifier?: string
): Promise<void> {
  const page = await context.newPage();

  try {
    console.log("➡️ Navigating to Meta Business Suite Composer...");
    // Go directly to Meta Business Suite composer editor
    await page.goto("https://business.facebook.com/latest/composer?ref=composer", {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });
    await page.waitForTimeout(5000);

    // Verify login state
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(5000); // Give it a moment to resolve any redirects
    const currentUrl = page.url();
    if (currentUrl.includes("login") || currentUrl.includes("signin") || currentUrl.includes("loginpage")) {
      const errorScreenshot = `error_meta_login_${Date.now()}.png`;
      await page.screenshot({ path: errorScreenshot });
      throw new Error(`Meta Business Suite session expired. Redirected to login: ${currentUrl}. Saved screenshot to ${errorScreenshot}`);
    }

    // A single Meta login can administer many Pages, and the composer defaults to
    // whichever Page/account was last active in Business Suite. If we know the target
    // Page, explicitly switch to it via the account switcher before doing anything else.
    if (pageIdentifier) {
      console.log(`🔎 Selecting target Page: ${pageIdentifier}`);
      
      const accountSwitcher = page.locator(
        "[aria-label='Business Account'], [aria-label='Accounts'], [aria-label='Switch accounts'], div[role='button']:has-text('Switch')"
      ).first();

      try {
        // Wait for switcher to be attached (loaded in DOM) and click it
        await accountSwitcher.waitFor({ state: "attached", timeout: 25000 });
        await accountSwitcher.click();
        await page.waitForTimeout(2000);

        // Target the specific option inside the visible dropdown menu
        const pageOption = page.locator([
          `[role="menu"] text="${pageIdentifier}"`,
          `[role="listbox"] text="${pageIdentifier}"`,
          `[role="dialog"] text="${pageIdentifier}"`,
          `text="${pageIdentifier}"`
        ].join(", ")).locator("visible=true").first();

        await pageOption.waitFor({ state: "visible", timeout: 12000 });
        await pageOption.click();
        console.log(`✅ Clicked Page switcher option for: ${pageIdentifier}`);
        await page.waitForTimeout(4000);
      } catch (err: any) {
        console.log(`⚠️ Switcher not found or failed to select page: ${err.message}. Proceeding with active selection...`);
      }

      // Confirm the target Page name is now showing somewhere in the composer workspace before posting.
      try {
        // Look for page name in main header/composer view
        const composerHeader = page.locator(
          `[role='main']:has-text("${pageIdentifier}"), .composer-header:has-text("${pageIdentifier}"), text="${pageIdentifier}"`
        ).first();
        await composerHeader.waitFor({ state: "visible", timeout: 15000 });
        console.log(`✅ Confirmed targeting Page: ${pageIdentifier}`);
      } catch (err) {
        const errorScreenshot = `error_meta_wrong_page_${Date.now()}.png`;
        await page.screenshot({ path: errorScreenshot });
        throw new Error(
          `Could not confirm the composer is targeting Page "${pageIdentifier}". Saved screenshot to ${errorScreenshot}. Refusing to post to avoid publishing to the wrong Page.`
        );
      }
    }

    // 1. Choose placements (FB / IG checkboxes)
    console.log("👉 Checking placements...");
    // Open placement dropdown if closed
    const placementDropdown = page.locator("[aria-label='Post to']").first();
    if (await placementDropdown.isVisible()) {
      await placementDropdown.click();
      await page.waitForTimeout(1000);
    }

    // Check / uncheck placements based on requirements
    if (placements.includes("facebook")) {
      const fbCheckbox = page.locator("text=Facebook Page").first(); // Customize based on DOM
      if (await fbCheckbox.isVisible()) {
        const isChecked = await fbCheckbox.getAttribute("aria-checked");
        if (isChecked !== "true") await fbCheckbox.click();
      }
    }
    if (placements.includes("instagram")) {
      const igCheckbox = page.locator("text=Instagram").first();
      if (await igCheckbox.isVisible()) {
        const isChecked = await igCheckbox.getAttribute("aria-checked");
        if (isChecked !== "true") await igCheckbox.click();
      }
    }

    // Close placement dropdown if opened
    if (await placementDropdown.isVisible()) {
      await placementDropdown.click();
      await page.waitForTimeout(1000);
    }

    // 2. Upload Media Files
    if (mediaPaths && mediaPaths.length > 0) {
      console.log(`📸 Uploading ${mediaPaths.length} files to Meta...`);
      // Find Add Photo button (often a file input or click trigger)
      const fileInput = page.locator("input[type='file']").first();
      await fileInput.waitFor({ state: "attached", timeout: 10000 });
      
      const absolutePaths = mediaPaths.map(p => path.resolve(p));
      for (const p of absolutePaths) {
        if (!fs.existsSync(p)) {
          throw new Error(`Media file not found: ${p}`);
        }
      }
      
      await fileInput.setInputFiles(absolutePaths);
      await page.waitForTimeout(8000); // Wait for upload and preview rendering
    }

    // 3. Write Caption Text
    console.log("✏️ Writing caption to composer...");
    const textEditor = page.locator("[role='textbox']").first();
    await textEditor.waitFor({ state: "attached", timeout: 15000 });
    await textEditor.scrollIntoViewIfNeeded();
    await textEditor.waitFor({ state: "visible", timeout: 5000 });
    await textEditor.focus();

    for (const char of caption) {
      await page.keyboard.write(char);
      await page.waitForTimeout(Math.floor(Math.random() * 60) + 30);
    }
    await page.waitForTimeout(3000);

    // 4. Click Publish Button
    console.log("🚀 Publishing to Meta Page...");
    const publishBtn = page.locator("button:has-text('Publish')").first();
    await publishBtn.waitFor({ state: "visible", timeout: 5000 });
    await publishBtn.click();

    // Wait for the server upload confirmation/routing change
    await page.waitForTimeout(12000);
    console.log("✅ Post successfully published to Meta!");

  } catch (error: any) {
    console.error("❌ Meta publication automated flow failed:", error.message);
    throw error;
  } finally {
    await page.close();
  }
}
