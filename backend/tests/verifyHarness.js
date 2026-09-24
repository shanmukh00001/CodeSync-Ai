const { generateCppHarness } = require("./services/cppHarnessService");

// Starter solution implementations for all 6 seeded problems
const problemsData = [
  {
    title: "Two Sum",
    slug: "two-sum",
    execution: {
      functionName: "twoSum",
      parameters: ["nums", "target"]
    },
    outputComparator: "unordered_array",
    solutionCode: `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        return {0, 1};
    }
};`,
    testCase: {
      input: {
        nums: [2, 7, 11, 15],
        target: 9
      },
      expectedOutput: [0, 1]
    }
  },
  {
    title: "Valid Palindrome",
    slug: "valid-palindrome",
    execution: {
      functionName: "isPalindrome",
      parameters: ["s"]
    },
    outputComparator: "exact",
    solutionCode: `class Solution {
public:
    bool isPalindrome(string s) {
        return true;
    }
};`,
    testCase: {
      input: {
        s: "A man, a \"plan\", a \\canal: Panama\\n"
      },
      expectedOutput: true
    }
  },
  {
    title: "Longest Unique Substring",
    slug: "longest-unique-substring",
    execution: {
      functionName: "lengthOfLongestSubstring",
      parameters: ["s"]
    },
    outputComparator: "exact",
    solutionCode: `class Solution {
public:
    int lengthOfLongestSubstring(string s) {
        return 3;
    }
};`,
    testCase: {
      input: {
        s: "abcabcbb"
      },
      expectedOutput: 3
    }
  },
  {
    title: "Group Anagrams",
    slug: "group-anagrams",
    execution: {
      functionName: "groupAnagrams",
      parameters: ["strs"]
    },
    outputComparator: "unordered_nested_array",
    solutionCode: `class Solution {
public:
    vector<vector<string>> groupAnagrams(vector<string>& strs) {
        return {{"bat"}, {"nat", "tan"}, {"ate", "eat", "tea"}};
    }
};`,
    testCase: {
      input: {
        strs: ["eat", "tea", "tan", "ate", "nat", "bat"]
      },
      expectedOutput: [["bat"], ["nat", "tan"], ["ate", "eat", "tea"]]
    }
  },
  {
    title: "Trapping Rain Water",
    slug: "trapping-rain-water",
    execution: {
      functionName: "trap",
      parameters: ["height"]
    },
    outputComparator: "exact",
    solutionCode: `class Solution {
public:
    int trap(vector<int>& height) {
        return 6;
    }
};`,
    testCase: {
      input: {
        height: [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]
      },
      expectedOutput: 6
    }
  },
  {
    title: "Median of Two Sorted Arrays",
    slug: "median-of-two-sorted-arrays",
    execution: {
      functionName: "findMedianSortedArrays",
      parameters: ["nums1", "nums2"]
    },
    outputComparator: "exact",
    solutionCode: `class Solution {
public:
    double findMedianSortedArrays(vector<int>& nums1, vector<int>& nums2) {
        return 2.0;
    }
};`,
    testCase: {
      input: {
        nums1: [1, 3],
        nums2: [2]
      },
      expectedOutput: 2.0
    }
  }
];

function runVerification() {
  console.log("==================================================");
  console.log("Verifying C++ Harness Generator for all 6 Seeded Problems");
  console.log("==================================================");

  let passed = 0;

  for (const prob of problemsData) {
    try {
      const result = generateCppHarness({
        solutionCode: prob.solutionCode,
        problem: prob,
        testCase: prob.testCase
      });

      if (!result.source || !result.metadata) {
        throw new Error(`Missing source or metadata in output for ${prob.title}`);
      }

      console.log(`[PASS] ${prob.title} (${prob.slug})`);
      console.log(`       Target Function: solver.${result.metadata.functionName}(${result.metadata.parameters.join(", ")})`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${prob.title}:`, err.message);
    }
  }

  // Edge case tests
  console.log("\nTesting Edge Cases & Validation:");

  try {
    generateCppHarness({
      solutionCode: "",
      problem: problemsData[0],
      testCase: problemsData[0].testCase
    });
    console.error("[FAIL] Empty solutionCode should have thrown error");
  } catch (err) {
    console.log("[PASS] Rejected empty solutionCode:", err.message);
  }

  try {
    generateCppHarness({
      solutionCode: "class Solution {};",
      problem: problemsData[0],
      testCase: { input: { nums: [1, 2] } } // missing 'target'
    });
    console.error("[FAIL] Missing parameter in testCase input should have thrown error");
  } catch (err) {
    console.log("[PASS] Rejected missing parameter:", err.message);
  }

  console.log(`\nVerification finished: ${passed}/${problemsData.length} problems verified successfully.`);
}

runVerification();
