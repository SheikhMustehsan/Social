# Session Capture Extension

Captures your login session for Facebook, Instagram, LinkedIn, or TikTok as a file you can
upload in the app (Connected Profiles > Link Social Account), without needing the project's
code or Node.js installed. This is the no-code alternative to `backend/scripts/captureSession.ts`.

## Install (unpacked, not published to a store)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on "Developer mode" (top right).
3. Click "Load unpacked" and select this `browser-extension` folder.

## Use

1. Log in normally to Facebook, Instagram, LinkedIn, or TikTok in a regular browser tab.
2. Click the extension icon while that tab is active.
3. Click "Capture Session". It downloads a `session_<platform>_<timestamp>.json` file.
4. Upload that file in the app: Connected Profiles > Link Social Account > Session File.

## Security note

The downloaded file contains your live login cookies - anyone with it can act as you on that
account until the session expires or you log out. Treat it like a password: don't share it,
and delete it after uploading.
