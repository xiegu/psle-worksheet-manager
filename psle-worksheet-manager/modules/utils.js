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
