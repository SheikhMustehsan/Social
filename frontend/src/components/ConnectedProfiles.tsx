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
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const [launchingBrowser, setLaunchingBrowser] = useState(false);
  const [browserLaunchedMessage, setBrowserLaunchedMessage] = useState("");

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
    if (!chromeProfilePath.trim()) {
      setError("Please select a Chrome profile path first.");
      return;
    }

    setLaunchingBrowser(true);
    setBrowserLaunchedMessage("Opening Chrome window... Please log in to your account, go to the page you want to connect, and CLOSE the Chrome browser window when done.");

    try {
      console.log(`📡 Requesting headed browser launch for profile: ${chromeProfilePath}`);
      const response = await fetch(`${API_BASE}/api/profiles/launch-browser`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-company-id": companyId,
        },
        body: JSON.stringify({
          chromeProfilePath,
          platform,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setSuccess(`Login session updated successfully! You can now link your ${platform} profile.`);
      } else {
        setError(data.error || "Failed to update login session.");
      }
    } catch (err) {
      setError("Failed to connect to browser launcher service.");
    } finally {
      setLaunchingBrowser(false);
      setBrowserLaunchedMessage("");
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

  const handleConnectProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!profileName.trim() || !chromeProfilePath.trim()) {
      setError("Please fill out all fields.");
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
          chromeProfilePath,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setSuccess(`Successfully linked ${profileName}!`);
        // If not using custom path, reset name to first discovered profile, otherwise clear
        if (discoveredProfiles.length > 0 && !useCustomPath) {
          setChromeProfilePath(discoveredProfiles[0].path);
          setProfileName(discoveredProfiles[0].name + (discoveredProfiles[0].email ? ` (${discoveredProfiles[0].email})` : ""));
        } else {
          setProfileName("");
          setChromeProfilePath("");
        }
        fetchProfiles();
      } else {
        setError(data.error || "Failed to link profile");
      }
    } catch (err) {
      setError("Network error connecting profile");
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
          Link your pre-authenticated Google Chrome session to publish posts natively.
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

          {/* Chrome Profile Selection (Auto Discovered vs Manual Input) */}
          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <label className="glass-label" style={{ margin: 0 }}>Chrome Session Profile</label>
              
              {discoveredProfiles.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setUseCustomPath(!useCustomPath);
                    setError("");
                    setSuccess("");
                    if (useCustomPath) {
                      // Reset back to first discovered
                      setChromeProfilePath(discoveredProfiles[0].path);
                      setProfileName(discoveredProfiles[0].name + (discoveredProfiles[0].email ? ` (${discoveredProfiles[0].email})` : ""));
                    } else {
                      setChromeProfilePath("");
                      setProfileName("");
                    }
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
                  {useCustomPath ? "Show Auto-Discovered Profiles" : "Enter Path Manually"}
                </button>
              )}
            </div>

            {discoveredProfiles.length > 0 && !useCustomPath ? (
              // 1. Dropdown for auto-discovered profiles
              <select
                value={chromeProfilePath}
                onChange={handleDiscoveredChange}
                className="glass-input"
                style={{ background: "rgba(0,0,0,0.2)" }}
                required
              >
                {discoveredProfiles.map((dp) => (
                  <option key={dp.path} value={dp.path}>
                    👤 {dp.name} {dp.email ? `(${dp.email})` : ""}
                  </option>
                ))}
              </select>
            ) : (
              // 2. Fallback Manual File Input
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <input
                  type="text"
                  className="glass-input"
                  placeholder="C:\Users\username\AppData\Local\Google\Chrome\User Data\Profile 11"
                  value={chromeProfilePath}
                  onChange={(e) => setChromeProfilePath(e.target.value)}
                  required
                />
                
                <label className="glass-label">Profile Label (Name)</label>
                <input
                  type="text"
                  className="glass-input"
                  placeholder="e.g. Agency Main FB Profile"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  required
                />
              </div>
            )}

            {chromeProfilePath && (
              <div style={{ marginTop: "12px" }}>
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
                  🔑 {launchingBrowser ? "Login Session Active..." : `Open Chrome to Log In to ${platform.toUpperCase()}`}
                </button>
                
                {browserLaunchedMessage && (
                  <div style={{
                    fontSize: "11px",
                    color: "#c7d2fe",
                    background: "rgba(99, 102, 241, 0.1)",
                    border: "1px solid rgba(99, 102, 241, 0.2)",
                    padding: "10px",
                    borderRadius: "4px",
                    marginTop: "8px",
                    textAlign: "center",
                    lineHeight: "1.4"
                  }}>
                    ℹ️ {browserLaunchedMessage}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Helper details for discovered profiles */}
          {discoveredProfiles.length > 0 && !useCustomPath && (
            <div style={{
              fontSize: "11px",
              color: "var(--text-muted)",
              background: "rgba(255,255,255,0.01)",
              padding: "10px",
              borderRadius: "4px",
              border: "1px solid var(--border-color)",
              wordBreak: "break-all"
            }}>
              📁 Selected path: <code style={{ color: "var(--text-secondary)" }}>{chromeProfilePath}</code>
            </div>
          )}

          <button type="submit" className="glass-button primary" style={{ justifyContent: "center", marginTop: "8px" }}>
            Link Selected Channel
          </button>
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
                  <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", maxWidth: "400px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    Path: {p.chromeProfilePath}
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span className="status-indicator" style={{ border: "none" }}>{p.status}</span>
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

