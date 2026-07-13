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

interface SyncJob {
  id: string;
  jobType: string;
  status: string;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface OrganicDashboardProps {
  token: string;
  companyId: string;
}

export default function OrganicDashboard({ token, companyId }: OrganicDashboardProps) {
  const [summary, setSummary] = useState<OrganicSummary | null>(null);
  const [syncJobs, setSyncJobs] = useState<SyncJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token && companyId) {
      fetchAnalytics();
    }
  }, [token, companyId]);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const [sumRes, jobsRes] = await Promise.all([
        fetch(`${API_BASE}/api/analytics/organic/summary`, { headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId } }),
        fetch(`${API_BASE}/api/analytics/sync-jobs`, { headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId } })
      ]);
      
      if (sumRes.ok) setSummary(await sumRes.json());
      if (jobsRes.ok) setSyncJobs(await jobsRes.json());
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

      <div className="glass-panel chart-container-placeholder" style={{ minHeight: "150px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p>Detailed performance graphs will appear here once D3/Chart.js integration is complete.</p>
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
                {syncJobs.filter(j => j.jobType === "scrape_organic_all").map(job => (
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
