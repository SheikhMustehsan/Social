import fs from 'fs';
import path from 'path';

const htmlPath = path.resolve('./debug_linkedin.html');
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  console.log("File loaded. Length:", html.length);
  
  // Let's find the exact string 'data-testid="expandable-text-box"' and print the surrounding tags up to 1000 characters before it
  let pos = html.indexOf('data-testid="expandable-text-box"');
  let count = 0;
  while (pos !== -1 && count < 4) {
    count++;
    console.log(`\n--- Occurrence #${count} at ${pos} ---`);
    const start = Math.max(0, pos - 600);
    const end = pos + 100;
    console.log(html.substring(start, end));
    pos = html.indexOf('data-testid="expandable-text-box"', pos + 1);
  }
} else {
  console.log("debug_linkedin.html not found.");
}
