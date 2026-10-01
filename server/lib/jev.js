// Minimal TypeSafe System One client with a timeout and retries for rate
// limits and overload responses.

const RETRYABLE = new Set([429, 500, 502, 503, 504, 529]);
const TIMEOUT_MS = 20000;
const MAX_ATTEMPTS = 3;

class JevError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.name = "JevError";
    this.status = status;
    this.detail = detail;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function ask(state, questions, { signal } = {}) {
  const config = require("../config");
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;
    try {
      const res = await fetch(config.typesafeUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.typesafeApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "jev-latest", state, questions }),
        signal: combined,
      });
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text.slice(0, 300) };
      }
      if (res.ok && data.answers) return data;
      lastError = new JevError(describe(res.status), res.status, data);
      if (!RETRYABLE.has(res.status)) throw lastError;
    } catch (err) {
      if (err instanceof JevError && !RETRYABLE.has(err.status)) throw err;
      if (signal?.aborted) throw new JevError("Request cancelled", 499);
      lastError = err instanceof JevError ? err : new JevError(err.name === "TimeoutError" ? "Jev timed out" : `Could not reach Jev: ${err.message}`, 504);
    }
    if (attempt < MAX_ATTEMPTS) await sleep(300 * 3 ** (attempt - 1) + Math.random() * 200);
  }
  throw lastError;
}

function describe(status) {
  switch (status) {
    case 401: return "The TypeSafe API key is missing or invalid";
    case 422: return "Jev rejected the request format";
    case 429: return "Jev rate limit reached; try again in a moment";
    case 529: return "Jev is temporarily overloaded; try again in a moment";
    default: return `Jev request failed (${status})`;
  }
}

module.exports = { ask, JevError };
