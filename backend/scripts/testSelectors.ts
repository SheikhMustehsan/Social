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

  // Test both comment-commentary and comment-reply-commentary
  const commentNodes = page.locator('[componentkey^="comment-commentary_"], [componentkey^="comment-reply-commentary_"]');
  const count = await commentNodes.count();
  console.log(`Found ${count} comment elements.`);

  for (let i = 0; i < count; i++) {
    const node = commentNodes.nth(i);
    const text = await node.innerText();
    
    const details = await node.evaluate((el) => {
      let parent = el.parentElement;
      let level = 0;
      let wrapper = null;
      let authorName = "Unknown";
      
      while (parent && level < 15) {
        const optionsBtn = parent.querySelector('button[aria-label*="View more options for"]');
        if (optionsBtn) {
          const label = optionsBtn.getAttribute('aria-label') || "";
          const match = label.match(/View more options for (.*?)’s (comment|reply)/i);
          if (match && match[1]) {
            authorName = match[1];
          }
          wrapper = parent.tagName + (parent.className ? '.' + parent.className.split(' ').join('.') : '');
          break;
        }
        parent = parent.parentElement;
        level++;
      }
      
      return {
        wrapper,
        authorName,
        level
      };
    });

    console.log(`\nComment #${i + 1}: "${text.trim()}"`);
    console.log(`  Author: ${details.authorName}`);
  }

  await browser.close();
}

main().catch(console.error);
