import fs from 'fs';
import path from 'path';

const htmlPath = path.resolve('./debug_linkedin.html');
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  console.log("File loaded. Length:", html.length);
  
  // Find "comment-commentary_" and search backwards for author names or elements
  let pos = html.indexOf("comment-commentary_");
  let count = 0;
  while (pos !== -1 && count < 3) {
    count++;
    console.log(`\n=== Comment Occurrence #${count} ===`);
    const start = Math.max(0, pos - 1500);
    const end = pos + 300;
    console.log(html.substring(start, end));
    pos = html.indexOf("comment-commentary_", pos + 1);
  }
} else {
  console.log("debug_linkedin.html not found.");
}
