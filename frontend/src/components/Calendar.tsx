import { useState } from "react";
import "./Calendar.css";

interface Post {
  id: string;
  caption: string;
  mediaUrls: string[];
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  errorMessage?: string | null;
  profile: {
    id: string;
    platform: string;
    profileName: string;
  };
}

interface CalendarProps {
  posts: Post[];
  onCancelPost: (postId: string) => void;
  onReschedulePost: (postId: string, scheduledAt: string) => void;
}

// Format a Date into the value shape <input type="date"> / <input type="time"> expect, using local time
function toDateInputValue(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toTimeInputValue(date: Date) {
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${min}`;
}

export default function Calendar({ posts, onCancelPost, onReschedulePost }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");

  const openPostDetails = (post: Post) => {
    setSelectedPost(post);
    if (post.scheduledAt) {
      const d = new Date(post.scheduledAt);
      setEditDate(toDateInputValue(d));
      setEditTime(toTimeInputValue(d));
    } else {
      setEditDate("");
      setEditTime("");
    }
  };

  const closePostDetails = () => setSelectedPost(null);

  const handleSaveReschedule = () => {
    if (!selectedPost || !editDate || !editTime) return;
    const newScheduledAt = new Date(`${editDate}T${editTime}`).toISOString();
    onReschedulePost(selectedPost.id, newScheduledAt);
    closePostDetails();
  };

  const handleDiscard = () => {
    if (!selectedPost) return;
    onCancelPost(selectedPost.id);
    closePostDetails();
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Get the first day of the month (0 = Sunday, 1 = Monday...)
  const firstDayIndex = new Date(year, month, 1).getDay();

  // Get the total number of days in the month
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Generate days array
  const days = [];
  
  // Fill empty spaces for days of previous month
  for (let i = 0; i < firstDayIndex; i++) {
    days.push(null);
  }

  // Fill actual month days
  for (let i = 1; i <= totalDays; i++) {
    days.push(new Date(year, month, i));
  }

  const navigatePrev = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const navigateNext = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Helper to find posts scheduled for a specific calendar day
  const getPostsForDate = (date: Date) => {
    return posts.filter(p => {
      if (!p.scheduledAt) return false;
      const postDate = new Date(p.scheduledAt);
      return (
        postDate.getFullYear() === date.getFullYear() &&
        postDate.getMonth() === date.getMonth() &&
        postDate.getDate() === date.getDate()
      );
    });
  };

  const getPlatformAbbreviation = (platform: string) => {
    switch (platform) {
      case "facebook": return "FB";
      case "instagram": return "IG";
      case "linkedin": return "LN";
      case "tiktok": return "TT";
      default: return "SP";
    }
  };

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case "facebook": return "#1877f2";
      case "instagram": return "#e1306c";
      case "linkedin": return "#0a66c2";
      case "tiktok": return "#ff0050";
      default: return "var(--color-primary)";
    }
  };

  return (
    <div className="calendar-widget glass-panel">
      {/* Calendar Header */}
      <div className="calendar-header">
        <h3>📅 Publication Schedule</h3>
        <div className="calendar-navigation">
          <button className="glass-button nav-btn" onClick={navigatePrev}>◀</button>
          <span className="current-month-year">{monthNames[month]} {year}</span>
          <button className="glass-button nav-btn" onClick={navigateNext}>▶</button>
        </div>
      </div>

      {/* Weekdays Row */}
      <div className="calendar-weekdays">
        <div>Sun</div>
        <div>Mon</div>
        <div>Tue</div>
        <div>Wed</div>
        <div>Thu</div>
        <div>Fri</div>
        <div>Sat</div>
      </div>

      {/* Days Grid */}
      <div className="calendar-grid">
        {days.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="calendar-day empty"></div>;
          }

          const dayPosts = getPostsForDate(date);
          const isToday = new Date().toDateString() === date.toDateString();

          return (
            <div key={`day-${date.getDate()}`} className={`calendar-day ${isToday ? "today" : ""}`}>
              <span className="day-number">{date.getDate()}</span>
              
              <div className="day-posts-list">
                {dayPosts.map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    className="calendar-post-icon"
                    style={{ backgroundColor: getPlatformColor(post.profile.platform) }}
                    title={`${post.profile.profileName} (${post.profile.platform.toUpperCase()}): "${post.caption || "(No caption)"}" [${post.status}]`}
                    onClick={() => openPostDetails(post)}
                  >
                    {getPlatformAbbreviation(post.profile.platform)}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Post details / reschedule / discard popup */}
      {selectedPost && (
        <div className="modal-overlay" onClick={closePostDetails}>
          <div className="glass-panel modal-card animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <h3>
              <span
                className="platform-dot"
                style={{ backgroundColor: getPlatformColor(selectedPost.profile.platform) }}
              >
                {getPlatformAbbreviation(selectedPost.profile.platform)}
              </span>{" "}
              {selectedPost.profile.profileName}
            </h3>
            <p style={{ textTransform: "capitalize" }}>Status: {selectedPost.status}</p>
            <p>{selectedPost.caption || "(No caption)"}</p>
            {selectedPost.errorMessage && (
              <p style={{ color: "var(--color-danger)" }}>{selectedPost.errorMessage}</p>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", margin: "16px 0" }}>
              <div className="form-group">
                <label className="glass-label">Date</label>
                <input
                  type="date"
                  className="glass-input"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="glass-label">Time</label>
                <input
                  type="time"
                  className="glass-input"
                  value={editTime}
                  onChange={(e) => setEditTime(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-actions">
              <button className="glass-button" style={{ borderColor: "rgba(239, 68, 68, 0.2)" }} onClick={handleDiscard}>
                Discard Post
              </button>
              <button className="glass-button" onClick={closePostDetails}>
                Close
              </button>
              <button className="glass-button primary" onClick={handleSaveReschedule} disabled={!editDate || !editTime}>
                Save Date/Time
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
