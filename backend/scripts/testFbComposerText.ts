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

  await page.waitForTimeout(10000);

  // Check for iframes
  const iframeCount = await page.locator("iframe").count();
  console.log(`Number of iframes found: ${iframeCount}`);

  const iframesInfo = await page.locator("iframe").evaluateAll(elems =>
    elems.map(el => ({
      id: el.id,
      name: el.getAttribute("name"),
      src: el.getAttribute("src"),
      className: el.className,
      outerHTML: el.outerHTML.slice(0, 300)
    }))
  ).catch(() => []);
  console.log("Iframes details:", JSON.stringify(iframesInfo, null, 2));

  // Let's also check all elements in the main document that have any class containing "editor" or "input" or "text"
  console.log("Checking class names containing 'editor' or 'input' or 'text'...");
  const matchingClasses = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("*"));
    return all
      .filter(el => {
        const cls = el.className || "";
        if (typeof cls !== "string") return false;
        return cls.toLowerCase().includes("editor") || cls.toLowerCase().includes("input") || cls.toLowerCase().includes("textbox");
      })
      .slice(0, 50)
      .map(el => ({
        tagName: el.tagName,
        className: el.className,
        outerHTML: el.outerHTML.slice(0, 200)
      }));
  });
  console.log("Matching elements by class name:", JSON.stringify(matchingClasses, null, 2));

  await context.close();
}

main().catch(console.error);
