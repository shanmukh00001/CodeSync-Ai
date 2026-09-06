require("dotenv").config();
const executionService = require("./services/executionService");
const pistonService = require("./services/pistonService");

async function runVerification() {
  console.log("==================================================");
  console.log("Verifying CodeSync Execution Service & Piston Integration");
  console.log("==================================================");

  let passed = 0;
  let totalTests = 0;

  // 1. Verify Piston Connectivity
  totalTests++;
  try {
    console.log("\n[Test 1] Checking Piston API runtimes endpoint...");
    const runtimes = await pistonService.getRuntimes();
    const hasCpp = runtimes.some(
      (r) => r.language === "c++" && r.version === "10.2.0"
    );

    if (!hasCpp) {
      throw new Error("C++ 10.2.0 runtime not found in Piston runtimes catalog");
    }

    console.log(`[PASS] Piston is reachable at ${pistonService.getPistonBaseUrl()}`);
    console.log(`       Found ${runtimes.length} runtimes (C++ 10.2.0 verified)`);
    passed++;
  } catch (err) {
    console.error("[FAIL] Piston reachability test failed:", err.message);
  }

  // 2. Successful C++ Execution Test
  totalTests++;
  try {
    console.log("\n[Test 2] Executing valid C++ program via executionService.execute()...");
    const cppCode = `#include <iostream>

int main() {
    std::cout << "CodeSync Piston works!";
    return 0;
}`;

    const result = await executionService.execute({
      language: "cpp",
      sourceCode: cppCode,
    });

    console.log("Execution Result Summary:", {
      status: result.status,
      stdout: result.stdout,
      compileCode: result.compile?.code,
      runCode: result.run?.code,
      cpuTime: result.run?.cpuTime,
      memory: result.run?.memory,
    });

    if (result.status !== "success") {
      throw new Error(`Expected status 'success', got '${result.status}'. stderr: ${result.stderr}`);
    }

    if (!result.stdout.includes("CodeSync Piston works!")) {
      throw new Error(`Expected stdout to contain 'CodeSync Piston works!', got '${result.stdout}'`);
    }

    if (result.compile?.code !== 0) {
      throw new Error(`Expected compilation exit code 0, got ${result.compile?.code}`);
    }

    if (result.run?.code !== 0) {
      throw new Error(`Expected run exit code 0, got ${result.run?.code}`);
    }

    console.log("[PASS] C++ execution succeeded with normalized result output");
    passed++;
  } catch (err) {
    console.error("[FAIL] C++ execution test failed:", err.message);
  }

  // 3. Compilation Error Normalization Test
  totalTests++;
  try {
    console.log("\n[Test 3] Testing compilation error normalization...");
    const badCode = `#include <iostream>
int main() {
    syntax_error_here;
    return 0;
}`;

    const result = await executionService.execute({
      language: "cpp",
      sourceCode: badCode,
    });

    if (result.status !== "compilation_error") {
      throw new Error(`Expected status 'compilation_error', got '${result.status}'`);
    }

    if (!result.stderr && !result.compile?.output) {
      throw new Error("Expected compilation error diagnostic in stderr/compile.output");
    }

    console.log(`[PASS] Correctly mapped syntax error to 'compilation_error'`);
    console.log(`       Captured compiler error message: ${result.stderr.split("\n")[0]}`);
    passed++;
  } catch (err) {
    console.error("[FAIL] Compilation error test failed:", err.message);
  }

  // 4. Runtime Error Normalization Test
  totalTests++;
  try {
    console.log("\n[Test 4] Testing runtime error normalization (SIGSEGV/SIGABRT/Exit code)...");
    const runtimeErrCode = `#include <iostream>
#include <cstdlib>

int main() {
    int* ptr = nullptr;
    *ptr = 42; // Causes SIGSEGV
    return 0;
}`;

    const result = await executionService.execute({
      language: "cpp",
      sourceCode: runtimeErrCode,
    });

    if (result.status !== "runtime_error") {
      throw new Error(`Expected status 'runtime_error', got '${result.status}'`);
    }

    console.log(`[PASS] Correctly mapped crash to 'runtime_error' (Signal: ${result.run?.signal})`);
    passed++;
  } catch (err) {
    console.error("[FAIL] Runtime error test failed:", err.message);
  }

  // 5. Unsupported Language Error Normalization Test
  totalTests++;
  try {
    console.log("\n[Test 5] Testing unsupported language error handling...");
    const result = await executionService.execute({
      language: "brainfuck",
      sourceCode: "++>+++",
    });

    if (result.status !== "internal_error") {
      throw new Error(`Expected status 'internal_error', got '${result.status}'`);
    }

    console.log("[PASS] Correctly rejected unsupported language gracefully");
    passed++;
  } catch (err) {
    console.error("[FAIL] Unsupported language test failed:", err.message);
  }

  console.log("\n==================================================");
  console.log(`Verification finished: ${passed}/${totalTests} tests passed successfully.`);
  console.log("==================================================");

  if (passed !== totalTests) {
    process.exit(1);
  }
}

runVerification();
