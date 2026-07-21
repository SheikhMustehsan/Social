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

  const commentNodes = page.locator('[componentkey^="comment-commentary_"], [componentkey^="comment-reply-commentary_"]');
  const count = await commentNodes.count();
  console.log(`Found ${count} comment elements.`);

  for (let i = 0; i < count; i++) {
    const node = commentNodes.nth(i);
    const text = await node.innerText();
    
    const details = await node.evaluate((el) => {
      let parent = el.parentElement;
      let level = 0;
      let authorName = "Unknown";
      let replyBtnSelector = "None";
      
      while (parent && level < 15) {
        const optionsBtn = parent.querySelector('button[aria-label*="View more options for"]');
        if (optionsBtn) {
          const label = optionsBtn.getAttribute('aria-label') || "";
          const match = label.match(/View more options for (.*?)’s (comment|reply)/i);
          if (match && match[1]) {
            authorName = match[1];
          }
          
          // Let's find any button that looks like a Reply button in this comment container
          const replyBtn = parent.querySelector('button[aria-label^="Reply to"], button:has-text("Reply"), button[class*="reply"]');
          if (replyBtn) {
            replyBtnSelector = replyBtn.tagName + (replyBtn.className ? '.' + replyBtn.className.split(' ').join('.') : '') + ` [text: ${replyBtn.textContent?.trim()}, label: ${replyBtn.getAttribute('aria-label')}]`;
          }
          break;
        }
        parent = parent.parentElement;
        level++;
      }
      
      return {
        authorName,
        replyBtnSelector
      };
    });

    console.log(`\nComment #${i + 1}: "${text.trim()}"`);
    console.log(`  Author: ${details.authorName}`);
    console.log(`  Reply Button: ${details.replyBtnSelector}`);
  }

  await browser.close();
}

main().catch(console.error);
