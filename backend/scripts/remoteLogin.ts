import { chromium } from "playwright";
import { exec } from "child_process";
import path from "path";
import fs from "fs";

// Ensure DISPLAY is set to :99
process.env.DISPLAY = ":99";

const platform = process.argv[2];
const validPlatforms = ["facebook", "instagram", "linkedin"];

if (!platform || !validPlatforms.includes(platform.toLowerCase())) {
  console.error("❌ Please specify a platform to log in to: facebook, instagram, or linkedin");
  console.error("👉 Example: npm run remote-login facebook");
  process.exit(1);
}

const targetPlatform = platform.toLowerCase();

// Platform specific URLs and directories
const profileDir = path.resolve(`./data/sessions/server_profile_${targetPlatform}`);
if (!fs.existsSync(profileDir)) {
  fs.mkdirSync(profileDir, { recursive: true });
}

let loginUrl = "https://www.facebook.com";
if (targetPlatform === "instagram") {
  loginUrl = "https://www.instagram.com";
} else if (targetPlatform === "linkedin") {
  loginUrl = "https://www.linkedin.com/login";
}

async function main() {
  console.log(`🌐 Launching remote login browser for: ${targetPlatform.toUpperCase()}`);
  console.log(`📂 Profile path: ${profileDir}`);

  // 1. Start VNC Server in background
  // -once: close VNC server after client disconnects
  // -forever: keep listening for new connections until browser closes
  console.log("🔒 Starting VNC server on port 5900 with password '1234'...");
  const vncProcess = exec(`x11vnc -display :99 -passwd 1234 -once -forever`, (err, stdout, stderr) => {
    if (err && !vncProcess.killed) {
      console.warn("⚠️ VNC Server exited or failed to start:", err.message);
    }
  });

  // Ensure VNC process is killed when this node process exits
  const cleanup = () => {
    if (!vncProcess.killed) {
      console.log("🧹 Stopping VNC server...");
      vncProcess.kill();
    }
  };
  process.on("exit", cleanup);
  process.on("SIGINT", () => process.exit(0));

  // 2. Launch headed Playwright Chromium inside virtual display :99
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 800 },
    locale: "en-US",
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  const page = await context.newPage();
  await page.goto(loginUrl);

  console.log("\n========================================================");
  console.log(`📺 REMOTE LOGIN READY FOR ${targetPlatform.toUpperCase()}`);
  console.log("========================================================");
  console.log("1. Open VNC Viewer on your laptop.");
  console.log("2. Connect to: 100.89.33.9:5900");
  console.log("3. Enter the password: 1234");
  console.log("4. Log in to your account in the browser window.");
  console.log("5. When finished, CLOSE the VNC Chrome browser window.");
  console.log("========================================================\n");

  // Wait for the browser window/context to be closed by the user
  await new Promise<void>((resolve) => {
    context.on("close", () => {
      console.log("👋 Browser window closed. Login session saved.");
      resolve();
    });
  });

  // Cleanup context and VNC
  await context.close().catch(() => {});
  cleanup();
  console.log("✅ Done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Error running remote login:", err);
  process.exit(1);
});
