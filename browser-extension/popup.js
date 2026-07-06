// Maps a tab's hostname to a platform key + the cookie domain to pull cookies from.
const PLATFORMS = [
  { key: "facebook", match: /facebook\.com$/i, cookieDomain: "facebook.com" },
  { key: "instagram", match: /instagram\.com$/i, cookieDomain: "instagram.com" },
  { key: "linkedin", match: /linkedin\.com$/i, cookieDomain: "linkedin.com" },
  { key: "tiktok", match: /tiktok\.com$/i, cookieDomain: "tiktok.com" },
];

const detectedEl = document.getElementById("detected");
const captureBtn = document.getElementById("captureBtn");
const statusEl = document.getElementById("status");

let activeTab = null;
let activePlatform = null;

function setStatus(message, kind) {
  statusEl.textContent = message;
  statusEl.className = kind || "";
}

// Maps Chrome's cookie shape to the shape Playwright's storageState expects.
function mapSameSite(sameSite) {
  switch (sameSite) {
    case "strict":
      return "Strict";
    case "lax":
      return "Lax";
    case "no_restriction":
      return "None";
    default:
      return "Lax";
  }
}

function mapCookie(cookie) {
  return {
    name: cookie.name,
    value: cookie.value,
    domain: cookie.domain,
    path: cookie.path,
    expires: cookie.session ? -1 : (cookie.expirationDate || -1),
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: mapSameSite(cookie.sameSite),
  };
}

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTab = tab;

  let hostname = "";
  try {
    hostname = new URL(tab.url).hostname;
  } catch {
    hostname = "";
  }

  activePlatform = PLATFORMS.find((p) => p.match.test(hostname)) || null;

  if (!activePlatform) {
    detectedEl.textContent =
      "This tab isn't Facebook, Instagram, LinkedIn, or TikTok. Open one of those, log in, then reopen this popup.";
    captureBtn.disabled = true;
    return;
  }

  detectedEl.textContent = `Detected: ${activePlatform.key} (${hostname})`;
  captureBtn.disabled = false;
}

async function captureSession() {
  captureBtn.disabled = true;
  setStatus("Capturing cookies...", "");

  try {
    const allCookies = await chrome.cookies.getAll({});
    const rawCookies = allCookies.filter(c => c.domain.includes(activePlatform.cookieDomain));
    
    if (rawCookies.length === 0) {
      setStatus("No cookies found for this site. Make sure you're logged in.", "error");
      captureBtn.disabled = false;
      return;
    }

    setStatus("Reading local storage...", "");
    const [{ result: localStorageEntries }] = await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      func: () => Object.entries(window.localStorage).map(([name, value]) => ({ name, value })),
    });

    const storageState = {
      cookies: rawCookies.map(mapCookie),
      origins: [
        {
          origin: new URL(activeTab.url).origin,
          localStorage: localStorageEntries || [],
        },
      ],
    };

    const blob = new Blob([JSON.stringify(storageState, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const filename = `session_${activePlatform.key}_${Date.now()}.json`;

    await chrome.downloads.download({ url, filename, saveAs: false });

    setStatus(
      `Saved ${filename} to your downloads. Upload it in the app under Connected Profiles > Link Social Account.`,
      "success"
    );
  } catch (err) {
    setStatus(`Failed to capture session: ${err.message}`, "error");
  } finally {
    captureBtn.disabled = false;
  }
}

captureBtn.addEventListener("click", captureSession);
init();
