import fs from 'fs';
import path from 'path';

const htmlPath = path.resolve('./debug_linkedin.html');
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  console.log("File loaded. Length:", html.length);
  
  // Find "data-testid="expandable-text-box"" occurrences and print their outer HTML structure
  const regex = /<[^>]*data-testid="expandable-text-box"[^>]*>([\s\S]*?)<\/[^>]+>/gi;
  let match;
  let count = 0;
  console.log("Found expandable-text-box tags:");
  while ((match = regex.exec(html)) !== null && count < 10) {
    count++;
    console.log(`Match #${count}:`, match[0].substring(0, 150), "-> Text:", match[1].trim());
  }

  // Find all elements that look like comments. Let's find author names "Mustehsan Sheikh" or "Usama Aslam"
  const index = html.indexOf("Mustehsan Sheikh");
  if (index !== -1) {
    console.log("\nContext around Mustehsan Sheikh:");
    console.log(html.substring(Math.max(0, index - 300), Math.min(html.length, index + 500)));
  }
} else {
  console.log("debug_linkedin.html not found.");
}
