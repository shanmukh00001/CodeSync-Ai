const mongoose = require("mongoose");

const testResultSchema = new mongoose.Schema(
  {
    testCaseIndex: {
      type: Number,
      required: true,
    },
    passed: {
      type: Boolean,
      required: true,
    },
    isHidden: {
      type: Boolean,
      default: false,
    },
    input: {
      type: mongoose.Schema.Types.Mixed,
    },
    expectedOutput: {
      type: mongoose.Schema.Types.Mixed,
    },
    actualOutput: {
      type: mongoose.Schema.Types.Mixed,
    },
    executionTimeMs: {
      type: Number,
      default: 0,
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  { _id: false }
);

const submissionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    problem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Problem",
      required: true,
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      default: null,
    },
    language: {
      type: String,
      enum: ["javascript", "python", "java", "cpp"],
      required: true,
    },
    code: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: [
        "Pending",
        "Accepted",
        "Wrong Answer",
        "Time Limit Exceeded",
        "Runtime Error",
        "Compilation Error",
      ],
      default: "Pending",
    },
    passedTestCases: {
      type: Number,
      default: 0,
    },
    totalTestCases: {
      type: Number,
      default: 0,
    },
    runtimeMs: {
      type: Number,
      default: 0,
    },
    memoryKb: {
      type: Number,
      default: 0,
    },
    failedTestCase: {
      input: { type: mongoose.Schema.Types.Mixed, default: null },
      expected: { type: mongoose.Schema.Types.Mixed, default: null },
      actual: { type: mongoose.Schema.Types.Mixed, default: null },
    },
    testResults: [testResultSchema],
  },
  {
    timestamps: true,
  }
);

const Submission = mongoose.model("Submission", submissionSchema);

module.exports = Submission;
