const mongoose = require("mongoose");
const dotenv = require("dotenv");
const { performance } = require("perf_hooks");
const Problem = require("./models/Problem");
const {
  runUnifiedMultiTestProblem,
  runLegacySequentialProblem,
} = require("./services/problemTestRunnerService");

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/codesync_ai";

const TWO_SUM_CODE = `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> numMap;
        for (int i = 0; i < nums.size(); i++) {
            int complement = target - nums[i];
            if (numMap.find(complement) != numMap.end()) {
                return {numMap[complement], i};
            }
            numMap[nums[i]] = i;
        }
        return {};
    }
};`;

const LONGEST_SUBSTR_CODE = `class Solution {
public:
    int lengthOfLongestSubstring(string s) {
        vector<int> lastIndex(256, -1);
        int maxLen = 0, start = 0;
        for (int i = 0; i < s.length(); i++) {
            start = max(start, lastIndex[(unsigned char)s[i]] + 1);
            maxLen = max(maxLen, i - start + 1);
            lastIndex[(unsigned char)s[i]] = i;
        }
        return maxLen;
    }
};`;

async function benchmarkDetailedScenario(scenarioName, slug, code, isSubmit) {
  console.log(`\n======================================================`);
  console.log(`DETAILED BENCHMARK: ${scenarioName} (${isSubmit ? "Submit - All Tests" : "Run - Visible Tests Only"})`);
  console.log(`======================================================`);

  const problem = await Problem.findOne({ slug });
  if (!problem) throw new Error(`Problem not found for slug: ${slug}`);

  const selectedTestCases = problem.testCases
    .map((tc, originalIndex) => ({ tc, originalIndex }))
    .filter(({ tc }) => isSubmit || !tc.isHidden);

  const testCount = selectedTestCases.length;

  // 1. Measure New Unified Multi-Test Path (1 Piston Invocation)
  const tUnifiedStart = performance.now();
  const unifiedResult = await runUnifiedMultiTestProblem({
    problem,
    code,
    selectedTestCases,
    language: "cpp",
  });
  const unifiedTotalMs = performance.now() - tUnifiedStart;

  // 2. Measure Old Legacy Sequential Path (N Piston Invocations)
  const tLegacyStart = performance.now();
  const legacyResult = await runLegacySequentialProblem({
    problem,
    code,
    selectedTestCases,
    language: "cpp",
  });
  const legacyTotalMs = performance.now() - tLegacyStart;

  const reductionPercent = ((legacyTotalMs - unifiedTotalMs) / legacyTotalMs) * 100;

  console.log(`Total Test Cases: ${testCount}`);
  console.log(`--- NEW UNIFIED PATH (1 Piston Invocation) ---`);
  console.log(`• Piston Invocations: 1`);
  console.log(`• Total Request Time: ${unifiedTotalMs.toFixed(2)} ms`);
  console.log(`• Reported Run CPU Time: ${unifiedResult.runtimeMs} ms`);
  console.log(`• Reported Max Memory: ${unifiedResult.memoryKb} KB`);
  console.log(`• Verdict Status: ${unifiedResult.status} (${unifiedResult.passedTestCases}/${unifiedResult.totalTestCases} passed)`);

  console.log(`\n--- OLD LEGACY PATH (${testCount} Piston Invocations) ---`);
  console.log(`• Piston Invocations: ${testCount}`);
  console.log(`• Total Request Time: ${legacyTotalMs.toFixed(2)} ms`);
  console.log(`• Reported Aggregate CPU Time: ${legacyResult.runtimeMs} ms`);
  console.log(`• Reported Max Memory: ${legacyResult.memoryKb} KB`);
  console.log(`• Verdict Status: ${legacyResult.status} (${legacyResult.passedTestCases}/${legacyResult.totalTestCases} passed)`);

  console.log(`\n>>> LATENCY REDUCTION: ${reductionPercent.toFixed(2)}% faster (${(legacyTotalMs / 1000).toFixed(1)}s -> ${(unifiedTotalMs / 1000).toFixed(1)}s)`);

  return {
    scenario: scenarioName,
    testCount,
    oldInvocations: testCount,
    newInvocations: 1,
    oldTotalMs: legacyTotalMs,
    newTotalMs: unifiedTotalMs,
    reductionPercent,
    statusMatches: unifiedResult.status === legacyResult.status,
    passedTestMatches: unifiedResult.passedTestCases === legacyResult.passedTestCases,
  };
}

async function runDetailedBenchmark() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB for detailed execution performance benchmarking.\n");

  try {
    const results = [];
    results.push(await benchmarkDetailedScenario("Two Sum - Run", "two-sum", TWO_SUM_CODE, false));
    results.push(await benchmarkDetailedScenario("Two Sum - Submit", "two-sum", TWO_SUM_CODE, true));
    results.push(await benchmarkDetailedScenario("Longest Unique Substring - Run", "longest-unique-substring", LONGEST_SUBSTR_CODE, false));
    results.push(await benchmarkDetailedScenario("Longest Unique Substring - Submit", "longest-unique-substring", LONGEST_SUBSTR_CODE, true));

    console.log("\n=========================================================================================");
    console.log("FINAL BENCHMARK COMPARISON TABLE");
    console.log("=========================================================================================");
    console.table(
      results.map((r) => ({
        Scenario: r.scenario,
        Tests: r.testCount,
        "Old Jobs": r.oldInvocations,
        "New Jobs": r.newInvocations,
        "Old Total (s)": (r.oldTotalMs / 1000).toFixed(2) + "s",
        "New Total (s)": (r.newTotalMs / 1000).toFixed(2) + "s",
        "Reduction (%)": `${r.reductionPercent.toFixed(1)}%`,
        "Verdict Match": r.statusMatches ? "EXACT MATCH (100%)" : "MISMATCH",
      }))
    );
  } catch (err) {
    console.error("Benchmark failed:", err);
  } finally {
    await mongoose.disconnect();
    console.log("\nDisconnected from MongoDB.");
  }
}

runDetailedBenchmark();
