import { chromium } from "playwright";
import path from "path";
import fs from "fs";

async function main() {
  console.log("🚀 Launching browser for DOM inspection on display :99...");
  
  const browser = await chromium.launchPersistentContext(
    "/home/dccdev/Social/backend/data/sessions/server_profile_facebook",
    {
      headless: false,
      args: ["--no-sandbox", "--disable-setuid-sandbox"]
    }
  );

  const page = await browser.newPage();
  
  try {
    console.log("➡️ Navigating to Meta Business Suite Composer...");
    await page.goto("https://business.facebook.com/latest/composer?ref=composer", {
      waitUntil: "networkidle",
      timeout: 60000
    });
    
    await page.waitForTimeout(10000);
    
    console.log("🔎 Current URL:", page.url());
    
    // Dump page title and some DOM info
    const title = await page.title();
    console.log("Page Title:", title);
    
    // Find all input elements and log them
    const inputs = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("input")).map(input => ({
        type: input.type,
        id: input.id,
        className: input.className,
        placeholder: input.placeholder,
        name: input.name
      }));
    });
    console.log("INPUTS FOUND:", JSON.stringify(inputs, null, 2));

    // Find all buttons and log their texts
    const buttons = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("button")).map(btn => ({
        text: btn.textContent || "",
        className: btn.className,
        id: btn.id
      })).slice(0, 30);
    });
    console.log("BUTTONS FOUND (first 30):", JSON.stringify(buttons, null, 2));

    // Take a screenshot of the actual loaded composer page
    // Note: We can disable GPU and make sure the screenshot captures the page correctly
    const screenshotPath = "composer_inspect_snapshot.png";
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Saved composer inspect snapshot to ${screenshotPath}`);

  } catch (error: any) {
    console.error("❌ Inspection failed:", error.message);
  } finally {
    await browser.close();
  }
}

main();
