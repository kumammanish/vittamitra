"""
Module H: Other Income & Foreign Income Calculator
Covers FD/savings interest, dividends, rental income (Sec 24), and NRI/DTAA rules.
All rules and limits are config-driven from tax_rules.json.
"""
import json
from pathlib import Path
from typing import Literal, Optional

CONFIG_PATH = Path(__file__).parent.parent / "config" / "tax_rules.json"

ResidentialStatus = Literal["Resident", "RNOR", "NRI"]


def _load_config() -> dict:
    with open(CONFIG_PATH) as f:
        return json.load(f)


def _get_dtaa_rates(dtaa_country: Optional[str], cfg: dict) -> tuple:
    """Return (fd_interest_rate, dividend_rate) for given DTAA country code."""
    if not dtaa_country:
        return None, None
    countries = cfg.get("nri_rules", {}).get("dtaa_countries", [])
    for c in countries:
        if c["code"] == dtaa_country:
            return c.get("fd_interest_rate"), c.get("dividend_rate")
    return None, None


def compute_interest_income(
    fd_interest: float = 0.0,
    savings_interest: float = 0.0,
    other_interest: float = 0.0,
    age: int = 30,
    residential_status: ResidentialStatus = "Resident",
    regime: str = "old",
    dtaa_country: Optional[str] = None,
) -> dict:
    """
    Compute tax treatment for interest income.

    Rules:
    - FD interest: fully taxable at slab rate; TDS deducted above threshold
    - Savings interest: deductible under 80TTA (₹10K, non-senior, old regime)
    - Senior citizens (age >= 60): 80TTB up to ₹50K replaces 80TTA
    - NRI: NRE account interest is exempt; NRO is taxable
    - DTAA: if country provided (NRI), show applicable treaty rate for reference

    Returns
    -------
    dict with taxable amounts, deductions, TDS estimates, and advisory notes
    """
    cfg = _load_config()
    oi_cfg = cfg.get("other_income", {})
    nri_cfg = cfg.get("nri_rules", {})
    is_nri = residential_status == "NRI"
    is_senior = age >= 60

    notes = []
    deduction_80tta = 0.0
    deduction_80ttb = 0.0
    nre_exempt = False

    # TDS thresholds
    tds_threshold = oi_cfg["fd_interest"]["senior_tds_threshold"] if is_senior else oi_cfg["fd_interest"]["tds_threshold"]
    estimated_tds_on_fd = round(fd_interest * 0.10, 2) if fd_interest > tds_threshold else 0.0

    # NRI: NRE account interest is exempt (user-reported amount excluded)
    if is_nri:
        nre_exempt = True
        notes.append("NRE account interest is exempt from Indian tax. NRO account interest is fully taxable.")
        notes.append("NRI TDS on FD is typically 30% (or DTAA rate if applicable).")
        estimated_tds_on_fd = round(fd_interest * 0.30, 2) if fd_interest > 0 else 0.0

    dtaa_fd_rate, _ = _get_dtaa_rates(dtaa_country, cfg)

    # 80TTA / 80TTB deductions (Resident/RNOR only, old regime)
    if not is_nri and regime == "old":
        if is_senior:
            # 80TTB covers FD + savings + interest up to ₹50K
            limit_80ttb = oi_cfg["fd_80ttb_senior"]["80ttb_limit"]
            deduction_80ttb = min(fd_interest + savings_interest + other_interest, limit_80ttb)
            notes.append(f"Sec 80TTB: Senior citizen deduction of ₹{deduction_80ttb:,.0f} on interest income (limit ₹{limit_80ttb:,}).")
        else:
            # 80TTA covers only savings account interest up to ₹10K
            limit_80tta = oi_cfg["savings_interest"]["80tta_limit"]
            deduction_80tta = min(savings_interest, limit_80tta)
            if savings_interest > 0:
                notes.append(f"Sec 80TTA: ₹{deduction_80tta:,.0f} savings interest deduction applied (limit ₹{limit_80tta:,}).")
    elif not is_nri and regime == "new":
        notes.append("80TTA/80TTB deductions are not available under the New Regime.")

    gross_interest = fd_interest + savings_interest + other_interest
    taxable_interest = round(
        max(0.0, gross_interest - deduction_80tta - deduction_80ttb), 2
    )

    if dtaa_fd_rate is not None:
        notes.append(f"DTAA rate for FD interest ({dtaa_country}): {dtaa_fd_rate*100:.0f}% — this is the ceiling; actual India TDS may be lower or equal.")

    return {
        "fd_interest":         fd_interest,
        "savings_interest":    savings_interest,
        "other_interest":      other_interest,
        "gross_interest":      round(gross_interest, 2),
        "deduction_80tta":     deduction_80tta,
        "deduction_80ttb":     deduction_80ttb,
        "taxable_interest":    taxable_interest,
        "estimated_tds_on_fd": estimated_tds_on_fd,
        "nre_exempt":          nre_exempt,
        "dtaa_rate":           dtaa_fd_rate,
        "notes":               notes,
    }


def compute_dividend_income(
    dividend_amount: float,
    age: int = 30,
    residential_status: ResidentialStatus = "Resident",
    dtaa_country: Optional[str] = None,
) -> dict:
    """
    Compute dividend income tax treatment.

    - Dividend fully taxable at slab rate (DDT removed FY 2020-21)
    - TDS at 10% above ₹5,000 (resident); 20% for NRI (or DTAA rate)
    - 80TTA/80TTB do NOT apply to dividends

    Returns
    -------
    dict with taxable dividend, TDS estimate, DTAA rate, and notes
    """
    cfg = _load_config()
    oi_cfg = cfg.get("other_income", {})
    is_nri = residential_status == "NRI"
    notes  = []

    tds_threshold = oi_cfg["dividend"]["tds_threshold"]  # ₹5,000
    _, dtaa_div_rate = _get_dtaa_rates(dtaa_country, cfg)

    if is_nri:
        estimated_tds = round(dividend_amount * 0.20, 2) if dividend_amount > 0 else 0.0
        notes.append("NRI dividend TDS is 20% (or DTAA rate if applicable).")
        if dtaa_div_rate is not None:
            effective_rate = min(0.20, dtaa_div_rate)
            estimated_tds = round(dividend_amount * effective_rate, 2)
            notes.append(f"DTAA rate for dividends ({dtaa_country}): {dtaa_div_rate*100:.0f}%.")
    else:
        estimated_tds = round(dividend_amount * 0.10, 2) if dividend_amount > tds_threshold else 0.0
        if dividend_amount > 0:
            notes.append(f"Dividend is fully taxable at your slab rate. TDS 10% applies above ₹{tds_threshold:,}.")

    return {
        "dividend_amount":  dividend_amount,
        "taxable_dividend": dividend_amount,  # No deduction on dividends
        "estimated_tds":    estimated_tds,
        "dtaa_rate":        dtaa_div_rate,
        "notes":            notes,
    }


def compute_rental_income(
    annual_rent_received: float,
    municipal_taxes_paid: float = 0.0,
    home_loan_interest: float = 0.0,
    is_self_occupied: bool = False,
    pre_construction_interest: float = 0.0,
) -> dict:
    """
    Compute Net Annual Value and deductions for house property income (Sec 24).

    Formula:
      GAV = annual_rent_received
      NAV = GAV - municipal_taxes_paid
      Sec 24(a) standard deduction = 30% of NAV (only for let-out; not self-occupied)
      Sec 24(b) interest deduction:
        - Self-occupied: capped at ₹2,00,000
        - Let-out:       uncapped (deduct actual interest)
      Net HP Income = NAV - Sec 24(a) - Sec 24(b)

    Loss can be set off against salary income up to ₹2L in the same year.

    Returns
    -------
    dict with full waterfall computation and advisory notes
    """
    cfg = _load_config()
    rental_cfg = cfg.get("other_income", {}).get("rental", {})
    std_ded_pct  = rental_cfg.get("standard_deduction_pct", 0.30)
    sec24b_limit = rental_cfg.get("sec24b_self_occupied_limit", 200000)

    notes = []

    if is_self_occupied:
        # Self-occupied: GAV = 0, NAV = 0, only interest deduction applies
        gross_annual_value   = 0.0
        municipal_taxes_used = 0.0
        net_annual_value     = 0.0
        sec24a_deduction     = 0.0
        sec24b_deduction     = min(home_loan_interest + pre_construction_interest / 5, sec24b_limit)
        sec24b_limit_applied = sec24b_limit
        notes.append(f"Self-occupied property: Sec 24(b) interest capped at ₹{sec24b_limit:,}.")
        if home_loan_interest > sec24b_limit:
            notes.append(f"Interest claimed ₹{home_loan_interest:,.0f} exceeds ₹2L cap. Only ₹{sec24b_limit:,} deductible.")
    else:
        # Let-out or deemed let-out
        gross_annual_value   = annual_rent_received
        municipal_taxes_used = municipal_taxes_paid
        net_annual_value     = max(0.0, gross_annual_value - municipal_taxes_used)
        sec24a_deduction     = round(net_annual_value * std_ded_pct, 2)
        sec24b_deduction     = home_loan_interest + pre_construction_interest / 5
        sec24b_limit_applied = 0.0  # uncapped for let-out
        notes.append("Let-out property: 30% standard deduction (Sec 24a) applied. Interest deduction is uncapped.")

    net_income_from_hp = round(net_annual_value - sec24a_deduction - sec24b_deduction, 2)
    is_loss = net_income_from_hp < 0

    # HP loss can be set off against salary (and other heads) up to ₹2L
    set_off_against_salary = 0.0
    if is_loss:
        set_off_against_salary = min(abs(net_income_from_hp), 200000.0)
        notes.append(
            f"House property loss of ₹{abs(net_income_from_hp):,.0f} can be set off against "
            f"salary income up to ₹2L (i.e. ₹{set_off_against_salary:,.0f} set-off available)."
        )

    if pre_construction_interest > 0:
        notes.append(
            f"Pre-construction interest ₹{pre_construction_interest:,.0f} spread over 5 years: "
            f"₹{pre_construction_interest/5:,.0f}/year deductible."
        )

    return {
        "gross_annual_value":       gross_annual_value,
        "municipal_taxes_paid":     municipal_taxes_used,
        "net_annual_value":         net_annual_value,
        "sec24a_standard_deduction": sec24a_deduction,
        "sec24b_interest_deduction": round(sec24b_deduction, 2),
        "sec24b_limit_applied":     sec24b_limit_applied,
        "net_income_from_hp":       net_income_from_hp,
        "is_loss":                  is_loss,
        "set_off_against_salary":   set_off_against_salary,
        "notes":                    notes,
    }


def compute_nri_tax_profile(
    residential_status: ResidentialStatus = "Resident",
    dtaa_country: Optional[str] = None,
    gross_income: float = 0.0,
    fd_interest_nro: float = 0.0,
    fd_interest_nre: float = 0.0,
    dividend: float = 0.0,
) -> dict:
    """
    Build the NRI/RNOR tax profile: applicable exemptions, DTAA rates, rebate eligibility.

    Returns
    -------
    dict with residential status details and advisory notes
    """
    cfg = _load_config()
    nri_cfg = cfg.get("nri_rules", {})
    is_nri  = residential_status == "NRI"
    is_rnor = residential_status == "RNOR"

    dtaa_fd_rate, dtaa_div_rate = _get_dtaa_rates(dtaa_country, cfg)

    rebate_87a_eligible = not is_nri  # RNOR gets rebate; NRI does not
    basic_exemption_limit = 250000.0 if not is_nri else 0.0  # NRI has no basic exemption

    nri_notes = []
    if is_nri:
        nri_notes.append("As an NRI, Section 87A rebate is NOT applicable.")
        nri_notes.append("NRE/FCNR interest is exempt. NRO interest is fully taxable at 30% (or DTAA rate).")
        nri_notes.append("Use ITR-2 for filing as an NRI.")
        if dtaa_country == "UAE":
            nri_notes.append("UAE: No DTAA with India for individual income tax. Standard NRI tax rates apply.")
        elif dtaa_fd_rate is not None:
            nri_notes.append(
                f"DTAA with {dtaa_country}: FD interest capped at {dtaa_fd_rate*100:.0f}%, "
                f"dividends at {dtaa_div_rate*100:.0f}% (if applicable). File Form 67 to claim DTAA relief."
            )
    elif is_rnor:
        nri_notes.append("RNOR status: taxed like a resident on Indian-sourced income. Foreign income is exempt.")
        nri_notes.append("87A rebate is applicable for RNOR (same as resident).")
        nri_notes.append("RNOR has special rules for foreign income — consult a CA for accurate computation.")

    return {
        "residential_status":    residential_status,
        "is_nri":                is_nri,
        "is_rnor":               is_rnor,
        "rebate_87a_eligible":   rebate_87a_eligible,
        "basic_exemption_limit": basic_exemption_limit,
        "nre_interest_exempt":   is_nri and nri_cfg.get("nre_interest_exempt", True),
        "dtaa_applicable":       is_nri and dtaa_country is not None and dtaa_fd_rate is not None,
        "dtaa_country":          dtaa_country,
        "dtaa_fd_rate":          dtaa_fd_rate,
        "dtaa_dividend_rate":    dtaa_div_rate,
        "nri_notes":             nri_notes,
        "fd_interest_nro":       fd_interest_nro,
        "fd_interest_nre":       fd_interest_nre,
        "nre_exempt_amount":     fd_interest_nre if is_nri else 0.0,
        "taxable_nro_interest":  fd_interest_nro if is_nri else 0.0,
    }
