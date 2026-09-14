const User = require("../models/User");
const Submission = require("../models/Submission");

/**
 * Rounds a number to exactly 1 decimal place.
 * Returns numeric float, not string.
 *
 * @param {number} value
 * @returns {number}
 */
function roundToOneDecimal(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.round(value * 10) / 10;
}

/**
 * Checks if a runtimeMs value is a valid numeric measurement.
 * Rule: typeof === "number" AND Number.isFinite() AND >= 0
 *
 * @param {*} runtimeMs
 * @returns {boolean}
 */
function isValidRuntime(runtimeMs) {
  return typeof runtimeMs === "number" && Number.isFinite(runtimeMs) && runtimeMs >= 0;
}

/**
 * Checks if a memoryKb value is a valid numeric measurement.
 * Rule: typeof === "number" AND Number.isFinite() AND > 0
 *
 * @param {*} memoryKb
 * @returns {boolean}
 */
function isValidMemory(memoryKb) {
  return typeof memoryKb === "number" && Number.isFinite(memoryKb) && memoryKb > 0;
}

/**
 * Converts a Date / timestamp to a UTC YYYY-MM-DD string.
 *
 * @param {Date|string|number} dateInput
 * @returns {string|null}
 */
function toUtcDateString(dateInput) {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return null;

  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Decrements a UTC YYYY-MM-DD date string by exactly one day.
 *
 * @param {string} yyyyMmDd
 * @returns {string}
 */
function stepPreviousUtcDay(yyyyMmDd) {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  dateObj.setUTCDate(dateObj.getUTCDate() - 1);
  const prevYear = dateObj.getUTCFullYear();
  const prevMonth = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
  const prevDay = String(dateObj.getUTCDate()).padStart(2, "0");
  return `${prevYear}-${prevMonth}-${prevDay}`;
}

/**
 * Computes currentStreak and longestStreak from an array of unique active UTC dates.
 *
 * @param {string[]} uniqueSortedDates - Chronologically sorted array of YYYY-MM-DD strings.
 * @param {string} todayUtc - Current UTC date in YYYY-MM-DD format.
 * @returns {{ currentStreak: number, longestStreak: number }}
 */
function calculateStreaks(uniqueSortedDates, todayUtc) {
  if (!uniqueSortedDates || uniqueSortedDates.length === 0) {
    return { currentStreak: 0, longestStreak: 0 };
  }

  const activeSet = new Set(uniqueSortedDates);
  const yesterdayUtc = stepPreviousUtcDay(todayUtc);

  // 1. Current Streak Calculation
  let currentStreak = 0;
  let anchor = null;

  if (activeSet.has(todayUtc)) {
    anchor = todayUtc;
  } else if (activeSet.has(yesterdayUtc)) {
    anchor = yesterdayUtc;
  }

  if (anchor) {
    let curr = anchor;
    while (activeSet.has(curr)) {
      currentStreak++;
      curr = stepPreviousUtcDay(curr);
    }
  }

  // 2. Longest Streak Calculation
  let longestStreak = 1;
  let tempStreak = 1;

  for (let i = 1; i < uniqueSortedDates.length; i++) {
    const prevParts = uniqueSortedDates[i - 1].split("-").map(Number);
    const currParts = uniqueSortedDates[i].split("-").map(Number);

    const prevDate = new Date(Date.UTC(prevParts[0], prevParts[1] - 1, prevParts[2]));
    const currDate = new Date(Date.UTC(currParts[0], currParts[1] - 1, currParts[2]));

    const diffDays = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      tempStreak++;
      if (tempStreak > longestStreak) {
        longestStreak = tempStreak;
      }
    } else if (diffDays > 1) {
      tempStreak = 1;
    }
  }

  return {
    currentStreak,
    longestStreak,
  };
}

/**
 * Derives personal developer analytics for the given authenticated user.
 *
 * @param {string|mongoose.Types.ObjectId} userId - Verified user identifier.
 * @param {Date} [referenceDate] - Optional override date for deterministic testing.
 * @returns {Promise<Object>} Formatted personal analytics object matching Stage 8.1 contract.
 */
async function getUserAnalytics(userId, referenceDate = new Date()) {
  if (!userId) {
    throw new Error("userId is required to generate personal analytics.");
  }

  // 1. Query User for Solved Problems with lean projection & population
  const user = await User.findById(userId)
    .select("solvedProblems")
    .populate("solvedProblems.problem", "title difficulty tags")
    .lean();

  if (!user) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  // 2. Process Solved Problems & Topics Breakdown
  const seenProblemIds = new Set();
  const solved = {
    totalSolved: 0,
    easy: 0,
    medium: 0,
    hard: 0,
  };

  const tagCountMap = new Map();

  if (Array.isArray(user.solvedProblems)) {
    for (const item of user.solvedProblems) {
      const problem = item.problem;
      if (!problem || !problem._id) {
        // Skip orphaned or deleted problem references
        continue;
      }

      const problemIdStr = String(problem._id);
      if (seenProblemIds.has(problemIdStr)) {
        // Skip duplicate solved problem records
        continue;
      }
      seenProblemIds.add(problemIdStr);

      solved.totalSolved++;

      if (problem.difficulty === "Easy") {
        solved.easy++;
      } else if (problem.difficulty === "Medium") {
        solved.medium++;
      } else if (problem.difficulty === "Hard") {
        solved.hard++;
      }

      // Aggregate tags for this unique solved problem
      if (Array.isArray(problem.tags)) {
        const problemTagSet = new Set();
        for (const tag of problem.tags) {
          if (typeof tag === "string") {
            const trimmed = tag.trim();
            if (trimmed.length > 0) {
              problemTagSet.add(trimmed);
            }
          }
        }

        for (const cleanTag of problemTagSet) {
          tagCountMap.set(cleanTag, (tagCountMap.get(cleanTag) || 0) + 1);
        }
      }
    }
  }

  // Sort topics: 1. solvedCount descending, 2. tag alphabetical ascending
  const topics = Array.from(tagCountMap.entries())
    .map(([tag, solvedCount]) => ({ tag, solvedCount }))
    .sort((a, b) => {
      if (b.solvedCount !== a.solvedCount) {
        return b.solvedCount - a.solvedCount;
      }
      return a.tag.localeCompare(b.tag);
    });

  // 3. Query User Submissions with lean projection
  // Privacy guarantee: code, testResults, failedTestCase, input/output are excluded.
  const submissions = await Submission.find({ user: userId })
    .select("status runtimeMs memoryKb room createdAt")
    .sort({ createdAt: 1 })
    .lean();

  const totalSubmissions = submissions.length;
  let acceptedCount = 0;
  let wrongAnswerCount = 0;
  let timeLimitExceededCount = 0;
  let runtimeErrorCount = 0;
  let compilationErrorCount = 0;
  let soloSubmissionsCount = 0;
  let roomSubmissionsCount = 0;

  const validRuntimes = [];
  const validMemories = [];
  let fastestAcceptedRuntimeMs = null;

  const activityByDayMap = new Map();

  for (const sub of submissions) {
    // 3.1 Status & Mode Counters
    if (sub.status === "Accepted") {
      acceptedCount++;
    } else if (sub.status === "Wrong Answer") {
      wrongAnswerCount++;
    } else if (sub.status === "Time Limit Exceeded") {
      timeLimitExceededCount++;
    } else if (sub.status === "Runtime Error") {
      runtimeErrorCount++;
    } else if (sub.status === "Compilation Error") {
      compilationErrorCount++;
    }

    if (sub.room === null || sub.room === undefined) {
      soloSubmissionsCount++;
    } else {
      roomSubmissionsCount++;
    }

    // 3.2 Performance Metrics
    if (isValidRuntime(sub.runtimeMs)) {
      validRuntimes.push(sub.runtimeMs);

      if (sub.status === "Accepted" && sub.runtimeMs > 0) {
        if (
          fastestAcceptedRuntimeMs === null ||
          sub.runtimeMs < fastestAcceptedRuntimeMs
        ) {
          fastestAcceptedRuntimeMs = sub.runtimeMs;
        }
      }
    }

    if (isValidMemory(sub.memoryKb)) {
      validMemories.push(sub.memoryKb);
    }

    // 3.3 Activity Aggregation
    const utcDate = toUtcDateString(sub.createdAt);
    if (utcDate) {
      activityByDayMap.set(utcDate, (activityByDayMap.get(utcDate) || 0) + 1);
    }
  }

  // 4. Compute Acceptance Rate
  const acceptanceRate =
    totalSubmissions === 0
      ? 0.0
      : roundToOneDecimal((acceptedCount / totalSubmissions) * 100);

  // 5. Compute Performance Averages
  let averageRuntimeMs = null;
  if (validRuntimes.length > 0) {
    const sumRuntime = validRuntimes.reduce((acc, val) => acc + val, 0);
    averageRuntimeMs = roundToOneDecimal(sumRuntime / validRuntimes.length);
  }

  let averageMemoryKb = null;
  if (validMemories.length > 0) {
    const sumMemory = validMemories.reduce((acc, val) => acc + val, 0);
    averageMemoryKb = roundToOneDecimal(sumMemory / validMemories.length);
  }

  // 6. Compute Activity by Day Array & Streaks
  const activityByDay = Array.from(activityByDayMap.entries())
    .map(([date, count]) => ({ date, submissions: count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const sortedUniqueDates = activityByDay.map((item) => item.date);
  const todayUtc = toUtcDateString(referenceDate);

  const { currentStreak, longestStreak } = calculateStreaks(
    sortedUniqueDates,
    todayUtc
  );

  // 7. Assemble and return full contract object
  return {
    userId: String(userId),
    generatedAt: referenceDate.toISOString(),
    solved,
    submissions: {
      total: totalSubmissions,
      accepted: acceptedCount,
      wrongAnswer: wrongAnswerCount,
      timeLimitExceeded: timeLimitExceededCount,
      runtimeError: runtimeErrorCount,
      compilationError: compilationErrorCount,
      soloSubmissions: soloSubmissionsCount,
      roomSubmissions: roomSubmissionsCount,
      acceptanceRate,
    },
    activity: {
      currentStreak,
      longestStreak,
      activityByDay,
    },
    performance: {
      averageRuntimeMs,
      fastestAcceptedRuntimeMs,
      averageMemoryKb,
    },
    topics,
  };
}

module.exports = {
  getUserAnalytics,
  roundToOneDecimal,
  isValidRuntime,
  isValidMemory,
  toUtcDateString,
  stepPreviousUtcDay,
  calculateStreaks,
};
