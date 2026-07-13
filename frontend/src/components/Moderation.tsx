import { useState, useEffect } from "react";
import { API_BASE } from "../config";

interface ModerationProps {
  token: string;
  companyId: string;
}

interface Profile {
  id: string;
  profileName: string;
  platform: string;
}

interface ModerationRule {
  id: string;
  companyId: string;
  socialProfileId: string | null;
  platform: string | null;
  type: string;
  triggerKeyword: string;
  replyText: string;
  profileName?: string;
}

interface SyncJob {
  id: string;
  jobType: string;
  status: string;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

export default function Moderation({ token, companyId }: ModerationProps) {
  const [rules, setRules] = useState<ModerationRule[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [syncJobs, setSyncJobs] = useState<SyncJob[]>([]);
  
  // Form state for Rules
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [ruleType, setRuleType] = useState<string>("comment");
  const [triggerKeyword, setTriggerKeyword] = useState<string>("");
  const [replyText, setReplyText] = useState<string>("");

  // Form state for Tracked URLs
  const [trackedProfileId, setTrackedProfileId] = useState<string>("");
  const [trackedUrl, setTrackedUrl] = useState<string>("");

  useEffect(() => {
    if (token && companyId) {
      fetchRules();
      fetchProfiles();
      fetchSyncJobs();
    }
  }, [token, companyId]);

  const fetchRules = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/moderation/rules`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-company-id": companyId,
        },
      });
      if (res.ok) {
        setRules(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchProfiles = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/profiles`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-company-id": companyId,
        },
      });
      if (res.ok) {
        setProfiles(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSyncJobs = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/moderation/sync-jobs`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-company-id": companyId,
        },
      });
      if (res.ok) {
        setSyncJobs(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/moderation/rules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-company-id": companyId,
        },
        body: JSON.stringify({
          socialProfileId: selectedProfileId || null,
          platform: selectedProfileId ? profiles.find(p => p.id === selectedProfileId)?.platform : null,
          type: ruleType,
          triggerKeyword,
          replyText
        }),
      });
      if (res.ok) {
        setTriggerKeyword("");
        setReplyText("");
        fetchRules();
      } else {
        const data = await res.json();
        alert("Error: " + data.error);
      }
    } catch (e) {
      alert("Network error");
    }
  };

  const handleAddTrackedUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/moderation/rules`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-company-id": companyId,
        },
        body: JSON.stringify({
          socialProfileId: trackedProfileId,
          platform: profiles.find(p => p.id === trackedProfileId)?.platform,
          type: "tracked_post",
          triggerKeyword: trackedUrl,
          replyText: ""
        }),
      });
      if (res.ok) {
        setTrackedUrl("");
        fetchRules();
      } else {
        const data = await res.json();
        alert("Error: " + data.error);
      }
    } catch (e) {
      alert("Network error");
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm("Delete this rule?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/moderation/rules/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "x-company-id": companyId,
        },
      });
      if (res.ok) {
        fetchRules();
      }
    } catch (e) {
      alert("Network error");
    }
  };

  const triggerSync = async (endpoint: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/profiles/${endpoint}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "x-company-id": companyId
        }
      });
      const data = await res.json();
      if (res.ok) {
        alert("Sync triggered! The job status will appear in the Recent Background Jobs table below shortly.");
        fetchSyncJobs();
      }
      else alert("Error: " + data.error);
    } catch (e) {
      alert("Network error");
    }
  };

  return (
    <div className="tab-panel animate-fade-in">
      <div className="glass-panel" style={{ marginBottom: "20px" }}>
        <h3>💬 Auto-Moderation Engine</h3>
        <p>Trigger background processes to scan and auto-reply to DMs and comments using your configured rules below. Currently limited to 1 post/message for testing.</p>
        <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
          <button className="glass-button" onClick={() => triggerSync("sync-dms")}>
            Sync & Auto-Reply DMs
          </button>
          <button className="glass-button" onClick={() => triggerSync("sync-comments")}>
            Sync & Auto-Reply Comments
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        <div className="glass-panel">
          <h3>Create Auto-Reply Rule</h3>
          <form onSubmit={handleCreateRule} style={{ marginTop: "15px" }}>
            <div className="form-group" style={{ marginBottom: "10px" }}>
              <label className="glass-label">Social Profile</label>
              <select className="glass-input" value={selectedProfileId} onChange={e => setSelectedProfileId(e.target.value)}>
                <option value="">All Profiles (Global)</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.profileName} ({p.platform})</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: "10px" }}>
              <label className="glass-label">Message Type</label>
              <select className="glass-input" value={ruleType} onChange={e => setRuleType(e.target.value)}>
                <option value="comment">Comment</option>
                <option value="dm">Direct Message</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: "10px" }}>
              <label className="glass-label">Trigger Keyword</label>
              <input 
                type="text" 
                className="glass-input" 
                placeholder="e.g. price, cost, or * for fallback" 
                value={triggerKeyword} 
                onChange={e => setTriggerKeyword(e.target.value)} 
                required 
              />
              <small style={{color: 'rgba(255,255,255,0.6)'}}>Use * to match any message</small>
            </div>
            <div className="form-group" style={{ marginBottom: "15px" }}>
              <label className="glass-label">Reply Text</label>
              <textarea 
                className="glass-input" 
                placeholder="The automated reply..." 
                value={replyText} 
                onChange={e => setReplyText(e.target.value)} 
                required 
                rows={3}
              />
            </div>
            <button type="submit" className="glass-button primary" style={{ width: "100%", marginTop: "15px" }}>Add Rule</button>
          </form>
        </div>

        <div className="glass-panel">
          <h3>Track Specific Posts</h3>
          <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.7)", marginBottom: "15px" }}>
            Paste the URL of a specific ad or ranking post. The bot will prioritize scanning these posts for comments before checking your main profile grid.
          </p>
          <form onSubmit={handleAddTrackedUrl}>
            <div className="form-group" style={{ marginBottom: "10px" }}>
              <label className="glass-label">Select Profile</label>
              <select className="glass-input" value={trackedProfileId} onChange={(e) => setTrackedProfileId(e.target.value)} required>
                <option value="">-- Choose Profile --</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>{p.profileName} ({p.platform})</option>
                ))}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: "10px" }}>
              <label className="glass-label">Post URL</label>
              <input 
                type="url" 
                className="glass-input" 
                placeholder="https://www.instagram.com/p/..." 
                value={trackedUrl} 
                onChange={(e) => setTrackedUrl(e.target.value)} 
                required 
              />
            </div>
            <button type="submit" className="glass-button primary" style={{ width: "100%", marginTop: "15px" }}>Track Post</button>
          </form>

          <h4 style={{ marginTop: "20px", marginBottom: "10px", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "5px" }}>Currently Tracked URLs</h4>
          {rules.filter(r => r.type === "tracked_post").length === 0 ? (
            <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.5)" }}>No posts tracked.</p>
          ) : (
            <div style={{ maxHeight: "150px", overflowY: "auto" }}>
              {rules.filter(r => r.type === "tracked_post").map(rule => (
                <div key={rule.id} className="rule-card" style={{ padding: "8px", background: "rgba(0,0,0,0.2)", borderRadius: "8px", marginBottom: "5px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ overflow: "hidden" }}>
                    <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.5)" }}>{rule.profileName}</div>
                    <div style={{ fontSize: "0.85rem", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>{rule.triggerKeyword}</div>
                  </div>
                  <button className="glass-button" style={{ padding: "4px 8px", background: "rgba(255,82,82,0.2)", color: "#ff5252", minWidth: "auto", border: "none" }} onClick={() => handleDeleteRule(rule.id)}>
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="glass-panel" style={{ marginTop: "20px" }}>
        <h3>Active Auto-Reply Rules</h3>
        <div style={{ marginTop: "15px" }}>
          {rules.filter(r => r.type !== "tracked_post").length === 0 ? (
            <p>No moderation rules configured yet.</p>
          ) : (
            <div className="table-responsive">
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", textAlign: "left" }}>
                    <th style={{ padding: "10px" }}>Profile</th>
                    <th style={{ padding: "10px" }}>Type</th>
                    <th style={{ padding: "10px" }}>Keyword</th>
                    <th style={{ padding: "10px" }}>Reply</th>
                    <th style={{ padding: "10px" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.filter(r => r.type !== "tracked_post").map(rule => (
                    <tr key={rule.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <td style={{ padding: "10px" }}>{rule.profileName || "Global"}</td>
                      <td style={{ padding: "10px", textTransform: "capitalize" }}>{rule.type}</td>
                      <td style={{ padding: "10px" }}><code>{rule.triggerKeyword}</code></td>
                      <td style={{ padding: "10px" }}>{rule.replyText}</td>
                      <td style={{ padding: "10px" }}>
                        <button 
                          className="glass-button" 
                          style={{ padding: "4px 8px", fontSize: "0.8rem", background: "rgba(255,50,50,0.2)" }}
                          onClick={() => handleDeleteRule(rule.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="glass-panel" style={{ marginTop: "20px" }}>
        <h3>Recent Background Jobs</h3>
        {syncJobs.length === 0 ? (
          <p>No recent synchronization jobs found.</p>
        ) : (
          <div className="table-responsive">
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", textAlign: "left" }}>
                  <th style={{ padding: "10px" }}>Job Type</th>
                  <th style={{ padding: "10px" }}>Status</th>
                  <th style={{ padding: "10px" }}>Started At</th>
                  <th style={{ padding: "10px" }}>Duration</th>
                  <th style={{ padding: "10px" }}>Error</th>
                </tr>
              </thead>
              <tbody>
                {syncJobs.map(job => (
                  <tr key={job.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={{ padding: "10px", fontWeight: "bold" }}>{job.jobType}</td>
                    <td style={{ padding: "10px" }}>
                      <span style={{
                        padding: "3px 8px", borderRadius: "12px", fontSize: "0.8rem",
                        background: job.status === "success" ? "rgba(76,175,80,0.2)" : 
                                    job.status === "failed" ? "rgba(255,82,82,0.2)" : "rgba(255,193,7,0.2)",
                        color: job.status === "success" ? "#4caf50" : 
                               job.status === "failed" ? "#ff5252" : "#ffc107"
                      }}>
                        {job.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: "10px" }}>{new Date(job.startedAt).toLocaleString()}</td>
                    <td style={{ padding: "10px" }}>
                      {job.completedAt ? `${Math.round((new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000)}s` : "-"}
                    </td>
                    <td style={{ padding: "10px", color: "#ff5252", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {job.errorMessage || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
