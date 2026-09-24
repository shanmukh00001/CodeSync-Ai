require("dotenv").config();
const { executeTestCase } = require("./services/testCaseExecutionService");
const { compareOutput, parseHarnessOutput } = require("./services/outputComparatorService");

// Actual Seeded Problems Definitions (matching backend/seedProblems.js)
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
        input: { nums: [-3, 4, 3, 90], target: 0 },
        expectedOutput: [0, 2],
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
        // Intentionally returns wrong answer
        return {99, 99};
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

  groupAnagramsCorrectDifferentOrdering: `
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
        // Group and return in hash map iteration order (arbitrary order)
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
        this_is_an_invalid_syntax_error;
    }
};`,

  runtimeErrorSolution: `
class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        int* p = nullptr;
        *p = 42; // SIGSEGV
        return {0, 1};
    }
};`
};

async function runTestSuite() {
  console.log("==================================================");
  console.log("Verifying Stage 3: TestCaseExecutionService & Comparator");
  console.log("==================================================");

  let passed = 0;
  let totalTests = 0;

  // TEST 1: Two Sum (Correct solution, unordered_array comparator)
  totalTests++;
  try {
    console.log("\n[TEST 1] Two Sum - Correct Solution (unordered_array comparator)...");
    const problem = seededProblems.twoSum;
    const testCase = problem.testCases[0];

    const result = await executeTestCase({
      problem,
      code: solutions.twoSumCorrect,
      testCase,
    });

    console.log("Result:", {
      status: result.status,
      passed: result.passed,
      actual: result.actual,
      expected: result.expected,
      runtimeMs: result.execution?.runtimeMs,
      memoryKb: result.execution?.memoryKb,
    });

    if (result.status !== "passed" || !result.passed) {
      throw new Error(`Expected status 'passed', got '${result.status}' (passed: ${result.passed})`);
    }

    console.log("[PASS] Two Sum executed and passed with unordered_array comparator");
    passed++;
  } catch (err) {
    console.error("[FAIL] TEST 1 failed:", err.message);
  }

  // TEST 2: Two Sum (Wrong solution -> wrong_answer)
  totalTests++;
  try {
    console.log("\n[TEST 2] Two Sum - Intentionally Incorrect Solution...");
    const problem = seededProblems.twoSum;
    const testCase = problem.testCases[0];

    const result = await executeTestCase({
      problem,
      code: solutions.twoSumWrong,
      testCase,
    });

    console.log("Result:", {
      status: result.status,
      passed: result.passed,
      actual: result.actual,
      expected: result.expected,
    });

    if (result.status !== "wrong_answer" || result.passed !== false) {
      throw new Error(`Expected status 'wrong_answer' and passed: false, got '${result.status}' (${result.passed})`);
    }

    console.log("[PASS] Correctly detected wrong_answer on incorrect return values");
    passed++;
  } catch (err) {
    console.error("[FAIL] TEST 2 failed:", err.message);
  }

  // TEST 3: Valid Palindrome (Correct solution, exact comparator)
  totalTests++;
  try {
    console.log("\n[TEST 3] Valid Palindrome - Correct Solution (exact comparator)...");
    const problem = seededProblems.validPalindrome;
    const testCase = problem.testCases[0];

    const result = await executeTestCase({
      problem,
      code: solutions.validPalindromeCorrect,
      testCase,
    });

    console.log("Result:", {
      status: result.status,
      passed: result.passed,
      actual: result.actual,
      expected: result.expected,
      runtimeMs: result.execution?.runtimeMs,
    });

    if (result.status !== "passed" || !result.passed) {
      throw new Error(`Expected status 'passed', got '${result.status}'`);
    }

    console.log("[PASS] Valid Palindrome executed and passed with exact boolean comparator");
    passed++;
  } catch (err) {
    console.error("[FAIL] TEST 3 failed:", err.message);
  }

  // TEST 4: Group Anagrams (unordered_nested_array comparator)
  totalTests++;
  try {
    console.log("\n[TEST 4] Group Anagrams - Correct Solution (unordered_nested_array)...");
    const problem = seededProblems.groupAnagrams;
    const testCase = problem.testCases[0];

    const result = await executeTestCase({
      problem,
      code: solutions.groupAnagramsCorrectDifferentOrdering,
      testCase,
    });

    console.log("Result:", {
      status: result.status,
      passed: result.passed,
      actual: result.actual,
      expected: result.expected,
    });

    if (result.status !== "passed" || !result.passed) {
      throw new Error(`Expected status 'passed', got '${result.status}'`);
    }

    console.log("[PASS] Group Anagrams passed with nested 2D unordered comparator");
    passed++;
  } catch (err) {
    console.error("[FAIL] TEST 4 failed:", err.message);
  }

  // TEST 5: Compilation Error
  totalTests++;
  try {
    console.log("\n[TEST 5] Compilation Error handling...");
    const problem = seededProblems.twoSum;
    const testCase = problem.testCases[0];

    const result = await executeTestCase({
      problem,
      code: solutions.syntaxErrorSolution,
      testCase,
    });

    console.log("Result:", {
      status: result.status,
      passed: result.passed,
      error: result.error?.split("\n")[0],
    });

    if (result.status !== "compilation_error" || result.passed !== false) {
      throw new Error(`Expected status 'compilation_error', got '${result.status}'`);
    }

    console.log("[PASS] Handled syntax error cleanly without invoking comparator");
    passed++;
  } catch (err) {
    console.error("[FAIL] TEST 5 failed:", err.message);
  }

  // TEST 6: Runtime Error (Crash / SIGSEGV)
  totalTests++;
  try {
    console.log("\n[TEST 6] Runtime Error handling (SIGSEGV / crash)...");
    const problem = seededProblems.twoSum;
    const testCase = problem.testCases[0];

    const result = await executeTestCase({
      problem,
      code: solutions.runtimeErrorSolution,
      testCase,
    });

    console.log("Result:", {
      status: result.status,
      passed: result.passed,
      error: result.error,
    });

    if (result.status !== "runtime_error" || result.passed !== false) {
      throw new Error(`Expected status 'runtime_error', got '${result.status}'`);
    }

    console.log("[PASS] Handled runtime crash cleanly without invoking comparator");
    passed++;
  } catch (err) {
    console.error("[FAIL] TEST 6 failed:", err.message);
  }

  // TEST 7: Hidden Test Flag Preservation
  totalTests++;
  try {
    console.log("\n[TEST 7] Hidden test case execution & privacy flag preservation...");
    const problem = seededProblems.twoSum;
    const hiddenTestCase = problem.testCases[2]; // isHidden: true

    const result = await executeTestCase({
      problem,
      code: solutions.twoSumCorrect,
      testCase: hiddenTestCase,
    });

    if (result.isHidden !== true || result.status !== "passed") {
      throw new Error(`Expected isHidden: true and status: 'passed', got isHidden: ${result.isHidden}, status: ${result.status}`);
    }

    console.log("[PASS] Hidden test execution preserved isHidden flag accurately");
    passed++;
  } catch (err) {
    console.error("[FAIL] TEST 7 failed:", err.message);
  }

  console.log("\n==================================================");
  console.log(`Verification finished: ${passed}/${totalTests} tests passed successfully.`);
  console.log("==================================================");

  if (passed !== totalTests) {
    process.exit(1);
  }
}

runTestSuite();
