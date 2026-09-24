const { runProblem } = require("./backend/services/problemTestRunnerService");

const dummyProblem = {
  slug: "two-sum",
  execution: {
    functionName: "twoSum",
    parameters: ["nums", "target"]
  },
  outputComparator: "exact",
  testCases: [
    { input: { nums: [2, 7, 11, 15], target: 9 }, expectedOutput: [0, 1], isHidden: false },
    { input: { nums: [3, 2, 4], target: 6 }, expectedOutput: [1, 2], isHidden: false },
    { input: { nums: [3, 3], target: 6 }, expectedOutput: [0, 1], isHidden: true }
  ]
};

const pythonCode = `
class Solution:
    def twoSum(self, nums, target):
        seen = {}
        for i, n in enumerate(nums):
            comp = target - n
            if comp in seen:
                return [seen[comp], i]
            seen[n] = i
        return []
`;

(async () => {
  try {
    console.log("Testing Python Run (visible only)...");
    const runRes = await runProblem({ problem: dummyProblem, code: pythonCode, includeHidden: false, language: "python" });
    console.log("Run Result:", runRes.status, runRes.passedTestCases, "/", runRes.totalTestCases);
    console.assert(runRes.status === "accepted", "Run should be accepted");
    console.assert(runRes.passedTestCases === 2, "Should pass 2 visible tests");

    console.log("Testing Python Submit (visible + hidden)...");
    const submitRes = await runProblem({ problem: dummyProblem, code: pythonCode, includeHidden: true, language: "python" });
    console.log("Submit Result:", submitRes.status, submitRes.passedTestCases, "/", submitRes.totalTestCases);
    console.assert(submitRes.status === "accepted", "Submit should be accepted");
    console.assert(submitRes.passedTestCases === 3, "Should pass 3 total tests");
    console.assert(submitRes.testResults[2].isHidden === true, "Hidden test must remain hidden");
    console.assert(submitRes.testResults[2].input === undefined, "Hidden test input must not leak");

    console.log("PYTHON RUN + SUBMIT VERIFICATION PASSED!");
  } catch (err) {
    console.error("Python execution failed:", err);
    process.exit(1);
  }
})();
