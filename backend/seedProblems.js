const mongoose = require("mongoose");
require("dotenv").config();

const Problem = require("./models/Problem");

const seedProblems = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected");

    // Prevent duplicate seed data
    await Problem.deleteMany({});

    const problems = [
      {
        title: "Two Sum",
        slug: "two-sum",
        description:
          "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target. You may assume that each input would have exactly one solution, and you may not use the same element twice. You can return the answer in any order.",

        difficulty: "Easy",

        tags: ["array", "hash-table"],

        starterCode: {
          javascript: `function twoSum(nums, target) {
  
}`,
          python: `def two_sum(nums, target):
    pass`,
          java: `class Solution {
    public int[] twoSum(int[] nums, int target) {
        
    }
}`,
          cpp: `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        
    }
};`
        },

        examples: [
          {
            input: "nums = [2, 7, 11, 15], target = 9",
            output: "[0, 1]",
            explanation: "Because nums[0] + nums[1] == 9, we return [0, 1]."
          },
          {
            input: "nums = [3, 2, 4], target = 6",
            output: "[1, 2]",
            explanation: "Because nums[1] + nums[2] == 6, we return [1, 2]."
          },
          {
            input: "nums = [3, 3], target = 6",
            output: "[0, 1]",
            explanation: "Because nums[0] + nums[1] == 6, we return [0, 1]."
          }
        ],

        constraints: [
          "2 <= nums.length <= 10^4",
          "-10^9 <= nums[i] <= 10^9",
          "-10^9 <= target <= 10^9",
          "Exactly one valid pair exists for each input.",
          "The same element cannot be used twice."
        ],

        execution: {
          functionName: "twoSum",
          parameters: ["nums", "target"]
        },

        outputComparator: "unordered_array",

        testCases: [
          // Visible Test Cases
          {
            input: {
              nums: [2, 7, 11, 15],
              target: 9
            },
            expectedOutput: [0, 1],
            isHidden: false
          },
          {
            input: {
              nums: [3, 2, 4],
              target: 6
            },
            expectedOutput: [1, 2],
            isHidden: false
          },
          {
            input: {
              nums: [3, 3],
              target: 6
            },
            expectedOutput: [0, 1],
            isHidden: false
          },

          // Hidden Test Cases
          // 1. Negative numbers & zero
          {
            input: {
              nums: [-3, 4, 3, 90],
              target: 0
            },
            expectedOutput: [0, 2],
            isHidden: true
          },
          // 2. Both negative numbers
          {
            input: {
              nums: [-10, -5, -20, -30],
              target: -15
            },
            expectedOutput: [0, 1],
            isHidden: true
          },
          // 3. Pair near the end of array
          {
            input: {
              nums: [1, 5, 8, 12, 19, 21, 25],
              target: 46
            },
            expectedOutput: [5, 6],
            isHidden: true
          },
          // 4. Duplicate numbers among non-matching values
          {
            input: {
              nums: [5, 7, 5, 2, 8],
              target: 10
            },
            expectedOutput: [0, 2],
            isHidden: true
          },
          // 5. Large array with solution separated across indices
          {
            input: {
              nums: [100, 250, 400, 15, 30, 80, 500, 75],
              target: 475
            },
            expectedOutput: [2, 7],
            isHidden: true
          }
        ]
      },
      {
        title: "Valid Palindrome",
        slug: "valid-palindrome",
        description:
          "Given a string, determine whether it reads the same forward and backward after converting all letters to lowercase and ignoring non-alphanumeric characters.",

        difficulty: "Easy",

        tags: ["string", "two-pointers"],

        starterCode: {
          javascript: `function isPalindrome(s) {

}`,
          python: `def is_palindrome(s):
    pass`,
          java: `class Solution {
    public boolean isPalindrome(String s) {

    }
}`,
          cpp: `class Solution {
public:
    bool isPalindrome(string s) {

    }
};`
        },

        examples: [
          {
            input: 's = "A man, a plan, a canal: Panama"',
            output: "true",
            explanation:
              'After removing non-alphanumeric characters and converting to lowercase, the string becomes "amanaplanacanalpanama", which is a palindrome.'
          },
          {
            input: 's = "race a car"',
            output: "false",
            explanation:
              'After normalization, the string becomes "raceacar", which is not a palindrome.'
          }
        ],

        constraints: [
          "1 <= s.length <= 2 * 10^5",
          "The string may contain letters, digits, spaces, and punctuation."
        ],

        execution: {
          functionName: "isPalindrome",
          parameters: ["s"]
        },

        outputComparator: "exact",

        testCases: [
          // Visible Test Cases
          {
            input: {
              s: "A man, a plan, a canal: Panama"
            },
            expectedOutput: true,
            isHidden: false
          },
          {
            input: {
              s: "race a car"
            },
            expectedOutput: false,
            isHidden: false
          },
          {
            input: {
              s: " "
            },
            expectedOutput: true,
            isHidden: false
          },

          // Hidden Test Cases
          {
            input: {
              s: "Madam"
            },
            expectedOutput: true,
            isHidden: true
          },
          {
            input: {
              s: "hello"
            },
            expectedOutput: false,
            isHidden: true
          },
          {
            input: {
              s: "0P"
            },
            expectedOutput: false,
            isHidden: true
          },
          {
            input: {
              s: "No 'x' in Nixon"
            },
            expectedOutput: true,
            isHidden: true
          },
          {
            input: {
              s: "12321"
            },
            expectedOutput: true,
            isHidden: true
          }
        ]
      },
      {
        title: "Longest Unique Substring",
        slug: "longest-unique-substring",
        difficulty: "Medium",
        tags: ["string", "sliding-window", "hash-table"],
        description:
          "Given a string s, return the length of the longest contiguous substring that contains no repeated characters.",
        constraints: [
          "0 <= s.length <= 10^5",
          "s consists of English letters, digits, symbols and spaces."
        ],
        examples: [
          {
            input: 's = "abcabcbb"',
            output: "3",
            explanation: 'The answer is "abc", with the length of 3.'
          },
          {
            input: 's = "bbbbb"',
            output: "1",
            explanation: 'The answer is "b", with the length of 1.'
          },
          {
            input: 's = "pwwkew"',
            output: "3",
            explanation: 'The answer is "wke", with the length of 3.'
          }
        ],
        starterCode: {
          javascript: `function lengthOfLongestSubstring(s) {
  // Write your code here
}`,
          python: `def lengthOfLongestSubstring(s: str) -> int:
    # Write your code here
    pass`,
          java: `class Solution {
    public int lengthOfLongestSubstring(String s) {
        // Write your code here
        return 0;
    }
}`,
          cpp: `class Solution {
public:
    int lengthOfLongestSubstring(string s) {
        // Write your code here
        return 0;
    }
};`
        },
        execution: {
          functionName: "lengthOfLongestSubstring",
          parameters: ["s"]
        },
        outputComparator: "exact",
        testCases: [
          // Visible
          {
            input: { s: "abcabcbb" },
            expectedOutput: 3,
            isHidden: false
          },
          {
            input: { s: "bbbbb" },
            expectedOutput: 1,
            isHidden: false
          },
          {
            input: { s: "pwwkew" },
            expectedOutput: 3,
            isHidden: false
          },
          // Hidden
          {
            input: { s: "" },
            expectedOutput: 0,
            isHidden: true
          },
          {
            input: { s: " " },
            expectedOutput: 1,
            isHidden: true
          },
          {
            input: { s: "au" },
            expectedOutput: 2,
            isHidden: true
          },
          {
            input: { s: "dvdf" },
            expectedOutput: 3,
            isHidden: true
          },
          {
            input: { s: "abba" },
            expectedOutput: 2,
            isHidden: true
          },
          {
            input: { s: "tmmzuxt" },
            expectedOutput: 5,
            isHidden: true
          }
        ]
      },
      {
        title: "Group Anagrams",
        slug: "group-anagrams",
        difficulty: "Medium",
        tags: ["array", "string", "hash-table", "sorting"],
        description:
          "Given an array of strings strs, group the anagrams together in any order. An anagram is a word formed by rearranging the letters of another word.",
        constraints: [
          "1 <= strs.length <= 10^4",
          "0 <= strs[i].length <= 100",
          "strs[i] consists of lowercase English letters."
        ],
        examples: [
          {
            input: 'strs = ["eat","tea","tan","ate","nat","bat"]',
            output: '[["bat"],["nat","tan"],["ate","eat","tea"]]',
            explanation: "Groups can be returned in any order."
          },
          {
            input: 'strs = [""]',
            output: '[[""]]',
            explanation: "An empty string forms its own group."
          },
          {
            input: 'strs = ["a"]',
            output: '[["a"]]',
            explanation: "A single character forms its own group."
          }
        ],
        starterCode: {
          javascript: `function groupAnagrams(strs) {
  // Write your code here
}`,
          python: `def groupAnagrams(strs: list[str]) -> list[list[str]]:
    # Write your code here
    pass`,
          java: `import java.util.*;

class Solution {
    public List<List<String>> groupAnagrams(String[] strs) {
        // Write your code here
        return new ArrayList<>();
    }
}`,
          cpp: `class Solution {
public:
    vector<vector<string>> groupAnagrams(vector<string>& strs) {
        // Write your code here
        return {};
    }
};`
        },
        execution: {
          functionName: "groupAnagrams",
          parameters: ["strs"]
        },
        outputComparator: "unordered_nested_array",
        testCases: [
          // Visible
          {
            input: {
              strs: ["eat", "tea", "tan", "ate", "nat", "bat"]
            },
            expectedOutput: [
              ["bat"],
              ["nat", "tan"],
              ["ate", "eat", "tea"]
            ],
            isHidden: false
          },
          {
            input: {
              strs: [""]
            },
            expectedOutput: [[""]],
            isHidden: false
          },
          {
            input: {
              strs: ["a"]
            },
            expectedOutput: [["a"]],
            isHidden: false
          },
          // Hidden
          {
            input: {
              strs: ["a", "b", "c"]
            },
            expectedOutput: [["a"], ["b"], ["c"]],
            isHidden: true
          },
          {
            input: {
              strs: ["stop", "pots", "tops", "opts", "post"]
            },
            expectedOutput: [["stop", "pots", "tops", "opts", "post"]],
            isHidden: true
          },
          {
            input: {
              strs: ["boo", "bob"]
            },
            expectedOutput: [["boo"], ["bob"]],
            isHidden: true
          },
          {
            input: {
              strs: ["", ""]
            },
            expectedOutput: [["", ""]],
            isHidden: true
          }
        ]
      },
      {
        title: "Trapping Rain Water",
        slug: "trapping-rain-water",
        difficulty: "Hard",
        tags: ["array", "two-pointers", "dynamic-programming", "stack"],
        description:
          "Given n non-negative integers representing an elevation map where the width of each bar is 1, compute how much water it can trap after raining.",
        constraints: [
          "n == height.length",
          "1 <= n <= 2 * 10^4",
          "0 <= height[i] <= 10^5"
        ],
        examples: [
          {
            input: "height = [0,1,0,2,1,0,1,3,2,1,2,1]",
            output: "6",
            explanation: "The elevation map traps 6 units of rain water."
          },
          {
            input: "height = [4,2,0,3,2,5]",
            output: "9",
            explanation: "The elevation map traps 9 units of rain water."
          }
        ],
        starterCode: {
          javascript: `function trap(height) {
  // Write your code here
}`,
          python: `def trap(height: list[int]) -> int:
    # Write your code here
    pass`,
          java: `class Solution {
    public int trap(int[] height) {
        // Write your code here
        return 0;
    }
}`,
          cpp: `class Solution {
public:
    int trap(vector<int>& height) {
        // Write your code here
        return 0;
    }
};`
        },
        execution: {
          functionName: "trap",
          parameters: ["height"]
        },
        outputComparator: "exact",
        testCases: [
          // Visible
          {
            input: {
              height: [0, 1, 0, 2, 1, 0, 1, 3, 2, 1, 2, 1]
            },
            expectedOutput: 6,
            isHidden: false
          },
          {
            input: {
              height: [4, 2, 0, 3, 2, 5]
            },
            expectedOutput: 9,
            isHidden: false
          },
          // Hidden
          {
            input: {
              height: [1]
            },
            expectedOutput: 0,
            isHidden: true
          },
          {
            input: {
              height: [2, 0, 2]
            },
            expectedOutput: 2,
            isHidden: true
          },
          {
            input: {
              height: [5, 4, 1, 2]
            },
            expectedOutput: 1,
            isHidden: true
          },
          {
            input: {
              height: [3, 0, 0, 2, 0, 4]
            },
            expectedOutput: 10,
            isHidden: true
          },
          {
            input: {
              height: [0, 2, 0]
            },
            expectedOutput: 0,
            isHidden: true
          },
          {
            input: {
              height: [5, 5, 5, 5]
            },
            expectedOutput: 0,
            isHidden: true
          }
        ]
      },
      {
        title: "Median of Two Sorted Arrays",
        slug: "median-of-two-sorted-arrays",
        difficulty: "Hard",
        tags: ["array", "binary-search", "divide-and-conquer"],
        description:
          "Given two sorted arrays nums1 and nums2 of size m and n respectively, return the median of the two sorted arrays. The overall runtime complexity should be O(log(m+n)).",
        constraints: [
          "nums1.length == m",
          "nums2.length == n",
          "0 <= m <= 1000",
          "0 <= n <= 1000",
          "1 <= m + n <= 2000",
          "-10^6 <= nums1[i], nums2[i] <= 10^6"
        ],
        examples: [
          {
            input: "nums1 = [1,3], nums2 = [2]",
            output: "2.0",
            explanation: "Merged array = [1,2,3] and the median is 2.0."
          },
          {
            input: "nums1 = [1,2], nums2 = [3,4]",
            output: "2.5",
            explanation: "Merged array = [1,2,3,4] and the median is 2.5."
          }
        ],
        starterCode: {
          javascript: `function findMedianSortedArrays(nums1, nums2) {
  // Write your code here
}`,
          python: `def findMedianSortedArrays(nums1: list[int], nums2: list[int]) -> float:
    # Write your code here
    pass`,
          java: `class Solution {
    public double findMedianSortedArrays(int[] nums1, int[] nums2) {
        // Write your code here
        return 0.0;
    }
}`,
          cpp: `class Solution {
public:
    double findMedianSortedArrays(
        vector<int>& nums1,
        vector<int>& nums2
    ) {
        // Write your code here
        return 0.0;
    }
};`
        },
        execution: {
          functionName: "findMedianSortedArrays",
          parameters: ["nums1", "nums2"]
        },
        outputComparator: "exact",
        testCases: [
          // Visible
          {
            input: {
              nums1: [1, 3],
              nums2: [2]
            },
            expectedOutput: 2.0,
            isHidden: false
          },
          {
            input: {
              nums1: [1, 2],
              nums2: [3, 4]
            },
            expectedOutput: 2.5,
            isHidden: false
          },
          // Hidden
          {
            input: {
              nums1: [],
              nums2: [1]
            },
            expectedOutput: 1.0,
            isHidden: true
          },
          {
            input: {
              nums1: [2],
              nums2: []
            },
            expectedOutput: 2.0,
            isHidden: true
          },
          {
            input: {
              nums1: [0, 0],
              nums2: [0, 0]
            },
            expectedOutput: 0.0,
            isHidden: true
          },
          {
            input: {
              nums1: [1, 2],
              nums2: [-1, 3]
            },
            expectedOutput: 1.5,
            isHidden: true
          },
          {
            input: {
              nums1: [1, 3, 8, 9, 15],
              nums2: [7, 11, 18, 19, 21, 25]
            },
            expectedOutput: 11.0,
            isHidden: true
          }
        ]
      }
    ];

    await Problem.insertMany(problems);

    console.log("Problems seeded successfully");

    await mongoose.connection.close();

    console.log("MongoDB connection closed");
  } catch (error) {
    console.error("Seeding error:", error);

    await mongoose.connection.close();
  }
};

seedProblems();