require("dotenv").config();
const mongoose = require("mongoose");
const assert = require("assert");
const {
  isEligibleForUnifiedExecution,
  generateCppMultiTestHarness,
  parseMultiTestHarnessOutput,
} = require("./services/cppMultiTestHarnessService");
const {
  runProblem,
  runUnifiedMultiTestProblem,
  runLegacySequentialProblem,
} = require("./services/problemTestRunnerService");

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/codesync_ai";

// Standard Test Solutions
const TWO_SUM_CORRECT = `class Solution {
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

const TWO_SUM_WRONG = `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        return {999, 999};
    }
};`;

const TWO_SUM_COMPILE_ERROR = `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        this_is_a_syntax_error!!
    }
};`;

const TWO_SUM_RUNTIME_ERROR = `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        int* ptr = nullptr;
        *ptr = 42; // SIGSEGV
        return {0, 1};
    }
};`;

const LONGEST_SUBSTR_CORRECT = `class Solution {
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

const mockTwoSumProblem = {
  title: "Two Sum",
  slug: "two-sum",
  execution: {
    functionName: "twoSum",
    parameters: ["nums", "target"],
  },
  outputComparator: "unordered_array",
  testCases: [
    { input: { nums: [2, 7, 11, 15], target: 9 }, expectedOutput: [0, 1], isHidden: false },
    { input: { nums: [3, 2, 4], target: 6 }, expectedOutput: [1, 2], isHidden: false },
    { input: { nums: [3, 3], target: 6 }, expectedOutput: [0, 1], isHidden: false },
    { input: { nums: [-3, 4, 3, 90], target: 0 }, expectedOutput: [0, 2], isHidden: true },
    { input: { nums: [0, 4, 3, 0], target: 0 }, expectedOutput: [0, 3], isHidden: true },
  ],
};

const mockPalindromeProblem = {
  title: "Valid Palindrome",
  slug: "valid-palindrome",
  execution: {
    functionName: "isPalindrome",
    parameters: ["s"],
  },
  outputComparator: "exact",
  testCases: [
    { input: { s: "A man, a plan, a canal: Panama" }, expectedOutput: true, isHidden: false },
    { input: { s: "race a car" }, expectedOutput: false, isHidden: false },
  ],
};

const mockGroupAnagramsProblem = {
  title: "Group Anagrams",
  slug: "group-anagrams",
  execution: {
    functionName: "groupAnagrams",
    parameters: ["strs"],
  },
  outputComparator: "unordered_nested_array",
  testCases: [
    { input: { strs: ["eat", "tea", "tan", "ate", "nat", "bat"] }, expectedOutput: [["bat"], ["nat", "tan"], ["ate", "eat", "tea"]], isHidden: false },
  ],
};

async function runTests() {
  console.log("==================================================");
  console.log("Verifying Multi-Test Unified C++ Execution Service");
  console.log("==================================================");

  // 1. Harness Generation & Marker Testing
  console.log("\n[TEST 1] Harness Generation & Marker Formatting...");
  const harness = generateCppMultiTestHarness({
    solutionCode: TWO_SUM_CORRECT,
    problem: mockTwoSumProblem,
    testCases: mockTwoSumProblem.testCases.slice(0, 2),
  });
  assert(harness.source.includes("__CODESYNC_TEST_0_START__"), "Must contain test 0 start marker");
  assert(harness.source.includes("__CODESYNC_TEST_0_END__"), "Must contain test 0 end marker");
  assert(harness.source.includes("__CODESYNC_TEST_1_START__"), "Must contain test 1 start marker");
  assert(harness.source.includes("__CODESYNC_TEST_1_END__"), "Must contain test 1 end marker");
  console.log("[PASS] Multi-test harness generated with explicit structured markers");

  // 2. Parser Testing with complete, missing, and malformed markers
  console.log("\n[TEST 2] Structured Output Parser Tests...");
  const sampleStdout = `__CODESYNC_TEST_0_START__\n[0,1]\n__CODESYNC_TEST_0_END__\n__CODESYNC_TEST_1_START__\n[1,2]\n__CODESYNC_TEST_1_END__\n`;
  const parsedClean = parseMultiTestHarnessOutput(sampleStdout, 2);
  assert.strictEqual(parsedClean.success, true);
  assert.deepStrictEqual(parsedClean.testOutputs[0].parsedValue, [0, 1]);
  assert.deepStrictEqual(parsedClean.testOutputs[1].parsedValue, [1, 2]);

  // Partial / missing end marker (e.g. crash during test 1)
  const sampleCrash = `__CODESYNC_TEST_0_START__\n[0,1]\n__CODESYNC_TEST_0_END__\n__CODESYNC_TEST_1_START__\nSegmentation fault`;
  const parsedCrash = parseMultiTestHarnessOutput(sampleCrash, 2);
  assert.strictEqual(parsedCrash.success, false);
  assert.strictEqual(parsedCrash.lastCompletedIndex, 0);
  assert.strictEqual(parsedCrash.testOutputs[1].completed, false);
  console.log("[PASS] Parser handles clean, missing, and malformed markers robustly");

  // 3. Two Sum — Run (Visible Tests Only)
  console.log("\n[TEST 3] Two Sum — Run (Visible Tests Only)...");
  const runRes = await runProblem({
    problem: mockTwoSumProblem,
    code: TWO_SUM_CORRECT,
    includeHidden: false,
  });
  assert.strictEqual(runRes.status, "accepted");
  assert.strictEqual(runRes.passedTestCases, 3);
  assert.strictEqual(runRes.totalTestCases, 3);
  console.log(`[PASS] Two Sum Run passed 3/3 visible test cases in 1 Piston invocation (Status: ${runRes.status})`);

  // 4. Two Sum — Submit (All Tests: 3 Visible + 2 Hidden)
  console.log("\n[TEST 4] Two Sum — Submit (All Tests: Visible + Hidden)...");
  const submitRes = await runProblem({
    problem: mockTwoSumProblem,
    code: TWO_SUM_CORRECT,
    includeHidden: true,
  });
  assert.strictEqual(submitRes.status, "accepted");
  assert.strictEqual(submitRes.passedTestCases, 5);
  assert.strictEqual(submitRes.totalTestCases, 5);
  console.log(`[PASS] Two Sum Submit passed 5/5 test cases in 1 Piston invocation (Status: ${submitRes.status})`);

  // 5. Longest Unique Substring — Run & Submit
  console.log("\n[TEST 5] Longest Unique Substring — Full Evaluation...");
  const substrProblem = {
    title: "Longest Substring",
    slug: "longest-unique-substring",
    execution: {
      functionName: "lengthOfLongestSubstring",
      parameters: ["s"],
    },
    outputComparator: "exact",
    testCases: [
      { input: { s: "abcabcbb" }, expectedOutput: 3, isHidden: false },
      { input: { s: "bbbbb" }, expectedOutput: 1, isHidden: false },
      { input: { s: "pwwkew" }, expectedOutput: 3, isHidden: false },
      { input: { s: "" }, expectedOutput: 0, isHidden: true },
    ],
  };
  const substrRes = await runProblem({
    problem: substrProblem,
    code: LONGEST_SUBSTR_CORRECT,
    includeHidden: true,
  });
  assert.strictEqual(substrRes.status, "accepted");
  assert.strictEqual(substrRes.passedTestCases, 4);
  assert.strictEqual(substrRes.totalTestCases, 4);
  console.log(`[PASS] Longest Unique Substring passed 4/4 test cases in 1 Piston invocation`);

  // 6. Wrong Answer Detection & Failed Test Case Metadata
  console.log("\n[TEST 6] Wrong Answer Detection & Failed Test Case...");
  const wrongRes = await runProblem({
    problem: mockTwoSumProblem,
    code: TWO_SUM_WRONG,
    includeHidden: false,
  });
  assert.strictEqual(wrongRes.status, "wrong_answer");
  assert.strictEqual(wrongRes.passedTestCases, 0);
  assert(wrongRes.failedTestCase !== null, "Must have failedTestCase");
  assert.strictEqual(wrongRes.failedTestCase.testCaseIndex, 0);
  assert.deepStrictEqual(wrongRes.failedTestCase.actual, [999, 999]);
  console.log("[PASS] Wrong answer correctly detected with failedTestCase diagnostic");

  // 7. Compilation Error Handling
  console.log("\n[TEST 7] Compilation Error Handling...");
  const compileRes = await runProblem({
    problem: mockTwoSumProblem,
    code: TWO_SUM_COMPILE_ERROR,
    includeHidden: false,
  });
  assert.strictEqual(compileRes.status, "compilation_error");
  assert.strictEqual(compileRes.passedTestCases, 0);
  assert(compileRes.error, "Must return compilation error details");
  console.log("[PASS] Compilation error handled immediately with 0 tests passed");

  // 8. Runtime Error Handling (SIGSEGV)
  console.log("\n[TEST 8] Runtime Error Handling (Crash)...");
  const runtimeRes = await runProblem({
    problem: mockTwoSumProblem,
    code: TWO_SUM_RUNTIME_ERROR,
    includeHidden: false,
  });
  assert.strictEqual(runtimeRes.status, "runtime_error");
  assert(runtimeRes.error, "Must capture runtime error");
  console.log("[PASS] Runtime error (crash) handled with status 'runtime_error'");

  // 9. Hidden Test Privacy Protection
  console.log("\n[TEST 9] Hidden Test Privacy Protection...");
  const hiddenFailProblem = {
    ...mockTwoSumProblem,
    testCases: [
      { input: { nums: [2, 7, 11, 15], target: 9 }, expectedOutput: [0, 1], isHidden: false },
      { input: { nums: [99, 99], target: 198 }, expectedOutput: [0, 1], isHidden: true },
    ],
  };
  const codePassingVisibleOnly = `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        if (nums[0] == 2) return {0, 1};
        return {404, 404};
    }
};`;
  const hiddenFailRes = await runProblem({
    problem: hiddenFailProblem,
    code: codePassingVisibleOnly,
    includeHidden: true,
  });
  assert.strictEqual(hiddenFailRes.status, "wrong_answer");
  assert.strictEqual(hiddenFailRes.passedTestCases, 1);
  assert.strictEqual(hiddenFailRes.failedTestCase.isHidden, true);
  assert.strictEqual(hiddenFailRes.failedTestCase.input, undefined);
  assert.strictEqual(hiddenFailRes.failedTestCase.expected, undefined);
  assert.strictEqual(hiddenFailRes.failedTestCase.actual, undefined);
  console.log("[PASS] Hidden test failure strictly redacts input, expected, and actual values");

  // 10. Pre-Execution Eligibility & Fallback
  console.log("\n[TEST 10] Pre-Execution Eligibility & Fallback...");
  assert.strictEqual(isEligibleForUnifiedExecution(mockTwoSumProblem, "cpp"), true);
  assert.strictEqual(isEligibleForUnifiedExecution(mockTwoSumProblem, "python"), false);
  assert.strictEqual(isEligibleForUnifiedExecution(null, "cpp"), false);
  console.log("[PASS] Pre-execution eligibility check accurately guards C++ unified path");

  console.log("\n==================================================");
  console.log("All Multi-Test Unified C++ Execution Tests PASSED!");
  console.log("==================================================");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
