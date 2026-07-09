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

export default function Moderation({ token, companyId }: ModerationProps) {
  const [rules, setRules] = useState<ModerationRule[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  
  // Form state
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [type, setType] = useState<string>("comment");
  const [triggerKeyword, setTriggerKeyword] = useState<string>("");
  const [replyText, setReplyText] = useState<string>("");

  useEffect(() => {
    if (token && companyId) {
      fetchRules();
      fetchProfiles();
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
          type,
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
      if (res.ok) alert("Sync triggered! Check terminal for logs.");
      else alert("Error: " + data.error);
    } catch (e) {
      alert("Network error");
    }
  };

  return (
    <div className="tab-panel animate-fade-in">
      <div className="glass-panel" style={{ marginBottom: "20px" }}>
        <h3>💬 Auto-Moderation Engine</h3>
        <p>Trigger background processes to scan and auto-reply to DMs and comments using your configured rules below.</p>
        <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
          <button className="glass-button" onClick={() => triggerSync("sync-dms")}>
            Sync & Auto-Reply DMs
          </button>
          <button className="glass-button" onClick={() => triggerSync("sync-comments")}>
            Sync & Auto-Reply Comments
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "20px" }}>
        <div className="glass-panel">
          <h3>Add New Rule</h3>
          <form onSubmit={handleCreateRule}>
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
              <select className="glass-input" value={type} onChange={e => setType(e.target.value)}>
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
            <button type="submit" className="glass-button primary" style={{ width: "100%" }}>Save Rule</button>
          </form>
        </div>

        <div className="glass-panel">
          <h3>Active Rules</h3>
          {rules.length === 0 ? (
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
                  {rules.map(rule => (
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
    </div>
  );
}
