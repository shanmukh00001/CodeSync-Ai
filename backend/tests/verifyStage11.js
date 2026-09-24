const LocalAIProvider = require("./services/ai/localAiProvider");
const { getAIProvider } = require("./services/ai/aiProviderFactory");
const { runProblem } = require("./services/problemTestRunnerService");

async function runStage11Verification() {
  console.log("==================================================");
  console.log("STAGE 11 VERIFICATION SUITE — LOCAL AI & MULTI-LANGUAGE");
  console.log("==================================================\n");

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
    }
  }

  // 1. Local AI Configuration & Constraint Tests
  console.log("1. LocalAIProvider Hardware Constraint Verification:");
  const localProvider = new LocalAIProvider();
  assert(localProvider.model === "qwen3:4b", `Default model is low-RAM qwen3:4b (found: ${localProvider.model})`);
  assert(localProvider.baseUrl === "http://127.0.0.1:11434", `Base URL is http://127.0.0.1:11434 (found: ${localProvider.baseUrl})`);
  assert(localProvider.timeoutMs === 15000, `Timeout is safe (15s) (found: ${localProvider.timeoutMs})`);

  // Factory check
  process.env.AI_PROVIDER = "local";
  const factoryLocal = getAIProvider({ provider: "local" });
  assert(factoryLocal instanceof LocalAIProvider, "AIProviderFactory produces LocalAIProvider on AI_PROVIDER=local");

  // Verify graceful offline behavior
  console.log("\n2. Local AI Graceful Offline 503 Handling (Low-Memory / Offline guard):");
  try {
    await localProvider.generateHint({
      problemTitle: "Two Sum",
      problemDescription: "Given an array of integers...",
      userCode: "function twoSum() {}",
      language: "javascript"
    });
    console.log("  [INFO] Local Ollama server is online and responded!");
  } catch (err) {
    assert(
      err.statusCode === 503 || err.statusCode === 504 || err.code === "AI_SERVICE_UNAVAILABLE" || err.code === "AI_TIMEOUT",
      `Offline Ollama gracefully returns 503 AI_SERVICE_UNAVAILABLE or 504 AI_TIMEOUT (got status=${err.statusCode}, code=${err.code})`
    );
  }

  // 3. Multi-Language Test Harness Execution (C++, Python, JS, Java)
  console.log("\n3. Polyglot Multi-Language Execution Test (Run & Submit):");

  const problemData = {
    _id: "two-sum",
    slug: "two-sum",
    title: "Two Sum",
    outputComparator: "unordered_array",
    execution: {
      functionName: "twoSum",
      parameters: ["nums", "target"]
    },
    testCases: [
      { input: { nums: [2, 7, 11, 15], target: 9 }, expectedOutput: [0, 1], isHidden: false },
      { input: { nums: [3, 2, 4], target: 6 }, expectedOutput: [1, 2], isHidden: false },
      { input: { nums: [3, 3], target: 6 }, expectedOutput: [0, 1], isHidden: true }
    ]
  };

  const polyglotCodes = [
    {
      language: "cpp",
      code: `#include <vector>
#include <unordered_map>
using namespace std;
class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> m;
        for (int i = 0; i < nums.size(); ++i) {
            int comp = target - nums[i];
            if (m.count(comp)) return {m[comp], i};
            m[nums[i]] = i;
        }
        return {};
    }
};`
    },
    {
      language: "python",
      code: `class Solution:
    def twoSum(self, nums, target):
        m = {}
        for i, num in enumerate(nums):
            comp = target - num
            if comp in m:
                return [m[comp], i]
            m[num] = i
        return []`
    },
    {
      language: "javascript",
      code: `var twoSum = function(nums, target) {
    const map = new Map();
    for (let i = 0; i < nums.length; i++) {
        const comp = target - nums[i];
        if (map.has(comp)) return [map.get(comp), i];
        map.set(nums[i], i);
    }
    return [];
};`
    },
    {
      language: "java",
      code: `import java.util.HashMap;
import java.util.Map;

class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> map = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int comp = target - nums[i];
            if (map.containsKey(comp)) {
                return new int[] { map.get(comp), i };
            }
            map.put(nums[i], i);
        }
        return new int[0];
    }
}`
    }
  ];

  for (const langItem of polyglotCodes) {
    console.log(`\n  Testing language execution: [${langItem.language}]`);
    try {
      // Run mode (includeHidden: false)
      const runResult = await runProblem({
        problem: problemData,
        code: langItem.code,
        language: langItem.language,
        includeHidden: false
      });
      assert(runResult.passedTestCases === 2 && runResult.totalTestCases === 2, `[${langItem.language}] Run passed 2/2 visible test cases`);

      // Submit mode (includeHidden: true)
      const submitResult = await runProblem({
        problem: problemData,
        code: langItem.code,
        language: langItem.language,
        includeHidden: true
      });
      assert(submitResult.status === "accepted", `[${langItem.language}] Submit status is accepted`);
      assert(submitResult.passedTestCases === 3 && submitResult.totalTestCases === 3, `[${langItem.language}] Submit passed all 3/3 test cases`);
      
      const hiddenResults = submitResult.testResults.filter((t) => t.isHidden);
      assert(hiddenResults.length === 1, `[${langItem.language}] 1 hidden test preserved in testResults`);
      assert(hiddenResults[0].input === undefined, `[${langItem.language}] Hidden test input is redacted`);
    } catch (e) {
      console.error(`  [FAIL] ${langItem.language} failed:`, e.message);
      assert(false, `${langItem.language} execution failed`);
    }
  }

  console.log(`\n==================================================`);
  console.log(`STAGE 11 VERIFICATION RESULT: ${passed}/${total} checks passed`);
  console.log(`==================================================\n`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runStage11Verification().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
