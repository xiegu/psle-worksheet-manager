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

function renderLibrary(container) {
  const all = getAllWorksheets();

  container.innerHTML = `
    ${_htmlStatsBar(all)}
    ${_htmlFilterBar()}
    <div id="card-grid-wrap"></div>
  `;

  _bindFilters();
  _renderGrid();
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

function _renderGrid() {
  const wrap = document.getElementById("card-grid-wrap");
  if (!wrap) return;

  const all      = getAllWorksheets();
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
  const activeStu   = getActiveStudent();

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
    const takenSet  = new Set(activeStu.takenQuestions || []);
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
        const latest = getScoresForWorksheet(activeStu.id, ws.id)[0];
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
  // Re-render the entire filter bar so cascading dropdowns repopulate,
  // then re-bind and refresh the grid.
  const filterWrap = document.querySelector(".filter-bar");
  if (!filterWrap) return;
  filterWrap.outerHTML = _htmlFilterBar();
  // outerHTML replaces the element, so we must re-query
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

function _handleDuplicate(id) {
  const ws = getWorksheet(id);
  if (!ws) return;

  const copy = {
    ...ws,
    id:        undefined,           // force new id
    title:     "Copy of " + ws.title,
    status:    "active",
    version:   1,
    createdAt: undefined,
    updatedAt: undefined,
    questions: (ws.questions || []).map(q => ({ ...q, id: "q" + Date.now() + Math.random() }))
  };

  try {
    saveWorksheet(copy);
    showToast("Worksheet duplicated.", "success");
    _renderGrid();
  } catch (e) {
    showToast("Duplicate failed: " + e.message, "error");
  }
}

function _handleArchive(id) {
  try {
    archiveWorksheet(id);
    showToast("Worksheet archived.");
    _renderGrid();
  } catch (e) {
    showToast("Archive failed: " + e.message, "error");
  }
}

function _handleUnarchive(id) {
  try {
    unarchiveWorksheet(id);
    showToast("Worksheet restored to active.", "success");
    _renderGrid();
  } catch (e) {
    showToast("Restore failed: " + e.message, "error");
  }
}

function _handleRecordScore(wsId) {
  const ws  = getWorksheet(wsId);
  const stu = getActiveStudent();
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

  document.getElementById("score-modal-save")?.addEventListener("click", () => {
    const obtainedVal = document.getElementById("score-obtained")?.value;
    const totalVal    = document.getElementById("score-total")?.value;
    const date        = document.getElementById("score-date")?.value || new Date().toISOString().slice(0,10);

    const obtained = parseInt(obtainedVal);
    const total    = parseInt(totalVal);

    if (isNaN(obtained) || obtained < 0) { showToast("Enter a valid score.", "error"); return; }
    if (isNaN(total) || total < 1)       { showToast("Total marks must be at least 1.", "error"); return; }

    recordScore(stu.id, wsId, obtained, total, date);

    // Mark all questions in this worksheet as taken
    const qKeys = (ws.questions || []).map(q => ws.id + "::" + q.id);
    markQuestionsTaken(stu.id, qKeys);

    close();
    _renderGrid();
    showToast("Score recorded.", "success");
  });

  document.getElementById("score-obtained")?.focus();
}

function _handlePrint(id) {
  const ws = getWorksheet(id);
  if (!ws) { showToast("Worksheet not found.", "error"); return; }
  _printWorksheet(ws, false);
}

// ---------------------------------------------------------------------------
// Print
// ---------------------------------------------------------------------------

function _printWorksheet(ws, teacherMode) {
  const flag       = ws.topic ? getFlag(ws.topic) : null;
  const flagBadge  = flag
    ? `<span class="badge badge-${flag.flag.replace("_","-")}">${_esc(flag.label)}</span>`
    : "";
  const totalMarks = (ws.questions||[]).reduce((s,q) => s+(parseInt(q.marks)||0), 0);

  const questionsHtml = (ws.questions||[]).map((q, i) => {
    let body = "";
    if (q.type === "mcq") {
      const opts = q.options || [];
      body = `<div class="mcq-options">
        ${opts.map((o,oi) => `
          <div class="mcq-option">
            <div class="mcq-circle"></div>
            (${String.fromCharCode(65+oi)}) &nbsp; ${_esc(o)}
          </div>`).join("")}
      </div>`;
    } else {
      const lines = q.type === "long_answer" ? 6 : 3;
      body = `<div class="working-space">
        ${Array(lines).fill('<div class="working-line"></div>').join("")}
      </div>
      <div class="answer-box">
        <span class="ans-label">Answer:</span>
        <div class="ans-blank"></div>
      </div>`;
    }

    const answerRow  = teacherMode && q.answer
      ? `<div class="answer-key-inline">Ans: ${_esc(q.answer)}</div>` : "";
    const workingRow = teacherMode && q.working
      ? `<div class="working-key-inline">${_esc(q.working)}</div>` : "";

    return `
      <div class="question">
        <div class="question-stem">
          <span class="q-number">Q${i+1}.</span>
          <span class="q-text">${_esc(q.text)}</span>
          <span class="q-marks">[${q.marks||1}m]</span>
        </div>
        ${body}${answerRow}${workingRow}
      </div>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"/>
<title>${_esc(ws.title)}</title>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:"Times New Roman",Times,serif;font-size:13pt;color:#000;background:#e8e8e8;padding:24px}
  .page{width:210mm;min-height:297mm;background:#fff;margin:0 auto;padding:15mm;position:relative;box-shadow:0 2px 12px rgba(0,0,0,.18)}
  .ws-header{display:flex;align-items:flex-start;gap:14px;border-bottom:2.5px solid #000;padding-bottom:8px;margin-bottom:10px}
  .ws-logo{width:52px;height:52px;border:1.5px solid #999;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9pt;color:#aaa;flex-shrink:0;text-align:center}
  .ws-title-block{flex:1}
  .ws-title-block h1{font-size:16pt;font-weight:bold;letter-spacing:.04em;text-transform:uppercase}
  .ws-meta{font-size:10pt;color:#333;margin-top:3px;display:flex;gap:18px;flex-wrap:wrap}
  .badge{display:inline-block;padding:1px 7px;border-radius:3px;font-size:8.5pt;font-weight:bold;vertical-align:middle;margin-left:4px}
  .badge-level{background:#1a56a0;color:#fff}
  .badge-new{background:#d4edda;color:#155724;border:1px solid #c3e6cb}
  .badge-moved-up{background:#cce5ff;color:#004085;border:1px solid #b8daff}
  .badge-moved-down{background:#fff3cd;color:#856404;border:1px solid #ffeeba}
  .teacher-watermark{display:${teacherMode?"block":"none"};position:absolute;top:18mm;right:15mm;font-size:11pt;font-weight:bold;color:#c0392b;letter-spacing:.08em;border:2px solid #c0392b;padding:2px 8px;transform:rotate(-15deg);opacity:.7}
  .ws-info-row{display:flex;border:1.5px solid #000;margin-bottom:14px}
  .ws-info-row .info-cell{flex:1;padding:5px 8px;border-right:1px solid #000;font-size:11pt}
  .ws-info-row .info-cell:last-child{border-right:none}
  .ws-info-row .info-cell span{display:block;font-size:8.5pt;color:#555;margin-bottom:2px}
  .ws-info-row .info-cell .blank-line{border-bottom:1px solid #555;display:block;width:100%}
  .ws-instructions{font-size:10pt;font-style:italic;margin-bottom:12px;padding:5px 8px;background:#f7f7f7;border-left:3px solid #1a56a0}
  .question{margin-bottom:18px;page-break-inside:avoid}
  .question-stem{display:flex;gap:8px;align-items:baseline;margin-bottom:6px}
  .q-number{font-weight:bold;min-width:28px;flex-shrink:0}
  .q-marks{font-size:9pt;color:#555;white-space:nowrap;flex-shrink:0}
  .q-text{flex:1;line-height:1.5}
  .working-space{margin-left:36px;margin-top:4px}
  .working-line{border-bottom:1px dotted #bbb;height:22px;width:100%}
  .answer-box{margin-left:36px;margin-top:6px;display:flex;align-items:center;gap:10px}
  .ans-label{font-size:10pt;font-weight:bold;white-space:nowrap}
  .ans-blank{border-bottom:1.5px solid #000;flex:1;max-width:160px;height:20px}
  .mcq-options{margin-left:36px;margin-top:6px;display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;font-size:11pt}
  .mcq-option{display:flex;align-items:baseline;gap:6px}
  .mcq-circle{width:14px;height:14px;border:1.5px solid #000;border-radius:50%;display:inline-block;flex-shrink:0}
  .answer-key-inline{margin-left:36px;margin-top:4px;font-size:10pt;color:#1a7a3c;font-weight:600}
  .working-key-inline{margin-left:36px;font-size:9.5pt;color:#555;font-style:italic}
  .ws-footer{border-top:2px solid #000;margin-top:20px;padding-top:8px;display:flex;justify-content:space-between;align-items:center;font-size:11pt}
  .marks-box{border:1.5px solid #000;padding:4px 14px;font-size:12pt;font-weight:bold}
  @media print{
    body{background:none;padding:0}
    .page{width:210mm;min-height:297mm;margin:0;padding:15mm;box-shadow:none;page-break-after:always}
    .question{page-break-inside:avoid}
    .badge{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    @page{size:A4 portrait;margin:0}
  }
</style>
</head><body>
<div class="page">
  <div class="teacher-watermark">ANSWER KEY</div>
  <div class="ws-header">
    <div class="ws-logo">LOGO</div>
    <div class="ws-title-block">
      <h1>Math Worksheet</h1>
      <div class="ws-meta">
        ${ws.level ? `<span>Level: <span class="badge badge-level">${_esc(ws.level)}</span></span>` : ""}
        <span>Topic: ${_esc(ws.topic||"—")} ${flagBadge}</span>
        ${ws.difficulty ? `<span>Difficulty: ${_esc(ws.difficulty)}</span>` : ""}
        ${ws.type       ? `<span>Type: ${_esc(ws.type)}</span>` : ""}
      </div>
    </div>
  </div>
  <div class="ws-info-row">
    <div class="info-cell"><span>Name</span><div class="blank-line"></div></div>
    <div class="info-cell"><span>Class</span><div class="blank-line"></div></div>
    <div class="info-cell"><span>Date</span><div class="blank-line"></div></div>
    <div class="info-cell"><span>Score</span><div class="blank-line"></div></div>
  </div>
  <div class="ws-instructions">
    Answer all questions. Show your working clearly. Marks are awarded for correct working.
  </div>
  ${questionsHtml}
  <div class="ws-footer">
    <span>${_esc(ws.title)}</span>
    <div class="marks-box">Total: &nbsp;&nbsp;&nbsp;&nbsp; / ${totalMarks} marks</div>
  </div>
</div>
<script>window.onload=function(){window.print();}<\/script>
</body></html>`;

  const win = window.open("", "_blank");
  if (!win) {
    showToast("Pop-up blocked — please allow pop-ups for this page.", "error");
    return;
  }
  win.document.write(html);
  win.document.close();
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
