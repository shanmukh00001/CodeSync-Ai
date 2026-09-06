const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { performance } = require('perf_hooks');
const Problem = require('./models/Problem');
const { generateCppHarness } = require('./services/cppHarnessService');
const executionService = require('./services/executionService');
const { parseHarnessOutput, compareOutput } = require('./services/outputComparatorService');

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/codesync_ai';

// Valid standard C++ solutions
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

async function instrumentedTestCase(problem, testCase, code, testIndex) {
    const isHidden = testCase.isHidden === true;
    const t0 = performance.now();

    // 1. Harness generation
    const tHarnessStart = performance.now();
    const harnessResult = generateCppHarness({
        solutionCode: code,
        problem,
        testCase,
    });
    const harnessGenMs = performance.now() - tHarnessStart;

    // 2. Execution / Piston HTTP
    const tPistonStart = performance.now();
    const execResult = await executionService.execute({
        language: 'cpp',
        sourceCode: harnessResult.source,
    });
    const pistonHttpMs = performance.now() - tPistonStart;

    // Compile & Run timings returned from Piston/executionService
    const compileTimeMs = execResult.compile?.cpuTime ?? (execResult.compile?.wallTime ? execResult.compile.wallTime : 0);
    const runTimeMs = execResult.run?.cpuTime ?? (execResult.run?.wallTime ? execResult.run.wallTime : 0);

    // 3. Harness parsing
    const parsed = parseHarnessOutput(execResult.stdout || execResult.run?.stdout || '');

    // 4. Comparator
    const tCompStart = performance.now();
    let comparatorMs = 0;
    if (parsed.success && parsed.hasPayload) {
        compareOutput({
            expected: testCase.expectedOutput,
            actual: parsed.payload,
            comparatorType: problem.outputComparator,
        });
        comparatorMs = performance.now() - tCompStart;
    }

    const totalMs = performance.now() - t0;

    return {
        testCaseIndex: testIndex,
        isHidden,
        harnessGenMs,
        pistonHttpMs,
        compileTimeMs,
        runTimeMs,
        comparatorMs,
        totalMs,
        status: execResult.status
    };
}

async function profileScenario(scenarioName, slug, code, isSubmit) {
    console.log(`\n======================================================`);
    console.log(`PROFILING SCENARIO: ${scenarioName} (${isSubmit ? 'Submit - All Tests' : 'Run - Visible Tests Only'})`);
    console.log(`======================================================`);

    const tTotalStart = performance.now();

    // 1. Validation & DB problem loading
    const tDbStart = performance.now();
    const problem = await Problem.findOne({ slug });
    const dbLoadMs = performance.now() - tDbStart;

    if (!problem) {
        throw new Error(`Problem not found for slug: ${slug}`);
    }

    // 2. Filter test cases
    const testCasesToRun = isSubmit 
        ? problem.testCases 
        : problem.testCases.filter(tc => !tc.isHidden);

    const testRunnerStart = performance.now();
    const perTestCaseMetrics = [];

    for (let i = 0; i < testCasesToRun.length; i++) {
        const tc = testCasesToRun[i];
        const metric = await instrumentedTestCase(problem, tc, code, i + 1);
        perTestCaseMetrics.push(metric);
    }

    const testRunnerDurationMs = performance.now() - testRunnerStart;
    const totalBackendDurationMs = performance.now() - tTotalStart;

    // Aggregates
    const totalHarnessMs = perTestCaseMetrics.reduce((acc, m) => acc + m.harnessGenMs, 0);
    const totalPistonHttpMs = perTestCaseMetrics.reduce((acc, m) => acc + m.pistonHttpMs, 0);
    const totalCompileMs = perTestCaseMetrics.reduce((acc, m) => acc + (m.compileTimeMs || 0), 0);
    const totalRunMs = perTestCaseMetrics.reduce((acc, m) => acc + (m.runTimeMs || 0), 0);
    const totalComparatorMs = perTestCaseMetrics.reduce((acc, m) => acc + m.comparatorMs, 0);

    console.log(`Problem: ${problem.title} (${slug})`);
    console.log(`Total Test Cases: ${testCasesToRun.length} (${testCasesToRun.filter(t => !t.isHidden).length} visible, ${testCasesToRun.filter(t => t.isHidden).length} hidden)`);
    console.log(`DB Loading Time: ${dbLoadMs.toFixed(2)} ms`);
    console.log(`Total Test Runner Time: ${testRunnerDurationMs.toFixed(2)} ms`);
    console.log(`Total Backend Request Time: ${totalBackendDurationMs.toFixed(2)} ms\n`);

    console.log(`--- Per-Test-Case Breakdown ---`);
    console.table(perTestCaseMetrics.map(m => ({
        '#': m.testCaseIndex,
        'Type': m.isHidden ? 'HIDDEN' : 'VISIBLE',
        'Harness (ms)': m.harnessGenMs.toFixed(3),
        'Piston HTTP (ms)': m.pistonHttpMs.toFixed(2),
        'Piston Compile (ms)': m.compileTimeMs ? m.compileTimeMs.toFixed(2) : 'N/A',
        'Piston Run (ms)': m.runTimeMs ? m.runTimeMs.toFixed(2) : 'N/A',
        'Comp (ms)': m.comparatorMs.toFixed(3),
        'Total (ms)': m.totalMs.toFixed(2)
    })));

    console.log(`--- Aggregate Breakdown ---`);
    console.log(`Total Harness Generation: ${totalHarnessMs.toFixed(2)} ms (${((totalHarnessMs / totalBackendDurationMs) * 100).toFixed(2)}%)`);
    console.log(`Total Piston HTTP (GCC compile + execute): ${totalPistonHttpMs.toFixed(2)} ms (${((totalPistonHttpMs / totalBackendDurationMs) * 100).toFixed(2)}%)`);
    console.log(`Total Comparator Time: ${totalComparatorMs.toFixed(2)} ms (${((totalComparatorMs / totalBackendDurationMs) * 100).toFixed(2)}%)`);
    console.log(`DB Loading & Overhead: ${dbLoadMs.toFixed(2)} ms (${((dbLoadMs / totalBackendDurationMs) * 100).toFixed(2)}%)`);
    console.log(`Backend Request Total: ${totalBackendDurationMs.toFixed(2)} ms`);

    return {
        scenarioName,
        slug,
        isSubmit,
        testCaseCount: testCasesToRun.length,
        visibleCount: testCasesToRun.filter(t => !t.isHidden).length,
        hiddenCount: testCasesToRun.filter(t => t.isHidden).length,
        dbLoadMs,
        testRunnerDurationMs,
        totalBackendDurationMs,
        totalHarnessMs,
        totalPistonHttpMs,
        totalCompileMs,
        totalRunMs,
        totalComparatorMs,
        perTestCaseMetrics
    };
}

async function runProfilingSuite() {
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB for execution profiling.\n');

    try {
        const results = [];
        // 1. Two Sum Run
        results.push(await profileScenario('Two Sum - Run', 'two-sum', TWO_SUM_CODE, false));
        // 2. Two Sum Submit
        results.push(await profileScenario('Two Sum - Submit', 'two-sum', TWO_SUM_CODE, true));
        // 3. Medium Problem Run (Longest Substring Without Repeating Characters)
        results.push(await profileScenario('Longest Unique Substring - Run', 'longest-unique-substring', LONGEST_SUBSTR_CODE, false));
        // 4. Medium Problem Submit (Longest Substring Without Repeating Characters)
        results.push(await profileScenario('Longest Unique Substring - Submit', 'longest-unique-substring', LONGEST_SUBSTR_CODE, true));

        console.log('\n======================================================');
        console.log('SUMMARY TABLE OF PROFILING RESULTS');
        console.log('======================================================');
        console.table(results.map(r => ({
            'Scenario': r.scenarioName,
            'Tests': r.testCaseCount,
            'Backend Total (ms)': r.totalBackendDurationMs.toFixed(2),
            'Piston HTTP Total (ms)': r.totalPistonHttpMs.toFixed(2),
            'Piston %': ((r.totalPistonHttpMs / r.totalBackendDurationMs) * 100).toFixed(1) + '%',
            'Avg / Test (ms)': (r.totalBackendDurationMs / r.testCaseCount).toFixed(2),
            'Harness Total (ms)': r.totalHarnessMs.toFixed(2),
            'Comp Total (ms)': r.totalComparatorMs.toFixed(2),
            'DB Load (ms)': r.dbLoadMs.toFixed(2)
        })));

    } catch (err) {
        console.error('Error during profiling:', err);
    } finally {
        await mongoose.disconnect();
        console.log('\nDisconnected from MongoDB.');
    }
}

runProfilingSuite();
