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
      console.log("File uploaded! Waiting 15 seconds for upload and UI rendering...");
      await page.waitForTimeout(15000);
    }
  }

  // 2. Scroll all scrollable elements down
  console.log("Scrolling all scrollable elements down...");
  await page.evaluate(() => {
    const scrollableDivs = Array.from(document.querySelectorAll("div"));
    for (const div of scrollableDivs) {
      if (div.scrollHeight > div.clientHeight) {
        div.scrollTop = div.scrollHeight;
      }
    }
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(3000);

  // 3. Scan DOM for textboxes/inputs
  console.log("Scanning DOM for inputs/textboxes...");
  const domReport = await page.evaluate(() => {
    const elements = Array.from(document.querySelectorAll("*"));
    const results = [];
    for (const el of elements) {
      const attributes: Record<string, string> = {};
      for (let i = 0; i < el.attributes.length; i++) {
        const attr = el.attributes[i];
        attributes[attr.name] = attr.value;
      }
      const text = el.textContent?.trim() || "";
      if (
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.hasAttribute("contenteditable") ||
        el.getAttribute("role") === "textbox" ||
        el.outerHTML.toLowerCase().includes("placeholder")
      ) {
        results.push({
          tagName: el.tagName,
          id: el.id,
          className: el.className,
          attributes,
          text: text.slice(0, 100),
          outerHTML: el.outerHTML.slice(0, 300)
        });
      }
    }
    return results;
  });

  console.log("🔍 Scanned inputs/textboxes:", JSON.stringify(domReport, null, 2));

  await page.screenshot({ path: "/home/dccdev/Social/backend/fb_textbox_scroll.png" });
  console.log("Saved screenshot to /home/dccdev/Social/backend/fb_textbox_scroll.png");

  await context.close();
}

main().catch(console.error);
