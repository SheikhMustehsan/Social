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
    const html = await addMediaBtn.evaluate(el => el.outerHTML).catch(() => "");
    console.log(`Button outerHTML: ${html}`);
    const parentHtml = await addMediaBtn.evaluate(el => el.parentElement ? el.parentElement.outerHTML.slice(0, 500) : "").catch(() => "");
    console.log(`Button parent HTML (first 500 chars): ${parentHtml}`);
    
    const isVisible = await addMediaBtn.isVisible();
    console.log(`Button visible: ${isVisible}`);
    
    await page.screenshot({ path: "/home/dccdev/Social/backend/fb_test_pre_click.png" });
    console.log("Screenshot saved to /home/dccdev/Social/backend/fb_test_pre_click.png");
    
    console.log("Listening for filechooser event...");
    const fileChooserPromise = page.waitForEvent("filechooser", { timeout: 10000 }).catch(() => null);
    
    console.log("Clicking Add Media button (JS click)...");
    await addMediaBtn.evaluate(el => (el as HTMLElement).click());
    
    const fileChooser = await fileChooserPromise;
    if (fileChooser) {
      console.log("✅ Success! Captured native filechooser event.");
      // We can upload a dummy file to test
      const dummyPath = path.resolve("./data/uploads/7836e118-a14e-422d-b60d-afccf88f163a.jpg");
      if (fs.existsSync(dummyPath)) {
        await fileChooser.setFiles([dummyPath]);
        console.log("Dummy file set via filechooser.");
      } else {
        console.log(`Dummy file not found at ${dummyPath}`);
      }
    } else {
      console.log("❌ No filechooser event captured.");
    }
    
    // Check file inputs again
    const postClickFileInputs = await page.locator("input[type='file']").count();
    console.log(`Final input[type='file'] count: ${postClickFileInputs}`);
    
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
