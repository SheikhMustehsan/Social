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

  const currentUrl = page.url();
  console.log(`Current URL: ${currentUrl}`);
  if (currentUrl.includes("login")) {
    console.log("❌ Redirected to login page! Session has expired.");
    await page.screenshot({ path: "/home/dccdev/Social/backend/fb_test_login_redirect.png" });
    await context.close();
    return;
  }

  // Print all file inputs currently in DOM
  const initialFileInputs = await page.locator("input[type='file']").count();
  console.log(`Initial input[type='file'] count: ${initialFileInputs}`);

  // Find and click the Add Media button
  console.log("Finding Add Media button...");
  const addMediaBtn = page.getByRole("button", { name: /add photo/i }).first();
  const exists = await addMediaBtn.count();
  console.log(`getByRole button count: ${exists}`);
  if (exists > 0) {
    const text = await addMediaBtn.innerText().catch(() => "");
    const isVisible = await addMediaBtn.isVisible();
    console.log(`Button text: "${text}", visible: ${isVisible}`);
    
    console.log("Clicking Add Media button...");
    await addMediaBtn.click();
    console.log("Clicked! Waiting 5 seconds...");
    await page.waitForTimeout(5000);
    
    // Check file inputs again
    const postClickFileInputs = await page.locator("input[type='file']").count();
    console.log(`Post-click input[type='file'] count: ${postClickFileInputs}`);
    
    // Check if there are other role='menuitem' or dialog elements
    console.log("Checking for popovers/menus...");
    const menuItems = await page.locator("[role='menuitem']").allInnerTexts().catch(() => []);
    console.log("Menu items found:", menuItems);
    
    // Let's dump all inputs
    const inputs = await page.locator("input").evaluateAll(elems => 
      elems.map(el => ({
        type: el.getAttribute("type"),
        accept: el.getAttribute("accept"),
        id: el.id,
        className: el.className,
        outerHTML: el.outerHTML.slice(0, 200)
      }))
    ).catch(() => []);
    console.log("All inputs:", JSON.stringify(inputs, null, 2));

    await page.screenshot({ path: "/home/dccdev/Social/backend/fb_test_post_click.png" });
    console.log("Screenshot saved to /home/dccdev/Social/backend/fb_test_post_click.png");
  } else {
    console.log("❌ Add photo button not found!");
    await page.screenshot({ path: "/home/dccdev/Social/backend/fb_test_no_btn.png" });
  }

  await context.close();
}

main().catch(console.error);
