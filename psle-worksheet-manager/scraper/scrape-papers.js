#!/usr/bin/env node
// scraper/scrape-papers.js
//
// Downloads past-year PSLE Maths papers from sgtestpaper.com,
// sends each PDF to Claude Vision for question extraction,
// and outputs a JSON file ready to import into the Worksheet Manager app.
//
// Usage:
//   ANTHROPIC_API_KEY=sk-ant-... node scrape-papers.js [options]
//
// Options:
//   --level   P6 | P5 | P4 | P3 | P2 | P1          (default: P6)
//   --year    2025 | 2024 | 2023 | ...               (default: 2025)
//   --school  Nanyang | Raffles | Rosyth | ... | ALL (default: ALL)
//   --type    Prelim | WA1 | WA2 | WA3 | SA1 | ALL  (default: Prelim)
//   --out     output filename                         (default: papers-output.json)
//   --dry-run List papers that would be scraped, then exit
//
// Examples:
//   node scrape-papers.js --level P6 --year 2025 --school Nanyang
//   node scrape-papers.js --level P6 --year 2025 --type Prelim --out p6-prelim-2025.json
//   node scrape-papers.js --dry-run

"use strict";

const Anthropic      = require("@anthropic-ai/sdk");
const fetch          = require("node-fetch");
const fs             = require("fs");
const path           = require("path");
const https          = require("https");
const http           = require("http");
const os             = require("os");
const { spawnSync }  = require("child_process");
const sharp          = require("sharp");

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

const args = parseArgs(process.argv.slice(2));
const LEVEL    = args.level   || "P6";
const YEAR     = args.year    || "2025";
const SCHOOL   = (args.school || "ALL").trim();
const TYPE     = (args.type   || "Prelim").trim();
const OUT_FILE = args.out     || "papers-output.json";
const DRY_RUN  = args["dry-run"] === true;

// ---------------------------------------------------------------------------
// URL templates for sgtestpaper.com
// ---------------------------------------------------------------------------

// Listing page: e.g. https://www.sgtestpaper.com/primary/subject2025/y25p6maths.html
function listingUrl(level, year) {
  const lvl    = level.toLowerCase();                  // "p6"
  const yr     = String(year).slice(-2);               // "25"
  const fullYr = String(year);                         // "2025"
  return `https://www.sgtestpaper.com/primary/subject${fullYr}/y${yr}${lvl}maths.html`;
}

// Direct PDF URL pattern (discovered by inspection):
// https://www.sgtestpaper.com/primary/test_papers_2025/primary_6_math/
//   P6_Maths_Prelim_2025_{School}_Exam_Papers.pdf
function pdfUrl(level, year, school, paperType) {
  const fullYr  = String(year);
  const lvlNum  = level.replace("P","");               // "6"
  const typeStr = normalisePaperType(paperType);
  return `https://www.sgtestpaper.com/primary/test_papers_${fullYr}/primary_${lvlNum}_math/P${lvlNum}_Maths_${typeStr}_${fullYr}_${school}_Exam_Papers.pdf`;
}

// ---------------------------------------------------------------------------
// Extraction prompt sent to Claude for each PDF
// ---------------------------------------------------------------------------

const EXTRACTION_PROMPT = `You are extracting math exam questions from a scanned Singapore primary school exam paper (PSLE level).

For EVERY question in this paper:
1. Extract the full question text exactly as written
2. Identify the question type: "mcq" (4 options A-D), "short_answer" (fill in blank / show working), or "long_answer" (multi-step problem)
3. Note the marks allocated (look for numbers in brackets like [2] or (2m))
4. If an answer key or answers section exists, extract the answer
5. For MCQ questions, extract all 4 options (A, B, C, D)
6. Note the page number of the PDF where this question appears (1-indexed)
7. For questions that include a diagram, figure, graph, number line, or geometric shape, estimate its bounding box on the page as decimal fractions (0.0–1.0) of page width and height

IMPORTANT RULES:
- Include ALL questions — do not skip any
- For questions with diagrams/figures you cannot read, write "[Diagram: <describe what you see>]" in the text
- Preserve all numbers, units, and mathematical expressions exactly
- If marks are not shown, estimate based on question complexity (1m for MCQ, 2m for short, 4-5m for long)

Return ONLY a valid JSON object in this exact format (no markdown, no explanation):
{
  "paperTitle": "string describing the paper",
  "totalMarks": number,
  "questions": [
    {
      "id": "q1",
      "type": "mcq" | "short_answer" | "long_answer",
      "text": "full question text",
      "marks": number,
      "options": ["A. ...", "B. ...", "C. ...", "D. ..."],
      "answer": "answer if available, else empty string",
      "working": "solution steps if available, else empty string",
      "pageNumber": 1,
      "diagramBbox": {"x": 0.05, "y": 0.30, "w": 0.90, "h": 0.35}
    }
  ]
}

Notes:
- "options" only for mcq type; omit or set [] for others
- "pageNumber" is required for every question
- "diagramBbox" only for questions with a diagram/figure; omit entirely for text-only questions
- diagramBbox values are fractions of page dimensions: x/y = top-left corner, w/h = width/height`;

// ---------------------------------------------------------------------------
// Diagram support — PDF page → JPEG images via pdftoppm (poppler-utils)
// ---------------------------------------------------------------------------

function hasPdftoppm() {
  const r = spawnSync("which", ["pdftoppm"], { encoding: "utf8" });
  return r.status === 0;
}

/**
 * Converts all pages of a PDF buffer to base64 JPEG data URLs.
 * Returns an array indexed 0-based (index 0 = page 1).
 * Returns [] if conversion fails.
 * @param {Buffer} pdfBuffer
 * @param {number} dpi - render resolution (96 gives ~794×1123px for A4)
 * @returns {string[]}
 */
function pdfToPageImages(pdfBuffer, dpi = 96) {
  const tmpDir    = fs.mkdtempSync(path.join(os.tmpdir(), "psle-"));
  const pdfPath   = path.join(tmpDir, "paper.pdf");
  const imgPrefix = path.join(tmpDir, "pg");

  try {
    fs.writeFileSync(pdfPath, pdfBuffer);
    const r = spawnSync(
      "pdftoppm",
      ["-jpeg", "-r", String(dpi), pdfPath, imgPrefix],
      { encoding: "utf8" }
    );
    if (r.status !== 0) {
      log(`   ⚠️  pdftoppm failed: ${r.stderr || "(no output)"}`);
      return [];
    }
    return fs.readdirSync(tmpDir)
      .filter(f => /^pg.*\.jpg$/i.test(f))
      .sort()
      .map(f => "data:image/jpeg;base64," + fs.readFileSync(path.join(tmpDir, f)).toString("base64"));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Crops a page image to the region described by a bounding box.
 * @param {string} pageDataUrl - "data:image/jpeg;base64,..."
 * @param {{ x: number, y: number, w: number, h: number }} bbox - fractions of page dimensions
 * @returns {Promise<string>} cropped image as a data URL, or the original if crop fails
 */
async function cropDiagram(pageDataUrl, bbox) {
  try {
    const base64 = pageDataUrl.replace(/^data:image\/jpeg;base64,/, "");
    const buf    = Buffer.from(base64, "base64");
    const meta   = await sharp(buf).metadata();
    const pw     = meta.width;
    const ph     = meta.height;

    // Clamp and compute pixel coordinates
    const x = Math.max(0, Math.round(bbox.x * pw));
    const y = Math.max(0, Math.round(bbox.y * ph));
    const w = Math.min(pw - x, Math.max(1, Math.round(bbox.w * pw)));
    const h = Math.min(ph - y, Math.max(1, Math.round(bbox.h * ph)));

    const cropped = await sharp(buf)
      .extract({ left: x, top: y, width: w, height: h })
      .jpeg({ quality: 85 })
      .toBuffer();

    return "data:image/jpeg;base64," + cropped.toString("base64");
  } catch (e) {
    log(`   ⚠️  Crop failed (${e.message}), using full page`);
    return pageDataUrl;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  checkEnv();

  log(`\n📋 PSLE Worksheet Scraper`);
  log(`   Level: ${LEVEL} | Year: ${YEAR} | School: ${SCHOOL} | Type: ${TYPE}`);
  log(`   Output: ${OUT_FILE}\n`);

  // 1. Discover available papers from the listing page
  log("🔍 Fetching paper listing from sgtestpaper.com...");
  const papers = await discoverPapers(LEVEL, YEAR, SCHOOL, TYPE);

  if (papers.length === 0) {
    log("⚠️  No papers found matching your filters. Try --dry-run to see what's available.");
    process.exit(0);
  }

  log(`✅ Found ${papers.length} paper(s):\n`);
  papers.forEach((p, i) => log(`   ${i+1}. ${p.title} — ${p.pdfUrl}`));

  if (DRY_RUN) {
    log("\n(Dry run — exiting without downloading)");
    process.exit(0);
  }

  // 2. Process each paper
  const client     = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });
  const worksheets = [];

  for (let i = 0; i < papers.length; i++) {
    const paper = papers[i];
    log(`\n[${i+1}/${papers.length}] Processing: ${paper.title}`);

    try {
      const worksheet = await processPaper(client, paper);
      worksheets.push(worksheet);
      log(`   ✅ Extracted ${worksheet.questions.length} questions (${worksheet.questions.reduce((s,q)=>s+(q.marks||0),0)} marks)`);
    } catch (err) {
      log(`   ❌ Failed: ${err.message}`);
    }

    // Polite delay between API calls
    if (i < papers.length - 1) await sleep(2000);
  }

  // 3. Save output
  const output = {
    exportedAt: new Date().toISOString(),
    version:    1,
    source:     "sgtestpaper.com",
    worksheets
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));
  log(`\n✅ Done! Saved ${worksheets.length} worksheet(s) to ${OUT_FILE}`);
  log(`\n👉 To import: open your Worksheet Manager app → click "↑ Import" → select ${OUT_FILE}\n`);
}

// ---------------------------------------------------------------------------
// Discover papers from listing page
// ---------------------------------------------------------------------------

async function discoverPapers(level, year, school, type) {
  const url  = listingUrl(level, year);
  log(`   URL: ${url}`);

  let html;
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    html = await res.text();
  } catch (e) {
    // Fallback: build paper list from known URL pattern
    log(`   ⚠️  Could not fetch listing (${e.message}). Building from URL pattern...`);
    return buildPapersFromPattern(level, year, school, type);
  }

  return parsePapersFromHtml(html, level, year, school, type);
}

function parsePapersFromHtml(html, level, year, school, type) {
  const papers = [];
  // Match links like: /primary/download_2025/y25_P6_Maths_Nanyang_Prelim_test_paper.html
  const linkRe = /href="([^"]*download_\d{4}[^"]*test_paper\.html)"/gi;
  let m;

  while ((m = linkRe.exec(html)) !== null) {
    const href = m[1].startsWith("http") ? m[1]
      : "https://www.sgtestpaper.com" + (m[1].startsWith("/") ? "" : "/") + m[1];

    // Parse school and type from the URL filename
    const fname     = href.split("/").pop();
    // e.g. y25_P6_Maths_Nanyang_Prelim_test_paper.html
    const parts     = fname.replace("_test_paper.html","").split("_");
    // parts: ["y25", "P6", "Maths", "Nanyang", "Prelim"]
    const paperSchool = parts.slice(3, -1).join("_");   // "Nanyang" or "St_Nicholas"
    const paperType   = parts[parts.length - 1];         // "Prelim"

    if (school !== "ALL" && !paperSchool.toLowerCase().includes(school.toLowerCase())) continue;
    if (type   !== "ALL" && !paperType.toLowerCase().includes(type.toLowerCase()))     continue;

    const resolvedPdfUrl = buildPdfUrl(href, level, year, paperSchool, paperType);
    papers.push({
      title:    `${level} Maths ${paperType} ${year} — ${paperSchool.replace(/_/g," ")}`,
      school:   paperSchool,
      paperType,
      level,
      year,
      pageUrl:  href,
      pdfUrl:   resolvedPdfUrl
    });
  }

  // If HTML parsing found nothing, fall back to pattern
  if (papers.length === 0) return buildPapersFromPattern(level, year, school, type);
  return papers;
}

// Resolve the PDF URL from a download page (fetch the intermediate HTML page)
async function buildPdfUrl(pageUrl, level, year, school, type) {
  try {
    const res  = await fetch(pageUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await res.text();
    const pdfRe = /href="([^"]*\.pdf)"/i;
    const m     = pdfRe.exec(html);
    if (m) return m[1].startsWith("http") ? m[1] : "https://www.sgtestpaper.com" + m[1];
  } catch (_) {}
  // Fallback to guessed pattern
  return pdfUrl(level, year, school, type);
}

// Known schools for pattern-based fallback
const KNOWN_SCHOOLS = [
  "Nanyang","Raffles","Rosyth","TaoNan","ACSJ","AiTong",
  "CatholicHigh","HenryPark","MGS","NanHua","PLMGS","SCGS","StNicholas"
];
const KNOWN_TYPES = ["Prelim","WA1","WA2","WA3","SA1"];

function buildPapersFromPattern(level, year, schoolFilter, typeFilter) {
  const papers   = [];
  const schools  = schoolFilter === "ALL" ? KNOWN_SCHOOLS : [schoolFilter];
  const types    = typeFilter   === "ALL" ? KNOWN_TYPES   : [typeFilter];

  for (const s of schools) {
    for (const t of types) {
      papers.push({
        title:     `${level} Maths ${t} ${year} — ${s}`,
        school:    s,
        paperType: t,
        level,
        year,
        pageUrl:   null,
        pdfUrl:    pdfUrl(level, year, s, t)
      });
    }
  }
  return papers;
}

function normalisePaperType(type) {
  // Map "Prelim" → "Prelim", "WA1" → "WA1", etc.
  return type;
}

// ---------------------------------------------------------------------------
// Process one paper: download PDF → send to Claude → return worksheet object
// ---------------------------------------------------------------------------

async function processPaper(client, paper) {
  log(`   ⬇️  Downloading PDF...`);

  // If we have a page URL, resolve the real PDF URL first
  let finalPdfUrl = paper.pdfUrl;
  if (paper.pageUrl && typeof paper.pdfUrl !== "string") {
    finalPdfUrl = await buildPdfUrl(paper.pageUrl, paper.level, paper.year, paper.school, paper.paperType);
  }

  const pdfBuffer = await downloadFile(finalPdfUrl);
  const pdfBase64 = pdfBuffer.toString("base64");
  log(`   📄 PDF downloaded (${(pdfBuffer.length/1024).toFixed(0)} KB). Sending to Claude...`);

  // Save a copy of the original PDF for audit / reference
  const pdfFilename = paper.title
    .replace(/\s*—\s*/g, "-")   // "P6 Maths Prelim 2025 — Nanyang" → "P6 Maths Prelim 2025-Nanyang"
    .replace(/\s+/g, "-")       // spaces → hyphens
    + ".pdf";
  const papersDir = path.join(__dirname, "papers");
  if (!fs.existsSync(papersDir)) fs.mkdirSync(papersDir, { recursive: true });
  fs.writeFileSync(path.join(papersDir, pdfFilename), pdfBuffer);
  log(`   💾 Saved original PDF → papers/${pdfFilename}`);

  // Convert PDF pages to images for diagram support
  let pageImages = [];
  if (hasPdftoppm()) {
    log(`   🖼️  Converting PDF pages to images (96 DPI)...`);
    pageImages = pdfToPageImages(pdfBuffer);
    log(`   📸 ${pageImages.length} page image(s) ready`);
  } else {
    log(`   ⚠️  pdftoppm not found — diagrams will remain as text placeholders`);
    log(`       Install with: sudo apt-get install poppler-utils`);
  }

  const response = await client.messages.create({
    model:      "claude-sonnet-4-6",
    max_tokens: 16000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type:       "base64",
              media_type: "application/pdf",
              data:       pdfBase64
            }
          },
          {
            type: "text",
            text: EXTRACTION_PROMPT
          }
        ]
      }
    ]
  });

  const rawText = response.content[0].text.trim();

  // Parse JSON — strip any accidental markdown fences
  const jsonText = rawText.replace(/^```json\s*/i,"").replace(/^```\s*/,"").replace(/```\s*$/,"").trim();
  let extracted;
  try {
    extracted = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(`Claude returned invalid JSON: ${e.message}\n---\n${rawText.slice(0,300)}`);
  }

  // Map to worksheet schema
  const today = new Date().toISOString().slice(0,10);
  const id    = "ws_" + Date.now() + "_" + Math.floor(Math.random()*1000);

  return {
    id,
    title:      paper.title,
    level:      paper.level,
    strand:     "Numbers & Algebra",   // default — tutor can adjust in app
    topic:      "",                     // tutor assigns topic in app
    difficulty: "Standard",
    type:       "Exam-style",
    createdAt:  today,
    updatedAt:  today,
    version:    1,
    status:     "active",
    questions:  await Promise.all((extracted.questions || []).map(async (q, i) => {
      const mapped = {
        id:      q.id || `q${i+1}`,
        type:    q.type || "short_answer",
        text:    q.text || "",
        marks:   typeof q.marks === "number" ? q.marks : 1,
        options: q.type === "mcq" ? (q.options || []) : [],
        answer:  q.answer  || "",
        working: q.working || ""
      };

      // Attach cropped diagram image if this question has one
      const hasDiagram = /\[Diagram:/i.test(q.text || "") || q.diagramBbox;
      if (hasDiagram && pageImages.length > 0) {
        const pgIdx  = (typeof q.pageNumber === "number" ? q.pageNumber : 1) - 1;
        const pageSrc = pageImages[pgIdx];
        if (pageSrc) {
          if (q.diagramBbox && typeof q.diagramBbox.x === "number") {
            mapped.diagramImage = await cropDiagram(pageSrc, q.diagramBbox);
          } else {
            // No bbox — fall back to full page
            mapped.diagramImage = pageSrc;
          }
        }
      }

      return mapped;
    })),
    notes: `Scraped from sgtestpaper.com | ${extracted.paperTitle || paper.title} | ${paper.year}`
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function downloadFile(url) {
  return new Promise((resolve, reject) => {
    const lib     = url.startsWith("https") ? https : http;
    const chunks  = [];
    const options = {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer":    "https://www.sgtestpaper.com/"
      }
    };

    const request = lib.get(url, options, res => {
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      res.on("data", chunk => chunks.push(chunk));
      res.on("end",  ()    => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });

    request.on("error", reject);
    request.setTimeout(30000, () => {
      request.destroy();
      reject(new Error("Download timed out"));
    });
  });
}

function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      if (i + 1 < argv.length && !argv[i+1].startsWith("--")) {
        result[key] = argv[++i];
      } else {
        result[key] = true;
      }
    }
  }
  return result;
}

function checkEnv() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("\n❌ Missing ANTHROPIC_API_KEY environment variable.");
    console.error("   Set it with: export ANTHROPIC_API_KEY=sk-ant-...\n");
    process.exit(1);
  }
}

function log(msg) { console.log(msg); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

main().catch(err => {
  console.error("\n❌ Fatal error:", err.message);
  process.exit(1);
});
