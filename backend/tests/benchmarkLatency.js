/**
 * Stage 11 — C++ Latency Diagnostic Benchmark
 * 
 * Measures every phase of the execution pipeline for C++, Java, JavaScript, Python
 * on the same Two Sum problem, sequentially, with precise timestamps.
 */

const { performance } = require("perf_hooks");
const executionService = require("./services/executionService");
const { runProblem } = require("./services/problemTestRunnerService");
const {
  isEligibleForUnifiedExecution,
} = require("./services/cppMultiTestHarnessService");
const { generatePythonMultiTestHarness } = require("./services/languageRunners/pythonHarnessService");
const { generateJavascriptMultiTestHarness } = require("./services/languageRunners/javascriptHarnessService");
const { generateJavaMultiTestHarness } = require("./services/languageRunners/javaHarnessService");
const {
  generateCppMultiTestHarness,
  parseMultiTestHarnessOutput,
} = require("./services/cppMultiTestHarnessService");
const { compareOutput } = require("./services/outputComparatorService");

// ─── Canonical Problem Definition ───
const problemData = {
  _id: "two-sum",
  slug: "two-sum",
  title: "Two Sum",
  outputComparator: "unordered_array",
  execution: {
    functionName: "twoSum",
    parameters: ["nums", "target"],
  },
  testCases: [
    { input: { nums: [2, 7, 11, 15], target: 9 }, expectedOutput: [0, 1], isHidden: false },
    { input: { nums: [3, 2, 4], target: 6 }, expectedOutput: [1, 2], isHidden: false },
    { input: { nums: [3, 3], target: 6 }, expectedOutput: [0, 1], isHidden: true },
  ],
};

// ─── Correct Solutions Per Language ───
const solutions = {
  cpp: `#include <vector>
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
};`,

  python: `class Solution:
    def twoSum(self, nums, target):
        m = {}
        for i, num in enumerate(nums):
            comp = target - num
            if comp in m:
                return [m[comp], i]
            m[num] = i
        return []`,

  javascript: `var twoSum = function(nums, target) {
    const map = new Map();
    for (let i = 0; i < nums.length; i++) {
        const comp = target - nums[i];
        if (map.has(comp)) return [map.get(comp), i];
        map.set(nums[i], i);
    }
    return [];
};`,

  java: `import java.util.HashMap;
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
}`,
};

// ─── Harness generator dispatch ───
function generateHarness(language, code) {
  const testCases = problemData.testCases;
  const args = { solutionCode: code, problem: problemData, testCases };
  switch (language) {
    case "cpp": return generateCppMultiTestHarness(args);
    case "python": return generatePythonMultiTestHarness(args);
    case "javascript": return generateJavascriptMultiTestHarness(args);
    case "java": return generateJavaMultiTestHarness(args);
    default: throw new Error(`Unknown language: ${language}`);
  }
}

// ─── Phase 1: Low-Level Instrumented Pipeline (Harness → Piston → Parse → Compare) ───
async function instrumentedExecution(language) {
  const code = solutions[language];
  const timing = {};

  // 1. Harness generation
  const t0 = performance.now();
  const harness = generateHarness(language, code);
  timing.harnessMs = performance.now() - t0;

  // 2. Source code size
  timing.sourceBytes = Buffer.byteLength(harness.source, "utf8");

  // 3. Piston execution (raw)
  const t1 = performance.now();
  const execResult = await executionService.execute({
    language,
    sourceCode: harness.source,
  });
  timing.pistonTotalMs = performance.now() - t1;

  // 4. Extract Piston-reported compile and run metrics
  timing.pistonCompileWallMs = execResult.compile?.wallTime ?? null;
  timing.pistonCompileCpuMs = execResult.compile?.cpuTime ?? null;
  timing.pistonCompileMemKb = execResult.compile?.memory ? Math.round(execResult.compile.memory / 1024) : null;
  timing.pistonRunWallMs = execResult.run?.wallTime ?? null;
  timing.pistonRunCpuMs = execResult.run?.cpuTime ?? null;
  timing.pistonRunMemKb = execResult.run?.memory ? Math.round(execResult.run.memory / 1024) : null;
  timing.pistonStatus = execResult.status;

  // 5. Piston overhead = total - (compile_wall + run_wall)
  const compileWall = timing.pistonCompileWallMs || 0;
  const runWall = timing.pistonRunWallMs || 0;
  timing.pistonOverheadMs = timing.pistonTotalMs - compileWall - runWall;

  // 6. Parse harness output
  const t2 = performance.now();
  const parsedHarness = parseMultiTestHarnessOutput(
    execResult.stdout || "",
    problemData.testCases.length
  );
  timing.parseMs = performance.now() - t2;

  // 7. Comparator evaluation
  const t3 = performance.now();
  let passedCount = 0;
  for (let i = 0; i < problemData.testCases.length; i++) {
    const tc = problemData.testCases[i];
    const testOut = parsedHarness.testOutputs[i];
    const actualVal = testOut ? testOut.parsedValue : null;
    const compResult = compareOutput({
      actual: actualVal,
      expected: tc.expectedOutput,
      comparator: problemData.outputComparator || "exact",
    });
    if (compResult.passed) passedCount++;
  }
  timing.compareMs = performance.now() - t3;
  timing.passedCount = passedCount;
  timing.totalCount = problemData.testCases.length;

  // 8. Total
  timing.totalMs = performance.now() - t0;

  return timing;
}

// ─── Phase 2: Full runProblem() end-to-end ───
async function fullPipelineExecution(language) {
  const code = solutions[language];
  const t0 = performance.now();
  const result = await runProblem({
    problem: problemData,
    code,
    language,
    includeHidden: true,
  });
  const totalMs = performance.now() - t0;
  return {
    status: result.status,
    passedTestCases: result.passedTestCases,
    totalTestCases: result.totalTestCases,
    runProblemTotalMs: totalMs,
  };
}

// ─── Main Benchmark ───
async function main() {
  console.log("==========================================================");
  console.log("C++ LATENCY DIAGNOSTIC BENCHMARK");
  console.log("==========================================================");
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Problem: Two Sum (3 test cases: 2 visible + 1 hidden)`);
  console.log(`Piston URL: ${process.env.PISTON_URL || "http://localhost:2000"}`);
  console.log();

  const languages = ["cpp", "java", "javascript", "python"];
  const results = {};

  // Run sequentially
  for (const lang of languages) {
    console.log(`──── Benchmarking: ${lang.toUpperCase()} ────`);

    // Phase 1: Instrumented low-level
    console.log("  Phase 1: Instrumented pipeline...");
    const instrumented = await instrumentedExecution(lang);

    // Phase 2: Full runProblem
    console.log("  Phase 2: Full runProblem pipeline...");
    const full = await fullPipelineExecution(lang);

    results[lang] = { ...instrumented, ...full };

    // Print compact timing
    const r = results[lang];
    console.log();
    console.log(`[EXEC_TIMING]`);
    console.log(`language=${lang}`);
    console.log(`problem=two-sum`);
    console.log(`harnessMs=${r.harnessMs.toFixed(1)}`);
    console.log(`sourceBytes=${r.sourceBytes}`);
    console.log(`pistonTotalMs=${r.pistonTotalMs.toFixed(1)}`);
    console.log(`pistonCompileWallMs=${r.pistonCompileWallMs}`);
    console.log(`pistonCompileCpuMs=${r.pistonCompileCpuMs}`);
    console.log(`pistonCompileMemKb=${r.pistonCompileMemKb}`);
    console.log(`pistonRunWallMs=${r.pistonRunWallMs}`);
    console.log(`pistonRunCpuMs=${r.pistonRunCpuMs}`);
    console.log(`pistonRunMemKb=${r.pistonRunMemKb}`);
    console.log(`pistonOverheadMs=${r.pistonOverheadMs.toFixed(1)}`);
    console.log(`pistonStatus=${r.pistonStatus}`);
    console.log(`parseMs=${r.parseMs.toFixed(2)}`);
    console.log(`compareMs=${r.compareMs.toFixed(2)}`);
    console.log(`instrumentedTotalMs=${r.totalMs.toFixed(1)}`);
    console.log(`runProblemTotalMs=${r.runProblemTotalMs.toFixed(1)}`);
    console.log(`status=${r.status}`);
    console.log(`passed=${r.passedTestCases}/${r.totalTestCases}`);
    console.log();
  }

  // ─── Summary Table ───
  console.log("==========================================================");
  console.log("SUMMARY TABLE");
  console.log("==========================================================");
  console.log();

  const header = "Language     | Harness | Piston Total | Compile(wall) | Run(wall) | Piston Overhead | Parse | Compare | E2E Total  | Status";
  const sep    = "-------------|---------|--------------|---------------|-----------|-----------------|-------|---------|------------|-------";
  console.log(header);
  console.log(sep);

  for (const lang of languages) {
    const r = results[lang];
    const row = [
      lang.padEnd(12),
      `${r.harnessMs.toFixed(0)}ms`.padStart(7),
      `${r.pistonTotalMs.toFixed(0)}ms`.padStart(12),
      `${r.pistonCompileWallMs ?? "N/A"}ms`.padStart(13),
      `${r.pistonRunWallMs ?? "N/A"}ms`.padStart(9),
      `${r.pistonOverheadMs.toFixed(0)}ms`.padStart(15),
      `${r.parseMs.toFixed(1)}ms`.padStart(5),
      `${r.compareMs.toFixed(1)}ms`.padStart(7),
      `${r.runProblemTotalMs.toFixed(0)}ms`.padStart(10),
      r.status,
    ].join(" | ");
    console.log(row);
  }

  console.log();

  // ─── Analysis ───
  console.log("==========================================================");
  console.log("ANALYSIS");
  console.log("==========================================================");
  console.log();

  const cppR = results.cpp;
  const jsR = results.javascript;
  const javaR = results.java;
  const pyR = results.python;

  console.log("A. Time inside Piston (pistonTotalMs):");
  for (const lang of languages) {
    console.log(`   ${lang}: ${results[lang].pistonTotalMs.toFixed(0)}ms`);
  }

  console.log();
  console.log("B. GCC compilation time (pistonCompileWallMs):");
  console.log(`   cpp: ${cppR.pistonCompileWallMs}ms`);
  console.log(`   java (javac): ${javaR.pistonCompileWallMs}ms`);
  console.log(`   python: ${pyR.pistonCompileWallMs ?? "N/A (interpreted)"}`);
  console.log(`   javascript: ${jsR.pistonCompileWallMs ?? "N/A (interpreted)"}`);

  console.log();
  console.log("C. Piston overhead (total - compile_wall - run_wall):");
  for (const lang of languages) {
    console.log(`   ${lang}: ${results[lang].pistonOverheadMs.toFixed(0)}ms`);
  }

  console.log();
  console.log("D. CodeSync backend processing (harnessMs + parseMs + compareMs):");
  for (const lang of languages) {
    const r = results[lang];
    const backend = r.harnessMs + r.parseMs + r.compareMs;
    console.log(`   ${lang}: ${backend.toFixed(1)}ms`);
  }

  console.log();
  console.log("E. Same Piston overhead across languages?");
  for (const lang of languages) {
    console.log(`   ${lang}: overhead=${results[lang].pistonOverheadMs.toFixed(0)}ms`);
  }

  console.log();
  console.log("F. Why is C++ ~20s slower?");
  const cppCompile = cppR.pistonCompileWallMs || 0;
  const javaCompile = javaR.pistonCompileWallMs || 0;
  const cppOverhead = cppR.pistonOverheadMs;
  const javaOverhead = javaR.pistonOverheadMs;
  console.log(`   C++ compile: ${cppCompile}ms vs Java compile: ${javaCompile}ms (diff: ${cppCompile - javaCompile}ms)`);
  console.log(`   C++ Piston overhead: ${cppOverhead.toFixed(0)}ms vs Java: ${javaOverhead.toFixed(0)}ms (diff: ${(cppOverhead - javaOverhead).toFixed(0)}ms)`);
  console.log(`   C++ total Piston: ${cppR.pistonTotalMs.toFixed(0)}ms vs Java: ${javaR.pistonTotalMs.toFixed(0)}ms (diff: ${(cppR.pistonTotalMs - javaR.pistonTotalMs).toFixed(0)}ms)`);

  console.log();
  console.log("==========================================================");
  console.log("BENCHMARK COMPLETE");
  console.log("==========================================================");
}

main().catch((err) => {
  console.error("Fatal benchmark error:", err);
  process.exit(1);
});
