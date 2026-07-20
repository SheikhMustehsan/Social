import fs from 'fs';
import path from 'path';

const htmlPath = path.resolve('./debug_instagram.html');
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  console.log("File loaded. Length:", html.length);
  
  // Find all elements with role="listitem"
  const regex = /<div[^>]*role="listitem"[^>]*>([\s\S]*?)<\/div>/g;
  let match;
  let count = 0;
  while ((match = regex.exec(html)) !== null) {
    count++;
    const content = match[1];
    console.log(`\n--- LISTITEM #${count} ---`);
    console.log("Text preview:", content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').substring(0, 150));
    
    // Find all buttons, links, or spans inside
    const btnRegex = /<button[^>]*>([\s\S]*?)<\/button>/gi;
    let bMatch;
    while ((bMatch = btnRegex.exec(content)) !== null) {
      console.log("  Button:", bMatch[0].replace(/\s+/g, ' '));
    }
  }
} else {
  console.log("debug_instagram.html not found.");
}
