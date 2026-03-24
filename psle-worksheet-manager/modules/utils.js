// modules/utils.js
// Shared utilities available to all modules (loaded first via index.html).

/**
 * HTML-escape a value for safe insertion into template literals.
 * Handles null/undefined gracefully.
 */
function _esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;");
}

/**
 * Strips a leading option label from an MCQ option string.
 * Handles formats like "A. text", "B) text", "(C) text" (case-insensitive).
 * Used so renderers that add their own A/B/C/D prefix don't double-up
 * on options that were scraped with the prefix already included.
 */
function _stripOptionPrefix(str) {
  return String(str ?? "").replace(/^\(?[A-Da-d][.)]\)?\s*/, "");
}
