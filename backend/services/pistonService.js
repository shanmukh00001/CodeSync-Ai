const http = require("http");
const https = require("https");
const { URL } = require("url");

/**
 * Returns the configured Piston base URL.
 * Defaults to http://localhost:2000 if not specified in environment.
 * 
 * @returns {string}
 */
function getPistonBaseUrl() {
  return process.env.PISTON_URL || "http://localhost:2000";
}

/**
 * Executes source code files against the Piston /api/v2/execute endpoint.
 * 
 * @param {Object} params
 * @param {string} params.language - Piston language identifier (e.g. "c++")
 * @param {string} params.version - Piston language version (e.g. "10.2.0")
 * @param {Array<{ name?: string, content: string, encoding?: string }>} params.files - Source files to execute
 * @param {string} [params.stdin=""] - Standard input passed to program
 * @param {Array<string>} [params.args=[]] - CLI arguments passed to program
 * @param {number} [params.compileTimeout] - Max compile time in ms
 * @param {number} [params.runTimeout] - Max run time in ms
 * @param {number} [params.compileMemoryLimit] - Max compile memory limit in bytes
 * @param {number} [params.runMemoryLimit] - Max run memory limit in bytes
 * @returns {Promise<Object>} Raw JSON response returned by Piston API
 */
async function executeCode({
  language,
  version,
  files,
  stdin = "",
  args = [],
  compileTimeout,
  runTimeout,
  compileMemoryLimit,
  runMemoryLimit,
}) {
  if (!language || typeof language !== "string") {
    throw new Error("Piston execution error: 'language' must be a non-empty string");
  }

  if (!version || typeof version !== "string") {
    throw new Error("Piston execution error: 'version' must be a non-empty string");
  }

  if (!Array.isArray(files) || files.length === 0) {
    throw new Error("Piston execution error: 'files' must be a non-empty array");
  }

  for (const file of files) {
    if (!file || typeof file.content !== "string") {
      throw new Error("Piston execution error: Each file in 'files' must have a string 'content'");
    }
  }

  const payload = {
    language,
    version,
    files,
    stdin: typeof stdin === "string" ? stdin : "",
    args: Array.isArray(args) ? args : [],
  };

  if (typeof compileTimeout === "number") {
    payload.compile_timeout = compileTimeout;
  }
  if (typeof runTimeout === "number") {
    payload.run_timeout = runTimeout;
  }
  if (typeof compileMemoryLimit === "number") {
    payload.compile_memory_limit = compileMemoryLimit;
  }
  if (typeof runMemoryLimit === "number") {
    payload.run_memory_limit = runMemoryLimit;
  }

  const payloadStr = JSON.stringify(payload);
  const baseUrl = getPistonBaseUrl();
  const url = new URL("/api/v2/execute", baseUrl);
  const isHttps = url.protocol === "https:";
  const client = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const requestOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payloadStr),
      },
      timeout: (payload.compile_timeout || 60000) + (payload.run_timeout || 15000) + 10000,
    };

    const req = client.request(requestOptions, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch (parseError) {
          return reject(
            new Error(
              `Piston returned invalid JSON response (HTTP ${res.statusCode}): ${data.slice(0, 200)}`
            )
          );
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          const message = parsed?.message || data || `HTTP ${res.statusCode}`;
          const err = new Error(`Piston API returned error (HTTP ${res.statusCode}): ${message}`);
          err.statusCode = res.statusCode;
          err.response = parsed;
          return reject(err);
        }

        resolve(parsed);
      });
    });

    req.on("error", (err) => {
      const wrappedError = new Error(`Failed to connect to Piston execution engine at ${baseUrl}: ${err.message}`);
      wrappedError.originalError = err;
      wrappedError.code = err.code || "PISTON_CONNECTION_ERROR";
      reject(wrappedError);
    });

    req.on("timeout", () => {
      req.destroy();
      const timeoutError = new Error(`Connection to Piston execution engine at ${baseUrl} timed out`);
      timeoutError.code = "PISTON_HTTP_TIMEOUT";
      reject(timeoutError);
    });

    req.write(payloadStr);
    req.end();
  });
}

/**
 * Checks connectivity and retrieves available runtimes from Piston.
 * 
 * @returns {Promise<Array<Object>>}
 */
async function getRuntimes() {
  const baseUrl = getPistonBaseUrl();
  const url = new URL("/api/v2/runtimes", baseUrl);
  const isHttps = url.protocol === "https:";
  const client = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.request(
      {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        timeout: 5000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (err) {
            reject(new Error(`Failed to parse runtimes response: ${err.message}`));
          }
        });
      }
    );

    req.on("error", (err) => {
      reject(new Error(`Failed to reach Piston at ${baseUrl}: ${err.message}`));
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Timed out connecting to Piston at ${baseUrl}`));
    });

    req.end();
  });
}

module.exports = {
  getPistonBaseUrl,
  executeCode,
  getRuntimes,
};
