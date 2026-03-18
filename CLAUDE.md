# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

PSLE 2026 Math Worksheet Manager — a browser-based, offline-capable SPA for a Singapore primary school tutor to create, organise, print, and maintain P1–P6 math worksheets aligned to the MOE 2021 syllabus and 2026 PSLE exam format.

## Tech Stack & Constraints

- **Vanilla HTML + CSS + JS only** — no React, Vue, or any framework
- **No external CDNs** — must work fully offline (no CDN links in HTML)
- **No backend, no fetch, no API calls** — `localStorage` is the only data store
- **No bundler** — files are imported directly via `<script src="...">` tags
- **A4 print output** — all print CSS must target 210mm x 297mm (Chrome/Edge)

## Repository Structure

```
psle-worksheet-manager/
├── index.html              # SPA shell + navigation
├── style.css               # Global styles + @media print stylesheet
├── app.js                  # Router + global state management
├── data/
│   └── syllabus.js         # SOLE source of truth for topic taxonomy & 2026 flags
├── modules/
│   ├── library.js          # Worksheet library dashboard (filters + card grid)
│   ├── builder.js          # Worksheet creator/editor (3-step form)
│   ├── preview.js          # Live preview + print handler
│   └── storage.js          # localStorage CRUD helpers
└── templates/
    └── worksheet.html      # Static A4-printable worksheet template
```

## Running the App

Open `index.html` directly in Chrome or Edge — no build step, no server needed.

To test print output: open `templates/worksheet.html` in Chrome → Ctrl+P → verify A4 layout with 15mm margins.

## Architecture

### Data Flow

`syllabus.js` exports `SYLLABUS` and `TOPIC_FLAGS` as globals. All other modules read from these — **never hardcode topic names or flags elsewhere**.

`storage.js` wraps `localStorage` with typed CRUD functions. All modules that persist data must go through `storage.js`, never call `localStorage` directly.

`app.js` owns the router and global state. Modules register themselves and receive state updates via the router.

### Key Invariants

- **Speed topic must never appear anywhere** — not in dropdowns, not in syllabus, not in worksheets. If `topic === "Speed"`, block with: `"Speed is not in the 2026 PSLE syllabus."`
- **2026 flags must always come from `TOPIC_FLAGS` in `syllabus.js`** — never hardcoded in UI modules
- **Worksheet IDs** are timestamp-based: `"ws_" + Date.now()`

### Worksheet Schema

```js
{
  id: "ws_<timestamp>",
  title: "",
  level: "P1"|"P2"|"P3"|"P4"|"P5"|"P6",
  strand: "",           // one of 3 MOE strands
  topic: "",
  difficulty: "Foundation"|"Standard"|"Challenge",
  type: "Practice"|"Word Problem"|"Mixed"|"Exam-style",
  createdAt: "YYYY-MM-DD",
  updatedAt: "YYYY-MM-DD",
  version: 1,
  status: "active"|"archived",
  questions: [
    {
      id: "q1",
      type: "mcq"|"short_answer"|"long_answer",
      text: "",
      marks: 2,
      answer: "",
      working: ""       // shown only on teacher copy
    }
  ],
  notes: ""
}
```

### Print Behaviour

- `style.css` `@media print`: hide nav, sidebar, buttons; enforce A4 (210mm x 297mm, 15mm margins)
- Student copy: answers hidden (`display: none`)
- Teacher copy: answers visible + "ANSWER KEY" watermark in header
- Multiple worksheets: `page-break-after: always` between each

### Builder Steps

1. **Metadata** — title, level → strand (cascading) → topic (cascading), difficulty, type; shows 2026 flag warning if applicable
2. **Questions** — add/delete/reorder question cards; live running marks total
3. **Preview & Save** — live preview panel, student/teacher toggle, save + print

### Library Filters

All filters are combinable: Level, Strand, Topic, Difficulty, Type, Status (active/archived), 2026 Flag. Topic dropdown populates dynamically based on selected Level + Strand.

## Syllabus Helper Functions (data/syllabus.js)

```js
getStrands(level)           // returns strand names for a given level
getTopics(level, strand)    // returns topic array for a level+strand
getFlag(topic)              // returns flag object {flag, label} or null
```

## Build Phases

| Phase | Goal | Key Files |
|-------|------|-----------|
| 1 | Data layer + printable template | `syllabus.js`, `storage.js`, `templates/worksheet.html` |
| 2 | Worksheet builder | `index.html`, `app.js`, `modules/builder.js` |
| 3 | Library dashboard | `modules/library.js` |
| 4 | Data portability | Export/import JSON in `storage.js` |

## Acceptance Criteria

- All P1–P6 topics match the MOE 2021 syllabus exactly as defined in `syllabus.js`
- "Speed" never appears in any dropdown, filter, or saved worksheet
- 2026 flag badges (New, Moved up, Moved down) appear in builder and library cards
- Worksheets persist across browser refresh via `localStorage`
- Student print: no answers visible, clean A4
- Teacher print: answer key visible with watermark
- Export JSON → clear storage → import → all worksheets restored
