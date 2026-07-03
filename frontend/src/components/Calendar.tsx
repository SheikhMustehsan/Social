import React, { useState } from "react";
import "./Calendar.css";

interface Post {
  id: string;
  caption: string;
  mediaUrls: string[];
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  profile: {
    id: string;
    platform: string;
    profileName: string;
  };
}

interface CalendarProps {
  posts: Post[];
  onCancelPost: (postId: string) => void;
}

export default function Calendar({ posts, onCancelPost }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

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
                  <div
                    key={post.id}
                    className="calendar-post-badge"
                    style={{
                      borderLeft: `3px solid ${getPlatformColor(post.profile.platform)}`,
                      background: "rgba(255,255,255,0.03)"
                    }}
                    title={`${post.profile.profileName} (${post.profile.platform.toUpperCase()}): "${post.caption}" [${post.status}]`}
                  >
                    <span
                      className="platform-dot"
                      style={{ backgroundColor: getPlatformColor(post.profile.platform) }}
                    >
                      {getPlatformAbbreviation(post.profile.platform)}
                    </span>
                    <span className="badge-caption">{post.caption || "(No caption)"}</span>
                    
                    {post.status === "scheduled" && (
                      <button
                        className="badge-cancel-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCancelPost(post.id);
                        }}
                        title="Cancel publication"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
