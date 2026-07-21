import fs from 'fs';
import path from 'path';

const htmlPath = path.resolve('./debug_tiktok.html');
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  console.log("File loaded. Length:", html.length);
  
  // Find text matching "puzzle" or "slider" or "drag"
  const regexText = /[^<]{0,100}(puzzle|slider|drag|captcha)[^<]{0,100}/gi;
  let match;
  let count = 0;
  console.log("Searching text matches:");
  while ((match = regexText.exec(html)) !== null && count < 20) {
    count++;
    console.log(`Match ${count}:`, match[0].trim());
  }

  // Look for elements with tag name or classes containing captcha or secsdk or verify
  console.log("\nSearching for class names with captcha, verify, secsdk, wrapper, container:");
  const classRegex = /class="([^"]*(captcha|verify|secsdk|puzzle|slider)[^"]*)"/gi;
  let cMatch;
  let cCount = 0;
  while ((cMatch = classRegex.exec(html)) !== null && cCount < 20) {
    cCount++;
    console.log(`Class Match ${cCount}:`, cMatch[1]);
  }
} else {
  console.log("debug_tiktok.html not found.");
}
