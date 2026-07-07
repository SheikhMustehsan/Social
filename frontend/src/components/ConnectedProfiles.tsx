import React, { useState, useEffect } from "react";
import { API_BASE } from "../config";

interface DiscoveredProfile {
  name: string;
  email: string;
  path: string;
}

interface Profile {
  id: string;
  platform: string;
  profileName: string;
  chromeProfilePath: string;
  profileId: string | null;
  status: string;
}

interface ConnectedProfilesProps {
  token: string;
  companyId: string;
  isAdmin: boolean;
}

export default function ConnectedProfiles({ token, companyId, isAdmin }: ConnectedProfilesProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [discoveredProfiles, setDiscoveredProfiles] = useState<DiscoveredProfile[]>([]);
  const [useCustomPath, setUseCustomPath] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [platform, setPlatform] = useState("facebook");
  const [profileName, setProfileName] = useState("");
  const [chromeProfilePath, setChromeProfilePath] = useState("");
  const [targetPageId, setTargetPageId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const needsTargetPage = platform === "facebook" || platform === "linkedin";

  // Session file upload (primary flow - the server has no display, so login happens
  // locally via scripts/captureSession.ts and the resulting session file is uploaded here)
  const [uploadedSessionPath, setUploadedSessionPath] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState("");
  const [uploadingSession, setUploadingSession] = useState(false);

  const [launchingBrowser, setLaunchingBrowser] = useState(false);
  const [browserLaunchedMessage, setBrowserLaunchedMessage] = useState("");
  const [sessionSource, setSessionSource] = useState<"upload" | "reuse">("upload");

  // Get unique uploaded sessions from currently linked profiles
  const reusableSessions = (() => {
    const seen = new Set<string>();
    const list: { name: string; platform: string; path: string }[] = [];
    for (const p of profiles) {
      if (p.chromeProfilePath && !seen.has(p.chromeProfilePath)) {
        seen.add(p.chromeProfilePath);
        list.push({
          name: p.profileName,
          platform: p.platform,
          path: p.chromeProfilePath
        });
      }
    }
    return list;
  })();

  useEffect(() => {
    if (companyId) {
      fetchProfiles();
      fetchDiscoveredProfiles();
    }
  }, [companyId]);

  const fetchProfiles = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/profiles`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-company-id": companyId,
        },
      });
      const data = await response.json();
      if (response.ok) {
        setProfiles(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDiscoveredProfiles = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/profiles/discover`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setDiscoveredProfiles(data);
        if (data.length > 0 && !useCustomPath) {
          // Pre-populate with first discovered profile details
          setChromeProfilePath(data[0].path);
          setProfileName(data[0].name + (data[0].email ? ` (${data[0].email})` : ""));
        }
      }
    } catch (err) {
      console.error("Discovered profiles error:", err);
    }
  };

  const handleLaunchBrowser = async () => {
    setError("");
    setSuccess("");
    if (useCustomPath && !chromeProfilePath.trim()) {
      setError("Please select a Chrome profile path first.");
      return;
    }

    setLaunchingBrowser(true);
    setBrowserLaunchedMessage("Opening Chrome window... Please log in to your account, go to the page you want to connect, and CLOSE the Chrome browser window when done.");

    try {
      console.log(`📡 Requesting headed browser launch...`);
      const response = await fetch(`${API_BASE}/api/profiles/launch-browser`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-company-id": companyId,
        },
        body: JSON.stringify({
          chromeProfilePath: useCustomPath ? chromeProfilePath : undefined,
          platform,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update login session.");
      }

      setSuccess(`Login session updated successfully! Saving profile...`);
      
      // If we are not in manual path mode, automatically save/link the profile right now!
      if (!useCustomPath) {
        await saveProfile(data.chromeProfilePath);
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect to browser launcher service.");
    } finally {
      setLaunchingBrowser(false);
      setBrowserLaunchedMessage("");
    }
  };

  const handleSessionFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError("");
    setSuccess("");
    setUploadingSession(true);
    setUploadedSessionPath("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${API_BASE}/api/profiles/upload-session`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "x-company-id": companyId,
        },
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        setUploadedSessionPath(data.sessionPath);
        setUploadedFileName(file.name);
      } else {
        setError(data.error || "Failed to upload session file");
      }
    } catch (err) {
      setError("Network error uploading session file");
    } finally {
      setUploadingSession(false);
      e.target.value = "";
    }
  };

  const saveProfile = async (resolvedPath: string) => {
    if (!profileName.trim()) {
      setError("Please enter a Profile Label first.");
      return;
    }

    if (needsTargetPage && !targetPageId.trim()) {
      setError(
        platform === "facebook"
          ? "Please enter the exact Facebook Page name to post to."
          : "Please enter the LinkedIn Company Page URL or ID to post to."
      );
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/profiles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-company-id": companyId,
        },
        body: JSON.stringify({
          platform,
          profileName,
          chromeProfilePath: resolvedPath,
          profileId: needsTargetPage ? targetPageId.trim() : undefined,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setSuccess(`Successfully linked ${profileName}!`);
        setProfileName("");
        setChromeProfilePath("");
        setTargetPageId("");
        setUploadedSessionPath("");
        setUploadedFileName("");
        fetchProfiles();
      } else {
        setError(data.error || "Failed to link profile");
      }
    } catch (err) {
      setError("Network error connecting profile");
    }
  };

  const handleConnectProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!profileName.trim()) {
      setError("Please enter a Profile Label (Name).");
      return;
    }

    if (needsTargetPage && !targetPageId.trim()) {
      setError(
        platform === "facebook"
          ? "Please enter the exact Facebook Page name to post to."
          : "Please enter the LinkedIn Company Page URL or ID to post to."
      );
      return;
    }

    if (useCustomPath) {
      if (!chromeProfilePath.trim()) {
        setError("Please enter a Chrome profile path.");
        return;
      }
      await saveProfile(chromeProfilePath);
    } else {
      if (sessionSource === "reuse") {
        if (!chromeProfilePath) {
          setError("Please select an existing session to reuse.");
          return;
        }
        await saveProfile(chromeProfilePath);
      } else {
        if (!uploadedSessionPath) {
          setError("Please upload a session file first (capture it with the browser extension, or 'npm run capture-session').");
          return;
        }
        await saveProfile(uploadedSessionPath);
      }
    }
  };

  const handleDisconnect = async (profileId: string) => {
    if (!confirm("Are you sure you want to disconnect this profile?")) return;

    try {
      const response = await fetch(`${API_BASE}/api/profiles/${profileId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "x-company-id": companyId,
        },
      });

      if (response.ok) {
        fetchProfiles();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to disconnect profile");
      }
    } catch (err) {
      alert("Error disconnecting profile");
    }
  };

  const handleDiscoveredChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedPath = e.target.value;
    setChromeProfilePath(selectedPath);
    const matched = discoveredProfiles.find(dp => dp.path === selectedPath);
    if (matched) {
      setProfileName(matched.name + (matched.email ? ` (${matched.email})` : ""));
    }
  };

  return (
    <div 
      className="tab-panel animate-fade-in" 
      style={{ 
        display: "grid", 
        gridTemplateColumns: isAdmin ? "1fr 1.3fr" : "1fr", 
        gap: "24px" 
      }}
    >
      
      {/* Form to connect a profile */}
      {isAdmin && (
        <div className="glass-panel" style={{ padding: "24px", height: "fit-content" }}>
        <h3>Link Social Account</h3>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "8px 0 20px" }}>
          This server has no display, so it can't show you a login window. Log in once on your
          own computer, then upload the resulting session file here.
        </p>

        {error && <div className="auth-error-message">{error}</div>}
        {success && (
          <div style={{
            background: "rgba(16, 185, 129, 0.1)",
            border: "1px solid rgba(16, 185, 129, 0.2)",
            color: "#a7f3d0",
            padding: "12px",
            borderRadius: "var(--radius-sm)",
            fontSize: "13px",
            marginBottom: "20px",
            textAlign: "center"
          }}>{success}</div>
        )}

        <form onSubmit={handleConnectProfile} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          
          {/* Profile Label */}
          <div className="form-group">
            <label className="glass-label">Profile Label (Name)</label>
            <input
              type="text"
              className="glass-input"
              placeholder="e.g. Mustehsan's Personal FB"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              required
            />
          </div>

          {/* Platform Selector */}
          <div className="form-group">
            <label className="glass-label">Social Platform</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="glass-input"
              style={{ background: "rgba(0,0,0,0.2)" }}
            >
              <option value="facebook">Facebook Page</option>
              <option value="instagram">Instagram Business</option>
              <option value="linkedin">LinkedIn Profile / Page</option>
              <option value="tiktok">TikTok Studio</option>
            </select>
          </div>

          {/* Target Page (Facebook/LinkedIn only - one login can manage many pages) */}
          {needsTargetPage && (
            <div className="form-group">
              <label className="glass-label">
                {platform === "facebook" ? "Facebook Page Name (exact)" : "LinkedIn Company Page URL or ID"}
              </label>
              <input
                type="text"
                className="glass-input"
                placeholder={
                  platform === "facebook"
                    ? "Exact name as shown on the Page, e.g. Buzzin Tech"
                    : "e.g. https://www.linkedin.com/company/buzzin-tech or 12345678"
                }
                value={targetPageId}
                onChange={(e) => setTargetPageId(e.target.value)}
                required
              />
              <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                {platform === "facebook"
                  ? "This account can administer many Pages — we need the exact Page name to pick the right one when posting."
                  : "This account can administer many Company Pages — we need the Page URL or ID to post there instead of your personal feed."}
              </p>
            </div>
          )}

          {/* Session source toggle (only show if reusable sessions exist) */}
          {!useCustomPath && reusableSessions.length > 0 && (
            <div className="form-group" style={{ borderTop: "1px solid var(--border-color)", paddingTop: "12px" }}>
              <label className="glass-label">Session Source</label>
              <div style={{ display: "flex", gap: "16px", marginTop: "6px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "13px" }}>
                  <input
                    type="radio"
                    name="sessionSource"
                    checked={sessionSource === "upload"}
                    onChange={() => {
                      setSessionSource("upload");
                      setChromeProfilePath("");
                    }}
                  />
                  Upload a new file or ZIP
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "13px" }}>
                  <input
                    type="radio"
                    name="sessionSource"
                    checked={sessionSource === "reuse"}
                    onChange={() => {
                      setSessionSource("reuse");
                      if (reusableSessions.length > 0) {
                        setChromeProfilePath(reusableSessions[0].path);
                      }
                    }}
                  />
                  Reuse an existing session
                </label>
              </div>
            </div>
          )}

          {/* 1. Reuse existing session path dropdown */}
          {!useCustomPath && sessionSource === "reuse" && reusableSessions.length > 0 && (
            <div className="form-group" style={{ borderTop: sessionSource === "reuse" ? "none" : "1px solid var(--border-color)", paddingTop: "12px" }}>
              <label className="glass-label">Select Reusable Profile Session</label>
              <select
                value={chromeProfilePath}
                onChange={(e) => setChromeProfilePath(e.target.value)}
                className="glass-input"
                style={{ background: "rgba(0,0,0,0.2)" }}
              >
                {reusableSessions.map((s, idx) => (
                  <option key={idx} value={s.path}>
                    {s.name} ({s.platform === "facebook" ? "Facebook" : s.platform === "linkedin" ? "LinkedIn" : s.platform})
                  </option>
                ))}
              </select>
              <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>
                This will link the new profile to the same browser session folder on the server. You don't need to re-upload the ZIP file.
              </p>
            </div>
          )}

          {/* 2. Session file upload (primary flow) */}
          {!useCustomPath && sessionSource === "upload" && (
            <div className="form-group" style={{ borderTop: reusableSessions.length > 0 ? "none" : "1px solid var(--border-color)", paddingTop: "12px" }}>
              <label className="glass-label">Session File</label>
              <p style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "8px", lineHeight: "1.5" }}>
                <strong>No code needed:</strong> install the Session Capture browser extension
                (<code>browser-extension/</code> folder — load it unpacked via
                chrome://extensions), log in to {platform}, click the extension, then upload the
                file it downloads below.
                <br />
                <em>Have the codebase instead?</em> Run{" "}
                <code>cd backend &amp;&amp; npm run capture-session -- {platform}</code> and
                upload the resulting <code>session_*.json</code> file.
              </p>
              <input
                type="file"
                accept=".json,.zip,application/json,application/zip,application/x-zip-compressed"
                onChange={handleSessionFileChange}
                disabled={uploadingSession}
                className="glass-input"
              />
              {uploadingSession && (
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "6px" }}>Uploading...</p>
              )}
              {uploadedFileName && !uploadingSession && (
                <p style={{ fontSize: "12px", color: "var(--color-success)", marginTop: "6px" }}>
                  ✓ {uploadedFileName} uploaded
                </p>
              )}
              
              <div style={{
                fontSize: "11px",
                color: "#e2e8f0",
                background: "rgba(255, 255, 255, 0.03)",
                border: "1px solid var(--border-color)",
                padding: "14px",
                borderRadius: "6px",
                marginTop: "14px",
                lineHeight: "1.5"
              }}>
                <div style={{ fontWeight: "bold", color: "#60a5fa", marginBottom: "6px" }}>
                  💡 Permanent Solution for LinkedIn & Facebook (Browser Profile Upload):
                </div>
                To bypass device-binding and IP-fingerprint blocks completely, you can upload your entire Chrome browser profile as a <strong>.zip</strong> archive instead of a JSON file:
                <ol style={{ paddingLeft: "16px", margin: "6px 0", display: "flex", flexDirection: "column", gap: "4px" }}>
                  <li>Create a <strong>new browser profile</strong> in Google Chrome.</li>
                  <li>Log in to {platform} and navigate to your dashboard/page.</li>
                  <li><strong>Close Chrome completely</strong> so it flushes all session files to disk.</li>
                  <li>Locate the profile folder on your PC:
                    <br />• <u>Windows:</u> <code>%LOCALAPPDATA%\Google\Chrome\User Data\&lt;Profile Name&gt;</code> (e.g. <code>Profile 1</code>)
                    <br />• <u>macOS:</u> <code>~/Library/Application Support/Google/Chrome/&lt;Profile Name&gt;</code>
                  </li>
                  <li>Right-click that profile folder, select <strong>Compress to ZIP file</strong>, and upload it here.</li>
                </ol>
                <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>
                  * This sets up a permanent persistent browser state on the server that never conflicts with your active PC browser sessions.
                </span>
              </div>
            </div>
          )}

          {/* Advanced Path Selector (Hidden by default) */}
          {useCustomPath && (
            <div className="form-group" style={{ borderTop: "1px solid var(--border-color)", paddingTop: "12px" }}>
              <label className="glass-label">Chrome Session Profile (Advanced)</label>
              {discoveredProfiles.length > 0 ? (
                <select
                  value={chromeProfilePath}
                  onChange={handleDiscoveredChange}
                  className="glass-input"
                  style={{ background: "rgba(0,0,0,0.2)", marginBottom: "10px" }}
                >
                  {discoveredProfiles.map((dp) => (
                    <option key={dp.path} value={dp.path}>
                      👤 {dp.name} {dp.email ? `(${dp.email})` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  className="glass-input"
                  placeholder="C:\Users\username\AppData\Local\Google\Chrome\User Data\Profile 1"
                  value={chromeProfilePath}
                  onChange={(e) => setChromeProfilePath(e.target.value)}
                  style={{ marginBottom: "10px" }}
                />
              )}

              <button
                type="button"
                className="glass-button"
                style={{
                  width: "100%",
                  justifyContent: "center",
                  borderColor: "var(--color-primary)",
                  background: "rgba(99, 102, 241, 0.05)"
                }}
                onClick={handleLaunchBrowser}
                disabled={launchingBrowser}
              >
                🔑 {launchingBrowser ? "Browser window active..." : "Step 1: Open Chrome and Log In"}
              </button>
            </div>
          )}

          {/* Action Trigger */}
          {!useCustomPath ? (
            <button
              type="submit"
              className="glass-button primary animate-pulse"
              style={{ justifyContent: "center", marginTop: "8px" }}
              disabled={uploadingSession || (sessionSource === "upload" && !uploadedSessionPath) || (sessionSource === "reuse" && !chromeProfilePath)}
            >
              🚀 Link Channel
            </button>
          ) : (
            <button 
              type="submit" 
              className="glass-button primary" 
              style={{ justifyContent: "center", marginTop: "8px" }}
              disabled={launchingBrowser}
            >
              Step 2: Link Selected Channel
            </button>
          )}

          {/* Browser banner guide */}
          {browserLaunchedMessage && (
            <div style={{
              fontSize: "11px",
              color: "#c7d2fe",
              background: "rgba(99, 102, 241, 0.1)",
              border: "1px solid rgba(99, 102, 241, 0.2)",
              padding: "10px",
              borderRadius: "4px",
              marginTop: "4px",
              textAlign: "center",
              lineHeight: "1.4"
            }}>
              ℹ️ {browserLaunchedMessage}
            </div>
          )}

          {/* Toggle link */}
          <div style={{ textAlign: "center", marginTop: "8px" }}>
            <button
              type="button"
              onClick={() => {
                setUseCustomPath(!useCustomPath);
                setError("");
                setSuccess("");
                setChromeProfilePath("");
              }}
              style={{
                background: "none",
                border: "none",
                color: "var(--color-primary)",
                cursor: "pointer",
                fontSize: "11px",
                fontWeight: 600
              }}
            >
              {useCustomPath ? "← Use session file upload (recommended)" : "⚙️ Legacy: auto-launch browser on this server (only works if it has a display)"}
            </button>
          </div>
        </form>
      </div>
    )}

      {/* List of connected profiles */}
      <div className="glass-panel" style={{ padding: "24px" }}>
        <h3>Linked Channels</h3>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "8px 0 20px" }}>
          Active accounts available for scheduler operations.
        </p>

        {loading ? (
          <p style={{ color: "var(--text-secondary)" }}>Loading profiles...</p>
        ) : profiles.length === 0 ? (
          <p style={{ color: "var(--text-muted)", fontSize: "14px", padding: "40px 0", textAlign: "center" }}>
            No channels linked yet. Use the form on the left to add one.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {profiles.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <strong style={{ fontSize: "15px" }}>{p.profileName}</strong>
                    <span
                      style={{
                        fontSize: "11px",
                        textTransform: "uppercase",
                        background: "rgba(255,255,255,0.05)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        color: "var(--text-secondary)"
                      }}
                    >
                      {p.platform}
                    </span>
                  </div>
                  {p.profileId && (
                    <p style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px" }}>
                      Posts to: {p.profileId}
                    </p>
                  )}
                  <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", maxWidth: "400px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    Session: {p.chromeProfilePath}
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span
                    className="status-indicator"
                    style={
                      p.status === "error"
                        ? { border: "none", color: "var(--color-danger)", background: "rgba(239, 68, 68, 0.1)" }
                        : { border: "none" }
                    }
                  >
                    {p.status === "error" ? "session expired" : p.status}
                  </span>
                  {isAdmin && (
                    <button
                      className="glass-button"
                      style={{ padding: "6px 12px", fontSize: "12px", border: "1px solid rgba(239, 68, 68, 0.2)" }}
                      onClick={() => handleDisconnect(p.id)}
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

