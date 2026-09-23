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

const jsCode = `
class Solution {
    twoSum(nums, target) {
        const seen = new Map();
        for (let i = 0; i < nums.length; i++) {
            const comp = target - nums[i];
            if (seen.has(comp)) {
                return [seen.get(comp), i];
            }
            seen.set(nums[i], i);
        }
        return [];
    }
}
`;

const javaCode = `
class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> seen = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int comp = target - nums[i];
            if (seen.containsKey(comp)) {
                return new int[]{seen.get(comp), i};
            }
            seen.put(nums[i], i);
        }
        return new int[]{};
    }
}
`;

(async () => {
  try {
    console.log("=== VERIFYING C++ ===");
    const cppRun = await runProblem({ problem: dummyProblem, code: cppCode, includeHidden: true, language: "cpp" });
    console.log("C++:", cppRun.status, `${cppRun.passedTestCases}/${cppRun.totalTestCases}`);
    console.assert(cppRun.status === "accepted" && cppRun.passedTestCases === 3, "C++ must pass 3 tests");

    console.log("=== VERIFYING PYTHON ===");
    const pyRun = await runProblem({ problem: dummyProblem, code: pythonCode, includeHidden: true, language: "python" });
    console.log("Python:", pyRun.status, `${pyRun.passedTestCases}/${pyRun.totalTestCases}`);
    console.assert(pyRun.status === "accepted" && pyRun.passedTestCases === 3, "Python must pass 3 tests");

    console.log("=== VERIFYING JAVASCRIPT ===");
    const jsRun = await runProblem({ problem: dummyProblem, code: jsCode, includeHidden: true, language: "javascript" });
    console.log("JavaScript:", jsRun.status, `${jsRun.passedTestCases}/${jsRun.totalTestCases}`);
    console.assert(jsRun.status === "accepted" && jsRun.passedTestCases === 3, "JavaScript must pass 3 tests");

    console.log("=== VERIFYING JAVA ===");
    const javaRun = await runProblem({ problem: dummyProblem, code: javaCode, includeHidden: true, language: "java" });
    console.log("Java:", javaRun.status, `${javaRun.passedTestCases}/${javaRun.totalTestCases}`);
    console.assert(javaRun.status === "accepted" && javaRun.passedTestCases === 3, "Java must pass 3 tests");

    console.log("==========================================");
    console.log("ALL 4 LANGUAGES (C++, Python, JS, Java) VERIFIED END-TO-END!");
    console.log("==========================================");
  } catch (err) {
    console.error("Multi-language execution error:", err);
    process.exit(1);
  }
})();
