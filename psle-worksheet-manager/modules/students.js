// modules/students.js
// Student management view — add/select/delete students, view score history.
// Entry point: renderStudents(container)
// Global: renderActiveStudentIndicator()

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function renderStudents(container) {
  container.innerHTML = `
    <div class="student-panel-wrap">
      <div class="student-panel" id="student-left-panel">
        ${_htmlStudentLeftPanel()}
      </div>
      <div class="student-detail" id="student-detail-panel">
        ${_htmlStudentDetail()}
      </div>
    </div>
  `;
  _bindStudentLeftPanel();
  _bindStudentDetail();
}

// ---------------------------------------------------------------------------
// Left panel HTML — dropdown + add form
// ---------------------------------------------------------------------------

function _htmlStudentLeftPanel() {
  const students = getAllStudents();
  const activeId = getActiveStudentId();

  return `
    <div class="builder-section__title">Students</div>
    <div class="form-group" style="margin-bottom:12px">
      <label>Select Student</label>
      <select id="stu-select">
        <option value="">— none —</option>
        ${students.map(s =>
          `<option value="${_escStu(s.id)}" ${activeId === s.id ? "selected" : ""}>${_escStu(s.name)}</option>`
        ).join("")}
      </select>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:20px">
      <button class="btn btn-primary" id="btn-stu-set-active">Set Active</button>
      <button class="btn" id="btn-stu-logout">Logout</button>
    </div>
    <hr style="margin-bottom:16px;border:none;border-top:1px solid var(--grey-200)" />
    <div class="builder-section__title" style="margin-bottom:8px">Add New Student</div>
    <div class="form-group" style="margin-bottom:8px">
      <label>Name</label>
      <input type="text" id="stu-new-name" placeholder="e.g. Alice Tan" maxlength="80" />
    </div>
    <button class="btn btn-primary" id="btn-stu-add">Add Student</button>
  `;
}

// ---------------------------------------------------------------------------
// Right panel HTML — detail / stats / score history
// ---------------------------------------------------------------------------

function _htmlStudentDetail() {
  const stu = getActiveStudent();
  if (!stu) {
    return `
      <div class="empty-state">
        <div class="empty-state__icon">&#128100;</div>
        <div class="empty-state__text">Set a student as active to see their details.</div>
      </div>`;
  }

  const takenCount  = (stu.takenQuestions || []).length;
  const scoresCount = (stu.scores || []).length;
  const allScores   = (stu.scores || []).slice().sort((a, b) => b.date.localeCompare(a.date));

  const scoresHtml = allScores.length === 0
    ? `<p style="color:var(--grey-400);font-size:12px">No scores recorded yet.</p>`
    : `<table class="student-scores-table">
        <thead><tr><th>Worksheet</th><th>Score</th><th>Date</th></tr></thead>
        <tbody>
          ${allScores.map(sc => {
            const ws      = getWorksheet(sc.wsId);
            const wsTitle = ws
              ? _escStu(ws.title || "Untitled")
              : `<em style="color:var(--grey-400)">${_escStu(sc.wsId)}</em>`;
            return `<tr>
              <td>${wsTitle}</td>
              <td>${sc.score} / ${sc.total}</td>
              <td>${_escStu(sc.date)}</td>
            </tr>`;
          }).join("")}
        </tbody>
       </table>`;

  return `
    <div class="builder-section__title">${_escStu(stu.name)}</div>
    <div class="stats-bar" style="margin-bottom:16px">
      <div class="stat-card">
        <div class="stat-card__value">${takenCount}</div>
        <div class="stat-card__label">Questions Taken</div>
      </div>
      <div class="stat-card">
        <div class="stat-card__value">${scoresCount}</div>
        <div class="stat-card__label">Scores Recorded</div>
      </div>
    </div>
    <div style="margin-bottom:16px">
      <div class="builder-section__title" style="margin-bottom:8px">Score History</div>
      ${scoresHtml}
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-danger" id="btn-stu-clear-taken">Clear Taken History</button>
      <button class="btn btn-danger" id="btn-stu-delete">Delete Student</button>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Event binding — left panel
// ---------------------------------------------------------------------------

function _bindStudentLeftPanel() {
  document.getElementById("btn-stu-set-active")?.addEventListener("click", () => {
    const id = document.getElementById("stu-select")?.value || "";
    if (!id) { showToast("Select a student first.", "error"); return; }
    setActiveStudentId(id);
    renderActiveStudentIndicator();
    _refreshStudentDetail();
    showToast("Student set as active.", "success");
  });

  document.getElementById("btn-stu-logout")?.addEventListener("click", () => {
    setActiveStudentId(null);
    renderActiveStudentIndicator();
    _refreshStudentDetail();
    showToast("Logged out.");
  });

  document.getElementById("btn-stu-add")?.addEventListener("click", () => {
    const nameInput = document.getElementById("stu-new-name");
    const name = nameInput?.value.trim();
    if (!name) { showToast("Enter a student name.", "error"); return; }

    const existing = getAllStudents();
    if (existing.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      showToast("A student with that name already exists.", "error");
      return;
    }

    saveStudent({ name, takenQuestions: [], scores: [] });
    if (nameInput) nameInput.value = "";
    _refreshStudentLeftPanel();
    showToast(`Student "${name}" added.`, "success");
  });
}

// ---------------------------------------------------------------------------
// Event binding — detail panel
// ---------------------------------------------------------------------------

function _bindStudentDetail() {
  document.getElementById("btn-stu-clear-taken")?.addEventListener("click", () => {
    const stu = getActiveStudent();
    if (!stu) return;
    if (!confirm(`Clear all taken question history for ${stu.name}?`)) return;
    stu.takenQuestions = [];
    saveStudent(stu);
    _refreshStudentDetail();
    showToast("Taken history cleared.");
  });

  document.getElementById("btn-stu-delete")?.addEventListener("click", () => {
    const stu = getActiveStudent();
    if (!stu) return;
    if (!confirm(`Delete student "${stu.name}"? This cannot be undone.`)) return;
    const name     = stu.name;
    const wasActive = getActiveStudentId() === stu.id;
    deleteStudent(stu.id);
    if (wasActive) {
      setActiveStudentId(null);
      renderActiveStudentIndicator();
    }
    _refreshStudentLeftPanel();
    _refreshStudentDetail();
    showToast(`Student "${name}" deleted.`);
  });
}

// ---------------------------------------------------------------------------
// Refresh helpers
// ---------------------------------------------------------------------------

function _refreshStudentLeftPanel() {
  const panel = document.getElementById("student-left-panel");
  if (!panel) return;
  panel.innerHTML = _htmlStudentLeftPanel();
  _bindStudentLeftPanel();
}

function _refreshStudentDetail() {
  const panel = document.getElementById("student-detail-panel");
  if (!panel) return;
  panel.innerHTML = _htmlStudentDetail();
  _bindStudentDetail();
}

// ---------------------------------------------------------------------------
// Active-student header indicator
// ---------------------------------------------------------------------------

function renderActiveStudentIndicator() {
  const container = document.getElementById("active-student-indicator");
  if (!container) return;
  const stu = getActiveStudent();
  if (stu) {
    container.innerHTML = `<div class="active-student-pill">&#128100; ${_escStu(stu.name)}</div>`;
  } else {
    container.innerHTML = `<div class="active-student-pill active-student-pill--none">&#128100; No student</div>`;
  }
}

// ---------------------------------------------------------------------------
// Escape helper
// ---------------------------------------------------------------------------

function _escStu(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
