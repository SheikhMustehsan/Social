// Priority:
// 1. VITE_API_URL set in .env file (used for Cloudflare Tunnel / production)
// 2. Auto-detect based on browser hostname (used for local LAN access)
// 3. Fallback to localhost (used for local dev on the same machine)
export const API_BASE: string =
  import.meta.env.VITE_API_URL ||
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : `${window.location.protocol}//${window.location.hostname}:3000`);
