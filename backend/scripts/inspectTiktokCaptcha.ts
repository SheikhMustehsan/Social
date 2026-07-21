import fs from 'fs';
import path from 'path';

const htmlPath = path.resolve('./debug_tiktok.html');
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  console.log("File loaded. Length:", html.length);
  
  // Find where captcha-verify-container is in the HTML
  // Print 500 characters before and after its occurrence
  const index = html.indexOf("captcha-verify-container");
  if (index !== -1) {
    console.log("Found captcha-verify-container at index:", index);
    console.log("Context around captcha-verify-container:\n");
    console.log(html.substring(Math.max(0, index - 300), Math.min(html.length, index + 500)));
  } else {
    console.log("captcha-verify-container not found as a literal string.");
  }
} else {
  console.log("debug_tiktok.html not found.");
}
