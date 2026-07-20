import fs from 'fs';
import path from 'path';

const htmlPath = path.resolve('./debug_instagram.html');
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  console.log("File loaded. Length:", html.length);
  
  // Find all li elements with class containing _a9zr
  const regex = /<li[^>]*_a9zr[^>]*>([\s\S]*?)<\/li>/g;
  let match;
  let count = 0;
  while ((match = regex.exec(html)) !== null) {
    count++;
    const content = match[1];
    console.log(`\n--- LI #${count} ---`);
    // Extract any button, span, or div containing "reply" (case-insensitive)
    const replyRegex = /<([^>]+)>([^<]*reply[^<]*)<\/[^>]+>/gi;
    let rMatch;
    while ((rMatch = replyRegex.exec(content)) !== null) {
      console.log("Found Reply element:", rMatch[0]);
    }
  }
} else {
  console.log("debug_instagram.html not found.");
}
