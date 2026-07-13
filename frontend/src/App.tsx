import React, { useState, useEffect } from "react";
import Auth from "./pages/Auth.js";
import ConnectedProfiles from "./components/ConnectedProfiles.js";
import Scheduler from "./components/Scheduler.js";
import TeamMembers from "./components/TeamMembers.js";
import AdsDashboard from "./components/AdsDashboard.js";
import OrganicDashboard from "./components/OrganicDashboard.js";
import Moderation from "./components/Moderation.js";
import "./App.css";
import { API_BASE } from "./config";

interface User {
  id: string;
  email: string;
  globalRole: string;
}

interface Company {
  id: string;
  name: string;
  createdAt: string;
  role?: string;
}

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [user, setUser] = useState<User | null>(null);
  
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(
    localStorage.getItem("activeCompanyId")
  );
  
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [newCompanyName, setNewCompanyName] = useState("");
  const [showCreateCompanyModal, setShowCreateCompanyModal] = useState(false);
  const [loadingCompanies, setLoadingCompanies] = useState(false);

  // Initialize user from local storage
  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem("user");
      }
    }
  }, [token]);

  // Fetch companies when token changes
  useEffect(() => {
    if (token) {
      fetchCompanies();
    } else {
      setCompanies([]);
      setActiveCompanyId(null);
    }
  }, [token]);

  const fetchCompanies = async () => {
    setLoadingCompanies(true);
    try {
      const response = await fetch(`${API_BASE}/api/companies`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        handleLogout();
        return;
      }

      const data = await response.json();
      if (response.ok) {
        setCompanies(data);
        if (data.length > 0 && !activeCompanyId) {
          selectCompany(data[0].id);
        }
      }
    } catch (err) {
      console.error("Error fetching companies:", err);
    } finally {
      setLoadingCompanies(false);
    }
  };

  const handleLoginSuccess = (newToken: string, loggedUser: User) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("user", JSON.stringify(loggedUser));
    setToken(newToken);
    setUser(loggedUser);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("activeCompanyId");
    setToken(null);
    setUser(null);
    setCompanies([]);
    setActiveCompanyId(null);
  };

  const isUserAdmin = () => {
    if (user?.globalRole === "super_admin") return true;
    const activeCompany = companies.find(c => c.id === activeCompanyId);
    return activeCompany?.role === "admin";
  };

  const selectCompany = (id: string) => {
    localStorage.setItem("activeCompanyId", id);
    setActiveCompanyId(id);
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) return;

    try {
      const response = await fetch(`${API_BASE}/api/companies`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newCompanyName }),
      });

      const data = await response.json();
      if (response.ok) {
        setNewCompanyName("");
        setShowCreateCompanyModal(false);
        await fetchCompanies();
        selectCompany(data.id);
      } else {
        alert(data.error || "Failed to create company");
      }
    } catch (err) {
      console.error(err);
      alert("Network error creating company");
    }
  };

  const getActiveCompany = () => {
    return companies.find((c) => c.id === activeCompanyId);
  };

  if (!token || !user) {
    return <Auth onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app-layout">
      {/* 1. SIDEBAR */}
      <aside className="sidebar glass-panel">
        <div className="sidebar-brand">
          <h1>BuzzinTech</h1>
          <span className="role-tag">{user.globalRole === "super_admin" ? "Super Admin" : "Team Member"}</span>
        </div>

        {/* Company Context Selector */}
        <div className="company-context-box">
          <label className="glass-label">Active Workspace</label>
          <div className="company-selector-wrapper">
            <select
              value={activeCompanyId || ""}
              onChange={(e) => selectCompany(e.target.value)}
              className="glass-input company-select"
              disabled={loadingCompanies || companies.length === 0}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.role ? `(${c.role})` : ""}
                </option>
              ))}
              {companies.length === 0 && <option value="">No Workspaces</option>}
            </select>
          </div>
          
          {user.globalRole === "super_admin" && (
            <button 
              className="glass-button add-workspace-btn"
              onClick={() => setShowCreateCompanyModal(true)}
            >
              + New Company
            </button>
          )}
        </div>

        {/* Navigation Menu */}
        <nav className="sidebar-nav">
          <button 
            className={activeTab === "dashboard" ? "active" : ""} 
            onClick={() => setActiveTab("dashboard")}
          >
            🌱 Organic Dashboard
          </button>
          <button 
            className={activeTab === "ads" ? "active" : ""} 
            onClick={() => setActiveTab("ads")}
          >
            📈 Ads Dashboard
          </button>
          <button
            className={`nav-item ${activeTab === "scheduler" ? "active" : ""}`}
            onClick={() => setActiveTab("scheduler")}
          >
            📅 Social Scheduler
          </button>
          <button
            className={`nav-item ${activeTab === "moderation" ? "active" : ""}`}
            onClick={() => setActiveTab("moderation")}
          >
            💬 Social Inbox
          </button>
          <button
            className={`nav-item ${activeTab === "profiles" ? "active" : ""}`}
            onClick={() => setActiveTab("profiles")}
          >
            🔗 Connected Profiles
          </button>
          <button
            className={`nav-item ${activeTab === "team" ? "active" : ""}`}
            onClick={() => setActiveTab("team")}
          >
            👥 Team Members
          </button>
        </nav>

        {/* User Profile / Logout */}
        <div className="sidebar-footer">
          <div className="user-info">
            <p className="user-email">{user.email}</p>
          </div>
          <button className="glass-button logout-btn" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* 2. MAIN CONTENT AREA */}
      <main className="main-content">
        <header className="content-header">
          <h2>
            {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} - {getActiveCompany()?.name || "No Company Context"}
          </h2>
          <div className="header-actions">
            <span className="status-indicator">Connected</span>
          </div>
        </header>

        <div className="content-body">
          {/* Render Active Tab Panel Placeholder */}
          {activeTab === "dashboard" && (
            <OrganicDashboard token={token} companyId={activeCompanyId || ""} />
          )}

          {activeTab === "scheduler" && (
            <Scheduler token={token} companyId={activeCompanyId || ""} isAdmin={isUserAdmin()} />
          )}

          {activeTab === "moderation" && (
            <Moderation token={token} companyId={activeCompanyId || ""} />
          )}

          {activeTab === "ads" && (
            <AdsDashboard token={token} companyId={activeCompanyId || ""} />
          )}

          {activeTab === "profiles" && (
            <ConnectedProfiles token={token} companyId={activeCompanyId || ""} isAdmin={isUserAdmin()} />
          )}

          {activeTab === "team" && (
            <TeamMembers token={token} companyId={activeCompanyId || ""} isAdmin={isUserAdmin()} />
          )}
        </div>
      </main>

      {/* 3. CREATE COMPANY MODAL */}
      {showCreateCompanyModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-card animate-fade-in">
            <h3>Add New Workspace</h3>
            <p>Every workspace is isolated, containing its own profiles and campaigns.</p>
            <form onSubmit={handleCreateCompany}>
              <div className="form-group" style={{ margin: "16px 0" }}>
                <label className="glass-label">Company Name</label>
                <input
                  type="text"
                  className="glass-input"
                  placeholder="e.g. Brand Agency LLC"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  required
                />
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="glass-button"
                  onClick={() => setShowCreateCompanyModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="glass-button primary">
                  Create Workspace
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
