const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
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
      },
      // ==========================================
      // BATCH 1: Arrays & Hashing
      // ==========================================
      {
        title: "Contains Duplicate",
        slug: "contains-duplicate",
        difficulty: "Easy",
        tags: ["array", "hash-table", "sorting"],
        description:
          "Given an integer array nums, return true if any value appears at least twice in the array, and return false if every element is distinct.",
        constraints: [
          "1 <= nums.length <= 10^5",
          "-10^9 <= nums[i] <= 10^9"
        ],
        examples: [
          {
            input: "nums = [1,2,3,1]",
            output: "true",
            explanation: "The element 1 occurs at indices 0 and 3."
          },
          {
            input: "nums = [1,2,3,4]",
            output: "false",
            explanation: "All elements are distinct."
          },
          {
            input: "nums = [1,1,1,3,3,4,3,2,4,2]",
            output: "true",
            explanation: "Multiple elements appear more than once."
          }
        ],
        starterCode: {
          javascript: `function containsDuplicate(nums) {
  // Write your code here
}`,
          python: `def contains_duplicate(nums: list[int]) -> bool:
    # Write your code here
    pass`,
          java: `class Solution {
    public boolean containsDuplicate(int[] nums) {
        // Write your code here
        return false;
    }
}`,
          cpp: `class Solution {
public:
    bool containsDuplicate(vector<int>& nums) {
        // Write your code here
        return false;
    }
};`
        },
        execution: {
          functionName: "containsDuplicate",
          parameters: ["nums"]
        },
        outputComparator: "exact",
        testCases: [
          // Visible
          {
            input: { nums: [1, 2, 3, 1] },
            expectedOutput: true,
            isHidden: false
          },
          {
            input: { nums: [1, 2, 3, 4] },
            expectedOutput: false,
            isHidden: false
          },
          {
            input: { nums: [1, 1, 1, 3, 3, 4, 3, 2, 4, 2] },
            expectedOutput: true,
            isHidden: false
          },
          // Hidden
          {
            input: { nums: [1] },
            expectedOutput: false,
            isHidden: true
          },
          {
            input: { nums: [0, 0] },
            expectedOutput: true,
            isHidden: true
          },
          {
            input: { nums: [-1, -2, -3, -1] },
            expectedOutput: true,
            isHidden: true
          },
          {
            input: { nums: [-1, -2, -3, -4] },
            expectedOutput: false,
            isHidden: true
          },
          {
            input: { nums: [1000000000, -1000000000, 1000000000] },
            expectedOutput: true,
            isHidden: true
          }
        ]
      },
      {
        title: "Valid Anagram",
        slug: "valid-anagram",
        difficulty: "Easy",
        tags: ["string", "hash-table", "sorting"],
        description:
          "Given two strings s and t, return true if t is an anagram of s, and false otherwise. An anagram is a word or phrase formed by rearranging the letters of a different word or phrase, typically using all the original letters exactly once.",
        constraints: [
          "1 <= s.length, t.length <= 5 * 10^4",
          "s and t consist of lowercase English letters."
        ],
        examples: [
          {
            input: 's = "anagram", t = "nagaram"',
            output: "true",
            explanation: "Both strings have the exact same frequencies of characters."
          },
          {
            input: 's = "rat", t = "car"',
            output: "false",
            explanation: 'Character "r" and "a" exist in both, but "t" and "c" do not match.'
          }
        ],
        starterCode: {
          javascript: `function isAnagram(s, t) {
  // Write your code here
}`,
          python: `def is_anagram(s: str, t: str) -> bool:
    # Write your code here
    pass`,
          java: `class Solution {
    public boolean isAnagram(String s, String t) {
        // Write your code here
        return false;
    }
}`,
          cpp: `class Solution {
public:
    bool isAnagram(string s, string t) {
        // Write your code here
        return false;
    }
};`
        },
        execution: {
          functionName: "isAnagram",
          parameters: ["s", "t"]
        },
        outputComparator: "exact",
        testCases: [
          // Visible
          {
            input: { s: "anagram", t: "nagaram" },
            expectedOutput: true,
            isHidden: false
          },
          {
            input: { s: "rat", t: "car" },
            expectedOutput: false,
            isHidden: false
          },
          // Hidden
          {
            input: { s: "a", t: "a" },
            expectedOutput: true,
            isHidden: true
          },
          {
            input: { s: "a", t: "b" },
            expectedOutput: false,
            isHidden: true
          },
          {
            input: { s: "ab", t: "a" },
            expectedOutput: false,
            isHidden: true
          },
          {
            input: { s: "listen", t: "silent" },
            expectedOutput: true,
            isHidden: true
          },
          {
            input: { s: "aabbcc", t: "abcabc" },
            expectedOutput: true,
            isHidden: true
          },
          {
            input: { s: "aaabbb", t: "aabbbb" },
            expectedOutput: false,
            isHidden: true
          }
        ]
      },
      {
        title: "Product of Array Except Self",
        slug: "product-of-array-except-self",
        difficulty: "Medium",
        tags: ["array", "prefix-sum"],
        description:
          "Given an integer array nums, return an array answer such that answer[i] is equal to the product of all the elements of nums except nums[i]. The product of any prefix or suffix of nums is guaranteed to fit in a 32-bit integer. You must write an algorithm that runs in O(n) time and without using the division operation.",
        constraints: [
          "2 <= nums.length <= 10^5",
          "-30 <= nums[i] <= 30",
          "The product of any prefix or suffix of nums is guaranteed to fit in a 32-bit integer."
        ],
        examples: [
          {
            input: "nums = [1,2,3,4]",
            output: "[24,12,8,6]",
            explanation: "For index 0: 2*3*4 = 24. Index 1: 1*3*4 = 12. Index 2: 1*2*4 = 8. Index 3: 1*2*3 = 6."
          },
          {
            input: "nums = [-1,1,0,-3,3]",
            output: "[0,0,9,0,0]",
            explanation: "Any product containing 0 becomes 0, except for index 2 where 0 is excluded."
          }
        ],
        starterCode: {
          javascript: `function productExceptSelf(nums) {
  // Write your code here
}`,
          python: `def product_except_self(nums: list[int]) -> list[int]:
    # Write your code here
    pass`,
          java: `class Solution {
    public int[] productExceptSelf(int[] nums) {
        // Write your code here
        return new int[]{};
    }
}`,
          cpp: `class Solution {
public:
    vector<int> productExceptSelf(vector<int>& nums) {
        // Write your code here
        return {};
    }
};`
        },
        execution: {
          functionName: "productExceptSelf",
          parameters: ["nums"]
        },
        outputComparator: "exact",
        testCases: [
          // Visible
          {
            input: { nums: [1, 2, 3, 4] },
            expectedOutput: [24, 12, 8, 6],
            isHidden: false
          },
          {
            input: { nums: [-1, 1, 0, -3, 3] },
            expectedOutput: [0, 0, 9, 0, 0],
            isHidden: false
          },
          // Hidden
          {
            input: { nums: [2, 3] },
            expectedOutput: [3, 2],
            isHidden: true
          },
          {
            input: { nums: [0, 0] },
            expectedOutput: [0, 0],
            isHidden: true
          },
          {
            input: { nums: [1, 0] },
            expectedOutput: [0, 1],
            isHidden: true
          },
          {
            input: { nums: [5, 4, 3, 2, 1] },
            expectedOutput: [24, 30, 40, 60, 120],
            isHidden: true
          },
          {
            input: { nums: [-1, -2, -3, -4] },
            expectedOutput: [-24, -12, -8, -6],
            isHidden: true
          }
        ]
      },
      {
        title: "Top K Frequent Elements",
        slug: "top-k-frequent-elements",
        difficulty: "Medium",
        tags: ["array", "hash-table", "sorting", "heap", "bucket-sort"],
        description:
          "Given an integer array nums and an integer k, return the k most frequent elements. You may return the answer in any order.",
        constraints: [
          "1 <= nums.length <= 10^5",
          "-10^4 <= nums[i] <= 10^4",
          "k is in the range [1, the number of unique elements in the array].",
          "It is guaranteed that the answer is unique."
        ],
        examples: [
          {
            input: "nums = [1,1,1,2,2,3], k = 2",
            output: "[1,2]",
            explanation: "1 occurs three times, 2 occurs twice, and 3 occurs once. The two most frequent elements are 1 and 2."
          },
          {
            input: "nums = [1], k = 1",
            output: "[1]",
            explanation: "1 is the only element, so it is the most frequent."
          }
        ],
        starterCode: {
          javascript: `function topKFrequent(nums, k) {
  // Write your code here
}`,
          python: `def top_k_frequent(nums: list[int], k: int) -> list[int]:
    # Write your code here
    pass`,
          java: `import java.util.*;

class Solution {
    public int[] topKFrequent(int[] nums, int k) {
        // Write your code here
        return new int[]{};
    }
}`,
          cpp: `class Solution {
public:
    vector<int> topKFrequent(vector<int>& nums, int k) {
        // Write your code here
        return {};
    }
};`
        },
        execution: {
          functionName: "topKFrequent",
          parameters: ["nums", "k"]
        },
        outputComparator: "unordered_array",
        testCases: [
          // Visible
          {
            input: { nums: [1, 1, 1, 2, 2, 3], k: 2 },
            expectedOutput: [1, 2],
            isHidden: false
          },
          {
            input: { nums: [1], k: 1 },
            expectedOutput: [1],
            isHidden: false
          },
          // Hidden
          {
            input: { nums: [4, 4, 4, 6, 6, 7, 7, 7, 7], k: 1 },
            expectedOutput: [7],
            isHidden: true
          },
          {
            input: { nums: [1, 2], k: 2 },
            expectedOutput: [1, 2],
            isHidden: true
          },
          {
            input: { nums: [-1, -1, -2, -2, -2, -3], k: 2 },
            expectedOutput: [-2, -1],
            isHidden: true
          },
          {
            input: { nums: [3, 0, 1, 0], k: 1 },
            expectedOutput: [0],
            isHidden: true
          },
          {
            input: { nums: [5, 5, 5, 2, 2, 3, 3, 3, 3], k: 2 },
            expectedOutput: [3, 5],
            isHidden: true
          }
        ]
      },
      // ==========================================
      // BATCH 2: Two Pointers & Sliding Window
      // ==========================================
      {
        title: "Best Time to Buy and Sell Stock",
        slug: "best-time-to-buy-and-sell-stock",
        difficulty: "Easy",
        tags: ["array", "dynamic-programming", "sliding-window"],
        description:
          "You are given an array prices where prices[i] is the price of a given stock on the ith day. You want to maximize your profit by choosing a single day to buy one stock and choosing a different day in the future to sell that stock. Return the maximum profit you can achieve from this transaction. If you cannot achieve any profit, return 0.",
        constraints: [
          "1 <= prices.length <= 10^5",
          "0 <= prices[i] <= 10^4"
        ],
        examples: [
          {
            input: "prices = [7,1,5,3,6,4]",
            output: "5",
            explanation: "Buy on day 2 (price = 1) and sell on day 5 (price = 6), profit = 6 - 1 = 5."
          },
          {
            input: "prices = [7,6,4,3,1]",
            output: "0",
            explanation: "In this case, no transactions are done and the max profit = 0."
          }
        ],
        starterCode: {
          javascript: `function maxProfit(prices) {
  // Write your code here
}`,
          python: `def max_profit(prices: list[int]) -> int:
    # Write your code here
    pass`,
          java: `class Solution {
    public int maxProfit(int[] prices) {
        // Write your code here
        return 0;
    }
}`,
          cpp: `class Solution {
public:
    int maxProfit(vector<int>& prices) {
        // Write your code here
        return 0;
    }
};`
        },
        execution: {
          functionName: "maxProfit",
          parameters: ["prices"]
        },
        outputComparator: "exact",
        testCases: [
          // Visible
          {
            input: { prices: [7, 1, 5, 3, 6, 4] },
            expectedOutput: 5,
            isHidden: false
          },
          {
            input: { prices: [7, 6, 4, 3, 1] },
            expectedOutput: 0,
            isHidden: false
          },
          // Hidden
          {
            input: { prices: [1] },
            expectedOutput: 0,
            isHidden: true
          },
          {
            input: { prices: [1, 2] },
            expectedOutput: 1,
            isHidden: true
          },
          {
            input: { prices: [2, 1] },
            expectedOutput: 0,
            isHidden: true
          },
          {
            input: { prices: [2, 4, 1] },
            expectedOutput: 2,
            isHidden: true
          },
          {
            input: { prices: [3, 2, 6, 5, 0, 3] },
            expectedOutput: 4,
            isHidden: true
          },
          {
            input: { prices: [1, 2, 4, 2, 5, 7, 2, 4, 9, 0] },
            expectedOutput: 8,
            isHidden: true
          }
        ]
      },
      {
        title: "3Sum",
        slug: "3sum",
        difficulty: "Medium",
        tags: ["array", "two-pointers", "sorting"],
        description:
          "Given an integer array nums, return all the triplets [nums[i], nums[j], nums[k]] such that i != j, i != k, and j != k, and nums[i] + nums[j] + nums[k] == 0. Notice that the solution set must not contain duplicate triplets.",
        constraints: [
          "3 <= nums.length <= 3000",
          "-10^5 <= nums[i] <= 10^5"
        ],
        examples: [
          {
            input: "nums = [-1,0,1,2,-1,-4]",
            output: "[[-1,-1,2],[-1,0,1]]",
            explanation: "The distinct triplets that sum to 0 are [-1,0,1] and [-1,-1,2]."
          },
          {
            input: "nums = [0,1,1]",
            output: "[]",
            explanation: "The only possible triplet does not sum up to 0."
          },
          {
            input: "nums = [0,0,0]",
            output: "[[0,0,0]]",
            explanation: "The only possible triplet sums up to 0."
          }
        ],
        starterCode: {
          javascript: `function threeSum(nums) {
  // Write your code here
}`,
          python: `def three_sum(nums: list[int]) -> list[list[int]]:
    # Write your code here
    pass`,
          java: `import java.util.*;

class Solution {
    public List<List<Integer>> threeSum(int[] nums) {
        // Write your code here
        return new ArrayList<>();
    }
}`,
          cpp: `class Solution {
public:
    vector<vector<int>> threeSum(vector<int>& nums) {
        // Write your code here
        return {};
    }
};`
        },
        execution: {
          functionName: "threeSum",
          parameters: ["nums"]
        },
        outputComparator: "unordered_nested_array",
        testCases: [
          // Visible
          {
            input: { nums: [-1, 0, 1, 2, -1, -4] },
            expectedOutput: [[-1, -1, 2], [-1, 0, 1]],
            isHidden: false
          },
          {
            input: { nums: [0, 1, 1] },
            expectedOutput: [],
            isHidden: false
          },
          {
            input: { nums: [0, 0, 0] },
            expectedOutput: [[0, 0, 0]],
            isHidden: false
          },
          // Hidden
          {
            input: { nums: [0, 0, 0, 0] },
            expectedOutput: [[0, 0, 0]],
            isHidden: true
          },
          {
            input: { nums: [-2, 0, 1, 1, 2] },
            expectedOutput: [[-2, 0, 2], [-2, 1, 1]],
            isHidden: true
          },
          {
            input: { nums: [-1, 0, 1, 0] },
            expectedOutput: [[-1, 0, 1]],
            isHidden: true
          },
          {
            input: { nums: [-4, -2, -2, -2, 0, 1, 2, 2, 2, 3, 3, 4, 4, 6, 6] },
            expectedOutput: [[-4, -2, 6], [-4, 0, 4], [-4, 1, 3], [-4, 2, 2], [-2, -2, 4], [-2, 0, 2]],
            isHidden: true
          }
        ]
      },
      {
        title: "Container With Most Water",
        slug: "container-with-most-water",
        difficulty: "Medium",
        tags: ["array", "two-pointers", "greedy"],
        description:
          "You are given an integer array height of length n. There are n vertical lines drawn such that the two endpoints of the ith line are (i, 0) and (i, height[i]). Find two lines that together with the x-axis form a container, such that the container contains the most water. Return the maximum amount of water a container can store. Notice that you may not slant the container.",
        constraints: [
          "n == height.length",
          "2 <= n <= 10^5",
          "0 <= height[i] <= 10^4"
        ],
        examples: [
          {
            input: "height = [1,8,6,2,5,4,8,3,7]",
            output: "49",
            explanation: "The vertical lines are represented by array [1,8,6,2,5,4,8,3,7]. In this case, the max area of water the container can contain is 49."
          },
          {
            input: "height = [1,1]",
            output: "1",
            explanation: "Between index 0 and 1, width is 1 and min height is 1, so area = 1."
          }
        ],
        starterCode: {
          javascript: `function maxArea(height) {
  // Write your code here
}`,
          python: `def max_area(height: list[int]) -> int:
    # Write your code here
    pass`,
          java: `class Solution {
    public int maxArea(int[] height) {
        // Write your code here
        return 0;
    }
}`,
          cpp: `class Solution {
public:
    int maxArea(vector<int>& height) {
        // Write your code here
        return 0;
    }
};`
        },
        execution: {
          functionName: "maxArea",
          parameters: ["height"]
        },
        outputComparator: "exact",
        testCases: [
          // Visible
          {
            input: { height: [1, 8, 6, 2, 5, 4, 8, 3, 7] },
            expectedOutput: 49,
            isHidden: false
          },
          {
            input: { height: [1, 1] },
            expectedOutput: 1,
            isHidden: false
          },
          // Hidden
          {
            input: { height: [4, 3, 2, 1, 4] },
            expectedOutput: 16,
            isHidden: true
          },
          {
            input: { height: [1, 2, 1] },
            expectedOutput: 2,
            isHidden: true
          },
          {
            input: { height: [2, 3, 4, 5, 18, 17, 6] },
            expectedOutput: 17,
            isHidden: true
          },
          {
            input: { height: [1, 2, 4, 3] },
            expectedOutput: 4,
            isHidden: true
          },
          {
            input: { height: [0, 2] },
            expectedOutput: 0,
            isHidden: true
          }
        ]
      },
      // ==========================================
      // BATCH 3: Stack
      // ==========================================
      {
        title: "Valid Parentheses",
        slug: "valid-parentheses",
        difficulty: "Easy",
        tags: ["string", "stack"],
        description:
          "Given a string s containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid. An input string is valid if: 1. Open brackets must be closed by the same type of brackets. 2. Open brackets must be closed in the correct order. 3. Every close bracket has a corresponding open bracket of the same type.",
        constraints: [
          "1 <= s.length <= 10^4",
          "s consists of parentheses only '()[]{}'."
        ],
        examples: [
          {
            input: 's = "()"',
            output: "true",
            explanation: "The string contains matching parentheses."
          },
          {
            input: 's = "()[]{}"',
            output: "true",
            explanation: "All types of bracket pairs are closed in correct order."
          },
          {
            input: 's = "(]"',
            output: "false",
            explanation: "The opening round bracket is closed by a square bracket."
          }
        ],
        starterCode: {
          javascript: `function isValid(s) {
  // Write your code here
}`,
          python: `def is_valid(s: str) -> bool:
    # Write your code here
    pass`,
          java: `class Solution {
    public boolean isValid(String s) {
        // Write your code here
        return false;
    }
}`,
          cpp: `class Solution {
public:
    bool isValid(string s) {
        // Write your code here
        return false;
    }
};`
        },
        execution: {
          functionName: "isValid",
          parameters: ["s"]
        },
        outputComparator: "exact",
        testCases: [
          // Visible
          {
            input: { s: "()" },
            expectedOutput: true,
            isHidden: false
          },
          {
            input: { s: "()[]{}" },
            expectedOutput: true,
            isHidden: false
          },
          {
            input: { s: "(]" },
            expectedOutput: false,
            isHidden: false
          },
          // Hidden
          {
            input: { s: "([)]" },
            expectedOutput: false,
            isHidden: true
          },
          {
            input: { s: "{[]}" },
            expectedOutput: true,
            isHidden: true
          },
          {
            input: { s: "[" },
            expectedOutput: false,
            isHidden: true
          },
          {
            input: { s: "]" },
            expectedOutput: false,
            isHidden: true
          },
          {
            input: { s: "((((((()))))))" },
            expectedOutput: true,
            isHidden: true
          },
          {
            input: { s: "{[()()]}" },
            expectedOutput: true,
            isHidden: true
          }
        ]
      },
      {
        title: "Min Stack",
        slug: "min-stack",
        difficulty: "Medium",
        tags: ["stack", "design"],
        description:
          "Design a stack that supports push, pop, top, and retrieving the minimum element in constant time. Implement a simulation function minStack(operations, values) that processes an array of operations (\"push\", \"pop\", \"top\", \"getMin\") with corresponding integer values (for push) and returns an array containing the outputs of all \"top\" and \"getMin\" operations in order.",
        constraints: [
          "1 <= operations.length <= 3 * 10^4",
          "operations[i] is in ['push', 'pop', 'top', 'getMin']",
          "-2^31 <= values[i] <= 2^31 - 1",
          "Methods pop, top and getMin operations will always be called on non-empty stacks."
        ],
        examples: [
          {
            input: 'operations = ["push","push","push","getMin","pop","top","getMin"], values = [-2,0,-3,0,0,0,0]',
            output: "[-3,0,-2]",
            explanation: "push -2, push 0, push -3. getMin returns -3. pop removes -3. top returns 0. getMin returns -2."
          },
          {
            input: 'operations = ["push","push","getMin","top"], values = [1,2,0,0]',
            output: "[1,2]",
            explanation: "push 1, push 2. getMin returns 1. top returns 2."
          }
        ],
        starterCode: {
          javascript: `function minStack(operations, values) {
  // Write your code here
}`,
          python: `def min_stack(operations: list[str], values: list[int]) -> list[int]:
    # Write your code here
    pass`,
          java: `import java.util.*;

class Solution {
    public int[] minStack(String[] operations, int[] values) {
        // Write your code here
        return new int[]{};
    }
}`,
          cpp: `class Solution {
public:
    vector<int> minStack(vector<string>& operations, vector<int>& values) {
        // Write your code here
        return {};
    }
};`
        },
        execution: {
          functionName: "minStack",
          parameters: ["operations", "values"]
        },
        outputComparator: "exact",
        testCases: [
          // Visible
          {
            input: {
              operations: ["push", "push", "push", "getMin", "pop", "top", "getMin"],
              values: [-2, 0, -3, 0, 0, 0, 0]
            },
            expectedOutput: [-3, 0, -2],
            isHidden: false
          },
          {
            input: {
              operations: ["push", "push", "getMin", "top"],
              values: [1, 2, 0, 0]
            },
            expectedOutput: [1, 2],
            isHidden: false
          },
          // Hidden
          {
            input: {
              operations: ["push", "getMin", "top"],
              values: [5, 0, 0]
            },
            expectedOutput: [5, 5],
            isHidden: true
          },
          {
            input: {
              operations: ["push", "push", "push", "getMin", "pop", "getMin"],
              values: [2, 0, 3, 0, 0, 0]
            },
            expectedOutput: [0, 0],
            isHidden: true
          },
          {
            input: {
              operations: ["push", "push", "push", "top", "getMin", "pop", "top", "getMin"],
              values: [10, -5, -10, 0, 0, 0, 0, 0]
            },
            expectedOutput: [-10, -10, -5, -5],
            isHidden: true
          },
          {
            input: {
              operations: ["push", "push", "pop", "top"],
              values: [1, 1, 0, 0]
            },
            expectedOutput: [1],
            isHidden: true
          }
        ]
      },
      {
        title: "Daily Temperatures",
        slug: "daily-temperatures",
        difficulty: "Medium",
        tags: ["array", "stack", "monotonic-stack"],
        description:
          "Given an array of integers temperatures represents the daily temperatures, return an array answer such that answer[i] is the number of days you have to wait after the ith day to get a warmer temperature. If there is no future day for which this is possible, keep answer[i] == 0 instead.",
        constraints: [
          "1 <= temperatures.length <= 10^5",
          "30 <= temperatures[i] <= 100"
        ],
        examples: [
          {
            input: "temperatures = [73,74,75,71,69,72,76,73]",
            output: "[1,1,4,2,1,1,0,0]",
            explanation: "For day 0 (73), day 1 is 74 (1 day wait). For day 2 (75), day 6 is 76 (4 days wait)."
          },
          {
            input: "temperatures = [30,40,50,60]",
            output: "[1,1,1,0]",
            explanation: "Each following day is warmer except the last."
          },
          {
            input: "temperatures = [30,60,90]",
            output: "[1,1,0]",
            explanation: "Each following day is warmer except the last."
          }
        ],
        starterCode: {
          javascript: `function dailyTemperatures(temperatures) {
  // Write your code here
}`,
          python: `def daily_temperatures(temperatures: list[int]) -> list[int]:
    # Write your code here
    pass`,
          java: `class Solution {
    public int[] dailyTemperatures(int[] temperatures) {
        // Write your code here
        return new int[]{};
    }
}`,
          cpp: `class Solution {
public:
    vector<int> dailyTemperatures(vector<int>& temperatures) {
        // Write your code here
        return {};
    }
};`
        },
        execution: {
          functionName: "dailyTemperatures",
          parameters: ["temperatures"]
        },
        outputComparator: "exact",
        testCases: [
          // Visible
          {
            input: { temperatures: [73, 74, 75, 71, 69, 72, 76, 73] },
            expectedOutput: [1, 1, 4, 2, 1, 1, 0, 0],
            isHidden: false
          },
          {
            input: { temperatures: [30, 40, 50, 60] },
            expectedOutput: [1, 1, 1, 0],
            isHidden: false
          },
          {
            input: { temperatures: [30, 60, 90] },
            expectedOutput: [1, 1, 0],
            isHidden: false
          },
          // Hidden
          {
            input: { temperatures: [90, 80, 70, 60] },
            expectedOutput: [0, 0, 0, 0],
            isHidden: true
          },
          {
            input: { temperatures: [50] },
            expectedOutput: [0],
            isHidden: true
          },
          {
            input: { temperatures: [89, 62, 70, 58, 47, 47, 46, 76, 100, 70] },
            expectedOutput: [8, 1, 5, 4, 3, 2, 1, 1, 0, 0],
            isHidden: true
          },
          {
            input: { temperatures: [40, 40, 40, 40] },
            expectedOutput: [0, 0, 0, 0],
            isHidden: true
          },
          {
            input: { temperatures: [35, 36, 35, 36, 35] },
            expectedOutput: [1, 0, 1, 0, 0],
            isHidden: true
          }
        ]
      },
      // ==========================================
      // BATCH 4: Binary Search
      // ==========================================
      {
        title: "Binary Search",
        slug: "binary-search",
        difficulty: "Easy",
        tags: ["array", "binary-search"],
        description:
          "Given an array of integers nums which is sorted in ascending order, and an integer target, write a function to search target in nums. If target exists, then return its index. Otherwise, return -1. You must write an algorithm with O(log n) runtime complexity.",
        constraints: [
          "1 <= nums.length <= 10^4",
          "-10^4 < nums[i], target < 10^4",
          "All the integers in nums are unique.",
          "nums is sorted in ascending order."
        ],
        examples: [
          {
            input: "nums = [-1,0,3,5,9,12], target = 9",
            output: "4",
            explanation: "9 exists in nums and its index is 4."
          },
          {
            input: "nums = [-1,0,3,5,9,12], target = 2",
            output: "-1",
            explanation: "2 does not exist in nums so return -1."
          }
        ],
        starterCode: {
          javascript: `function search(nums, target) {
  // Write your code here
}`,
          python: `def search(nums: list[int], target: int) -> int:
    # Write your code here
    pass`,
          java: `class Solution {
    public int search(int[] nums, int target) {
        // Write your code here
        return -1;
    }
}`,
          cpp: `class Solution {
public:
    int search(vector<int>& nums, int target) {
        // Write your code here
        return -1;
    }
};`
        },
        execution: {
          functionName: "search",
          parameters: ["nums", "target"]
        },
        outputComparator: "exact",
        testCases: [
          // Visible
          {
            input: { nums: [-1, 0, 3, 5, 9, 12], target: 9 },
            expectedOutput: 4,
            isHidden: false
          },
          {
            input: { nums: [-1, 0, 3, 5, 9, 12], target: 2 },
            expectedOutput: -1,
            isHidden: false
          },
          // Hidden
          {
            input: { nums: [5], target: 5 },
            expectedOutput: 0,
            isHidden: true
          },
          {
            input: { nums: [5], target: -5 },
            expectedOutput: -1,
            isHidden: true
          },
          {
            input: { nums: [1, 3, 5, 7, 9, 11], target: 1 },
            expectedOutput: 0,
            isHidden: true
          },
          {
            input: { nums: [1, 3, 5, 7, 9, 11], target: 11 },
            expectedOutput: 5,
            isHidden: true
          },
          {
            input: { nums: [2, 5], target: 0 },
            expectedOutput: -1,
            isHidden: true
          },
          {
            input: { nums: [2, 5], target: 5 },
            expectedOutput: 1,
            isHidden: true
          }
        ]
      },
      {
        title: "Search in Rotated Sorted Array",
        slug: "search-in-rotated-sorted-array",
        difficulty: "Medium",
        tags: ["array", "binary-search"],
        description:
          "There is an integer array nums sorted in ascending order (with distinct values). Prior to being passed to your function, nums is possibly rotated at an unknown pivot index k (1 <= k < nums.length). Given the array nums after the possible rotation and an integer target, return the index of target if it is in nums, or -1 if it is not in nums. You must write an algorithm with O(log n) runtime complexity.",
        constraints: [
          "1 <= nums.length <= 5000",
          "-10^4 <= nums[i] <= 10^4",
          "All values of nums are unique.",
          "nums is an ascending array that is possibly rotated.",
          "-10^4 <= target <= 10^4"
        ],
        examples: [
          {
            input: "nums = [4,5,6,7,0,1,2], target = 0",
            output: "4",
            explanation: "0 is at index 4 in the rotated array."
          },
          {
            input: "nums = [4,5,6,7,0,1,2], target = 3",
            output: "-1",
            explanation: "3 does not exist in nums."
          },
          {
            input: "nums = [1], target = 0",
            output: "-1",
            explanation: "0 does not exist in nums."
          }
        ],
        starterCode: {
          javascript: `function search(nums, target) {
  // Write your code here
}`,
          python: `def search(nums: list[int], target: int) -> int:
    # Write your code here
    pass`,
          java: `class Solution {
    public int search(int[] nums, int target) {
        // Write your code here
        return -1;
    }
}`,
          cpp: `class Solution {
public:
    int search(vector<int>& nums, int target) {
        // Write your code here
        return -1;
    }
};`
        },
        execution: {
          functionName: "search",
          parameters: ["nums", "target"]
        },
        outputComparator: "exact",
        testCases: [
          // Visible
          {
            input: { nums: [4, 5, 6, 7, 0, 1, 2], target: 0 },
            expectedOutput: 4,
            isHidden: false
          },
          {
            input: { nums: [4, 5, 6, 7, 0, 1, 2], target: 3 },
            expectedOutput: -1,
            isHidden: false
          },
          {
            input: { nums: [1], target: 0 },
            expectedOutput: -1,
            isHidden: false
          },
          // Hidden
          {
            input: { nums: [1], target: 1 },
            expectedOutput: 0,
            isHidden: true
          },
          {
            input: { nums: [3, 1], target: 1 },
            expectedOutput: 1,
            isHidden: true
          },
          {
            input: { nums: [5, 1, 3], target: 5 },
            expectedOutput: 0,
            isHidden: true
          },
          {
            input: { nums: [4, 5, 6, 7, 8, 1, 2], target: 8 },
            expectedOutput: 4,
            isHidden: true
          },
          {
            input: { nums: [6, 7, 1, 2, 3, 4, 5], target: 6 },
            expectedOutput: 0,
            isHidden: true
          }
        ]
      },
      {
        title: "Find Minimum in Rotated Sorted Array",
        slug: "find-minimum-in-rotated-sorted-array",
        difficulty: "Medium",
        tags: ["array", "binary-search"],
        description:
          "Suppose an array of length n sorted in ascending order is rotated between 1 and n times. Given the sorted rotated array nums of unique elements, return the minimum element of this array. You must write an algorithm that runs in O(log n) time.",
        constraints: [
          "n == nums.length",
          "1 <= n <= 5000",
          "-5000 <= nums[i] <= 5000",
          "All the integers of nums are unique.",
          "nums is sorted and rotated between 1 and n times."
        ],
        examples: [
          {
            input: "nums = [3,4,5,1,2]",
            output: "1",
            explanation: "The original array was [1,2,3,4,5] rotated 3 times."
          },
          {
            input: "nums = [4,5,6,7,0,1,2]",
            output: "0",
            explanation: "The original array was [0,1,2,4,5,6,7] and it was rotated 4 times."
          },
          {
            input: "nums = [11,13,15,17]",
            output: "11",
            explanation: "The original array was [11,13,15,17] and it was rotated 4 times."
          }
        ],
        starterCode: {
          javascript: `function findMin(nums) {
  // Write your code here
}`,
          python: `def find_min(nums: list[int]) -> int:
    # Write your code here
    pass`,
          java: `class Solution {
    public int findMin(int[] nums) {
        // Write your code here
        return 0;
    }
}`,
          cpp: `class Solution {
public:
    int findMin(vector<int>& nums) {
        // Write your code here
        return 0;
    }
};`
        },
        execution: {
          functionName: "findMin",
          parameters: ["nums"]
        },
        outputComparator: "exact",
        testCases: [
          // Visible
          {
            input: { nums: [3, 4, 5, 1, 2] },
            expectedOutput: 1,
            isHidden: false
          },
          {
            input: { nums: [4, 5, 6, 7, 0, 1, 2] },
            expectedOutput: 0,
            isHidden: false
          },
          {
            input: { nums: [11, 13, 15, 17] },
            expectedOutput: 11,
            isHidden: false
          },
          // Hidden
          {
            input: { nums: [1] },
            expectedOutput: 1,
            isHidden: true
          },
          {
            input: { nums: [2, 1] },
            expectedOutput: 1,
            isHidden: true
          },
          {
            input: { nums: [3, 1, 2] },
            expectedOutput: 1,
            isHidden: true
          },
          {
            input: { nums: [5, 1, 2, 3, 4] },
            expectedOutput: 1,
            isHidden: true
          },
          {
            input: { nums: [2, 3, 4, 5, 1] },
            expectedOutput: 1,
            isHidden: true
          }
        ]
      },
      // ==========================================
      // BATCH 5: Linked Lists
      // ==========================================
      {
        title: "Reverse Linked List",
        slug: "reverse-linked-list",
        difficulty: "Easy",
        tags: ["linked-list", "recursion"],
        description:
          "Given the head of a singly linked list represented as an array of integers head, reverse the list and return the reversed list.",
        constraints: [
          "0 <= head.length <= 5000",
          "-5000 <= head[i] <= 5000"
        ],
        examples: [
          {
            input: "head = [1,2,3,4,5]",
            output: "[5,4,3,2,1]",
            explanation: "The reversed linked list is [5,4,3,2,1]."
          },
          {
            input: "head = [1,2]",
            output: "[2,1]",
            explanation: "The reversed linked list is [2,1]."
          },
          {
            input: "head = []",
            output: "[]",
            explanation: "An empty linked list reversed remains empty."
          }
        ],
        starterCode: {
          javascript: `function reverseList(head) {
  // Write your code here
}`,
          python: `def reverse_list(head: list[int]) -> list[int]:
    # Write your code here
    pass`,
          java: `class Solution {
    public int[] reverseList(int[] head) {
        // Write your code here
        return new int[]{};
    }
}`,
          cpp: `class Solution {
public:
    vector<int> reverseList(vector<int>& head) {
        // Write your code here
        return {};
    }
};`
        },
        execution: {
          functionName: "reverseList",
          parameters: ["head"]
        },
        outputComparator: "exact",
        testCases: [
          // Visible
          {
            input: { head: [1, 2, 3, 4, 5] },
            expectedOutput: [5, 4, 3, 2, 1],
            isHidden: false
          },
          {
            input: { head: [1, 2] },
            expectedOutput: [2, 1],
            isHidden: false
          },
          {
            input: { head: [] },
            expectedOutput: [],
            isHidden: false
          },
          // Hidden
          {
            input: { head: [1] },
            expectedOutput: [1],
            isHidden: true
          },
          {
            input: { head: [9, 8, 7, 6] },
            expectedOutput: [6, 7, 8, 9],
            isHidden: true
          },
          {
            input: { head: [-1, -2, -3] },
            expectedOutput: [-3, -2, -1],
            isHidden: true
          },
          {
            input: { head: [0, 0, 0] },
            expectedOutput: [0, 0, 0],
            isHidden: true
          },
          {
            input: { head: [100, 200, 300, 400, 500] },
            expectedOutput: [500, 400, 300, 200, 100],
            isHidden: true
          }
        ]
      },
      {
        title: "Merge Two Sorted Lists",
        slug: "merge-two-sorted-lists",
        difficulty: "Easy",
        tags: ["linked-list", "recursion", "two-pointers"],
        description:
          "You are given two sorted linked lists represented as integer arrays list1 and list2. Merge the two lists into one sorted list and return it.",
        constraints: [
          "0 <= list1.length, list2.length <= 50",
          "-100 <= list1[i], list2[i] <= 100",
          "Both list1 and list2 are sorted in non-decreasing order."
        ],
        examples: [
          {
            input: "list1 = [1,2,4], list2 = [1,3,4]",
            output: "[1,1,2,3,4,4]",
            explanation: "Merged sorted list contains all elements from both lists."
          },
          {
            input: "list1 = [], list2 = []",
            output: "[]",
            explanation: "Both lists are empty."
          },
          {
            input: "list1 = [], list2 = [0]",
            output: "[0]",
            explanation: "Merging empty list with [0] yields [0]."
          }
        ],
        starterCode: {
          javascript: `function mergeTwoLists(list1, list2) {
  // Write your code here
}`,
          python: `def merge_two_lists(list1: list[int], list2: list[int]) -> list[int]:
    # Write your code here
    pass`,
          java: `class Solution {
    public int mergeTwoLists(int[] list1, int[] list2) {
        // Write your code here
        return new int[]{};
    }
}`,
          cpp: `class Solution {
public:
    vector<int> mergeTwoLists(vector<int>& list1, vector<int>& list2) {
        // Write your code here
        return {};
    }
};`
        },
        execution: {
          functionName: "mergeTwoLists",
          parameters: ["list1", "list2"]
        },
        outputComparator: "exact",
        testCases: [
          // Visible
          {
            input: { list1: [1, 2, 4], list2: [1, 3, 4] },
            expectedOutput: [1, 1, 2, 3, 4, 4],
            isHidden: false
          },
          {
            input: { list1: [], list2: [] },
            expectedOutput: [],
            isHidden: false
          },
          {
            input: { list1: [], list2: [0] },
            expectedOutput: [0],
            isHidden: false
          },
          // Hidden
          {
            input: { list1: [2], list2: [1] },
            expectedOutput: [1, 2],
            isHidden: true
          },
          {
            input: { list1: [1, 5, 9], list2: [2, 4, 6, 8] },
            expectedOutput: [1, 2, 4, 5, 6, 8, 9],
            isHidden: true
          },
          {
            input: { list1: [-10, -5, 0], list2: [-8, -2, 3] },
            expectedOutput: [-10, -8, -5, -2, 0, 3],
            isHidden: true
          },
          {
            input: { list1: [5, 5, 5], list2: [5, 5] },
            expectedOutput: [5, 5, 5, 5, 5],
            isHidden: true
          },
          {
            input: { list1: [1, 2, 3], list2: [] },
            expectedOutput: [1, 2, 3],
            isHidden: true
          }
        ]
      },
      {
        title: "Linked List Cycle",
        slug: "linked-list-cycle",
        difficulty: "Easy",
        tags: ["linked-list", "two-pointers", "hash-table"],
        description:
          "Given the head of a linked list represented as an array of node values head, and an integer pos representing the index of the node that the tail connects to (-1 if no cycle), determine if the linked list has a cycle in it. Return true if there is a cycle in the linked list. Otherwise, return false.",
        constraints: [
          "0 <= head.length <= 10^4",
          "-10^5 <= head[i] <= 10^5",
          "pos is -1 or a valid 0-based index in head."
        ],
        examples: [
          {
            input: "head = [3,2,0,-4], pos = 1",
            output: "true",
            explanation: "There is a cycle in the linked list, where the tail connects to the 1st node (0-indexed)."
          },
          {
            input: "head = [1,2], pos = 0",
            output: "true",
            explanation: "There is a cycle in the linked list, where the tail connects to the 0th node."
          },
          {
            input: "head = [1], pos = -1",
            output: "false",
            explanation: "There is no cycle in the linked list."
          }
        ],
        starterCode: {
          javascript: `function hasCycle(head, pos) {
  // Write your code here
}`,
          python: `def has_cycle(head: list[int], pos: int) -> bool:
    # Write your code here
    pass`,
          java: `class Solution {
    public boolean hasCycle(int[] head, int pos) {
        // Write your code here
        return false;
    }
}`,
          cpp: `class Solution {
public:
    bool hasCycle(vector<int>& head, int pos) {
        // Write your code here
        return false;
    }
};`
        },
        execution: {
          functionName: "hasCycle",
          parameters: ["head", "pos"]
        },
        outputComparator: "exact",
        testCases: [
          // Visible
          {
            input: { head: [3, 2, 0, -4], pos: 1 },
            expectedOutput: true,
            isHidden: false
          },
          {
            input: { head: [1, 2], pos: 0 },
            expectedOutput: true,
            isHidden: false
          },
          {
            input: { head: [1], pos: -1 },
            expectedOutput: false,
            isHidden: false
          },
          // Hidden
          {
            input: { head: [], pos: -1 },
            expectedOutput: false,
            isHidden: true
          },
          {
            input: { head: [1, 2, 3, 4, 5], pos: -1 },
            expectedOutput: false,
            isHidden: true
          },
          {
            input: { head: [1, 2, 3, 4, 5], pos: 4 },
            expectedOutput: true,
            isHidden: true
          },
          {
            input: { head: [5, 10, 15, 20], pos: 2 },
            expectedOutput: true,
            isHidden: true
          },
          {
            input: { head: [-1, -2, -3], pos: -1 },
            expectedOutput: false,
            isHidden: true
          }
        ]
      },
      // ==========================================
      // BATCH 6: Binary Trees
      // ==========================================
      {
        title: "Invert Binary Tree",
        slug: "invert-binary-tree",
        difficulty: "Easy",
        tags: ["tree", "depth-first-search", "breadth-first-search", "binary-tree"],
        description:
          "Given the root of a binary tree represented as an array in level-order root, invert the tree, and return its level-order representation.",
        constraints: [
          "0 <= root.length <= 100",
          "-100 <= root[i] <= 100"
        ],
        examples: [
          {
            input: "root = [4,2,7,1,3,6,9]",
            output: "[4,7,2,9,6,3,1]",
            explanation: "The left subtree [2,1,3] and right subtree [7,6,9] are swapped at each level."
          },
          {
            input: "root = [2,1,3]",
            output: "[2,3,1]",
            explanation: "The children 1 and 3 are inverted."
          },
          {
            input: "root = []",
            output: "[]",
            explanation: "An empty tree inverted is empty."
          }
        ],
        starterCode: {
          javascript: `function invertTree(root) {
  // Write your code here
}`,
          python: `def invert_tree(root: list[int]) -> list[int]:
    # Write your code here
    pass`,
          java: `class Solution {
    public int[] invertTree(int[] root) {
        // Write your code here
        return new int[]{};
    }
}`,
          cpp: `class Solution {
public:
    vector<int> invertTree(vector<int>& root) {
        // Write your code here
        return {};
    }
};`
        },
        execution: {
          functionName: "invertTree",
          parameters: ["root"]
        },
        outputComparator: "exact",
        testCases: [
          // Visible
          {
            input: { root: [4, 2, 7, 1, 3, 6, 9] },
            expectedOutput: [4, 7, 2, 9, 6, 3, 1],
            isHidden: false
          },
          {
            input: { root: [2, 1, 3] },
            expectedOutput: [2, 3, 1],
            isHidden: false
          },
          {
            input: { root: [] },
            expectedOutput: [],
            isHidden: false
          },
          // Hidden
          {
            input: { root: [1] },
            expectedOutput: [1],
            isHidden: true
          },
          {
            input: { root: [1, 2, -1] },
            expectedOutput: [1, -1, 2],
            isHidden: true
          },
          {
            input: { root: [5, 3, 8, 1, 4, 7, 9] },
            expectedOutput: [5, 8, 3, 9, 7, 4, 1],
            isHidden: true
          },
          {
            input: { root: [1, -1, 2] },
            expectedOutput: [1, 2, -1],
            isHidden: true
          },
          {
            input: { root: [10, 20, 30] },
            expectedOutput: [10, 30, 20],
            isHidden: true
          }
        ]
      },
      {
        title: "Maximum Depth of Binary Tree",
        slug: "maximum-depth-of-binary-tree",
        difficulty: "Easy",
        tags: ["tree", "depth-first-search", "breadth-first-search", "binary-tree"],
        description:
          "Given the root of a binary tree represented as an array in level-order (where -1 represents a null node), return its maximum depth. A binary tree's maximum depth is the number of nodes along the longest path from the root node down to the farthest leaf node.",
        constraints: [
          "0 <= root.length <= 10^4",
          "-100 <= root[i] <= 100",
          "A value of -1 indicates a null node."
        ],
        examples: [
          {
            input: "root = [3,9,20,-1,-1,15,7]",
            output: "3",
            explanation: "The longest root-to-leaf path is 3 -> 20 -> 15 (or 7) with 3 nodes."
          },
          {
            input: "root = [1,-1,2]",
            output: "2",
            explanation: "The path is 1 -> 2 with depth 2."
          },
          {
            input: "root = []",
            output: "0",
            explanation: "An empty tree has depth 0."
          }
        ],
        starterCode: {
          javascript: `function maxDepth(root) {
  // Write your code here
}`,
          python: `def max_depth(root: list[int]) -> int:
    # Write your code here
    pass`,
          java: `class Solution {
    public int maxDepth(int[] root) {
        // Write your code here
        return 0;
    }
}`,
          cpp: `class Solution {
public:
    int maxDepth(vector<int>& root) {
        // Write your code here
        return 0;
    }
};`
        },
        execution: {
          functionName: "maxDepth",
          parameters: ["root"]
        },
        outputComparator: "exact",
        testCases: [
          // Visible
          {
            input: { root: [3, 9, 20, -1, -1, 15, 7] },
            expectedOutput: 3,
            isHidden: false
          },
          {
            input: { root: [1, -1, 2] },
            expectedOutput: 2,
            isHidden: false
          },
          {
            input: { root: [] },
            expectedOutput: 0,
            isHidden: false
          },
          // Hidden
          {
            input: { root: [1] },
            expectedOutput: 1,
            isHidden: true
          },
          {
            input: { root: [1, 2, 3, 4, 5] },
            expectedOutput: 3,
            isHidden: true
          },
          {
            input: { root: [1, 2, 3, 4, -1, -1, 5] },
            expectedOutput: 3,
            isHidden: true
          },
          {
            input: { root: [1, 2, -1, 3, -1, -1, -1, 4] },
            expectedOutput: 4,
            isHidden: true
          },
          {
            input: { root: [0] },
            expectedOutput: 1,
            isHidden: true
          }
        ]
      },
      {
        title: "Same Tree",
        slug: "same-tree",
        difficulty: "Easy",
        tags: ["tree", "depth-first-search", "breadth-first-search", "binary-tree"],
        description:
          "Given the roots of two binary trees p and q represented in level-order (where -1 represents a null node), write a function to check if they are the same or not. Two binary trees are considered the same if they are structurally identical, and the nodes have the same value.",
        constraints: [
          "0 <= p.length, q.length <= 100",
          "-10^4 <= p[i], q[i] <= 10^4",
          "-1 represents a null node."
        ],
        examples: [
          {
            input: "p = [1,2,3], q = [1,2,3]",
            output: "true",
            explanation: "Both trees have the same structure and node values."
          },
          {
            input: "p = [1,2], q = [1,-1,2]",
            output: "false",
            explanation: "The left and right children are positioned differently."
          },
          {
            input: "p = [1,2,1], q = [1,1,2]",
            output: "false",
            explanation: "Node values differ."
          }
        ],
        starterCode: {
          javascript: `function isSameTree(p, q) {
  // Write your code here
}`,
          python: `def is_same_tree(p: list[int], q: list[int]) -> bool:
    # Write your code here
    pass`,
          java: `class Solution {
    public boolean isSameTree(int[] p, int[] q) {
        // Write your code here
        return false;
    }
}`,
          cpp: `class Solution {
public:
    bool isSameTree(vector<int>& p, vector<int>& q) {
        // Write your code here
        return false;
    }
};`
        },
        execution: {
          functionName: "isSameTree",
          parameters: ["p", "q"]
        },
        outputComparator: "exact",
        testCases: [
          // Visible
          {
            input: { p: [1, 2, 3], q: [1, 2, 3] },
            expectedOutput: true,
            isHidden: false
          },
          {
            input: { p: [1, 2], q: [1, -1, 2] },
            expectedOutput: false,
            isHidden: false
          },
          {
            input: { p: [1, 2, 1], q: [1, 1, 2] },
            expectedOutput: false,
            isHidden: false
          },
          // Hidden
          {
            input: { p: [], q: [] },
            expectedOutput: true,
            isHidden: true
          },
          {
            input: { p: [1], q: [1] },
            expectedOutput: true,
            isHidden: true
          },
          {
            input: { p: [1], q: [2] },
            expectedOutput: false,
            isHidden: true
          },
          {
            input: { p: [1, 2, 3, 4], q: [1, 2, 3, 5] },
            expectedOutput: false,
            isHidden: true
          },
          {
            input: { p: [4, 2, 6, 1, 3, 5, 7], q: [4, 2, 6, 1, 3, 5, 7] },
            expectedOutput: true,
            isHidden: true
          }
        ]
      },
      {
        title: "Lowest Common Ancestor of a BST",
        slug: "lowest-common-ancestor-of-a-bst",
        difficulty: "Medium",
        tags: ["tree", "depth-first-search", "binary-search-tree", "binary-tree"],
        description:
          "Given a binary search tree (BST) represented as an array in level-order root, find the lowest common ancestor (LCA) node value of two given nodes in the BST with values p and q. The lowest common ancestor is defined between two nodes p and q as the lowest node in T that has both p and q as descendants (where we allow a node to be a descendant of itself).",
        constraints: [
          "2 <= root.length <= 10^5",
          "-10^9 <= root[i] <= 10^9",
          "All root[i] are unique.",
          "p and q will exist in the BST and p != q."
        ],
        examples: [
          {
            input: "root = [6,2,8,0,4,7,9,-1,-1,3,5], p = 2, q = 8",
            output: "6",
            explanation: "The LCA of nodes 2 and 8 is 6."
          },
          {
            input: "root = [6,2,8,0,4,7,9,-1,-1,3,5], p = 2, q = 4",
            output: "2",
            explanation: "The LCA of nodes 2 and 4 is 2, since a node can be a descendant of itself according to the LCA definition."
          },
          {
            input: "root = [2,1], p = 2, q = 1",
            output: "2",
            explanation: "The LCA of 2 and 1 is 2."
          }
        ],
        starterCode: {
          javascript: `function lowestCommonAncestor(root, p, q) {
  // Write your code here
}`,
          python: `def lowest_common_ancestor(root: list[int], p: int, q: int) -> int:
    # Write your code here
    pass`,
          java: `class Solution {
    public int lowestCommonAncestor(int[] root, int p, int q) {
        // Write your code here
        return 0;
    }
}`,
          cpp: `class Solution {
public:
    int lowestCommonAncestor(vector<int>& root, int p, int q) {
        // Write your code here
        return 0;
    }
};`
        },
        execution: {
          functionName: "lowestCommonAncestor",
          parameters: ["root", "p", "q"]
        },
        outputComparator: "exact",
        testCases: [
          // Visible
          {
            input: { root: [6, 2, 8, 0, 4, 7, 9, -1, -1, 3, 5], p: 2, q: 8 },
            expectedOutput: 6,
            isHidden: false
          },
          {
            input: { root: [6, 2, 8, 0, 4, 7, 9, -1, -1, 3, 5], p: 2, q: 4 },
            expectedOutput: 2,
            isHidden: false
          },
          {
            input: { root: [2, 1], p: 2, q: 1 },
            expectedOutput: 2,
            isHidden: false
          },
          // Hidden
          {
            input: { root: [5, 3, 6, 2, 4, -1, -1, 1], p: 1, q: 4 },
            expectedOutput: 3,
            isHidden: true
          },
          {
            input: { root: [6, 2, 8, 0, 4, 7, 9, -1, -1, 3, 5], p: 3, q: 5 },
            expectedOutput: 4,
            isHidden: true
          },
          {
            input: { root: [6, 2, 8, 0, 4, 7, 9, -1, -1, 3, 5], p: 7, q: 9 },
            expectedOutput: 8,
            isHidden: true
          },
          {
            input: { root: [10, 5, 15, 3, 7, 12, 18], p: 3, q: 18 },
            expectedOutput: 10,
            isHidden: true
          },
          {
            input: { root: [10, 5, 15, 3, 7, 12, 18], p: 12, q: 18 },
            expectedOutput: 15,
            isHidden: true
          }
        ]
      },
      // ==========================================
      // BATCH 7: Dynamic Programming & Greedy
      // ==========================================
      {
        title: "Climbing Stairs",
        slug: "climbing-stairs",
        difficulty: "Easy",
        tags: ["math", "dynamic-programming", "memoization"],
        description:
          "You are climbing a staircase. It takes n steps to reach the top. Each time you can either climb 1 or 2 steps. In how many distinct ways can you climb to the top?",
        constraints: [
          "1 <= n <= 45"
        ],
        examples: [
          {
            input: "n = 2",
            output: "2",
            explanation: "There are two ways to climb to the top: 1. 1 step + 1 step, 2. 2 steps."
          },
          {
            input: "n = 3",
            output: "3",
            explanation: "There are three ways to climb to the top: 1. 1 step + 1 step + 1 step, 2. 1 step + 2 steps, 3. 2 steps + 1 step."
          }
        ],
        starterCode: {
          javascript: `function climbStairs(n) {
  // Write your code here
}`,
          python: `def climb_stairs(n: int) -> int:
    # Write your code here
    pass`,
          java: `class Solution {
    public int climbStairs(int n) {
        // Write your code here
        return 0;
    }
}`,
          cpp: `class Solution {
public:
    int climbStairs(int n) {
        // Write your code here
        return 0;
    }
};`
        },
        execution: {
          functionName: "climbStairs",
          parameters: ["n"]
        },
        outputComparator: "exact",
        testCases: [
          // Visible
          {
            input: { n: 2 },
            expectedOutput: 2,
            isHidden: false
          },
          {
            input: { n: 3 },
            expectedOutput: 3,
            isHidden: false
          },
          // Hidden
          {
            input: { n: 1 },
            expectedOutput: 1,
            isHidden: true
          },
          {
            input: { n: 4 },
            expectedOutput: 5,
            isHidden: true
          },
          {
            input: { n: 5 },
            expectedOutput: 8,
            isHidden: true
          },
          {
            input: { n: 10 },
            expectedOutput: 89,
            isHidden: true
          },
          {
            input: { n: 20 },
            expectedOutput: 10946,
            isHidden: true
          },
          {
            input: { n: 35 },
            expectedOutput: 14930352,
            isHidden: true
          }
        ]
      },
      {
        title: "Coin Change",
        slug: "coin-change",
        difficulty: "Medium",
        tags: ["array", "dynamic-programming", "breadth-first-search"],
        description:
          "You are given an integer array coins representing coins of different denominations and an integer amount representing a total amount of money. Return the fewest number of coins that you need to make up that amount. If that amount of money cannot be made up by any combination of the coins, return -1. You may assume that you have an infinite number of each kind of coin.",
        constraints: [
          "1 <= coins.length <= 12",
          "1 <= coins[i] <= 2^31 - 1",
          "0 <= amount <= 10^4"
        ],
        examples: [
          {
            input: "coins = [1,2,5], amount = 11",
            output: "3",
            explanation: "11 = 5 + 5 + 1"
          },
          {
            input: "coins = [2], amount = 3",
            output: "-1",
            explanation: "The amount 3 cannot be formed using coins of denomination 2."
          },
          {
            input: "coins = [1], amount = 0",
            output: "0",
            explanation: "0 amount requires 0 coins."
          }
        ],
        starterCode: {
          javascript: `function coinChange(coins, amount) {
  // Write your code here
}`,
          python: `def coin_change(coins: list[int], amount: int) -> int:
    # Write your code here
    pass`,
          java: `class Solution {
    public int coinChange(int[] coins, int amount) {
        // Write your code here
        return -1;
    }
}`,
          cpp: `class Solution {
public:
    int coinChange(vector<int>& coins, int amount) {
        // Write your code here
        return -1;
    }
};`
        },
        execution: {
          functionName: "coinChange",
          parameters: ["coins", "amount"]
        },
        outputComparator: "exact",
        testCases: [
          // Visible
          {
            input: { coins: [1, 2, 5], amount: 11 },
            expectedOutput: 3,
            isHidden: false
          },
          {
            input: { coins: [2], amount: 3 },
            expectedOutput: -1,
            isHidden: false
          },
          {
            input: { coins: [1], amount: 0 },
            expectedOutput: 0,
            isHidden: false
          },
          // Hidden
          {
            input: { coins: [1], amount: 1 },
            expectedOutput: 1,
            isHidden: true
          },
          {
            input: { coins: [1], amount: 2 },
            expectedOutput: 2,
            isHidden: true
          },
          {
            input: { coins: [2, 5, 10, 1], amount: 27 },
            expectedOutput: 4,
            isHidden: true
          },
          {
            input: { coins: [186, 419, 83, 408], amount: 6249 },
            expectedOutput: 20,
            isHidden: true
          },
          {
            input: { coins: [2], amount: 1 },
            expectedOutput: -1,
            isHidden: true
          }
        ]
      },
      {
        title: "Maximum Subarray",
        slug: "maximum-subarray",
        difficulty: "Medium",
        tags: ["array", "divide-and-conquer", "dynamic-programming"],
        description:
          "Given an integer array nums, find the subarray with the largest sum, and return its sum. A subarray is a contiguous non-empty sequence of elements within an array.",
        constraints: [
          "1 <= nums.length <= 10^5",
          "-10^4 <= nums[i] <= 10^4"
        ],
        examples: [
          {
            input: "nums = [-2,1,-3,4,-1,2,1,-5,4]",
            output: "6",
            explanation: "The subarray [4,-1,2,1] has the largest sum 6."
          },
          {
            input: "nums = [1]",
            output: "1",
            explanation: "The subarray [1] has the largest sum 1."
          },
          {
            input: "nums = [5,4,-1,7,8]",
            output: "23",
            explanation: "The subarray [5,4,-1,7,8] has the largest sum 23."
          }
        ],
        starterCode: {
          javascript: `function maxSubArray(nums) {
  // Write your code here
}`,
          python: `def max_sub_array(nums: list[int]) -> int:
    # Write your code here
    pass`,
          java: `class Solution {
    public int maxSubArray(int[] nums) {
        // Write your code here
        return 0;
    }
}`,
          cpp: `class Solution {
public:
    int maxSubArray(vector<int>& nums) {
        // Write your code here
        return 0;
    }
};`
        },
        execution: {
          functionName: "maxSubArray",
          parameters: ["nums"]
        },
        outputComparator: "exact",
        testCases: [
          // Visible
          {
            input: { nums: [-2, 1, -3, 4, -1, 2, 1, -5, 4] },
            expectedOutput: 6,
            isHidden: false
          },
          {
            input: { nums: [1] },
            expectedOutput: 1,
            isHidden: false
          },
          {
            input: { nums: [5, 4, -1, 7, 8] },
            expectedOutput: 23,
            isHidden: false
          },
          // Hidden
          {
            input: { nums: [-1] },
            expectedOutput: -1,
            isHidden: true
          },
          {
            input: { nums: [-2, -1] },
            expectedOutput: -1,
            isHidden: true
          },
          {
            input: { nums: [-3, -2, -2, -3] },
            expectedOutput: -2,
            isHidden: true
          },
          {
            input: { nums: [8, -19, 5, -4, 20] },
            expectedOutput: 21,
            isHidden: true
          },
          {
            input: { nums: [1, 2, 3, 4, -10] },
            expectedOutput: 10,
            isHidden: true
          }
        ]
      },
      {
        title: "Jump Game",
        slug: "jump-game",
        difficulty: "Medium",
        tags: ["array", "dynamic-programming", "greedy"],
        description:
          "You are given an integer array nums. You are initially positioned at the array's first index, and each element in the array represents your maximum jump length at that position. Return true if you can reach the last index, or false otherwise.",
        constraints: [
          "1 <= nums.length <= 10^4",
          "0 <= nums[i] <= 10^5"
        ],
        examples: [
          {
            input: "nums = [2,3,1,1,4]",
            output: "true",
            explanation: "Jump 1 step from index 0 to 1, then 3 steps to the last index."
          },
          {
            input: "nums = [3,2,1,0,4]",
            output: "false",
            explanation: "You will always arrive at index 3 no matter what. Its maximum jump length is 0, which makes it impossible to reach the last index."
          }
        ],
        starterCode: {
          javascript: `function canJump(nums) {
  // Write your code here
}`,
          python: `def can_jump(nums: list[int]) -> bool:
    # Write your code here
    pass`,
          java: `class Solution {
    public boolean canJump(int[] nums) {
        // Write your code here
        return false;
    }
}`,
          cpp: `class Solution {
public:
    bool canJump(vector<int>& nums) {
        // Write your code here
        return false;
    }
};`
        },
        execution: {
          functionName: "canJump",
          parameters: ["nums"]
        },
        outputComparator: "exact",
        testCases: [
          // Visible
          {
            input: { nums: [2, 3, 1, 1, 4] },
            expectedOutput: true,
            isHidden: false
          },
          {
            input: { nums: [3, 2, 1, 0, 4] },
            expectedOutput: false,
            isHidden: false
          },
          // Hidden
          {
            input: { nums: [0] },
            expectedOutput: true,
            isHidden: true
          },
          {
            input: { nums: [2, 0, 0] },
            expectedOutput: true,
            isHidden: true
          },
          {
            input: { nums: [1, 0, 1, 0] },
            expectedOutput: false,
            isHidden: true
          },
          {
            input: { nums: [1, 1, 1, 1, 1] },
            expectedOutput: true,
            isHidden: true
          },
          {
            input: { nums: [0, 2, 3] },
            expectedOutput: false,
            isHidden: true
          },
          {
            input: { nums: [2, 5, 0, 0] },
            expectedOutput: true,
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