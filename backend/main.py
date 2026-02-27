"""
VittaMitra — FastAPI Backend
Exposes all tax engine modules as REST endpoints.
"""
import os
import io
import json
import tempfile
from pathlib import Path
from typing import Optional

import pandas as pd
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from modules.ingestion import ingest_file, compute_annual_summary
from modules.tax_engine import compute_tax, compare_regimes
from modules.deduction_engine import analyze_deductions
from modules.expense_intelligence import (
    monthly_summary,
    category_breakdown,
    detect_lifestyle_inflation,
    investment_gap,
    financial_health_score,
)
from modules.form16_parser import parse_form16
from modules.capital_gains import compute_all_capital_gains
from modules.other_income import (
    compute_interest_income,
    compute_dividend_income,
    compute_rental_income,
    compute_nri_tax_profile,
)

app = FastAPI(title="VittaMitra API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory session store (MVP) ─────────────────────────────────────────────
SESSION: dict = {
    "transactions":   [],
    "summary":        {},
    "tax_result":     {},
    "comparison":     {},
    "deductions":     {},
    # ── Tax Filing ────────────────────────────────────────────────────────────
    "form16":         {},
    "capital_gains":  {},
    "other_income":   {},
    "nri_profile":    {},
    "itr_summary":    {},
}


# ── Models ────────────────────────────────────────────────────────────────────
class TaxRequest(BaseModel):
    gross_income: float
    regime: str = "new"
    tds_paid: float = 0.0
    deductions: dict = {}


class CompareRequest(BaseModel):
    gross_income: float
    tds_paid: float = 0.0
    deductions: dict = {}


class DeductionRequest(BaseModel):
    gross_income: float
    claimed: dict = {}
    tds_paid: float = 0.0
    age: int = 30
    has_parents: bool = False
    parents_senior: bool = False
    is_metro: bool = True


class ChatRequest(BaseModel):
    message: str
    context: dict = {}
    api_key: Optional[str] = None
    model: str = "gpt-4o-mini"
    base_url: Optional[str] = None   # For Ollama or other OpenAI-compat endpoints


# ── Filing Models ──────────────────────────────────────────────────────────────
class CapitalGainEntry(BaseModel):
    asset_type: str                        # listed_equity | equity_mf | debt_mf | property | crypto_vda
    purchase_price: float
    sale_price: float
    purchase_date: str                     # YYYY-MM-DD
    sale_date: str                         # YYYY-MM-DD
    cost_of_improvement: float = 0.0
    property_acquired_pre_jul23: bool = False
    description: str = ""


class CapitalGainsRequest(BaseModel):
    entries: list[CapitalGainEntry]
    slab_rate: float = 0.30


class InterestIncomeRequest(BaseModel):
    fd_interest: float = 0.0
    savings_interest: float = 0.0
    other_interest: float = 0.0
    age: int = 30
    residential_status: str = "Resident"
    regime: str = "old"
    dtaa_country: Optional[str] = None


class DividendIncomeRequest(BaseModel):
    dividend_amount: float = 0.0
    age: int = 30
    residential_status: str = "Resident"
    dtaa_country: Optional[str] = None


class RentalIncomeRequest(BaseModel):
    annual_rent_received: float
    municipal_taxes_paid: float = 0.0
    home_loan_interest: float = 0.0
    is_self_occupied: bool = False
    pre_construction_interest: float = 0.0


class NRIProfileRequest(BaseModel):
    residential_status: str = "Resident"
    dtaa_country: Optional[str] = None
    fd_interest_nro: float = 0.0
    fd_interest_nre: float = 0.0
    dividend: float = 0.0
    gross_income: float = 0.0


class ITRSummaryRequest(BaseModel):
    regime: str = "new"
    include_capital_gains: bool = True
    include_other_income: bool = True


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    return {"status": "ok", "app": "VittaMitra"}


# ── Module A: Ingestion ───────────────────────────────────────────────────────
@app.post("/api/ingest")
async def ingest(file: UploadFile = File(...)):
    """Upload a bank statement (CSV / Excel / PDF) and return structured transactions."""
    suffix = Path(file.filename).suffix.lower()
    if suffix not in [".csv", ".xlsx", ".xls", ".pdf"]:
        raise HTTPException(400, f"Unsupported file type: {suffix}")

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        df = ingest_file(tmp_path)
        summary = compute_annual_summary(df)
        SESSION["transactions"] = df.to_dict(orient="records")
        SESSION["summary"] = summary
        return {
            "rows": len(df),
            "columns": list(df.columns),
            "transactions": _df_to_json(df),
            "summary": summary,
        }
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        os.unlink(tmp_path)


@app.get("/api/transactions")
def get_transactions():
    return SESSION.get("transactions", [])


@app.get("/api/summary")
def get_summary():
    return SESSION.get("summary", {})


# ── Module B: Tax Engine ──────────────────────────────────────────────────────
@app.post("/api/tax/compute")
def tax_compute(req: TaxRequest):
    result = compute_tax(req.gross_income, req.regime, req.deductions, req.tds_paid)
    SESSION["tax_result"] = result
    return result


@app.post("/api/tax/compare")
def tax_compare(req: CompareRequest):
    result = compare_regimes(req.gross_income, req.deductions, req.tds_paid)
    SESSION["comparison"] = result
    return result


# ── Module C: Deduction Engine ────────────────────────────────────────────────
@app.post("/api/deductions/analyze")
def deduction_analyze(req: DeductionRequest):
    result = analyze_deductions(
        req.gross_income,
        req.claimed,
        req.tds_paid,
        req.age,
        req.has_parents,
        req.parents_senior,
        req.is_metro,
    )
    SESSION["deductions"] = result
    return result


# ── Module E: Expense Intelligence ───────────────────────────────────────────
@app.get("/api/expenses/monthly")
def expenses_monthly():
    df = _get_session_df()
    monthly = monthly_summary(df)
    return monthly.to_dict(orient="records") if not monthly.empty else []


@app.get("/api/expenses/categories")
def expenses_categories():
    df = _get_session_df()
    breakdown = category_breakdown(df)
    return breakdown.to_dict(orient="records") if not breakdown.empty else []


@app.get("/api/expenses/health")
def expenses_health():
    df = _get_session_df()
    gross = SESSION.get("summary", {}).get("salary_income", 0) or 0
    return financial_health_score(df, gross)


@app.get("/api/expenses/lifestyle-inflation")
def expenses_lifestyle():
    df = _get_session_df()
    return detect_lifestyle_inflation(df)


@app.get("/api/expenses/investment-gap")
def expenses_investment_gap():
    df = _get_session_df()
    gross = SESSION.get("summary", {}).get("salary_income", 0) or 0
    return investment_gap(df, gross)


# ── Module F: Chat Assistant ──────────────────────────────────────────────────
@app.post("/api/chat")
def chat(req: ChatRequest):
    """
    Conversational CA assistant.
    Falls back to rule-based responses if no API key is configured.
    """
    # Build financial context string
    ctx_parts = []
    if SESSION.get("summary"):
        s = SESSION["summary"]
        ctx_parts.append(f"Salary income: ₹{s.get('salary_income', 0):,.0f}")
        ctx_parts.append(f"Total investments: ₹{s.get('investments', 0):,.0f}")
        ctx_parts.append(f"Savings ratio: {s.get('savings_ratio', 0):.1f}%")
    if SESSION.get("comparison"):
        c = SESSION["comparison"]
        ctx_parts.append(f"Old regime tax: ₹{c['old']['total_tax']:,.0f}")
        ctx_parts.append(f"New regime tax: ₹{c['new']['total_tax']:,.0f}")
        ctx_parts.append(f"Recommended regime: {c['recommended'].upper()}")
    if SESSION.get("deductions"):
        d = SESSION["deductions"]
        ctx_parts.append(f"Total potential saving: ₹{d.get('total_potential_saving', 0):,.0f}")
    if SESSION.get("capital_gains"):
        cg = SESSION["capital_gains"].get("summary", {})
        ctx_parts.append(f"Capital gains tax: ₹{cg.get('total_capital_gains_tax', 0):,.0f}")
    if SESSION.get("nri_profile"):
        np_ = SESSION["nri_profile"]
        ctx_parts.append(f"Residential status: {np_.get('residential_status', 'Resident')}")
    if SESSION.get("other_income"):
        oi = SESSION["other_income"]
        interest_tax = oi.get("interest", {}).get("taxable_interest", 0)
        rental_income = oi.get("rental", {}).get("net_income_from_hp", 0)
        if interest_tax:
            ctx_parts.append(f"Taxable interest income: ₹{interest_tax:,.0f}")
        if rental_income:
            ctx_parts.append(f"Net rental income: ₹{rental_income:,.0f}")

    financial_context = "\n".join(ctx_parts) if ctx_parts else "No financial data uploaded yet."

    system_prompt = f"""You are VittaMitra, an expert Indian Chartered Accountant assistant.
You provide personalised, factual Indian income tax and financial advisory.

RULES:
- Reference the correct IT Act sections (80C, 80D, HRA, 87A, etc.)
- Explain clearly in plain English
- Never advise illegal tax evasion
- Always end with: "⚠️ Advisory only. Consult a licensed CA before filing."
- Keep responses concise (≤ 200 words)

USER'S FINANCIAL SNAPSHOT:
{financial_context}
"""

    # Try LLM if API key provided
    api_key = req.api_key or os.environ.get("OPENAI_API_KEY") or os.environ.get("VITTAMITRA_API_KEY")
    if api_key:
        try:
            from openai import OpenAI
            client = OpenAI(
                api_key=api_key,
                base_url=req.base_url or "https://api.openai.com/v1",
            )
            response = client.chat.completions.create(
                model=req.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user",   "content": req.message},
                ],
                max_tokens=400,
                temperature=0.4,
            )
            return {
                "response": response.choices[0].message.content,
                "source": "llm",
            }
        except Exception as e:
            return {
                "response": _rule_based_response(req.message, SESSION),
                "source": "fallback",
                "error": str(e),
            }

    return {
        "response": _rule_based_response(req.message, SESSION),
        "source": "rule_based",
    }


# ── Module F: Form 16 Parser ──────────────────────────────────────────────────
@app.post("/api/filing/form16/parse")
async def parse_form16_upload(file: UploadFile = File(...)):
    """Upload Form 16 PDF or Excel and return parsed structured data."""
    suffix = Path(file.filename).suffix.lower()
    if suffix not in [".pdf", ".xlsx", ".xls"]:
        raise HTTPException(400, f"Unsupported Form 16 format: {suffix}. Use PDF, XLSX, or XLS.")
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    try:
        result = parse_form16(tmp_path)
        SESSION["form16"] = result
        return result
    except Exception as e:
        raise HTTPException(500, str(e))
    finally:
        os.unlink(tmp_path)


@app.get("/api/filing/form16")
def get_form16():
    return SESSION.get("form16", {})


# ── Module G: Capital Gains ───────────────────────────────────────────────────
@app.post("/api/filing/capital-gains/compute")
def compute_capital_gains(req: CapitalGainsRequest):
    """Compute full capital gains schedule from list of entries."""
    entries = [e.model_dump() for e in req.entries]
    result = compute_all_capital_gains(entries, slab_rate=req.slab_rate)
    SESSION["capital_gains"] = result
    return result


@app.get("/api/filing/capital-gains")
def get_capital_gains():
    return SESSION.get("capital_gains", {})


# ── Module H: Other Income ────────────────────────────────────────────────────
@app.post("/api/filing/income/interest")
def filing_interest_income(req: InterestIncomeRequest):
    result = compute_interest_income(
        fd_interest=req.fd_interest,
        savings_interest=req.savings_interest,
        other_interest=req.other_interest,
        age=req.age,
        residential_status=req.residential_status,
        regime=req.regime,
        dtaa_country=req.dtaa_country,
    )
    oi = SESSION.setdefault("other_income", {})
    oi["interest"] = result
    return result


@app.post("/api/filing/income/dividend")
def filing_dividend_income(req: DividendIncomeRequest):
    result = compute_dividend_income(
        dividend_amount=req.dividend_amount,
        age=req.age,
        residential_status=req.residential_status,
        dtaa_country=req.dtaa_country,
    )
    oi = SESSION.setdefault("other_income", {})
    oi["dividend"] = result
    return result


@app.post("/api/filing/income/rental")
def filing_rental_income(req: RentalIncomeRequest):
    result = compute_rental_income(
        annual_rent_received=req.annual_rent_received,
        municipal_taxes_paid=req.municipal_taxes_paid,
        home_loan_interest=req.home_loan_interest,
        is_self_occupied=req.is_self_occupied,
        pre_construction_interest=req.pre_construction_interest,
    )
    oi = SESSION.setdefault("other_income", {})
    oi["rental"] = result
    return result


@app.post("/api/filing/nri-profile")
def set_nri_profile(req: NRIProfileRequest):
    result = compute_nri_tax_profile(
        residential_status=req.residential_status,
        dtaa_country=req.dtaa_country,
        gross_income=req.gross_income,
        fd_interest_nro=req.fd_interest_nro,
        fd_interest_nre=req.fd_interest_nre,
        dividend=req.dividend,
    )
    SESSION["nri_profile"] = result
    return result


@app.get("/api/filing/nri-profile")
def get_nri_profile():
    return SESSION.get("nri_profile", {})


# ── ITR Summary Assembler ─────────────────────────────────────────────────────
@app.post("/api/filing/itr-summary")
def generate_itr_summary(req: ITRSummaryRequest):
    """Assemble ITR schedule snapshot from all session data."""
    result = _assemble_itr_summary(SESSION, req.regime)
    SESSION["itr_summary"] = result
    return result


@app.get("/api/filing/itr-summary")
def get_itr_summary():
    return SESSION.get("itr_summary", {})


# ── Helpers ───────────────────────────────────────────────────────────────────
def _assemble_itr_summary(session: dict, regime: str) -> dict:
    """Assemble all session data into an ITR-schedule snapshot."""
    form16  = session.get("form16", {})
    cg      = session.get("capital_gains", {})
    oi      = session.get("other_income", {})
    nri     = session.get("nri_profile", {})
    ded     = session.get("deductions", {})
    summary = session.get("summary", {})

    # Determine ITR form type
    has_cg  = bool(cg.get("entries"))
    is_nri  = nri.get("is_nri", False) or nri.get("is_rnor", False)
    filing_type = "ITR-2" if (has_cg or is_nri) else "ITR-1"

    # Schedule Salary
    gross_salary     = form16.get("gross_salary") or summary.get("salary_income", 0)
    std_ded          = form16.get("standard_deduction", 50000)
    professional_tax = form16.get("professional_tax", 0) or 0
    net_salary       = form16.get("net_taxable_salary") or max(0, gross_salary - std_ded - professional_tax)

    # Schedule HP
    rental = oi.get("rental", {})
    # Schedule OS
    interest = oi.get("interest", {})
    dividend = oi.get("dividend", {})
    gross_os = (
        (interest.get("taxable_interest", 0) or 0) +
        (dividend.get("taxable_dividend", 0) or 0)
    )

    # Schedule CG
    cg_summary = cg.get("summary", {})

    # Schedule VI-A
    analysis   = ded.get("analysis", {})
    ded_80c    = analysis.get("80C", {}).get("claimed", form16.get("deductions_claimed", {}).get("80C", 0))
    ded_80d    = analysis.get("80D", {}).get("claimed", form16.get("deductions_claimed", {}).get("80D", 0))
    ded_nps    = analysis.get("80CCD1B", {}).get("claimed", 0)
    ded_80tta  = analysis.get("80TTA", {}).get("claimed", 0)
    ded_80ttb  = analysis.get("80TTB", {}).get("claimed", 0)
    total_vi_a = ded_80c + ded_80d + ded_nps + ded_80tta + ded_80ttb

    # Total Income
    hp_income  = rental.get("net_income_from_hp", 0) or 0
    total_income = (
        net_salary + hp_income + gross_os +
        cg_summary.get("total_stcg_equity", 0) +
        cg_summary.get("total_ltcg_equity", 0)
    )
    if regime == "old":
        total_income -= total_vi_a

    # TDS
    tds_salary   = form16.get("tds_deducted", 0) or 0
    tds_interest = interest.get("estimated_tds_on_fd", 0) or 0
    tds_dividend = dividend.get("estimated_tds", 0) or 0
    tds_crypto   = cg_summary.get("total_tax_crypto", 0) or 0  # 30% already computed, TDS is 1% of gain
    # actual TDS on crypto from tds_applicable in entries
    tds_crypto_actual = sum(
        e.get("tds_applicable", 0) for e in cg.get("entries", []) if not e.get("is_loss")
    )
    total_tds    = tds_salary + tds_interest + tds_dividend + tds_crypto_actual

    # Tax liability (basic compute for summary)
    tax_result = session.get("comparison", {}).get(regime, session.get("tax_result", {}))
    total_tax  = tax_result.get("total_tax", 0) + cg_summary.get("total_with_cess", 0)
    net_payable = round(max(0, total_tax - total_tds), 2)
    refund      = round(max(0, total_tds - total_tax), 2)

    return {
        "assessment_year": "2025-26",
        "filing_type":     filing_type,
        "residential_status": nri.get("residential_status", "Resident"),
        "regime": regime,
        "schedule_salary": {
            "gross_salary":          gross_salary,
            "standard_deduction":    std_ded,
            "professional_tax":      professional_tax,
            "net_taxable_salary":    net_salary,
        },
        "schedule_hp": {
            "gross_annual_value":    rental.get("gross_annual_value", 0),
            "municipal_taxes":       rental.get("municipal_taxes_paid", 0),
            "net_annual_value":      rental.get("net_annual_value", 0),
            "sec24a_deduction":      rental.get("sec24a_standard_deduction", 0),
            "sec24b_deduction":      rental.get("sec24b_interest_deduction", 0),
            "income_from_hp":        hp_income,
        },
        "schedule_cg": {
            "ltcg_equity":           cg_summary.get("total_ltcg_equity", 0),
            "stcg_equity":           cg_summary.get("total_stcg_equity", 0),
            "ltcg_exemption_used":   cg_summary.get("ltcg_exemption_used", 0),
            "stcg_debt_property":    cg_summary.get("total_stcg_debt_property", 0),
            "vda_income":            cg_summary.get("total_crypto_gain", 0),
            "total_cg_tax":          cg_summary.get("total_capital_gains_tax", 0),
            "cg_cess":               cg_summary.get("cess", 0),
        },
        "schedule_os": {
            "fd_interest":           interest.get("fd_interest", 0),
            "savings_interest":      interest.get("savings_interest", 0),
            "other_interest":        interest.get("other_interest", 0),
            "dividend_income":       dividend.get("dividend_amount", 0),
            "gross_other_sources":   gross_os,
        },
        "schedule_vi_a": {
            "80C":               ded_80c,
            "80CCD1B_NPS":       ded_nps,
            "80D":               ded_80d,
            "80TTA_80TTB":       ded_80tta + ded_80ttb,
            "total_deductions":  total_vi_a,
        },
        "part_b_tti": {
            "total_income":          round(total_income, 2),
            "tax_on_total_income":   tax_result.get("base_tax", 0),
            "rebate_87a":            tax_result.get("base_tax", 0) - tax_result.get("tax_after_rebate_87a", tax_result.get("base_tax", 0)),
            "surcharge":             tax_result.get("surcharge", 0),
            "cess":                  tax_result.get("cess", 0),
            "total_tax_liability":   round(total_tax, 2),
            "tds_deducted":          total_tds,
            "net_payable":           net_payable,
            "refund":                refund,
        },
        "tds_schedule": {
            "tds_on_salary":   tds_salary,
            "tds_on_interest": tds_interest,
            "tds_on_dividend": tds_dividend,
            "tds_on_crypto":   tds_crypto_actual,
            "total_tds":       total_tds,
        },
    }


def _get_session_df() -> pd.DataFrame:
    records = SESSION.get("transactions", [])
    if not records:
        return pd.DataFrame()
    df = pd.DataFrame(records)
    df["date"] = pd.to_datetime(df["date"], errors="coerce")
    df["debit"]  = pd.to_numeric(df["debit"],  errors="coerce").fillna(0)
    df["credit"] = pd.to_numeric(df["credit"], errors="coerce").fillna(0)
    return df


def _df_to_json(df: pd.DataFrame) -> list:
    return json.loads(df.to_json(orient="records", date_format="iso"))


def _rule_based_response(msg: str, session: dict) -> str:
    msg_lower = msg.lower()
    comp = session.get("comparison", {})
    ded  = session.get("deductions", {})

    if any(k in msg_lower for k in ["old regime", "new regime", "which regime", "better regime"]):
        if comp:
            rec = comp.get("recommended", "new").upper()
            note = comp.get("recommendation_note", "")
            return f"Based on your numbers, the **{rec} REGIME** is better for you.\n\n{note}\n\n⚠️ Advisory only. Consult a licensed CA before filing."
        return "Please run the Regime Comparison first by entering your income details. ⚠️ Advisory only. Consult a licensed CA before filing."

    if any(k in msg_lower for k in ["80c", "how much more", "invest", "elss", "ppf"]):
        if ded:
            analysis = ded.get("analysis", {}).get("80C", {})
            remaining = analysis.get("remaining", 0)
            return (
                f"You have **₹{remaining:,.0f} remaining** under Sec 80C (limit: ₹1,50,000).\n\n"
                "Top options: **ELSS** (tax saving MF, 3-yr lock-in), **PPF** (15-yr, risk-free), "
                "or top up your **LIC/term premium**.\n\n"
                "⚠️ Advisory only. Consult a licensed CA before filing."
            )
        return "Upload your bank statement and enter your 80C investments to get a precise recommendation. ⚠️ Advisory only. Consult a licensed CA before filing."

    if any(k in msg_lower for k in ["overpaying", "over pay", "tds", "refund"]):
        if comp:
            better_tax = min(comp["old"]["total_tax"], comp["new"]["total_tax"])
            tds = comp["old"]["tds_paid"]
            if tds > better_tax:
                return (
                    f"Yes, you appear to have **excess TDS of ₹{tds - better_tax:,.0f}**. "
                    f"File your ITR and claim the refund. Ensure your bank account is pre-validated on the income tax portal.\n\n"
                    "⚠️ Advisory only. Consult a licensed CA before filing."
                )
        return "Enter your TDS paid and run the tax comparison to check for overpayment. ⚠️ Advisory only. Consult a licensed CA before filing."

    if any(k in msg_lower for k in ["80d", "health insurance", "medical"]):
        return (
            "Under **Sec 80D** you can deduct up to ₹25,000 for health insurance premiums (self/family) "
            "and an additional ₹25,000–₹50,000 for parents. If your parents are senior citizens (60+), the parent limit is ₹50,000.\n\n"
            "⚠️ Advisory only. Consult a licensed CA before filing."
        )

    if any(k in msg_lower for k in ["laptop", "work from home", "wfh", "computer"]):
        return (
            "For **salaried employees**, personal laptop/computer purchases are generally **not deductible** under the Old Regime "
            "unless reimbursed by your employer as a tax-exempt perk (subject to actual usage proof). "
            "Genuine business expenses may be considered only for self-employed individuals.\n\n"
            "⚠️ Advisory only. Consult a licensed CA before filing."
        )

    return (
        "I'm VittaMitra, your AI tax co-pilot! 🙏\n\n"
        "I can help you with:\n"
        "• Old vs New regime comparison\n"
        "• 80C / 80D deduction optimization\n"
        "• TDS refund checks\n"
        "• Financial health insights\n\n"
        "To get personalised advice, upload your bank statement and fill in your income details first.\n\n"
        "⚠️ Advisory only. Consult a licensed CA before filing."
    )
