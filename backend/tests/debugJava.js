const { runProblem } = require("./backend/services/problemTestRunnerService");
const dummyProblem = {
  slug: "two-sum",
  execution: { functionName: "twoSum", parameters: ["nums", "target"] },
  outputComparator: "exact",
  testCases: [{ input: { nums: [2, 7, 11, 15], target: 9 }, expectedOutput: [0, 1], isHidden: false }]
};
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
runProblem({ problem: dummyProblem, code: javaCode, language: "java" }).then(r => console.log(JSON.stringify(r, null, 2)));
