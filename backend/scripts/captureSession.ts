// Run this LOCALLY on a machine that has a real display (e.g. your own PC) - the
// production server has no display, so it can't show you a login window directly.
//
// Usage:
//   cd backend
//   npm run capture-session -- facebook
//
// A real Chrome window opens. Log in normally, then come back to this terminal and
// press Enter. A session_<platform>_<timestamp>.json file is saved in this folder -
// upload that file in the app under Connected Profiles > Link Social Account.
import { chromium } from "playwright";
import path from "path";
import readline from "readline";

const PLATFORM_URLS: Record<string, string> = {
  facebook: "https://www.facebook.com",
  instagram: "https://www.instagram.com",
  linkedin: "https://www.linkedin.com/login",
  tiktok: "https://www.tiktok.com/login",
};

async function waitForEnter(prompt: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(prompt, () => {
    rl.close();
    resolve();
  }));
}

async function main() {
  const platform = process.argv[2];

  if (!platform || !PLATFORM_URLS[platform]) {
    console.error(`Usage: npm run capture-session -- <${Object.keys(PLATFORM_URLS).join("|")}>`);
    process.exit(1);
  }

  console.log(`Launching Chrome for ${platform}...`);
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(PLATFORM_URLS[platform]);

  await waitForEnter("\nLog in fully in the opened Chrome window, then press Enter here when done... ");

  const outputPath = path.resolve(`./session_${platform}_${Date.now()}.json`);
  await context.storageState({ path: outputPath });
  await browser.close();

  console.log(`\nSaved session to: ${outputPath}`);
  console.log(`Upload this file in the app: Connected Profiles -> Link Social Account -> Upload Session File.`);
}

main().catch((err) => {
  console.error("Failed to capture session:", err);
  process.exit(1);
});
