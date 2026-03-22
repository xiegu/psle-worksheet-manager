// modules/questionbank.js
// Question Bank — browse all individual questions extracted from all worksheets.
// Entry point: renderQuestionBank(container)

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

let _qbFilters = {
  level:       "",
  strand:      "",
  topic:       "",
  difficulty:  "",
  qtype:       "",  // "mcq" | "short_answer" | "long_answer"
  builtFilter: ""   // "" = All, "built" = Built only, "not-built" = Not built only
};

let _selected        = new Set(); // set of composite keys "wsId::qId"
let _builtSourceKeys = new Set(); // sourceKeys present in any active worksheet — refreshed on each render

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function renderQuestionBank(container) {
  _selected.clear();
  const allQ = await _getAllEnrichedQuestions();

  container.innerHTML = `
    ${_htmlQBStatsBar(allQ)}
    ${_htmlQBFilterBar()}
    <div id="qb-selection-bar"></div>
    <div id="qb-grid-wrap"></div>
  `;

  _bindQBFilters();
  await _renderQBGrid();
}

// ---------------------------------------------------------------------------
// Data: extract all questions from all worksheets, tagged with parent metadata
// ---------------------------------------------------------------------------

async function _getAllEnrichedQuestions() {
  const result = [];
  // Only questions from active source papers appear in the Question Bank
  for (const ws of (await getAllWorksheets()).filter(w => w.origin === "imported" && w.status !== "archived")) {
    for (const q of (ws.questions || [])) {
      if (!q.id || !q.text) continue;
      result.push({
        ...q,
        _key:          ws.id + "::" + q.id,
        _wsId:         ws.id,
        _wsTitle:      ws.title,
        _wsLevel:      ws.level,
        _wsStrand:     q.strand || ws.strand,   // question-level overrides worksheet
        _wsTopic:      q.topic  || ws.topic,
        _wsDifficulty: ws.difficulty,
        _wsType:       ws.type,
        _wsStatus:     ws.status
      });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Stats bar
// ---------------------------------------------------------------------------

function _htmlQBStatsBar(allQ) {
  const byLevel = ["P1","P2","P3","P4","P5","P6"].map(l => {
    const count = allQ.filter(q => q._wsLevel === l).length;
    return count > 0
      ? `<span class="badge badge-level" style="font-size:11px">${l}: ${count}</span>`
      : "";
  }).filter(Boolean).join(" ");

  const wsCount = new Set(allQ.map(q => q._wsId)).size;

  return `
    <div class="stats-bar">
      <div class="stat-card">
        <div class="stat-card__value">${allQ.length}</div>
        <div class="stat-card__label">Total Questions</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__value">${wsCount}</div>
        <div class="stat-card__label">From Papers</div>
      </div>
      <div class="stat-card" style="flex:2">
        <div class="stat-card__label" style="margin-bottom:6px">By Level</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">
          ${byLevel || '<span style="color:var(--grey-400);font-size:12px">No questions yet</span>'}
        </div>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------------

function _htmlQBFilterBar() {
  const levels       = ["P1","P2","P3","P4","P5","P6"];
  const strands      = _qbFilters.level ? getStrands(_qbFilters.level) : [];
  const topics       = (_qbFilters.level && _qbFilters.strand)
                         ? getTopics(_qbFilters.level, _qbFilters.strand) : [];
  const qtypes       = [
    { value: "mcq",          label: "MCQ"          },
    { value: "short_answer", label: "Short Answer" },
    { value: "long_answer",  label: "Long Answer"  }
  ];
  const difficulties = ["Foundation","Standard","Challenge"];

  return `
    <div class="filter-bar" id="qb-filter-bar">
      <div class="filter-group">
        <label>Level</label>
        <select id="qbf-level">
          <option value="">All</option>
          ${levels.map(l => `<option value="${l}" ${_qbFilters.level===l?"selected":""}>${l}</option>`).join("")}
        </select>
      </div>

      <div class="filter-group">
        <label>Strand</label>
        <select id="qbf-strand" ${!strands.length?"disabled":""}>
          <option value="">All</option>
          ${strands.map(s => `<option value="${_esc(s)}" ${_qbFilters.strand===s?"selected":""}>${_esc(s)}</option>`).join("")}
        </select>
      </div>

      <div class="filter-group">
        <label>Topic</label>
        <select id="qbf-topic" ${!topics.length?"disabled":""}>
          <option value="">All</option>
          ${topics.map(t => `<option value="${_esc(t)}" ${_qbFilters.topic===t?"selected":""}>${_esc(t)}</option>`).join("")}
        </select>
      </div>

      <div class="filter-group">
        <label>Q-Type</label>
        <select id="qbf-qtype">
          <option value="">All</option>
          ${qtypes.map(q => `<option value="${q.value}" ${_qbFilters.qtype===q.value?"selected":""}>${q.label}</option>`).join("")}
        </select>
      </div>

      <div class="filter-group">
        <label>Difficulty</label>
        <select id="qbf-difficulty">
          <option value="">All</option>
          ${difficulties.map(d => `<option value="${d}" ${_qbFilters.difficulty===d?"selected":""}>${d}</option>`).join("")}
        </select>
      </div>

      <div class="filter-group">
        <label>Built</label>
        <select id="qbf-built">
          <option value=""          ${_qbFilters.builtFilter===""         ?"selected":""}>All</option>
          <option value="built"     ${_qbFilters.builtFilter==="built"    ?"selected":""}>Built</option>
          <option value="not-built" ${_qbFilters.builtFilter==="not-built"?"selected":""}>Not built</option>
        </select>
      </div>

      <button class="filter-reset" id="qbf-reset">Reset</button>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

function _applyQBFilters(allQ) {
  return allQ.filter(q => {
    if (_qbFilters.level      && q._wsLevel      !== _qbFilters.level)      return false;
    if (_qbFilters.strand     && q._wsStrand     !== _qbFilters.strand)     return false;
    if (_qbFilters.topic      && q._wsTopic      !== _qbFilters.topic)      return false;
    if (_qbFilters.difficulty && q._wsDifficulty !== _qbFilters.difficulty) return false;
    if (_qbFilters.qtype      && q.type          !== _qbFilters.qtype)      return false;
    if (_qbFilters.builtFilter === "built"     && !_builtSourceKeys.has(q._key)) return false;
    if (_qbFilters.builtFilter === "not-built" &&  _builtSourceKeys.has(q._key)) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// Selection bar
// ---------------------------------------------------------------------------

function _htmlSelectionBar(filteredCount) {
  const n = _selected.size;
  const allChecked = filteredCount > 0 && n >= filteredCount;

  return `
    <div class="qb-selection-bar ${n > 0 ? "qb-selection-bar--active" : ""}">
      <label class="qb-select-all-label">
        <input type="checkbox" id="qb-select-all" ${allChecked ? "checked" : ""} />
        ${n > 0 ? `<strong>${n}</strong> selected` : "Select all visible"}
      </label>
      ${n > 0 ? `
        <button class="btn btn-primary" id="btn-build-from-bank">
          &#43; Build Worksheet (${n} question${n!==1?"s":""})
        </button>
        <button class="btn" id="btn-clear-selection">Clear</button>
      ` : ""}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Grid
// ---------------------------------------------------------------------------

async function _renderQBGrid() {
  const wrap   = document.getElementById("qb-grid-wrap");
  const selBar = document.getElementById("qb-selection-bar");
  if (!wrap || !selBar) return;

  const allQ = await _getAllEnrichedQuestions();

  // Refresh built source keys: sourceKeys present in any active (built) worksheet
  const allWs = await getAllWorksheets();
  _builtSourceKeys = new Set(
    allWs
      .filter(w => w.origin !== "imported" && w.status !== "archived")
      .flatMap(w => (w.questions || []).map(q => q.sourceKey).filter(Boolean))
  );

  const filtered = _applyQBFilters(allQ);

  selBar.innerHTML = _htmlSelectionBar(filtered.length);
  _bindSelectionBar(filtered);

  if (filtered.length === 0) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">&#10067;</div>
        <div class="empty-state__text">
          ${allQ.length === 0
            ? "No questions yet. Import worksheets via the Library or create some in the builder."
            : "No questions match the current filters."}
        </div>
      </div>`;
    return;
  }

  wrap.innerHTML = `<div class="qb-grid">${filtered.map(q => _htmlQCard(q, _builtSourceKeys)).join("")}</div>`;
  _bindQBCardActions();
}

// ---------------------------------------------------------------------------
// Question card HTML
// ---------------------------------------------------------------------------

function _htmlQCard(q, builtSourceKeys) {
  const qtypeLabel = {
    mcq:          "MCQ",
    short_answer: "Short",
    long_answer:  "Long"
  }[q.type] || q.type;

  const qtypeCls = {
    mcq:          "badge-qtype-mcq",
    short_answer: "badge-qtype-short",
    long_answer:  "badge-qtype-long"
  }[q.type] || "";

  const isSelected = _selected.has(q._key);
  const hasDiagram = !!q.diagramImage;
  const flag       = q._wsTopic ? getFlag(q._wsTopic) : null;
  const flagBadge  = flag
    ? `<span class="badge badge-${flag.flag.replace("_","-")}" style="font-size:9px">${_esc(flag.label)}</span>`
    : "";
  const archivedBadge = q._wsStatus === "archived"
    ? `<span class="badge badge-archived" style="font-size:9px">Archived</span>`
    : "";
  const builtBadge = builtSourceKeys && builtSourceKeys.has(q._key)
    ? `<span class="badge badge-taken">Built</span>`
    : "";

  const shortText = q.text.length > 130 ? q.text.slice(0, 130) + "…" : q.text;

  const optionsHtml = q.type === "mcq" && q.options
    ? `<div class="qb-card__options">
        ${(q.options||[]).slice(0,4).map((o,i) =>
          `<div class="qb-card__option">${String.fromCharCode(65+i)}. ${_esc(o)}</div>`
        ).join("")}
       </div>`
    : "";

  return `
    <div class="qb-card ${isSelected ? "qb-card--selected" : ""}" data-key="${_esc(q._key)}">
      <div class="qb-card__header">
        <input type="checkbox" class="qb-checkbox" data-key="${_esc(q._key)}" ${isSelected ? "checked" : ""} />
        <span class="badge ${qtypeCls}">${qtypeLabel}</span>
        <span class="qb-card__marks">${q.marks || 1}m</span>
        <div style="flex:1"></div>
        ${q._wsLevel ? `<span class="badge badge-level" style="font-size:10px">${_esc(q._wsLevel)}</span>` : ""}
        ${builtBadge}
        ${archivedBadge}
      </div>

      <div class="qb-card__text">${_esc(shortText)}</div>

      ${optionsHtml}

      <div class="qb-card__source">
        ${q._wsTopic ? `<strong>${_esc(q._wsTopic)}</strong>` : ""}
        ${flagBadge}
        ${hasDiagram ? `<span class="badge badge-qtype-diagram">Diagram</span>` : ""}
        <span class="qb-card__ws-title" title="${_esc(q._wsTitle)}">
          &mdash; ${_esc(q._wsTitle || "Untitled")}
        </span>
      </div>

      <div class="qb-card__footer">
        <button class="btn btn-sm btn-primary qb-btn-use"     data-key="${_esc(q._key)}">Use</button>
        <button class="btn btn-sm           qb-btn-preview"   data-key="${_esc(q._key)}">Preview</button>
        <button class="btn btn-sm           qb-btn-edit"      data-key="${_esc(q._key)}">Edit</button>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Event binding
// ---------------------------------------------------------------------------

function _bindQBFilters() {
  document.getElementById("qbf-level")?.addEventListener("change", e => {
    _qbFilters.level  = e.target.value;
    _qbFilters.strand = "";
    _qbFilters.topic  = "";
    _rebuildQBFilterBar();
  });

  document.getElementById("qbf-strand")?.addEventListener("change", e => {
    _qbFilters.strand = e.target.value;
    _qbFilters.topic  = "";
    _rebuildQBFilterBar();
  });

  [["qbf-topic","topic"],["qbf-qtype","qtype"],["qbf-difficulty","difficulty"]].forEach(([id, key]) => {
    document.getElementById(id)?.addEventListener("change", e => {
      _qbFilters[key] = e.target.value;
      _renderQBGrid();
    });
  });

  document.getElementById("qbf-built")?.addEventListener("change", e => {
    _qbFilters.builtFilter = e.target.value;
    _renderQBGrid();
  });

  document.getElementById("qbf-reset")?.addEventListener("click", () => {
    _qbFilters = { level:"", strand:"", topic:"", difficulty:"", qtype:"", builtFilter:"" };
    _rebuildQBFilterBar();
  });
}

function _rebuildQBFilterBar() {
  const bar = document.getElementById("qb-filter-bar");
  if (!bar) return;
  bar.outerHTML = _htmlQBFilterBar();
  _bindQBFilters();
  _renderQBGrid();
}

function _bindSelectionBar(filtered) {
  document.getElementById("qb-select-all")?.addEventListener("change", e => {
    if (e.target.checked) {
      filtered.forEach(q => _selected.add(q._key));
    } else {
      filtered.forEach(q => _selected.delete(q._key));
    }
    _renderQBGrid();
  });

  document.getElementById("btn-build-from-bank")?.addEventListener("click", async () => {
    await _markSelectedTaken();
    await _buildFromSelected();
  });

  document.getElementById("btn-clear-selection")?.addEventListener("click", () => {
    _selected.clear();
    _renderQBGrid();
  });
}

function _bindQBCardActions() {
  const grid = document.querySelector(".qb-grid");
  if (!grid) return;

  // Checkbox toggle
  grid.addEventListener("change", e => {
    if (!e.target.classList.contains("qb-checkbox")) return;
    const key = e.target.dataset.key;
    if (e.target.checked) _selected.add(key);
    else                   _selected.delete(key);
    _renderQBGrid();
  });

  // Button clicks
  grid.addEventListener("click", async e => {
    const btn = e.target.closest("button[data-key]");
    if (!btn) return;
    const key = btn.dataset.key;

    if (btn.classList.contains("qb-btn-use")) {
      _selected.clear();
      _selected.add(key);
      await _markSelectedTaken();
      await _buildFromSelected();
      return;
    }

    if (btn.classList.contains("qb-btn-preview")) {
      await _previewQuestion(key);
      return;
    }

    if (btn.classList.contains("qb-btn-edit")) {
      await _editQuestion(key);
      return;
    }
  });
}

// ---------------------------------------------------------------------------
// Mark selected questions as taken (called before building)
// ---------------------------------------------------------------------------

async function _markSelectedTaken() {
  const stu = getActiveStudent();   // sync — cache
  if (!stu || _selected.size === 0) return;
  await markQuestionsTaken(stu.id, Array.from(_selected));
}

// ---------------------------------------------------------------------------
// Build worksheet from selected questions
// ---------------------------------------------------------------------------

async function _buildFromSelected() {
  if (_selected.size === 0) return;

  const allQ      = await _getAllEnrichedQuestions();
  const selectedQ = allQ.filter(q => _selected.has(q._key));

  // Strip internal _ws* fields and assign fresh IDs
  const questions = selectedQ.map(q => {
    const clean = {
      id:        "q_" + Date.now() + "_" + Math.floor(Math.random() * 1e6),
      type:      q.type,
      text:      q.text,
      marks:     q.marks,
      answer:    q.answer  || "",
      working:   q.working || "",
      sourceKey: q._key          // track which source paper question this came from
    };
    if (q.type === "mcq" && q.options) clean.options = [...q.options];
    if (q.diagramImage) clean.diagramImage = q.diagramImage;
    return clean;
  });

  // Pre-fill builder metadata from the first selected question's parent worksheet
  const first = selectedQ[0];
  AppState.bankQuestions = questions;
  AppState.bankMeta = {
    level:      first._wsLevel      || "",
    strand:     first._wsStrand     || "",
    topic:      first._wsTopic      || "",
    difficulty: first._wsDifficulty || "Standard",
    type:       first._wsType       || "Practice"
  };

  navigate("builder");
}

// ---------------------------------------------------------------------------
// Question preview modal
// ---------------------------------------------------------------------------

async function _previewQuestion(key) {
  const allQ = await _getAllEnrichedQuestions();
  const q    = allQ.find(x => x._key === key);
  if (!q) return;
  _showQPreviewModal(q);
}

function _showQPreviewModal(q) {
  document.getElementById("qb-modal")?.remove();

  const qtypeLabel = {
    mcq:          "MCQ",
    short_answer: "Short Answer",
    long_answer:  "Long Answer"
  }[q.type] || q.type;

  const optionsHtml = q.type === "mcq" && q.options
    ? `<div class="qb-modal__options">
        ${(q.options||[]).map((o,i) => `
          <div class="qb-modal__option">
            <span class="qb-modal__option-letter">${String.fromCharCode(65+i)}.</span>
            ${_esc(o)}
          </div>`).join("")}
       </div>`
    : "";

  const diagramHtml = q.diagramImage
    ? `<img src="${q.diagramImage}" style="max-width:100%;max-height:200px;border:1px solid #ccc;border-radius:4px;display:block" alt="Diagram" />`
    : "";

  const answerHtml = q.answer
    ? `<div class="qb-modal__answer"><strong>Answer:</strong> ${_esc(q.answer)}</div>`
    : "";

  const workingHtml = q.working
    ? `<div class="qb-modal__working"><strong>Working:</strong><br>${_esc(q.working)}</div>`
    : "";

  const modal = document.createElement("div");
  modal.id        = "qb-modal";
  modal.className = "qb-modal-overlay";
  modal.innerHTML = `
    <div class="qb-modal" role="dialog" aria-modal="true">
      <div class="qb-modal__header">
        <div style="display:flex;align-items:center;gap:8px">
          ${q._wsLevel ? `<span class="badge badge-level">${_esc(q._wsLevel)}</span>` : ""}
          <span style="font-size:12px;color:var(--grey-600)">${_esc(qtypeLabel)}</span>
          <span style="font-size:12px;font-weight:700">${q.marks||1} mark${(q.marks||1)!==1?"s":""}</span>
        </div>
        <button class="qb-modal__close" id="qb-modal-close" aria-label="Close">&times;</button>
      </div>
      <div class="qb-modal__body">
        <div class="qb-modal__source">
          ${_esc(q._wsTitle || "Untitled")}
          ${q._wsTopic ? ` &mdash; ${_esc(q._wsTopic)}` : ""}
        </div>
        <div class="qb-modal__text">${_esc(q.text || "")}</div>
        ${diagramHtml}
        ${optionsHtml}
        ${answerHtml}
        ${workingHtml}
      </div>
      <div class="qb-modal__footer">
        <button class="btn btn-primary" id="qb-modal-use">Use in Worksheet</button>
        <button class="btn" id="qb-modal-cancel">Close</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  document.getElementById("qb-modal-close")?.addEventListener("click",  close);
  document.getElementById("qb-modal-cancel")?.addEventListener("click", close);
  modal.addEventListener("click", e => { if (e.target === modal) close(); });

  document.getElementById("qb-modal-use")?.addEventListener("click", async () => {
    close();
    _selected.clear();
    _selected.add(q._key);
    await _markSelectedTaken();
    await _buildFromSelected();
  });

  document.getElementById("qb-modal-close")?.focus();
}

// ---------------------------------------------------------------------------
// Edit question modal
// ---------------------------------------------------------------------------

async function _editQuestion(key) {
  const allQ = await _getAllEnrichedQuestions();
  const q    = allQ.find(x => x._key === key);
  if (!q) return;
  _showQEditModal(q);
}

function _showQEditModal(q) {
  document.getElementById("qb-edit-modal")?.remove();

  const hasDiagram = !!q.diagramImage;

  const modal = document.createElement("div");
  modal.id        = "qb-edit-modal";
  modal.className = "qb-modal-overlay";
  modal.innerHTML = `
    <div class="qb-modal" role="dialog" aria-modal="true" style="max-width:600px;width:90vw">
      <div class="qb-modal__header">
        <div style="font-weight:700;font-size:15px">Edit Question</div>
        <button class="qb-modal__close" id="qb-edit-close" aria-label="Close">&times;</button>
      </div>
      <div class="qb-modal__body" style="max-height:68vh;overflow-y:auto">
        <label class="qb-edit-label">Question Text</label>
        <textarea id="qb-edit-text" class="qb-edit-textarea" rows="5">${_esc(q.text || "")}</textarea>

        <div style="display:flex;gap:12px">
          <div style="flex:1">
            <label class="qb-edit-label">Strand</label>
            <select id="qb-edit-strand" style="width:100%;padding:6px 8px;border:1px solid var(--grey-300);border-radius:6px;font-size:13px">
              <option value="">— select —</option>
              ${(getStrands(q._wsLevel) || []).map(s =>
                `<option value="${_esc(s)}" ${(q.strand||q._wsStrand)===s?"selected":""}>${_esc(s)}</option>`
              ).join("")}
            </select>
          </div>
          <div style="flex:1">
            <label class="qb-edit-label">Topic</label>
            <select id="qb-edit-topic" style="width:100%;padding:6px 8px;border:1px solid var(--grey-300);border-radius:6px;font-size:13px">
              <option value="">— select —</option>
              ${(getTopics(q._wsLevel, q.strand||q._wsStrand) || []).map(t =>
                `<option value="${_esc(t)}" ${(q.topic||q._wsTopic)===t?"selected":""}>${_esc(t)}</option>`
              ).join("")}
            </select>
          </div>
        </div>

        ${hasDiagram ? `
          <div id="qb-edit-diagram-section">
            <label class="qb-edit-label">
              Diagram &mdash; <span style="font-weight:400;text-transform:none;letter-spacing:0">drag on image to select crop area, then click Apply Crop</span>
            </label>
            <div class="qb-crop-container" id="qb-crop-container">
              <img id="qb-crop-img" src="${q.diagramImage}" alt="Diagram" />
              <canvas id="qb-crop-canvas"></canvas>
            </div>
            <div class="qb-crop-actions">
              <button class="btn btn-sm btn-primary" id="qb-crop-apply">Apply Crop</button>
              <button class="btn btn-sm" id="qb-crop-reset">Reset</button>
            </div>
            <div id="qb-crop-preview-wrap" style="display:none;margin-top:12px">
              <label class="qb-edit-label">Cropped Preview</label>
              <img id="qb-crop-preview" style="max-width:100%;border:1px solid var(--grey-300);border-radius:4px;display:block" />
            </div>
          </div>
        ` : ""}
      </div>
      <div class="qb-modal__footer">
        <button class="btn btn-primary" id="qb-edit-save">Save</button>
        <button class="btn" id="qb-edit-cancel">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  document.getElementById("qb-edit-close")?.addEventListener("click",  close);
  document.getElementById("qb-edit-cancel")?.addEventListener("click", close);
  modal.addEventListener("click", e => { if (e.target === modal) close(); });

  // Cascade: strand → topic
  document.getElementById("qb-edit-strand")?.addEventListener("change", e => {
    const topics   = getTopics(q._wsLevel, e.target.value) || [];
    const topicSel = document.getElementById("qb-edit-topic");
    if (!topicSel) return;
    topicSel.innerHTML = `<option value="">— select —</option>` +
      topics.map(t => `<option value="${_esc(t)}">${_esc(t)}</option>`).join("");
  });

  if (hasDiagram) _setupCropCanvas(q.diagramImage);

  document.getElementById("qb-edit-save")?.addEventListener("click", async () => {
    const textEl   = document.getElementById("qb-edit-text");
    const canvas   = document.getElementById("qb-crop-canvas");
    const strandEl = document.getElementById("qb-edit-strand");
    const topicEl  = document.getElementById("qb-edit-topic");
    const newText   = textEl?.value.trim()  ?? q.text;
    const newStrand = strandEl?.value.trim() || "";
    const newTopic  = topicEl?.value.trim()  || "";
    const newImage  = canvas?.dataset.pendingCrop || null;

    const ws = await getWorksheet(q._wsId);
    if (!ws) { alert("Worksheet not found."); return; }

    const qIdx = (ws.questions || []).findIndex(x => x.id === q.id);
    if (qIdx === -1) { alert("Question not found."); return; }

    ws.questions[qIdx] = {
      ...ws.questions[qIdx],
      text:   newText,
      strand: newStrand,
      topic:  newTopic,
      ...(newImage ? { diagramImage: newImage } : {})
    };

    try {
      await saveWorksheet(ws);
      close();
      _renderQBGrid();
    } catch (err) {
      alert("Save failed: " + err.message);
    }
  });

  document.getElementById("qb-edit-close")?.focus();
}

function _setupCropCanvas(originalDiagramUrl) {
  const imgEl  = document.getElementById("qb-crop-img");
  const canvas = document.getElementById("qb-crop-canvas");
  if (!imgEl || !canvas) return;

  const sizeCanvas = () => {
    canvas.width        = imgEl.clientWidth;
    canvas.height       = imgEl.clientHeight;
    canvas.style.width  = imgEl.clientWidth  + "px";
    canvas.style.height = imgEl.clientHeight + "px";
  };
  if (imgEl.complete && imgEl.naturalWidth) sizeCanvas();
  imgEl.addEventListener("load", sizeCanvas);

  const ctx = canvas.getContext("2d");
  let sel = null, dragging = false, startX = 0, startY = 0;

  canvas.addEventListener("mousedown", e => {
    const r = canvas.getBoundingClientRect();
    startX   = e.clientX - r.left;
    startY   = e.clientY - r.top;
    dragging = true;
    sel      = null;
  });

  canvas.addEventListener("mousemove", e => {
    if (!dragging) return;
    const r  = canvas.getBoundingClientRect();
    const ex = e.clientX - r.left;
    const ey = e.clientY - r.top;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Darken everything outside selection
    ctx.fillStyle = "rgba(0,0,0,0.40)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const sx = Math.min(startX, ex);
    const sy = Math.min(startY, ey);
    const sw = Math.abs(ex - startX);
    const sh = Math.abs(ey - startY);

    // Clear (brighten) the selection area
    ctx.clearRect(sx, sy, sw, sh);
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth   = 2;
    ctx.strokeRect(sx, sy, sw, sh);

    sel = { x: sx, y: sy, w: sw, h: sh };
  });

  canvas.addEventListener("mouseup",    () => { dragging = false; });
  canvas.addEventListener("mouseleave", () => { dragging = false; });

  document.getElementById("qb-crop-apply")?.addEventListener("click", () => {
    if (!sel || sel.w < 10 || sel.h < 10) {
      alert("Drag on the image to select the area you want to keep.");
      return;
    }
    const scaleX = imgEl.naturalWidth  / imgEl.clientWidth;
    const scaleY = imgEl.naturalHeight / imgEl.clientHeight;

    const cc = document.createElement("canvas");
    cc.width  = Math.round(sel.w * scaleX);
    cc.height = Math.round(sel.h * scaleY);
    cc.getContext("2d").drawImage(
      imgEl,
      sel.x * scaleX, sel.y * scaleY, sel.w * scaleX, sel.h * scaleY,
      0, 0, cc.width, cc.height
    );
    const croppedUrl = cc.toDataURL("image/jpeg", 0.9);

    const prevWrap = document.getElementById("qb-crop-preview-wrap");
    const prevImg  = document.getElementById("qb-crop-preview");
    if (prevImg)  prevImg.src            = croppedUrl;
    if (prevWrap) prevWrap.style.display = "block";

    canvas.dataset.pendingCrop = croppedUrl;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    sel = null;
  });

  document.getElementById("qb-crop-reset")?.addEventListener("click", () => {
    imgEl.src = originalDiagramUrl;
    delete canvas.dataset.pendingCrop;
    const prevWrap = document.getElementById("qb-crop-preview-wrap");
    if (prevWrap) prevWrap.style.display = "none";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    sel = null;
  });
}

// ---------------------------------------------------------------------------
// Shared escape helper
// ---------------------------------------------------------------------------

function _esc(str) {
  return String(str ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}
