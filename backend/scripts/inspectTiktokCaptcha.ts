import fs from 'fs';
import path from 'path';

const htmlPath = path.resolve('./debug_tiktok.html');
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  console.log("File loaded. Length:", html.length);
  
  // Find all occurrences of "captcha-verify-container"
  let pos = html.indexOf("captcha-verify-container");
  let occurrences = [];
  while (pos !== -1) {
    occurrences.push(pos);
    pos = html.indexOf("captcha-verify-container", pos + 1);
  }
  console.log(`Found ${occurrences.length} occurrences:`, occurrences);
  occurrences.forEach((idx, i) => {
    console.log(`\nOccurrence #${i+1} at index ${idx}:`);
    console.log(html.substring(Math.max(0, idx - 100), Math.min(html.length, idx + 200)));
  });

  // Let's also look for "<div" or other elements with captcha classes
  const captchaMatches = html.match(/<[^>]*class="[^"]*captcha[^"]*"[^>]*>/gi);
  console.log("\nHTML Tags containing 'captcha' in class name:");
  if (captchaMatches) {
    console.log(captchaMatches.slice(0, 10));
  } else {
    console.log("None");
  }
} else {
  console.log("debug_tiktok.html not found.");
}
