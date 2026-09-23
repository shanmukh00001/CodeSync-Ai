const mongoose = require("mongoose");
const User = require("../models/User");
const Problem = require("../models/Problem");
const Submission = require("../models/Submission");
const { getAIProvider } = require("./ai/aiProviderFactory");

const MAX_RECOMMENDATIONS = 3;
const MAX_CANDIDATES = 8;
const ALLOWED_MATCH_TYPES = [
  "Getting Started",
  "Skill Progression",
  "Topic Reinforcement",
  "New Topic Exploration",
  "Challenge",
  "General Practice",
];

/**
 * Validates and normalizes candidate recommendation output from AI provider.
 * Enforces that AI cannot invent arbitrary problem IDs and adheres strictly to schema limits.
 *
 * @param {Object} rawOutput - Provider output
 * @param {Array<Object>} candidates - Authoritative candidate problems
 * @returns {Array<Object>} Validated and normalized decorated recommendations
 */
function validateDecoratedOutput(rawOutput, candidates) {
  if (!rawOutput || typeof rawOutput !== "object") {
    throw new Error("AI recommendations output must be a non-null object");
  }

  const recList = Array.isArray(rawOutput.recommendations)
    ? rawOutput.recommendations
    : [];

  if (recList.length === 0) {
    throw new Error("AI recommendations output contains empty recommendations array");
  }

  const candidateMap = new Map();
  for (const c of candidates) {
    candidateMap.set(String(c._id || c.id), c);
  }

  const validated = [];
  const seenIds = new Set();

  for (const item of recList) {
    if (!item || typeof item !== "object") continue;

    const rawId = String(item.problemId || item.id || "");
    if (!rawId || !candidateMap.has(rawId) || seenIds.has(rawId)) {
      // Reject arbitrary invented IDs or duplicates
      continue;
    }

    seenIds.add(rawId);
    const matchedProblem = candidateMap.get(rawId);

    const reason =
      typeof item.reason === "string" && item.reason.trim()
        ? item.reason.trim().slice(0, 300)
        : null;

    const focus =
      typeof item.focus === "string" && item.focus.trim()
        ? item.focus.trim().slice(0, 200)
        : null;

    const nextStep =
      typeof item.nextStep === "string" && item.nextStep.trim()
        ? item.nextStep.trim().slice(0, 200)
        : null;

    const matchType =
      typeof item.matchType === "string" &&
      ALLOWED_MATCH_TYPES.includes(item.matchType.trim())
        ? item.matchType.trim()
        : matchedProblem.defaultMatchType || "Skill Progression";

    if (!reason) {
      // Must have at least a valid reason
      continue;
    }

    validated.push({
      problem: {
        id: String(matchedProblem._id || matchedProblem.id),
        title: matchedProblem.title,
        slug: matchedProblem.slug,
        difficulty: matchedProblem.difficulty,
        tags: Array.isArray(matchedProblem.tags) ? matchedProblem.tags : [],
      },
      reason,
      focus: focus || `Mastering ${matchedProblem.tags?.[0] || matchedProblem.difficulty} patterns`,
      nextStep: nextStep || "Analyze the problem constraints and draft your algorithmic approach.",
      matchType,
    });

    if (validated.length >= MAX_RECOMMENDATIONS) {
      break;
    }
  }

  if (validated.length === 0) {
    throw new Error("No recommendations in AI output passed schema & candidate ID validation");
  }

  return validated;
}

/**
 * Builds deterministic fallback recommendations without AI decoration.
 *
 * @param {Array<Object>} candidates - Ranked candidate problems
 * @returns {Array<Object>}
 */
function buildDeterministicRecommendations(candidates) {
  const selected = candidates.slice(0, MAX_RECOMMENDATIONS);

  return selected.map((p) => {
    const primaryTag = p.tags && p.tags.length > 0 ? p.tags[0] : "algorithmic problem solving";
    let defaultReason = `Strengthen your problem-solving abilities in ${primaryTag} at the ${p.difficulty} level.`;
    let defaultFocus = `Practice ${primaryTag} patterns and time-space complexity optimization.`;
    let defaultNextStep = "Read the problem description and identify key invariants.";
    let matchType = p.defaultMatchType || "Skill Progression";

    if (p.defaultMatchType === "Getting Started") {
      defaultReason = `Foundational ${p.difficulty} challenge to get started with ${primaryTag}.`;
      defaultFocus = "Understanding problem constraints, input parsing, and basic structures.";
      defaultNextStep = "Write a basic implementation satisfying the example cases.";
    } else if (p.defaultMatchType === "Topic Reinforcement") {
      defaultReason = `Reinforces ${primaryTag} techniques based on your recent practice.`;
      defaultFocus = `Mastering edge-cases and optimal asymptotic bounds in ${primaryTag}.`;
      defaultNextStep = "Draft an optimal approach before writing the final implementation.";
    } else if (p.defaultMatchType === "New Topic Exploration") {
      defaultReason = `Broaden your toolkit by exploring ${primaryTag}.`;
      defaultFocus = `Learning standard paradigms and state transitions in ${primaryTag}.`;
      defaultNextStep = "Walk through the example test cases on paper first.";
    }

    return {
      problem: {
        id: String(p._id || p.id),
        title: p.title,
        slug: p.slug,
        difficulty: p.difficulty,
        tags: Array.isArray(p.tags) ? p.tags : [],
      },
      reason: defaultReason,
      focus: defaultFocus,
      nextStep: defaultNextStep,
      matchType,
    };
  });
}

/**
 * Deterministic Candidate Engine
 *
 * Evaluates user solved history, submission results, difficulty distribution, and topic patterns
 * to select up to MAX_CANDIDATES relevant unsolved problems.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<{ profileSummary: Object, candidateProblems: Array<Object>, allSolved: boolean }>}
 */
async function generateCandidates(userId) {
  if (!userId) {
    throw new Error("userId is required for recommendation candidate generation");
  }

  // 1. Fetch user solved problems
  const user = await User.findById(userId)
    .select("solvedProblems")
    .populate("solvedProblems.problem", "_id title slug difficulty tags")
    .lean();

  if (!user) {
    const err = new Error("User not found");
    err.statusCode = 404;
    err.code = "USER_NOT_FOUND";
    throw err;
  }

  const solvedIds = new Set();
  const solvedDifficultyCounts = { Easy: 0, Medium: 0, Hard: 0 };
  const solvedTagCounts = new Map();

  if (Array.isArray(user.solvedProblems)) {
    for (const item of user.solvedProblems) {
      const p = item.problem;
      if (!p || !p._id) continue;
      const idStr = String(p._id);
      if (solvedIds.has(idStr)) continue;
      solvedIds.add(idStr);

      if (p.difficulty === "Easy") solvedDifficultyCounts.Easy++;
      else if (p.difficulty === "Medium") solvedDifficultyCounts.Medium++;
      else if (p.difficulty === "Hard") solvedDifficultyCounts.Hard++;

      if (Array.isArray(p.tags)) {
        for (const t of p.tags) {
          if (typeof t === "string" && t.trim()) {
            const clean = t.trim();
            solvedTagCounts.set(clean, (solvedTagCounts.get(clean) || 0) + 1);
          }
        }
      }
    }
  }

  const totalSolved = solvedIds.size;

  // 2. Fetch user's recent submissions for topic / difficulty signal (lean projection, no code/fixtures)
  const recentSubmissions = await Submission.find({ user: userId })
    .select("status problem createdAt")
    .populate("problem", "_id difficulty tags")
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  const recentAttemptedTags = new Map();
  const recentStruggledTags = new Map();

  for (const sub of recentSubmissions) {
    const p = sub.problem;
    if (!p || !p._id) continue;
    if (Array.isArray(p.tags)) {
      for (const t of p.tags) {
        if (typeof t === "string" && t.trim()) {
          const clean = t.trim();
          recentAttemptedTags.set(clean, (recentAttemptedTags.get(clean) || 0) + 1);
          if (sub.status !== "Accepted") {
            recentStruggledTags.set(clean, (recentStruggledTags.get(clean) || 0) + 1);
          }
        }
      }
    }
  }

  // 3. Query all unsolved problems from MongoDB
  // Exclude hidden test cases and internal execution configs
  const unsolvedProblems = await Problem.find({
    _id: { $nin: Array.from(solvedIds).map((id) => new mongoose.Types.ObjectId(id)) },
  })
    .select("_id title slug difficulty tags description constraints examples")
    .lean();

  if (unsolvedProblems.length === 0) {
    return {
      profileSummary: {
        totalSolved,
        primaryDifficulty: totalSolved === 0 ? "Easy" : solvedDifficultyCounts.Hard > 0 ? "Hard" : solvedDifficultyCounts.Medium > 0 ? "Medium" : "Easy",
        topTopics: Array.from(solvedTagCounts.keys()).slice(0, 3),
        focusArea: "All problems solved",
      },
      candidateProblems: [],
      allSolved: true,
    };
  }

  // 4. Determine User Progression Profile & Target Difficulty
  let targetDifficulty = "Easy";
  let defaultProfileMatchType = "Getting Started";

  if (totalSolved === 0) {
    targetDifficulty = "Easy";
    defaultProfileMatchType = "Getting Started";
  } else if (solvedDifficultyCounts.Easy >= 3 && (solvedDifficultyCounts.Medium < 5 || solvedDifficultyCounts.Hard === 0)) {
    targetDifficulty = "Medium";
    defaultProfileMatchType = "Skill Progression";
  } else if (solvedDifficultyCounts.Medium >= 5) {
    targetDifficulty = "Hard";
    defaultProfileMatchType = "Challenge";
  } else {
    targetDifficulty = "Easy";
    defaultProfileMatchType = "Topic Reinforcement";
  }

  // Identify top solved topics
  const topTopics = Array.from(solvedTagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t)
    .slice(0, 3);

  // Identify focus area (e.g. recent struggled tag, or top topic, or foundational)
  let focusArea = "Foundational Algorithms";
  if (recentStruggledTags.size > 0) {
    focusArea = Array.from(recentStruggledTags.entries()).sort((a, b) => b[1] - a[1])[0][0];
  } else if (topTopics.length > 0) {
    focusArea = topTopics[0];
  }

  // 5. Score and rank unsolved candidate problems deterministically
  const scoredCandidates = unsolvedProblems.map((p) => {
    let score = 0;
    let assignedMatchType = defaultProfileMatchType;
    const pTags = Array.isArray(p.tags) ? p.tags : [];

    // Difficulty score
    if (p.difficulty === targetDifficulty) {
      score += 50;
    } else if (
      (targetDifficulty === "Medium" && p.difficulty === "Easy") ||
      (targetDifficulty === "Hard" && p.difficulty === "Medium")
    ) {
      score += 30;
    } else {
      score += 10;
    }

    // Struggled topic match (high priority for reinforcement)
    let hasStruggledMatch = false;
    for (const t of pTags) {
      if (recentStruggledTags.has(t)) {
        score += 25 * (recentStruggledTags.get(t) || 1);
        hasStruggledMatch = true;
      }
    }
    if (hasStruggledMatch) {
      assignedMatchType = "Topic Reinforcement";
    }

    // Top solved topic match (topic progression)
    let hasTopTopicMatch = false;
    for (const t of pTags) {
      if (solvedTagCounts.has(t)) {
        score += 15 * (solvedTagCounts.get(t) || 1);
        hasTopTopicMatch = true;
      }
    }
    if (!hasStruggledMatch && hasTopTopicMatch && totalSolved > 0) {
      assignedMatchType = "Skill Progression";
    }

    // Unexplored topic (exploration bonus)
    let hasUnexploredTopic = false;
    for (const t of pTags) {
      if (!solvedTagCounts.has(t) && !recentAttemptedTags.has(t)) {
        score += 5;
        hasUnexploredTopic = true;
      }
    }
    if (!hasStruggledMatch && !hasTopTopicMatch && hasUnexploredTopic) {
      assignedMatchType = "New Topic Exploration";
    }

    if (totalSolved === 0) {
      assignedMatchType = "Getting Started";
    }

    return {
      ...p,
      _score: score,
      defaultMatchType: assignedMatchType,
    };
  });

  // Sort candidates deterministically: score desc, title asc
  scoredCandidates.sort((a, b) => {
    if (b._score !== a._score) {
      return b._score - a._score;
    }
    return (a.title || "").localeCompare(b.title || "");
  });

  const topCandidates = scoredCandidates.slice(0, MAX_CANDIDATES);

  return {
    profileSummary: {
      totalSolved,
      primaryDifficulty: targetDifficulty,
      topTopics,
      focusArea,
    },
    candidateProblems: topCandidates,
    allSolved: false,
  };
}

/**
 * Main Recommendation Service Entrypoint
 *
 * Architecture:
 * 1. Generate authoritative candidates deterministically from DB
 * 2. Attempt AI pedagogical decoration (if AIProvider available)
 * 3. Fallback safely to deterministic recommendations on any AI error/unavailability/timeout
 * 4. Return clean, unpersisted, privacy-guaranteed recommendation response
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {Object} [options]
 * @param {Object} [options.provider] - Optional provider override
 * @returns {Promise<Object>}
 */
async function getRecommendations(userId, options = {}) {
  // 1. Generate deterministic candidates
  const { profileSummary, candidateProblems, allSolved } = await generateCandidates(userId);

  if (allSolved || candidateProblems.length === 0) {
    return {
      profileSummary,
      recommendations: [],
      generatedAt: new Date().toISOString(),
    };
  }

  // 2. Prepare sanitized input for AI Provider
  // Privacy boundary: ZERO code, ZERO hidden tests, ZERO email/passwords, ZERO raw DB docs
  const sanitizedProviderInput = {
    profileSummary: {
      totalSolved: profileSummary.totalSolved,
      primaryDifficulty: profileSummary.primaryDifficulty,
      topTopics: profileSummary.topTopics,
      focusArea: profileSummary.focusArea,
    },
    candidateProblems: candidateProblems.map((p) => ({
      id: String(p._id),
      title: p.title,
      slug: p.slug,
      difficulty: p.difficulty,
      tags: Array.isArray(p.tags) ? p.tags : [],
      defaultMatchType: p.defaultMatchType,
    })),
  };

  // 3. Attempt AI decoration
  const provider = options.provider || getAIProvider();

  if (provider && typeof provider.generateRecommendations === "function") {
    try {
      const rawAiOutput = await provider.generateRecommendations(sanitizedProviderInput);
      const decorated = validateDecoratedOutput(rawAiOutput, candidateProblems);

      return {
        profileSummary,
        recommendations: decorated,
        generatedAt: new Date().toISOString(),
      };
    } catch (aiErr) {
      // AI decoration is purely advisory and non-blocking.
      // Log error internally and fallback seamlessly to deterministic recommendations.
      // Do NOT expose failure or fail the endpoint.
    }
  }

  // 4. Deterministic Fallback (Offline / AI unavailable / AI timeout / AI malformed)
  const fallbackRecommendations = buildDeterministicRecommendations(candidateProblems);

  return {
    profileSummary,
    recommendations: fallbackRecommendations,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = {
  getRecommendations,
  generateCandidates,
  validateDecoratedOutput,
  buildDeterministicRecommendations,
  MAX_RECOMMENDATIONS,
  MAX_CANDIDATES,
  ALLOWED_MATCH_TYPES,
};
