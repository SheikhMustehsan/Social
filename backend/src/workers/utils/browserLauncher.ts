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
    locale: "en-US", // Force English locale for consistent selectors
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

// Launches a browser from a saved Playwright storageState (cookies + localStorage) instead of
// a live Chrome user-data-dir. Used for accounts logged in on a machine with a real display
// (e.g. an admin's own PC) and then uploaded, since the server itself may have no display to
// open a headed browser on.
export async function launchBrowserWithStorageState(
  storageStatePath: string,
  options: LauncherOptions = {}
): Promise<BrowserContext> {
  const headless = options.headless !== undefined ? options.headless : true;

  const userAgent =
    options.userAgent ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  const viewport = options.viewport !== undefined ? options.viewport : { width: 1280, height: 800 };

  console.log(`🚀 Launching Playwright browser with saved session: ${storageStatePath} (headless: ${headless})`);

  const browser = await chromium.launch({
    headless,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-web-security",
      "--allow-running-insecure-content",
    ],
  });

  const context = await browser.newContext({
    storageState: path.resolve(storageStatePath),
    userAgent,
    viewport,
    locale: "en-US", // Force English locale for consistent selectors
    deviceScaleFactor: 1,
    ignoreHTTPSErrors: true,
  });

  // chromium.launch()+newContext() (unlike launchPersistentContext) returns a browser and
  // context as separate objects - closing the context alone would leak the browser process.
  context.on("close", () => browser.close().catch(() => {}));

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
    });
  });

  return context;
}
