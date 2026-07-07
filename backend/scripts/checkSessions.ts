import { chromium } from "playwright";
import path from "path";
import fs from "fs";

// Ensure DISPLAY is set to :99
process.env.DISPLAY = ":99";

async function checkPlatform(platform: string, testUrl: string, loginUrlIndicator: string): Promise<boolean> {
  const profileDir = path.resolve(`./data/sessions/server_profile_${platform}`);
  if (!fs.existsSync(profileDir)) {
    console.log(`❌ Profile folder not found for ${platform.toUpperCase()}: ${profileDir}`);
    return false;
  }

  console.log(`🔎 Checking ${platform.toUpperCase()} session...`);
  
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1280, height: 800 },
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await context.newPage();
  try {
    await page.goto(testUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(4000); // Wait for redirects

    const currentUrl = page.url();
    const isLoggedOut = currentUrl.includes(loginUrlIndicator) || currentUrl.includes("authwall") || currentUrl.includes("login");
    
    if (isLoggedOut) {
      console.log(`❌ ${platform.toUpperCase()} session is LOGGED OUT (Redirected to: ${currentUrl})`);
      await context.close();
      return false;
    } else {
      console.log(`✅ ${platform.toUpperCase()} session is LOGGED IN (Current URL: ${currentUrl})`);
      await context.close();
      return true;
    }
  } catch (err: any) {
    console.error(`❌ Failed to check ${platform.toUpperCase()}:`, err.message);
    await context.close();
    return false;
  }
}

async function main() {
  console.log("🚀 Starting Session Verification Script...\n");
  
  const fbOk = await checkPlatform(
    "facebook", 
    "https://business.facebook.com/latest/composer", 
    "loginpage"
  );
  
  const igOk = await checkPlatform(
    "instagram", 
    "https://business.facebook.com/latest/composer", 
    "loginpage"
  );
  
  const liOk = await checkPlatform(
    "linkedin", 
    "https://www.linkedin.com/company/31184548/admin/page-posts/published/", 
    "authwall"
  );

  console.log("\n========================================================");
  console.log("📊 SESSION SUMMARY");
  console.log("========================================================");
  console.log(`Facebook:  ${fbOk ? "✅ Logged In" : "❌ Logged Out"}`);
  console.log(`Instagram: ${igOk ? "✅ Logged In" : "❌ Logged Out"}`);
  console.log(`LinkedIn:  ${liOk ? "✅ Logged In" : "❌ Logged Out"}`);
  console.log("========================================================\n");
}

main().catch(console.error);
