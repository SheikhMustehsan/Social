import fs from 'fs';
import path from 'path';

const htmlPath = path.resolve('./debug_linkedin.html');
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  console.log("File loaded. Length:", html.length);
  
  // Find any text containing "Comment as" or "commenting"
  const regexText = /[^<]{0,100}(Comment as|commenting|actor|switcher)[^<]{0,100}/gi;
  let tMatch;
  let tCount = 0;
  console.log("Searching text matches:");
  while ((tMatch = regexText.exec(html)) !== null && tCount < 20) {
    tCount++;
    console.log(`Match ${tCount}:`, tMatch[0].trim());
  }

  // Find any class containing "actor", "select", "switcher"
  console.log("\nSearching class matches:");
  const classRegex = /class="([^"]*(actor|select|switcher)[^"]*)"/gi;
  let cMatch;
  let cCount = 0;
  while ((cMatch = classRegex.exec(html)) !== null && cCount < 20) {
    cCount++;
    console.log(`Class Match ${cCount}:`, cMatch[1]);
  }
} else {
  console.log("debug_linkedin.html not found.");
}
