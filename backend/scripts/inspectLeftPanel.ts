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
  await page.goto("https://business.facebook.com/latest/composer?ref=composer", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  await page.waitForTimeout(10000);

  // Print all elements containing "text" or "caption" or "details" in their text
  console.log("Searching for text labels...");
  const textInfo = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("*"));
    return all
      .filter(el => {
        const text = el.textContent || "";
        return (text.includes("text") || text.includes("caption") || text.includes("details")) && el.children.length === 0;
      })
      .map(el => ({
        tagName: el.tagName,
        text: el.textContent?.slice(0, 100),
        className: el.className,
        outerHTML: el.outerHTML.slice(0, 200)
      }));
  });
  console.log("Labels found:", JSON.stringify(textInfo, null, 2));

  // Let's print the entire outerHTML structure of the Post Details area
  console.log("Inspecting 'Post details' section children...");
  const postDetailsChildren = await page.evaluate(() => {
    // Find element containing "Post details"
    const els = Array.from(document.querySelectorAll("*"));
    const detailsHeader = els.find(el => el.textContent === "Post details" && el.children.length === 0);
    if (!detailsHeader) return "Post details header not found";
    
    // Get its parent container and traverse its children
    let parent = detailsHeader.parentElement;
    for (let i = 0; i < 3 && parent; i++) {
      if (parent.querySelector("input") || parent.textContent?.includes("Customise")) {
        return {
          parentTagName: parent.tagName,
          parentClass: parent.className,
          html: parent.outerHTML.slice(0, 5000)
        };
      }
      parent = parent.parentElement;
    }
    return "Container not found";
  });
  
  console.log("Post Details Container HTML:", JSON.stringify(postDetailsChildren, null, 2));

  await context.close();
}

main().catch(console.error);
