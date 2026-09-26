const http = require("http");
const https = require("https");
const { URL } = require("url");

const DEFAULT_LOCAL_PISTON_URL = "http://127.0.0.1:2000";

/**
 * Returns the configured Piston base URL.
 * Defaults to http://127.0.0.1:2000 if not specified in environment.
 * 
 * @returns {string}
 */
function getPistonBaseUrl() {
  return process.env.PISTON_URL || process.env.PISTON_API_URL || DEFAULT_LOCAL_PISTON_URL;
}

/**
 * Builds a valid absolute URL for Piston endpoints regardless of base format.
 *
 * Examples:
 *   - "http://127.0.0.1:2000" + "/execute" -> "http://127.0.0.1:2000/api/v2/execute"
 *   - "http://127.0.0.1:2000/api/v2" + "/execute" -> "http://127.0.0.1:2000/api/v2/execute"
 *   - "https://emkc.org/api/v2/piston" + "/execute" -> "https://emkc.org/api/v2/piston/execute"
 *
 * @param {string} baseUrl
 * @param {string} endpoint
 * @returns {URL}
 */
function buildPistonUrl(baseUrl, endpoint) {
  const cleanBase = (baseUrl || DEFAULT_LOCAL_PISTON_URL).replace(/\/+$/, "");
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : "/" + endpoint;

  if (cleanBase.endsWith("/api/v2/piston")) {
    return new URL(cleanBase + cleanEndpoint.replace(/^\/api\/v2/, ""));
  }
  if (cleanBase.endsWith("/api/v2")) {
    return new URL(cleanBase + cleanEndpoint.replace(/^\/api\/v2/, ""));
  }
  return new URL(cleanBase + "/api/v2" + cleanEndpoint.replace(/^\/api\/v2/, ""));
}

/**
 * Internal helper to send execute request to a specific Piston base URL.
 */
function _sendExecuteRequest(baseUrl, payload) {
  const payloadStr = JSON.stringify(payload);
  const url = buildPistonUrl(baseUrl, "/execute");
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
      timeout: (payload.compile_timeout || 60000) + (payload.run_timeout || 15000) + 5000,
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
          const isHtml = data.trim().startsWith("<!DOCTYPE") || data.trim().startsWith("<html");
          if (isHtml) {
            return reject(
              new Error(
                `Piston server at ${baseUrl} returned an HTML error page (HTTP ${res.statusCode}). It may be offline or blocked by your network firewall. Please run 'docker start piston_api'.`
              )
            );
          }
          return reject(
            new Error(
              `Piston returned invalid JSON response (HTTP ${res.statusCode}): ${data.slice(0, 150)}`
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
 * Executes source code files against the Piston execute endpoint.
 * 
 * @param {Object} params
 * @returns {Promise<Object>} Raw JSON response returned by Piston API
 */
async function executeCode({
  language,
  version,
  files,
  stdin = "",
  args = [],
  compileArgs,
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
    ...(Array.isArray(compileArgs) && compileArgs.length > 0 ? { compile_args: compileArgs } : {}),
  };

  if (typeof compileTimeout === "number") {
    // Clamp compile_timeout to 10000ms max (Piston standard default)
    payload.compile_timeout = Math.min(compileTimeout, 10000);
  }
  if (typeof runTimeout === "number") {
    // Piston instances typically have a configured run_timeout limit of 3000ms.
    // If run_timeout exceeds this limit, Piston rejects with HTTP 400. Clamp to 3000ms.
    payload.run_timeout = Math.min(runTimeout, 3000);
  }
  if (typeof compileMemoryLimit === "number") {
    payload.compile_memory_limit = compileMemoryLimit;
  }
  if (typeof runMemoryLimit === "number") {
    payload.run_memory_limit = runMemoryLimit;
  }

  const primaryUrl = getPistonBaseUrl();
  try {
    return await _sendExecuteRequest(primaryUrl, payload);
  } catch (primaryErr) {
    // If Piston returned HTTP 400 because of run_timeout limit, retry without run_timeout so Piston uses its default
    if (primaryErr?.message && primaryErr.message.includes("run_timeout cannot exceed")) {
      try {
        const payloadNoTimeout = { ...payload };
        delete payloadNoTimeout.run_timeout;
        return await _sendExecuteRequest(primaryUrl, payloadNoTimeout);
      } catch (retryErr) {
        // Continue to fallback if retry also failed
      }
    }

    // If primary failed and is not local Piston, attempt fallback to local Piston container
    if (!primaryUrl.includes("127.0.0.1") && !primaryUrl.includes("localhost")) {
      try {
        return await _sendExecuteRequest(DEFAULT_LOCAL_PISTON_URL, payload);
      } catch (fallbackErr) {
        if (fallbackErr?.message && fallbackErr.message.includes("run_timeout cannot exceed")) {
          try {
            const payloadNoTimeout = { ...payload };
            delete payloadNoTimeout.run_timeout;
            return await _sendExecuteRequest(DEFAULT_LOCAL_PISTON_URL, payloadNoTimeout);
          } catch {
            // ignore
          }
        }
        // Propagate the original error if fallback also failed
        throw primaryErr;
      }
    }
    throw primaryErr;
  }
}

/**
 * Internal helper to fetch runtimes from a specific base URL.
 */
function _fetchRuntimes(baseUrl) {
  const url = buildPistonUrl(baseUrl, "/runtimes");
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

/**
 * Checks connectivity and retrieves available runtimes from Piston with automatic fallback.
 * 
 * @returns {Promise<Array<Object>>}
 */
async function getRuntimes() {
  const primaryUrl = getPistonBaseUrl();
  try {
    return await _fetchRuntimes(primaryUrl);
  } catch (primaryErr) {
    if (!primaryUrl.includes("127.0.0.1") && !primaryUrl.includes("localhost")) {
      try {
        return await _fetchRuntimes(DEFAULT_LOCAL_PISTON_URL);
      } catch {
        throw primaryErr;
      }
    }
    throw primaryErr;
  }
}

module.exports = {
  getPistonBaseUrl,
  executeCode,
  getRuntimes,
  buildPistonUrl,
};
