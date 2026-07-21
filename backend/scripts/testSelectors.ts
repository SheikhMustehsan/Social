import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

async function main() {
  const htmlPath = path.resolve('./debug_linkedin.html');
  if (!fs.existsSync(htmlPath)) {
    console.log("debug_linkedin.html not found.");
    return;
  }
  const html = fs.readFileSync(htmlPath, 'utf8');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(html);

  console.log("HTML loaded in Playwright page.");

  // Find all buttons in the page that contain the word "Reply" in text, class, or attributes
  const buttons = await page.evaluate(() => {
    const list: string[] = [];
    document.querySelectorAll('button, [role="button"], span, a').forEach(el => {
      const text = el.textContent?.trim() || "";
      const label = el.getAttribute('aria-label') || "";
      const className = el.className || "";
      
      if (
        text.toLowerCase().includes("reply") || 
        label.toLowerCase().includes("reply") || 
        className.toLowerCase().includes("reply")
      ) {
        list.push(`${el.tagName} [class: ${className}] [label: ${label}] [text: ${text}]`);
      }
    });
    return list;
  });

  console.log(`Found ${buttons.length} candidate reply elements:`);
  console.log(buttons.join("\n"));

  await browser.close();
}

main().catch(console.error);
