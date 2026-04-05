// modules/storage.js
// Dual-write storage layer: REST API (disk, source of truth) + IndexedDB (fast read cache).
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
const API_BASE = "/api";

let _db = null;
let _cachedActiveStudent = null;   // kept in sync with every saveStudent / deleteStudent call

/** Show a sync-failure warning to the user (toast + console). */
function _syncWarn(msg) {
  console.warn("[storage] " + msg);
  if (typeof showToast === "function") showToast("Sync warning: " + msg, "error");
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function _api(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

function _apiGet(path)          { return _api(path); }
function _apiPut(path, body)    { return _api(path, { method: "PUT",    body: JSON.stringify(body) }); }
function _apiPost(path, body)   { return _api(path, { method: "POST",   body: JSON.stringify(body) }); }
function _apiDelete(path)       { return _api(path, { method: "DELETE" }); }

/** Determine the API collection for a worksheet/paper based on origin field */
function _wsApiPath(ws)  { return ws.origin === "imported" ? "/papers" : "/worksheets"; }

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
 * Sync IDB cache from server. Fetches all three collections and bulk-writes
 * them into IDB, replacing whatever is there.
 */
async function _syncFromServer() {
  const [worksheets, papers, students] = await Promise.all([
    _apiGet("/worksheets"),
    _apiGet("/papers"),
    _apiGet("/students")
  ]);

  // Papers and worksheets share the IDB worksheets store (UI filters by origin)
  const allWs = [...worksheets, ...papers];
  const wsTx = _db.transaction(WS_STORE, "readwrite");
  const wsSt = wsTx.objectStore(WS_STORE);
  wsSt.clear();
  for (const ws of allWs) { if (ws.id) wsSt.put(ws); }
  await _txDone(wsTx);

  const stuTx = _db.transaction(STU_STORE, "readwrite");
  const stuSt = stuTx.objectStore(STU_STORE);
  stuSt.clear();
  for (const s of students) { if (s.id) stuSt.put(s); }
  await _txDone(stuTx);

  console.log(`[storage] Synced from server: ${worksheets.length} worksheets, ${papers.length} papers, ${students.length} students`);
}

/**
 * One-time migration: if server JSON files are empty but IDB has data,
 * push IDB data to the server so existing users don't lose data.
 */
async function _migrateIDBToServer() {
  const [serverWs, serverPapers, serverStu] = await Promise.all([
    _apiGet("/worksheets"),
    _apiGet("/papers"),
    _apiGet("/students")
  ]);

  // Only migrate if server has no data
  if (serverWs.length > 0 || serverPapers.length > 0 || serverStu.length > 0) return;

  const idbWs  = await _storeGetAll(WS_STORE);
  const idbStu = await _storeGetAll(STU_STORE);
  if (idbWs.length === 0 && idbStu.length === 0) return;

  console.log("[storage] Server empty, IDB has data — migrating to server...");

  const papers     = idbWs.filter(w => w.origin === "imported");
  const worksheets = idbWs.filter(w => w.origin !== "imported");

  const ops = [];
  if (worksheets.length > 0) ops.push(_apiPost("/worksheets/bulk", worksheets));
  if (papers.length > 0)     ops.push(_apiPost("/papers/bulk", papers));
  if (idbStu.length > 0)     ops.push(_apiPost("/students/bulk", idbStu));
  await Promise.all(ops);

  console.log(`[storage] Migrated to server: ${worksheets.length} worksheets, ${papers.length} papers, ${idbStu.length} students`);
}

/**
 * Open IndexedDB, prime the active-student cache, and sync from server.
 * If IDB already has data, sync happens in the background (non-blocking).
 * On first boot (empty IDB), sync blocks so the app has data to show.
 */
async function initDB() {
  _db = await _openDB();

  // Check if IDB already has data (repeat visit)
  const existingData = await _storeGetAll(WS_STORE);
  const hasCache = existingData.length > 0;

  if (hasCache) {
    // IDB has data — prime cache immediately, sync in background
    const activeId = localStorage.getItem(ACTIVE_STUDENT_KEY);
    if (activeId) _cachedActiveStudent = await getStudent(activeId);

    // Background sync — don't block the app
    _migrateIDBToServer()
      .then(() => _syncFromServer())
      .then(() => console.log("[storage] Background sync complete"))
      .catch(e => console.warn("[storage] Background sync failed:", e.message));
  } else {
    // First boot — must block so the app has data
    try {
      await _migrateIDBToServer();
      await _syncFromServer();
    } catch (e) {
      console.warn("[storage] Server sync failed — using IDB cache:", e.message);
    }

    const activeId = localStorage.getItem(ACTIVE_STUDENT_KEY);
    if (activeId) _cachedActiveStudent = await getStudent(activeId);
  }
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
// Worksheet CRUD (dual-write: API + IDB cache)
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
 * Create or update a worksheet. Writes to API (disk) first, then updates IDB cache.
 * @returns {Promise<object>} The saved worksheet
 */
async function saveWorksheet(ws) {
  const now = _today();

  if (ws.id) {
    const existing = await getWorksheet(ws.id);
    if (existing) {
      const updated = { ...existing, ...ws, updatedAt: now, version: (existing.version || 1) + 1 };
      try { await _apiPut(_wsApiPath(updated) + "/" + updated.id, updated); }
      catch (e) { _syncWarn("Save failed — changes may not persist to disk."); }
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
    id:        ws.id || ("ws_" + Date.now()),
    createdAt: now,
    updatedAt: now
  };
  try { await _apiPut(_wsApiPath(created) + "/" + created.id, created); }
  catch (e) { _syncWarn("Save failed — changes may not persist to disk."); }
  await _storePut(WS_STORE, created);
  return created;
}

/** @returns {Promise<boolean>} */
async function deleteWorksheet(id) {
  const existing = await getWorksheet(id);
  if (!existing) return false;
  try { await _apiDelete(_wsApiPath(existing) + "/" + id); }
  catch (e) { _syncWarn("Delete failed — item may reappear after refresh."); }
  await _storeDelete(WS_STORE, id);
  return true;
}

/** @returns {Promise<object|null>} */
async function archiveWorksheet(id) {
  const ws = await getWorksheet(id);
  if (!ws) return null;
  const updated = { ...ws, status: "archived", updatedAt: _today() };
  try { await _apiPut(_wsApiPath(updated) + "/" + updated.id, updated); }
  catch (e) { _syncWarn("Archive failed — change may not persist to disk."); }
  await _storePut(WS_STORE, updated);
  return updated;
}

/** @returns {Promise<object|null>} */
async function unarchiveWorksheet(id) {
  const ws = await getWorksheet(id);
  if (!ws) return null;
  const updated = { ...ws, status: "active", updatedAt: _today() };
  try { await _apiPut(_wsApiPath(updated) + "/" + updated.id, updated); }
  catch (e) { _syncWarn("Restore failed — change may not persist to disk."); }
  await _storePut(WS_STORE, updated);
  return updated;
}

// ---------------------------------------------------------------------------
// Export / Import
// ---------------------------------------------------------------------------

/** Triggers a browser download of all data as a JSON backup file. */
async function exportAll() {
  try {
    const allWs = await getAllWorksheets();
    const data = {
      exportedAt: new Date().toISOString(),
      version:    2,
      worksheets: allWs,
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
 * Routes papers to /api/papers and worksheets to /api/worksheets.
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

  let imported = 0, skipped = 0;
  const papers = [], worksheets = [];

  for (const ws of incoming) {
    if (!ws.id || typeof ws.id !== "string")       { skipped++; continue; }
    if (!ws.title || typeof ws.title !== "string")  { skipped++; continue; }
    // Sanitize diagram images
    const questions = (Array.isArray(ws.questions) ? ws.questions : []).map(q => {
      if (!q || typeof q !== "object") return null;
      const clean = { ...q };
      const img = _sanitizeDiagramImage(q.diagramImage);
      if (img) clean.diagramImage = img;
      else     delete clean.diagramImage;
      return clean;
    }).filter(Boolean);
    const record = { origin: "imported", ...ws, questions };
    if (record.origin === "imported") papers.push(record);
    else worksheets.push(record);
    imported++;
  }

  // Push to server
  try {
    const ops = [];
    if (papers.length > 0)     ops.push(_apiPost("/papers/bulk", papers));
    if (worksheets.length > 0) ops.push(_apiPost("/worksheets/bulk", worksheets));
    await Promise.all(ops);
  } catch (e) { _syncWarn("Import failed — data may not persist to disk."); }

  // Import students (v2+ backups)
  if (Array.isArray(parsed.students)) {
    const validStudents = parsed.students.filter(s => s.id && s.name);
    if (validStudents.length > 0) {
      try { await _apiPost("/students/bulk", validStudents); }
      catch (e) { _syncWarn("Student import failed — data may not persist to disk."); }
    }
  }

  // Re-sync IDB from server
  try { await _syncFromServer(); }
  catch (e) {
    // Fallback: write directly to IDB
    console.warn("[storage] Post-import sync failed, writing to IDB directly:", e.message);
    const allRecords = [...papers, ...worksheets];
    const tx = _db.transaction(WS_STORE, "readwrite");
    const st = tx.objectStore(WS_STORE);
    for (const ws of allRecords) { st.put(ws); }
    await _txDone(tx);

    if (Array.isArray(parsed.students)) {
      const stuTx = _db.transaction(STU_STORE, "readwrite");
      const stuSt = stuTx.objectStore(STU_STORE);
      for (const s of parsed.students) { if (s.id && s.name) stuSt.put(s); }
      await _txDone(stuTx);
    }
  }

  return { imported, skipped };
}

/** Wipe all data from both server and IDB. Use with caution. */
async function clearAll() {
  // Clear IDB
  const wsTx = _db.transaction(WS_STORE, "readwrite");
  wsTx.objectStore(WS_STORE).clear();
  await _txDone(wsTx);

  const stuTx = _db.transaction(STU_STORE, "readwrite");
  stuTx.objectStore(STU_STORE).clear();
  await _txDone(stuTx);

  // Clear server files
  try {
    const [wsAll, papersAll, stuAll] = await Promise.all([
      _apiGet("/worksheets"), _apiGet("/papers"), _apiGet("/students")
    ]);
    const results = await Promise.allSettled([
      ...wsAll.map(w     => _apiDelete("/worksheets/" + w.id)),
      ...papersAll.map(p => _apiDelete("/papers/"     + p.id)),
      ...stuAll.map(s    => _apiDelete("/students/"   + s.id))
    ]);
    const failed = results.filter(r => r.status === "rejected").length;
    if (failed) _syncWarn(`Clear incomplete — ${failed} item(s) could not be deleted from server.`);
  } catch (e) { _syncWarn("Clear failed — server data may not be fully wiped."); }
}

// ---------------------------------------------------------------------------
// Student CRUD (dual-write: API + IDB cache)
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
      try { await _apiPut("/students/" + updated.id, updated); }
      catch (e) { _syncWarn("Student save failed — changes may not persist to disk."); }
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
    id:        student.id || ("stu_" + Date.now()),
    createdAt: now
  };
  try { await _apiPut("/students/" + created.id, created); }
  catch (e) { _syncWarn("Student save failed — changes may not persist to disk."); }
  await _storePut(STU_STORE, created);
  return created;
}

/** @returns {Promise<boolean>} */
async function deleteStudent(id) {
  const existing = await getStudent(id);
  if (!existing) return false;
  try { await _apiDelete("/students/" + id); }
  catch (e) { _syncWarn("Student delete failed — may reappear after refresh."); }
  await _storeDelete(STU_STORE, id);
  if (_cachedActiveStudent && _cachedActiveStudent.id === id) {
    _cachedActiveStudent = null;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Active student
// ---------------------------------------------------------------------------

/** @returns {string|null} */
function getActiveStudentId() {
  return localStorage.getItem(ACTIVE_STUDENT_KEY) || null;
}

/**
 * Set (or clear) the active student. Updates localStorage and memory cache.
 * @returns {Promise<void>}
 */
async function setActiveStudentId(id) {
  if (id) {
    localStorage.setItem(ACTIVE_STUDENT_KEY, id);
    const stu = await getStudent(id);
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
 * @returns {object[]}
 */
function getScoresForWorksheet(studentId, wsId) {
  const student = _cachedActiveStudent;
  if (!student || student.id !== studentId) return [];
  return (student.scores || [])
    .filter(s => s.wsId === wsId)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}
