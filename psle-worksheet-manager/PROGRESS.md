# Project Progress

## What We Built

A fully offline, browser-based PSLE 2026 Math Worksheet Manager plus an AI-powered paper scraper.

---

### App — `psle-worksheet-manager/`

| File | Status | Description |
|------|--------|-------------|
| `index.html` | Done | SPA shell, navigation, export/import buttons, active student indicator |
| `style.css` | Done | Full UI styles + `@media print` A4 output; student pill, taken badges, score section |
| `app.js` | Done | Router — Library / Builder / Preview / Question Bank / Students views |
| `data/syllabus.js` | Done | Full P1–P6 MOE 2021 taxonomy, 2026 flags, helper functions |
| `modules/storage.js` | Done | IndexedDB CRUD (replaces localStorage; auto-migrates existing data on first load), export/import JSON backup (v2: includes student data) |
| `modules/library.js` | Done | 4-tab library; independent filters; "Built" badge on papers (sourceKey-based, always visible); score-based "Taken" badge on worksheets; Recover + Delete on archived papers; Delete on archived worksheets |
| `modules/builder.js` | Done | 3-step worksheet creator with live preview, drag-to-reorder; "Pick from QB" modal; saves `sourceKey` on picked questions for "built" tracking |
| `modules/preview.js` | Done | Full A4 in-app preview, student/teacher toggle; shared `generateWorksheetHTML` / `openPrintWindow` used by all print paths; renders `diagramImage`; logo (100 px) in header |
| `modules/questionbank.js` | Done | Source papers only; multi-select, build worksheet; Built/Not built/All filter (sourceKey-based, always visible); stats bar shows Total Questions + From Papers |
| `modules/students.js` | Done | Student manager — add/set active student, score history table, Questions Taken count (aligned with score-based taken logic), Clear Taken / Delete; header pill indicator |
| `templates/worksheet.html` | Done | Standalone static A4 print template (sample P6 Algebra paper) |

### Scraper — `scraper/`

| File | Status | Description |
|------|--------|-------------|
| `scrape-papers.js` | Done | Downloads PDFs from sgtestpaper.com, sends to Claude for question extraction, outputs import-ready JSON; saves original PDF to `papers/` for audit; converts pages to JPEG via pdftoppm for diagram support; skip-cache, blacklist, model, and refinement flags |
| `p6-maths-prelim-2025.json` | Done | Scraped output (lowercase filename) — 60 questions, 23 with cropped diagram images, 100 marks |
| `papers/` folder | Done | Audit folder — original PDF saved here automatically on each scraper run |
| `README.md` | Done | Usage instructions, all CLI options, cost estimates |

---

## GitHub

- **Repo:** https://github.com/xiegu/psle-worksheet-manager (public)
- **Issues:** 16 open issues (#10–#12 closed); labelled `priority: high`, `bug`, `security`, `enhancement`, `code-quality`, `accessibility`, `print`, `scraper`

---

## What Is Working

- **Full app loads** in Chrome from `index.html` (no server needed)
- **Worksheet builder** — cascading P1–P6 dropdowns, question cards (MCQ/short/long), drag-to-reorder, live preview, student/teacher toggle
- **2026 syllabus flags** — New / Moved up / Moved down badges show in builder and library
- **Speed topic guard** — blocked at save and print
- **Library dashboard** — filter by Level, Strand, Topic, Difficulty, Type, Status, 2026 Flag (all combinable)
- **Card actions** — Preview, Edit, Duplicate, Archive/Restore
- **Print** — A4 output via browser print dialog; student copy hides answers, teacher copy shows answer key + watermark
- **Export/Import** — JSON backup and restore (v2 format includes student data) via header buttons
- **IndexedDB storage** — worksheets and students stored in IndexedDB (no 5MB limit); existing localStorage data auto-migrated on first load; supports 1000+ papers (~700MB) with room to spare
- **Student module** — add students, set active student, track taken questions per student, record scores per worksheet, view score history; active student shown in header pill
- **4-tab Library** — Active Worksheets / Available Papers / Archived Worksheets / Archived Papers tabs; each active tab has its own independent filter bar (Level→Strand→Topic, Difficulty, Type, 2026 Flag); archived tabs have no filters; stats bar shows counts for all 4 shelves
- **Origin tagging** — imported papers tagged `origin:"imported"`; builder-created worksheets tagged `origin:"built"`; existing data auto-migrated on first load using diagram-image heuristic
- **"Built" badge on papers** — Available Papers tab shows "All built / X/Y built / Not built" based on whether questions appear (via `sourceKey`) in any active worksheet; always visible, no active student required
- **"Taken" badge on worksheets** — Active Worksheets tab shows "Taken / Not taken" based on whether a score has been recorded; requires active student
- **sourceKey tracking** — questions picked from QB (via builder modal or QB "Build Worksheet") carry `sourceKey: "paperId::qId"` so the library and QB can track built coverage without relying on per-student data
- **Score recording** — "Record Score" on worksheet cards only
- **Archived Papers actions** — Recover + Delete buttons, both with confirm dialog
- **Archived Worksheets actions** — Restore + Delete buttons, both with confirm dialog
- **Question Bank — source papers only** — "Built/Not built/All" filter (sourceKey-based, always visible); stats bar shows Total Questions + From Papers
- **Builder — Pick from QB** — modal with level filter + text search; multi-select; appends questions with diagrams and `sourceKey`
- **Students — Questions Taken** — counts total questions across all worksheets with a recorded score (aligned with score-based "Taken" definition)
- **Logo** — 100 px logo in worksheet header (in-app preview and print); name/class row height increased
- **Scraper** — extracts full papers including both Paper 1 (MCQ) and Paper 2 (short/long); output imports cleanly via the app's Import button
- **Diagram support** — `pdftoppm` converts PDF pages to JPEG; Claude returns `diagramBbox` coordinates; `sharp` crops each figure to a tight JPEG stored as `diagramImage` on the question; renders in Preview, print, builder card, live preview, and Question Bank modal
- **Scraper output naming** — JSON files named by paper title (lowercase, e.g. `p6-maths-prelim-2025.json`) instead of generic `papers-output.json`
- **Audit trail** — scraper saves the original PDF to `scraper/papers/` automatically on every run
- **Scraper skip-cache** — already-scraped papers skipped by default on re-runs; `--force` to re-scrape all
- **School blacklist** — PLMGS and RedSwastika permanently excluded; `--exclude School1,School2` for per-run exclusions
- **Scraper model split** — main extraction uses Sonnet 4.6 by default (`--model` to override); diagram refinement pass uses Haiku 4.5 (cheaper, lower stakes)
- **Diagram refinement opt-in** — pass 2 diagram re-crop disabled by default; enable with `--refine-diagrams`

### Scraper test result (confirmed working — with diagrams)
```
Paper:                   P6 Maths Prelim 2025 — Nanyang
Questions extracted:     60 (Paper 1 + Paper 2)
Total marks:             100
Questions with diagrams: 23 / 60 (cropped via diagramBbox + sharp)
JSON output size:        ~1.1 MB (was ~30 MB with full page images)
Model used:              claude-sonnet-4-6
PDF size:                4.4 MB (scanned, CCITT-encoded)
```

---

## Known Limitations

- **Diagram crops** — Claude estimates bounding boxes visually; crops are accurate but not pixel-perfect for complex multi-part figures
- **Strand/Topic blank after scrape** — each imported paper needs the tutor to assign Strand and Topic manually in the Edit view so filters work correctly
- **sgtestpaper.com listing page returns HTTP 406** — scraper falls back to a hardcoded URL pattern (works, but won't auto-discover new schools added to the site)
- **Known schools list is fixed** — if sgtestpaper.com adds new schools, add them to `KNOWN_SCHOOLS` in `scrape-papers.js`

---

## Next Steps

### High priority (GitHub Issues #1, #3, #14, #21)
- [ ] **Rotate API key** ([#1](https://github.com/xiegu/psle-worksheet-manager/issues/1)) — revoke old key at `platform.claude.com/settings/api-keys`
- [ ] **Scrape more papers** ([#3](https://github.com/xiegu/psle-worksheet-manager/issues/3)) — run scraper for other schools, years, and levels (P5, P4)
- [ ] **Prevent duplicate score recording** ([#14](https://github.com/xiegu/psle-worksheet-manager/issues/14)) — warn on duplicate, validate score range
- [ ] **Fix drag-drop index validation** ([#21](https://github.com/xiegu/psle-worksheet-manager/issues/21)) — bounds check + archive error handling

### Enhancements (GitHub Issues #4, #5, #15–#17)
- [ ] **Batch print** ([#4](https://github.com/xiegu/psle-worksheet-manager/issues/4)) — print multiple worksheets in one browser print session
- [ ] **Separate answer key sheet** ([#5](https://github.com/xiegu/psle-worksheet-manager/issues/5)) — printable answer key on its own page
- [ ] **Deduplicate `_esc()` helper** ([#13](https://github.com/xiegu/psle-worksheet-manager/issues/13)) — shared utility instead of 5 copies
- [ ] **Print output improvements** ([#15](https://github.com/xiegu/psle-worksheet-manager/issues/15)) — logo fallback, text overflow, page break orphans, diagram size limit
- [ ] **Accessibility** ([#16](https://github.com/xiegu/psle-worksheet-manager/issues/16)) — keyboard nav, ARIA labels, Enter-to-submit
- [ ] **Text search + pagination** ([#17](https://github.com/xiegu/psle-worksheet-manager/issues/17)) — search in Library, paginate Question Bank

### Completed
- [x] **Prevent duplicate score recording** ([#14](https://github.com/xiegu/psle-worksheet-manager/issues/14)) — modal shows prior scores; same-date duplicate triggers confirm-to-replace; range validated (0 ≤ obtained ≤ total)
- [x] **Deduplicate `_esc()` helper** ([#13](https://github.com/xiegu/psle-worksheet-manager/issues/13)) — single `_esc()` in `modules/utils.js` (loaded first); removed 5 local copies from library, builder, questionbank, preview, students
- [x] **Multi-subject titles** ([#24](https://github.com/xiegu/psle-worksheet-manager/issues/24)) — preview + print headers use `ws.subject||"Maths"` + " Worksheet" instead of hardcoded "Math Worksheet"
- [x] **QB performance** ([#23](https://github.com/xiegu/psle-worksheet-manager/issues/23)) — `_enrichedQCache` + `_builtSourceKeysCache` at module level; reset on `renderQuestionBank()`
- [x] **Focus management** ([#22](https://github.com/xiegu/psle-worksheet-manager/issues/22)) — `_rebuildFilterBar` and `_rebuildQBFilterBar` preserve `document.activeElement.id` across rebuilds
- [x] **Bulk operations** ([#19](https://github.com/xiegu/psle-worksheet-manager/issues/19)) — checkboxes on all cards; bulk bar with Archive/Delete/Restore; Assign Topic modal for worksheets
- [x] **Undo + move-up/down in builder** ([#18](https://github.com/xiegu/psle-worksheet-manager/issues/18)) — `_undoSnapshot` saved before delete/drag-drop/move; Undo button in action bar; ↑↓ buttons on each question card
- [x] ~~**Taken question timestamps** ([#20](https://github.com/xiegu/psle-worksheet-manager/issues/20))~~ — won't fix (per-question timestamps not needed)
- [x] **Fix race condition in student cache + null checks** ([#10](https://github.com/xiegu/psle-worksheet-manager/issues/10))
- [x] **Fix question ID collisions** ([#11](https://github.com/xiegu/psle-worksheet-manager/issues/11))
- [x] **XSS risk in imported data** ([#12](https://github.com/xiegu/psle-worksheet-manager/issues/12))
- [x] **Assign topics after import** ([#2](https://github.com/xiegu/psle-worksheet-manager/issues/2))
- [x] **Student module + score tracking** ([#6](https://github.com/xiegu/psle-worksheet-manager/issues/6))
- [x] **Fix HTTP 406 on listing page** ([#7](https://github.com/xiegu/psle-worksheet-manager/issues/7))
- [x] **Add `--years` range flag** ([#8](https://github.com/xiegu/psle-worksheet-manager/issues/8))
- [x] **Support other subjects in scraper** ([#9](https://github.com/xiegu/psle-worksheet-manager/issues/9))
- [x] In-app Question Bank, Diagram support, GitHub + issue tracking

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

*Last updated: 2026-03-23 — resolved #13 (shared _esc utility), #14 (duplicate score guard), #18 (undo + move-up/down), #19 (bulk operations), #20 (won't fix), #22 (focus preservation), #23 (QB caching), #24 (subject-aware titles)*
