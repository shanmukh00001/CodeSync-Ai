import { useMemo } from "react";
import "./ActivityHeatmap.css";

/**
 * Deterministic mapping of daily submission count to visual intensity level (0-4).
 * 0: 0 submissions (inactive)
 * 1: 1 submission (low)
 * 2: 2-3 submissions (medium)
 * 3: 4-6 submissions (high)
 * 4: 7+ submissions (very high)
 */
function getIntensityLevel(count) {
  if (!count || count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

/**
 * Converts UTC YYYY-MM-DD string into a human-readable date label.
 * Example: "2026-09-14" -> "Sep 14, 2026"
 */
function formatUtcCalendarDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  return dateObj.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ActivityHeatmap({ activity, loading }) {
  const currentStreak = activity?.currentStreak ?? 0;
  const longestStreak = activity?.longestStreak ?? 0;
  const activityByDay = useMemo(() => activity?.activityByDay || [], [activity]);

  // Construct an 84-day (12 weeks) calendar window anchored to current UTC day
  const { weeks, totalWindowSubmissions, hasActivity } = useMemo(() => {
    const submissionMap = new Map();
    for (const item of activityByDay) {
      if (item && item.date) {
        submissionMap.set(item.date, item.submissions || 0);
      }
    }

    const now = new Date();
    const todayUtcTimestamp = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate()
    );

    const DAYS_TO_SHOW = 84; // exactly 12 weeks
    const days = [];
    let sumSubmissions = 0;

    for (let i = DAYS_TO_SHOW - 1; i >= 0; i--) {
      const d = new Date(todayUtcTimestamp - i * 86400000);
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      const dateKey = `${year}-${month}-${day}`;

      const count = submissionMap.get(dateKey) || 0;
      sumSubmissions += count;

      days.push({
        date: dateKey,
        count,
        intensity: getIntensityLevel(count),
        formattedDate: formatUtcCalendarDate(dateKey),
      });
    }

    // Chunk into 12 columns of 7 days
    const weekChunks = [];
    for (let i = 0; i < days.length; i += 7) {
      weekChunks.push(days.slice(i, i + 7));
    }

    return {
      weeks: weekChunks,
      totalWindowSubmissions: sumSubmissions,
      hasActivity: activityByDay.length > 0,
    };
  }, [activityByDay]);

  // Weekday abbreviation indicators for the 7 rows
  const weekdayLabels = ["", "Mon", "", "Wed", "", "Fri", ""];

  return (
    <div className="activity-heatmap-container">
      {/* Streak Summary Metrics */}
      <div className="activity-heatmap-metrics">
        <div className="metric-tile metric-tile-accent">
          <span className="metric-tile-label">CURRENT STREAK</span>
          <div className="metric-tile-value">
            {loading ? "…" : `${currentStreak} ${currentStreak === 1 ? "day" : "days"}`}
          </div>
          <span className="metric-tile-sub">Consecutive active days</span>
        </div>

        <div className="metric-tile">
          <span className="metric-tile-label">LONGEST STREAK</span>
          <div className="metric-tile-value">
            {loading ? "…" : `${longestStreak} ${longestStreak === 1 ? "day" : "days"}`}
          </div>
          <span className="metric-tile-sub">Historical best</span>
        </div>
      </div>

      {/* Heatmap Matrix */}
      {loading ? (
        <div className="activity-empty-state">Loading activity history…</div>
      ) : !hasActivity ? (
        <div className="activity-empty-state">
          No submission activity recorded yet. Submit solutions in rooms or solo challenges to build your streak.
        </div>
      ) : (
        <div className="activity-grid-wrapper" tabIndex={0} aria-label="Activity heatmap over the last 12 weeks">
          <div className="activity-grid-calendar">
            <div className="activity-grid-with-labels">
              {/* Day of week labels */}
              <div className="activity-weekday-labels" aria-hidden="true">
                {weekdayLabels.map((lbl, idx) => (
                  <span key={idx} className="activity-weekday-label">
                    {lbl}
                  </span>
                ))}
              </div>

              {/* 12-Week Grid Columns */}
              <div className="activity-grid-weeks">
                {weeks.map((week, wIdx) => (
                  <div key={wIdx} className="activity-grid-week">
                    {week.map((day) => {
                      const submissionText =
                        day.count === 1 ? "1 submission" : `${day.count} submissions`;
                      const label = `${day.formattedDate}: ${submissionText}`;

                      return (
                        <button
                          key={day.date}
                          type="button"
                          className={`activity-day-cell intensity-${day.intensity}`}
                          title={label}
                          aria-label={label}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Footer with window details and accessible intensity legend */}
            <div className="activity-heatmap-footer">
              <span className="activity-window-label">
                Last 12 weeks ({totalWindowSubmissions} {totalWindowSubmissions === 1 ? "submission" : "submissions"})
              </span>

              <div className="activity-legend" aria-label="Activity legend">
                <span>Less</span>
                <div className="activity-legend-cells" aria-hidden="true">
                  <span className="activity-legend-cell intensity-0" title="0 submissions" />
                  <span className="activity-legend-cell intensity-1" title="1 submission" />
                  <span className="activity-legend-cell intensity-2" title="2-3 submissions" />
                  <span className="activity-legend-cell intensity-3" title="4-6 submissions" />
                  <span className="activity-legend-cell intensity-4" title="7+ submissions" />
                </div>
                <span>More</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ActivityHeatmap;
