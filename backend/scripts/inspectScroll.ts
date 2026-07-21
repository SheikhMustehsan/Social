import fs from 'fs';
import path from 'path';

const htmlPath = path.resolve('./debug_linkedin.html');
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  console.log("File loaded. Length:", html.length);
  
  // Find scrollable container classes or tags in LinkedIn layout
  // Print tags like div containing scaffold or main scroll containers
  const classMatches = html.match(/class="([^"]*(scaffold-layout|theme-background|feed-shared-update-v2)[^"]*)"/gi);
  if (classMatches) {
    console.log("Found layout container classes:");
    console.log(Array.from(new Set(classMatches)).slice(0, 30));
  }
} else {
  console.log("debug_linkedin.html not found.");
}
