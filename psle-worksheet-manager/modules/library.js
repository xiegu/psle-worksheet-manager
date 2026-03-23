// modules/library.js
// Worksheet library — tab view with 4 tabs:
//   "worksheets"      Active Worksheets   (origin:"built",    status:active)
//   "papers"          Available Papers    (origin:"imported", status:active)
//   "archived-ws"     Archived Worksheets (origin:"built",    status:archived)
//   "archived-papers" Archived Papers     (origin:"imported", status:archived)
// Entry point: renderLibrary(container)

// ---------------------------------------------------------------------------
// Module state — persists within session
// ---------------------------------------------------------------------------

let _wsFilters    = { level:"", strand:"", topic:"", difficulty:"", type:"", flag:"", search:"" };
let _paperFilters = { level:"", strand:"", topic:"", difficulty:"", type:"", flag:"", school:"", year:"", subject:"", paperType:"", search:"" };
let _activeTab    = "worksheets";

// Dynamic filter options for Available Papers — populated from actual data
let _paperFilterOptions = { schools:[], years:[], subjects:[], paperTypes:[] };

// Bulk selection state
let _selectedCards = new Set();

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function renderLibrary(container) {
  _selectedCards.clear();
  const all = await getAllWorksheets();

  // Counts for tab labels and stats bar
  const counts = _getCounts(all);

  container.innerHTML = `
    <div id="lib-wrap">
      ${_htmlStatsBar(counts)}
      ${_htmlTabBar(counts)}
      <div id="lib-tab-content"></div>
    </div>
  `;

  // Fill the active tab content structure, then bind, then render grid
  document.getElementById("lib-tab-content").innerHTML = _htmlTabContent(_activeTab);
  _bindLibrary();
  await _renderTabGrid(_activeTab, all);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _getCounts(all) {
  return {
    ws:      all.filter(w => w.origin !== "imported" && w.status !== "archived").length,
    papers:  all.filter(w => w.origin === "imported" && w.status !== "archived").length,
    archWs:  all.filter(w => w.origin !== "imported" && w.status === "archived").length,
    archPp:  all.filter(w => w.origin === "imported" && w.status === "archived").length
  };
}

async function _rerenderLibrary() {
  const main = document.getElementById("app-main");
  if (!main) return;
  main.innerHTML = "";
  await renderLibrary(main);
}

// ---------------------------------------------------------------------------
// Stats bar
// ---------------------------------------------------------------------------

function _htmlStatsBar({ ws, papers, archWs, archPp }) {
  return `
    <div class="stats-bar">
      <div class="stat-card">
        <div class="stat-card__value">${ws}</div>
        <div class="stat-card__label">Active Worksheets</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__value">${papers}</div>
        <div class="stat-card__label">Available Papers</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__value">${archWs}</div>
        <div class="stat-card__label">Archived Worksheets</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__value">${archPp}</div>
        <div class="stat-card__label">Archived Papers</div>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Tab bar
// ---------------------------------------------------------------------------

function _htmlTabBar({ ws, papers, archWs, archPp }) {
  const tabs = [
    { id: "worksheets",      label: "Active Worksheets",   count: ws      },
    { id: "papers",          label: "Available Papers",    count: papers  },
    { id: "archived-ws",     label: "Archived Worksheets", count: archWs  },
    { id: "archived-papers", label: "Archived Papers",     count: archPp  }
  ];
  return `
    <div class="lib-tabs">
      ${tabs.map(t => `
        <button class="lib-tab ${_activeTab === t.id ? "active" : ""}" data-tab="${t.id}">
          ${t.label} <span class="lib-count">(${t.count})</span>
        </button>`).join("")}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Tab content structure (filter bars + grid placeholder divs)
// ---------------------------------------------------------------------------

function _htmlTabContent(tab) {
  if (tab === "worksheets") return `
    <div class="lib-tab-actions">
      <button class="btn btn-primary" id="btn-new-from-library">+ New Worksheet</button>
    </div>
    <div id="filter-wrap-ws">${_htmlFilterBar("ws", _wsFilters)}</div>
    <div id="lib-bulk-bar"></div>
    <div id="grid-active-ws"></div>
  `;
  if (tab === "papers") return `
    <div id="filter-wrap-paper">${_htmlFilterBar("paper", _paperFilters)}</div>
    <div id="lib-bulk-bar"></div>
    <div id="grid-active-papers"></div>
  `;
  if (tab === "archived-ws")     return `<div id="lib-bulk-bar"></div><div id="grid-archived-ws"></div>`;
  if (tab === "archived-papers") return `<div id="lib-bulk-bar"></div><div id="grid-archived-papers"></div>`;
  return "";
}

// ---------------------------------------------------------------------------
// Filter bar (shared template, prefix = "ws" | "paper")
// ---------------------------------------------------------------------------

function _htmlFilterBar(prefix, filters) {
  const levels       = ["P1","P2","P3","P4","P5","P6"];
  const strands      = filters.level ? getStrands(filters.level) : [];
  const topics       = (filters.level && filters.strand)
                         ? getTopics(filters.level, filters.strand) : [];
  const difficulties = ["Foundation","Standard","Challenge"];
  const types        = ["Practice","Word Problem","Mixed","Exam-style"];
  const flagOpts     = [
    { value:"new",        label:"New 2026"   },
    { value:"moved_up",   label:"Moved up"   },
    { value:"moved_down", label:"Moved down" }
  ];
  const p = `fil-${prefix}`;

  return `
    <div class="filter-bar">
      <div class="filter-group" style="min-width:180px;flex:1">
        <label>Search</label>
        <input type="search" id="${p}-search" placeholder="Filter by title…"
               value="${_esc(filters.search||"")}"
               style="padding:5px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;width:100%" />
      </div>
      <div class="filter-group">
        <label>Level</label>
        <select id="${p}-level">
          <option value="">All</option>
          ${levels.map(l =>
            `<option value="${l}" ${filters.level===l?"selected":""}>${l}</option>`
          ).join("")}
        </select>
      </div>
      <div class="filter-group">
        <label>Strand</label>
        <select id="${p}-strand" ${!strands.length?"disabled":""}>
          <option value="">All</option>
          ${strands.map(s =>
            `<option value="${_esc(s)}" ${filters.strand===s?"selected":""}>${_esc(s)}</option>`
          ).join("")}
        </select>
      </div>
      <div class="filter-group">
        <label>Topic</label>
        <select id="${p}-topic" ${!topics.length?"disabled":""}>
          <option value="">All</option>
          ${topics.map(t =>
            `<option value="${_esc(t)}" ${filters.topic===t?"selected":""}>${_esc(t)}</option>`
          ).join("")}
        </select>
      </div>
      <div class="filter-group">
        <label>Difficulty</label>
        <select id="${p}-difficulty">
          <option value="">All</option>
          ${difficulties.map(d =>
            `<option value="${d}" ${filters.difficulty===d?"selected":""}>${d}</option>`
          ).join("")}
        </select>
      </div>
      <div class="filter-group">
        <label>Type</label>
        <select id="${p}-type">
          <option value="">All</option>
          ${types.map(t =>
            `<option value="${_esc(t)}" ${filters.type===t?"selected":""}>${_esc(t)}</option>`
          ).join("")}
        </select>
      </div>
      <div class="filter-group">
        <label>2026 Flag</label>
        <select id="${p}-flag">
          <option value="">All</option>
          ${flagOpts.map(f =>
            `<option value="${f.value}" ${filters.flag===f.value?"selected":""}>${f.label}</option>`
          ).join("")}
        </select>
      </div>
      ${prefix === "paper" && _paperFilterOptions.schools.length ? `
      <div class="filter-group">
        <label>School</label>
        <select id="${p}-school">
          <option value="">All</option>
          ${_paperFilterOptions.schools.map(s =>
            `<option value="${_esc(s)}" ${filters.school===s?"selected":""}>${_esc(s)}</option>`
          ).join("")}
        </select>
      </div>` : ""}

      ${prefix === "paper" && _paperFilterOptions.years.length ? `
      <div class="filter-group">
        <label>Year</label>
        <select id="${p}-year">
          <option value="">All</option>
          ${_paperFilterOptions.years.map(y =>
            `<option value="${_esc(y)}" ${filters.year===y?"selected":""}>${_esc(y)}</option>`
          ).join("")}
        </select>
      </div>` : ""}

      ${prefix === "paper" && _paperFilterOptions.subjects.length > 1 ? `
      <div class="filter-group">
        <label>Subject</label>
        <select id="${p}-subject">
          <option value="">All</option>
          ${_paperFilterOptions.subjects.map(s =>
            `<option value="${_esc(s)}" ${filters.subject===s?"selected":""}>${_esc(s)}</option>`
          ).join("")}
        </select>
      </div>` : ""}

      ${prefix === "paper" && _paperFilterOptions.paperTypes.length ? `
      <div class="filter-group">
        <label>Paper Type</label>
        <select id="${p}-paperType">
          <option value="">All</option>
          ${_paperFilterOptions.paperTypes.map(t =>
            `<option value="${_esc(t)}" ${filters.paperType===t?"selected":""}>${_esc(t)}</option>`
          ).join("")}
        </select>
      </div>` : ""}

      <button class="filter-reset" id="btn-filter-reset-${prefix}">Reset</button>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Paper metadata helpers
// ---------------------------------------------------------------------------

/**
 * Returns {school, year, subject, paperType} for a worksheet.
 * Uses explicit saved fields when present; falls back to parsing the title
 * for papers imported before these fields were added to the scraper.
 * Title format: "P6 Maths Prelim 2025 — Nanyang"
 */
function _parsePaperMeta(ws) {
  let school    = ws.school    || "";
  let year      = ws.year      || "";
  let subject   = ws.subject   || "";
  let paperType = ws.paperType || "";
  const title   = ws.title     || "";

  if (!year) {
    const m = title.match(/\b(20\d{2})\b/);
    if (m) year = m[1];
  }
  if (!school) {
    const m = title.match(/[—–-]\s*(.+)$/);
    if (m) school = m[1].trim();
  }
  if (!subject) {
    const m = title.match(/\b(Maths?|Mathematics|Science|English|Chinese)\b/i);
    if (m) subject = m[1].replace(/^Math$/i, "Maths").replace(/^Mathematics$/i, "Maths");
  }
  if (!paperType) {
    const m = title.match(/\b(Prelim|SA[12]?|CA[12]?)\b/i);
    if (m) paperType = m[1].toUpperCase().replace(/^SA$/, "SA").replace(/^CA$/, "CA");
  }
  return { school, year, subject, paperType };
}

// ---------------------------------------------------------------------------
// Grid rendering
// ---------------------------------------------------------------------------

function _applyFilters(list, filters) {
  return list.filter(ws => {
    if (filters.search) {
      const s = filters.search.toLowerCase();
      if (!(ws.title||"").toLowerCase().includes(s)) return false;
    }
    if (filters.level      && ws.level      !== filters.level)      return false;
    if (filters.strand     && ws.strand     !== filters.strand)     return false;
    if (filters.topic      && ws.topic      !== filters.topic)      return false;
    if (filters.difficulty && ws.difficulty !== filters.difficulty) return false;
    if (filters.type       && ws.type       !== filters.type)       return false;
    if (filters.school || filters.year || filters.subject || filters.paperType) {
      const meta = _parsePaperMeta(ws);
      if (filters.school    && meta.school    !== filters.school)    return false;
      if (filters.year      && meta.year      !== filters.year)      return false;
      if (filters.subject   && meta.subject   !== filters.subject)   return false;
      if (filters.paperType && meta.paperType !== filters.paperType) return false;
    }
    if (filters.flag) {
      const f = getFlag(ws.topic);
      if (!f || f.flag !== filters.flag) return false;
    }
    return true;
  });
}

async function _renderTabGrid(tab, allParam) {
  const all = allParam || await getAllWorksheets();

  // Pre-compute which source-paper question keys have been used in any active worksheet.
  // A question carries a sourceKey ("paperId::qId") when it was picked from the Question Bank.
  const builtSourceKeys = new Set(
    all
      .filter(w => w.origin !== "imported" && w.status !== "archived")
      .flatMap(w => (w.questions || []).map(q => q.sourceKey).filter(Boolean))
  );

  if (tab === "worksheets") {
    const base  = all.filter(w => w.origin !== "imported" && w.status !== "archived");
    const items = _applyFilters(base, _wsFilters);
    _renderGrid("grid-active-ws", items, "worksheet", false, builtSourceKeys,
      base.length === 0
        ? "No worksheets yet. Create your first one!"
        : "No worksheets match the current filters.");

  } else if (tab === "papers") {
    const base  = all.filter(w => w.origin === "imported" && w.status !== "archived");
    // Refresh dynamic filter options — use parsed fallback for older imported papers
    const metas = base.map(_parsePaperMeta);
    _paperFilterOptions = {
      schools:    [...new Set(metas.map(m => m.school).filter(Boolean))].sort(),
      years:      [...new Set(metas.map(m => m.year).filter(Boolean))].sort((a,b) => b-a),
      subjects:   [...new Set(metas.map(m => m.subject).filter(Boolean))].sort(),
      paperTypes: [...new Set(metas.map(m => m.paperType).filter(Boolean))].sort()
    };
    const items = _applyFilters(base, _paperFilters);
    _renderGrid("grid-active-papers", items, "paper", false, builtSourceKeys,
      base.length === 0
        ? "No papers yet. Import scraped papers via the \u2191 Import button."
        : "No papers match the current filters.");

  } else if (tab === "archived-ws") {
    const items = all.filter(w => w.origin !== "imported" && w.status === "archived");
    _renderGrid("grid-archived-ws", items, "worksheet", true, builtSourceKeys,
      "No archived worksheets.");

  } else if (tab === "archived-papers") {
    const items = all.filter(w => w.origin === "imported" && w.status === "archived");
    _renderGrid("grid-archived-papers", items, "paper", true, builtSourceKeys,
      "No archived papers.");
  }

  _updateBulkBarForCurrentTab();
}

function _renderGrid(gridId, items, type, isArchived, builtSourceKeys, emptyMsg) {
  const wrap = document.getElementById(gridId);
  if (!wrap) return;

  if (items.length === 0) {
    wrap.innerHTML = `
      <div class="empty-state" style="padding:20px 0">
        <div class="empty-state__icon">&#128196;</div>
        <div class="empty-state__text">${emptyMsg}</div>
      </div>`;
    return;
  }

  wrap.innerHTML = `<div class="card-grid">
    ${items.map(ws => _htmlCard(ws, type, isArchived, builtSourceKeys)).join("")}
  </div>`;
}

// ---------------------------------------------------------------------------
// Bulk selection bar
// ---------------------------------------------------------------------------

function _htmlBulkBar(type, isArchived) {
  const n = _selectedCards.size;
  if (n === 0) return "";
  let actions = "";
  if (isArchived) {
    actions = `
      <button class="btn btn-sm btn-primary" id="btn-bulk-restore">Restore (${n})</button>
      <button class="btn btn-sm btn-danger"  id="btn-bulk-delete-sel">Delete (${n})</button>`;
  } else {
    actions = `
      <button class="btn btn-sm btn-danger" id="btn-bulk-archive">Archive (${n})</button>
      <button class="btn btn-sm btn-danger" id="btn-bulk-delete-sel">Delete (${n})</button>
      ${type === "worksheet" ? `<button class="btn btn-sm" id="btn-bulk-assign-topic">Assign Topic</button>` : ""}`;
  }
  return `
    <div class="lib-bulk-bar">
      <span style="font-size:13px;font-weight:600">${n} selected</span>
      <button class="btn btn-sm" id="btn-bulk-clear">Clear</button>
      ${actions}
    </div>`;
}

function _updateBulkBarForCurrentTab() {
  const isArchived = _activeTab === "archived-ws" || _activeTab === "archived-papers";
  const type = (_activeTab === "worksheets" || _activeTab === "archived-ws") ? "worksheet" : "paper";
  const bar = document.getElementById("lib-bulk-bar");
  if (!bar) return;
  bar.innerHTML = _htmlBulkBar(type, isArchived);
  _bindBulkBar(type, isArchived);
}

function _bindBulkBar(type, isArchived) {
  document.getElementById("btn-bulk-clear")?.addEventListener("click", () => {
    _selectedCards.clear();
    _updateBulkBarForCurrentTab();
    document.querySelectorAll(".lib-card-check").forEach(cb => { cb.checked = false; });
    document.querySelectorAll(".ws-card--selected").forEach(c => c.classList.remove("ws-card--selected"));
  });

  document.getElementById("btn-bulk-archive")?.addEventListener("click", async () => {
    if (!confirm(`Archive ${_selectedCards.size} item(s)?`)) return;
    let failed = 0;
    for (const id of _selectedCards) {
      try { await archiveWorksheet(id); }
      catch(e) { failed++; }
    }
    _selectedCards.clear();
    showToast(failed ? `Archived with ${failed} error(s).` : "Archived.", failed ? "error" : "success");
    await _rerenderLibrary();
  });

  document.getElementById("btn-bulk-delete-sel")?.addEventListener("click", async () => {
    if (!confirm(`Permanently delete ${_selectedCards.size} item(s)?`)) return;
    for (const id of _selectedCards) { try { await deleteWorksheet(id); } catch(e) {} }
    _selectedCards.clear();
    showToast("Deleted.", "success");
    await _rerenderLibrary();
  });

  document.getElementById("btn-bulk-restore")?.addEventListener("click", async () => {
    for (const id of _selectedCards) { try { await unarchiveWorksheet(id); } catch(e) {} }
    _selectedCards.clear();
    showToast("Restored.", "success");
    await _rerenderLibrary();
  });

  document.getElementById("btn-bulk-assign-topic")?.addEventListener("click", _showAssignTopicModal);
}

function _showAssignTopicModal() {
  document.getElementById("assign-topic-modal")?.remove();
  const modal = document.createElement("div");
  modal.id        = "assign-topic-modal";
  modal.className = "qb-modal-overlay";
  modal.innerHTML = `
    <div class="qb-modal" role="dialog" aria-modal="true" style="max-width:420px;width:92vw">
      <div class="qb-modal__header">
        <div style="font-weight:700;font-size:15px">Assign Topic to ${_selectedCards.size} worksheet(s)</div>
        <button class="qb-modal__close" id="at-close" aria-label="Close">&times;</button>
      </div>
      <div class="qb-modal__body" style="padding:16px;display:flex;flex-direction:column;gap:10px">
        <div class="form-group">
          <label>Level</label>
          <select id="at-level">
            <option value="">— Select —</option>
            ${["P1","P2","P3","P4","P5","P6"].map(l => `<option value="${l}">${l}</option>`).join("")}
          </select>
        </div>
        <div class="form-group">
          <label>Strand</label>
          <select id="at-strand" disabled>
            <option value="">— Select level first —</option>
          </select>
        </div>
        <div class="form-group">
          <label>Topic</label>
          <select id="at-topic" disabled>
            <option value="">— Select strand first —</option>
          </select>
        </div>
      </div>
      <div class="qb-modal__footer">
        <button class="btn btn-primary" id="at-apply" disabled>Apply</button>
        <button class="btn" id="at-cancel">Cancel</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const close = () => modal.remove();
  document.getElementById("at-close")?.addEventListener("click", close);
  document.getElementById("at-cancel")?.addEventListener("click", close);
  modal.addEventListener("click",   e => { if (e.target === modal) close(); });
  modal.addEventListener("keydown", e => { if (e.key === "Escape") close(); });

  document.getElementById("at-level")?.addEventListener("change", e => {
    const strands  = e.target.value ? getStrands(e.target.value) : [];
    const strandEl = document.getElementById("at-strand");
    strandEl.innerHTML = `<option value="">— Select —</option>` + strands.map(s => `<option value="${_esc(s)}">${_esc(s)}</option>`).join("");
    strandEl.disabled  = !strands.length;
    document.getElementById("at-topic").innerHTML  = `<option value="">— Select strand first —</option>`;
    document.getElementById("at-topic").disabled   = true;
    document.getElementById("at-apply").disabled   = true;
  });

  document.getElementById("at-strand")?.addEventListener("change", e => {
    const level  = document.getElementById("at-level").value;
    const topics = (level && e.target.value) ? getTopics(level, e.target.value) : [];
    const topicEl = document.getElementById("at-topic");
    topicEl.innerHTML = `<option value="">— Select —</option>` + topics.map(t => `<option value="${_esc(t)}">${_esc(t)}</option>`).join("");
    topicEl.disabled  = !topics.length;
    document.getElementById("at-apply").disabled = true;
  });

  document.getElementById("at-topic")?.addEventListener("change", e => {
    document.getElementById("at-apply").disabled = !e.target.value;
  });

  document.getElementById("at-apply")?.addEventListener("click", async () => {
    const level  = document.getElementById("at-level").value;
    const strand = document.getElementById("at-strand").value;
    const topic  = document.getElementById("at-topic").value;
    if (!topic) return;
    for (const id of _selectedCards) {
      const ws = await getWorksheet(id);
      if (!ws) continue;
      await saveWorksheet({ ...ws, level, strand, topic, updatedAt: new Date().toISOString().slice(0,10) });
    }
    _selectedCards.clear();
    close();
    showToast("Topic assigned.", "success");
    await _rerenderLibrary();
  });
}

// ---------------------------------------------------------------------------
// Card HTML
// ---------------------------------------------------------------------------

function _htmlCard(ws, type, isArchived, builtSourceKeys) {
  const flag       = ws.topic ? getFlag(ws.topic) : null;
  const totalMarks = (ws.questions||[]).reduce((s,q) => s+(parseInt(q.marks)||0), 0);
  const qCount     = (ws.questions||[]).length;
  const activeStu  = getActiveStudent();

  const diffBadgeClass = {
    Foundation: "badge-foundation",
    Standard:   "badge-standard",
    Challenge:  "badge-challenge"
  }[ws.difficulty] || "badge-standard";

  const flagBadge     = flag
    ? `<span class="badge badge-${flag.flag.replace("_","-")}">${_esc(flag.label)}</span>`
    : "";
  const archivedBadge = isArchived
    ? `<span class="badge badge-archived">Archived</span>`
    : "";

  // Built badge — papers only, always visible (no active student needed).
  // A question is "built" if it has been picked into any active worksheet via QB.
  let builtBadge = "";
  if (type === "paper" && qCount > 0 && builtSourceKeys) {
    const builtCount = (ws.questions||[]).filter(q => builtSourceKeys.has(ws.id+"::"+q.id)).length;
    if (builtCount === qCount) {
      builtBadge = `<span class="badge badge-ws-taken-all">&#10003; All built</span>`;
    } else if (builtCount > 0) {
      builtBadge = `<span class="badge badge-ws-taken-partial">${builtCount}/${qCount} built</span>`;
    } else {
      builtBadge = `<span class="badge badge-ws-taken-none">Not built</span>`;
    }
  }

  // Taken badge — worksheets only, score-based, requires active student
  let takenBadge = "";
  if (type === "worksheet" && activeStu && qCount > 0) {
    const hasTaken = (activeStu.scores||[]).some(s => s.wsId === ws.id);
    takenBadge = hasTaken
      ? `<span class="badge badge-ws-taken-all">&#10003; Taken</span>`
      : `<span class="badge badge-ws-taken-none">Not taken</span>`;
  }

  // Footer action button(s)
  let actionBtns;
  if (isArchived && type === "paper") {
    // Archived Papers: Recover + Delete (both require confirm)
    actionBtns = `
      <button class="btn btn-sm btn-primary btn-card-recover" data-id="${_esc(ws.id)}">Recover</button>
      <button class="btn btn-sm btn-danger  btn-card-delete"  data-id="${_esc(ws.id)}">Delete</button>`;
  } else if (isArchived) {
    // Archived Worksheets: Restore + Delete
    actionBtns = `
      <button class="btn btn-sm btn-card-unarchive" data-id="${_esc(ws.id)}">Restore</button>
      <button class="btn btn-sm btn-danger btn-card-delete" data-id="${_esc(ws.id)}">Delete</button>`;
  } else {
    // Active cards: Archive
    actionBtns = `
      <button class="btn btn-sm btn-danger btn-card-archive" data-id="${_esc(ws.id)}">Archive</button>`;
  }

  // Score section — worksheets only (not archived papers)
  const scoreSection = (activeStu && type === "worksheet") ? (() => {
    const latest = getScoresForWorksheet(activeStu.id, ws.id)[0];
    const scoreDisplay = latest
      ? `<div class="ws-card__score">Last: ${latest.score}/${latest.total} &bull; ${_esc(latest.date)}</div>`
      : `<div class="ws-card__score ws-card__score--none">No score yet</div>`;
    return `
      <div class="ws-card__score-section">
        ${scoreDisplay}
        <button class="btn btn-sm btn-card-score" data-id="${_esc(ws.id)}">Record Score</button>
      </div>`;
  })() : "";

  return `
    <div class="ws-card ${isArchived?"ws-card--archived":""} ${_selectedCards.has(ws.id)?"ws-card--selected":""}" data-id="${_esc(ws.id)}">
      <div class="ws-card__header">
        <input type="checkbox" class="lib-card-check" data-id="${_esc(ws.id)}" ${_selectedCards.has(ws.id)?"checked":""} title="Select for bulk action" />
        <div class="ws-card__title">${_esc(ws.title||"Untitled")}</div>
        ${ws.level ? `<span class="badge badge-level">${_esc(ws.level)}</span>` : ""}
      </div>
      <div class="ws-card__flags">
        ${flagBadge}
        ${archivedBadge}
        ${ws.difficulty ? `<span class="badge ${diffBadgeClass}">${_esc(ws.difficulty)}</span>` : ""}
        ${ws.type ? `<span class="badge" style="background:var(--grey-200);color:var(--grey-800)">${_esc(ws.type)}</span>` : ""}
        ${builtBadge}${takenBadge}
      </div>
      <div class="ws-card__meta">
        ${ws.strand ? `<div><strong>Strand:</strong> ${_esc(ws.strand)}</div>` : ""}
        ${ws.topic  ? `<div><strong>Topic:</strong> ${_esc(ws.topic)}</div>`  : ""}
        <div>${qCount} question${qCount!==1?"s":""} &bull; ${totalMarks} mark${totalMarks!==1?"s":""}</div>
        <div>Created ${_esc(ws.createdAt||"—")}
          ${ws.updatedAt && ws.updatedAt !== ws.createdAt
            ? ` &bull; Updated ${_esc(ws.updatedAt)}` : ""}
        </div>
      </div>
      <div class="ws-card__footer">
        <button class="btn btn-sm btn-card-preview"   data-id="${_esc(ws.id)}">Preview</button>
        <button class="btn btn-sm btn-card-edit"      data-id="${_esc(ws.id)}">Edit</button>
        <button class="btn btn-sm btn-card-duplicate" data-id="${_esc(ws.id)}">Duplicate</button>
        ${actionBtns}
      </div>
      ${scoreSection}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Event binding
// ---------------------------------------------------------------------------

function _bindLibrary() {
  const wrap = document.getElementById("lib-wrap");
  // Single delegated listener on lib-wrap handles tabs AND card actions
  wrap?.addEventListener("click", async e => {
    const tabBtn = e.target.closest(".lib-tab[data-tab]");
    if (tabBtn) { await _switchTab(tabBtn.dataset.tab); return; }
    _onCardClick(e);
  });
  // Checkbox toggling for bulk select
  wrap?.addEventListener("change", e => {
    const cb = e.target.closest(".lib-card-check");
    if (!cb) return;
    const id = cb.dataset.id;
    if (cb.checked) _selectedCards.add(id);
    else            _selectedCards.delete(id);
    const card = wrap.querySelector(`.ws-card[data-id="${id}"]`);
    if (card) card.classList.toggle("ws-card--selected", cb.checked);
    _updateBulkBarForCurrentTab();
  });

  _bindTabContent(_activeTab);
}

function _bindTabContent(tab) {
  document.getElementById("btn-new-from-library")
    ?.addEventListener("click", () => navigate("builder"));
  if (tab === "worksheets") _bindFilterBar("ws");
  if (tab === "papers")     _bindFilterBar("paper");
}

function _bindFilterBar(prefix) {
  const filters = prefix === "ws" ? _wsFilters : _paperFilters;
  const p = `fil-${prefix}`;

  document.getElementById(`${p}-search`)?.addEventListener("input", e => {
    filters.search = e.target.value;
    _renderTabGrid(_activeTab);
  });
  document.getElementById(`${p}-level`)?.addEventListener("change", e => {
    filters.level = e.target.value; filters.strand = ""; filters.topic = "";
    _rebuildFilterBar(prefix);
  });
  document.getElementById(`${p}-strand`)?.addEventListener("change", e => {
    filters.strand = e.target.value; filters.topic = "";
    _rebuildFilterBar(prefix);
  });
  const simpleKeys = prefix === "paper"
    ? ["topic","difficulty","type","flag","school","year","subject","paperType"]
    : ["topic","difficulty","type","flag"];
  for (const key of simpleKeys) {
    document.getElementById(`${p}-${key}`)?.addEventListener("change", e => {
      filters[key] = e.target.value;
      _renderTabGrid(_activeTab);
    });
  }
  document.getElementById(`btn-filter-reset-${prefix}`)?.addEventListener("click", () => {
    if (prefix === "ws") _wsFilters    = { level:"", strand:"", topic:"", difficulty:"", type:"", flag:"", search:"" };
    else                 _paperFilters = { level:"", strand:"", topic:"", difficulty:"", type:"", flag:"", school:"", year:"", subject:"", paperType:"", search:"" };
    _rebuildFilterBar(prefix);
  });
}

function _rebuildFilterBar(prefix) {
  const focusedId = document.activeElement?.id;
  const wrap = document.getElementById(`filter-wrap-${prefix}`);
  if (!wrap) return;
  const filters = prefix === "ws" ? _wsFilters : _paperFilters;
  wrap.innerHTML = _htmlFilterBar(prefix, filters);
  _bindFilterBar(prefix);
  if (focusedId) document.getElementById(focusedId)?.focus();
  _renderTabGrid(_activeTab);
}

async function _switchTab(tab) {
  _activeTab = tab;
  _selectedCards.clear();

  // Update tab button styles
  document.querySelectorAll(".lib-tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });

  // Replace tab content
  const content = document.getElementById("lib-tab-content");
  if (!content) return;
  content.innerHTML = _htmlTabContent(tab);

  _bindTabContent(tab);
  await _renderTabGrid(tab);
}

function _onCardClick(e) {
  const btn = e.target.closest("button[data-id]");
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.classList.contains("btn-card-preview"))   { navigate("preview", { editingId: id }); return; }
  if (btn.classList.contains("btn-card-edit"))      { navigate("builder", { editingId: id }); return; }
  if (btn.classList.contains("btn-card-duplicate")) { _handleDuplicate(id);   return; }
  if (btn.classList.contains("btn-card-archive"))   { _handleArchive(id);     return; }
  if (btn.classList.contains("btn-card-unarchive")) { _handleUnarchive(id);   return; }
  if (btn.classList.contains("btn-card-recover"))   { _handleRecover(id);     return; }
  if (btn.classList.contains("btn-card-delete"))    { _handleDelete(id);      return; }
  if (btn.classList.contains("btn-card-score"))     { _handleRecordScore(id); return; }
}

// ---------------------------------------------------------------------------
// Card actions
// ---------------------------------------------------------------------------

async function _handleDuplicate(id) {
  const ws = await getWorksheet(id);
  if (!ws) return;
  const copy = {
    ...ws,
    id: undefined, title: "Copy of " + ws.title,
    status: "active", version: 1, createdAt: undefined, updatedAt: undefined,
    questions: (ws.questions||[]).map(q => ({ ...q, id: "q_" + Date.now() + "_" + Math.floor(Math.random() * 1e6) }))
  };
  try {
    await saveWorksheet(copy);
    showToast("Duplicated.", "success");
    await _rerenderLibrary();
  } catch (e) {
    showToast("Duplicate failed: " + e.message, "error");
  }
}

async function _handleArchive(id) {
  try {
    await archiveWorksheet(id);
    showToast("Archived.");
    await _rerenderLibrary();
  } catch (e) {
    showToast("Archive failed: " + e.message, "error");
  }
}

async function _handleUnarchive(id) {
  try {
    await unarchiveWorksheet(id);
    showToast("Restored.", "success");
    await _rerenderLibrary();
  } catch (e) {
    showToast("Restore failed: " + e.message, "error");
  }
}

async function _handleRecover(id) {
  if (!confirm("Restore this paper to Available Papers?")) return;
  try {
    await unarchiveWorksheet(id);
    showToast("Paper recovered.", "success");
    await _rerenderLibrary();
  } catch (e) {
    showToast("Recover failed: " + e.message, "error");
  }
}

async function _handleDelete(id) {
  const ws = await getWorksheet(id);
  if (!ws) return;
  const title = ws.title || "Untitled";
  if (!confirm(`Permanently delete "${title}"? This cannot be undone.`)) return;
  try {
    await deleteWorksheet(id);
    showToast("Paper deleted.", "success");
    await _rerenderLibrary();
  } catch (e) {
    showToast("Delete failed: " + e.message, "error");
  }
}

async function _handleRecordScore(wsId) {
  const ws  = await getWorksheet(wsId);
  const stu = getActiveStudent();
  if (!ws || !stu) return;

  const totalMarks     = (ws.questions||[]).reduce((s,q) => s+(parseInt(q.marks)||0), 0);
  const today          = new Date().toISOString().slice(0,10);
  const existingScores = getScoresForWorksheet(stu.id, wsId);

  // Show previous scores if any
  const prevHtml = existingScores.length > 0
    ? `<div class="score-prev-notice">
        <strong>Previous:</strong>
        ${existingScores.map(s => `${s.score}/${s.total} on ${_esc(s.date)}`).join(" &bull; ")}
       </div>`
    : "";

  document.getElementById("score-modal")?.remove();
  const modal = document.createElement("div");
  modal.id        = "score-modal";
  modal.className = "qb-modal-overlay";
  modal.innerHTML = `
    <div class="qb-modal" role="dialog" aria-modal="true" style="max-width:400px;width:90vw">
      <div class="qb-modal__header">
        <div style="font-weight:700;font-size:15px">Record Score</div>
        <button class="qb-modal__close" id="score-modal-close" aria-label="Close">&times;</button>
      </div>
      <div class="qb-modal__body score-form">
        <div style="margin-bottom:8px;font-size:13px;color:var(--grey-600)">
          ${_esc(ws.title||"Untitled")} &mdash; ${_esc(stu.name)}
        </div>
        ${prevHtml}
        <div class="form-group" style="margin-bottom:12px">
          <label>Total Marks</label>
          <input type="number" id="score-total" value="${totalMarks}" min="1" />
        </div>
        <div class="form-group" style="margin-bottom:12px">
          <label>Marks Obtained</label>
          <input type="number" id="score-obtained" min="0" placeholder="e.g. 85" />
        </div>
        <div class="form-group">
          <label>Date</label>
          <input type="date" id="score-date" value="${today}" />
        </div>
      </div>
      <div class="qb-modal__footer">
        <button class="btn btn-primary" id="score-modal-save">Save</button>
        <button class="btn"             id="score-modal-cancel">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => modal.remove();
  document.getElementById("score-modal-close")?.addEventListener("click",  close);
  document.getElementById("score-modal-cancel")?.addEventListener("click", close);
  modal.addEventListener("click",   e => { if (e.target === modal) close(); });
  modal.addEventListener("keydown", e => {
    if (e.key === "Escape") { close(); return; }
    if (e.key === "Enter" && e.target.tagName === "INPUT") {
      document.getElementById("score-modal-save")?.click();
    }
  });

  document.getElementById("score-modal-save")?.addEventListener("click", async () => {
    const obtained = parseInt(document.getElementById("score-obtained")?.value);
    const total    = parseInt(document.getElementById("score-total")?.value);
    const date     = document.getElementById("score-date")?.value || today;

    if (isNaN(obtained) || obtained < 0) { showToast("Enter a valid score (0 or more).",           "error"); return; }
    if (isNaN(total)    || total    < 1) { showToast("Total marks must be at least 1.",             "error"); return; }
    if (obtained > total)                { showToast(`Score ${obtained} exceeds total ${total}.`,   "error"); return; }

    // Duplicate guard: warn if a score for the same date already exists
    const dupOnDate = existingScores.find(s => s.wsId === wsId && s.date === date);
    if (dupOnDate) {
      if (!confirm(`A score (${dupOnDate.score}/${dupOnDate.total}) is already recorded for ${date}. Replace it?`)) return;
      // Remove the duplicate entry by re-saving the student without it
      const freshStu = await getStudent(stu.id);
      if (freshStu) {
        freshStu.scores = (freshStu.scores||[]).filter(s => !(s.wsId === wsId && s.date === date));
        await saveStudent(freshStu);
      }
    }

    await recordScore(stu.id, wsId, obtained, total, date);

    // For source papers, also mark all questions as taken
    if (ws.origin === "imported") {
      const qKeys = (ws.questions||[]).map(q => ws.id + "::" + q.id);
      await markQuestionsTaken(stu.id, qKeys);
    }

    close();
    await _rerenderLibrary();
    showToast("Score recorded.", "success");
  });

  document.getElementById("score-obtained")?.focus();
}

