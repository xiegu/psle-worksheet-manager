// modules/syllabus-view.js
// Static PSLE 2026 syllabus reference page.
// Sourced entirely from SYLLABUS and TOPIC_FLAGS in data/syllabus.js.
// Entry point: renderSyllabusView(container)

let _syllabusActiveLevel = "P6";  // default to P6 (most exam-relevant)

function renderSyllabusView(container) {
  container.innerHTML = `
    <div class="syl-wrap">

      ${_htmlChangesGlance()}

      <div class="syl-section">
        <div class="syl-section__title">Topics by Level</div>
        <div class="syl-level-tabs">
          ${["P1","P2","P3","P4","P5","P6"].map(lvl => `
            <button class="syl-level-tab ${_syllabusActiveLevel === lvl ? "active" : ""}"
                    data-level="${lvl}">${lvl}</button>
          `).join("")}
        </div>
        <div id="syl-level-content">
          ${_htmlLevelContent(_syllabusActiveLevel)}
        </div>
      </div>

    </div>
  `;

  container.querySelector(".syl-level-tabs").addEventListener("click", e => {
    const btn = e.target.closest(".syl-level-tab[data-level]");
    if (!btn) return;
    _syllabusActiveLevel = btn.dataset.level;
    container.querySelectorAll(".syl-level-tab").forEach(b =>
      b.classList.toggle("active", b.dataset.level === _syllabusActiveLevel)
    );
    document.getElementById("syl-level-content").innerHTML =
      _htmlLevelContent(_syllabusActiveLevel);
  });
}

// ---------------------------------------------------------------------------
// 2026 Changes at a Glance
// ---------------------------------------------------------------------------

function _htmlChangesGlance() {
  const newTopics   = [];
  const movedUp     = [];
  const movedDown   = [];

  for (const [topic, info] of Object.entries(TOPIC_FLAGS)) {
    if (info.flag === "new")        newTopics.push(topic);
    else if (info.flag === "moved_up")   movedUp.push(topic);
    else if (info.flag === "moved_down") movedDown.push(topic);
  }

  const col = (items, cls, heading) => `
    <div class="syl-change-col">
      <div class="syl-change-col__heading">
        <span class="badge ${cls}">${heading}</span>
      </div>
      <ul class="syl-change-list">
        ${items.map(t => `<li>${_esc(t)}</li>`).join("") || `<li class="syl-none">None</li>`}
      </ul>
    </div>`;

  return `
    <div class="syl-section">
      <div class="syl-section__title">2026 Syllabus Changes</div>
      <p class="syl-intro">
        Based on the MOE 2021 mathematics syllabus, effective for PSLE 2026.
        Speed is <strong>not</strong> in the 2026 PSLE syllabus.
      </p>
      <div class="syl-changes-grid">
        ${col(newTopics, "badge-new",       "New")}
        ${col(movedUp,   "badge-moved-up",  "Moved Up")}
        ${col(movedDown, "badge-moved-down","Moved Down")}
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Per-level topic breakdown
// ---------------------------------------------------------------------------

function _htmlLevelContent(level) {
  const levelData = SYLLABUS[level];
  if (!levelData) return `<p class="syl-none">No data for ${_esc(level)}.</p>`;

  return Object.entries(levelData).map(([strand, topics]) => {
    if (topics.length === 0) return "";
    const topicsHtml = topics.map(topic => {
      const flag = getFlag(topic);
      const badge = flag
        ? `<span class="badge badge-${flag.flag.replace("_","-")}">${_esc(flag.label)}</span>`
        : "";
      return `<li class="syl-topic-item">${_esc(topic)}${badge}</li>`;
    }).join("");

    return `
      <div class="syl-strand-block">
        <div class="syl-strand-name">${_esc(strand)}</div>
        <ul class="syl-topic-list">${topicsHtml}</ul>
      </div>`;
  }).join("");
}
