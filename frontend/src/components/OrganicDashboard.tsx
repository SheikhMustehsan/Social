import { useEffect, useState } from "react";
import { API_BASE } from "../config";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface OrganicSummary {
  totalFollowers: number;
  totalPosts: number;
  totalReach: number;
  totalEngagement: number;
  engagementRate: number;
  pop: { followers: string; engagement: string; reach: string; };
}

interface TimeseriesData {
  date: string;
  totalFollowers: number;
  totalPosts: number;
  totalReach: number;
  totalEngagement: number;
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
  const [timeseries, setTimeseries] = useState<TimeseriesData[]>([]);
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
      const [sumRes, jobsRes, timeRes] = await Promise.all([
        fetch(`${API_BASE}/api/analytics/organic/summary`, { headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId } }),
        fetch(`${API_BASE}/api/analytics/sync-jobs`, { headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId } }),
        fetch(`${API_BASE}/api/analytics/organic/timeseries`, { headers: { Authorization: `Bearer ${token}`, "x-company-id": companyId } })
      ]);
      
      if (sumRes.ok) setSummary(await sumRes.json());
      if (jobsRes.ok) setSyncJobs(await jobsRes.json());
      if (timeRes.ok) setTimeseries(await timeRes.json());
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

      <div className="glass-panel" style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3>Growth Over Time</h3>
          <button 
            className="action-btn primary" 
            onClick={() => window.open(`${API_BASE}/api/analytics/organic/csv?companyId=${companyId}&token=${token}`, "_blank")}
            style={{ fontSize: "0.8rem", padding: "5px 15px" }}
          >
            📥 Download CSV
          </button>
        </div>
        
        {timeseries.length > 0 ? (
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={timeseries} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" tick={{fill: 'rgba(255,255,255,0.5)'}} />
                <YAxis yAxisId="left" stroke="rgba(255,255,255,0.5)" tick={{fill: 'rgba(255,255,255,0.5)'}} />
                <YAxis yAxisId="right" orientation="right" stroke="rgba(255,255,255,0.5)" tick={{fill: 'rgba(255,255,255,0.5)'}} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#1e1e2d", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }} 
                  itemStyle={{ color: "#fff" }}
                />
                <Line yAxisId="left" type="monotone" dataKey="totalFollowers" name="Followers" stroke="#6C5CE7" strokeWidth={3} activeDot={{ r: 8 }} />
                <Line yAxisId="right" type="monotone" dataKey="totalPosts" name="Total Posts" stroke="#00CEC9" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div style={{ minHeight: "150px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p>No timeline data available. Try running a sync job.</p>
          </div>
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
