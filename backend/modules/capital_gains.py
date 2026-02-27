"""
Module G: Capital Gains Tax Calculator
Handles all 4 capital gain types per IT Act + Budget 2024 amendments.
All rates are config-driven from tax_rules.json.

FY 2024-25 key changes (effective Jul 23, 2024):
  - Listed equity STCG: 15% → 20%
  - Listed equity LTCG threshold: ₹1L → ₹1.25L (rate unchanged 10%)
  - Property LTCG: 20% with indexation → 12.5% without indexation
    (pre-Jul 23 acquired property: taxpayer may choose old rules)
  - Debt MF: always slab rate (no LTCG, from Apr 2023)
  - Crypto/VDA: 30% flat + 1% TDS, no set-off
"""
import json
from datetime import date
from pathlib import Path
from typing import Literal, Optional

from dateutil.relativedelta import relativedelta

CONFIG_PATH = Path(__file__).parent.parent / "config" / "tax_rules.json"

AssetType = Literal["listed_equity", "equity_mf", "debt_mf", "property", "crypto_vda"]
GainType  = Literal["stcg", "ltcg", "special"]


def _load_config() -> dict:
    with open(CONFIG_PATH) as f:
        return json.load(f)


def _parse_date(d: str) -> date:
    """Parse ISO date string to date object."""
    return date.fromisoformat(d)


def _months_held(purchase_date: str, sale_date: str) -> int:
    """Calculate whole months between purchase and sale dates."""
    pd_ = _parse_date(purchase_date)
    sd  = _parse_date(sale_date)
    delta = relativedelta(sd, pd_)
    return delta.years * 12 + delta.months


def classify_gain(
    asset_type: AssetType,
    purchase_date: str,
    sale_date: str,
) -> GainType:
    """
    Determine if a gain is STCG or LTCG based on asset type and holding period.

    Thresholds:
      listed_equity, equity_mf : 12 months
      property                 : 24 months
      debt_mf                  : always 'stcg' (slab rate regardless)
      crypto_vda               : 'special' (30% flat, no classification)
    """
    if asset_type == "crypto_vda":
        return "special"
    if asset_type == "debt_mf":
        return "stcg"  # always slab rate post Apr 2023
    months = _months_held(purchase_date, sale_date)
    cfg = _load_config()["capital_gains"]
    if asset_type in ("listed_equity", "equity_mf"):
        threshold = cfg["listed_equity_ltcg"]["holding_months"]
        return "ltcg" if months >= threshold else "stcg"
    if asset_type == "property":
        threshold = cfg["property_ltcg"]["holding_months"]
        return "ltcg" if months >= threshold else "stcg"
    return "stcg"


def compute_single_cg(
    asset_type: AssetType,
    purchase_price: float,
    sale_price: float,
    purchase_date: str,
    sale_date: str,
    slab_rate: float = 0.30,
    property_acquired_pre_jul23: bool = False,
    cost_of_improvement: float = 0.0,
    description: str = "",
    _ltcg_exemption_remaining: float = 125000.0,
) -> dict:
    """
    Compute capital gains for a single transaction.

    Parameters
    ----------
    asset_type                  : asset class
    purchase_price              : cost of acquisition (₹)
    sale_price                  : sale consideration (₹)
    purchase_date               : ISO "YYYY-MM-DD"
    sale_date                   : ISO "YYYY-MM-DD"
    slab_rate                   : user's marginal slab rate (for debt/property STCG)
    property_acquired_pre_jul23 : if True, show both Option A and Option B for property LTCG
    cost_of_improvement         : additional capital expenditure for property
    description                 : user-supplied label
    _ltcg_exemption_remaining   : remaining LTCG equity exemption pool (internal use)

    Returns
    -------
    dict with gain computation, applicable rate, tax amount, and advisory notes
    """
    cfg = _load_config()["capital_gains"]
    cess_rate = _load_config()["cess_rate"]
    months = _months_held(purchase_date, sale_date)
    gain_type = classify_gain(asset_type, purchase_date, sale_date)

    gross_gain = sale_price - purchase_price - cost_of_improvement
    is_loss    = gross_gain < 0

    notes = []
    exemption_applied = 0.0
    taxable_gain = 0.0
    tax_rate = 0.0
    tax_amount = 0.0
    tds_applicable = 0.0
    option_b = None  # For property pre-Jul23 only

    if is_loss:
        notes.append(f"Capital loss of ₹{abs(gross_gain):,.0f}. ")
        if asset_type == "crypto_vda":
            notes.append("Crypto losses cannot be set off against any other income or carried forward.")
        else:
            notes.append("This loss can be carried forward for up to 8 years (set off against future capital gains of the same type).")
        return {
            "asset_type": asset_type,
            "description": description,
            "purchase_date": purchase_date,
            "sale_date": sale_date,
            "months_held": months,
            "gain_type": gain_type,
            "gross_gain": gross_gain,
            "exemption_applied": 0.0,
            "taxable_gain": gross_gain,  # negative (loss)
            "tax_rate": 0.0,
            "tax_amount": 0.0,
            "tds_applicable": 0.0,
            "is_loss": True,
            "notes": notes,
        }

    # ── Listed Equity / Equity MF ───────────────────────────────────────────
    if asset_type in ("listed_equity", "equity_mf"):
        if gain_type == "ltcg":
            tax_rate = cfg["listed_equity_ltcg"]["rate"]
            exemption_applied = min(gross_gain, _ltcg_exemption_remaining)
            taxable_gain = max(0.0, gross_gain - exemption_applied)
            tax_amount   = round(taxable_gain * tax_rate, 2)
            notes.append(f"LTCG — ₹{exemption_applied:,.0f} of ₹1.25L annual exemption applied.")
        else:  # stcg
            tax_rate     = cfg["listed_equity_stcg"]["rate"]
            taxable_gain = gross_gain
            tax_amount   = round(taxable_gain * tax_rate, 2)
            notes.append("STCG — 20% flat rate (post Jul 23, 2024).")

    # ── Debt MF ─────────────────────────────────────────────────────────────
    elif asset_type == "debt_mf":
        tax_rate     = slab_rate
        taxable_gain = gross_gain
        tax_amount   = round(taxable_gain * slab_rate, 2)
        notes.append("Debt MF gains are taxed at your slab rate regardless of holding period (post Apr 2023).")

    # ── Property ────────────────────────────────────────────────────────────
    elif asset_type == "property":
        if gain_type == "ltcg":
            tax_rate_new = cfg["property_ltcg"]["rate"]  # 12.5%
            taxable_gain = gross_gain
            tax_amount   = round(taxable_gain * tax_rate_new, 2)
            tax_rate     = tax_rate_new
            notes.append("Property LTCG — 12.5% without indexation (post Jul 23, 2024 rule).")
            if property_acquired_pre_jul23:
                # Also compute old option
                old_rate = cfg["property_ltcg"]["pre_jul23_rate"]  # 20%
                # We show the amounts but cannot compute exact CII without purchase year data
                option_b = {
                    "rate": old_rate,
                    "tax_without_cii": round(gross_gain * old_rate, 2),
                    "note": (
                        f"Option B (pre-Jul 23 rule): 20% with Cost Inflation Index. "
                        f"Without CII, tax = ₹{round(gross_gain * old_rate, 2):,.0f}. "
                        "With CII (indexation), tax will be lower. Consult a CA to compute exact CII benefit."
                    ),
                }
                notes.append("Property acquired before Jul 23, 2024: you may choose between Option A (12.5% no indexation) and Option B (20% with CII). Consult a CA.")
        else:  # stcg
            tax_rate     = slab_rate
            taxable_gain = gross_gain
            tax_amount   = round(taxable_gain * slab_rate, 2)
            notes.append(f"Property STCG (< 24 months) — taxed at slab rate ({slab_rate*100:.0f}%).")

    # ── Crypto / VDA ────────────────────────────────────────────────────────
    elif asset_type == "crypto_vda":
        tax_rate     = cfg["crypto_vda"]["rate"]   # 30%
        taxable_gain = gross_gain
        tax_amount   = round(taxable_gain * tax_rate, 2)
        tds_applicable = round(gross_gain * cfg["crypto_vda"]["tds_rate"], 2)  # 1% TDS
        notes.append("Crypto/VDA — 30% flat rate. No deductions or set-offs allowed.")
        notes.append(f"1% TDS applicable on sale proceeds = ₹{tds_applicable:,.0f}.")

    return {
        "asset_type": asset_type,
        "description": description,
        "purchase_date": purchase_date,
        "sale_date": sale_date,
        "months_held": months,
        "gain_type": gain_type,
        "gross_gain": round(gross_gain, 2),
        "exemption_applied": round(exemption_applied, 2),
        "taxable_gain": round(taxable_gain, 2),
        "tax_rate": tax_rate,
        "tax_amount": tax_amount,
        "tds_applicable": tds_applicable,
        "is_loss": False,
        "option_b_property": option_b,
        "notes": notes,
    }


def compute_all_capital_gains(
    entries: list,
    slab_rate: float = 0.30,
    cess_rate: float = 0.04,
) -> dict:
    """
    Process a list of capital gain entries and produce the full CG schedule.

    IMPORTANT: The ₹1.25L LTCG exemption is a SHARED POOL across all
    listed_equity and equity_mf LTCG gains in the same FY. It is applied
    in the order entries are listed (user can reorder if needed).

    Parameters
    ----------
    entries   : list of dicts matching CapitalGainEntry fields
    slab_rate : user's marginal slab rate (for debt/property STCG)
    cess_rate : cess rate from config

    Returns
    -------
    dict with per-entry results, summary, notes, and loss details
    """
    cfg = _load_config()["capital_gains"]
    ltcg_exemption_pool = float(cfg["listed_equity_ltcg"]["exemption_limit"])  # ₹1,25,000
    ltcg_exemption_remaining = ltcg_exemption_pool

    computed_entries = []
    loss_entries     = []
    carry_forward_eligible = False

    total_stcg_equity     = 0.0
    total_ltcg_equity     = 0.0
    ltcg_exemption_used   = 0.0
    total_stcg_debt_prop  = 0.0
    total_crypto_gain     = 0.0
    total_tax_stcg_equity = 0.0
    total_tax_ltcg        = 0.0
    total_tax_slab_rate   = 0.0
    total_tax_crypto      = 0.0

    for entry in entries:
        asset_type = entry.get("asset_type", "listed_equity")
        result = compute_single_cg(
            asset_type              = asset_type,
            purchase_price          = float(entry.get("purchase_price", 0)),
            sale_price              = float(entry.get("sale_price", 0)),
            purchase_date           = entry.get("purchase_date", "2024-01-01"),
            sale_date               = entry.get("sale_date", "2024-12-31"),
            slab_rate               = slab_rate,
            property_acquired_pre_jul23 = entry.get("property_acquired_pre_jul23", False),
            cost_of_improvement     = float(entry.get("cost_of_improvement", 0)),
            description             = entry.get("description", ""),
            _ltcg_exemption_remaining = ltcg_exemption_remaining,
        )

        if result["is_loss"]:
            loss_entries.append(result)
            if asset_type != "crypto_vda":
                carry_forward_eligible = True
        else:
            computed_entries.append(result)
            gt = result["gain_type"]
            at = asset_type

            if at in ("listed_equity", "equity_mf"):
                if gt == "ltcg":
                    total_ltcg_equity     += result["gross_gain"]
                    ltcg_exemption_used   += result["exemption_applied"]
                    ltcg_exemption_remaining = max(0.0, ltcg_exemption_remaining - result["exemption_applied"])
                    total_tax_ltcg        += result["tax_amount"]
                else:
                    total_stcg_equity     += result["gross_gain"]
                    total_tax_stcg_equity += result["tax_amount"]
            elif at in ("debt_mf", "property"):
                total_stcg_debt_prop += result["gross_gain"]
                total_tax_slab_rate  += result["tax_amount"]
            elif at == "crypto_vda":
                total_crypto_gain  += result["gross_gain"]
                total_tax_crypto   += result["tax_amount"]

    total_cg_tax = round(
        total_tax_stcg_equity + total_tax_ltcg + total_tax_slab_rate + total_tax_crypto, 2
    )
    cess_on_cg = round(total_cg_tax * cess_rate, 2)

    schedule_notes = []
    if total_ltcg_equity > 0:
        schedule_notes.append(
            f"₹{ltcg_exemption_used:,.0f} of LTCG annual exemption (₹1.25L) used. "
            f"₹{max(0, ltcg_exemption_pool - ltcg_exemption_used):,.0f} remaining."
        )
    if total_crypto_gain > 0:
        schedule_notes.append("Crypto/VDA gains taxed at 30% flat. No deductions or set-offs allowed.")
    if loss_entries:
        non_crypto_losses = [e for e in loss_entries if e["asset_type"] != "crypto_vda"]
        if non_crypto_losses:
            schedule_notes.append(
                f"{len(non_crypto_losses)} loss transaction(s) can be carried forward for 8 years."
            )

    return {
        "entries":  computed_entries + loss_entries,
        "summary": {
            "total_stcg_equity":          round(total_stcg_equity, 2),
            "total_ltcg_equity":          round(total_ltcg_equity, 2),
            "ltcg_exemption_used":        round(ltcg_exemption_used, 2),
            "ltcg_exemption_remaining":   round(max(0.0, ltcg_exemption_pool - ltcg_exemption_used), 2),
            "total_stcg_debt_property":   round(total_stcg_debt_prop, 2),
            "total_crypto_gain":          round(total_crypto_gain, 2),
            "total_tax_stcg_equity":      round(total_tax_stcg_equity, 2),
            "total_tax_ltcg":             round(total_tax_ltcg, 2),
            "total_tax_slab_rate":        round(total_tax_slab_rate, 2),
            "total_tax_crypto":           round(total_tax_crypto, 2),
            "total_capital_gains_tax":    total_cg_tax,
            "cess":                       cess_on_cg,
            "total_with_cess":            round(total_cg_tax + cess_on_cg, 2),
        },
        "schedule_cg_notes":    schedule_notes,
        "loss_entries":         loss_entries,
        "carry_forward_eligible": carry_forward_eligible,
    }
