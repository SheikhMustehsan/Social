import fs from 'fs';
import path from 'path';

const htmlPath = path.resolve('./debug_linkedin.html');
if (fs.existsSync(htmlPath)) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  console.log("File loaded. Length:", html.length);
  
  // Find where "Please share more details" is in the HTML
  // Print its tag name, parents, and classes
  const targetText = "Please share more details";
  const index = html.indexOf(targetText);
  if (index !== -1) {
    console.log("Found text index:", index);
    console.log("\nContext around text:\n");
    console.log(html.substring(Math.max(0, index - 200), Math.min(html.length, index + 300)));
  } else {
    console.log("Text not found.");
  }
  
  // Also check for "Great project"
  const targetText2 = "Great project";
  const index2 = html.indexOf(targetText2);
  if (index2 !== -1) {
    console.log("Found text2 index:", index2);
    console.log("\nContext around text2:\n");
    console.log(html.substring(Math.max(0, index2 - 200), Math.min(html.length, index2 + 300)));
  }
} else {
  console.log("debug_linkedin.html not found.");
}
