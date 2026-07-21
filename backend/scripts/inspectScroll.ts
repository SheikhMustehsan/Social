import fs from 'fs';
import path from 'path';

const htmlPath = path.resolve('./debug_linkedin.html');
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  console.log("File Loaded. Length:", html.length);
  
  // Extract <title>
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  console.log("Title:", titleMatch ? titleMatch[1].trim() : "No Title");
  
  // Find visible text or h1/h2 tags
  const h1Matches = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi);
  console.log("H1 Tags:", h1Matches ? h1Matches.map(h => h.replace(/<[^>]+>/g, '').trim()) : "None");

  const bodyClasses = html.match(/<body[^>]*class="([^"]*)"/i);
  console.log("Body classes:", bodyClasses ? bodyClasses[1] : "None");
} else {
  console.log("debug_linkedin.html not found.");
}
