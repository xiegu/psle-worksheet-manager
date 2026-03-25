// modules/preview.js
// Full-page in-app worksheet preview with student/teacher toggle and print.
// Entry point: renderPreview(container, worksheetId)
//
// Also exposes window.generateWorksheetHTML(ws, teacherMode) as a shared
// utility — builder.js and library.js can call this instead of their own
// private print-HTML generators if refactored in future.

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let _pvTeacher = false;   // current preview mode
let _pvWs      = null;    // worksheet being previewed

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function renderPreview(container, worksheetId) {
  _pvTeacher = false;
  _pvWs = worksheetId ? await getWorksheet(worksheetId) : null;

  if (!_pvWs) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__icon">&#10067;</div>
        <div class="empty-state__text">Worksheet not found.</div>
        <button class="btn btn-primary" onclick="navigate('library')">Back to Library</button>
      </div>`;
    return;
  }

  _injectPreviewStyles();

  container.innerHTML = `
    <div class="pv-toolbar">
      <button class="btn" id="pv-btn-back">&#8592; Library</button>
      <button class="btn" id="pv-btn-edit">Edit</button>
      <div class="pv-toolbar__spacer"></div>
      <div class="pv-mode-toggle">
        <button class="btn btn-sm pv-mode-btn btn-primary" id="pv-btn-student">Student</button>
        <button class="btn btn-sm pv-mode-btn"             id="pv-btn-teacher">Teacher</button>
      </div>
      <button class="btn btn-primary" id="pv-btn-print">Print</button>
    </div>

    <div class="pv-stage">
      <div class="pv-page" id="pv-page">
        ${_renderPage(_pvWs, false)}
      </div>
    </div>
  `;

  _bindPreview();
}

// ---------------------------------------------------------------------------
// Page renderer — produces the A4-styled worksheet HTML (in-app)
// ---------------------------------------------------------------------------

function _renderPage(ws, teacherMode) {
  const totalMarks = (ws.questions||[]).reduce((s,q) => s+(parseInt(q.marks)||0), 0);

  const questionsHtml = (ws.questions||[]).length === 0
    ? `<p class="pv-no-questions">No questions added yet.</p>`
    : (ws.questions||[]).map((q, i) => _renderQuestion(q, i, teacherMode)).join("");

  return `
    ${teacherMode ? `<div class="pv-watermark">ANSWER KEY</div>` : ""}

    <div class="pv-ws-header">
      <div class="pv-logo"><img src="logo.png" alt="Logo" /></div>
      <div class="pv-title-block">
        <h1 class="pv-ws-title">${_esc((ws.subject||"Maths")+" Worksheet")}</h1>
        <div class="pv-ws-meta">
          ${ws.level      ? `<span>Level: <span class="ws-badge ws-badge--level">${_esc(ws.level)}</span></span>` : ""}
          <span>Topic: ${_esc(ws.topic||"—")}</span>
          ${ws.difficulty ? `<span>Difficulty: ${_esc(ws.difficulty)}</span>` : ""}
          ${ws.type       ? `<span>Type: ${_esc(ws.type)}</span>` : ""}
        </div>
      </div>
    </div>

    <div class="pv-info-row">
      <div class="pv-info-cell"><span class="pv-field-label">Name</span><div class="pv-blank"></div></div>
      <div class="pv-info-cell"><span class="pv-field-label">Class</span><div class="pv-blank"></div></div>
      <div class="pv-info-cell"><span class="pv-field-label">Date</span><div class="pv-blank"></div></div>
      <div class="pv-info-cell"><span class="pv-field-label">Score</span><div class="pv-blank"></div></div>
    </div>

    <div class="pv-instructions">
      Answer all questions. Show your working clearly. Marks are awarded for correct working.
    </div>

    ${questionsHtml}

    <div class="pv-footer">
      <span class="pv-footer__label">${_esc(ws.title)}</span>
      <div class="pv-marks-box">Total: &nbsp;&nbsp;&nbsp; / ${totalMarks} marks</div>
    </div>

    ${teacherMode ? _renderAnswerKey(ws) : ""}
  `;
}

function _renderQuestion(q, i, teacherMode) {
  let body = "";

  if (q.type === "mcq") {
    const opts = q.options || [];
    body = `<div class="pv-mcq-options">
      ${opts.map((o, oi) => `
        <div class="pv-mcq-option">
          <div class="pv-mcq-circle"></div>
          (${String.fromCharCode(65 + oi)}) &nbsp; ${_esc(_stripOptionPrefix(o))}
        </div>`).join("")}
    </div>`;
  } else {
    const lineCount = q.type === "long_answer" ? 6 : 3;
    body = `
      <div class="pv-working-space">
        ${Array(lineCount).fill('<div class="pv-working-line"></div>').join("")}
      </div>
      <div class="pv-answer-box">
        <span class="pv-ans-label">Answer:</span>
        <div class="pv-ans-blank"></div>
      </div>`;
  }

  const answerRow  = teacherMode && q.answer
    ? `<div class="pv-answer-reveal">Ans: ${_esc(q.answer)}</div>` : "";
  const workingRow = teacherMode && q.working
    ? `<div class="pv-working-reveal">${_esc(q.working)}</div>` : "";

  const diagramHtml = q.diagramImage
    ? `<img class="pv-diagram-img" src="${q.diagramImage}" alt="Diagram for Q${i + 1}" />`
    : "";

  return `
    <div class="pv-question">
      <div class="pv-q-stem">
        <span class="pv-q-num">Q${i + 1}.</span>
        <span class="pv-q-text">${_esc(q.text || "(no question text)")}</span>
        <span class="pv-q-marks">[${q.marks || 1}m]</span>
      </div>
      ${diagramHtml}
      ${body}
      ${answerRow}
      ${workingRow}
    </div>`;
}

function _renderAnswerKey(ws) {
  const rows = (ws.questions||[]).map((q, i) => `
    <tr>
      <td>Q${i + 1}</td>
      <td>${_esc(q.answer || "—")}</td>
      <td class="pv-ak-working">${_esc(q.working || "")}</td>
      <td>${q.marks || 1}</td>
    </tr>`).join("");

  return `
    <div class="pv-answer-key">
      <h2 class="pv-answer-key__title">Answer Key</h2>
      <table class="pv-ak-table">
        <thead>
          <tr><th>Q</th><th>Answer</th><th>Working</th><th>Marks</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ---------------------------------------------------------------------------
// Event binding
// ---------------------------------------------------------------------------

function _bindPreview() {
  document.getElementById("pv-btn-back")?.addEventListener("click", () => navigate("library"));
  document.getElementById("pv-btn-edit")?.addEventListener("click", () =>
    navigate("builder", { editingId: _pvWs.id })
  );

  document.getElementById("pv-btn-student")?.addEventListener("click", () => {
    _pvTeacher = false;
    document.getElementById("pv-btn-student").classList.add("btn-primary");
    document.getElementById("pv-btn-teacher").classList.remove("btn-primary");
    document.getElementById("pv-page").innerHTML = _renderPage(_pvWs, false);
  });

  document.getElementById("pv-btn-teacher")?.addEventListener("click", () => {
    _pvTeacher = true;
    document.getElementById("pv-btn-teacher").classList.add("btn-primary");
    document.getElementById("pv-btn-student").classList.remove("btn-primary");
    document.getElementById("pv-page").innerHTML = _renderPage(_pvWs, true);
  });

  document.getElementById("pv-btn-print")?.addEventListener("click", () => {
    openPrintWindow(_pvWs, _pvTeacher);
  });
}

// ---------------------------------------------------------------------------
// Shared print-window utility (globally available)
// ---------------------------------------------------------------------------

/**
 * Generates a self-contained A4 HTML document string for a worksheet.
 * Shared by preview.js, and available globally for builder/library to adopt.
 * @param {object}  ws           - Worksheet object from storage
 * @param {boolean} teacherMode  - true = show answers + answer key
 * @returns {string} Full HTML document
 */
function generateWorksheetHTML(ws, teacherMode) {
  const totalMarks = (ws.questions||[]).reduce((s,q) => s+(parseInt(q.marks)||0), 0);

  const questionsHtml = (ws.questions||[]).map((q, i) => {
    let body = "";
    if (q.type === "mcq") {
      body = `<div class="mcq-options">
        ${(q.options||[]).map((o,oi) => `
          <div class="mcq-option">
            <div class="mcq-circle"></div>
            (${String.fromCharCode(65+oi)}) &nbsp; ${_esc(_stripOptionPrefix(o))}
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
    const ansRow  = teacherMode && q.answer  ? `<div class="answer-key-inline">Ans: ${_esc(q.answer)}</div>`   : "";
    const wrkRow  = teacherMode && q.working ? `<div class="working-key-inline">${_esc(q.working)}</div>`       : "";

    const diagramHtml = q.diagramImage
      ? `<img class="diagram-img" src="${q.diagramImage}" alt="Diagram for Q${i+1}" />`
      : "";

    return `
      <div class="question">
        <div class="question-stem">
          <span class="q-number">Q${i+1}.</span>
          <span class="q-text">${_esc(q.text)}</span>
          <span class="q-marks">[${q.marks||1}m]</span>
        </div>
        ${diagramHtml}${body}${ansRow}${wrkRow}
      </div>`;
  }).join("");

  const answerKeyHtml = teacherMode ? (() => {
    const rows = (ws.questions||[]).map((q,i) => `
      <tr>
        <td>Q${i+1}</td>
        <td>${_esc(q.answer||"—")}</td>
        <td class="wt">${_esc(q.working||"")}</td>
        <td>${q.marks||1}</td>
      </tr>`).join("");
    return `
      <div style="margin-top:24px;border-top:2px dashed #c0392b;padding-top:12px">
        <h2 style="font-size:13pt;color:#c0392b;text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px">Answer Key</h2>
        <table style="width:100%;border-collapse:collapse;font-size:11pt">
          <thead><tr style="background:#f2dede">
            <th style="border:1px solid #ccc;padding:5px 10px">Q</th>
            <th style="border:1px solid #ccc;padding:5px 10px">Answer</th>
            <th style="border:1px solid #ccc;padding:5px 10px">Working</th>
            <th style="border:1px solid #ccc;padding:5px 10px">Marks</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  })() : "";

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"/>
<title>${_esc(ws.title)}</title>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{font-family:"Times New Roman",Times,serif;font-size:13pt;color:#000;background:#e8e8e8;padding:24px}
  .page{width:210mm;min-height:297mm;background:#fff;margin:0 auto;padding:15mm;position:relative;box-shadow:0 2px 12px rgba(0,0,0,.18)}
  .ws-header{display:flex;align-items:center;gap:14px;border-bottom:2.5px solid #000;padding-bottom:8px;margin-bottom:10px}
  .ws-logo{width:100px;height:100px;border-radius:4px;flex-shrink:0;overflow:hidden;display:flex;align-items:center;justify-content:center}
  .ws-logo img{width:100%;height:100%;object-fit:contain}
  .ws-logo__placeholder{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:22pt;font-weight:800;color:#1a56a0;letter-spacing:.05em;background:#e8f0fb;border-radius:4px}
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
  .ws-info-row .info-cell{flex:1;padding:10px 8px;border-right:1px solid #000;font-size:11pt}
  .ws-info-row .info-cell:last-child{border-right:none}
  .ws-info-row .info-cell span{display:block;font-size:8.5pt;color:#555;margin-bottom:2px}
  .ws-info-row .info-cell .blank-line{border-bottom:1px solid #555;display:block;width:100%;height:26px}
  .ws-instructions{font-size:10pt;font-style:italic;margin-bottom:12px;padding:5px 8px;background:#f7f7f7;border-left:3px solid #1a56a0}
  .question{margin-bottom:18px;page-break-inside:avoid}
  .question-stem{display:flex;gap:8px;align-items:baseline;margin-bottom:6px}
  .q-number{font-weight:bold;min-width:28px;flex-shrink:0}
  .q-marks{font-size:9pt;color:#555;white-space:nowrap;flex-shrink:0}
  .q-text{flex:1;line-height:1.5;overflow-wrap:break-word;word-break:break-word}
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
  .diagram-img{display:block;max-width:90%;max-height:110mm;margin:6px 0 8px 36px;border:1px solid #ccc;border-radius:2px}
  .wt{font-size:9.5pt;color:#555;font-style:italic;overflow-wrap:break-word}
  td,th{border:1px solid #ccc;padding:5px 10px;text-align:left}
  .ws-footer{border-top:2px solid #000;margin-top:20px;padding-top:8px;display:flex;justify-content:space-between;align-items:center;font-size:11pt}
  .marks-box{border:1.5px solid #000;padding:4px 14px;font-size:12pt;font-weight:bold}
  @media print{
    body{background:none;padding:0;orphans:2;widows:2}
    .page{width:210mm;min-height:297mm;margin:0;padding:15mm;box-shadow:none;page-break-after:always}
    .question{page-break-inside:avoid;break-inside:avoid}
    .diagram-img{max-height:80mm}
    .badge{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .ws-logo__placeholder{display:none}
    @page{size:A4 portrait;margin:0}
  }
</style>
</head><body>
<div class="page">
  <div class="teacher-watermark">ANSWER KEY</div>
  <div class="ws-header">
    <div class="ws-logo">${window.LOGO_DATA_URL ? `<img src="${window.LOGO_DATA_URL}" alt="Logo" />` : `<div class="ws-logo__placeholder">WM</div>`}</div>
    <div class="ws-title-block">
      <h1>${_esc((ws.subject||"Maths")+" Worksheet")}</h1>
      <div class="ws-meta">
        ${ws.level ? `<span>Level: <span class="badge badge-level">${_esc(ws.level)}</span></span>` : ""}
        <span>Topic: ${_esc(ws.topic||"—")}</span>
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
  ${answerKeyHtml}
</div>
<script>window.onload=function(){window.print();}<\/script>
</body></html>`;
}

/**
 * Opens a print window for a worksheet.
 * Globally available — can be called from any module.
 * @param {object}  ws
 * @param {boolean} teacherMode
 */
function openPrintWindow(ws, teacherMode) {
  const win = window.open("", "_blank");
  if (!win) {
    showToast("Pop-up blocked — please allow pop-ups for this page.", "error");
    return;
  }
  win.document.write(generateWorksheetHTML(ws, teacherMode));
  win.document.close();
}

// Expose globally
window.generateWorksheetHTML = generateWorksheetHTML;
window.openPrintWindow       = openPrintWindow;

// ---------------------------------------------------------------------------
// In-app preview styles (injected once)
// ---------------------------------------------------------------------------

function _injectPreviewStyles() {
  if (document.getElementById("pv-styles")) return;
  const s = document.createElement("style");
  s.id = "pv-styles";
  s.textContent = `
    /* Preview toolbar */
    .pv-toolbar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 0 16px;
      flex-wrap: wrap;
    }
    .pv-toolbar__spacer { flex: 1; }
    .pv-mode-toggle { display: flex; gap: 0; border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
    .pv-mode-toggle .btn { border-radius: 0; border: none; border-right: 1px solid var(--border); }
    .pv-mode-toggle .btn:last-child { border-right: none; }

    /* A4 stage */
    .pv-stage {
      background: #c8c8c8;
      padding: 24px 0 40px;
      min-height: 400px;
      border-radius: var(--radius);
    }

    /* A4 page */
    .pv-page {
      width: 210mm;
      min-height: 297mm;
      background: #fff;
      margin: 0 auto;
      padding: 15mm;
      position: relative;
      box-shadow: 0 4px 20px rgba(0,0,0,0.25);
      font-family: "Times New Roman", Times, serif;
      font-size: 13pt;
      color: #000;
      box-sizing: border-box;
    }

    /* Watermark */
    .pv-watermark {
      position: absolute;
      top: 18mm;
      right: 15mm;
      font-size: 11pt;
      font-weight: bold;
      color: #c0392b;
      letter-spacing: .08em;
      border: 2px solid #c0392b;
      padding: 2px 8px;
      transform: rotate(-15deg);
      opacity: .7;
      pointer-events: none;
    }

    /* Header */
    .pv-ws-header {
      display: flex;
      align-items: center;
      gap: 14px;
      border-bottom: 2.5px solid #000;
      padding-bottom: 8px;
      margin-bottom: 10px;
    }
    .pv-logo {
      width: 100px; height: 100px;
      border-radius: 4px;
      flex-shrink: 0;
      overflow: hidden;
      display: flex; align-items: center; justify-content: center;
    }
    .pv-logo img { width: 100%; height: 100%; object-fit: contain; }
    .pv-title-block { flex: 1; }
    .pv-ws-title {
      font-size: 16pt;
      font-weight: bold;
      letter-spacing: .04em;
      text-transform: uppercase;
    }
    .pv-ws-meta {
      font-size: 10pt;
      color: #333;
      margin-top: 3px;
      display: flex;
      gap: 18px;
      flex-wrap: wrap;
    }

    /* Badges inside the page */
    .ws-badge {
      display: inline-block;
      padding: 1px 7px;
      border-radius: 3px;
      font-size: 8.5pt;
      font-weight: bold;
      vertical-align: middle;
      margin-left: 4px;
    }
    .ws-badge--level      { background: #1a56a0; color: #fff; }
    .ws-badge--new        { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
    .ws-badge--moved-up   { background: #cce5ff; color: #004085; border: 1px solid #b8daff; }
    .ws-badge--moved-down { background: #fff3cd; color: #856404; border: 1px solid #ffeeba; }

    /* Info row */
    .pv-info-row {
      display: flex;
      border: 1.5px solid #000;
      margin-bottom: 14px;
    }
    .pv-info-cell {
      flex: 1;
      padding: 10px 8px;
      border-right: 1px solid #000;
      font-size: 11pt;
    }
    .pv-info-cell:last-child { border-right: none; }
    .pv-field-label {
      display: block;
      font-size: 8.5pt;
      color: #555;
      margin-bottom: 2px;
      font-family: Arial, sans-serif;
    }
    .pv-blank {
      border-bottom: 1px solid #555;
      display: block;
      width: 100%;
      height: 26px;
    }

    /* Instructions */
    .pv-instructions {
      font-size: 10pt;
      font-style: italic;
      margin-bottom: 12px;
      padding: 5px 8px;
      background: #f7f7f7;
      border-left: 3px solid #1a56a0;
    }

    /* Questions */
    .pv-question       { margin-bottom: 18px; }
    .pv-q-stem         { display: flex; gap: 8px; align-items: baseline; margin-bottom: 6px; }
    .pv-q-num          { font-weight: bold; min-width: 28px; flex-shrink: 0; }
    .pv-q-marks        { font-size: 9pt; color: #555; white-space: nowrap; flex-shrink: 0; }
    .pv-q-text         { flex: 1; line-height: 1.5; }
    .pv-working-space  { margin-left: 36px; margin-top: 4px; }
    .pv-working-line   { border-bottom: 1px dotted #bbb; height: 22px; width: 100%; }
    .pv-answer-box     { margin-left: 36px; margin-top: 6px; display: flex; align-items: center; gap: 10px; }
    .pv-ans-label      { font-size: 10pt; font-weight: bold; white-space: nowrap; }
    .pv-ans-blank      { border-bottom: 1.5px solid #000; flex: 1; max-width: 160px; height: 20px; }
    .pv-mcq-options    { margin-left: 36px; margin-top: 6px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; font-size: 11pt; }
    .pv-mcq-option     { display: flex; align-items: baseline; gap: 6px; }
    .pv-mcq-circle     { width: 14px; height: 14px; border: 1.5px solid #000; border-radius: 50%; display: inline-block; flex-shrink: 0; }
    .pv-answer-reveal  { margin-left: 36px; margin-top: 4px; font-size: 10pt; color: #1a7a3c; font-weight: 600; }
    .pv-working-reveal { margin-left: 36px; font-size: 9.5pt; color: #555; font-style: italic; }
    .pv-no-questions   { color: #aaa; font-style: italic; font-size: 11pt; }
    .pv-diagram-img    { display: block; max-width: 100%; max-height: 110mm; margin: 6px 0 8px 36px; border: 1px solid #ccc; border-radius: 2px; }

    /* Footer */
    .pv-footer {
      border-top: 2px solid #000;
      margin-top: 20px;
      padding-top: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11pt;
    }
    .pv-marks-box {
      border: 1.5px solid #000;
      padding: 4px 14px;
      font-size: 12pt;
      font-weight: bold;
    }

    /* Answer key */
    .pv-answer-key         { margin-top: 24px; border-top: 2px dashed #c0392b; padding-top: 12px; }
    .pv-answer-key__title  { font-size: 13pt; color: #c0392b; text-transform: uppercase; letter-spacing: .08em; margin-bottom: 10px; }
    .pv-ak-table           { width: 100%; border-collapse: collapse; font-size: 11pt; }
    .pv-ak-table th,
    .pv-ak-table td        { border: 1px solid #ccc; padding: 5px 10px; text-align: left; }
    .pv-ak-table th        { background: #f2dede; font-weight: bold; }
    .pv-ak-working         { font-size: 9.5pt; color: #555; font-style: italic; }

    /* Responsive: shrink page on small screens */
    @media (max-width: 850px) {
      .pv-page { width: 100%; min-height: unset; padding: 10mm; font-size: 11pt; }
    }

    @media print {
      .pv-toolbar { display: none !important; }
      .pv-stage   { background: none; padding: 0; }
      .pv-page    { box-shadow: none; margin: 0; padding: 15mm; page-break-after: always; }
    }
  `;
  document.head.appendChild(s);
}

