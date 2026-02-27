# VittaMitra — CLAUDE.md

**VittaMitra** ("money friend") is a local-first, privacy-preserving AI-powered Indian personal tax intelligence platform for salaried professionals. It runs 100% on-device — no cloud sync, no sign-up required.

---

## Architecture

| Layer | Tech |
|---|---|
| Backend | Python 3.11+, FastAPI, Uvicorn |
| Frontend | React 18, TypeScript, Vite 5 |
| Data processing | pandas, pdfplumber, openpyxl |
| Charts | Recharts |
| LLM | OpenAI SDK (supports OpenAI / Gemini / Ollama) |
| Styling | Vanilla CSS — dark glassmorphism theme |

The app is split into two independently-running servers:
- **Backend** — FastAPI on `http://localhost:8000`
- **Frontend** — Vite dev server on `http://localhost:5173` (proxies `/api` → backend)

---

## Directory Structure

```
vittamitra/
├── backend/
│   ├── main.py                     # FastAPI app + all routes
│   ├── requirements.txt
│   ├── config/
│   │   └── tax_rules.json          # ALL tax rules (slabs, limits, cess, surcharge)
│   ├── modules/
│   │   ├── ingestion.py            # Bank statement parser (CSV / XLSX / PDF)
│   │   ├── tax_engine.py           # Old & New regime tax computation
│   │   ├── deduction_engine.py     # Section-wise deduction optimizer
│   │   └── expense_intelligence.py # Financial health, categories, lifestyle inflation
│   └── data/
│       └── sample_bank_statement.csv  # Demo dataset (₹14.4L/yr, 6 months)
├── frontend/
│   ├── src/
│   │   ├── App.tsx                 # Root shell (tabs, header, disclaimer)
│   │   ├── services/api.ts         # Typed Axios client for all endpoints
│   │   ├── hooks/useAppState.ts    # Global React state + formatters
│   │   ├── pages/
│   │   │   ├── UploadPage.tsx      # File ingestion UI
│   │   │   ├── Dashboard.tsx       # Charts & health score
│   │   │   ├── RegimeComparePage.tsx  # Old vs New regime comparison
│   │   │   ├── DeductionsPage.tsx  # Deduction meters & opportunities
│   │   │   └── ChatPage.tsx        # CA assistant chat
│   │   └── components/
│   │       └── SettingsPanel.tsx   # Slide-in panel (income, TDS, LLM keys)
│   ├── vite.config.ts              # Port 5173, proxies /api → :8000
│   └── package.json
└── tests/
    └── test_tax_engine.py
```

---

## Setup

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Frontend

```bash
cd frontend
npm install
```

---

## Running the Project

Two terminals required:

**Terminal 1 — Backend:**
```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload --port 8000
```
API docs: http://localhost:8000/docs

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```
App: http://localhost:5173

---

## Running Tests

```bash
cd backend
source .venv/bin/activate
python -m pytest ../tests/test_tax_engine.py -v
```

## Building Frontend

```bash
cd frontend
npm run build   # outputs to frontend/dist/
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/ingest` | Upload bank statement (CSV/XLSX/PDF) |
| GET | `/api/summary` | Annual income/savings/investment summary |
| GET | `/api/transactions` | All normalized & categorized transactions |
| POST | `/api/tax/compute` | Compute tax for one regime |
| POST | `/api/tax/compare` | Compare Old vs New regime |
| POST | `/api/deductions/analyze` | Deduction utilization + opportunities |
| GET | `/api/expenses/monthly` | Monthly income/expense/savings breakdown |
| GET | `/api/expenses/categories` | Expense category data |
| GET | `/api/expenses/health` | Financial health score (0–100) |
| GET | `/api/expenses/lifestyle-inflation` | Spending growth detection |
| GET | `/api/expenses/investment-gap` | Gap vs. 20% income target |
| POST | `/api/chat` | CA assistant (LLM or rule-based fallback) |

---

## Key Architectural Decisions

- **Config-driven tax rules** — `backend/config/tax_rules.json` contains all slabs, limits, rates, and transaction category keywords for FY 2024-25. Updating for a new FY requires only editing this file.
- **In-memory session store** — The global `SESSION` dict in `main.py` holds parsed transaction data; it's lost on server restart. A persistent SQLite/SQLCipher store is planned for Phase 2.
- **Modular backend** — Each concern (ingestion, tax, deductions, expenses) lives in its own module under `backend/modules/`.
- **LLM with fallback** — The chat endpoint uses LLM if an API key is configured; otherwise falls back to rule-based responses. Supports OpenAI, Gemini (via `base_url`), and Ollama.
- **Privacy-first** — No external calls except the user-configured LLM. The Vite proxy keeps all traffic local by default.

---

## UI Design System

- **Dark theme**: base `#0A0B14`, surfaces `#0F1020`
- **Brand colors**: Purple `#6C63FF` (primary), Teal `#00D4AA` (success), Red `#FF6B6B` (danger), Gold `#FFB347` (warning)
- **Glassmorphism**: `rgba(255,255,255,0.04)` + `backdrop-filter: blur(16px)`
- **Fonts**: Outfit (headings), Inter (body) — Google Fonts
- Do not introduce external component libraries; use the existing CSS design system in `frontend/src/index.css`.

---

## Environment Variables

| Variable | Purpose | Required |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI key for CA chat assistant | No (rule-based fallback) |
| `VITTAMITRA_API_KEY` | Alternative API key env var | No |

LLM keys can also be set via the in-app Settings panel (stored in `localStorage`).

---

## Sample Data

`backend/data/sample_bank_statement.csv` — 6 months of realistic transactions for a ₹14.4L/yr salaried professional. Upload via the "Documents" tab to populate the dashboard.

---

## Notes for AI Assistants

- All tax computation logic is deterministic — do not add rounding or approximations.
- The `tax_rules.json` is the single source of truth for all tax values; never hardcode slab rates or deduction limits in Python.
- The frontend uses TypeScript; keep types in sync with `src/services/api.ts` when adding new endpoints.
- Advisory disclaimer must appear on all pages and in all chat responses — do not remove it.
- This is an FY 2024-25 tool; note this clearly when handling any tax year logic.
