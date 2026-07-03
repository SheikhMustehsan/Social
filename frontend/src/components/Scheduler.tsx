import React, { useState, useEffect } from "react";
import Calendar from "./Calendar.js";

interface Profile {
  id: string;
  platform: string;
  profileName: string;
}

interface Post {
  id: string;
  caption: string;
  mediaUrls: string[];
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  errorMessage: string | null;
  profile: {
    id: string;
    platform: string;
    profileName: string;
  };
}

interface SchedulerProps {
  token: string;
  companyId: string;
  isAdmin: boolean;
}

export default function Scheduler({ token, companyId, isAdmin }: SchedulerProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [postsQueue, setPostsQueue] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);

  // Form State
  const [selectedProfileIds, setSelectedProfileIds] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [publishNow, setPublishNow] = useState(true);
  const [postType, setPostType] = useState<"feed" | "story">("feed");
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (companyId) {
      fetchProfiles();
      fetchQueue();
    }
  }, [companyId]);

  const fetchProfiles = async () => {
    try {
      const response = await fetch("http://localhost:3000/api/profiles", {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-company-id": companyId,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setProfiles(data);
        if (data.length > 0) {
          // Pre-select the first profile by default
          setSelectedProfileIds([data[0].id]);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const response = await fetch("http://localhost:3000/api/scheduler/posts", {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-company-id": companyId,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setPostsQueue(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Toggle selection for social account checkboxes
  const handleProfileToggle = (profileId: string) => {
    setSelectedProfileIds((prev) =>
      prev.includes(profileId)
        ? prev.filter((id) => id !== profileId)
        : [...prev, profileId]
    );
  };

  // Handle uploading files from user's laptop to server storage
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFiles(true);
    const uploadedPaths: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const formData = new FormData();
      formData.append("file", file);

      try {
        console.log(`📤 Uploading file to server: ${file.name}`);
        const response = await fetch("http://localhost:3000/api/scheduler/upload", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        const data = await response.json();
        if (response.ok) {
          uploadedPaths.push(data.filePath);
        } else {
          alert(`Failed to upload ${file.name}: ${data.error}`);
        }
      } catch (err) {
        console.error(err);
        alert(`Error uploading file ${file.name}`);
      }
    }

    // Append uploaded paths to mediaUrls list
    setMediaUrls((prev) => [...prev, ...uploadedPaths]);
    setUploadingFiles(false);
  };

  const handleRemoveMedia = (index: number) => {
    setMediaUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSchedulePost = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedProfileIds.length === 0) {
      alert("Please select at least one social media channel to publish to.");
      return;
    }

    setSubmitting(true);

    let scheduledAt = null;
    if (!publishNow && scheduledDate && scheduledTime) {
      scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
    }

    try {
      const response = await fetch("http://localhost:3000/api/scheduler/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-company-id": companyId,
        },
        body: JSON.stringify({
          socialProfileIds: selectedProfileIds,
          caption,
          mediaUrls,
          scheduledAt,
          postType,
        }),
      });

      if (response.ok) {
        // Reset composer states
        setCaption("");
        setMediaUrls([]);
        setPublishNow(true);
        setScheduledDate("");
        setScheduledTime("");
        setPostType("feed");
        
        // Refresh queue representation
        fetchQueue();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to schedule posts");
      }
    } catch (err) {
      alert("Error scheduling posts");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelPost = async (postId: string) => {
    try {
      const response = await fetch(`http://localhost:3000/api/scheduler/posts/${postId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "x-company-id": companyId,
        },
      });

      if (response.ok) {
        fetchQueue();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to cancel post");
      }
    } catch (err) {
      alert("Error canceling post");
    }
  };

  return (
    <div 
      className="tab-panel animate-fade-in" 
      style={{ 
        display: "grid", 
        gridTemplateColumns: isAdmin ? "1.1fr 1.4fr" : "1fr", 
        gap: "24px" 
      }}
    >
      {/* 1. COMPOSER CARD */}
      {isAdmin && (
        <div className="glass-panel" style={{ padding: "24px", height: "fit-content" }}>
        <h3>Social Composer</h3>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "8px 0 20px" }}>
          Publish or schedule media updates to multiple platforms simultaneously.
        </p>

        <form onSubmit={handleSchedulePost} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          
          {/* Social Profiles Checkbox List */}
          <div className="form-group">
            <label className="glass-label">Select Channels</label>
            {profiles.length === 0 ? (
              <p style={{ fontSize: "13px", color: "var(--text-muted)", padding: "10px 0" }}>
                No connected channels found. Please link profiles first.
              </p>
            ) : (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
                gap: "8px",
                padding: "8px 0"
              }}>
                {profiles.map((p) => {
                  const isChecked = selectedProfileIds.includes(p.id);
                  return (
                    <label
                      key={p.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "8px 12px",
                        background: isChecked ? "var(--color-primary-glow)" : "rgba(255,255,255,0.02)",
                        border: `1px solid ${isChecked ? "var(--color-primary)" : "var(--border-color)"}`,
                        borderRadius: "var(--radius-sm)",
                        cursor: "pointer",
                        fontSize: "13px",
                        fontWeight: isChecked ? 600 : 400,
                        transition: "all 0.2s ease"
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleProfileToggle(p.id)}
                        style={{ cursor: "pointer" }}
                      />
                      <span style={{ textTransform: "capitalize" }}>
                        {p.profileName} ({p.platform === "linkedin" ? "LN" : p.platform.substring(0, 2).toUpperCase()})
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Post Type Selector (Feed / Story) */}
          <div className="form-group">
            <label className="glass-label">Post Type</label>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                className={`glass-button ${postType === "feed" ? "active" : ""}`}
                style={{ flex: 1, justifyContent: "center" }}
                onClick={() => setPostType("feed")}
              >
                📰 Feed Post
              </button>
              <button
                type="button"
                className={`glass-button ${postType === "story" ? "active" : ""}`}
                style={{ flex: 1, justifyContent: "center" }}
                onClick={() => setPostType("story")}
              >
                🎬 Story placement
              </button>
            </div>
          </div>

          {/* Caption Input */}
          <div className="form-group">
            <label className="glass-label">Caption / Post Text</label>
            <textarea
              className="glass-input"
              rows={4}
              placeholder="What do you want to say? Draft caption details..."
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              style={{ resize: "vertical" }}
            />
          </div>

          {/* Media Upload Selector */}
          <div className="form-group">
            <label className="glass-label">Upload Images / Videos</label>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <input
                type="file"
                multiple
                id="file-upload-input"
                style={{ display: "none" }}
                onChange={handleFileUpload}
                disabled={uploadingFiles}
              />
              <label
                htmlFor="file-upload-input"
                className="glass-button"
                style={{
                  justifyContent: "center",
                  cursor: uploadingFiles ? "not-allowed" : "pointer",
                  borderStyle: "dashed"
                }}
              >
                {uploadingFiles ? "Uploading file stream..." : "📎 Add media from laptop"}
              </label>

              {/* Uploaded File Previews */}
              {mediaUrls.length > 0 && (
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  background: "rgba(0,0,0,0.2)",
                  padding: "8px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-color)"
                }}>
                  {mediaUrls.map((url, index) => (
                    <div key={index} style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: "12px",
                      color: "var(--text-secondary)"
                    }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "240px" }}>
                        📄 {url.split(/\\|\//).pop()}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveMedia(index)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "var(--color-danger)",
                          cursor: "pointer",
                          fontWeight: "bold",
                          fontSize: "14px"
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Publishing Time Checkbox */}
          <div className="form-group" style={{ flexDirection: "row", alignItems: "center", gap: "8px" }}>
            <input
              type="checkbox"
              id="publish-now-chk"
              checked={publishNow}
              onChange={(e) => setPublishNow(e.target.checked)}
              style={{ cursor: "pointer" }}
            />
            <label htmlFor="publish-now-chk" className="glass-label" style={{ margin: 0, cursor: "pointer" }}>
              Publish immediately
            </label>
          </div>

          {/* Schedule Picker */}
          {!publishNow && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div className="form-group">
                <label className="glass-label">Date</label>
                <input
                  type="date"
                  className="glass-input"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="glass-label">Time</label>
                <input
                  type="time"
                  className="glass-input"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          {/* Submit Action */}
          <button
            type="submit"
            className="glass-button primary"
            style={{ justifyContent: "center", marginTop: "8px" }}
            disabled={submitting || selectedProfileIds.length === 0 || uploadingFiles}
          >
            {submitting ? "Publishing queue..." : publishNow ? "Publish Now" : "Schedule Publication"}
          </button>
        </form>
      </div>
    )}

      {/* 2. CALENDAR & QUEUE GRID */}
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        
        {/* Render interactive calendar component */}
        <Calendar posts={postsQueue} onCancelPost={handleCancelPost} />

        {/* Failed items log / details summary */}
        {postsQueue.some(p => p.status === "failed") && (
          <div className="glass-panel" style={{ padding: "24px" }}>
            <h4 style={{ color: "var(--color-danger)", marginBottom: "12px" }}>⚠️ Failed Deliveries Log</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {postsQueue.filter(p => p.status === "failed").map(p => (
                <div key={p.id} style={{
                  fontSize: "12px",
                  padding: "10px",
                  background: "rgba(239, 68, 68, 0.05)",
                  border: "1px solid rgba(239, 68, 68, 0.1)",
                  borderRadius: "var(--radius-sm)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center"
                }}>
                  <div>
                    <strong>{p.profile.profileName} ({p.profile.platform.toUpperCase()}):</strong> {p.errorMessage}
                  </div>
                  <button
                    className="glass-button"
                    style={{ padding: "3px 8px", fontSize: "11px", borderColor: "rgba(255,255,255,0.05)" }}
                    onClick={() => handleCancelPost(p.id)}
                  >
                    Clear
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
