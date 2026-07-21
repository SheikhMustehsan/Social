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

  const commentNodes = page.locator('[componentkey^="comment-commentary_"]');
  const count = await commentNodes.count();
  console.log(`Found ${count} comment elements.`);

  if (count > 0) {
    const node = commentNodes.first();
    const text = await node.innerText();
    console.log(`\nComment #1 Text: "${text.trim()}"`);
    
    // Trace and log ALL elements inside the parent wrapper at level 3
    const elementsInfo = await node.evaluate((el) => {
      let parent = el.parentElement;
      let level = 0;
      const list: string[] = [];
      
      while (parent && level < 4) {
        // Log all elements within this parent level
        const allTags = Array.from(parent.querySelectorAll('*')).slice(0, 100);
        allTags.forEach(tag => {
          const tagName = tag.tagName;
          const classList = tag.className;
          const textVal = tag.textContent?.trim() || "";
          const attrs: Record<string, string> = {};
          for (let i = 0; i < tag.attributes.length; i++) {
            const attr = tag.attributes[i];
            attrs[attr.name] = attr.value;
          }
          list.push(`${tagName} [classes: ${classList}] [attrs: ${JSON.stringify(attrs)}] [text: ${textVal.substring(0, 50)}]`);
        });
        
        parent = parent.parentElement;
        level++;
      }
      return list;
    });

    console.log("Elements inside the comment container:");
    console.log(elementsInfo.slice(0, 60).join("\n"));
  }

  await browser.close();
}

main().catch(console.error);
