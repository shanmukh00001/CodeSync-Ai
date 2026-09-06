require("dotenv").config();
const { runProblem } = require("./services/problemTestRunnerService");

// Actual Seeded Problem Metadata Definitions (from backend/seedProblems.js)
const seededProblems = {
  twoSum: {
    title: "Two Sum",
    slug: "two-sum",
    execution: {
      functionName: "twoSum",
      parameters: ["nums", "target"]
    },
    outputComparator: "unordered_array",
    testCases: [
      // Visible (3)
      {
        input: { nums: [2, 7, 11, 15], target: 9 },
        expectedOutput: [0, 1],
        isHidden: false
      },
      {
        input: { nums: [3, 2, 4], target: 6 },
        expectedOutput: [1, 2],
        isHidden: false
      },
      {
        input: { nums: [3, 3], target: 6 },
        expectedOutput: [0, 1],
        isHidden: false
      },
      // Hidden (5)
      {
        input: { nums: [-3, 4, 3, 90], target: 0 },
        expectedOutput: [0, 2],
        isHidden: true
      },
      {
        input: { nums: [-10, -5, -20, -30], target: -15 },
        expectedOutput: [0, 1],
        isHidden: true
      },
      {
        input: { nums: [1, 5, 8, 12, 19, 21, 25], target: 46 },
        expectedOutput: [5, 6],
        isHidden: true
      },
      {
        input: { nums: [5, 7, 5, 2, 8], target: 10 },
        expectedOutput: [0, 2],
        isHidden: true
      },
      {
        input: { nums: [100, 250, 400, 15, 30, 80, 500, 75], target: 475 },
        expectedOutput: [2, 7],
        isHidden: true
      }
    ]
  },
  validPalindrome: {
    title: "Valid Palindrome",
    slug: "valid-palindrome",
    execution: {
      functionName: "isPalindrome",
      parameters: ["s"]
    },
    outputComparator: "exact",
    testCases: [
      {
        input: { s: "A man, a plan, a canal: Panama" },
        expectedOutput: true,
        isHidden: false
      },
      {
        input: { s: "race a car" },
        expectedOutput: false,
        isHidden: false
      },
      {
        input: { s: " " },
        expectedOutput: true,
        isHidden: false
      }
    ]
  },
  groupAnagrams: {
    title: "Group Anagrams",
    slug: "group-anagrams",
    execution: {
      functionName: "groupAnagrams",
      parameters: ["strs"]
    },
    outputComparator: "unordered_nested_array",
    testCases: [
      {
        input: { strs: ["eat", "tea", "tan", "ate", "nat", "bat"] },
        expectedOutput: [["bat"], ["nat", "tan"], ["ate", "eat", "tea"]],
        isHidden: false
      },
      {
        input: { strs: [""] },
        expectedOutput: [[""]],
        isHidden: false
      },
      {
        input: { strs: ["a"] },
        expectedOutput: [["a"]],
        isHidden: false
      }
    ]
  }
};

// C++ Solution implementations
const solutions = {
  twoSumCorrect: `
#include <vector>
#include <unordered_map>
using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> map;
        for (int i = 0; i < nums.size(); ++i) {
            int complement = target - nums[i];
            if (map.count(complement)) {
                return {map[complement], i};
            }
            map[nums[i]] = i;
        }
        return {};
    }
};`,

  twoSumWrong: `
#include <vector>
using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        // Intentionally returns wrong answer immediately
        return {999, 999};
    }
};`,

  twoSumFailsNegativeHidden: `
#include <vector>
#include <unordered_map>
using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        // Works for visible positive numbers, but fails on target <= 0 (hidden tests)
        if (target <= 0) {
            return {0, 0}; // Wrong on hidden negative test case
        }
        unordered_map<int, int> map;
        for (int i = 0; i < nums.size(); ++i) {
            int complement = target - nums[i];
            if (map.count(complement)) {
                return {map[complement], i};
            }
            map[nums[i]] = i;
        }
        return {};
    }
};`,

  validPalindromeCorrect: `
#include <string>
#include <cctype>
using namespace std;

class Solution {
public:
    bool isPalindrome(string s) {
        int left = 0, right = (int)s.length() - 1;
        while (left < right) {
            while (left < right && !isalnum((unsigned char)s[left])) left++;
            while (left < right && !isalnum((unsigned char)s[right])) right--;
            if (tolower((unsigned char)s[left]) != tolower((unsigned char)s[right])) {
                return false;
            }
            left++;
            right--;
        }
        return true;
    }
};`,

  groupAnagramsCorrect: `
#include <vector>
#include <string>
#include <unordered_map>
#include <algorithm>
using namespace std;

class Solution {
public:
    vector<vector<string>> groupAnagrams(vector<string>& strs) {
        unordered_map<string, vector<string>> mp;
        for (const string& s : strs) {
            string key = s;
            sort(key.begin(), key.end());
            mp[key].push_back(s);
        }
        vector<vector<string>> result;
        for (auto& p : mp) {
            result.push_back(p.second);
        }
        return result;
    }
};`,

  syntaxErrorSolution: `
class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        compilation_syntax_error_here!!
    }
};`,

  runtimeErrorSolution: `
#include <vector>
using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        int* ptr = nullptr;
        *ptr = 42; // SIGSEGV
        return {0, 1};
    }
};`
};

async function runTestSuite() {
  console.log("==================================================");
  console.log("Verifying Stage 4: ProblemTestRunnerService");
  console.log("==================================================");

  let passed = 0;
  let totalTests = 0;

  // TEST 1: Two Sum correct solution (includeHidden = false)
  totalTests++;
  try {
    console.log("\n[TEST 1] Two Sum - Correct Solution (includeHidden = false)...");
    const problem = seededProblems.twoSum;

    const result = await runProblem({
      problem,
      code: solutions.twoSumCorrect,
      includeHidden: false,
    });

    console.log("Summary:", {
      status: result.status,
      passedTestCases: result.passedTestCases,
      totalTestCases: result.totalTestCases,
      runtimeMs: result.runtimeMs,
      memoryKb: result.memoryKb,
    });

    if (result.status !== "accepted") {
      throw new Error(`Expected status 'accepted', got '${result.status}'`);
    }
    if (result.passedTestCases !== 3 || result.totalTestCases !== 3) {
      throw new Error(`Expected 3/3 passed test cases, got ${result.passedTestCases}/${result.totalTestCases}`);
    }
    if (result.testResults.some((t) => t.isHidden)) {
      throw new Error("Hidden tests should not have executed when includeHidden = false");
    }

    console.log("[PASS] Two Sum ran only visible tests (3/3) and passed with status 'accepted'");
    passed++;
  } catch (err) {
    console.error("[FAIL] TEST 1 failed:", err.message);
  }

  // TEST 2: Two Sum correct solution (includeHidden = true)
  totalTests++;
  try {
    console.log("\n[TEST 2] Two Sum - Correct Solution (includeHidden = true)...");
    const problem = seededProblems.twoSum;

    const result = await runProblem({
      problem,
      code: solutions.twoSumCorrect,
      includeHidden: true,
    });

    console.log("Summary:", {
      status: result.status,
      passedTestCases: result.passedTestCases,
      totalTestCases: result.totalTestCases,
      runtimeMs: result.runtimeMs,
      memoryKb: result.memoryKb,
    });

    if (result.status !== "accepted") {
      throw new Error(`Expected status 'accepted', got '${result.status}'`);
    }
    if (result.passedTestCases !== 8 || result.totalTestCases !== 8) {
      throw new Error(`Expected 8/8 passed test cases, got ${result.passedTestCases}/${result.totalTestCases}`);
    }

    const hiddenCount = result.testResults.filter((t) => t.isHidden).length;
    if (hiddenCount !== 5) {
      throw new Error(`Expected 5 hidden tests in result, found ${hiddenCount}`);
    }

    console.log("[PASS] Two Sum ran all visible + hidden tests (8/8) and passed with status 'accepted'");
    passed++;
  } catch (err) {
    console.error("[FAIL] TEST 2 failed:", err.message);
  }

  // TEST 3: Two Sum intentionally incorrect solution (wrong_answer + early termination)
  totalTests++;
  try {
    console.log("\n[TEST 3] Two Sum - Wrong Solution (early termination)...");
    const problem = seededProblems.twoSum;

    const result = await runProblem({
      problem,
      code: solutions.twoSumWrong,
      includeHidden: false,
    });

    console.log("Summary:", {
      status: result.status,
      passedTestCases: result.passedTestCases,
      totalTestCases: result.totalTestCases,
      executedCount: result.testResults.length,
      failedTestCase: result.failedTestCase,
    });

    if (result.status !== "wrong_answer") {
      throw new Error(`Expected status 'wrong_answer', got '${result.status}'`);
    }
    if (result.passedTestCases !== 0) {
      throw new Error(`Expected 0 passed test cases, got ${result.passedTestCases}`);
    }
    if (result.testResults.length !== 1) {
      throw new Error(`Expected early termination after 1 executed test, got ${result.testResults.length}`);
    }
    if (!result.failedTestCase || result.failedTestCase.testCaseIndex !== 0) {
      throw new Error("Expected failedTestCase metadata for test index 0");
    }

    console.log("[PASS] Wrong answer correctly triggered early termination on test 1");
    passed++;
  } catch (err) {
    console.error("[FAIL] TEST 3 failed:", err.message);
  }

  // TEST 4: Valid Palindrome multi-test execution
  totalTests++;
  try {
    console.log("\n[TEST 4] Valid Palindrome - Correct Solution (exact comparator)...");
    const problem = seededProblems.validPalindrome;

    const result = await runProblem({
      problem,
      code: solutions.validPalindromeCorrect,
      includeHidden: false,
    });

    console.log("Summary:", {
      status: result.status,
      passedTestCases: result.passedTestCases,
      totalTestCases: result.totalTestCases,
    });

    if (result.status !== "accepted" || result.passedTestCases !== 3) {
      throw new Error(`Expected 3/3 passed tests, got ${result.passedTestCases}`);
    }

    console.log("[PASS] Valid Palindrome passed all visible test cases");
    passed++;
  } catch (err) {
    console.error("[FAIL] TEST 4 failed:", err.message);
  }

  // TEST 5: Group Anagrams multi-test execution
  totalTests++;
  try {
    console.log("\n[TEST 5] Group Anagrams - Correct Solution (unordered_nested_array)...");
    const problem = seededProblems.groupAnagrams;

    const result = await runProblem({
      problem,
      code: solutions.groupAnagramsCorrect,
      includeHidden: false,
    });

    console.log("Summary:", {
      status: result.status,
      passedTestCases: result.passedTestCases,
      totalTestCases: result.totalTestCases,
    });

    if (result.status !== "accepted" || result.passedTestCases !== 3) {
      throw new Error(`Expected 3/3 passed tests, got ${result.passedTestCases}`);
    }

    console.log("[PASS] Group Anagrams passed all visible test cases");
    passed++;
  } catch (err) {
    console.error("[FAIL] TEST 5 failed:", err.message);
  }

  // TEST 6: Compilation error & early termination
  totalTests++;
  try {
    console.log("\n[TEST 6] Compilation Error - Handling & early termination...");
    const problem = seededProblems.twoSum;

    const result = await runProblem({
      problem,
      code: solutions.syntaxErrorSolution,
      includeHidden: false,
    });

    console.log("Summary:", {
      status: result.status,
      passedTestCases: result.passedTestCases,
      executedCount: result.testResults.length,
      error: result.error?.split("\n")[0],
    });

    if (result.status !== "compilation_error") {
      throw new Error(`Expected status 'compilation_error', got '${result.status}'`);
    }
    if (result.testResults.length !== 1) {
      throw new Error(`Expected 1 executed test before early termination, got ${result.testResults.length}`);
    }

    console.log("[PASS] Compilation error caused early termination on test 1");
    passed++;
  } catch (err) {
    console.error("[FAIL] TEST 6 failed:", err.message);
  }

  // TEST 7: Runtime error & early termination
  totalTests++;
  try {
    console.log("\n[TEST 7] Runtime Error - Handling & early termination...");
    const problem = seededProblems.twoSum;

    const result = await runProblem({
      problem,
      code: solutions.runtimeErrorSolution,
      includeHidden: false,
    });

    console.log("Summary:", {
      status: result.status,
      passedTestCases: result.passedTestCases,
      executedCount: result.testResults.length,
      error: result.error,
    });

    if (result.status !== "runtime_error") {
      throw new Error(`Expected status 'runtime_error', got '${result.status}'`);
    }
    if (result.testResults.length !== 1) {
      throw new Error(`Expected 1 executed test before early termination, got ${result.testResults.length}`);
    }

    console.log("[PASS] Runtime error caused early termination on test 1");
    passed++;
  } catch (err) {
    console.error("[FAIL] TEST 7 failed:", err.message);
  }

  // TEST 8: Hidden test failure & privacy preservation
  totalTests++;
  try {
    console.log("\n[TEST 8] Hidden test failure & privacy verification...");
    const problem = seededProblems.twoSum;

    const result = await runProblem({
      problem,
      code: solutions.twoSumFailsNegativeHidden,
      includeHidden: true,
    });

    console.log("Summary:", {
      status: result.status,
      passedTestCases: result.passedTestCases,
      totalTestCases: result.totalTestCases,
      executedCount: result.testResults.length,
      failedTestCase: result.failedTestCase,
    });

    if (result.status !== "wrong_answer") {
      throw new Error(`Expected status 'wrong_answer', got '${result.status}'`);
    }
    // 3 visible tests should pass, then fails on 4th test (first hidden test: index 3)
    if (result.passedTestCases !== 3) {
      throw new Error(`Expected 3 passed visible tests, got ${result.passedTestCases}`);
    }
    if (result.testResults.length !== 4) {
      throw new Error(`Expected 4 tests executed before early termination, got ${result.testResults.length}`);
    }

    // Verify privacy: failedTestCase for hidden test must NOT leak input/expected/actual
    if (!result.failedTestCase || !result.failedTestCase.isHidden) {
      throw new Error("failedTestCase should be marked isHidden: true");
    }
    if ("input" in result.failedTestCase || "expected" in result.failedTestCase || "actual" in result.failedTestCase) {
      throw new Error("Hidden test failure leaked input, expected, or actual data in failedTestCase!");
    }

    const failedHiddenResult = result.testResults[3];
    if ("input" in failedHiddenResult || "expectedOutput" in failedHiddenResult || "actualOutput" in failedHiddenResult) {
      throw new Error("Hidden test failure leaked input/expected/actual data in testResults array!");
    }

    console.log("[PASS] Hidden failure stopped execution and redacted hidden input/output correctly");
    passed++;
  } catch (err) {
    console.error("[FAIL] TEST 8 failed:", err.message);
  }

  console.log("\n==================================================");
  console.log(`Verification finished: ${passed}/${totalTests} tests passed successfully.`);
  console.log("==================================================");

  if (passed !== totalTests) {
    process.exit(1);
  }
}

runTestSuite();
