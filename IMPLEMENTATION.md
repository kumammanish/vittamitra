# VittaMitra — Implementation Plan & Deployment Guide

> **VittaMitra** is a local-first, privacy-preserving AI-powered Indian tax advisor.  
> All data stays on your machine. No cloud sync. All tax rules are config-driven.

---

## Architecture Overview

```
vittamitra/
├── backend/                  # Python FastAPI server
│   ├── main.py               # FastAPI app + all API routes
│   ├── requirements.txt      # Python dependencies
│   ├── config/
│   │   └── tax_rules.json    # ALL tax slabs/rates/limits (config-driven, FY 2024-25)
│   ├── modules/
│   │   ├── ingestion.py      # Module A: CSV/Excel/PDF bank statement parser
│   │   ├── tax_engine.py     # Module B: Old & New regime tax computation
│   │   ├── deduction_engine.py # Module C: 80C/80D/HRA deduction optimizer
│   │   ├── expense_intelligence.py # Module E: Savings, health score, lifestyle checks
│   │   ├── form16_parser.py  # Module F: Form 16 PDF/Excel parser
│   │   ├── capital_gains.py  # Module G: Capital gains (all 4 types, Budget 2024)
│   │   └── other_income.py   # Module H: Interest, dividend, rental, NRI/DTAA
│   └── data/
│       └── sample_bank_statement.csv  # Demo dataset (6 months, realistic)
│
├── frontend/                 # React + Vite TypeScript UI
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts        # Proxies /api → localhost:8000
│   ├── src/
│   │   ├── App.tsx           # Tabbed shell — 7 tabs
│   │   ├── index.css         # Full design system
│   │   ├── services/api.ts   # Typed Axios client for all backend endpoints
│   │   ├── hooks/useAppState.ts  # Shared state + formatting utilities
│   │   ├── pages/
│   │   │   ├── UploadPage.tsx       # Drag & drop file ingestion
│   │   │   ├── Dashboard.tsx        # Income, expense, health score charts
│   │   │   ├── RegimeComparePage.tsx # Old vs New side-by-side
│   │   │   ├── DeductionsPage.tsx   # Section-wise meters + opportunities
│   │   │   ├── TaxFilingPage.tsx    # Form 16, interest, rental, CG, NRI
│   │   │   ├── ITRSummaryPage.tsx   # ITR schedule cards + print
│   │   │   └── ChatPage.tsx         # CA assistant chat (LLM or rule-based)
│   │   └── components/
│   │       └── SettingsPanel.tsx    # LLM, income, TDS, residential status
│
└── tests/
    ├── test_tax_engine.py    # Unit tests for tax computation engine
    └── test_capital_gains.py # Unit tests for CG, rental, NRI modules
```

---

## Prerequisites

| Requirement | Version |
|---|---|
| Python | 3.11+ |
| Node.js | 18+ |
| npm | 9+ |

---

## Fresh Installation & Setup

### 1. Clone / navigate to project

```bash
cd /Users/kumam/Documents/GitHub/vittamitra
```

### 2. Backend Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 3. Frontend Setup

```bash
cd ../frontend
npm install
```

---

## Running the App

Open **two terminals**:

**Terminal 1 — Backend**
```bash
cd /Users/kumam/Documents/GitHub/vittamitra/backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000
```

**Terminal 2 — Frontend**
```bash
cd /Users/kumam/Documents/GitHub/vittamitra/frontend
npm run dev
```

Open browser: **http://localhost:5173**

---

## Using the Sample Data

```bash
# The sample bank statement is at:
backend/data/sample_bank_statement.csv

# Upload it via the Documents tab in the UI
# It contains 6 months of realistic transactions:
# - Monthly salary (₹1.2L–₹1.3L)
# - SIP + PPF + ELSS + NPS investments
# - HDFC home loan EMI
# - Health insurance premium (80D eligible)
# - LIC premium (80C eligible)
# - Rent payments, utilities, food, travel
```

---

## Chat Assistant (LLM Configuration)

VittaMitra works **without any API key** using a rule-based fallback engine.

For full conversational AI, configure one of:

### Option A: OpenAI / Gemini (cloud)
In **Settings** tab:
- API Key: your OpenAI or Gemini API key
- Model: `gpt-4o-mini` (default) or `gemini-pro`
- Base URL: leave blank for OpenAI; for Gemini use `https://generativelanguage.googleapis.com/v1beta/openai/`

### Option B: Ollama (100% local)
```bash
# Install Ollama then pull a model
ollama pull llama3.2

# In Settings tab:
# Base URL: http://localhost:11434/v1
# API Key: ollama  (any non-empty value)
# Model: llama3.2
```

---

## Tax Rules Configuration

All tax rules live in `backend/config/tax_rules.json`.
**Edit this file** to update slabs for a new financial year — no code changes needed.

Key sections:
- `regimes.old.slabs` / `regimes.new.slabs` — income tax slabs
- `regimes.*.rebate_87a` — Section 87A rebate limits
- `surcharge` — surcharge slab rates
- `deductions` — 80C, 80D, NPS limits
- `capital_gains` — STCG/LTCG rates for all 4 asset types (Budget 2024 rates)
- `nri_rules` — DTAA country table, NRE exemption, 87A eligibility
- `other_income` — FD TDS thresholds, 80TTA/80TTB limits, rental Sec 24 config
- `transaction_tags` — keywords for auto-categorising bank transactions

---

## Running Unit Tests

```bash
cd /Users/kumam/Documents/GitHub/vittamitra/backend
source .venv/bin/activate
pip install pytest
python -m pytest ../tests/ -v
```

---

## API Reference

### Core Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ingest` | Upload bank statement (CSV/XLSX/PDF) |
| GET | `/api/summary` | Aggregated income/expense summary |
| GET | `/api/transactions` | All parsed transactions |
| POST | `/api/tax/compute` | Compute tax for a regime |
| POST | `/api/tax/compare` | Compare Old vs New regime |
| POST | `/api/deductions/analyze` | Deduction gap + opportunities |
| GET | `/api/expenses/monthly` | Monthly income vs expense |
| GET | `/api/expenses/categories` | Expense category breakdown |
| GET | `/api/expenses/health` | Financial health score (0–100) |
| POST | `/api/chat` | CA assistant (LLM or rule-based) |

### Tax Filing Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/filing/form16/parse` | Parse Form 16 PDF or Excel |
| GET | `/api/filing/form16` | Return stored Form 16 data |
| POST | `/api/filing/capital-gains/compute` | Compute all CG entries (LTCG pool) |
| GET | `/api/filing/capital-gains` | Return stored capital gains result |
| POST | `/api/filing/income/interest` | FD/savings interest + 80TTA/80TTB |
| POST | `/api/filing/income/dividend` | Dividend income + TDS |
| POST | `/api/filing/income/rental` | House property income (Sec 24) |
| POST | `/api/filing/nri-profile` | Set NRI/RNOR profile + DTAA |
| GET | `/api/filing/nri-profile` | Return stored NRI profile |
| POST | `/api/filing/itr-summary` | Assemble full ITR schedule |
| GET | `/api/filing/itr-summary` | Return stored ITR summary |

Interactive docs: **http://localhost:8000/docs**

---

## Privacy & Security

- ✅ Zero data leaves your machine
- ✅ Runs fully offline (except LLM API calls if configured)
- ✅ In-memory session storage (MVP) — no persistent DB write in v1
- ✅ Disclaimer shown on every page
- ⚠️ Do not expose port 8000 to the internet on a shared machine

---

## Tax Filing Features (Phase 1.5 — Implemented)

| Feature | Module | Route |
|---|---|---|
| Form 16 PDF/Excel parsing | `form16_parser.py` | `POST /api/filing/form16/parse` |
| Capital gains (all 4 types) | `capital_gains.py` | `POST /api/filing/capital-gains/compute` |
| FD/savings interest + 80TTA | `other_income.py` | `POST /api/filing/income/interest` |
| Dividend income + TDS | `other_income.py` | `POST /api/filing/income/dividend` |
| Rental income (Sec 24) | `other_income.py` | `POST /api/filing/income/rental` |
| NRI / RNOR / DTAA profile | `other_income.py` | `POST /api/filing/nri-profile` |
| ITR schedule assembly | `main.py` helper | `POST /api/filing/itr-summary` |

Key edge cases handled:
- ₹1.25L LTCG exemption is a shared pool across all equity LTCG in the FY
- Crypto losses: `carry_forward_eligible = False`
- Property pre-Jul 23 2024: both computation paths shown (advisory only)
- NRI: 87A rebate not applied; RNOR: rebate applies
- 80TTB (senior ₹50K) replaces 80TTA (₹10K) for age ≥ 60 — never both

## Extending for Phase 2

| Feature | Where to add |
|---|---|
| GST advisory | New module: `modules/gst.py` |
| Historical ITR analysis | `modules/historical.py` (stub exists) |
| Persistent encrypted DB | Add `sqlcipher3`, update `storage/db.py` |
| New FY tax slabs | Edit `config/tax_rules.json` only |
| React Native / Tauri desktop | Replace Vite dev server with Tauri shell |
| AIS / 26AS reconciliation | New module: `modules/ais_reconciler.py` |

---

*Last updated: FY 2024-25 · VittaMitra v1.5 — Tax Filing + ITR Summary*
