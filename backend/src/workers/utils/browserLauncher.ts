import { chromium, BrowserContext } from "playwright";
import path from "path";

export interface LauncherOptions {
  headless?: boolean;
  userAgent?: string;
  viewport?: { width: number; height: number } | null;
}

import fs from "fs";
declare const navigator: any;

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

  let targetProfile = "Default";
  const args = [
    "--disable-blink-features=AutomationControlled",
    "--disable-infobars",
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage"
  ];

  if (fs.existsSync(resolvedProfilePath)) {
    // If they zipped the profile folder directly (so cookies/Network is at the root),
    // move everything into a Default/ subdirectory so Playwright finds it.
    const defaultDir = path.join(resolvedProfilePath, "Default");
    const hasNetwork = fs.existsSync(path.join(resolvedProfilePath, "Network"));
    const hasCookies = fs.existsSync(path.join(resolvedProfilePath, "Cookies"));
    if ((hasNetwork || hasCookies) && !fs.existsSync(defaultDir)) {
      console.log("📂 Restructuring profile: Moving files into 'Default' subdirectory for Playwright...");
      fs.mkdirSync(defaultDir, { recursive: true });
      const items = fs.readdirSync(resolvedProfilePath);
      for (const item of items) {
        if (item === "Default") continue;
        const src = path.join(resolvedProfilePath, item);
        const dest = path.join(defaultDir, item);
        try {
          fs.renameSync(src, dest);
        } catch (e: any) {
          console.warn(`⚠️ Failed to move ${item}:`, e.message);
        }
      }
    }

    const items = fs.readdirSync(resolvedProfilePath);
    const possibleProfiles = items.filter(item => {
      try {
        return (item === "Default" || item.startsWith("Profile ")) && 
               fs.lstatSync(path.join(resolvedProfilePath, item)).isDirectory();
      } catch {
        return false;
      }
    });

    let maxCookieSize = 0;
    for (const p of possibleProfiles) {
      const cookiePath1 = path.join(resolvedProfilePath, p, "Network", "Cookies");
      const cookiePath2 = path.join(resolvedProfilePath, p, "Cookies");
      let size = 0;
      if (fs.existsSync(cookiePath1)) {
        size = fs.statSync(cookiePath1).size;
      } else if (fs.existsSync(cookiePath2)) {
        size = fs.statSync(cookiePath2).size;
      }
      if (size > maxCookieSize) {
        maxCookieSize = size;
        targetProfile = p;
      }
    }
  }

  console.log(`👤 Selected profile directory with active session: ${targetProfile}`);
  args.push(`--profile-directory=${targetProfile}`);

  const context = await chromium.launchPersistentContext(resolvedProfilePath, {
    headless,
    userAgent,
    viewport: viewport,
    locale: "en-US", // Force English locale for consistent selectors
    args,
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
    // Add Client Hints to match a standard Windows Chrome browser headers
    extraHTTPHeaders: {
      "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
    }
  });

  // chromium.launch()+newContext() (unlike launchPersistentContext) returns a browser and
  // context as separate objects - closing the context alone would leak the browser process.
  context.on("close", () => browser.close().catch(() => {}));

  await context.addInitScript(() => {
    // Hide webdriver
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
    });

    // Mock chrome object (present in headed Chrome but absent in headless/Playwright)
    (window as any).chrome = {
      app: {
        isInstalled: false,
        InstallState: { DIASBLED: "disabled", INSTALLED: "installed", NOT_INSTALLED: "not_installed" },
        runningState: () => "cannot_run",
        getDetails: () => null,
        getIsInstalled: () => false,
      },
      runtime: {
        OnInstalledReason: { CHROME_UPDATE: "chrome_update", INSTALL: "install", SHARED_MODULE_UPDATE: "shared_module_update", UPDATE: "update" },
        OnRestartRequiredReason: { APP_UPDATE: "app_update", OS_UPDATE: "os_update", PERIODIC: "periodic" },
        PlatformArch: { ARM: "arm", ARM64: "arm64", MIPS: "mips", MIPS64: "mips64", X86_32: "x86-32", X86_64: "x86-64" },
        PlatformNaclArch: { ARM: "arm", MIPS: "mips", MIPS64: "mips64", X86_32: "x86-32", X86_64: "x86-64" },
        PlatformOs: { ANDROID: "android", CROS: "cros", LINUX: "linux", MAC: "mac", OPENBSD: "openbsd", WIN: "win" },
        RequestUpdateCheckStatus: { NO_UPDATE: "no_update", THROTTLED: "throttled", UPDATE_AVAILABLE: "update_available" },
      }
    };

    // Mock plugins list (headed Chrome has plugins, headless has none)
    Object.defineProperty(navigator, "plugins", {
      get: () => [1, 2, 3],
    });
  });

  return context;
}
