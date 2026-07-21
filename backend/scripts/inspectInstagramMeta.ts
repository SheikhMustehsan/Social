import fs from 'fs';
import path from 'path';

const htmlPath = path.resolve('./debug_instagram.html');
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  console.log("File loaded. Length:", html.length);
  
  // Extract <title>
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  console.log("Title:", titleMatch ? titleMatch[1].trim() : "No Title");
  
  // Find visible text or h1/h2 tags
  const h1Matches = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi);
  console.log("H1 Tags:", h1Matches ? h1Matches.map(h => h.replace(/<[^>]+>/g, '').trim()) : "None");
} else {
  console.log("debug_instagram.html not found.");
}
