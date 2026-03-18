// modules/storage.js
// localStorage CRUD helpers for worksheet persistence.
// All modules must go through these functions — never call localStorage directly.

const STORAGE_KEY = "psle_worksheets";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("storage: failed to parse localStorage data", e);
    return [];
  }
}

function _save(worksheets) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(worksheets));
  } catch (e) {
    console.error("storage: failed to write to localStorage", e);
    throw new Error("Could not save — storage may be full.");
  }
}

function _today() {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Create or update a worksheet.
 * If ws.id exists in storage, it is replaced (version incremented, updatedAt refreshed).
 * If ws.id is absent or not found, a new record is created with a generated id.
 * @param {object} ws - Worksheet object (partial or full)
 * @returns {object} The saved worksheet with id, createdAt, updatedAt, version set
 */
function saveWorksheet(ws) {
  const worksheets = _load();
  const now = _today();

  if (ws.id) {
    const idx = worksheets.findIndex(w => w.id === ws.id);
    if (idx !== -1) {
      const existing = worksheets[idx];
      const updated = {
        ...existing,
        ...ws,
        updatedAt: now,
        version: (existing.version || 1) + 1
      };
      worksheets[idx] = updated;
      _save(worksheets);
      return updated;
    }
  }

  // New worksheet
  const created = {
    title: "",
    level: "",
    strand: "",
    topic: "",
    difficulty: "Standard",
    type: "Practice",
    version: 1,
    status: "active",
    questions: [],
    notes: "",
    ...ws,
    id: "ws_" + Date.now(),
    createdAt: now,
    updatedAt: now
  };
  worksheets.push(created);
  _save(worksheets);
  return created;
}

/**
 * Retrieve a single worksheet by id.
 * @param {string} id
 * @returns {object|null}
 */
function getWorksheet(id) {
  return _load().find(w => w.id === id) || null;
}

/**
 * Retrieve all worksheets, sorted by updatedAt descending (most recent first).
 * @returns {object[]}
 */
function getAllWorksheets() {
  return _load().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/**
 * Permanently delete a worksheet by id.
 * @param {string} id
 * @returns {boolean} true if deleted, false if not found
 */
function deleteWorksheet(id) {
  const worksheets = _load();
  const idx = worksheets.findIndex(w => w.id === id);
  if (idx === -1) return false;
  worksheets.splice(idx, 1);
  _save(worksheets);
  return true;
}

/**
 * Soft-delete: set status to "archived".
 * @param {string} id
 * @returns {object|null} Updated worksheet, or null if not found
 */
function archiveWorksheet(id) {
  const worksheets = _load();
  const idx = worksheets.findIndex(w => w.id === id);
  if (idx === -1) return null;
  worksheets[idx] = { ...worksheets[idx], status: "archived", updatedAt: _today() };
  _save(worksheets);
  return worksheets[idx];
}

/**
 * Restore an archived worksheet back to active.
 * @param {string} id
 * @returns {object|null} Updated worksheet, or null if not found
 */
function unarchiveWorksheet(id) {
  const worksheets = _load();
  const idx = worksheets.findIndex(w => w.id === id);
  if (idx === -1) return null;
  worksheets[idx] = { ...worksheets[idx], status: "active", updatedAt: _today() };
  _save(worksheets);
  return worksheets[idx];
}

// ---------------------------------------------------------------------------
// Export / Import (data portability)
// ---------------------------------------------------------------------------

/**
 * Download all worksheets as a JSON backup file.
 * Triggers a browser file download — no return value.
 */
function exportAll() {
  const data = {
    exportedAt: new Date().toISOString(),
    version: 1,
    worksheets: _load()
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "psle-worksheets-backup-" + _today() + ".json";
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Restore worksheets from a JSON backup.
 * Merges by id: imported records overwrite existing ones with the same id;
 * new ids are appended. Existing worksheets not in the import are kept.
 * @param {string} jsonString - Raw JSON string from a backup file
 * @returns {{ imported: number, skipped: number }} Result summary
 */
function importAll(jsonString) {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    throw new Error("Invalid backup file — could not parse JSON.");
  }

  const incoming = Array.isArray(parsed) ? parsed : parsed.worksheets;
  if (!Array.isArray(incoming)) {
    throw new Error("Invalid backup format — expected a worksheets array.");
  }

  const existing = _load();
  const existingMap = new Map(existing.map(w => [w.id, w]));

  let imported = 0;
  let skipped = 0;

  for (const ws of incoming) {
    if (!ws.id || !ws.title) { skipped++; continue; }
    existingMap.set(ws.id, ws);
    imported++;
  }

  _save(Array.from(existingMap.values()));
  return { imported, skipped };
}

/**
 * Wipe all worksheets from storage. Use with caution.
 */
function clearAll() {
  localStorage.removeItem(STORAGE_KEY);
}
