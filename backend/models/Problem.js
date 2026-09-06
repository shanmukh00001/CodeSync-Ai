const mongoose = require("mongoose");

const exampleSchema = new mongoose.Schema(
    {
        input: {
            type: String,
            required: true
        },
        output: {
            type: String,
            required: true
        },
        explanation: {
            type: String
        }
    },
    { _id: false }
);

const testCaseSchema = new mongoose.Schema(
    {
        input: {
            type: mongoose.Schema.Types.Mixed,
            required: true
        },
        expectedOutput: {
            type: mongoose.Schema.Types.Mixed,
            required: true
        },
        isHidden: {
            type: Boolean,
            default: false
        }
    },
    { _id: false }
);

const problemSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },

        slug: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true
        },

        description: {
            type: String,
            required: true
        },

        difficulty: {
            type: String,
            enum: ["Easy", "Medium", "Hard"],
            required: true
        },

        tags: {
            type: [String],
            default: []
        },

        constraints: {
            type: [String],
            default: []
        },

        examples: {
            type: [exampleSchema],
            default: []
        },

        starterCode: {
            javascript: {
                type: String,
                default: ""
            },
            python: {
                type: String,
                default: ""
            },
            java: {
                type: String,
                default: ""
            },
            cpp: {
                type: String,
                default: ""
            }
        },

        execution: {
            functionName: {
                type: String,
                required: true
            },
            parameters: {
                type: [String],
                required: true
            }
        },

        outputComparator: {
            type: String,
            enum: [
                "exact",
                "unordered_array",
                "unordered_nested_array"
            ],
            default: "exact"
        },

        testCases: {
            type: [testCaseSchema],
            default: []
        }
    },
    {
        timestamps: true
    }
);

const Problem = mongoose.model("Problem", problemSchema);

module.exports = Problem;