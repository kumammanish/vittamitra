"""
Module C: Deduction & Optimization Engine
Evaluates eligibility under Indian Income Tax deduction sections,
identifies unused capacity, and generates tailored recommendations.
"""
import json
from pathlib import Path

CONFIG_PATH = Path(__file__).parent.parent / "config" / "tax_rules.json"


def _load_config() -> dict:
    with open(CONFIG_PATH) as f:
        return json.load(f)


def _tax_rate_on_marginal(taxable_income: float) -> float:
    """Approximate marginal tax rate for saving estimation (Old Regime)."""
    if taxable_income <= 250000:
        return 0.0
    elif taxable_income <= 500000:
        return 0.05
    elif taxable_income <= 1000000:
        return 0.20
    else:
        return 0.30


def analyze_deductions(
    gross_income: float,
    claimed: dict,
    tds_paid: float = 0,
    age: int = 30,
    has_parents: bool = False,
    parents_senior: bool = False,
    is_metro: bool = True,
) -> dict:
    """
    Analyze deduction utilization and generate opportunities.

    Parameters
    ----------
    gross_income : float  – Gross annual income
    claimed      : dict   – {section: amount_claimed_by_user}
    tds_paid     : float  – TDS already deducted
    age          : int    – User age (for 80D senior limits)
    has_parents  : bool   – Whether user has parent dependency
    parents_senior: bool  – Whether parents are senior citizen (60+)
    is_metro     : bool   – Metro city for HRA

    Returns
    -------
    dict with per-section analysis and list of opportunities
    """
    cfg = _load_config()
    deductions_cfg = cfg["deductions"]
    opportunities = []
    analysis = {}

    # Approximate taxable income for saving estimation
    std_ded = cfg["standard_deduction"]
    total_claimed = sum(claimed.values())
    taxable_approx = max(0, gross_income - std_ded - total_claimed)
    marginal_rate = _tax_rate_on_marginal(taxable_approx)
    cess_factor = 1 + cfg["cess_rate"]

    # ── 80C ────────────────────────────────────────────────────────────────
    limit_80c = deductions_cfg["80C"]["limit"]
    claimed_80c = claimed.get("80C", 0)
    remaining_80c = max(0, limit_80c - claimed_80c)
    saving_80c = round(remaining_80c * marginal_rate * cess_factor, 0)
    analysis["80C"] = {
        "label":     deductions_cfg["80C"]["label"],
        "limit":     limit_80c,
        "claimed":   claimed_80c,
        "remaining": remaining_80c,
        "utilized_pct": round(claimed_80c / limit_80c * 100, 1) if limit_80c else 0,
    }
    if remaining_80c > 0:
        opportunities.append({
            "section":    "80C",
            "title":      "Utilise remaining 80C capacity",
            "description": (
                f"You have ₹{remaining_80c:,.0f} unused under Sec 80C. "
                "Consider ELSS, PPF, or LIC/term insurance premium to exhaust the limit."
            ),
            "saving_estimate": saving_80c,
            "risk_level": "Low",
        })

    # ── 80CCD(1B) – NPS ────────────────────────────────────────────────────
    limit_nps = deductions_cfg["80CCD1B"]["limit"]
    claimed_nps = claimed.get("80CCD1B", 0)
    remaining_nps = max(0, limit_nps - claimed_nps)
    saving_nps = round(remaining_nps * marginal_rate * cess_factor, 0)
    analysis["80CCD1B"] = {
        "label":     deductions_cfg["80CCD1B"]["label"],
        "limit":     limit_nps,
        "claimed":   claimed_nps,
        "remaining": remaining_nps,
        "utilized_pct": round(claimed_nps / limit_nps * 100, 1) if limit_nps else 0,
    }
    if remaining_nps > 0 and claimed_nps == 0:
        opportunities.append({
            "section":    "80CCD(1B)",
            "title":      "Invest in NPS for extra ₹50,000 deduction",
            "description": (
                "Sec 80CCD(1B) allows an additional ₹50,000 deduction over and above 80C. "
                "Open an NPS Tier-I account to unlock this benefit."
            ),
            "saving_estimate": saving_nps,
            "risk_level": "Low",
        })

    # ── 80D – Health Insurance ─────────────────────────────────────────────
    self_limit = (
        deductions_cfg["80D"]["self_family"]["above_60"] if age >= 60
        else deductions_cfg["80D"]["self_family"]["below_60"]
    )
    parent_limit = (
        deductions_cfg["80D"]["parents"]["above_60"] if parents_senior
        else deductions_cfg["80D"]["parents"]["below_60"]
    ) if has_parents else 0
    total_80d_limit = self_limit + parent_limit
    claimed_80d = claimed.get("80D", 0)
    remaining_80d = max(0, total_80d_limit - claimed_80d)
    saving_80d = round(remaining_80d * marginal_rate * cess_factor, 0)
    analysis["80D"] = {
        "label":       deductions_cfg["80D"]["label"],
        "limit":       total_80d_limit,
        "claimed":     claimed_80d,
        "remaining":   remaining_80d,
        "utilized_pct": round(claimed_80d / total_80d_limit * 100, 1) if total_80d_limit else 0,
    }
    if remaining_80d > 0:
        opportunities.append({
            "section":    "80D",
            "title":      "Get/upgrade health insurance for 80D savings",
            "description": (
                f"You can claim up to ₹{total_80d_limit:,} under Sec 80D. "
                f"₹{remaining_80d:,} is still available. "
                "Buy or upgrade a family floater health insurance policy."
            ),
            "saving_estimate": saving_80d,
            "risk_level": "Low",
        })

    # ── Home Loan Interest ──────────────────────────────────────────────────
    hl_limit = deductions_cfg["home_loan_interest"]["limit"]
    claimed_hl = claimed.get("home_loan_interest", 0)
    remaining_hl = max(0, hl_limit - claimed_hl)
    analysis["home_loan_interest"] = {
        "label":     deductions_cfg["home_loan_interest"]["label"],
        "limit":     hl_limit,
        "claimed":   claimed_hl,
        "remaining": remaining_hl,
        "utilized_pct": round(claimed_hl / hl_limit * 100, 1) if hl_limit else 0,
    }

    # ── Regime Mismatch Check ──────────────────────────────────────────────
    from modules.tax_engine import compare_regimes  # lazy import
    comparison = compare_regimes(gross_income, claimed, tds_paid)
    if comparison["recommended"] == "old" and comparison["saving_if_old"] > 5000:
        opportunities.append({
            "section":    "Regime",
            "title":      "Switch to Old Regime to save on taxes",
            "description": (
                f"Based on your deductions, Old Regime saves you ₹{comparison['saving_if_old']:,.0f}. "
                "Ensure you're opting for Old Regime when submitting your investment declaration to HR."
            ),
            "saving_estimate": comparison["saving_if_old"],
            "risk_level": "Low",
        })
    elif comparison["recommended"] == "new":
        opportunities.append({
            "section":    "Regime",
            "title":      "New Regime is beneficial for you",
            "description": (
                f"New Regime saves ₹{abs(comparison['saving_if_old']):,.0f}. "
                "If your employer allows, opt for New Regime in your investment declaration."
            ),
            "saving_estimate": abs(comparison["saving_if_old"]),
            "risk_level": "Low",
        })

    # ── TDS Refund Check ───────────────────────────────────────────────────
    if tds_paid > comparison["old"]["total_tax"] or tds_paid > comparison["new"]["total_tax"]:
        better_tax = min(comparison["old"]["total_tax"], comparison["new"]["total_tax"])
        refund_est = round(tds_paid - better_tax, 0)
        if refund_est > 0:
            opportunities.append({
                "section":    "Refund",
                "title":      f"Potential TDS refund of ₹{refund_est:,.0f}",
                "description": (
                    "Your TDS exceeds your tax liability. File your ITR promptly to claim the refund. "
                    "Ensure bank account is pre-validated on the income tax portal."
                ),
                "saving_estimate": refund_est,
                "risk_level": "Low",
            })

    # Sort opportunities by saving estimate descending
    opportunities.sort(key=lambda x: x["saving_estimate"], reverse=True)

    return {
        "analysis": analysis,
        "opportunities": opportunities,
        "total_potential_saving": sum(o["saving_estimate"] for o in opportunities),
    }
