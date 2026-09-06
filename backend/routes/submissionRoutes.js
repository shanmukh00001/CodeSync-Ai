const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const protect = require("../middleware/authMiddleware");
const Submission = require("../models/Submission");
const Problem = require("../models/Problem");
const Room = require("../models/Room");
const { AppError } = require("../middleware/errorMiddleware");
const { runProblem } = require("../services/problemTestRunnerService");

/**
 * Maps problemTestRunnerService status to the Submission schema status enum.
 */
const STATUS_MAP = {
  accepted: "Accepted",
  wrong_answer: "Wrong Answer",
  time_limit_exceeded: "Time Limit Exceeded",
  runtime_error: "Runtime Error",
  compilation_error: "Compilation Error",
};

/**
 * Validates request payload, problem existence, and optional room membership.
 * 
 * @param {Object} req - Express request
 * @returns {Promise<{ problem: Object, roomDoc: Object | null }>}
 */
async function validateSubmissionRequest(req) {
  const { problemId, language, code, roomId } = req.body;

  if (!problemId) {
    throw new AppError("problemId is required", 400, "VALIDATION_ERROR");
  }

  if (!mongoose.Types.ObjectId.isValid(problemId)) {
    throw new AppError("Invalid problemId format", 400, "VALIDATION_ERROR");
  }

  if (!code || typeof code !== "string" || !code.trim()) {
    throw new Error("Code is required"); // Will become 400
  }

  const allowedLanguages = ["cpp", "javascript", "python", "java"];
  if (!language || typeof language !== "string" || !allowedLanguages.includes(language.toLowerCase())) {
    throw new AppError("Invalid or unsupported language", 400, "VALIDATION_ERROR");
  }

  const problem = await Problem.findById(problemId);
  if (!problem) {
    throw new AppError("Problem not found", 404, "PROBLEM_NOT_FOUND");
  }

  let roomDoc = null;
  if (roomId) {
    if (typeof roomId !== "string" || !roomId.trim()) {
      throw new AppError("Invalid roomId", 400, "VALIDATION_ERROR");
    }

    roomDoc = await Room.findOne({ roomId });
    if (!roomDoc) {
      throw new AppError("Room not found", 404, "ROOM_NOT_FOUND");
    }

    if (roomDoc.status === "CLOSED") {
      throw new AppError("Cannot run or submit code in a closed room", 400, "ROOM_CLOSED");
    }

    const isMember = roomDoc.users.some(
      (userId) => userId.toString() === req.userId.toString()
    );

    if (!isMember) {
      throw new AppError("You are not a member of this room", 403, "FORBIDDEN");
    }
  }

  return { problem, roomDoc };
}

// POST /api/submissions/run
// Executes user code against VISIBLE test cases only (No database persistence)
router.post("/run", protect, async (req, res, next) => {
  try {
    const { problem } = await validateSubmissionRequest(req);
    const { code, language = "cpp" } = req.body;

    const runnerResult = await runProblem({
      problem,
      code,
      includeHidden: false,
      language: language.toLowerCase(),
    });

    res.status(200).json({
      success: true,
      result: {
        status: runnerResult.status,
        passedTestCases: runnerResult.passedTestCases,
        totalTestCases: runnerResult.totalTestCases,
        runtimeMs: runnerResult.runtimeMs,
        memoryKb: runnerResult.memoryKb,
        testResults: runnerResult.testResults,
        failedTestCase: runnerResult.failedTestCase,
        error: runnerResult.error,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    if (error.message === "Code is required") {
      return next(new AppError("Code is required", 400, "VALIDATION_ERROR"));
    }
    next(error);
  }
});

// POST /api/submissions/submit
// Executes user code against ALL test cases (visible + hidden) and persists Submission document
router.post("/submit", protect, async (req, res, next) => {
  try {
    const { problem, roomDoc } = await validateSubmissionRequest(req);
    const { code, language = "cpp" } = req.body;

    const runnerResult = await runProblem({
      problem,
      code,
      includeHidden: true,
      language: language.toLowerCase(),
    });

    if (runnerResult.status === "internal_error") {
      return next(
        new AppError(
          runnerResult.error || "Execution engine encountered an internal error",
          500,
          "EXECUTION_ENGINE_ERROR"
        )
      );
    }

    const dbStatus = STATUS_MAP[runnerResult.status] || "Wrong Answer";

    // Format test results for database schema (preserving hidden test protection)
    const dbTestResults = runnerResult.testResults.map((tr) => ({
      testCaseIndex: tr.testCaseIndex,
      passed: tr.passed,
      isHidden: tr.isHidden,
      input: tr.isHidden ? null : tr.input,
      expectedOutput: tr.isHidden ? null : tr.expectedOutput,
      actualOutput: tr.isHidden ? null : tr.actualOutput,
      executionTimeMs: tr.executionTimeMs || 0,
      errorMessage: tr.errorMessage || null,
    }));

    // Format failedTestCase for database schema (protecting hidden test case details)
    let dbFailedTestCase = null;
    if (runnerResult.failedTestCase) {
      if (runnerResult.failedTestCase.isHidden) {
        dbFailedTestCase = {
          input: null,
          expected: null,
          actual: null,
        };
      } else {
        dbFailedTestCase = {
          input: runnerResult.failedTestCase.input ?? null,
          expected: runnerResult.failedTestCase.expected ?? null,
          actual: runnerResult.failedTestCase.actual ?? null,
        };
      }
    }

    // Persist final completed Submission document synchronously
    const submission = await Submission.create({
      user: req.userId,
      problem: problem._id,
      room: roomDoc ? roomDoc._id : null,
      language: language.toLowerCase(),
      code,
      status: dbStatus,
      passedTestCases: runnerResult.passedTestCases,
      totalTestCases: runnerResult.totalTestCases,
      runtimeMs: runnerResult.runtimeMs,
      memoryKb: runnerResult.memoryKb,
      failedTestCase: dbFailedTestCase,
      testResults: dbTestResults,
    });

    // Mark problem as solved ONLY for individual (non-room) Accepted submissions
    if (dbStatus === "Accepted" && !roomDoc) {
      try {
        const User = require("../models/User");
        const userDoc = await User.findById(req.userId);
        if (userDoc) {
          if (!Array.isArray(userDoc.solvedProblems)) {
            userDoc.solvedProblems = [];
          }
          const alreadySolved = userDoc.solvedProblems.some(
            (sp) => sp?.problem && sp.problem.toString() === problem._id.toString()
          );
          if (!alreadySolved) {
            userDoc.solvedProblems.push({
              problem: problem._id,
              solvedAt: new Date(),
            });
            await userDoc.save();
          }
        }
      } catch (userUpdateErr) {
        console.error("Failed to update user solvedProblems:", userUpdateErr);
      }
    }

    res.status(200).json({
      success: true,
      submission: {
        id: submission._id,
        _id: submission._id,
        user: submission.user,
        problem: submission.problem,
        problemTitle: problem.title,
        room: submission.room,
        language: submission.language,
        code: submission.code,
        status: submission.status,
        passedTestCases: submission.passedTestCases,
        totalTestCases: submission.totalTestCases,
        runtimeMs: submission.runtimeMs,
        memoryKb: submission.memoryKb,
        failedTestCase: runnerResult.failedTestCase,
        testResults: runnerResult.testResults,
        createdAt: submission.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return next(error);
    }
    if (error.message === "Code is required") {
      return next(new AppError("Code is required", 400, "VALIDATION_ERROR"));
    }
    next(error);
  }
});

// GET /api/submissions/problem/:problemId/history
router.get("/problem/:problemId/history", protect, async (req, res, next) => {
  try {
    const { problemId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(problemId)) {
      return next(new AppError("Invalid problemId format", 400, "VALIDATION_ERROR"));
    }

    const submissions = await Submission.find({
      user: req.userId,
      problem: problemId,
    })
      .sort({ createdAt: -1 })
      .limit(10);

    res.status(200).json({ submissions });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
