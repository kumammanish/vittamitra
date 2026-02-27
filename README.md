# VittaMitra 🏦

> **Your privacy-first AI-powered Indian tax co-pilot.**  
> Analyses your finances, compares tax regimes, finds missed deductions, and answers your tax questions — all locally on your Mac.

![Advisory](https://img.shields.io/badge/Advisory%20Only-Not%20a%20CA%20substitute-orange)
![Local](https://img.shields.io/badge/Data-100%25%20Local-green)
![FY](https://img.shields.io/badge/FY-2024--25-blue)

---

## Features

- **📂 Bank Statement Ingestion** — CSV, Excel, PDF (auto-detects column formats)
- **⚖️ Old vs New Regime Comparison** — Side-by-side tax breakdown with recommendation
- **💡 Deduction Optimizer** — 80C, 80D, HRA, NPS gap analysis with saving estimates
- **📊 Financial Dashboard** — Cash flow charts, expense pie, health score
- **🤖 CA Chat Assistant** — Rule-based or LLM-powered (OpenAI/Gemini/Ollama)
- **🔒 100% Local** — No cloud sync, no sign-up required

---

## Quick Start

### Requirements
- Python 3.11+
- Node.js 18+

### 1. Backend

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 2. Frontend (new terminal)

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

---

## Using Sample Data

Upload `backend/data/sample_bank_statement.csv` from the **Documents** tab.  
It contains 6 months of realistic transactions for a ₹14.4L/year salaried professional.

---

## LLM Chat Setup

| Provider | API Key | Base URL | Model |
|---|---|---|---|
| OpenAI | `sk-...` | *(blank)* | `gpt-4o-mini` |
| Gemini | `AIza...` | `https://generativelanguage.googleapis.com/v1beta/openai/` | `gemini-1.5-flash` |
| Ollama (local) | `ollama` | `http://localhost:11434/v1` | `llama3.2` |

Configure in the **⚙️ Settings** panel. Chat works without a key (rule-based mode).

---

## Running Tests

```bash
cd backend && source .venv/bin/activate
pip install pytest
python -m pytest ../tests/test_tax_engine.py -v
```

---

## Updating Tax Rules

All slabs and limits are in `backend/config/tax_rules.json`.  
Edit this file for any new financial year — no code changes needed.

---

## Project Docs

| File | Purpose |
|---|---|
| [`IMPLEMENTATION.md`](./IMPLEMENTATION.md) | Full deployment & architecture guide |
| [`agents.md`](./agents.md) | AI agent prompt to regenerate this project |

---

> ⚠️ **Advisory only.** VittaMitra does not file taxes or provide legal advice. Always consult a licensed Chartered Accountant.
