import { useState, useEffect } from "react";
import { API_BASE } from "../config";

interface SystemAdminProps {
  token: string;
}

interface User {
  id: string;
  email: string;
  globalRole: string;
  createdAt: string;
}

export default function SystemAdmin({ token }: SystemAdminProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (token) fetchUsers();
  }, [token]);

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setUsers(await res.json());
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ email, password })
      });
      
      const data = await res.json();
      if (res.ok) {
        setEmail("");
        setPassword("");
        fetchUsers();
        alert("User created successfully");
      } else {
        setError(data.error || "Failed to create user");
      }
    } catch (e) {
      setError("Network error creating user");
    }
  };

  return (
    <div className="tab-panel animate-fade-in" style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "20px" }}>
      <div className="glass-panel">
        <h3>Create New User</h3>
        <p style={{ marginBottom: "15px", fontSize: "0.9rem", color: "rgba(255,255,255,0.7)" }}>
          As a Super Admin, you can provision new accounts for team members.
        </p>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleCreateUser}>
          <div className="form-group" style={{ marginBottom: "15px" }}>
            <label className="glass-label">Email</label>
            <input 
              type="email" 
              className="glass-input" 
              value={email}
              onChange={e => setEmail(e.target.value)}
              required 
            />
          </div>
          <div className="form-group" style={{ marginBottom: "20px" }}>
            <label className="glass-label">Password</label>
            <input 
              type="password" 
              className="glass-input" 
              value={password}
              onChange={e => setPassword(e.target.value)}
              required 
            />
          </div>
          <button type="submit" className="glass-button primary" style={{ width: "100%" }}>Create Account</button>
        </form>
      </div>

      <div className="glass-panel">
        <h3>System Users</h3>
        <div className="table-responsive">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", textAlign: "left" }}>
                <th style={{ padding: "10px" }}>ID</th>
                <th style={{ padding: "10px" }}>Email</th>
                <th style={{ padding: "10px" }}>Role</th>
                <th style={{ padding: "10px" }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <td style={{ padding: "10px", color: "rgba(255,255,255,0.5)" }}>{u.id.substring(0,8)}...</td>
                  <td style={{ padding: "10px" }}>{u.email}</td>
                  <td style={{ padding: "10px", textTransform: "capitalize" }}>{u.globalRole.replace("_", " ")}</td>
                  <td style={{ padding: "10px" }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
