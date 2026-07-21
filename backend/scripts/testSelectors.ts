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

  // Test 1: Let's find all comment elements by looking for elements containing componentkey starting with comment-commentary_
  const commentNodes = page.locator('[componentkey^="comment-commentary_"]');
  const count = await commentNodes.count();
  console.log(`Found ${count} comment commentary elements.`);

  for (let i = 0; i < count; i++) {
    const node = commentNodes.nth(i);
    const text = await node.innerText();
    
    // Let's find the nearest button with aria-label containing "View more options for"
    // Usama Aslam's comment has a button inside the same parent list item or article container.
    // Let's search upwards for a container, then look inside it for the author name or aria-label options button
    
    // We can evaluate in the browser to trace parents
    const details = await node.evaluate((el) => {
      // Find the parent element that wraps the whole comment (usually an article, section, or list item)
      let parent = el.parentElement;
      let level = 0;
      let wrapper = null;
      let authorName = "Unknown";
      
      while (parent && level < 15) {
        // Let's look for a button with aria-label matching 'View more options for'
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
    console.log(`  Wrapper at level ${details.level}: ${details.wrapper}`);
  }

  await browser.close();
}

main().catch(console.error);
