import React, { useState, useEffect } from "react";
import { API_BASE } from "../config";

interface User {
  id: string;
  email: string;
}

interface Member {
  id: string;
  role: string;
  user: User;
}

interface TeamMembersProps {
  token: string;
  companyId: string;
  isAdmin: boolean;
}

export default function TeamMembers({ token, companyId, isAdmin }: TeamMembersProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token && companyId) {
      fetchMembers();
    }
  }, [token, companyId]);

  const fetchMembers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/companies/${companyId}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      } else {
        console.error("Failed to fetch members");
      }
    } catch (e) {
      console.error("Error fetching members", e);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/companies/${companyId}/members`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email, role }),
      });
      
      const data = await res.json();
      if (res.ok) {
        setEmail("");
        setRole("editor");
        fetchMembers();
      } else {
        setError(data.error || "Failed to invite member");
      }
    } catch (err) {
      setError("Network error while inviting member");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tab-panel glass-panel animate-fade-in">
      <h3>👥 Team Members</h3>
      <p>Manage access to this workspace.</p>

      {isAdmin && (
        <form onSubmit={handleInvite} className="mb-4" style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="email"
            placeholder="User Email"
            className="glass-input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ flex: 1, minWidth: "200px" }}
          />
          <select 
            className="glass-input" 
            value={role} 
            onChange={(e) => setRole(e.target.value)}
            style={{ width: "120px" }}
          >
            <option value="admin">Admin</option>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
          <button type="submit" className="glass-button primary" disabled={loading}>
            {loading ? "Inviting..." : "Invite"}
          </button>
        </form>
      )}

      {error && <div style={{ color: "#ff6b6b", marginBottom: "15px" }}>{error}</div>}

      <div style={{ marginTop: "20px" }}>
        {members.length === 0 ? (
          <p>No members found.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
            {members.map((m) => (
              <li key={m.id} className="glass-panel" style={{ padding: "10px 15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>{m.user.email}</strong>
                </div>
                <span className="role-tag" style={{ textTransform: "capitalize", padding: "4px 8px", background: "rgba(255,255,255,0.1)", borderRadius: "4px", fontSize: "0.85em" }}>
                  {m.role}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
