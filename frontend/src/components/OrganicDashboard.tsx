import { useEffect, useState } from "react";
import { API_BASE } from "../config";

interface OrganicSummary {
  totalFollowers: number;
  totalPosts: number;
  totalReach: number;
  totalEngagement: number;
  engagementRate: number;
  pop: { followers: string; engagement: string; reach: string; };
}

interface OrganicDashboardProps {
  token: string;
  companyId: string;
}

export default function OrganicDashboard({ token, companyId }: OrganicDashboardProps) {
  const [summary, setSummary] = useState<OrganicSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token && companyId) {
      fetchAnalytics();
    }
  }, [token, companyId]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/analytics/organic/summary`, { 
        headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId } 
      });
      if (res.ok) setSummary(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="glass-panel">Loading Organic Data...</div>;

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <h2>🌱 Organic Growth Analytics</h2>
      
      {summary ? (
        <div className="metrics-grid">
          <div className="glass-panel metric-card">
            <h3>Total Followers</h3>
            <div className="metric-value">{summary.totalFollowers.toLocaleString()}</div>
            <div className="metric-pop" style={{ color: "#4caf50" }}>{summary.pop.followers}</div>
          </div>
          <div className="glass-panel metric-card">
            <h3>Engagement Rate</h3>
            <div className="metric-value">{summary.engagementRate}%</div>
            <div className="metric-pop" style={{ color: "#4caf50" }}>{summary.pop.engagement}</div>
          </div>
          <div className="glass-panel metric-card">
            <h3>Organic Reach</h3>
            <div className="metric-value">{summary.totalReach.toLocaleString()}</div>
            <div className="metric-pop" style={{ color: "#4caf50" }}>{summary.pop.reach}</div>
          </div>
          <div className="glass-panel metric-card">
            <h3>Total Posts Tracked</h3>
            <div className="metric-value">{summary.totalPosts.toLocaleString()}</div>
          </div>
        </div>
      ) : (
        <p>No organic summary data available.</p>
      )}

      <div className="glass-panel chart-container-placeholder" style={{ minHeight: "300px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p>Detailed performance graphs will appear here once D3/Chart.js integration is complete.</p>
      </div>
    </div>
  );
}
