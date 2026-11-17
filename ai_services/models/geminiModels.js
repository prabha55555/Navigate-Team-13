/**
 * Gemini model selection shared by every AI caller.
 *
 * Google retires model versions regularly (gemini-pro, 1.5 and 2.0 are gone;
 * the configured GEMINI_MODEL=gemini-2.0-flash now returns 404 "no longer
 * available"), which silently pushed every AI feature onto its slow fallback.
 * Callers now try the configured model first and, when the API reports the
 * model as unavailable, move on to known-good fallbacks. A model that 404s is
 * remembered so later requests skip it immediately.
 */

// Names that are known to be retired: skipped without a network round-trip.
const RETIRED_MODEL = /^gemini-(pro(-vision)?$|1\.|2\.0)/i;

// Tried in order after the requested/configured model.
const FALLBACK_MODELS = ['gemini-3.5-flash', 'gemini-flash-lite-latest'];

// Thinking models spend part of maxOutputTokens on reasoning; keep enough room
// for the actual answer.
const MIN_OUTPUT_TOKENS = 2048;

const unavailableModels = new Set();

const isGeminiName = (name) => typeof name === 'string' && /^gemini-/i.test(name.trim());

function isUsable(name) {
  return isGeminiName(name) && !RETIRED_MODEL.test(name.trim()) && !unavailableModels.has(name.trim());
}

/**
 * Ordered list of models to try for a request.
 * @param {string} [requested] - model asked for by the caller (may be stale or non-Gemini)
 */
function candidateModels(requested) {
  const ordered = [requested, process.env.GEMINI_MODEL, ...FALLBACK_MODELS]
    .filter(isUsable)
    .map(name => name.trim());
  const unique = [...new Set(ordered)];
  // If everything has been marked unavailable, still try the fallbacks once more.
  return unique.length > 0 ? unique : [...FALLBACK_MODELS];
}

/**
 * Whether an API error means "this model does not exist / is retired" (try the
 * next model) rather than a transient failure.
 */
function isModelUnavailableError(status, message) {
  const text = String(message || '');
  return status === 404 ||
    (status === 400 && /model|not found|not supported|no longer available/i.test(text) && !/api key/i.test(text));
}

/**
 * Whether the error is per-model capacity (rate limit / overloaded). Quotas are
 * tracked per model (the free tier allows only a few requests per minute), so
 * the next candidate model can usually still serve the request.
 */
function isTryNextModelError(status) {
  return status === 429 || status === 503;
}

function markUnavailable(name) {
  if (name) {
    unavailableModels.add(String(name).trim());
    console.warn(`Gemini model "${name}" is unavailable; falling back to another model`);
  }
}

module.exports = {
  RETIRED_MODEL,
  FALLBACK_MODELS,
  MIN_OUTPUT_TOKENS,
  candidateModels,
  isModelUnavailableError,
  isTryNextModelError,
  markUnavailable
};
