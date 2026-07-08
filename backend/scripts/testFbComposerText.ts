import { chromium } from "playwright";
import path from "path";

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
  
  // Listen for console logs and errors
  page.on("console", msg => {
    if (msg.type() === "error" || msg.type() === "warning") {
      console.log(`[Browser Console ${msg.type().toUpperCase()}] ${msg.text()}`);
    }
  });

  // Listen for page errors
  page.on("pageerror", err => {
    console.log(`[Browser Page Error] ${err.message}`);
  });

  // Listen for failed network requests
  page.on("requestfailed", req => {
    console.log(`[Browser Network Failed] ${req.url()} - ${req.failure()?.errorText}`);
  });

  console.log("➡️ Navigating to Meta Business Suite Composer...");
  await page.goto("https://business.facebook.com/latest/composer?ref=composer", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  console.log("Waiting 15 seconds for page to load and logs to settle...");
  await page.waitForTimeout(15000);

  await context.close();
}

main().catch(console.error);
