import { chromium } from "playwright";
import path from "path";
import fs from "fs";

async function main() {
  process.env.DISPLAY = ":99";
  const profileDir = path.resolve("/home/dccdev/Social/backend/data/sessions/server_profile_facebook");
  
  console.log(`🚀 Launching Playwright with profile: ${profileDir}`);
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
  console.log("➡️ Navigating to Meta Business Suite Composer...");
  await page.goto("https://business.facebook.com/latest/composer?ref=composer", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  console.log("Waiting 10 seconds for the page to fully render...");
  await page.waitForTimeout(10000);

  // 1. Upload Media
  console.log("Uploading file...");
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
      console.log("File uploaded! Waiting 10 seconds for upload/render to settle...");
      await page.waitForTimeout(10000);
    }
  }

  // 2. Find and check textboxes
  console.log("Dumping all textboxes and textareas...");
  
  // Method A: [role='textbox']
  const textboxes = await page.locator("[role='textbox']").evaluateAll(elems =>
    elems.map(el => ({
      tagName: el.tagName,
      role: el.getAttribute("role"),
      className: el.className,
      outerHTML: el.outerHTML.slice(0, 300),
      isVisible: (el as HTMLElement).offsetHeight > 0 && (el as HTMLElement).offsetWidth > 0
    }))
  ).catch(() => []);
  console.log("[role='textbox'] elements:", JSON.stringify(textboxes, null, 2));

  // Method B: Contenteditable divs
  const contenteditables = await page.locator("[contenteditable='true']").evaluateAll(elems =>
    elems.map(el => ({
      tagName: el.tagName,
      className: el.className,
      outerHTML: el.outerHTML.slice(0, 300),
      isVisible: (el as HTMLElement).offsetHeight > 0 && (el as HTMLElement).offsetWidth > 0
    }))
  ).catch(() => []);
  console.log("contenteditable='true' elements:", JSON.stringify(contenteditables, null, 2));

  // Method C: textarea
  const textareas = await page.locator("textarea").evaluateAll(elems =>
    elems.map(el => ({
      className: el.className,
      outerHTML: el.outerHTML.slice(0, 300),
      isVisible: (el as HTMLElement).offsetHeight > 0 && (el as HTMLElement).offsetWidth > 0
    }))
  ).catch(() => []);
  console.log("textarea elements:", JSON.stringify(textareas, null, 2));

  await page.screenshot({ path: "/home/dccdev/Social/backend/fb_textbox_test.png" });
  console.log("Saved screenshot to /home/dccdev/Social/backend/fb_textbox_test.png");

  await context.close();
}

main().catch(console.error);
