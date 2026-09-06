const express = require("express");
const router = express.Router();

const Problem = require("../models/Problem");

// GET all problems
router.get("/", async (req, res, next) => {
  try {
    const problems = await Problem.find()
      .select("_id title slug difficulty tags")
      .sort({ createdAt: 1 });

    res.status(200).json({
      problems
    });
  } catch (error) {
    next(error);
  }
});

// GET one problem by slug
router.get("/:slug", async (req, res, next) => {
  try {
    const { slug } = req.params;

    const problem = await Problem.findOne({ slug });

    if (!problem) {
      return res.status(404).json({
        message: "Problem not found"
      });
    }

    // Convert to plain object and protect hidden test cases
    const problemObj = problem.toObject();
    if (Array.isArray(problemObj.testCases)) {
      problemObj.testCases = problemObj.testCases.filter((tc) => !tc.isHidden);
    }

    res.status(200).json({
      problem: problemObj
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;