import { useEffect, useState } from "react";
import { API_BASE } from "../config";

interface AdsSummary {
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  ctr: number;
  cpc: number;
  pop: { spend: string; impressions: string; ctr: string; cpc: string; };
}

interface CampaignPerformance {
  campaignName: string;
  platform: string;
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
}

interface SyncJob {
  id: string;
  jobType: string;
  status: string;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string | null;
}

interface AdsDashboardProps {
  token: string;
  companyId: string;
}

export default function AdsDashboard({ token, companyId }: AdsDashboardProps) {
  const [summary, setSummary] = useState<AdsSummary | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignPerformance[]>([]);
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
      const [sumRes, campRes, jobsRes] = await Promise.all([
        fetch(`${API_BASE}/api/analytics/ads/summary`, { headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId } }),
        fetch(`${API_BASE}/api/analytics/ads`, { headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId } }),
        fetch(`${API_BASE}/api/analytics/sync-jobs`, { headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId } }),
      ]);
      
      if (sumRes.ok) setSummary(await sumRes.json());
      if (campRes.ok) setCampaigns(await campRes.json());
      if (jobsRes.ok) setSyncJobs(await jobsRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const triggerSync = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/analytics/sync-ads`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId }
      });
      if (res.ok) {
        alert("Ads sync triggered! The job status will appear in the Recent Background Jobs table below shortly.");
        fetchAnalytics();
      } else {
        alert("Error triggering sync.");
      }
    } catch (e) {
      alert("Network error triggering sync");
    }
  };

  if (loading) return <div className="glass-panel">Loading Ads Data...</div>;

  return (
    <div className="animate-fade-in" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>📈 Paid Ads Analytics</h2>
        <button className="glass-button primary" onClick={triggerSync}>🔄 Sync Ads Now</button>
      </div>

      {summary ? (
        <div className="metrics-grid">
          <div className="glass-panel metric-card">
            <h3>Total Spend</h3>
            <div className="metric-value">${summary.totalSpend.toFixed(2)}</div>
            <div className="metric-pop" style={{ color: summary.pop.spend.startsWith("+") ? "#ff6b6b" : "#4caf50" }}>{summary.pop.spend} vs last period</div>
          </div>
          <div className="glass-panel metric-card">
            <h3>Impressions</h3>
            <div className="metric-value">{summary.totalImpressions.toLocaleString()}</div>
            <div className="metric-pop" style={{ color: "#4caf50" }}>{summary.pop.impressions}</div>
          </div>
          <div className="glass-panel metric-card">
            <h3>CTR / CPC</h3>
            <div className="metric-value">{summary.ctr}% / ${summary.cpc}</div>
            <div className="metric-pop">{summary.pop.ctr} / {summary.pop.cpc}</div>
          </div>
          <div className="glass-panel metric-card">
            <h3>Conversions</h3>
            <div className="metric-value">{summary.totalConversions.toLocaleString()}</div>
          </div>
        </div>
      ) : (
        <p>No ads summary data available.</p>
      )}

      <div className="glass-panel">
        <h3>Campaign Breakdown</h3>
        {campaigns.length === 0 ? (
          <p>No campaigns found. Try syncing your ads.</p>
        ) : (
          <table style={{ width: "100%", textAlign: "left", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.2)" }}>
                <th style={{ padding: "10px" }}>Platform</th>
                <th style={{ padding: "10px" }}>Campaign</th>
                <th style={{ padding: "10px" }}>Spend</th>
                <th style={{ padding: "10px" }}>Impressions</th>
                <th style={{ padding: "10px" }}>Clicks</th>
                <th style={{ padding: "10px" }}>Conversions</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                  <td style={{ padding: "10px", textTransform: "capitalize" }}>{c.platform}</td>
                  <td style={{ padding: "10px" }}>{c.campaignName}</td>
                  <td style={{ padding: "10px" }}>${c.totalSpend?.toFixed(2)}</td>
                  <td style={{ padding: "10px" }}>{c.totalImpressions?.toLocaleString()}</td>
                  <td style={{ padding: "10px" }}>{c.totalClicks?.toLocaleString()}</td>
                  <td style={{ padding: "10px" }}>{c.totalConversions?.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
