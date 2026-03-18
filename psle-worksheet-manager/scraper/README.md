# PSLE Paper Scraper

Downloads past-year Maths papers from sgtestpaper.com, extracts all questions using Claude AI (handles scanned PDFs), and produces a JSON file you import directly into the Worksheet Manager app.

## Setup (one-time)

```bash
cd scraper/
# Dependencies are already installed (node_modules present)
# Set your Anthropic API key:
export ANTHROPIC_API_KEY=sk-ant-...
```

## Usage

```bash
# Scrape all P6 Prelim 2025 papers (13 top schools)
node scrape-papers.js --level P6 --year 2025 --type Prelim

# Single school only
node scrape-papers.js --level P6 --year 2025 --school Nanyang --type Prelim

# Different level/year
node scrape-papers.js --level P5 --year 2024 --type Prelim

# All paper types for a school
node scrape-papers.js --level P6 --year 2025 --school Raffles --type ALL

# See what would be scraped without running (no API call, no cost)
node scrape-papers.js --level P6 --year 2025 --dry-run

# Custom output filename
node scrape-papers.js --level P6 --year 2025 --out p6-prelim-2025.json
```

## Options

| Option | Values | Default |
|--------|--------|---------|
| `--level` | P1 P2 P3 P4 P5 P6 | P6 |
| `--year` | 2025 2024 2023 ... | 2025 |
| `--school` | Nanyang Raffles Rosyth TaoNan ACSJ AiTong CatholicHigh HenryPark MGS NanHua PLMGS SCGS StNicholas ALL | ALL |
| `--type` | Prelim WA1 WA2 WA3 SA1 ALL | Prelim |
| `--out` | any filename | papers-output.json |
| `--dry-run` | flag | off |

## Importing into the app

1. Run the scraper — it creates `papers-output.json` in the `scraper/` folder
2. Open `index.html` in Chrome
3. Click **↑ Import** in the top toolbar
4. Select `papers-output.json`
5. All worksheets appear in the Library

## After importing

Each imported paper becomes a worksheet with:
- Title, level, school, year pre-filled
- All questions extracted with marks
- Type set to "Exam-style"
- **Strand and Topic blank** — assign these in the app (Edit button) so filters work

## Cost estimate

Each paper page costs ~$0.01–0.03 via Claude API (vision on scanned PDF).
13 Prelim papers ≈ $0.15–$0.40 total.

## Known schools available

| School | Code used |
|--------|-----------|
| Nanyang Primary | Nanyang |
| Raffles Girls' Primary | Raffles |
| Rosyth School | Rosyth |
| Tao Nan School | TaoNan |
| ACS (Junior) | ACSJ |
| Ai Tong School | AiTong |
| Catholic High | CatholicHigh |
| Henry Park Primary | HenryPark |
| Methodist Girls' School | MGS |
| Nan Hua Primary | NanHua |
| PLMGS | PLMGS |
| SCGS | SCGS |
| St Nicholas Girls' | StNicholas |
