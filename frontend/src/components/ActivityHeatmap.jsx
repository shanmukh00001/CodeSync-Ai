import { useMemo, useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
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

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function ActivityHeatmap({ activity, loading, showMetrics = false }) {
  const { user } = useContext(AuthContext);
  const currentStreak = activity?.currentStreak ?? 0;
  const longestStreak = activity?.longestStreak ?? 0;
  const activityByDay = useMemo(() => activity?.activityByDay || [], [activity]);
  const [hoveredDay, setHoveredDay] = useState(null);

  const currentYear = new Date().getUTCFullYear();

  // Determine available years STRICTLY from user account creation year to current year
  const availableYears = useMemo(() => {
    const createdYear = user?.createdAt
      ? new Date(user.createdAt).getUTCFullYear()
      : currentYear;

    const activityYears = activityByDay
      .map((item) => (item?.date ? parseInt(item.date.slice(0, 4), 10) : null))
      .filter(Boolean);

    // Only start from user creation year (or earliest submission if before)
    const minYear = Math.min(createdYear, ...activityYears, currentYear);
    const years = [];
    for (let y = minYear; y <= currentYear; y++) {
      years.push(y);
    }
    return years.sort((a, b) => b - a); // newest first: [2026, 2025...]
  }, [user?.createdAt, activityByDay, currentYear]);

  const [selectedYear, setSelectedYear] = useState(() => currentYear);

  // Build a Map of all submissions for fast O(1) lookup
  const submissionMap = useMemo(() => {
    const map = new Map();
    for (const item of activityByDay) {
      if (item && item.date) {
        map.set(item.date, item.submissions || 0);
      }
    }
    return map;
  }, [activityByDay]);

  // Construct separated 12-month calendar blocks for the selected year
  const { monthsData, yearTotalSubmissions, yearActiveDays } = useMemo(() => {
    let yearTotal = 0;
    let yearActive = 0;
    const months = [];

    const now = new Date();
    const isCurrentYear = selectedYear === currentYear;
    const currentMonthIdx = now.getUTCMonth();
    const currentDayOfMonth = now.getUTCDate();

    for (let m = 0; m < 12; m++) {
      const daysInMonth = new Date(Date.UTC(selectedYear, m + 1, 0)).getUTCDate();
      const firstDayOfWeek = new Date(Date.UTC(selectedYear, m, 1)).getUTCDay(); // 0 = Sun, 1 = Mon ...

      const monthDays = [];
      let monthTotal = 0;
      let monthActiveCount = 0;

      // 1. Leading empty offset padding so Day 1 aligns with correct weekday
      for (let pad = 0; pad < firstDayOfWeek; pad++) {
        monthDays.push({
          isEmpty: true,
          key: `pad-start-${selectedYear}-${m}-${pad}`,
        });
      }

      // 2. Populate actual days of this month
      for (let day = 1; day <= daysInMonth; day++) {
        const monthStr = String(m + 1).padStart(2, "0");
        const dayStr = String(day).padStart(2, "0");
        const dateKey = `${selectedYear}-${monthStr}-${dayStr}`;

        const isFutureDay = isCurrentYear && (m > currentMonthIdx || (m === currentMonthIdx && day > currentDayOfMonth));
        const count = isFutureDay ? 0 : (submissionMap.get(dateKey) || 0);

        if (!isFutureDay && count > 0) {
          yearActive += 1;
          monthActiveCount += 1;
        }
        monthTotal += count;
        yearTotal += count;

        monthDays.push({
          isEmpty: false,
          date: dateKey,
          dayNumber: day,
          count,
          isFuture: isFutureDay,
          intensity: isFutureDay ? 0 : getIntensityLevel(count),
          formattedDate: formatUtcCalendarDate(dateKey),
          key: dateKey,
        });
      }

      // 3. Trailing empty padding to complete full 7-day columns
      const remainder = monthDays.length % 7;
      if (remainder !== 0) {
        const needed = 7 - remainder;
        for (let pad = 0; pad < needed; pad++) {
          monthDays.push({
            isEmpty: true,
            key: `pad-end-${selectedYear}-${m}-${pad}`,
          });
        }
      }

      // 4. Chunk into weekly columns (each column has 7 days from Sun to Sat)
      const weekColumns = [];
      for (let i = 0; i < monthDays.length; i += 7) {
        weekColumns.push(monthDays.slice(i, i + 7));
      }

      months.push({
        monthIndex: m,
        name: MONTH_NAMES[m],
        totalSubmissions: monthTotal,
        activeDays: monthActiveCount,
        isCurrentMonth: isCurrentYear && m === currentMonthIdx,
        weekColumns,
      });
    }

    return {
      monthsData: months,
      yearTotalSubmissions: yearTotal,
      yearActiveDays: yearActive,
    };
  }, [selectedYear, submissionMap, currentYear]);

  return (
    <div className="activity-heatmap-container">
      {/* Optional Top Metrics Row */}
      {showMetrics && (
        <div className="activity-heatmap-metrics">
          <div className="metric-tile metric-tile-accent" title="Current consecutive days with at least 1 submission">
            <div className="metric-tile-header">
              <span className="metric-tile-label">CURRENT STREAK</span>
              <span className="metric-badge-icon">🔥</span>
            </div>
            <div className="metric-tile-value">
              {loading ? "…" : `${currentStreak} ${currentStreak === 1 ? "day" : "days"}`}
            </div>
            <span className="metric-tile-sub">Active daily streak</span>
          </div>

          <div className="metric-tile" title="Longest continuous submission streak in your history">
            <div className="metric-tile-header">
              <span className="metric-tile-label">LONGEST STREAK</span>
              <span className="metric-badge-icon">🏆</span>
            </div>
            <div className="metric-tile-value">
              {loading ? "…" : `${longestStreak} ${longestStreak === 1 ? "day" : "days"}`}
            </div>
            <span className="metric-tile-sub">Historical best</span>
          </div>

          <div className="metric-tile" title={`Total solves in ${selectedYear}`}>
            <div className="metric-tile-header">
              <span className="metric-tile-label">{selectedYear} SOLVES</span>
              <span className="metric-badge-icon">📊</span>
            </div>
            <div className="metric-tile-value">
              {loading ? "…" : yearTotalSubmissions}
            </div>
            <span className="metric-tile-sub">{yearActiveDays} active days in {selectedYear}</span>
          </div>
        </div>
      )}

      {/* Heatmap Control Toolbar: Year Dropdown Selector */}
      <div className="activity-heatmap-toolbar">
        <div className="activity-year-dropdown-group">
          <label htmlFor="heatmap-year-select" className="activity-year-label">YEAR:</label>
          <div className="activity-select-wrapper">
            <select
              id="heatmap-year-select"
              className="activity-year-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              aria-label="Select heatmap year"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="activity-year-stats-badge">
          <span className="activity-year-count-badge">
            <strong>{yearTotalSubmissions}</strong> {yearTotalSubmissions === 1 ? "submission" : "submissions"} in {selectedYear}
          </span>
        </div>
      </div>

      {/* Heatmap Matrix with High-Contrast Separated Month Blocks */}
      {loading ? (
        <div className="activity-empty-state">
          <span className="activity-loading-spinner" />
          Loading activity calendar…
        </div>
      ) : (
        <div className="activity-grid-wrapper" tabIndex={0} aria-label={`Activity calendar for year ${selectedYear}`}>
          <div className="activity-grid-layout">
            
            {/* Weekday Row Header Indicators (Mon, Wed, Fri) */}
            <div className="activity-weekday-column" aria-hidden="true">
              <span className="activity-weekday-row-label"></span>
              <span className="activity-weekday-row-label">Mon</span>
              <span className="activity-weekday-row-label"></span>
              <span className="activity-weekday-row-label">Wed</span>
              <span className="activity-weekday-row-label"></span>
              <span className="activity-weekday-row-label">Fri</span>
              <span className="activity-weekday-row-label"></span>
            </div>

            {/* Separated 12 Distinct Month Cards */}
            <div className="activity-months-row">
              {monthsData.map((month) => (
                <div
                  key={month.monthIndex}
                  className={`activity-month-block ${month.totalSubmissions > 0 ? "has-activity" : ""} ${
                    month.isCurrentMonth ? "is-current-month" : ""
                  }`}
                >
                  {/* Month Card Header */}
                  <div className="activity-month-header">
                    <span className="activity-month-name">{month.name}</span>
                    {month.totalSubmissions > 0 ? (
                      <span className="activity-month-count active" title={`${month.totalSubmissions} submissions in ${month.name}`}>
                        {month.totalSubmissions}
                      </span>
                    ) : (
                      <span className="activity-month-count zero">0</span>
                    )}
                  </div>

                  {/* Month's Week Columns */}
                  <div className="activity-month-weeks">
                    {month.weekColumns.map((col, colIdx) => (
                      <div key={colIdx} className="activity-month-week-col">
                        {col.map((cell) => {
                          if (cell.isEmpty) {
                            return (
                              <div
                                key={cell.key}
                                className="activity-day-cell is-empty-pad"
                                aria-hidden="true"
                              />
                            );
                          }

                          const label = cell.isFuture
                            ? `${cell.formattedDate}: Future date`
                            : `${cell.formattedDate}: ${cell.count} ${cell.count === 1 ? "submission" : "submissions"}`;

                          return (
                            <button
                              key={cell.key}
                              type="button"
                              disabled={cell.isFuture}
                              className={`activity-day-cell intensity-${cell.intensity} ${
                                cell.isFuture ? "is-future" : ""
                              } ${hoveredDay?.date === cell.date ? "is-hovered" : ""}`}
                              title={label}
                              aria-label={label}
                              onMouseEnter={() => !cell.isFuture && setHoveredDay(cell)}
                              onMouseLeave={() => setHoveredDay(null)}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer with hovered date preview and intensity legend */}
          <div className="activity-heatmap-footer">
            <div className="activity-window-label">
              {hoveredDay ? (
                <span className="activity-hover-preview">
                  <strong>{hoveredDay.formattedDate}</strong>: {hoveredDay.count} {hoveredDay.count === 1 ? "submission" : "submissions"}
                </span>
              ) : (
                <span>
                  Showing <strong>{selectedYear}</strong> cadence • {yearActiveDays} active coding days
                </span>
              )}
            </div>

            <div className="activity-legend" aria-label="Activity intensity scale">
              <span className="activity-legend-text">Less</span>
              <div className="activity-legend-cells" aria-hidden="true">
                <span className="activity-legend-cell intensity-0" title="0 submissions" />
                <span className="activity-legend-cell intensity-1" title="1 submission" />
                <span className="activity-legend-cell intensity-2" title="2-3 submissions" />
                <span className="activity-legend-cell intensity-3" title="4-6 submissions" />
                <span className="activity-legend-cell intensity-4" title="7+ submissions" />
              </div>
              <span className="activity-legend-text">More</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ActivityHeatmap;
