import { chromium, BrowserContext } from "playwright";
import path from "path";

export interface LauncherOptions {
  headless?: boolean;
  userAgent?: string;
  viewport?: { width: number; height: number } | null;
}

export async function launchBrowserWithProfile(
  profileDir: string,
  options: LauncherOptions = {}
): Promise<BrowserContext> {
  const resolvedProfilePath = path.resolve(profileDir);
  const headless = options.headless !== undefined ? options.headless : true;
  
  // Custom user agent to look like a standard Windows Chrome browser
  const userAgent =
    options.userAgent ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  const viewport = options.viewport !== undefined ? options.viewport : { width: 1280, height: 800 };

  console.log(`🚀 Launching Playwright browser with profile: ${resolvedProfilePath} (headless: ${headless})`);

  const context = await chromium.launchPersistentContext(resolvedProfilePath, {
    headless,
    userAgent,
    viewport: viewport,
    args: [
      "--disable-blink-features=AutomationControlled", // Hides navigator.webdriver
      "--disable-infobars",
      "--start-maximized",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-web-security", // Bypasses CORS issues in scrapers
      "--allow-running-insecure-content",
    ],
    // Force device scale factor to look normal
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
  });

  // Inject a script to completely hide the webdriver property in the browser
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
    });
  });

  return context;
}
