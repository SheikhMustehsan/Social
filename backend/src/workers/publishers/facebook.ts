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

    // A single Meta login can administer many Pages. The composer's "Post to" field is a
    // combobox (div[role="combobox"]) that opens a checklist of div[role="option"] entries
    // (one per Page/Instagram account), where selection state is exposed via aria-selected
    // on the option itself - NOT a child checkbox. Clicking an option TOGGLES it, so an
    // already-selected option must be left alone (clicking it would deselect it).
    // Verified directly against a live Business Suite session - if Meta changes this UI,
    // these selectors will need updating.
    if (pageIdentifier) {
      console.log(`🔎 Selecting target Page: ${pageIdentifier}`);

      const postToCombobox = page.locator('div[role="combobox"]').first();

      try {
        await postToCombobox.waitFor({ state: "visible", timeout: 15000 });
        await postToCombobox.click();
        await page.waitForTimeout(1500);

        const options = page.locator('[role="option"]');
        const optionCount = await options.count();
        let targetFound = false;

        for (let i = 0; i < optionCount; i++) {
          const option = options.nth(i);
          const text = (await option.textContent().catch(() => "")) || "";
          const isSelected = (await option.getAttribute("aria-selected")) === "true";
          const isTarget = text.includes(pageIdentifier);

          if (isTarget) targetFound = true;

          // Select the target if it isn't already; deselect anything else that is
          // selected so the post only goes to the intended Page.
          if (isTarget !== isSelected) {
            await option.click();
            await page.waitForTimeout(800);
          }
        }

        if (!targetFound) {
          throw new Error(`No option matching "${pageIdentifier}" found in the "Post to" dropdown`);
        }

        // Close the dropdown so the combobox label re-renders with the final selection.
        await postToCombobox.click();
        await page.waitForTimeout(1500);
        console.log(`✅ Selected Page: ${pageIdentifier}`);
      } catch (err: any) {
        const errorScreenshot = `error_meta_wrong_page_${Date.now()}.png`;
        await page.screenshot({ path: errorScreenshot });
        throw new Error(
          `Could not select Page "${pageIdentifier}" in the "Post to" dropdown: ${err.message}. Saved screenshot to ${errorScreenshot}. Refusing to post to avoid publishing to the wrong Page.`
        );
      }

      // Confirm the combobox now actually displays the target Page before posting.
      const comboboxText = (await postToCombobox.textContent().catch(() => "")) || "";
      if (!comboboxText.includes(pageIdentifier)) {
        const errorScreenshot = `error_meta_wrong_page_${Date.now()}.png`;
        await page.screenshot({ path: errorScreenshot });
        throw new Error(
          `"Post to" still shows "${comboboxText.trim()}", not "${pageIdentifier}". Saved screenshot to ${errorScreenshot}. Refusing to post to avoid publishing to the wrong Page.`
        );
      }
      console.log(`✅ Confirmed targeting Page: ${pageIdentifier}`);
      // Give the composer workspace ample time to settle and re-render after switching the target Page
      await page.waitForTimeout(5000);
    }

    // 1. Upload Media Files
    if (mediaPaths && mediaPaths.length > 0) {
      console.log(`📸 Uploading ${mediaPaths.length} files to Meta...`);
      
      // Click the Add Photo/Video button to reveal the file input
      const addMediaBtn = page.locator("button:has-text('Add photo/video'), button:has-text('Add Photo'), button:has-text('Add photo')").first();
      await addMediaBtn.waitFor({ state: "visible", timeout: 15000 });
      await addMediaBtn.click();
      
      const fileInput = page.locator("input[type='file']").first();
      await fileInput.waitFor({ state: "attached", timeout: 15000 });
      
      const absolutePaths = mediaPaths.map(p => path.resolve(p));
      for (const p of absolutePaths) {
        if (!fs.existsSync(p)) {
          throw new Error(`Media file not found: ${p}`);
        }
      }
      
      await fileInput.setInputFiles(absolutePaths);
      await page.waitForTimeout(8000); // Wait for upload and preview rendering
    }

    // 2. Write Caption Text
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

    // 3. Click Publish Button
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
