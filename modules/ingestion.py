"""
Module A: Financial Document Ingestion Engine
Supports CSV, Excel, and PDF bank statements.
Normalizes transactions and auto-tags them using config-driven keywords.
"""
import json
import re
from pathlib import Path
from datetime import datetime

import pandas as pd
import pdfplumber

CONFIG_PATH = Path(__file__).parent.parent / "config" / "tax_rules.json"

def load_tag_rules() -> dict:
    with open(CONFIG_PATH) as f:
        return json.load(f)["transaction_tags"]


def parse_csv(file_path: str) -> pd.DataFrame:
    """Parse a bank statement CSV file."""
    df = pd.read_csv(file_path)
    return _normalize(df)


def parse_excel(file_path: str) -> pd.DataFrame:
    """Parse a bank statement Excel file."""
    df = pd.read_excel(file_path)
    return _normalize(df)


def parse_pdf(file_path: str) -> pd.DataFrame:
    """Extract tabular data from a bank statement PDF using pdfplumber."""
    rows = []
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                for row in table:
                    if row and len(row) >= 4:
                        rows.append(row)
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows[1:], columns=rows[0] if rows else [])
    return _normalize(df)


def _normalize(df: pd.DataFrame) -> pd.DataFrame:
    """
    Normalize a raw DataFrame into the standard schema:
    date | description | debit | credit | balance | category
    """
    df.columns = [_clean_col(c) for c in df.columns]

    # Try to find canonical column names
    col_map = {}
    for col in df.columns:
        lc = col.lower()
        if any(k in lc for k in ["date", "txn date", "value date", "transaction date"]):
            col_map["date"] = col
        elif any(k in lc for k in ["narration", "description", "particulars", "remarks", "details"]):
            col_map["description"] = col
        elif any(k in lc for k in ["debit", "withdrawal", "dr"]):
            col_map["debit"] = col
        elif any(k in lc for k in ["credit", "deposit", "cr"]):
            col_map["credit"] = col
        elif any(k in lc for k in ["balance", "closing balance"]):
            col_map["balance"] = col

    # Rename found columns
    df = df.rename(columns={v: k for k, v in col_map.items()})

    # Ensure all required columns exist
    for c in ["date", "description", "debit", "credit", "balance"]:
        if c not in df.columns:
            df[c] = 0 if c in ["debit", "credit", "balance"] else ""

    # Type coercions
    df["date"] = pd.to_datetime(df["date"], dayfirst=True, errors="coerce")
    df["debit"]  = pd.to_numeric(df["debit"].astype(str).str.replace(",", ""), errors="coerce").fillna(0)
    df["credit"] = pd.to_numeric(df["credit"].astype(str).str.replace(",", ""), errors="coerce").fillna(0)
    df["balance"] = pd.to_numeric(df["balance"].astype(str).str.replace(",", ""), errors="coerce").fillna(0)
    df["description"] = df["description"].astype(str).str.strip()

    # Drop empty rows
    df = df.dropna(subset=["date"])
    df = df.reset_index(drop=True)

    # Auto-tag
    df["category"] = df["description"].apply(_tag_transaction)

    return df[["date", "description", "debit", "credit", "balance", "category"]]


def _clean_col(col) -> str:
    if col is None:
        return "unknown"
    return str(col).strip().lower().replace(" ", "_")


def _tag_transaction(description: str) -> str:
    """Tag a transaction description using config-driven keyword rules."""
    tag_rules = load_tag_rules()
    desc_lower = description.lower()
    for category, keywords in tag_rules.items():
        for kw in keywords:
            if kw in desc_lower:
                return category
    return "other"


def ingest_file(file_path: str) -> pd.DataFrame:
    """Auto-detect format and ingest a financial document."""
    ext = Path(file_path).suffix.lower()
    if ext == ".csv":
        return parse_csv(file_path)
    elif ext in [".xlsx", ".xls"]:
        return parse_excel(file_path)
    elif ext == ".pdf":
        return parse_pdf(file_path)
    else:
        raise ValueError(f"Unsupported file type: {ext}")


def compute_annual_summary(df: pd.DataFrame) -> dict:
    """Compute annual income, expense, investment totals from tagged transactions."""
    if df.empty:
        return {}
    summary = {
        "total_credits": float(df["credit"].sum()),
        "total_debits":  float(df["debit"].sum()),
        "salary_income": float(df[df["category"] == "salary"]["credit"].sum()),
        "rent_paid":     float(df[df["category"] == "rent"]["debit"].sum()),
        "emi_paid":      float(df[df["category"] == "emi"]["debit"].sum()),
        "insurance_paid":float(df[df["category"] == "insurance"]["debit"].sum()),
        "investments":   float(df[df["category"] == "investment"]["debit"].sum()),
        "savings_ratio": 0.0,
        "monthly_avg_expense": 0.0,
    }
    if summary["total_credits"] > 0:
        summary["savings_ratio"] = round(
            (summary["total_credits"] - summary["total_debits"]) / summary["total_credits"] * 100, 2
        )
    months = df["date"].dt.to_period("M").nunique() or 1
    summary["monthly_avg_expense"] = round(summary["total_debits"] / months, 2)
    return summary
