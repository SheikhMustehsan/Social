import fs from 'fs';
import path from 'path';

const htmlPath = path.resolve('./debug_tiktok.html');
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  console.log("File loaded. Length:", html.length);
  
  // Find all iframe elements
  const regex = /<iframe[^>]*>([\s\S]*?)<\/iframe>/gi;
  let match;
  let count = 0;
  console.log("Listing all iframes:");
  while ((match = regex.exec(html)) !== null) {
    count++;
    console.log(`Iframe #${count}:`, match[0].substring(0, 300));
  }

  // Also match self-closing iframe tags
  const regexSelf = /<iframe[^>]*\/>/gi;
  let matchSelf;
  while ((matchSelf = regexSelf.exec(html)) !== null) {
    count++;
    console.log(`Iframe Self #${count}:`, matchSelf[0]);
  }
  
  // Search for any iframe tag anywhere
  const regexAny = /<iframe[^>]*>/gi;
  let matchAny;
  while ((matchAny = regexAny.exec(html)) !== null) {
    console.log(`Iframe Opening Tag:`, matchAny[0]);
  }
} else {
  console.log("debug_tiktok.html not found.");
}
