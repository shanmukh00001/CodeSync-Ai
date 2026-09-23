const express = require("express");
const router = express.Router();
const { z } = require("zod");
const protect = require("../middleware/authMiddleware");
const requireAdmin = require("../middleware/adminMiddleware");
const validate = require("../middleware/validate");
const { AppError } = require("../middleware/errorMiddleware");
const Problem = require("../models/Problem");

// Validation Schemas for Admin Problem CRUD
const testCaseSchema = z.object({
    input: z.any(),
    expectedOutput: z.any(),
    isHidden: z.boolean().default(false),
});

const exampleSchema = z.object({
    input: z.string().min(1, "Example input is required"),
    output: z.string().min(1, "Example output is required"),
    explanation: z.string().optional(),
});

const createProblemSchema = z.object({
    title: z.string().trim().min(3, "Title must be at least 3 characters"),
    slug: z.string().trim().min(3, "Slug must be at least 3 characters").toLowerCase(),
    description: z.string().min(10, "Description must be at least 10 characters"),
    difficulty: z.enum(["Easy", "Medium", "Hard"]),
    tags: z.array(z.string()).default([]),
    constraints: z.array(z.string()).default([]),
    examples: z.array(exampleSchema).default([]),
    starterCode: z.object({
        javascript: z.string().default(""),
        python: z.string().default(""),
        java: z.string().default(""),
        cpp: z.string().default(""),
    }).default({}),
    execution: z.object({
        functionName: z.string().min(1, "Execution functionName is required"),
        parameters: z.array(z.string()).min(1, "At least one parameter is required"),
    }),
    outputComparator: z.enum(["exact", "unordered_array", "unordered_nested_array"]).default("exact"),
    testCases: z.array(testCaseSchema).min(1, "At least one test case is required"),
});

const updateProblemSchema = createProblemSchema.partial();

// All routes here are protected and require admin privileges
router.use(protect, requireAdmin);

// GET /api/admin/problems - List all problems with full admin metadata (including hidden test cases)
router.get("/problems", async (req, res, next) => {
    try {
        const problems = await Problem.find().sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            count: problems.length,
            problems,
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/admin/problems/:id - Get complete single problem definition
router.get("/problems/:id", async (req, res, next) => {
    try {
        const problem = await Problem.findById(req.params.id);
        if (!problem) {
            return next(new AppError("Problem not found", 404, "PROBLEM_NOT_FOUND"));
        }
        res.status(200).json({
            success: true,
            problem,
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/admin/problems - Create new problem
router.post("/problems", validate(createProblemSchema), async (req, res, next) => {
    try {
        const { slug } = req.body;
        const existing = await Problem.findOne({ slug });
        if (existing) {
            return next(new AppError("A problem with this slug already exists", 400, "SLUG_ALREADY_EXISTS"));
        }

        const newProblem = new Problem(req.body);
        await newProblem.save();

        res.status(201).json({
            success: true,
            message: "Problem created successfully",
            problem: newProblem,
        });
    } catch (error) {
        next(error);
    }
});

// PUT /api/admin/problems/:id - Update existing problem
router.put("/problems/:id", validate(updateProblemSchema), async (req, res, next) => {
    try {
        const problem = await Problem.findById(req.params.id);
        if (!problem) {
            return next(new AppError("Problem not found", 404, "PROBLEM_NOT_FOUND"));
        }

        if (req.body.slug && req.body.slug !== problem.slug) {
            const existing = await Problem.findOne({ slug: req.body.slug, _id: { $ne: problem._id } });
            if (existing) {
                return next(new AppError("A problem with this slug already exists", 400, "SLUG_ALREADY_EXISTS"));
            }
        }

        Object.assign(problem, req.body);
        await problem.save();

        res.status(200).json({
            success: true,
            message: "Problem updated successfully",
            problem,
        });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/admin/problems/:id - Delete problem
router.delete("/problems/:id", async (req, res, next) => {
    try {
        const problem = await Problem.findByIdAndDelete(req.params.id);
        if (!problem) {
            return next(new AppError("Problem not found", 404, "PROBLEM_NOT_FOUND"));
        }

        res.status(200).json({
            success: true,
            message: "Problem deleted successfully",
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
