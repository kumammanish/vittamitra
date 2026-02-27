"""
Module B: Tax Computation Engine (Deterministic)
All tax rules loaded from config/tax_rules.json — nothing hardcoded.
Supports Old Regime and New Regime for FY 2024-25.
"""
import json
from pathlib import Path

CONFIG_PATH = Path(__file__).parent.parent / "config" / "tax_rules.json"


def _load_config() -> dict:
    with open(CONFIG_PATH) as f:
        return json.load(f)


def compute_slab_tax(taxable_income: float, slabs: list) -> float:
    """Compute tax using given slabs on taxable income."""
    tax = 0.0
    for slab in slabs:
        low  = slab["min"]
        high = slab["max"] if slab["max"] is not None else float("inf")
        rate = slab["rate"]
        if taxable_income > low:
            applicable = min(taxable_income, high) - low
            tax += applicable * rate
    return round(tax, 2)


def compute_surcharge(income: float, base_tax: float, surcharge_slabs: list) -> float:
    """Compute surcharge on base tax based on total income."""
    rate = 0.0
    for slab in surcharge_slabs:
        low  = slab["min"]
        high = slab["max"] if slab["max"] is not None else float("inf")
        if low <= income < high:
            rate = slab["rate"]
            break
        elif income >= low and (slab["max"] is None):
            rate = slab["rate"]
    return round(base_tax * rate, 2)


def apply_rebate_87a(income: float, tax: float, rebate_config: dict) -> float:
    """Apply Section 87A rebate if income is within limit."""
    if income <= rebate_config["income_limit"]:
        return max(0.0, tax - rebate_config["rebate_amount"])
    return tax


def compute_tax(
    gross_income: float,
    regime: str = "new",
    deductions: dict = None,
    tds_paid: float = 0.0,
    residential_status: str = "Resident",
) -> dict:
    """
    Compute Indian income tax for a given regime.

    Parameters
    ----------
    gross_income         : float  – Total gross income (salary + other sources)
    regime               : str    – 'old' or 'new'
    deductions           : dict   – {section: amount_claimed}
    tds_paid             : float  – TDS already deducted
    residential_status   : str    – 'Resident', 'RNOR', or 'NRI'
                                    NRI: 87A rebate not applicable

    Returns
    -------
    dict with full tax breakdown
    """
    cfg = _load_config()
    if deductions is None:
        deductions = {}

    regime_cfg = cfg["regimes"][regime]
    slabs       = regime_cfg["slabs"]
    rebate_cfg  = regime_cfg["rebate_87a"]

    # Standard deduction
    std_deduction = (
        cfg["standard_deduction_new_regime"] if regime == "new"
        else cfg["standard_deduction"]
    )
    income_after_std = max(0.0, gross_income - std_deduction)

    # Chapter VI-A deductions (old regime only)
    total_deductions = 0.0
    deduction_breakdown = {}
    if regime == "old":
        deduction_limits = {
            "80C":     cfg["deductions"]["80C"]["limit"],
            "80CCD1B": cfg["deductions"]["80CCD1B"]["limit"],
        }
        for section, amt in deductions.items():
            limit = deduction_limits.get(section, amt)
            allowed = min(amt, limit)
            deduction_breakdown[section] = {"claimed": amt, "allowed": allowed}
            total_deductions += allowed

        # 80D handled separately (self + parents)
        d80d = deductions.get("80D", 0)
        d80d_limit = cfg["deductions"]["80D"]["self_family"]["below_60"]
        d80d_allowed = min(d80d, d80d_limit)
        if d80d_allowed:
            deduction_breakdown["80D"] = {"claimed": d80d, "allowed": d80d_allowed}
            total_deductions += d80d_allowed

        # Home loan interest
        home_loan = deductions.get("home_loan_interest", 0)
        home_loan_allowed = min(home_loan, cfg["deductions"]["home_loan_interest"]["limit"])
        if home_loan_allowed:
            deduction_breakdown["home_loan_interest"] = {"claimed": home_loan, "allowed": home_loan_allowed}
            total_deductions += home_loan_allowed

        # HRA
        hra = deductions.get("HRA", 0)
        if hra:
            deduction_breakdown["HRA"] = {"claimed": hra, "allowed": hra}
            total_deductions += hra

    taxable_income = max(0.0, income_after_std - total_deductions)

    # Slab tax
    base_tax = compute_slab_tax(taxable_income, slabs)

    # Rebate 87A (not applicable for NRI)
    if residential_status == "NRI":
        tax_after_rebate = base_tax
    else:
        tax_after_rebate = apply_rebate_87a(taxable_income, base_tax, rebate_cfg)

    # Surcharge
    surcharge = compute_surcharge(taxable_income, tax_after_rebate, cfg["surcharge"])

    # Cess
    cess = round((tax_after_rebate + surcharge) * cfg["cess_rate"], 2)

    # Total tax
    total_tax = round(tax_after_rebate + surcharge + cess, 2)

    # Net payable after TDS
    net_payable = round(max(0.0, total_tax - tds_paid), 2)
    refund      = round(max(0.0, tds_paid - total_tax), 2)

    return {
        "regime": regime,
        "gross_income": gross_income,
        "standard_deduction": std_deduction,
        "income_after_std_deduction": income_after_std,
        "chapter_vi_deductions": total_deductions,
        "deduction_breakdown": deduction_breakdown,
        "taxable_income": taxable_income,
        "base_tax": base_tax,
        "tax_after_rebate_87a": tax_after_rebate,
        "surcharge": surcharge,
        "cess": cess,
        "total_tax": total_tax,
        "tds_paid": tds_paid,
        "net_payable": net_payable,
        "refund": refund,
    }


def compare_regimes(
    gross_income: float,
    deductions: dict = None,
    tds_paid: float = 0.0,
) -> dict:
    """Compare Old vs New regime and recommend the better one."""
    old = compute_tax(gross_income, "old", deductions, tds_paid)
    new = compute_tax(gross_income, "new", {}, tds_paid)  # New regime ignores VI-A
    saving = round(old["total_tax"] - new["total_tax"], 2)
    better = "old" if old["total_tax"] < new["total_tax"] else "new"
    if old["total_tax"] == new["total_tax"]:
        better = "equal"
    return {
        "old": old,
        "new": new,
        "saving_if_old": saving,
        "recommended": better,
        "recommendation_note": _recommendation_note(old, new, saving),
    }


def _recommendation_note(old: dict, new: dict, saving: float) -> str:
    if saving < 0:
        return (
            f"New Regime saves ₹{abs(saving):,.0f}. "
            "Unless you have significant deductions under 80C/80D/HRA, the New Regime is better."
        )
    elif saving > 0:
        return (
            f"Old Regime saves ₹{saving:,.0f} due to your deductions. "
            "Maximise 80C (₹1.5L) and 80D to retain this advantage."
        )
    else:
        return "Both regimes result in the same tax. Consider New Regime for simplicity."
