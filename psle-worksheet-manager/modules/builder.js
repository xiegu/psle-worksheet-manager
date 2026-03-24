// modules/builder.js
// Worksheet creator / editor.
// Exported entry point: renderBuilder(container, editingId)

// ---------------------------------------------------------------------------
// Module state — reset on every renderBuilder call
// ---------------------------------------------------------------------------

let _draft     = {};       // metadata fields
let _questions = [];       // array of question objects
let _teacherPreview = false;
let _dragSrcIdx = null;    // drag-and-drop source index
let _undoSnapshot = null;  // last undo snapshot of _questions

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function renderBuilder(container, editingId) {
  if (editingId) {
    const ws = await getWorksheet(editingId);
    if (ws) {
      _draft     = { ...ws };
      _questions = ws.questions.map(q => ({ ...q }));
    } else {
      _resetDraft();
    }
  } else {
    _resetDraft();
    // Pre-populate from Question Bank if available
    if (AppState.bankQuestions && AppState.bankQuestions.length > 0) {
      _questions = AppState.bankQuestions;
      if (AppState.bankMeta) Object.assign(_draft, AppState.bankMeta);
    }
  }
  // Always consume bank state so it doesn't bleed into subsequent navigations
  AppState.bankQuestions = null;
  AppState.bankMeta      = null;
  _teacherPreview = false;
  _undoSnapshot   = null;

  container.innerHTML = `
    <div class="builder-layout">
      <div id="builder-left">
        <div class="builder-form">
          <div class="builder-section" id="section-meta">
            ${_htmlMetadata()}
          </div>
          <div class="builder-section" id="section-questions">
            ${_htmlQuestionsSection()}
          </div>
          <div class="builder-section" id="section-notes">
            ${_htmlNotesSection()}
          </div>
        </div>
        <div class="builder-actions" id="builder-actions">
          ${_htmlActionBar()}
        </div>
      </div>
      <div id="builder-right">
        ${_htmlPreviewPanel()}
      </div>
    </div>
  `;

  _bindAll();
}

function _resetDraft() {
  _draft = {
    title: "", level: "", strand: "", topic: "",
    difficulty: "Standard", type: "Practice", notes: ""
  };
  _questions = [];
}

// ---------------------------------------------------------------------------
// HTML renderers — metadata
// ---------------------------------------------------------------------------

function _htmlMetadata() {
  const levels   = ["P1","P2","P3","P4","P5","P6"];
  const strands  = _draft.level ? getStrands(_draft.level) : [];
  const topics   = (_draft.level && _draft.strand) ? getTopics(_draft.level, _draft.strand) : [];

  return `
    <div class="builder-section__title">Step 1 — Worksheet Details</div>

    <div class="form-row">
      <div class="form-group full">
        <label for="f-title">Title</label>
        <input id="f-title" type="text" placeholder="e.g. P6 Algebra Practice Set 1"
               value="${_esc(_draft.title)}" maxlength="100" />
      </div>
    </div>

    <div class="form-row">
      <div class="form-group">
        <label for="f-level">Level</label>
        <select id="f-level">
          <option value="">— Select —</option>
          ${levels.map(l => `<option value="${l}" ${_draft.level===l?"selected":""}>${l}</option>`).join("")}
        </select>
      </div>
      <div class="form-group">
        <label for="f-strand">Strand</label>
        <select id="f-strand" ${!strands.length?"disabled":""}>
          <option value="">— Select level first —</option>
          ${strands.map(s => `<option value="${_esc(s)}" ${_draft.strand===s?"selected":""}>${_esc(s)}</option>`).join("")}
        </select>
      </div>
      <div class="form-group">
        <label for="f-topic">Topic</label>
        <select id="f-topic" ${!topics.length?"disabled":""}>
          <option value="">— Select strand first —</option>
          ${topics.map(t => `<option value="${_esc(t)}" ${_draft.topic===t?"selected":""}>${_esc(t)}</option>`).join("")}
        </select>
      </div>
    </div>

    <div id="flag-warning"></div>

    <div class="form-row">
      <div class="form-group">
        <label for="f-difficulty">Difficulty</label>
        <select id="f-difficulty">
          ${["Foundation","Standard","Challenge"].map(d =>
            `<option value="${d}" ${_draft.difficulty===d?"selected":""}>${d}</option>`
          ).join("")}
        </select>
      </div>
      <div class="form-group">
        <label for="f-type">Worksheet Type</label>
        <select id="f-type">
          ${["Practice","Word Problem","Mixed","Exam-style"].map(t =>
            `<option value="${t}" ${_draft.type===t?"selected":""}>${_esc(t)}</option>`
          ).join("")}
        </select>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// HTML renderers — questions
// ---------------------------------------------------------------------------

function _htmlQuestionsSection() {
  return `
    <div class="builder-section__title">Step 2 — Questions</div>
    <div class="question-list" id="question-list">
      ${_questions.map((q, i) => _htmlQuestionCard(q, i)).join("")}
    </div>
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">
      <button class="btn btn-primary" id="btn-add-question">+ Add Blank Question</button>
      <button class="btn" id="btn-pick-from-qb">&#10067; Pick from Question Bank</button>
    </div>
    <div class="marks-total" id="marks-total">${_marksLabel()}</div>
  `;
}

function _htmlQuestionCard(q, i) {
  const types = [
    { value: "short_answer", label: "Short Answer" },
    { value: "long_answer",  label: "Long Answer"  },
    { value: "mcq",          label: "MCQ"           }
  ];

  return `
    <div class="question-card" data-idx="${i}" draggable="true">
      <div class="question-card__header">
        <span class="drag-handle" title="Drag to reorder">&#8597;</span>
        <button class="btn btn-sm btn-move-up"   data-idx="${i}" title="Move up"   ${i===0?"disabled":""} style="padding:1px 5px;font-size:11px">&#8593;</button>
        <button class="btn btn-sm btn-move-down" data-idx="${i}" title="Move down" ${i===_questions.length-1?"disabled":""} style="padding:1px 5px;font-size:11px">&#8595;</button>
        <span class="question-card__num">Q${i + 1}</span>
        <div class="question-card__type">
          <select class="q-type-select" data-idx="${i}">
            ${types.map(t =>
              `<option value="${t.value}" ${q.type===t.value?"selected":""}>${t.label}</option>`
            ).join("")}
          </select>
        </div>
        <input class="q-marks-input" type="number" min="0" max="20" value="${q.marks||1}"
               data-idx="${i}" style="width:54px;padding:3px 6px;border:1px solid var(--border);border-radius:4px;font-size:12px;"
               title="Marks" />
        <span style="font-size:11px;color:var(--grey-600);margin-left:2px">m</span>
        <button class="btn btn-danger btn-sm btn-delete-q" data-idx="${i}"
                style="margin-left:auto" title="Delete question">&times;</button>
      </div>
      <div class="question-card__body">
        <div class="form-group">
          <label>Question</label>
          <textarea class="q-text-input" data-idx="${i}" rows="3"
                    placeholder="Enter the question text…">${_esc(q.text||"")}</textarea>
        </div>
        ${q.diagramImage ? `
          <div class="q-diagram-wrap">
            <img class="q-diagram-thumb" src="${q.diagramImage}" alt="Diagram" />
            <div class="q-diagram-label">
              <span>Diagram</span>
              <button type="button" class="btn btn-sm btn-danger q-btn-remove-diagram" data-idx="${i}">Remove</button>
            </div>
          </div>` : ""}
        ${q.type === "mcq" ? _htmlMcqOptions(q, i) : ""}
        <div class="form-group">
          <label>Answer</label>
          <textarea class="q-answer-input" data-idx="${i}" rows="2"
                    placeholder="Correct answer…">${_esc(q.answer||"")}</textarea>
        </div>
        <div class="form-group">
          <label>Working / Solution <span style="color:var(--grey-400);font-weight:400">(teacher copy only)</span></label>
          <textarea class="q-working-input" data-idx="${i}" rows="2"
                    placeholder="Step-by-step working…">${_esc(q.working||"")}</textarea>
        </div>
      </div>
    </div>
  `;
}

function _htmlMcqOptions(q, i) {
  const opts = q.options || ["","","",""];
  return `
    <div class="form-group">
      <label>Options (A / B / C / D)</label>
      ${opts.map((opt, oi) => `
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <span style="font-weight:600;min-width:18px;font-size:12px">${String.fromCharCode(65+oi)}.</span>
          <input type="text" class="q-option-input" data-idx="${i}" data-opt="${oi}"
                 value="${_esc(opt)}" placeholder="Option ${String.fromCharCode(65+oi)}"
                 style="flex:1;padding:4px 8px;border:1px solid var(--border);border-radius:4px;font-size:12px;" />
        </div>
      `).join("")}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// HTML renderers — notes, action bar, preview
// ---------------------------------------------------------------------------

function _htmlNotesSection() {
  return `
    <div class="builder-section__title">Notes <span style="color:var(--grey-400);font-weight:400">(internal, not printed)</span></div>
    <div class="form-group">
      <textarea id="f-notes" rows="3"
                placeholder="Private notes about this worksheet…">${_esc(_draft.notes||"")}</textarea>
    </div>
  `;
}

function _htmlActionBar() {
  const isEditing = !!_draft.id;
  return `
    <button class="btn" id="btn-cancel">&#8592; Back to Library</button>
    <button class="btn" id="btn-undo" style="display:${_undoSnapshot?"":"none"}">&#8617; Undo</button>
    <button class="btn btn-primary" id="btn-save">
      ${isEditing ? "Save Changes" : "Save to Library"}
    </button>
  `;
}

function _htmlPreviewPanel() {
  return `
    <div class="preview-panel">
      <div class="preview-panel__header">
        <span class="preview-panel__title">Live Preview</span>
        <div style="display:flex;gap:6px">
          <button class="btn btn-sm ${!_teacherPreview?"btn-primary":""}" id="btn-prev-student">Student</button>
          <button class="btn btn-sm ${_teacherPreview?"btn-primary":""}" id="btn-prev-teacher">Teacher</button>
          <button class="btn btn-sm" id="btn-print">Print</button>
        </div>
      </div>
      <div class="preview-panel__body" id="preview-body">
        ${_htmlPreviewContent()}
      </div>
    </div>
  `;
}

function _htmlPreviewContent() {
  if (!_draft.title && _questions.length === 0) {
    return `<div class="preview-empty">Fill in the details above to see a live preview.</div>`;
  }

  const flag    = _draft.topic ? getFlag(_draft.topic) : null;
  const flagBadge = flag
    ? `<span class="badge badge-${flag.flag.replace("_","-")}">${_esc(flag.label)}</span>`
    : "";

  const questionsHtml = _questions.length === 0
    ? `<p style="color:var(--grey-400);font-size:10px;font-style:italic">No questions yet.</p>`
    : _questions.map((q, i) => `
        <div class="preview-question">
          <div class="preview-q-stem">
            <span class="preview-q-num">Q${i+1}.</span>
            <span style="flex:1">${_esc(q.text || "(no question text)")}</span>
            <span class="preview-q-marks">[${q.marks||1}m]</span>
          </div>
          ${q.diagramImage
            ? `<img src="${q.diagramImage}"
                    style="display:block;max-width:100%;max-height:80px;margin:4px 0 4px 22px;border:1px solid #ccc;border-radius:2px"
                    alt="Diagram" />`
            : ""}
          ${q.type === "mcq" && q.options
            ? `<div style="margin-left:22px;font-size:10px;color:#333">
                ${(q.options||[]).map((o,oi)=>`<div>${String.fromCharCode(65+oi)}. ${_esc(_stripOptionPrefix(o))}</div>`).join("")}
               </div>`
            : `<div class="preview-q-lines">
                ${Array(q.type==="long_answer"?5:3).fill('<div class="preview-dotline"></div>').join("")}
               </div>`
          }
          ${_teacherPreview && q.answer
            ? `<div style="margin-left:22px;font-size:10px;color:var(--green);font-weight:600;margin-top:2px">
                Ans: ${_esc(q.answer)}
               </div>`
            : ""}
          ${_teacherPreview && q.working
            ? `<div style="margin-left:22px;font-size:9.5px;color:var(--grey-600);font-style:italic">
                ${_esc(q.working)}
               </div>`
            : ""}
        </div>
      `).join("");

  const totalMarks = _questions.reduce((s, q) => s + (parseInt(q.marks) || 0), 0);

  return `
    ${_teacherPreview
      ? `<div style="color:var(--red);font-weight:700;font-size:9px;letter-spacing:.08em;text-align:right;margin-bottom:4px">ANSWER KEY</div>`
      : ""}
    <div class="preview-ws-title">${_esc((_draft.subject||"Maths")+" Worksheet")}</div>
    <div class="preview-ws-meta">
      ${_draft.level ? `<strong>${_draft.level}</strong> &nbsp;` : ""}
      ${_draft.topic ? _esc(_draft.topic) : "<em>No topic selected</em>"}
      &nbsp;${flagBadge}
      ${_draft.difficulty ? `&nbsp;&bull;&nbsp;${_draft.difficulty}` : ""}
    </div>
    <hr class="preview-divider" />
    <div class="preview-info-row">
      <div class="preview-info-cell">Name: ___________</div>
      <div class="preview-info-cell">Class: ___</div>
      <div class="preview-info-cell">Date: ___________</div>
    </div>
    ${questionsHtml}
    <hr class="preview-divider" style="margin-top:10px" />
    <div style="text-align:right;font-size:10px;font-weight:700">Total: ___ / ${totalMarks} marks</div>
  `;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _marksLabel() {
  const total = _questions.reduce((s, q) => s + (parseInt(q.marks) || 0), 0);
  return `Running total: ${_questions.length} question${_questions.length!==1?"s":""} &mdash; ${total} mark${total!==1?"s":""}`;
}


/** Generate a collision-resistant question ID */
function _newQId() {
  return "q_" + Date.now() + "_" + Math.floor(Math.random() * 1e6);
}

/** Save questions snapshot for undo */
function _saveUndo() {
  _undoSnapshot = _questions.map(q => ({
    ...q,
    options: q.options ? [...q.options] : undefined
  }));
  const btn = document.getElementById("btn-undo");
  if (btn) btn.style.display = "";
}

// ---------------------------------------------------------------------------
// Cascading dropdowns
// ---------------------------------------------------------------------------

function _repopulateStrands() {
  const strandSel = document.getElementById("f-strand");
  const topicSel  = document.getElementById("f-topic");
  const level     = _draft.level;
  const strands   = level ? getStrands(level) : [];

  strandSel.innerHTML = `<option value="">— Select —</option>`
    + strands.map(s => `<option value="${_esc(s)}">${_esc(s)}</option>`).join("");
  strandSel.disabled  = !strands.length;

  topicSel.innerHTML  = `<option value="">— Select strand first —</option>`;
  topicSel.disabled   = true;

  _draft.strand = "";
  _draft.topic  = "";
  _updateFlagWarning();
}

function _repopulateTopics() {
  const topicSel = document.getElementById("f-topic");
  const topics   = (_draft.level && _draft.strand)
    ? getTopics(_draft.level, _draft.strand) : [];

  topicSel.innerHTML = `<option value="">— Select —</option>`
    + topics.map(t => `<option value="${_esc(t)}">${_esc(t)}</option>`).join("");
  topicSel.disabled  = !topics.length;

  _draft.topic = "";
  _updateFlagWarning();
}

function _updateFlagWarning() {
  const el    = document.getElementById("flag-warning");
  if (!el) return;
  const topic = _draft.topic;

  if (!topic) { el.innerHTML = ""; return; }

  if (isBlockedTopic(topic)) {
    el.innerHTML = `<div class="flag-warning flag-warning--blocked">
      &#9888; Speed is not in the 2026 PSLE syllabus. Please choose a different topic.
    </div>`;
    return;
  }

  const flag = getFlag(topic);
  if (!flag) { el.innerHTML = ""; return; }

  el.innerHTML = `<div class="flag-warning flag-warning--${flag.flag}">
    <strong>${_esc(flag.label)}:</strong> ${_esc(topic)}
  </div>`;
}

// ---------------------------------------------------------------------------
// Event binding
// ---------------------------------------------------------------------------

function _bindAll() {
  _bindMetadata();
  _bindQuestions();
  _bindActionBar();
  _bindPreviewPanel();

  // Restore flag warning if editing an existing worksheet
  if (_draft.topic) _updateFlagWarning();
}

function _bindMetadata() {
  const on = (id, ev, fn) => document.getElementById(id)?.addEventListener(ev, fn);

  on("f-title", "input", e => {
    _draft.title = e.target.value;
    _refreshPreview();
  });

  on("f-level", "change", e => {
    _draft.level = e.target.value;
    _repopulateStrands();
    _refreshPreview();
  });

  on("f-strand", "change", e => {
    _draft.strand = e.target.value;
    _repopulateTopics();
    _refreshPreview();
  });

  on("f-topic", "change", e => {
    _draft.topic = e.target.value;
    _updateFlagWarning();
    _refreshPreview();
  });

  on("f-difficulty", "change", e => {
    _draft.difficulty = e.target.value;
    _refreshPreview();
  });

  on("f-type", "change", e => {
    _draft.type = e.target.value;
    _refreshPreview();
  });

  on("f-notes", "input", e => { _draft.notes = e.target.value; });
}

function _bindQuestions() {
  const list = document.getElementById("question-list");
  if (!list) return;

  // Add blank question
  document.getElementById("btn-add-question")?.addEventListener("click", () => {
    _questions.push({ id: _newQId(), type: "short_answer", text: "", marks: 1, answer: "", working: "" });
    _rerenderQuestions();
  });

  // Pick from Question Bank
  document.getElementById("btn-pick-from-qb")?.addEventListener("click", () => {
    _showQBPickerModal();
  });

  // Delegate: delete, move, field edits, type change
  list.addEventListener("click", e => {
    const delBtn = e.target.closest(".btn-delete-q");
    if (delBtn) {
      const idx = parseInt(delBtn.dataset.idx);
      _saveUndo();
      _questions.splice(idx, 1);
      _rerenderQuestions();
      return;
    }
    const moveUp = e.target.closest(".btn-move-up");
    if (moveUp) {
      const idx = parseInt(moveUp.dataset.idx);
      if (idx > 0) {
        _saveUndo();
        [_questions[idx-1], _questions[idx]] = [_questions[idx], _questions[idx-1]];
        _rerenderQuestions();
      }
      return;
    }
    const moveDown = e.target.closest(".btn-move-down");
    if (moveDown) {
      const idx = parseInt(moveDown.dataset.idx);
      if (idx < _questions.length - 1) {
        _saveUndo();
        [_questions[idx], _questions[idx+1]] = [_questions[idx+1], _questions[idx]];
        _rerenderQuestions();
      }
      return;
    }
    const rmDiagram = e.target.closest(".q-btn-remove-diagram");
    if (rmDiagram) {
      const idx = parseInt(rmDiagram.dataset.idx);
      delete _questions[idx].diagramImage;
      _rerenderQuestions();
    }
  });

  list.addEventListener("change", e => {
    const idx = parseInt(e.target.dataset.idx);
    if (isNaN(idx)) return;

    if (e.target.classList.contains("q-type-select")) {
      _questions[idx].type = e.target.value;
      // Seed options array for MCQ
      if (e.target.value === "mcq" && !_questions[idx].options) {
        _questions[idx].options = ["","","",""];
      }
      _rerenderQuestions();
      return;
    }

    if (e.target.classList.contains("q-marks-input")) {
      _questions[idx].marks = Math.max(0, parseInt(e.target.value) || 0);
      _updateMarksTotal();
      _refreshPreview();
    }
  });

  list.addEventListener("input", e => {
    const idx = parseInt(e.target.dataset.idx);
    if (isNaN(idx)) return;

    if (e.target.classList.contains("q-text-input")) {
      _questions[idx].text = e.target.value;
      _refreshPreview();
    } else if (e.target.classList.contains("q-answer-input")) {
      _questions[idx].answer = e.target.value;
      _refreshPreview();
    } else if (e.target.classList.contains("q-working-input")) {
      _questions[idx].working = e.target.value;
      if (_teacherPreview) _refreshPreview();
    } else if (e.target.classList.contains("q-option-input")) {
      const opt = parseInt(e.target.dataset.opt);
      if (!_questions[idx].options) _questions[idx].options = ["","","",""];
      _questions[idx].options[opt] = e.target.value;
      _refreshPreview();
    }
  });

  // Drag-and-drop reordering
  list.addEventListener("dragstart", e => {
    const card = e.target.closest(".question-card");
    if (!card) return;
    _dragSrcIdx = parseInt(card.dataset.idx);
    card.style.opacity = "0.5";
  });

  list.addEventListener("dragend", e => {
    const card = e.target.closest(".question-card");
    if (card) card.style.opacity = "";
    _dragSrcIdx = null;
    list.querySelectorAll(".question-card").forEach(c => c.classList.remove("drag-over"));
  });

  list.addEventListener("dragover", e => {
    e.preventDefault();
    const card = e.target.closest(".question-card");
    if (!card) return;
    list.querySelectorAll(".question-card").forEach(c => c.classList.remove("drag-over"));
    card.classList.add("drag-over");
  });

  list.addEventListener("drop", e => {
    e.preventDefault();
    const card    = e.target.closest(".question-card");
    if (!card || _dragSrcIdx === null) return;
    const destIdx = parseInt(card.dataset.idx);
    const n = _questions.length;
    if (isNaN(destIdx) || destIdx < 0 || destIdx >= n) return;
    if (_dragSrcIdx < 0 || _dragSrcIdx >= n) return;
    if (destIdx === _dragSrcIdx) return;

    _saveUndo();
    const [moved] = _questions.splice(_dragSrcIdx, 1);
    _questions.splice(destIdx, 0, moved);
    _rerenderQuestions();
  });
}

function _bindActionBar() {
  document.getElementById("btn-cancel")?.addEventListener("click", () => {
    navigate("library");
  });

  document.getElementById("btn-undo")?.addEventListener("click", () => {
    if (!_undoSnapshot) return;
    _questions = _undoSnapshot;
    _undoSnapshot = null;
    _rerenderQuestions();
    const btn = document.getElementById("btn-undo");
    if (btn) btn.style.display = "none";
    showToast("Undone.", "success");
  });

  document.getElementById("btn-save")?.addEventListener("click", async () => {
    if (!_validate()) return;

    const ws = {
      ..._draft,
      questions: _questions.map(q => ({ ...q, id: q.id || _newQId() }))
    };

    try {
      await saveWorksheet(ws);
      showToast("Worksheet saved.", "success");
      navigate("library");
    } catch (e) {
      showToast("Save failed: " + e.message, "error");
    }
  });
}

function _bindPreviewPanel() {
  document.getElementById("btn-prev-student")?.addEventListener("click", () => {
    _teacherPreview = false;
    document.getElementById("btn-prev-student").classList.add("btn-primary");
    document.getElementById("btn-prev-teacher").classList.remove("btn-primary");
    _refreshPreview();
  });

  document.getElementById("btn-prev-teacher")?.addEventListener("click", () => {
    _teacherPreview = true;
    document.getElementById("btn-prev-teacher").classList.add("btn-primary");
    document.getElementById("btn-prev-student").classList.remove("btn-primary");
    _refreshPreview();
  });

  document.getElementById("btn-print")?.addEventListener("click", () => {
    if (!_validate()) return;
    openPrintWindow({ ..._draft, questions: _questions }, _teacherPreview);
  });
}

// ---------------------------------------------------------------------------
// Re-render helpers (partial DOM updates to preserve focus where possible)
// ---------------------------------------------------------------------------

function _rerenderQuestions() {
  const list = document.getElementById("question-list");
  if (list) list.innerHTML = _questions.map((q, i) => _htmlQuestionCard(q, i)).join("");
  _bindQuestions();   // rebind after innerHTML swap
  _updateMarksTotal();
  _refreshPreview();
}

function _updateMarksTotal() {
  const el = document.getElementById("marks-total");
  if (el) el.innerHTML = _marksLabel();
}

function _refreshPreview() {
  const el = document.getElementById("preview-body");
  if (el) el.innerHTML = _htmlPreviewContent();
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function _validate() {
  if (!_draft.title.trim()) {
    showToast("Please enter a worksheet title.", "error");
    document.getElementById("f-title")?.focus();
    return false;
  }

  if (isBlockedTopic(_draft.topic)) {
    showToast("Speed is not in the 2026 PSLE syllabus. Choose a different topic.", "error");
    return false;
  }

  if (_questions.length === 0) {
    showToast("Add at least one question before saving.", "error");
    return false;
  }

  for (let i = 0; i < _questions.length; i++) {
    if (!_questions[i].text.trim()) {
      showToast(`Q${i+1} has no question text.`, "error");
      return false;
    }
  }

  return true;
}

// ---------------------------------------------------------------------------
// Question Bank picker modal
// ---------------------------------------------------------------------------

async function _showQBPickerModal() {
  document.getElementById("builder-qb-modal")?.remove();

  // Fetch all questions from active source papers
  const allQ = [];
  for (const ws of (await getAllWorksheets()).filter(w => w.origin === "imported" && w.status !== "archived")) {
    for (const q of (ws.questions || [])) {
      if (!q.id || !q.text) continue;
      allQ.push({
        ...q,
        _key:     ws.id + "::" + q.id,
        _wsTitle: ws.title,
        _wsLevel: ws.level,
        _wsTopic: q.topic || ws.topic
      });
    }
  }

  const stu      = getActiveStudent();
  const takenSet = stu ? new Set(stu.takenQuestions || []) : new Set();
  const pickedKeys = new Set();

  const levels = ["P1","P2","P3","P4","P5","P6"];
  let levelFilter = "";
  let searchText  = "";

  function _filtered() {
    return allQ.filter(q => {
      if (levelFilter && q._wsLevel !== levelFilter) return false;
      if (searchText  && !q.text.toLowerCase().includes(searchText.toLowerCase())) return false;
      return true;
    });
  }

  function _renderList() {
    const items = _filtered();
    const listEl = document.getElementById("builder-qb-list");
    const addBtn = document.getElementById("builder-qb-add");
    if (!listEl) return;

    if (items.length === 0) {
      listEl.innerHTML = `<div style="padding:24px;text-align:center;color:var(--grey-400)">No questions match.</div>`;
    } else {
      listEl.innerHTML = items.map(q => {
        const isTaken   = takenSet.has(q._key);
        const isPicked  = pickedKeys.has(q._key);
        const shortText = q.text.length > 160 ? q.text.slice(0, 160) + "…" : q.text;
        return `
          <label class="builder-qb-item ${isPicked ? "builder-qb-item--selected" : ""}">
            <input type="checkbox" class="builder-qb-check" data-key="${_esc(q._key)}" ${isPicked ? "checked" : ""} />
            <div class="builder-qb-item__content">
              <div class="builder-qb-item__meta">
                ${q._wsLevel ? `<span class="badge badge-level" style="font-size:10px">${_esc(q._wsLevel)}</span>` : ""}
                ${q._wsTopic ? `<strong>${_esc(q._wsTopic)}</strong>` : ""}
                <span style="color:var(--grey-400)">&mdash; ${_esc(q._wsTitle||"")}</span>
                ${isTaken ? `<span class="badge badge-taken" style="font-size:10px">Taken</span>` : ""}
              </div>
              <div class="builder-qb-item__text">${_esc(shortText)}</div>
              ${q.diagramImage
                ? `<img src="${q.diagramImage}" style="max-height:60px;max-width:100%;margin-top:4px;border:1px solid #ccc;border-radius:2px" alt="Diagram" />`
                : ""}
            </div>
          </label>`;
      }).join("");
    }

    // Bind checkboxes
    listEl.querySelectorAll(".builder-qb-check").forEach(cb => {
      cb.addEventListener("change", e => {
        const key = e.target.dataset.key;
        if (e.target.checked) pickedKeys.add(key);
        else pickedKeys.delete(key);
        _renderList();
      });
    });

    if (addBtn) {
      addBtn.textContent = pickedKeys.size > 0
        ? `Add ${pickedKeys.size} Question${pickedKeys.size !== 1 ? "s" : ""}`
        : "Add Selected";
      addBtn.disabled = pickedKeys.size === 0;
    }
  }

  const modal = document.createElement("div");
  modal.id        = "builder-qb-modal";
  modal.className = "qb-modal-overlay";
  modal.innerHTML = `
    <div class="qb-modal" role="dialog" aria-modal="true"
         style="max-width:680px;width:95vw;max-height:82vh;display:flex;flex-direction:column">
      <div class="qb-modal__header">
        <div style="font-weight:700;font-size:15px">&#10067; Pick from Question Bank</div>
        <button class="qb-modal__close" id="builder-qb-close" aria-label="Close">&times;</button>
      </div>
      <div style="padding:10px 16px;border-bottom:1px solid var(--border);display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
        <div class="filter-group" style="min-width:90px">
          <label>Level</label>
          <select id="builder-qb-level">
            <option value="">All</option>
            ${levels.map(l => `<option value="${l}">${l}</option>`).join("")}
          </select>
        </div>
        <div class="filter-group" style="flex:1;min-width:180px">
          <label>Search</label>
          <input type="text" id="builder-qb-search" placeholder="Type to search question text…"
                 style="padding:5px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;width:100%" />
        </div>
      </div>
      <div id="builder-qb-list"
           style="overflow-y:auto;flex:1;padding:8px 16px;display:flex;flex-direction:column;gap:6px"></div>
      <div class="qb-modal__footer">
        <button class="btn btn-primary" id="builder-qb-add" disabled>Add Selected</button>
        <button class="btn" id="builder-qb-cancel">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => modal.remove();
  document.getElementById("builder-qb-close")?.addEventListener("click",  close);
  document.getElementById("builder-qb-cancel")?.addEventListener("click", close);
  modal.addEventListener("click",   e => { if (e.target === modal) close(); });
  modal.addEventListener("keydown", e => { if (e.key === "Escape") close(); });

  document.getElementById("builder-qb-level")?.addEventListener("change", e => {
    levelFilter = e.target.value;
    _renderList();
  });
  document.getElementById("builder-qb-search")?.addEventListener("input", e => {
    searchText = e.target.value;
    _renderList();
  });

  document.getElementById("builder-qb-add")?.addEventListener("click", () => {
    const toAdd = allQ.filter(q => pickedKeys.has(q._key));
    toAdd.forEach(q => {
      const newQ = {
        id:        _newQId(),
        type:      q.type,
        text:      q.text,
        marks:     q.marks,
        answer:    q.answer  || "",
        working:   q.working || "",
        sourceKey: q._key          // track which source paper question this came from
      };
      if (q.type === "mcq" && q.options) newQ.options = [...q.options];
      if (q.diagramImage) newQ.diagramImage = q.diagramImage;
      _questions.push(newQ);
    });
    close();
    _rerenderQuestions();
    showToast(`Added ${toAdd.length} question${toAdd.length !== 1 ? "s" : ""}.`, "success");
  });

  _renderList();
  document.getElementById("builder-qb-search")?.focus();
}

// Add drag-over visual to CSS dynamically (one-time)
(function _injectDragStyle() {
  if (document.getElementById("builder-drag-style")) return;
  const s = document.createElement("style");
  s.id = "builder-drag-style";
  s.textContent = `.question-card.drag-over { outline: 2px dashed var(--blue); background: var(--blue-light); }
  .drag-handle { cursor:grab; font-size:16px; color:var(--grey-400); padding:0 4px; user-select:none; }`;
  document.head.appendChild(s);
})();
