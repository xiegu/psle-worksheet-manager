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

### Enhancements
- [ ] **Batch print** ([#4](https://github.com/xiegu/psle-worksheet-manager/issues/4)) — print multiple worksheets in one browser print session
- [ ] **Separate answer key sheet** ([#5](https://github.com/xiegu/psle-worksheet-manager/issues/5)) — printable answer key on its own page

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

*Last updated: 2026-03-25 — Node backend + disk persistence confirmed working; Emily and Aarron test students verified in students.json*
