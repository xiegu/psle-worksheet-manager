// modules/storage.js
// IndexedDB storage layer for worksheet and student persistence.
// All modules must go through these functions — never access IDB or localStorage directly.
//
// Async functions: getAllWorksheets, getWorksheet, saveWorksheet, deleteWorksheet,
//   archiveWorksheet, unarchiveWorksheet, exportAll, importAll, clearAll,
//   getAllStudents, getStudent, saveStudent, deleteStudent,
//   setActiveStudentId, markQuestionsTaken, recordScore
//
// Sync functions (memory cache / localStorage):
//   getActiveStudentId, getActiveStudent, getScoresForWorksheet

const DB_NAME    = "psle_db";
const DB_VERSION = 1;
const WS_STORE   = "worksheets";
const STU_STORE  = "students";

const ACTIVE_STUDENT_KEY = "psle_active_student";

// Legacy localStorage keys — used only for one-time migration
const LS_WS_KEY  = "psle_worksheets";
const LS_STU_KEY = "psle_students";

let _db = null;
let _cachedActiveStudent = null;   // kept in sync with every saveStudent / deleteStudent call

// ---------------------------------------------------------------------------
// DB init — call once at app boot, before any other storage call
// ---------------------------------------------------------------------------

function _openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(WS_STORE)) {
        db.createObjectStore(WS_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STU_STORE)) {
        db.createObjectStore(STU_STORE, { keyPath: "id" });
      }
    };

    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

/**
 * Open IndexedDB, migrate any existing localStorage data, and prime the
 * active-student cache. Must be awaited before any other storage call.
 */
async function initDB() {
  _db = await _openDB();
  await _migrateFromLocalStorage();
  await _migrateOrigin();
  const activeId = localStorage.getItem(ACTIVE_STUDENT_KEY);
  if (activeId) _cachedActiveStudent = await getStudent(activeId);
}

// One-time migration: if IDB is empty but localStorage has data, move it over.
async function _migrateFromLocalStorage() {
  const existing = await getAllWorksheets();
  if (existing.length > 0) return;   // IDB already has data — skip

  try {
    const wsRaw  = localStorage.getItem(LS_WS_KEY);
    const stuRaw = localStorage.getItem(LS_STU_KEY);

    if (wsRaw) {
      const wsList = JSON.parse(wsRaw);
      if (Array.isArray(wsList) && wsList.length > 0) {
        const tx = _db.transaction(WS_STORE, "readwrite");
        const st = tx.objectStore(WS_STORE);
        for (const ws of wsList) { if (ws.id) st.put(ws); }
        await _txDone(tx);
        console.log(`[storage] Migrated ${wsList.length} worksheets from localStorage → IndexedDB`);
        localStorage.removeItem(LS_WS_KEY);
      }
    }

    if (stuRaw) {
      const stuList = JSON.parse(stuRaw);
      if (Array.isArray(stuList) && stuList.length > 0) {
        const tx = _db.transaction(STU_STORE, "readwrite");
        const st = tx.objectStore(STU_STORE);
        for (const s of stuList) { if (s.id) st.put(s); }
        await _txDone(tx);
        console.log(`[storage] Migrated ${stuList.length} students from localStorage → IndexedDB`);
        localStorage.removeItem(LS_STU_KEY);
      }
    }
  } catch (e) {
    console.warn("[storage] localStorage migration failed (non-fatal):", e.message);
  }
}

// One-time migration: tag existing worksheets with origin field.
// Heuristic: any question with diagramImage → "imported" (scraped paper);
// otherwise → "built" (manually created in builder).
async function _migrateOrigin() {
  const all = await getAllWorksheets();
  const toUpdate = all.filter(ws => !ws.origin);
  if (toUpdate.length === 0) return;

  const tx = _db.transaction(WS_STORE, "readwrite");
  const st = tx.objectStore(WS_STORE);
  for (const ws of toUpdate) {
    const hasImage = (ws.questions || []).some(q => q.diagramImage);
    st.put({ ...ws, origin: hasImage ? "imported" : "built" });
  }
  await _txDone(tx);
  console.log(`[storage] Origin migration: tagged ${toUpdate.length} worksheet(s)`);
}

// ---------------------------------------------------------------------------
// Low-level IDB helpers
// ---------------------------------------------------------------------------

function _txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror    = () => reject(tx.error);
    tx.onabort    = () => reject(tx.error);
  });
}

function _storeGet(storeName, key) {
  return new Promise((resolve, reject) => {
    const req = _db.transaction(storeName, "readonly").objectStore(storeName).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror   = () => reject(req.error);
  });
}

function _storeGetAll(storeName) {
  return new Promise((resolve, reject) => {
    const req = _db.transaction(storeName, "readonly").objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = () => reject(req.error);
  });
}

async function _storePut(storeName, record) {
  const tx = _db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).put(record);
  await _txDone(tx);
}

async function _storeDelete(storeName, key) {
  const tx = _db.transaction(storeName, "readwrite");
  tx.objectStore(storeName).delete(key);
  await _txDone(tx);
}

function _today() {
  return new Date().toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Worksheet CRUD
// ---------------------------------------------------------------------------

/** @returns {Promise<object[]>} All worksheets sorted by updatedAt descending */
async function getAllWorksheets() {
  const all = await _storeGetAll(WS_STORE);
  return all.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
}

/** @returns {Promise<object|null>} */
async function getWorksheet(id) {
  return _storeGet(WS_STORE, id);
}

/**
 * Create or update a worksheet.
 * @returns {Promise<object>} The saved worksheet
 */
async function saveWorksheet(ws) {
  const now = _today();

  if (ws.id) {
    const existing = await getWorksheet(ws.id);
    if (existing) {
      const updated = { ...existing, ...ws, updatedAt: now, version: (existing.version || 1) + 1 };
      await _storePut(WS_STORE, updated);
      return updated;
    }
  }

  const created = {
    title: "", level: "", strand: "", topic: "",
    difficulty: "Standard", type: "Practice",
    origin: "built",
    version: 1, status: "active", questions: [], notes: "",
    ...ws,
    id:        "ws_" + Date.now(),
    createdAt: now,
    updatedAt: now
  };
  await _storePut(WS_STORE, created);
  return created;
}

/** @returns {Promise<boolean>} */
async function deleteWorksheet(id) {
  const existing = await getWorksheet(id);
  if (!existing) return false;
  await _storeDelete(WS_STORE, id);
  return true;
}

/** @returns {Promise<object|null>} */
async function archiveWorksheet(id) {
  const ws = await getWorksheet(id);
  if (!ws) return null;
  const updated = { ...ws, status: "archived", updatedAt: _today() };
  await _storePut(WS_STORE, updated);
  return updated;
}

/** @returns {Promise<object|null>} */
async function unarchiveWorksheet(id) {
  const ws = await getWorksheet(id);
  if (!ws) return null;
  const updated = { ...ws, status: "active", updatedAt: _today() };
  await _storePut(WS_STORE, updated);
  return updated;
}

// ---------------------------------------------------------------------------
// Export / Import
// ---------------------------------------------------------------------------

/** Triggers a browser download of all data as a JSON backup file. */
async function exportAll() {
  try {
    const data = {
      exportedAt: new Date().toISOString(),
      version:    2,
      worksheets: await getAllWorksheets(),
      students:   await getAllStudents()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "psle-worksheets-backup-" + _today() + ".json";
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    throw new Error("Export failed: " + e.message);
  }
}

/**
 * Allow only JPEG/PNG data URIs for diagram images.
 * Rejects javascript: URIs, SVG data URIs, or anything unexpected.
 * @param {*} val
 * @returns {string|null}
 */
function _sanitizeDiagramImage(val) {
  if (!val || typeof val !== "string") return null;
  if (val.startsWith("data:image/jpeg;base64,") ||
      val.startsWith("data:image/png;base64,"))  return val;
  return null;
}

/**
 * Restore from a JSON backup. Merges by id (imported records overwrite existing
 * ones with the same id; existing records not in the import are kept).
 * @param {string} jsonString
 * @returns {Promise<{imported: number, skipped: number}>}
 */
async function importAll(jsonString) {
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

  const existing    = await getAllWorksheets();
  const existingMap = new Map(existing.map(w => [w.id, w]));

  let imported = 0, skipped = 0;
  for (const ws of incoming) {
    if (!ws.id || typeof ws.id !== "string")    { skipped++; continue; }
    if (!ws.title || typeof ws.title !== "string") { skipped++; continue; }
    // Sanitize diagram images — reject anything that isn't a plain JPEG/PNG data URI
    const questions = (Array.isArray(ws.questions) ? ws.questions : []).map(q => {
      if (!q || typeof q !== "object") return null;
      const clean = { ...q };
      const img = _sanitizeDiagramImage(q.diagramImage);
      if (img) clean.diagramImage = img;
      else     delete clean.diagramImage;
      return clean;
    }).filter(Boolean);
    existingMap.set(ws.id, { origin: "imported", ...ws, questions });
    imported++;
  }

  const tx = _db.transaction(WS_STORE, "readwrite");
  const st = tx.objectStore(WS_STORE);
  for (const ws of existingMap.values()) { st.put(ws); }
  await _txDone(tx);

  // Merge student data (v2+ backups)
  if (Array.isArray(parsed.students)) {
    const existingStudents = await getAllStudents();
    const studentMap = new Map(existingStudents.map(s => [s.id, s]));
    for (const stu of parsed.students) {
      if (!stu.id || !stu.name) continue;
      studentMap.set(stu.id, stu);
    }
    const stuTx = _db.transaction(STU_STORE, "readwrite");
    const stuSt = stuTx.objectStore(STU_STORE);
    for (const s of studentMap.values()) { stuSt.put(s); }
    await _txDone(stuTx);
  }

  return { imported, skipped };
}

/** Wipe all worksheets from IDB. Use with caution. */
async function clearAll() {
  const tx = _db.transaction(WS_STORE, "readwrite");
  tx.objectStore(WS_STORE).clear();
  await _txDone(tx);
}

// ---------------------------------------------------------------------------
// Student CRUD
// ---------------------------------------------------------------------------

/** @returns {Promise<object[]>} All students sorted by name */
async function getAllStudents() {
  const all = await _storeGetAll(STU_STORE);
  return all.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

/** @returns {Promise<object|null>} */
async function getStudent(id) {
  if (!id) return null;
  return _storeGet(STU_STORE, id);
}

/**
 * Create or update a student. Also keeps _cachedActiveStudent in sync.
 * @returns {Promise<object>} The saved student
 */
async function saveStudent(student) {
  const now = _today();

  if (student.id) {
    const existing = await getStudent(student.id);
    if (existing) {
      const updated = { ...existing, ...student };
      await _storePut(STU_STORE, updated);
      if (_cachedActiveStudent && _cachedActiveStudent.id === updated.id) {
        _cachedActiveStudent = updated;
      }
      return updated;
    }
  }

  const created = {
    name: "", takenQuestions: [], scores: [],
    ...student,
    id:        "stu_" + Date.now(),
    createdAt: now
  };
  await _storePut(STU_STORE, created);
  return created;
}

/** @returns {Promise<boolean>} */
async function deleteStudent(id) {
  const existing = await getStudent(id);
  if (!existing) return false;
  await _storeDelete(STU_STORE, id);
  if (_cachedActiveStudent && _cachedActiveStudent.id === id) {
    _cachedActiveStudent = null;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Active student
// Active student ID is stored in localStorage (tiny string, no size concern).
// The active student object is kept in a memory cache for sync access by
// HTML generators that cannot be made async.
// ---------------------------------------------------------------------------

/** @returns {string|null} */
function getActiveStudentId() {
  return localStorage.getItem(ACTIVE_STUDENT_KEY) || null;
}

/**
 * Set (or clear) the active student. Updates localStorage and memory cache.
 * Guards against race conditions: if two calls overlap, only the last caller
 * writes to the cache (checked by re-reading localStorage after the await).
 * @returns {Promise<void>}
 */
async function setActiveStudentId(id) {
  if (id) {
    localStorage.setItem(ACTIVE_STUDENT_KEY, id);
    const stu = await getStudent(id);
    // Only update the cache if this call is still the most-recent one
    if (localStorage.getItem(ACTIVE_STUDENT_KEY) === id) {
      _cachedActiveStudent = stu;
    }
  } else {
    localStorage.removeItem(ACTIVE_STUDENT_KEY);
    _cachedActiveStudent = null;
  }
}

/**
 * Sync — returns the cached active student object (or null).
 * Always reflects the latest saved state because saveStudent keeps the cache
 * in sync and setActiveStudentId refreshes it on change.
 * @returns {object|null}
 */
function getActiveStudent() {
  return _cachedActiveStudent;
}

// ---------------------------------------------------------------------------
// Taken questions & scores
// ---------------------------------------------------------------------------

/** @returns {Promise<void>} */
async function markQuestionsTaken(studentId, keys) {
  const student = await getStudent(studentId);
  if (!student) return;
  const existing = new Set(student.takenQuestions || []);
  keys.forEach(k => existing.add(k));
  student.takenQuestions = Array.from(existing);
  await saveStudent(student);
}

/** @returns {Promise<void>} */
async function recordScore(studentId, wsId, score, total, date) {
  const student = await getStudent(studentId);
  if (!student) return;
  if (!student.scores) student.scores = [];
  student.scores.push({ wsId, score, total, date });
  await saveStudent(student);
}

/**
 * Sync — filters scores from the cached active student.
 * Only call with the active student's id (the cache only holds the active student).
 * @returns {object[]}
 */
function getScoresForWorksheet(studentId, wsId) {
  const student = _cachedActiveStudent;
  if (!student || student.id !== studentId) return [];
  return (student.scores || [])
    .filter(s => s.wsId === wsId)
    .sort((a, b) => b.date.localeCompare(a.date));
}
