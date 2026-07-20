import fs from 'fs';
import path from 'path';

const htmlPath = path.resolve('./debug_linkedin.html');
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  console.log("File loaded. Length:", html.length);
  
  // Regex to find buttons with class or aria-label containing "actor", "switcher", "select", "commenting"
  const regex = /<button[^>]+(class|aria-label|id)="[^"]*(actor|switcher|select|commenting)[^"]*"[^>]*>([\s\S]*?)<\/button>/gi;
  let match;
  let count = 0;
  while ((match = regex.exec(html)) !== null) {
    count++;
    console.log(`\n--- Button #${count} ---`);
    console.log("HTML:", match[0].substring(0, 300));
  }
} else {
  console.log("debug_linkedin.html not found.");
}
