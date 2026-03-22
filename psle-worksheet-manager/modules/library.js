// modules/library.js
// Worksheet library dashboard — stats bar, filter bar, card grid.
// Exported entry point: renderLibrary(container)

// ---------------------------------------------------------------------------
// Filter state — persists across re-renders within the same session
// ---------------------------------------------------------------------------

let _filters = {
  level:      "",
  strand:     "",
  topic:      "",
  difficulty: "",
  type:       "",
  status:     "active",   // default: show active worksheets
  flag:       ""
};

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function renderLibrary(container) {
  const all = await getAllWorksheets();

  container.innerHTML = `
    ${_htmlStatsBar(all)}
    ${_htmlFilterBar()}
    <div id="card-grid-wrap"></div>
  `;

  _bindFilters();
  await _renderGrid();
}

// ---------------------------------------------------------------------------
// Stats bar
// ---------------------------------------------------------------------------

function _htmlStatsBar(all) {
  const active   = all.filter(w => w.status !== "archived");
  const archived = all.filter(w => w.status === "archived");

  const byLevel = ["P1","P2","P3","P4","P5","P6"].map(l => {
    const count = active.filter(w => w.level === l).length;
    return count > 0
      ? `<span class="badge badge-level" style="font-size:11px">${l}: ${count}</span>`
      : "";
  }).filter(Boolean).join(" ");

  const lastUpdated = active.length > 0
    ? active.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))[0].updatedAt
    : "—";

  return `
    <div class="stats-bar">
      <div class="stat-card">
        <div class="stat-card__value">${active.length}</div>
        <div class="stat-card__label">Active Worksheets</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__value">${archived.length}</div>
        <div class="stat-card__label">Archived</div>
      </div>
      <div class="stat-card" style="flex:2">
        <div class="stat-card__label" style="margin-bottom:6px">By Level</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">
          ${byLevel || '<span style="color:var(--grey-400);font-size:12px">No worksheets yet</span>'}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card__value" style="font-size:14px">${lastUpdated}</div>
        <div class="stat-card__label">Last Updated</div>
      </div>
      <div class="stat-card" style="display:flex;align-items:center">
        <button class="btn btn-primary" id="btn-new-from-library">+ New Worksheet</button>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------------

function _htmlFilterBar() {
  const levels      = ["P1","P2","P3","P4","P5","P6"];
  const strands     = _filters.level ? getStrands(_filters.level) : [];
  const topics      = (_filters.level && _filters.strand)
                        ? getTopics(_filters.level, _filters.strand) : [];
  const difficulties = ["Foundation","Standard","Challenge"];
  const types        = ["Practice","Word Problem","Mixed","Exam-style"];
  const flags        = [
    { value: "new",        label: "New 2026"    },
    { value: "moved_up",   label: "Moved up"    },
    { value: "moved_down", label: "Moved down"  }
  ];

  return `
    <div class="filter-bar">
      <div class="filter-group">
        <label>Level</label>
        <select id="fil-level">
          <option value="">All</option>
          ${levels.map(l => `<option value="${l}" ${_filters.level===l?"selected":""}>${l}</option>`).join("")}
        </select>
      </div>

      <div class="filter-group">
        <label>Strand</label>
        <select id="fil-strand" ${!strands.length?"disabled":""}>
          <option value="">All</option>
          ${strands.map(s => `<option value="${_esc(s)}" ${_filters.strand===s?"selected":""}>${_esc(s)}</option>`).join("")}
        </select>
      </div>

      <div class="filter-group">
        <label>Topic</label>
        <select id="fil-topic" ${!topics.length?"disabled":""}>
          <option value="">All</option>
          ${topics.map(t => `<option value="${_esc(t)}" ${_filters.topic===t?"selected":""}>${_esc(t)}</option>`).join("")}
        </select>
      </div>

      <div class="filter-group">
        <label>Difficulty</label>
        <select id="fil-difficulty">
          <option value="">All</option>
          ${difficulties.map(d => `<option value="${d}" ${_filters.difficulty===d?"selected":""}>${d}</option>`).join("")}
        </select>
      </div>

      <div class="filter-group">
        <label>Type</label>
        <select id="fil-type">
          <option value="">All</option>
          ${types.map(t => `<option value="${_esc(t)}" ${_filters.type===t?"selected":""}>${_esc(t)}</option>`).join("")}
        </select>
      </div>

      <div class="filter-group">
        <label>Status</label>
        <select id="fil-status">
          <option value="active"   ${_filters.status==="active"  ?"selected":""}>Active</option>
          <option value="archived" ${_filters.status==="archived"?"selected":""}>Archived</option>
          <option value=""                                                       >All</option>
        </select>
      </div>

      <div class="filter-group">
        <label>2026 Flag</label>
        <select id="fil-flag">
          <option value="">All</option>
          ${flags.map(f => `<option value="${f.value}" ${_filters.flag===f.value?"selected":""}>${f.label}</option>`).join("")}
        </select>
      </div>

      <button class="filter-reset" id="btn-filter-reset">Reset</button>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Card grid
// ---------------------------------------------------------------------------

function _applyFilters(all) {
  return all.filter(ws => {
    if (_filters.level      && ws.level      !== _filters.level)      return false;
    if (_filters.strand     && ws.strand     !== _filters.strand)     return false;
    if (_filters.topic      && ws.topic      !== _filters.topic)      return false;
    if (_filters.difficulty && ws.difficulty !== _filters.difficulty) return false;
    if (_filters.type       && ws.type       !== _filters.type)       return false;
    if (_filters.status     && ws.status     !== _filters.status)     return false;
    if (_filters.flag) {
      const f = getFlag(ws.topic);
      if (!f || f.flag !== _filters.flag) return false;
    }
    return true;
  });
}

async function _renderGrid() {
  const wrap = document.getElementById("card-grid-wrap");
  if (!wrap) return;

  const all      = await getAllWorksheets();
  const filtered = _applyFilters(all);

  if (filtered.length === 0) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">&#128196;</div>
        <div class="empty-state__text">
          ${all.length === 0
            ? "No worksheets yet. Create your first one!"
            : "No worksheets match the current filters."}
        </div>
        ${all.length === 0
          ? `<button class="btn btn-primary" id="btn-empty-new">+ New Worksheet</button>`
          : ""}
      </div>`;
    document.getElementById("btn-empty-new")
      ?.addEventListener("click", () => navigate("builder"));
    return;
  }

  wrap.innerHTML = `<div class="card-grid">${filtered.map(_htmlCard).join("")}</div>`;
  _bindCardActions();
}

function _htmlCard(ws) {
  const flag        = ws.topic ? getFlag(ws.topic) : null;
  const totalMarks  = (ws.questions||[]).reduce((s,q) => s+(parseInt(q.marks)||0), 0);
  const qCount      = (ws.questions||[]).length;
  const isArchived  = ws.status === "archived";
  const activeStu   = getActiveStudent();   // sync — memory cache

  const diffBadgeClass = {
    Foundation: "badge-foundation",
    Standard:   "badge-standard",
    Challenge:  "badge-challenge"
  }[ws.difficulty] || "badge-standard";

  const flagBadge = flag
    ? `<span class="badge badge-${flag.flag.replace("_","-")}">${_esc(flag.label)}</span>`
    : "";

  const archivedBadge = isArchived
    ? `<span class="badge badge-archived">Archived</span>`
    : "";

  // Taken badge — only when a student is active and the worksheet has questions
  let takenBadge = "";
  if (activeStu && qCount > 0) {
    const takenSet   = new Set(activeStu.takenQuestions || []);
    const takenCount = (ws.questions || []).filter(q => takenSet.has(ws.id + "::" + q.id)).length;
    if (takenCount === qCount) {
      takenBadge = `<span class="badge badge-ws-taken-all">&#10003; All taken</span>`;
    } else if (takenCount > 0) {
      takenBadge = `<span class="badge badge-ws-taken-partial">${takenCount}/${qCount} taken</span>`;
    } else {
      takenBadge = `<span class="badge badge-ws-taken-none">Not taken</span>`;
    }
  }

  return `
    <div class="ws-card ${isArchived?"ws-card--archived":""}" data-id="${_esc(ws.id)}">
      <div class="ws-card__header">
        <div class="ws-card__title">${_esc(ws.title || "Untitled")}</div>
        ${ws.level ? `<span class="badge badge-level">${_esc(ws.level)}</span>` : ""}
      </div>

      <div class="ws-card__flags">
        ${flagBadge}
        ${archivedBadge}
        ${ws.difficulty ? `<span class="badge ${diffBadgeClass}">${_esc(ws.difficulty)}</span>` : ""}
        ${ws.type ? `<span class="badge" style="background:var(--grey-200);color:var(--grey-800)">${_esc(ws.type)}</span>` : ""}
        ${takenBadge}
      </div>

      <div class="ws-card__meta">
        ${ws.strand ? `<div><strong>Strand:</strong> ${_esc(ws.strand)}</div>` : ""}
        ${ws.topic  ? `<div><strong>Topic:</strong> ${_esc(ws.topic)}</div>`  : ""}
        <div>${qCount} question${qCount!==1?"s":""} &bull; ${totalMarks} mark${totalMarks!==1?"s":""}</div>
        <div>Created ${_esc(ws.createdAt||"—")}
          ${ws.updatedAt && ws.updatedAt !== ws.createdAt
            ? ` &bull; Updated ${_esc(ws.updatedAt)}`
            : ""}
          ${ws.version > 1 ? ` &bull; v${ws.version}` : ""}
        </div>
      </div>

      <div class="ws-card__footer">
        <button class="btn btn-sm btn-card-preview"   data-id="${_esc(ws.id)}">Preview</button>
        <button class="btn btn-sm btn-card-edit"      data-id="${_esc(ws.id)}">Edit</button>
        <button class="btn btn-sm btn-card-duplicate" data-id="${_esc(ws.id)}">Duplicate</button>
        ${isArchived
          ? `<button class="btn btn-sm btn-card-unarchive" data-id="${_esc(ws.id)}">Restore</button>`
          : `<button class="btn btn-sm btn-danger btn-card-archive" data-id="${_esc(ws.id)}">Archive</button>`}
      </div>

      ${activeStu ? (() => {
        const latest = getScoresForWorksheet(activeStu.id, ws.id)[0];  // sync — uses cache
        const scoreDisplay = latest
          ? `<div class="ws-card__score">Last: ${latest.score}/${latest.total} &bull; ${_esc(latest.date)}</div>`
          : `<div class="ws-card__score ws-card__score--none">No score yet</div>`;
        return `<div class="ws-card__score-section">
          ${scoreDisplay}
          <button class="btn btn-sm btn-card-score" data-id="${_esc(ws.id)}">Record Score</button>
        </div>`;
      })() : ""}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Event binding
// ---------------------------------------------------------------------------

function _bindFilters() {
  // New worksheet button in stats bar
  document.getElementById("btn-new-from-library")
    ?.addEventListener("click", () => navigate("builder"));

  // Level cascade
  document.getElementById("fil-level")?.addEventListener("change", e => {
    _filters.level  = e.target.value;
    _filters.strand = "";
    _filters.topic  = "";
    _rebuildFilterBar();
  });

  document.getElementById("fil-strand")?.addEventListener("change", e => {
    _filters.strand = e.target.value;
    _filters.topic  = "";
    _rebuildFilterBar();
  });

  // Simple filters
  const simple = [
    ["fil-topic",      "topic"],
    ["fil-difficulty", "difficulty"],
    ["fil-type",       "type"],
    ["fil-status",     "status"],
    ["fil-flag",       "flag"]
  ];
  simple.forEach(([id, key]) => {
    document.getElementById(id)?.addEventListener("change", e => {
      _filters[key] = e.target.value;
      _renderGrid();
    });
  });

  // Reset
  document.getElementById("btn-filter-reset")?.addEventListener("click", () => {
    _filters = { level:"", strand:"", topic:"", difficulty:"", type:"", status:"active", flag:"" };
    _rebuildFilterBar();
  });
}

function _rebuildFilterBar() {
  const filterWrap = document.querySelector(".filter-bar");
  if (!filterWrap) return;
  filterWrap.outerHTML = _htmlFilterBar();
  _bindFilters();
  _renderGrid();
}

function _bindCardActions() {
  const grid = document.querySelector(".card-grid");
  if (!grid) return;

  grid.addEventListener("click", e => {
    const btn = e.target.closest("button[data-id]");
    if (!btn) return;
    const id = btn.dataset.id;

    if (btn.classList.contains("btn-card-preview"))   { navigate("preview", { editingId: id }); return; }
    if (btn.classList.contains("btn-card-edit"))      { _handleEdit(id);        return; }
    if (btn.classList.contains("btn-card-duplicate")) { _handleDuplicate(id);   return; }
    if (btn.classList.contains("btn-card-archive"))   { _handleArchive(id);     return; }
    if (btn.classList.contains("btn-card-unarchive")) { _handleUnarchive(id);   return; }
    if (btn.classList.contains("btn-card-score"))     { _handleRecordScore(id); return; }
  });
}

// ---------------------------------------------------------------------------
// Card actions
// ---------------------------------------------------------------------------

function _handleEdit(id) {
  navigate("builder", { editingId: id });
}

async function _handleDuplicate(id) {
  const ws = await getWorksheet(id);
  if (!ws) return;

  const copy = {
    ...ws,
    id:        undefined,
    title:     "Copy of " + ws.title,
    status:    "active",
    version:   1,
    createdAt: undefined,
    updatedAt: undefined,
    questions: (ws.questions || []).map(q => ({ ...q, id: "q" + Date.now() + Math.random() }))
  };

  try {
    await saveWorksheet(copy);
    showToast("Worksheet duplicated.", "success");
    _renderGrid();
  } catch (e) {
    showToast("Duplicate failed: " + e.message, "error");
  }
}

async function _handleArchive(id) {
  try {
    await archiveWorksheet(id);
    showToast("Worksheet archived.");
    _renderGrid();
  } catch (e) {
    showToast("Archive failed: " + e.message, "error");
  }
}

async function _handleUnarchive(id) {
  try {
    await unarchiveWorksheet(id);
    showToast("Worksheet restored to active.", "success");
    _renderGrid();
  } catch (e) {
    showToast("Restore failed: " + e.message, "error");
  }
}

async function _handleRecordScore(wsId) {
  const ws  = await getWorksheet(wsId);
  const stu = getActiveStudent();   // sync — cache
  if (!ws || !stu) return;

  const totalMarks = (ws.questions||[]).reduce((s,q) => s+(parseInt(q.marks)||0), 0);

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
        <div style="margin-bottom:12px;font-size:13px;color:var(--grey-600)">${_esc(ws.title || "Untitled")} &mdash; ${_esc(stu.name)}</div>
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
          <input type="date" id="score-date" value="${new Date().toISOString().slice(0,10)}" />
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
  modal.addEventListener("click", e => { if (e.target === modal) close(); });

  document.getElementById("score-modal-save")?.addEventListener("click", async () => {
    const obtainedVal = document.getElementById("score-obtained")?.value;
    const totalVal    = document.getElementById("score-total")?.value;
    const date        = document.getElementById("score-date")?.value || new Date().toISOString().slice(0,10);

    const obtained = parseInt(obtainedVal);
    const total    = parseInt(totalVal);

    if (isNaN(obtained) || obtained < 0)  { showToast("Enter a valid score.", "error"); return; }
    if (isNaN(total) || total < 1)        { showToast("Total marks must be at least 1.", "error"); return; }
    if (obtained > total)                 { showToast("Score cannot exceed total marks.", "error"); return; }

    await recordScore(stu.id, wsId, obtained, total, date);

    // Mark all questions in this worksheet as taken
    const qKeys = (ws.questions || []).map(q => ws.id + "::" + q.id);
    await markQuestionsTaken(stu.id, qKeys);

    close();
    await _renderGrid();
    showToast("Score recorded.", "success");
  });

  document.getElementById("score-obtained")?.focus();
}

// ---------------------------------------------------------------------------
// Shared escape helper (same as builder.js — each module is self-contained)
// ---------------------------------------------------------------------------

function _esc(str) {
  return String(str ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}
