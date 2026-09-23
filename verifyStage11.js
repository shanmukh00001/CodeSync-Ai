const assert = require("assert");
const { getAIProvider, setAIProvider } = require("./backend/services/ai/aiProviderFactory");
const LocalAIProvider = require("./backend/services/ai/localAiProvider");
const { runProblem } = require("./backend/services/problemTestRunnerService");

async function runStage11Regression() {
  console.log("==================================================");
  console.log("CODE SYNC AI — STAGE 11 VERIFICATION SUITE");
  console.log("==================================================");

  // 1. LOCAL AI PROVIDER
  console.log("\n[TEST 1] LocalAIProvider Factory Selection & Defaults");
  process.env.AI_PROVIDER = "local";
  process.env.LOCAL_AI_BASE_URL = "http://127.0.0.1:11434";
  process.env.LOCAL_AI_MODEL = "qwen3-coder:30b";
  setAIProvider(null);
  const localProvider = getAIProvider();
  assert(localProvider instanceof LocalAIProvider, "Factory must return LocalAIProvider when AI_PROVIDER=local");
  assert.strictEqual(localProvider.baseUrl, "http://127.0.0.1:11434");
  assert.strictEqual(localProvider.model, "qwen3-coder:30b");
  console.log("✓ LocalAIProvider correctly initialized with configured defaults");

  console.log("\n[TEST 2] LocalAIProvider Offline / Unavailable Graceful Handling");
  try {
    await localProvider.reviewCode({ code: "int main(){}", problem: { title: "Test", difficulty: "Easy" } });
    assert.fail("Should throw 503 error when local server unreachable");
  } catch (err) {
    assert.strictEqual(err.statusCode, 503);
    assert.strictEqual(err.code, "AI_SERVICE_UNAVAILABLE");
    console.log("✓ ReviewCode safely throws 503 AI_SERVICE_UNAVAILABLE without crashing");
  }

  try {
    await localProvider.generateHint({ code: "int main(){}", problem: { title: "Test", difficulty: "Easy" } });
    assert.fail("Should throw 503 error when local server unreachable");
  } catch (err) {
    assert.strictEqual(err.statusCode, 503);
    assert.strictEqual(err.code, "AI_SERVICE_UNAVAILABLE");
    console.log("✓ GenerateHint safely throws 503 AI_SERVICE_UNAVAILABLE without crashing");
  }

  try {
    await localProvider.generateRecommendations({ profileSummary: {}, candidateProblems: [] });
    assert.fail("Should throw 503 error when local server unreachable");
  } catch (err) {
    assert.strictEqual(err.statusCode, 503);
    assert.strictEqual(err.code, "AI_SERVICE_UNAVAILABLE");
    console.log("✓ GenerateRecommendations safely throws 503 AI_SERVICE_UNAVAILABLE without crashing");
  }

  // 2. MULTI-LANGUAGE TEST SUITE
  console.log("\n[TEST 3] Multi-Language Execution Contract (Run + Submit across C++, Python, JS, Java)");
  const dummyProblem = {
    slug: "two-sum",
    execution: { functionName: "twoSum", parameters: ["nums", "target"] },
    outputComparator: "exact",
    testCases: [
      { input: { nums: [2, 7, 11, 15], target: 9 }, expectedOutput: [0, 1], isHidden: false },
      { input: { nums: [3, 2, 4], target: 6 }, expectedOutput: [1, 2], isHidden: false },
      { input: { nums: [3, 3], target: 6 }, expectedOutput: [0, 1], isHidden: true },
    ],
  };

  const solutions = {
    cpp: `
#include <vector>
#include <unordered_map>
using namespace std;
class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> seen;
        for (int i = 0; i < (int)nums.size(); i++) {
            int comp = target - nums[i];
            if (seen.count(comp)) return {seen[comp], i};
            seen[nums[i]] = i;
        }
        return {};
    }
};`,
    python: `
class Solution:
    def twoSum(self, nums, target):
        seen = {}
        for i, n in enumerate(nums):
            comp = target - n
            if comp in seen:
                return [seen[comp], i]
            seen[n] = i
        return []`,
    javascript: `
class Solution {
    twoSum(nums, target) {
        const seen = new Map();
        for (let i = 0; i < nums.length; i++) {
            const comp = target - nums[i];
            if (seen.has(comp)) return [seen.get(comp), i];
            seen.set(nums[i], i);
        }
        return [];
    }
}`,
    java: `
class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> seen = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int comp = target - nums[i];
            if (seen.containsKey(comp)) return new int[]{seen.get(comp), i};
            seen.put(nums[i], i);
        }
        return new int[]{};
    }
}`,
  };

  for (const [lang, code] of Object.entries(solutions)) {
    // Run (visible only)
    const runRes = await runProblem({ problem: dummyProblem, code, includeHidden: false, language: lang });
    assert.strictEqual(runRes.status, "accepted", `${lang} Run must be accepted`);
    assert.strictEqual(runRes.passedTestCases, 2, `${lang} Run must pass 2 visible tests`);

    // Submit (visible + hidden)
    const submitRes = await runProblem({ problem: dummyProblem, code, includeHidden: true, language: lang });
    assert.strictEqual(submitRes.status, "accepted", `${lang} Submit must be accepted`);
    assert.strictEqual(submitRes.passedTestCases, 3, `${lang} Submit must pass 3 total tests`);
    assert.strictEqual(submitRes.testResults[2].isHidden, true, `${lang} hidden test flag preserved`);
    assert.strictEqual(submitRes.testResults[2].input, undefined, `${lang} hidden test input preserved`);
    console.log(`✓ ${lang.toUpperCase()} Run & Submit verified (Hidden tests preserved, 3/3 passed)`);
  }

  console.log("\n==================================================");
  console.log("🎉 ALL STAGE 11 BACKEND REGRESSION ASSERTIONS PASSED!");
  console.log("==================================================");
}

runStage11Regression().catch((err) => {
  console.error("Stage 11 regression failed:", err);
  process.exit(1);
});
