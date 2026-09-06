const pistonService = require("./pistonService");

/**
 * Mapping between CodeSync language identifiers and Piston language/version specs.
 */
const LANGUAGE_CONFIG = {
  cpp: {
    pistonLanguage: "c++",
    pistonVersion: "10.2.0",
    defaultFilename: "main.cpp",
  },
  "c++": {
    pistonLanguage: "c++",
    pistonVersion: "10.2.0",
    defaultFilename: "main.cpp",
  },
};

/**
 * Normalizes raw stage results (compile or run) from Piston.
 * 
 * @param {Object|null} stage
 * @returns {Object|null}
 */
function normalizeStageResult(stage) {
  if (!stage || typeof stage !== "object") {
    return null;
  }

  return {
    code: stage.code ?? null,
    signal: stage.signal ?? null,
    status: stage.status ?? null,
    stdout: typeof stage.stdout === "string" ? stage.stdout : "",
    stderr: typeof stage.stderr === "string" ? stage.stderr : "",
    output: typeof stage.output === "string" ? stage.output : "",
    message: stage.message ?? null,
    cpuTime: typeof stage.cpu_time === "number" ? stage.cpu_time : null,
    wallTime: typeof stage.wall_time === "number" ? stage.wall_time : null,
    memory: typeof stage.memory === "number" ? stage.memory : null,
  };
}

/**
 * Evaluates the overall execution status from normalized compile and run stages.
 * 
 * @param {Object|null} compile
 * @param {Object|null} run
 * @returns {string} "success" | "compilation_error" | "runtime_error" | "time_limit_exceeded"
 */
function deriveStatus(compile, run) {
  // 1. Check compilation stage if present
  if (compile) {
    if (compile.status === "TO") {
      return "time_limit_exceeded";
    }
    if (compile.code !== 0 || compile.signal !== null) {
      return "compilation_error";
    }
  }

  // 2. Check run stage if present
  if (run) {
    if (run.status === "TO") {
      return "time_limit_exceeded";
    }
    if (run.code !== 0 || run.signal !== null) {
      return "runtime_error";
    }
    return "success";
  }

  // If there was compile only and it succeeded with code 0
  if (compile && compile.code === 0) {
    return "success";
  }

  return "internal_error";
}

/**
 * Executes source code through the sandboxed Piston execution engine
 * and returns a normalized execution result.
 * 
 * @param {Object} params
 * @param {string} params.language - CodeSync language identifier (e.g. "cpp", "c++")
 * @param {string} [params.sourceCode] - Source code string (if executing single file)
 * @param {Array<{ name?: string, content: string }>} [params.files] - Source files array
 * @param {string} [params.stdin=""] - Standard input for program execution
 * @param {Array<string>} [params.args=[]] - Command-line arguments
 * @param {number} [params.compileTimeout] - Compilation timeout in ms
 * @param {number} [params.runTimeout] - Execution timeout in ms
 * @param {number} [params.compileMemoryLimit] - Max compile memory limit in bytes
 * @param {number} [params.runMemoryLimit] - Max run memory limit in bytes
 * @returns {Promise<{
 *   status: "success" | "compilation_error" | "runtime_error" | "time_limit_exceeded" | "internal_error",
 *   stdout: string,
 *   stderr: string,
 *   compile: Object|null,
 *   run: Object|null,
 *   error?: string
 * }>}
 */
async function execute({
  language,
  sourceCode,
  files,
  stdin = "",
  args = [],
  compileTimeout,
  runTimeout,
  compileMemoryLimit,
  runMemoryLimit,
}) {
  if (!language) {
    return {
      status: "internal_error",
      stdout: "",
      stderr: "Execution error: language is required",
      compile: null,
      run: null,
      error: "Language is required",
    };
  }

  const langKey = language.toLowerCase();
  const langConfig = LANGUAGE_CONFIG[langKey];

  if (!langConfig) {
    return {
      status: "internal_error",
      stdout: "",
      stderr: `Execution error: unsupported language '${language}'. Supported languages: ${Object.keys(LANGUAGE_CONFIG).join(", ")}`,
      compile: null,
      run: null,
      error: `Unsupported language: ${language}`,
    };
  }

  let executionFiles = files;
  if (!executionFiles || !Array.isArray(executionFiles) || executionFiles.length === 0) {
    if (typeof sourceCode === "string" && sourceCode.length > 0) {
      executionFiles = [
        {
          name: langConfig.defaultFilename,
          content: sourceCode,
        },
      ];
    } else {
      return {
        status: "internal_error",
        stdout: "",
        stderr: "Execution error: sourceCode or non-empty files array is required",
        compile: null,
        run: null,
        error: "Missing source code",
      };
    }
  }

  try {
    const rawResult = await pistonService.executeCode({
      language: langConfig.pistonLanguage,
      version: langConfig.pistonVersion,
      files: executionFiles,
      stdin,
      args,
      compileTimeout,
      runTimeout,
      compileMemoryLimit,
      runMemoryLimit,
    });

    const compile = normalizeStageResult(rawResult.compile);
    const run = normalizeStageResult(rawResult.run);
    const status = deriveStatus(compile, run);

    // Provide primary stdout and stderr based on stage
    let stdout = "";
    let stderr = "";

    if (status === "compilation_error" && compile) {
      stdout = compile.stdout || "";
      stderr = compile.stderr || compile.output || "";
    } else if (run) {
      stdout = run.stdout || "";
      stderr = run.stderr || (run.status === "TO" ? "Time Limit Exceeded" : "");
    } else if (compile) {
      stdout = compile.stdout || "";
      stderr = compile.stderr || "";
    }

    return {
      status,
      stdout,
      stderr,
      compile,
      run,
    };
  } catch (error) {
    return {
      status: "internal_error",
      stdout: "",
      stderr: error.message || "An unexpected error occurred during execution",
      compile: null,
      run: null,
      error: error.message,
    };
  }
}

module.exports = {
  execute,
  LANGUAGE_CONFIG,
};
