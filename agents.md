# VittaMitra — AI Agent Requirements Prompt

> Feed the contents of this file directly to any capable AI coding agent (e.g., Antigravity, Claude, GPT-4o, Gemini) to regenerate the full VittaMitra platform from scratch.

---

## Prompt

Build a **local-first, AI-powered Indian personal tax intelligence platform** called **VittaMitra** (Sanskrit: "money friend"). It is a privacy-first tax co-pilot for Indian salaried individuals.

### Core Philosophy
- 100% local execution on macOS. No cloud sync, no data leaves the machine.
- Advisory only. Always show: *"Advisory only. Consult a licensed CA before filing."*
- Config-driven tax rules — never hardcode slabs, limits, or rates.
- Modular, extensible architecture.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11+, FastAPI, Uvicorn |
| Frontend | React 18, TypeScript, Vite 5 |
| Charts | Recharts |
| HTTP Client | Axios |
| Icons | Lucide React |
| File Upload | react-dropzone |
| PDF Parsing | pdfplumber |
| Data | pandas, openpyxl |
| LLM Chat | openai SDK (supports OpenAI / Gemini / Ollama) |
| Styling | Vanilla CSS (dark mode, glassmorphism, Inter + Outfit fonts) |
| DB | In-memory session (MVP); SQLite for Phase 2 |

---

## Project Structure

```
vittamitra/
├── IMPLEMENTATION.md          # Fresh deployment guide (always up to date)
├── agents.md                  # This file — AI agent re-generation prompt
├── backend/
│   ├── main.py                # FastAPI app with all API routes
│   ├── requirements.txt
│   ├── config/
│   │   └── tax_rules.json     # ALL tax rules (FY 2024-25)
│   ├── modules/
│   │   ├── ingestion.py       # Module A: Bank statement parser
│   │   ├── tax_engine.py      # Module B: Tax computation engine
│   │   ├── deduction_engine.py # Module C: Deduction optimizer
│   │   ├── expense_intelligence.py # Module E: Expense analytics
│   │   ├── form16_parser.py   # Module F: Form 16/16A PDF+Excel parser
│   │   ├── capital_gains.py   # Module G: Capital gains (all 4 types, Budget 2024)
│   │   └── other_income.py    # Module H: Interest, dividend, rental, NRI/DTAA
│   └── data/
│       └── sample_bank_statement.csv
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.ts          # Proxies /api → localhost:8000
    ├── tsconfig.json
    └── src/
        ├── App.tsx             # Tabbed shell (7 tabs)
        ├── index.css           # Full design system
        ├── main.tsx
        ├── services/api.ts     # Typed Axios client
        ├── hooks/useAppState.ts
        ├── pages/
        │   ├── UploadPage.tsx
        │   ├── Dashboard.tsx
        │   ├── RegimeComparePage.tsx
        │   ├── DeductionsPage.tsx
        │   ├── TaxFilingPage.tsx   # Form 16, interest, rental, CG, NRI — 5 sub-tabs
        │   ├── ITRSummaryPage.tsx  # ITR schedule cards, print, clipboard copy
        │   └── ChatPage.tsx
        └── components/
            └── SettingsPanel.tsx
```

---

## Unit Tests

```
tests/
├── test_tax_engine.py       # Old/new regime, rebate, surcharge, 80C
└── test_capital_gains.py    # CG classification, exemption pool, crypto, rental
```

---

## Backend: API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/ingest` | Upload bank statement (CSV/XLSX/PDF) |
| GET | `/api/summary` | Aggregated annual summary |
| GET | `/api/transactions` | All normalized transactions |
| POST | `/api/tax/compute` | Compute tax for one regime |
| POST | `/api/tax/compare` | Compare Old vs New regime |
| POST | `/api/deductions/analyze` | Deduction gap + opportunities |
| GET | `/api/expenses/monthly` | Monthly income vs expense |
| GET | `/api/expenses/categories` | Pie chart category data |
| GET | `/api/expenses/health` | Financial health score 0–100 |
| GET | `/api/expenses/lifestyle-inflation` | Lifestyle inflation detection |
| POST | `/api/chat` | LLM or rule-based CA assistant |
| POST | `/api/filing/form16/parse` | Parse uploaded Form 16 PDF/Excel |
| GET | `/api/filing/form16` | Return stored Form 16 data |
| POST | `/api/filing/capital-gains/compute` | Compute all CG entries (shared LTCG pool) |
| GET | `/api/filing/capital-gains` | Return stored capital gains result |
| POST | `/api/filing/income/interest` | Compute FD/savings interest + 80TTA/80TTB |
| POST | `/api/filing/income/dividend` | Compute dividend income + TDS |
| POST | `/api/filing/income/rental` | Compute house property income (Sec 24) |
| POST | `/api/filing/nri-profile` | Set NRI/RNOR profile + DTAA country |
| GET | `/api/filing/nri-profile` | Return stored NRI profile |
| POST | `/api/filing/itr-summary` | Assemble all schedules into ITR summary |
| GET | `/api/filing/itr-summary` | Return stored ITR summary |

---

## Module A: Document Ingestion (`ingestion.py`)

- Accept CSV, XLSX, PDF bank statements
- Auto-detect column names: date, description, debit, credit, balance
- Auto-tag transactions using keyword lists from `tax_rules.json`:
  - salary, rent, emi, insurance, investment, utilities, food, travel, shopping, transfer, medical, tax
- Return normalized DataFrame
- Compute annual summary: salary income, total credits/debits, savings ratio, investments

---

## Module B: Tax Computation Engine (`tax_engine.py`)

Load **all** slabs from `config/tax_rules.json`. Never hardcode.

### FY 2024-25 Rules
**Old Regime slabs:** 0%, 5% (2.5L–5L), 20% (5L–10L), 30% (>10L)  
**New Regime slabs:** 0% (≤3L), 5% (3-6L), 10% (6-9L), 15% (9-12L), 20% (12-15L), 30% (>15L)  
**Standard deduction:** ₹50,000 (Old), ₹75,000 (New)  
**Rebate 87A:** Old: ≤₹5L income → ₹12,500 rebate; New: ≤₹7L → ₹25,000  
**Surcharge:** 10% (>50L), 15% (>1Cr), 25% (>2Cr), 37% (>5Cr)  
**Cess:** 4% on (tax + surcharge)

Functions needed:
- `compute_tax(gross_income, regime, deductions, tds_paid) → dict`
- `compare_regimes(gross_income, deductions, tds_paid) → dict`

---

## Module C: Deduction Optimizer (`deduction_engine.py`)

Sections to analyze:
- **80C**: Limit ₹1,50,000 (PPF, ELSS, LIC, PF, tuition)
- **80CCD(1B)**: Limit ₹50,000 (NPS extra)
- **80D**: ₹25,000 self/family + ₹25,000–₹50,000 parents (senior: ₹50,000)
- **HRA**: Metro/non-metro based
- **Home Loan Interest (24b)**: Limit ₹2,00,000
- **Regime Mismatch**: Flag if wrong regime selected

For each section output: `claimed`, `limit`, `remaining`, `utilized_pct`, `saving_estimate`, `risk_level` (Low/Medium/High)

Sort opportunities by saving_estimate descending.

---

## Module F: Form 16 Parser (`form16_parser.py`)

- Auto-detects PDF vs Excel (`.xls`/`.xlsx`) from file extension
- **PDF path**: uses `pdfplumber` text extraction + labeled regex patterns
- **Excel path**: `pd.read_excel(header=None)` → row-by-row label scan
- Extracts: `gross_salary`, `standard_deduction`, `tds_deducted`, `tds_deposited`, `net_taxable_salary`, `professional_tax`, `hra_exemption`, `80c_deduction`, `employer_name`, `employer_tan`, `employee_pan`, `assessment_year`
- Returns `parse_confidence: "high" | "medium" | "low"` and `notes[]`
- Scanned PDFs (empty text) → `parse_confidence = "low"` + advisory note

---

## Module G: Capital Gains Engine (`capital_gains.py`)

All Budget 2024 changes included.

**Asset types**: `listed_equity`, `equity_mf`, `debt_mf`, `property`, `crypto_vda`

**Functions**:
- `classify_gain(asset_type, purchase_date, sale_date)` → `"stcg" | "ltcg"`
  - equity/equity_mf: ≥12 months = LTCG; debt_mf = always STCG (slab)
  - property: ≥24 months = LTCG; crypto = special (30% flat, not STCG/LTCG)
- `compute_single_cg(...)` → per-transaction dict with `gain_type`, `gross_gain`, `exemption_applied`, `taxable_gain`, `tax_rate`, `tax_amount`, `notes[]`
  - Property LTCG pre-Jul 23 2024: returns both Option A (12.5% no indexation) and Option B (20% + CII note) — advisory, not auto-selected
- `compute_all_capital_gains(entries, slab_rate, cess_rate)` → aggregated summary
  - ₹1.25L LTCG exemption applied as a **shared pool** across all equity+equity_mf LTCG entries
  - Crypto losses: `carry_forward_eligible = False` (not eligible per IT Act)
  - Returns: `summary{total_stcg_equity, total_ltcg_equity, ltcg_exemption_used, ltcg_exemption_remaining, total_crypto_gain, total_capital_gains_tax, cess, total_with_cess}`, `schedule_cg_notes[]`, `loss_entries[]`

---

## Module H: Other Income & NRI (`other_income.py`)

**`compute_interest_income(fd_interest, savings_interest, other_interest, age, residential_status, regime, dtaa_country)`**
- 80TTA: savings interest deduction ≤₹10K (non-senior, old regime only)
- 80TTB: FD+savings+other ≤₹50K for age ≥ 60 (replaces 80TTA entirely)
- NRI: NRE account interest exempt; NRO taxable; TDS 30% (or DTAA rate)

**`compute_dividend_income(dividend_amount, age, residential_status, dtaa_country)`**
- Fully taxable at slab rate (DDT removed FY 2020-21)
- TDS: 10% above ₹5,000 (resident); 20% for NRI (or DTAA rate)

**`compute_rental_income(annual_rent_received, municipal_taxes_paid, home_loan_interest, is_self_occupied)`**
- `NAV = GAV - municipal_taxes`
- Sec 24(a) = 30% of NAV (let-out only)
- Sec 24(b) = min(interest, ₹2L) if self-occupied; uncapped if let-out
- HP loss set off against salary up to ₹2L

**`compute_nri_tax_profile(residential_status, dtaa_country, ...)`**
- NRI: no 87A rebate; RNOR: rebate applies
- DTAA lookup from `tax_rules.json → nri_rules.dtaa_countries`
- Supported countries: USA, UK, UAE (no DTAA), Singapore, Australia, Canada, Germany, Netherlands

---

## Module E: Expense Intelligence (`expense_intelligence.py`)

- Monthly income/expense/savings DataFrame
- Category pie chart data
- Financial health score 0–100 (savings rate, investment ratio, diversity)
- Lifestyle inflation detection (compare first half vs second half expense growth)
- Investment gap (vs 20% target)

---

## `config/tax_rules.json`

Must contain:
```json
{
  "fy": "2024-25",
  "standard_deduction": 50000,
  "standard_deduction_new_regime": 75000,
  "cess_rate": 0.04,
  "regimes": { "old": {...}, "new": {...} },
  "surcharge": [...],
  "deductions": { "80C": {...}, "80CCD1B": {...}, "80D": {...}, ... },
  "capital_gains": {
    "listed_equity_stcg":  { "rate": 0.20, "holding_months": 12 },
    "listed_equity_ltcg":  { "rate": 0.10, "holding_months": 12, "exemption_limit": 125000 },
    "equity_mf_stcg":      { "rate": 0.20, "holding_months": 12 },
    "equity_mf_ltcg":      { "rate": 0.10, "holding_months": 12, "exemption_limit": 125000 },
    "debt_mf":             { "rate": "slab", "holding_months": null },
    "property_stcg":       { "rate": "slab", "holding_months": 24 },
    "property_ltcg":       { "rate": 0.125, "holding_months": 24, "pre_jul23_rate": 0.20 },
    "crypto_vda":          { "rate": 0.30, "tds_rate": 0.01, "no_setoff": true }
  },
  "nri_rules": {
    "residential_statuses": ["Resident", "RNOR", "NRI"],
    "nri_no_87a_rebate": true,
    "nre_interest_exempt": true,
    "dtaa_countries": [
      { "code": "USA", "name": "United States", "fd_interest_rate": 0.15, "dividend_rate": 0.15 },
      ...8 countries total...
    ]
  },
  "other_income": {
    "fd_interest":      { "tds_threshold": 40000, "senior_tds_threshold": 50000 },
    "savings_interest": { "80tta_limit": 10000 },
    "fd_80ttb_senior":  { "80ttb_limit": 50000 },
    "dividend":         { "tds_threshold": 5000 },
    "rental":           { "standard_deduction_pct": 0.30, "sec24b_self_occupied_limit": 200000 }
  },
  "transaction_tags": { "salary": [...], "rent": [...], ... }
}
```

---

## Frontend Design System (`index.css`)

- **Dark background**: `#0A0B14` (base), `#0F1020` (surface)
- **Brand**: `#6C63FF` (purple), `#00D4AA` (teal/success), `#FF6B6B` (red/danger), `#FFB347` (gold/warning)
- **Glassmorphism cards**: `rgba(255,255,255,0.04)` background, `backdrop-filter: blur(16px)`
- **Fonts**: Outfit (headings, 700–800) + Inter (body) from Google Fonts
- **Radial gradient mesh background** (fixed, brand purple + teal)
- **Animations**: `fadeUp` on page load
- **Components**: `.card`, `.glass`, `.btn`, `.btn-primary` (gradient), `.badge`, `.progress-track/.progress-fill`, `.disclaimer`

---

## Frontend Pages

### `App.tsx`
- Sticky header with VittaMitra logo (gradient ₹ icon)
- 7 Tab navigation: Documents · Dashboard · Regime Compare · Deductions · **Tax Filing** · **ITR Summary** · Tax Advisor
- Tab nav has `overflow-x: auto; white-space: nowrap` to handle 7 tabs on smaller screens
- Yellow disclaimer banner on every page (advisory + local-only badge)
- Settings panel (slide-in) for: income, TDS, LLM API key, model, base URL

### `UploadPage.tsx`
- `react-dropzone` area (drag + click)
- Accepts: CSV, XLSX, XLS, PDF
- Shows loading spinner, then success card with salary/expense/savings stats
- CSV format guide below

### `Dashboard.tsx`
- 4 stat cards: Salary, Total Expense, Savings Rate, Investments
- Circular financial health score (conic-gradient ring)
- Monthly cash flow area chart (Recharts, income green + expense red)
- Expense category donut chart
- Monthly net savings bar chart (green positive, red negative)

### `RegimeComparePage.tsx`
- Inline income + deduction inputs (no separate settings page needed)
- Run button → calls `/api/tax/compare`
- Recommendation banner (which regime saves more + amount + reasoning)
- Side-by-side Old vs New breakdown cards (each shows slab tax, rebate, surcharge, cess, net payable)
- Bar chart comparing total tax of both regimes

### `DeductionsPage.tsx`
- Section-wise progress meters (80C, 80CCD1B, 80D, Home Loan)
- Total potential saving banner (green, prominent)
- Opportunity cards: section tag, title, description, saving estimate, risk badge

### `ChatPage.tsx`
- Full-height chat interface (dark bubble style)
- User messages right-aligned (purple gradient)
- Assistant messages left-aligned (glassmorphism card)
- Input bar at bottom with send button
- Suggested questions (clickable chips)
- Connects to `/api/chat` (rule-based if no API key)

### `TaxFilingPage.tsx`
- 5 internal pill sub-tabs: Form 16 · Interest & Dividends · Rental Income · Capital Gains · NRI
- **Form 16**: react-dropzone upload; parse confidence badge; "Use this data →" auto-fills grossIncome+TDS
- **Interest & Dividends**: FD/savings/dividend inputs; shows 80TTA/80TTB applied; estimated TDS
- **Rental Income**: Rent/municipal taxes/loan interest + self-occupied toggle; waterfall computation (GAV→NAV→Sec24a→Sec24b→Net HP); green loss indicator
- **Capital Gains**: Add-transaction form (asset type, dates, prices); entries table; CG tax summary; property pre-Jul23 shows Option A + Option B
- **NRI**: Resident/RNOR/NRI select; DTAA country select (NRI only); NRO/NRE FD inputs; DTAA rates card

### `ITRSummaryPage.tsx`
- Status chips showing which sections are populated (Form 16 ✓, CG ✗, etc.)
- "Generate / Refresh ITR Summary" button → POST `/api/filing/itr-summary`
- Collapsible `.card` schedule cards with "📋 Copy" (clipboard) button per card
- Schedules rendered: Schedule S (Salary) · Schedule HP · Schedule CG · Schedule OS · Schedule VI-A · Part B-TTI · TDS Schedule
- Print button (`window.print()`) — nav/footer hidden in `@media print`

### `SettingsPanel.tsx`
- Slide-in overlay from right
- Fields: Gross Income, TDS, Age, Metro City checkbox, Has Parents checkbox, **Parents are Senior Citizens checkbox**
- **Residential Status select**: Resident / RNOR / NRI
- **DTAA Country select**: shown only when NRI — 8 countries
- LLM section: API Key, Model (gpt-4o-mini default), Base URL (for Ollama)

---

## Sample Bank Statement (`data/sample_bank_statement.csv`)

6 months (Apr–Sep 2024) with:
- Monthly salary credits (₹1.2L–₹1.3L/month, escalating)
- SIP investments each month
- PPF + NPS + ELSS deposits (80C/80CCD eligible)
- HDFC home loan EMI (₹18,000/month)
- LIC + Star Health insurance premiums (80C/80D eligible)
- House rent payments (₹22,000/month)
- Daily expenses: food, travel, utilities, shopping

---

## Unit Tests

### `tests/test_tax_engine.py`
Test cases for `compute_tax` and `compare_regimes`:
- ₹5L income: zero tax after rebate (both regimes)
- ₹10L income: old vs new regime amounts
- ₹15L income: regime comparison + 80C impact
- ₹25L income: surcharge kicks in on old regime
- Standard deduction applied correctly
- 80C capped at ₹1.5L
- compare_regimes returns both values + recommended key

### `tests/test_capital_gains.py`
Test cases for Modules G and H:
- Equity 12+ months → LTCG at 10%; exemption applied
- Equity 11 months → STCG at 20%
- Two LTCG entries → shared ₹1.25L pool correctly allocated
- Crypto loss → `carry_forward_eligible = False`
- Property LTCG → both pre/post Jul23 option paths returned
- Rental self-occupied → Sec24b capped at ₹2L; HP loss = ₹2L
- Rental let-out → Sec24b uncapped; 30% Sec24a applied
- NRI profile → rebate_87a_eligible = False; DTAA rates loaded from config

---

## Running Locally

```bash
# Backend
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (new terminal)
cd frontend && npm install && npm run dev
# → http://localhost:5173
```

---

## LLM Chat Configuration

- If no API key → use rule-based keyword matching fallback
- System prompt includes user's financial context (regime, deductions, savings)
- Supports: OpenAI, Gemini (`base_url` override), Ollama (`base_url: http://localhost:11434/v1`)
- Always append disclaimer to every response

---

## Reference Repos & Prior Art

Use these as inspiration for patterns, parsing tricks, and UI ideas — adapt to fit VittaMitra's architecture.

| Repo | Relevant For |
|---|---|
| [SrujanPR/Simplify-Tax](https://github.com/SrujanPR/Simplify-Tax) | Module B tax calc logic, Module C regime optimizer, transaction classification |
| [NitinReddy-A/IncomeTAXGPT](https://github.com/NitinReddy-A/IncomeTAXGPT) | Module F: CA persona, LLM prompt templates, vector search over tax knowledge |
| [SayadPervez/IITAT](https://github.com/SayadPervez/IITAT) | Module E: analytics/visualization patterns for dashboard charts |
| [MalayPalace/Bank-Statement-Utility](https://github.com/MalayPalace/Bank-Statement-Utility) | Module A: CSV/XLS bank statement normalization and ingestion |
| [githubhosting/HDFC-Statement-Analyser](https://github.com/githubhosting/HDFC-Statement-Analyser) | Module A: HDFC-specific PDF/XLS parsing tricks; Streamlit UI patterns |
| [madrecha/portal](https://github.com/madrecha/portal) | Phase 2: AIS/26AS reconciliation, automated government data source lookups |
| [anirudhbagri/Simple-Income-Tax-Calculator-India](https://github.com/anirudhbagri/Simple-Income-Tax-Calculator-India) | Module B/C: slab logic reference, regime comparison UI |
| TaxMate (Medium article) | Architecture patterns, UX pitfalls, prompt engineering for Indian tax domain |
| tax-ease / taxmitra_chatbot / EasyTax | Chatbot UI patterns, tax suggestion flows, lightweight calculator components |

---

## Constraints (Must Follow)

- Never auto-file taxes
- Never scrape government portals
- Never claim legal certification
- No cloud sync of any user data
- Show advisory disclaimer on every page/chat response
