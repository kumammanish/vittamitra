"""
Module E: Expense Intelligence Engine
Derives financial health metrics from tagged transaction data.
"""
import pandas as pd
from datetime import datetime


def monthly_summary(df: pd.DataFrame) -> pd.DataFrame:
    """Aggregate income and expense by month."""
    if df.empty:
        return pd.DataFrame()
    df = df.copy()
    df["month"] = df["date"].dt.to_period("M").astype(str)
    monthly = df.groupby("month").agg(
        total_income=("credit", "sum"),
        total_expense=("debit", "sum"),
    ).reset_index()
    monthly["net_savings"] = monthly["total_income"] - monthly["total_expense"]
    monthly["savings_rate"] = (
        monthly["net_savings"] / monthly["total_income"].replace(0, 1) * 100
    ).round(2)
    return monthly


def category_breakdown(df: pd.DataFrame) -> pd.DataFrame:
    """Expense breakdown by transaction category."""
    if df.empty:
        return pd.DataFrame()
    breakdown = (
        df[df["debit"] > 0]
        .groupby("category")["debit"]
        .sum()
        .reset_index()
        .rename(columns={"debit": "amount"})
        .sort_values("amount", ascending=False)
    )
    total = breakdown["amount"].sum()
    breakdown["pct"] = (breakdown["amount"] / total * 100).round(1) if total else 0
    return breakdown


def detect_lifestyle_inflation(df: pd.DataFrame) -> dict:
    """Detect if expenses are growing faster than income month-over-month."""
    monthly = monthly_summary(df)
    if len(monthly) < 3:
        return {"detected": False, "message": "Not enough data (need ≥3 months)."}

    first_half = monthly.iloc[: len(monthly) // 2]
    second_half = monthly.iloc[len(monthly) // 2 :]

    avg_expense_h1 = first_half["total_expense"].mean()
    avg_expense_h2 = second_half["total_expense"].mean()
    avg_income_h1  = first_half["total_income"].mean()
    avg_income_h2  = second_half["total_income"].mean()

    expense_growth = (avg_expense_h2 - avg_expense_h1) / (avg_expense_h1 or 1) * 100
    income_growth  = (avg_income_h2  - avg_income_h1)  / (avg_income_h1  or 1) * 100

    inflated = expense_growth > income_growth + 5  # more than 5pp gap
    return {
        "detected": inflated,
        "expense_growth_pct": round(expense_growth, 1),
        "income_growth_pct":  round(income_growth,  1),
        "message": (
            f"⚠️ Lifestyle inflation detected: expenses grew {expense_growth:.1f}% "
            f"vs income growth of {income_growth:.1f}%."
            if inflated else
            "✅ Expenses are growing in line with income."
        ),
    }


def investment_gap(
    df: pd.DataFrame,
    gross_income: float,
    target_investment_pct: float = 20.0,
) -> dict:
    """Compute gap between actual investments and the target investment ratio."""
    actual_investments = float(df[df["category"] == "investment"]["debit"].sum())
    target = gross_income * (target_investment_pct / 100)
    gap = max(0, target - actual_investments)
    ratio = round(actual_investments / gross_income * 100, 1) if gross_income else 0
    return {
        "actual_investments":   actual_investments,
        "target_investments":   target,
        "gap":                  gap,
        "investment_ratio_pct": ratio,
        "target_pct":           target_investment_pct,
        "message": (
            f"✅ You're investing {ratio:.1f}% of income — meeting the {target_investment_pct}% target."
            if gap == 0 else
            f"⚠️ Investment gap of ₹{gap:,.0f}. Increase SIP/PPF by ₹{gap/12:,.0f}/month."
        ),
    }


def predict_year_end_tax(
    df: pd.DataFrame,
    months_completed: int,
    regime: str = "new",
    deductions: dict = None,
    tds_paid: float = 0,
) -> dict:
    """Extrapolate current income/expense to predict full-year tax liability."""
    from modules.tax_engine import compute_tax  # lazy import

    if df.empty or months_completed == 0:
        return {}

    total_income = float(df["credit"].sum())
    projected_annual_income = total_income / months_completed * 12
    projected_tds = tds_paid / months_completed * 12

    result = compute_tax(
        projected_annual_income,
        regime=regime,
        deductions=deductions or {},
        tds_paid=projected_tds,
    )
    result["projected_annual_income"] = projected_annual_income
    result["months_completed"] = months_completed
    return result


def financial_health_score(df: pd.DataFrame, gross_income: float) -> dict:
    """Generate a 0–100 financial health score."""
    if df.empty:
        return {"score": 0, "grade": "N/A", "breakdown": {}}

    monthly = monthly_summary(df)
    avg_savings_rate = monthly["savings_rate"].mean() if not monthly.empty else 0
    actual_investments = float(df[df["category"] == "investment"]["debit"].sum())
    investment_ratio = actual_investments / gross_income * 100 if gross_income else 0

    # Score components (weighted)
    score_savings     = min(30, avg_savings_rate * 1.5)    # max 30 pts at 20% savings
    score_investment  = min(25, investment_ratio * 1.25)   # max 25 pts at 20% investment
    score_diversity   = min(20, len(df["category"].unique()) * 2)  # max 20 by category diversity
    score_no_idle     = 25 if investment_ratio > 5 else 10        # idle cash penalty
    total = round(score_savings + score_investment + score_diversity + score_no_idle, 0)
    grade = "A" if total >= 80 else "B" if total >= 60 else "C" if total >= 40 else "D"

    return {
        "score": total,
        "grade": grade,
        "breakdown": {
            "savings_rate_score":    score_savings,
            "investment_score":      score_investment,
            "category_diversity":    score_diversity,
            "idle_cash_score":       score_no_idle,
        },
        "avg_monthly_savings_rate": round(avg_savings_rate, 1),
        "investment_ratio": round(investment_ratio, 1),
    }
