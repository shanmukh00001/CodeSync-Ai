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

const cppCode = `
#include <vector>
#include <unordered_map>
using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> seen;
        for (int i = 0; i < (int)nums.size(); i++) {
            int comp = target - nums[i];
            if (seen.count(comp)) {
                return {seen[comp], i};
            }
            seen[nums[i]] = i;
        }
        return {};
    }
};
`;

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
    console.log("Testing C++ execution...");
    const cppRun = await runProblem({ problem: dummyProblem, code: cppCode, includeHidden: true, language: "cpp" });
    console.log("C++ Submit:", cppRun.status, cppRun.passedTestCases, "/", cppRun.totalTestCases);
    console.assert(cppRun.status === "accepted" && cppRun.passedTestCases === 3, "C++ must pass 3 tests");

    console.log("Testing Python execution...");
    const pyRun = await runProblem({ problem: dummyProblem, code: pythonCode, includeHidden: true, language: "python" });
    console.log("Python Submit:", pyRun.status, pyRun.passedTestCases, "/", pyRun.totalTestCases);
    console.assert(pyRun.status === "accepted" && pyRun.passedTestCases === 3, "Python must pass 3 tests");

    console.log("C++ and Python regression verified!");
  } catch (err) {
    console.error("Multi-language execution error:", err);
    process.exit(1);
  }
})();
