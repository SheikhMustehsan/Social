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
    console.log("➡️ Establishing Meta Business Suite context via Home redirect...");
    await page.goto("https://business.facebook.com/", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    
    // Wait for the redirect to establish business_id in the URL
    await page.waitForURL(url => url.href.includes("business_id"), { timeout: 15000 }).catch(() => null);
    
    const currentUrl = page.url();
    const urlObj = new URL(currentUrl);
    const businessId = urlObj.searchParams.get("business_id");
    const assetId = urlObj.searchParams.get("asset_id");
    
    let composerUrl = "https://business.facebook.com/latest/composer?ref=composer";
    if (businessId) {
      console.log(`💼 Extracted business_id: ${businessId}`);
      composerUrl += `&business_id=${businessId}`;
      if (assetId) {
        console.log(`📄 Extracted asset_id: ${assetId}`);
        composerUrl += `&asset_id=${assetId}`;
      }
    } else {
      console.warn("⚠️ Could not extract business_id from redirect. Falling back to default composer URL.");
    }
    
    console.log(`➡️ Navigating to Meta Business Suite Composer: ${composerUrl}`);
    await page.goto(composerUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(5000);

    // Verify login state
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(5000); // Give it a moment to resolve any redirects
    const postComposerUrl = page.url();
    if (postComposerUrl.includes("login") || postComposerUrl.includes("signin") || postComposerUrl.includes("loginpage")) {
      const errorScreenshot = `error_meta_login_${Date.now()}.png`;
      await page.screenshot({ path: errorScreenshot });
      throw new Error(`Meta Business Suite session expired. Redirected to login: ${postComposerUrl}. Saved screenshot to ${errorScreenshot}`);
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
          const html = (await option.innerHTML().catch(() => "")) || "";
          
          const isFbOption = html.toLowerCase().includes("facebook");
          const isIgOption = html.toLowerCase().includes("instagram");

          // A single Business Manager can list multiple Facebook Pages (one per
          // client company) - matching on "is this a Facebook option" alone isn't
          // enough to pick the right one, it must also match the target Page name.
          const nameMatches = pageIdentifier ? text.includes(pageIdentifier) : true;
          const isFbTarget = placements.includes("facebook") && isFbOption && nameMatches;
          const isIgTarget = placements.includes("instagram") && isIgOption && nameMatches;

          const isTarget = isFbTarget || isIgTarget;

          if (isTarget) targetFound = true;

          const isSelected = (await option.getAttribute("aria-selected")) === "true";

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

      const comboboxText = (await postToCombobox.textContent().catch(() => "")) || "";
      if (pageIdentifier && !comboboxText.includes(pageIdentifier)) {
        const errorScreenshot = `error_meta_wrong_page_${Date.now()}.png`;
        await page.screenshot({ path: errorScreenshot });
        throw new Error(
          `"Post to" shows "${comboboxText.trim()}", not "${pageIdentifier}". Saved screenshot to ${errorScreenshot}. Refusing to post to avoid publishing to the wrong Page.`
        );
      }
      console.log(`✅ Confirmed targeting Page dropdown text: ${comboboxText.trim()}`);
      // Give the composer workspace ample time to settle and re-render after switching the target Page
      await page.waitForTimeout(5000);
    }

    // 1. Upload Media Files
    if (mediaPaths && mediaPaths.length > 0) {
      console.log(`📸 Uploading ${mediaPaths.length} files to Meta...`);
      
      // Click the Add Photo/Video button to reveal the file input. Meta's composer uses
      // div[role="button"] here, not a real <button> tag - matched by aria role, not tag name.
      // We use JS evaluate click to ensure the React event listener is triggered reliably.
      const addMediaBtn = page.getByRole("button", { name: /add photo/i }).first();
      await addMediaBtn.waitFor({ state: "visible", timeout: 15000 });
      
      const absolutePaths = mediaPaths.map(p => path.resolve(p));
      for (const p of absolutePaths) {
        if (!fs.existsSync(p)) {
          throw new Error(`Media file not found: ${p}`);
        }
      }

      // Start listening for file chooser event
      const fileChooserPromise = page.waitForEvent("filechooser", { timeout: 5000 }).catch(() => null);
      
      console.log("Clicking Add Media button...");
      await addMediaBtn.evaluate(el => (el as HTMLElement).click());
      
      let fileChooser = await fileChooserPromise;
      if (!fileChooser) {
        // If direct click did not trigger a file chooser, a popover menu has opened instead.
        // We find the menu item and click it to open the file chooser.
        const firstMenuItem = page.locator("[role='menuitem']").first();
        if (await firstMenuItem.count() > 0) {
          console.log("👉 Dropdown menu detected. Clicking menu item to trigger file chooser...");
          const menuFileChooserPromise = page.waitForEvent("filechooser", { timeout: 10000 });
          await firstMenuItem.click();
          fileChooser = await menuFileChooserPromise;
        }
      }
      
      if (!fileChooser) {
        throw new Error("Could not trigger or capture the file chooser dialog in Meta composer.");
      }
      
      console.log("Setting input files...");
      await fileChooser.setFiles(absolutePaths);
      await page.waitForTimeout(8000); // Wait for upload and preview rendering
    }

    // 2. Write Caption Text
    console.log("✏️ Writing caption to composer...");
    
    // Facebook recently introduced a bug where the unified text box is completely missing
    // if the "Customise post" toggle is off. We must turn it ON, and type in both tabs.
    const customiseToggle = page.locator("input[aria-label='Customise post for Facebook and Instagram'], [role='switch']:has-text('Customise'), div[role='button']:has-text('Customise post')").first();
    
    // STRICTLY look for role='tab' to avoid matching "Facebook Feed preview" spans
    const fbTab = page.locator("div[role='tab']").filter({ hasText: /^Facebook$/ }).first();
    const igTab = page.locator("div[role='tab']").filter({ hasText: /^Instagram$/ }).first();

    // Check if the tabs are already visible. If not, try to click the toggle.
    const tabsVisible = (await fbTab.isVisible()) || (await igTab.isVisible());
    
    if (!tabsVisible && await customiseToggle.isVisible()) {
      console.log("➡️ Customise toggle is off. Clicking to reveal tabs...");
      await customiseToggle.click({ force: true });
      await page.waitForTimeout(2000);
    }

    if ((await fbTab.isVisible()) || (await igTab.isVisible())) {
      // Fill Facebook Tab
      if (await fbTab.isVisible()) {
        await fbTab.click();
        await page.waitForTimeout(1000);
        // Match only visible contenteditable elements to avoid hidden alt-text inputs from media uploads
        const fbTextBox = page.locator("div[contenteditable='true']:visible, div[role='textbox']:visible, div[role='combobox']:visible").first();
        await fbTextBox.waitFor({ state: "visible", timeout: 10000 });
        for (const char of caption) {
          await fbTextBox.type(char, { delay: 30 });
        }
      }

      // Fill Instagram Tab
      if (await igTab.isVisible()) {
        await igTab.click();
        await page.waitForTimeout(1000);
        const igTextBox = page.locator("div[contenteditable='true']:visible, div[role='textbox']:visible, div[role='combobox']:visible").first();
        await igTextBox.waitFor({ state: "visible", timeout: 10000 });
        for (const char of caption) {
          await igTextBox.type(char, { delay: 30 });
        }
      }
    } else {
      // Fallback: unified text box is somehow visible
      const textBox = page.locator("div[contenteditable='true']:visible, div[role='textbox']:visible, div[role='combobox']:visible").first();
      await textBox.waitFor({ state: "visible", timeout: 15000 });
      for (const char of caption) {
        await textBox.type(char, { delay: 30 });
      }
    }
    await page.waitForTimeout(3000);

    // 3. Click Publish Button
    console.log("🚀 Publishing to Meta Page...");
    const publishBtn = page.locator("div[role='button'], button").filter({ hasText: /^(Publish|Schedule|Post)$/i }).first();
    await publishBtn.waitFor({ state: "visible", timeout: 10000 });
    await publishBtn.click();

    // Wait for the server upload confirmation/routing change
    await page.waitForTimeout(12000);
    console.log("✅ Post successfully published to Facebook and/or Instagram!");

  } catch (error: any) {
    console.error("❌ Meta publication automated flow failed:", error.message);
    throw error;
  } finally {
    await page.close();
  }
}
