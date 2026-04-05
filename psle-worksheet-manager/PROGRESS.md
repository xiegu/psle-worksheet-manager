# Project Progress

## What We Built

A browser-based PSLE 2026 Math Worksheet Manager plus an AI-powered paper scraper. Runs on a local Node/Express server with disk-persisted JSON data.

---

### App — `psle-worksheet-manager/`

| File | Status | Description |
|------|--------|-------------|
| `index.html` | Done | SPA shell, navigation, export/import buttons, active student indicator |
| `style.css` | Done | Full UI styles + `@media print` A4 output; student pill, badges, bulk bar, pagination |
| `app.js` | Done | Router — Library / Builder / Preview / Question Bank / Students views |
| `data/syllabus.js` | Done | Full P1–P6 MOE 2021 taxonomy, 2026 flags, helper functions |
| `modules/utils.js` | Done | Shared `_esc()` HTML-escape helper (loaded first, used by all modules) |
| `modules/storage.js` | Done | Dual-write storage: REST API (disk, source of truth) + IndexedDB (read cache); syncs from server on boot; auto-migrates IDB→server on first run; export/import JSON backup |
| `server.js` | Done | Lightweight Express server (~80 lines); serves static files + REST API for `worksheets.json`, `papers.json`, `students.json` |
| `data/worksheets.json` | Done | Built worksheets persisted on disk |
| `data/papers.json` | Done | Imported/scraped papers persisted on disk |
| `data/students.json` | Done | Students with scores and takenQuestions persisted on disk |
| `modules/library.js` | Done | 4-tab library; title search + independent filters per active tab; Built badge (papers), Taken badge (worksheets); bulk select with Archive/Delete/Restore/Assign Topic; Recover + Delete on archived items |
| `modules/builder.js` | Done | 3-step worksheet creator; drag-to-reorder + ↑↓ move buttons; Undo for destructive ops; "Pick from QB" modal; saves `sourceKey`; subject-aware live preview title |
| `modules/preview.js` | Done | Full A4 in-app preview + print window; student/teacher toggle; subject-aware title (`ws.subject`); renders `diagramImage`; logo in header |
| `modules/questionbank.js` | Done | Source papers only; text search + 30-per-page pagination; multi-select; Built/Not-built filter; QB caching (`_enrichedQCache`, `_builtSourceKeysCache`); stats bar |
| `modules/students.js` | Done | Student manager — add/set active, score history, Questions Taken count, Clear Taken / Delete; header pill indicator |
| `templates/worksheet.html` | Done | Standalone static A4 print template (sample P6 Algebra paper) |

### Scraper — `scraper/`

| File | Status | Description |
|------|--------|-------------|
| `scrape-papers.js` | Done | Downloads PDFs from sgtestpaper.com, sends to Claude for question extraction, outputs import-ready JSON; saves PDF to `papers/`; converts pages to JPEG via pdftoppm; skip-cache, blacklist, model, and refinement flags; adds `school/year/subject/paperType` fields |
| `p6-maths-prelim-2025.json` | Done | Scraped output — 60 questions, 23 with cropped diagram images, 100 marks |
| `papers/` folder | Done | Audit folder — original PDFs saved automatically on each scraper run |
| `README.md` | Done | Usage instructions, all CLI options, cost estimates |

---

## GitHub

- **Repo:** https://github.com/xiegu/psle-worksheet-manager (public)
- **Open issues:** 6 (#1, #3, #4, #5, #15, #16, #21)

---

## What Is Working

- **Full app loads** in Chrome from `index.html` (no server needed)
- **Worksheet builder** — cascading P1–P6 dropdowns, question cards (MCQ/short/long), drag-to-reorder, ↑↓ move buttons, Undo for delete/reorder, live preview, student/teacher toggle, subject-aware title
- **2026 syllabus flags** — New / Moved up / Moved down badges in builder and library
- **Speed topic guard** — blocked at save and print
- **Library dashboard** — title search + filters (Level, Strand, Topic, Difficulty, Type, 2026 Flag) on Active Worksheets and Available Papers; paper-specific filters (School, Year, Subject, Paper Type) parsed from title for older imports
- **4-tab Library** — Active Worksheets / Available Papers / Archived Worksheets / Archived Papers; each active tab has independent filter + search bar; stats bar shows counts for all 4 shelves
- **Bulk operations** — checkboxes on all cards; bulk Archive / Delete / Restore; Assign Topic modal (worksheets only)
- **Card actions** — Preview, Edit, Duplicate, Archive/Restore, Delete
- **"Built" badge on papers** — Always visible; shows All built / X/Y built / Not built based on `sourceKey` coverage in active worksheets
- **"Taken" badge on worksheets** — Score-based (requires active student); shows Taken / Not taken
- **Score recording** — Record Score on worksheet cards; shows prior scores in modal; same-date duplicate triggers confirm-to-replace; range validated
- **Print** — A4 output via browser print dialog; student copy hides answers, teacher copy shows answer key + watermark
- **Export/Import** — JSON backup and restore (v2 format includes student data) via header buttons
- **IndexedDB storage** — no 5MB limit; existing localStorage data auto-migrated on first load
- **Student module** — add students, set active student, track taken questions, record scores, view score history; active student shown in header pill
- **Question Bank** — source papers only; text search (question text + paper title); 30-per-page pagination; Built/Not-built filter; multi-select; build worksheet; caches enriched questions per session
- **Builder — Pick from QB** — modal with level filter + text search; multi-select; appends questions with diagrams and `sourceKey`
- **Scraper** — extracts full papers including Paper 1 (MCQ) and Paper 2 (short/long); outputs `school/year/subject/paperType` fields; imports cleanly via the app's Import button
- **Diagram support** — `pdftoppm` converts PDF pages to JPEG; Claude returns `diagramBbox`; `sharp` crops to tight JPEG stored as `diagramImage`; renders in Preview, print, builder, QB
- **Shared `_esc()` utility** — single HTML-escape function in `modules/utils.js`; no duplicates across modules
- **Focus preservation** — filter bar rebuilds restore keyboard focus to the previously active element

### Scraper test result (confirmed working — with diagrams)
```
Paper:                   P6 Maths Prelim 2025 — Nanyang
Questions extracted:     60 (Paper 1 + Paper 2)
Total marks:             100
Questions with diagrams: 23 / 60 (cropped via diagramBbox + sharp)
JSON output size:        ~1.1 MB
Model used:              claude-sonnet-4-6
PDF size:                4.4 MB (scanned, CCITT-encoded)
```

---

## Known Limitations

- **Diagram crops** — Claude estimates bounding boxes visually; crops are accurate but not pixel-perfect for complex multi-part figures
- **Strand/Topic blank after scrape** — each imported paper needs Strand and Topic assigned manually in Edit view so filters work correctly
- **sgtestpaper.com listing page returns HTTP 406** — scraper falls back to a hardcoded URL pattern; won't auto-discover new schools
- **Known schools list is fixed** — if sgtestpaper.com adds new schools, add them to `KNOWN_SCHOOLS` in `scrape-papers.js`

---

## Open Issues

### High priority
- [ ] **Rotate API key** ([#1](https://github.com/xiegu/psle-worksheet-manager/issues/1)) — revoke old key at `platform.claude.com/settings/api-keys` *(manual step)*
- [ ] **Scrape more papers** ([#3](https://github.com/xiegu/psle-worksheet-manager/issues/3)) — run scraper for other schools, years, levels (P5, P4)

### Reliability
*(all reliability issues resolved)*

### Bug fixes
*(all bug fixes resolved)*

### Enhancements
*(all enhancement issues resolved)*

### Cleanup
*(all cleanup issues resolved)*

---

## Changes (2026-03-29)

### Performance & cleanup (#31–#35)
- **`modules/storage.js`** — non-blocking boot sync (#31): if IDB already has data, app loads from cache immediately and syncs from server in background; first boot still blocks
- **`modules/utils.js`** — added `_debounce(fn, ms)` utility (#32)
- **`modules/library.js`** — debounced search input by 250ms (#32); targeted card removal for archive/delete/restore instead of full re-render (#33); added `_removeCardAndUpdateCounts()` and `_refreshCounts()` helpers
- **`modules/questionbank.js`** — debounced search input by 250ms (#32); cached filtered question list to skip re-filtering on page turns (#34)
- **`style.css`** — removed 4 dead CSS selectors: `.flag-warning--new/moved_up/moved_down`, `.filter-group--toggle` (#35)

### Server write lock (#25), sync warnings (#26), null date fix (#28), double-click guard (#30)
- **`server.js`** — added per-collection promise-chain mutex (`withLock`); PUT, DELETE, and bulk POST routes now serialise writes per collection, preventing concurrent file corruption
- **`modules/storage.js`** — replaced 11 silent `console.warn` calls with `_syncWarn()` helper that shows an error toast + logs to console; added null guard on date sort in `getScoresForWorksheet()`
- **`modules/students.js`** — added null guard on date sort in score history rendering
- **`modules/library.js`** — `_onCardClick` now disables the clicked button during async operations and re-enables on completion via `.finally(restore)`

### Batch print (#4) + Separate answer key page (#5)
- **`modules/preview.js`** — refactored `generateWorksheetHTML` to use shared `_buildPageDivs(ws, teacherMode)` helper and extracted `_PRINT_CSS` constant; teacher mode now produces two separate `.page` divs: questions page + answer key page (page break between them); added `openBatchPrintWindow(worksheets)` for single-session multi-worksheet printing (student copy); exposed globally
- **`modules/library.js`** — added "Print (n)" button to bulk bar for worksheets tab; handler fetches all selected worksheets and calls `openBatchPrintWindow`

---

## Changes (2026-03-25)

### Node/Express backend — disk-based persistence
- **`server.js`** — lightweight Express server (~80 lines) serving static files + REST API for 3 JSON collections
- **`data/worksheets.json`** — user-built worksheets persisted on disk
- **`data/papers.json`** — imported papers persisted on disk (separated from worksheets)
- **`data/students.json`** — student records with scores and takenQuestions persisted on disk
- **Dual-write `storage.js`** — every write goes to API (disk, source of truth) then IndexedDB (cache); reads from IDB; syncs from server on boot
- **Auto-migration** — on first boot, if server is empty but IDB has data, pushes IDB data to server automatically
- **Data survives** browser cache clears, browser switches, Chrome reinstalls

### Builder UX
- **Auto-generated worksheet title** — title input auto-fills from Level + Strand + Topic + Difficulty + Type dropdowns (e.g. `P6 Number — Fractions — Standard Practice`). User can freely edit; clearing the field re-enables auto-gen. Editing existing worksheets preserves title.
- **Removed 2026 syllabus flag badges from builder, preview, and print** — "Moved to P6: Average" / "New: Ratio" labels removed. Speed blocked-topic warning retained.

---

## Completed Issues

| Issue | What was done |
|-------|---------------|
| [#35](https://github.com/xiegu/psle-worksheet-manager/issues/35) | Removed 4 dead CSS selectors (flag-warning variants, filter-group--toggle) |
| [#34](https://github.com/xiegu/psle-worksheet-manager/issues/34) | QB filtered-question cache — skip re-filtering on page turns |
| [#33](https://github.com/xiegu/psle-worksheet-manager/issues/33) | Targeted card removal + count update instead of full library re-render |
| [#32](https://github.com/xiegu/psle-worksheet-manager/issues/32) | 250ms debounce on library + QB search inputs |
| [#31](https://github.com/xiegu/psle-worksheet-manager/issues/31) | Non-blocking boot sync — IDB cache used immediately, server sync in background |
| [#30](https://github.com/xiegu/psle-worksheet-manager/issues/30) | Double-click guard: card action buttons disabled during async, re-enabled on completion |
| [#28](https://github.com/xiegu/psle-worksheet-manager/issues/28) | Null guard on date sort in `getScoresForWorksheet()` and students score history |
| [#26](https://github.com/xiegu/psle-worksheet-manager/issues/26) | `_syncWarn()` replaces 11 silent `console.warn` calls with error toast + console log |
| [#25](https://github.com/xiegu/psle-worksheet-manager/issues/25) | Per-collection promise-chain mutex in `server.js` — serialises PUT/DELETE/bulk writes |
| [#5](https://github.com/xiegu/psle-worksheet-manager/issues/5) | Teacher mode print: answer key now on its own page (separate `.page` div with page break) |
| [#4](https://github.com/xiegu/psle-worksheet-manager/issues/4) | Batch print: "Print (n)" in bulk bar opens one print session for all selected worksheets (student copy) |
| [#29](https://github.com/xiegu/psle-worksheet-manager/issues/29) | Removed stale `.badge-new`, `.badge-moved-up`, `.badge-moved-down` CSS from `preview.js` inline styles |
| [#27](https://github.com/xiegu/psle-worksheet-manager/issues/27) | Fixed flag filter labels in library: "Moved up" → "Moved to P6", "Moved down" → "Now in P4 / P3" |
| [#21](https://github.com/xiegu/psle-worksheet-manager/issues/21) | Drag-drop bounds check (NaN + range guard); bulk archive error reporting |
| [#16](https://github.com/xiegu/psle-worksheet-manager/issues/16) | Accessibility — `aria-current` on nav, `role/aria-label` on nav+icons, Escape closes all modals, Enter submits score + student-add inputs |
| [#15](https://github.com/xiegu/psle-worksheet-manager/issues/15) | Print improvements — logo fallback placeholder, `overflow-wrap` on q-text, `orphans/widows:2`, `break-inside:avoid`, diagram capped to 80mm in print |
| [#24](https://github.com/xiegu/psle-worksheet-manager/issues/24) | Subject-aware titles — preview + print use `ws.subject\|\|"Maths"` + " Worksheet" |
| [#23](https://github.com/xiegu/psle-worksheet-manager/issues/23) | QB caching — `_enrichedQCache` + `_builtSourceKeysCache`; reset on full render |
| [#22](https://github.com/xiegu/psle-worksheet-manager/issues/22) | Focus preservation — filter rebuilds restore `document.activeElement` |
| [#21](https://github.com/xiegu/psle-worksheet-manager/issues/21) | *(open)* |
| [#20](https://github.com/xiegu/psle-worksheet-manager/issues/20) | Won't fix — per-question timestamps not needed |
| [#19](https://github.com/xiegu/psle-worksheet-manager/issues/19) | Bulk operations — checkboxes, bulk bar, Archive/Delete/Restore, Assign Topic modal |
| [#18](https://github.com/xiegu/psle-worksheet-manager/issues/18) | Undo + move buttons — `_undoSnapshot` before destructive ops; ↑↓ on each card |
| [#17](https://github.com/xiegu/psle-worksheet-manager/issues/17) | Library title search + QB search/pagination (30 per page, Prev/Next) |
| [#14](https://github.com/xiegu/psle-worksheet-manager/issues/14) | Duplicate score guard — prior scores shown; same-date confirm-to-replace; range check |
| [#13](https://github.com/xiegu/psle-worksheet-manager/issues/13) | Shared `_esc()` in `modules/utils.js`; removed 5 local copies |
| [#12](https://github.com/xiegu/psle-worksheet-manager/issues/12) | XSS risk in imported data — sanitised `diagramImage`; tightened import validation |
| [#11](https://github.com/xiegu/psle-worksheet-manager/issues/11) | Question ID collisions — `_newQId()` with timestamp + random suffix |
| [#10](https://github.com/xiegu/psle-worksheet-manager/issues/10) | Race condition in student cache — re-reads localStorage after await |
| [#9](https://github.com/xiegu/psle-worksheet-manager/issues/9) | Other subjects in scraper |
| [#8](https://github.com/xiegu/psle-worksheet-manager/issues/8) | `--years` range flag in scraper |
| [#7](https://github.com/xiegu/psle-worksheet-manager/issues/7) | HTTP 406 fallback in scraper |
| [#6](https://github.com/xiegu/psle-worksheet-manager/issues/6) | Student module + score tracking |
| [#2](https://github.com/xiegu/psle-worksheet-manager/issues/2) | Assign topics after import |

---

## How to Run the Scraper

```bash
cd scraper/
export ANTHROPIC_API_KEY=sk-ant-YOUR-NEW-KEY
# Single school test
node scrape-papers.js --level P6 --year 2025 --school Nanyang --type Prelim
# All 13 schools
node scrape-papers.js --level P6 --year 2025 --type Prelim --out p6-prelim-2025.json
# See what's available without spending credits
node scrape-papers.js --dry-run
```

Then import the output JSON via the **↑ Import** button in the app.

---

---

## Code Review Findings (2026-04-04)

Items identified during a full review of `modules/`. Prioritised by impact.

### Should fix

- [ ] **Stale QB cache after edit** — `_enrichedQCache` in `questionbank.js` is not invalidated when a question is edited via the edit modal. The edit modal calls `_renderQBGrid()` which reads from the stale cache. Fix: set `_enrichedQCache = null` in the `qb-edit-save` handler before calling `_renderQBGrid()`.

- [ ] **No debounce on builder preview** — every keystroke in question text/answer/working triggers `_refreshPreview()` immediately in `builder.js`. For worksheets with many questions, this causes visible lag. Fix: wrap `_refreshPreview()` calls from `input` events with `_debounce()` (already available in `utils.js`).

- [ ] **Modals not cleaned up on navigation** — modals appended to `document.body` (QB picker, edit modal, score modal, assign-topic modal) persist if the user navigates away via `navigate()` without closing them. Fix: add a cleanup sweep in `app.js` router that removes any `.qb-modal-overlay` elements before rendering the new view.

### Nice to have

- [ ] **Single-level undo** — `builder.js` keeps only one `_undoSnapshot`. Multiple destructive actions (delete → move → delete) only undo the last one. Could extend to a small stack (e.g., 5 deep).

- [ ] **`_esc()` doesn't escape single quotes** — `utils.js` escapes `& < > "` but not `'`. Safe with current double-quoted attributes, but would break if any template literal uses single-quoted HTML attributes. Fix: add `.replace(/'/g, "&#39;")`.

- [ ] **`clearAll` swallows individual delete failures** — `storage.js` fires all deletes in parallel and catches the batch. Some items may survive silently. Fix: collect and report failures.

- [ ] **Logo inconsistency between preview and print** — in-app preview (`preview.js`) uses `<img src="logo.png">`, but print (`_buildPageDivs`) uses `window.LOGO_DATA_URL` with a "WM" placeholder fallback. Print may look different if the data URL isn't set.

### Won't fix (acceptable trade-offs)

- **Global namespace** — all functions are globals. Acceptable for a vanilla JS SPA with no bundler; the `_` prefix convention is consistently followed.
- **`innerHTML` re-rendering** — standard pattern for this codebase; focus loss is mitigated by the existing `_rebuildFilterBar` focus-restore pattern. Extending it to builder questions would add complexity for marginal gain.
- **`_parsePaperMeta` regex fragility** — title parsing is a fallback for papers imported before explicit metadata fields were added. New imports include `school/year/subject/paperType` directly.

*Last updated: 2026-04-04 — code review findings added*

---

## Changes (2026-04-05)

### Code review fixes

**Should fix (all done):**
- **`modules/questionbank.js`** — invalidate `_enrichedQCache` and `_filteredQCache` in the edit-save handler so the grid re-reads the updated question immediately after saving
- **`modules/builder.js`** — debounce preview refresh (150ms) for all `input` events (question text, answer, working, options, title); discrete `change` events and button actions remain immediate
- **`app.js`** — sweep all `.qb-modal-overlay` elements before rendering each new view, cleaning up any modals left open when the user navigates away

**Nice to have (all done):**
- **`modules/builder.js`** — replaced single `_undoSnapshot` with `_undoStack` (max 5); each undo pops the stack; button hides when stack is empty
- **`modules/utils.js`** — `_esc()` now escapes single quotes (`'` → `&#39;`) in addition to `& < > "`
- **`modules/storage.js`** — `clearAll()` now uses `Promise.allSettled` for individual deletes and reports the count of any that fail via `_syncWarn`
- **`modules/preview.js`** — in-app preview logo now uses `window.LOGO_DATA_URL` (consistent with print output), with `logo.png` as fallback

*Last updated: 2026-04-05 — closed all 7 code review items*
