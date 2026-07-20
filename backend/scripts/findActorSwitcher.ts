import fs from 'fs';
import path from 'path';

const htmlPath = path.resolve('./debug_linkedin.html');
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  console.log("File loaded. Length:", html.length);
  
  // Find all <button> elements and print their opening tag
  const regex = /<button[^>]+>/gi;
  let match;
  let count = 0;
  console.log("Listing all buttons:");
  while ((match = regex.exec(html)) !== null && count < 60) {
    count++;
    console.log(`Button #${count}:`, match[0]);
  }
} else {
  console.log("debug_linkedin.html not found.");
}
