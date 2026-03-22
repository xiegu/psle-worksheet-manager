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
| `modules/library.js` | Done | 4-tab library (Active Worksheets / Available Papers / Archived Worksheets / Archived Papers); independent filter bars per active tab; origin-aware taken badges; Recover + Delete on archived papers |
| `modules/builder.js` | Done | 3-step worksheet creator with live preview, drag-to-reorder; "Pick from Question Bank" modal for selecting source-paper questions directly into a new worksheet |
| `modules/preview.js` | Done | Full A4 in-app preview, student/teacher toggle; shared `generateWorksheetHTML` / `openPrintWindow` used by all print paths; renders `diagramImage`; logo (100 px) in header |
| `modules/questionbank.js` | Done | Question Bank — source papers only (active, imported); multi-select, build worksheet; Taken / Not taken / All dropdown filter; diagrams carried through to new worksheets |
| `modules/students.js` | Done | Student manager — add/set active student, score history table, taken question count, Clear Taken / Delete; header pill indicator |
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
- **Issues:** 9 open issues tracking all remaining work — labelled `priority: high`, `enhancement`, `scraper`, `manual`

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
- **Taken badges — two modes** — Papers (imported): question-level "X/Y taken"; Worksheets (built): score-based "Taken / Not taken"
- **Score recording** — "Record Score" on worksheet cards only; for source papers, recording a score also marks all questions as taken
- **Archived Papers actions** — Recover (restore to Available Papers) and Delete (permanent) buttons, both requiring confirm dialog
- **Question Bank — source papers only** — questions from builder-created worksheets and archived papers excluded; "Taken" filter is now a dropdown (All / Taken / Not taken)
- **Builder — Pick from QB** — "Pick from Question Bank" button opens a modal with level filter + text search; multi-select questions from source papers and append them (with diagrams) directly into the worksheet being built
- **Diagram fix** — `diagramImage` now correctly carried through from Question Bank to new worksheets
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

### High priority (GitHub Issues #1–#3)
- [ ] **Rotate API key** ([#1](https://github.com/xiegu/psle-worksheet-manager/issues/1)) — revoke old key at `platform.claude.com/settings/api-keys`
- [ ] **Assign topics after import** ([#2](https://github.com/xiegu/psle-worksheet-manager/issues/2)) — open Nanyang paper in Edit, set Strand + Topic so library filters work
- [ ] **Scrape more papers** ([#3](https://github.com/xiegu/psle-worksheet-manager/issues/3)) — run scraper for other schools, years, and levels (P5, P4)

### Nice to have
- [x] **In-app Question Bank** — browse all questions across worksheets; filter by Level/Strand/Topic/Q-Type/Difficulty; multi-select + "Build Worksheet"; single-question "Use" and "Preview" with answer key
- [x] **Diagram support** — scraper converts PDF pages to JPEG via `pdftoppm`; Claude returns `diagramBbox` coordinates; `sharp` crops each figure to a tight JPEG stored as `diagramImage` on the question; diagrams display in Preview, print, builder card, builder live preview, and Question Bank modal
- [x] **GitHub + issue tracking** — repo at github.com/xiegu/psle-worksheet-manager; all remaining tasks tracked as issues
- [ ] **Batch print** ([#4](https://github.com/xiegu/psle-worksheet-manager/issues/4)) — print multiple worksheets in one browser print session (page-break CSS already in place)
- [ ] **Answer key page** ([#5](https://github.com/xiegu/psle-worksheet-manager/issues/5)) — separate printable answer key sheet rather than bottom-of-page table
- [x] **Student module + score tracking** ([#6](https://github.com/xiegu/psle-worksheet-manager/issues/6)) — full student management, taken-question tracking, score recording per worksheet

### Scraper improvements
- [x] Fix HTTP 406 on listing page ([#7](https://github.com/xiegu/psle-worksheet-manager/issues/7)) — full browser-like headers (User-Agent, Accept, Accept-Language, Cache-Control) now sent on all listing page fetches
- [x] Add `--years 2020-2025` range flag ([#8](https://github.com/xiegu/psle-worksheet-manager/issues/8)) — batch-scrape multiple years in one run; output file auto-named e.g. `p6-maths-prelim-2022-2025.json`
- [x] Support other subjects ([#9](https://github.com/xiegu/psle-worksheet-manager/issues/9)) — `--subject Maths|English|Science|Chinese`; subject-aware URL patterns, extraction prompts, and default strand

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

*Last updated: 2026-03-22 — IndexedDB migration; scraper cost optimisations*
*Updated: 2026-03-22 — 4-tab library (source papers vs worksheets); origin tagging + migration; logo in print output; diagram fix in QB→builder flow; QB taken dropdown; builder "Pick from QB" modal; archived papers Recover/Delete; taken badge logic split by origin*
