"""
Unit tests for Module G (capital_gains.py) and Module H (other_income.py).
Run from the project root:
    cd backend && source .venv/bin/activate
    python -m pytest ../tests/test_capital_gains.py -v
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pytest
from modules.capital_gains import classify_gain, compute_single_cg, compute_all_capital_gains
from modules.other_income import (
    compute_interest_income,
    compute_rental_income,
    compute_dividend_income,
    compute_nri_tax_profile,
)


# ─── classify_gain ───────────────────────────────────────────────────────────

def test_classify_equity_ltcg():
    """Equity held > 12 months → LTCG."""
    result = classify_gain("listed_equity", "2022-01-01", "2023-02-01")
    assert result == "ltcg"


def test_classify_equity_stcg():
    """Equity held < 12 months → STCG."""
    result = classify_gain("listed_equity", "2023-07-01", "2024-05-01")
    assert result == "stcg"


def test_classify_equity_exactly_12_months():
    """Equity held exactly 12 months → LTCG (≥ threshold)."""
    result = classify_gain("equity_mf", "2023-01-01", "2024-01-01")
    assert result == "ltcg"


def test_classify_property_ltcg():
    """Property held > 24 months → LTCG."""
    result = classify_gain("property", "2021-01-01", "2023-02-01")
    assert result == "ltcg"


def test_classify_property_stcg():
    """Property held < 24 months → STCG."""
    result = classify_gain("property", "2022-06-01", "2023-07-01")
    assert result == "stcg"


def test_classify_debt_mf_always_stcg():
    """Debt MF → always STCG (taxed at slab), regardless of holding."""
    result = classify_gain("debt_mf", "2020-01-01", "2024-01-01")
    assert result == "stcg"


# ─── compute_single_cg ───────────────────────────────────────────────────────

def test_equity_ltcg_within_exemption():
    """LTCG equity with gain < ₹1.25L → full exemption, zero tax."""
    result = compute_single_cg(
        asset_type="listed_equity",
        purchase_price=100_000,
        sale_price=150_000,
        purchase_date="2023-01-01",
        sale_date="2024-06-01",
        _ltcg_exemption_remaining=125_000,
    )
    assert result["gain_type"] == "ltcg"
    assert result["gross_gain"] == 50_000
    assert result["exemption_applied"] == 50_000
    assert result["taxable_gain"] == 0
    assert result["tax_amount"] == 0


def test_equity_ltcg_partial_exemption():
    """LTCG equity with gain > ₹1.25L → partial exemption."""
    result = compute_single_cg(
        asset_type="listed_equity",
        purchase_price=100_000,
        sale_price=300_000,
        purchase_date="2023-01-01",
        sale_date="2024-06-01",
        _ltcg_exemption_remaining=125_000,
    )
    assert result["gain_type"] == "ltcg"
    assert result["gross_gain"] == 200_000
    assert result["exemption_applied"] == 125_000
    assert result["taxable_gain"] == 75_000
    assert result["tax_amount"] == pytest.approx(7_500, abs=1)  # 10% of 75K


def test_equity_stcg_rate():
    """STCG equity → taxed at 20% (Budget 2024)."""
    result = compute_single_cg(
        asset_type="listed_equity",
        purchase_price=100_000,
        sale_price=150_000,
        purchase_date="2023-07-01",
        sale_date="2024-05-01",
        _ltcg_exemption_remaining=125_000,
    )
    assert result["gain_type"] == "stcg"
    assert result["tax_rate"] == pytest.approx(0.20)
    assert result["tax_amount"] == pytest.approx(10_000, abs=1)  # 20% of 50K


def test_crypto_vda_rate():
    """Crypto → 30% flat tax, regardless of holding period."""
    result = compute_single_cg(
        asset_type="crypto_vda",
        purchase_price=50_000,
        sale_price=100_000,
        purchase_date="2023-01-01",
        sale_date="2023-06-01",
        _ltcg_exemption_remaining=125_000,
    )
    assert result["tax_rate"] == pytest.approx(0.30)
    assert result["tax_amount"] == pytest.approx(15_000, abs=1)  # 30% of 50K


def test_property_ltcg_post_jul23():
    """Property LTCG post Jul-23 → 12.5% rate."""
    result = compute_single_cg(
        asset_type="property",
        purchase_price=2_000_000,
        sale_price=3_000_000,
        purchase_date="2020-01-01",
        sale_date="2024-09-01",
        _ltcg_exemption_remaining=0,
    )
    assert result["gain_type"] == "ltcg"
    assert result["tax_rate"] == pytest.approx(0.125)
    assert result["tax_amount"] == pytest.approx(125_000, abs=1)  # 12.5% of 1M


def test_property_ltcg_pre_jul23_shows_option_b():
    """Property acquired pre-Jul23 → option_b_property key present."""
    result = compute_single_cg(
        asset_type="property",
        purchase_price=1_000_000,
        sale_price=3_000_000,
        purchase_date="2018-01-01",
        sale_date="2024-09-01",
        _ltcg_exemption_remaining=0,
        property_acquired_pre_jul23=True,
    )
    assert "option_b_property" in result
    assert result["option_b_property"]["rate"] == pytest.approx(0.20)


def test_loss_entry():
    """Sale < purchase → gross_gain is negative, tax_amount is zero."""
    result = compute_single_cg(
        asset_type="listed_equity",
        purchase_price=200_000,
        sale_price=150_000,
        purchase_date="2023-01-01",
        sale_date="2024-06-01",
        _ltcg_exemption_remaining=125_000,
    )
    assert result["gross_gain"] < 0
    assert result["tax_amount"] == 0


# ─── compute_all_capital_gains ───────────────────────────────────────────────

def test_ltcg_shared_pool_two_entries():
    """Two LTCG equity entries share one ₹1.25L pool."""
    entries = [
        {
            "asset_type": "listed_equity",
            "purchase_price": 100_000,
            "sale_price": 175_000,  # gain 75K
            "purchase_date": "2023-01-01",
            "sale_date": "2024-06-01",
        },
        {
            "asset_type": "equity_mf",
            "purchase_price": 100_000,
            "sale_price": 175_000,  # gain 75K
            "purchase_date": "2023-02-01",
            "sale_date": "2024-06-15",
        },
    ]
    result = compute_all_capital_gains(entries, slab_rate=0.30)
    summary = result["summary"]
    # Total LTCG = 150K; exemption pool = 125K; taxable = 25K
    assert summary["ltcg_exemption_used"] == pytest.approx(125_000, abs=1)
    assert summary["ltcg_exemption_remaining"] == pytest.approx(0, abs=1)
    # Tax on 25K at 10% = 2,500
    assert summary["total_capital_gains_tax"] == pytest.approx(2_500, abs=10)


def test_crypto_loss_not_carry_forward():
    """Crypto losses must not be carry-forward eligible."""
    entries = [
        {
            "asset_type": "crypto_vda",
            "purchase_price": 100_000,
            "sale_price": 50_000,  # loss 50K
            "purchase_date": "2023-01-01",
            "sale_date": "2024-01-01",
        }
    ]
    result = compute_all_capital_gains(entries, slab_rate=0.30)
    assert result["carry_forward_eligible"] is False
    assert len(result["loss_entries"]) == 1


def test_mixed_entries_total_tax():
    """STCG + LTCG + crypto in same batch — taxes summed correctly."""
    entries = [
        {
            "asset_type": "listed_equity",
            "purchase_price": 100_000,
            "sale_price": 130_000,   # STCG 30K (held 6m)
            "purchase_date": "2023-07-01",
            "sale_date": "2024-01-01",
        },
        {
            "asset_type": "crypto_vda",
            "purchase_price": 50_000,
            "sale_price": 80_000,    # crypto gain 30K, tax = 9K
            "purchase_date": "2023-01-01",
            "sale_date": "2024-01-01",
        },
    ]
    result = compute_all_capital_gains(entries, slab_rate=0.30)
    summary = result["summary"]
    # STCG equity 20% → 6K; crypto 30% → 9K; total = 15K
    assert summary["total_capital_gains_tax"] == pytest.approx(15_000, abs=10)


# ─── compute_interest_income ─────────────────────────────────────────────────

def test_80tta_savings_deduction():
    """Non-senior resident: savings interest up to ₹10K deducted (80TTA)."""
    result = compute_interest_income(
        fd_interest=0,
        savings_interest=8_000,
        other_interest=0,
        age=35,
        residential_status="Resident",
        regime="old",
    )
    assert result["deduction_80tta"] == 8_000
    assert result["taxable_interest"] == 0


def test_80tta_capped_at_10k():
    """80TTA capped at ₹10K even if savings interest > ₹10K."""
    result = compute_interest_income(
        savings_interest=15_000,
        age=35,
        residential_status="Resident",
        regime="old",
    )
    assert result["deduction_80tta"] == 10_000
    assert result["taxable_interest"] == 5_000


def test_80ttb_senior_replaces_80tta():
    """Senior citizen (age ≥ 60): 80TTB covers FD+savings up to ₹50K."""
    result = compute_interest_income(
        fd_interest=30_000,
        savings_interest=10_000,
        other_interest=5_000,
        age=62,
        residential_status="Resident",
        regime="old",
    )
    assert result["deduction_80ttb"] == 45_000   # 30K+10K+5K < 50K limit
    assert result["deduction_80tta"] == 0


def test_80ttb_capped_at_50k():
    """80TTB capped at ₹50K."""
    result = compute_interest_income(
        fd_interest=60_000,
        savings_interest=0,
        age=65,
        residential_status="Resident",
        regime="old",
    )
    assert result["deduction_80ttb"] == 50_000


def test_no_80tta_in_new_regime():
    """New regime: no 80TTA deduction."""
    result = compute_interest_income(
        savings_interest=8_000,
        age=35,
        residential_status="Resident",
        regime="new",
    )
    assert result["deduction_80tta"] == 0
    assert result["taxable_interest"] == 8_000


def test_nri_nro_taxable():
    """NRI: NRO interest taxable, TDS at 30%."""
    result = compute_interest_income(
        fd_interest=100_000,
        residential_status="NRI",
    )
    assert result["nre_exempt"] is True
    assert result["estimated_tds_on_fd"] == pytest.approx(30_000)


# ─── compute_rental_income ────────────────────────────────────────────────────

def test_self_occupied_sec24b_capped():
    """Self-occupied: Sec 24(b) capped at ₹2L; loss equals capped amount."""
    result = compute_rental_income(
        annual_rent_received=0,
        home_loan_interest=300_000,
        is_self_occupied=True,
    )
    assert result["sec24b_interest_deduction"] == 200_000
    assert result["net_income_from_hp"] == -200_000
    assert result["is_loss"] is True
    assert result["set_off_against_salary"] == 200_000


def test_let_out_sec24b_uncapped():
    """Let-out: Sec 24(b) interest is uncapped."""
    result = compute_rental_income(
        annual_rent_received=500_000,
        municipal_taxes_paid=20_000,
        home_loan_interest=400_000,
        is_self_occupied=False,
    )
    assert result["sec24b_interest_deduction"] == 400_000
    # NAV = 480K; Sec24a = 30% = 144K; Net HP = 480K - 144K - 400K = -64K
    assert result["net_income_from_hp"] == pytest.approx(-64_000, abs=1)
    assert result["is_loss"] is True


def test_let_out_positive_income():
    """Let-out with no loan: net HP income is positive."""
    result = compute_rental_income(
        annual_rent_received=300_000,
        municipal_taxes_paid=10_000,
        home_loan_interest=0,
        is_self_occupied=False,
    )
    # NAV = 290K; Sec24a = 30% = 87K; Net HP = 290K - 87K = 203K
    assert result["net_income_from_hp"] == pytest.approx(203_000, abs=1)
    assert result["is_loss"] is False


# ─── compute_nri_tax_profile ─────────────────────────────────────────────────

def test_nri_no_rebate_87a():
    """NRI profile: rebate_87a_eligible must be False."""
    result = compute_nri_tax_profile(residential_status="NRI", dtaa_country="USA")
    assert result["is_nri"] is True
    assert result["rebate_87a_eligible"] is False


def test_rnor_gets_rebate():
    """RNOR profile: rebate_87a_eligible must be True."""
    result = compute_nri_tax_profile(residential_status="RNOR")
    assert result["is_rnor"] is True
    assert result["rebate_87a_eligible"] is True


def test_dtaa_rates_loaded_for_usa():
    """USA DTAA: FD interest rate should be 15%."""
    result = compute_nri_tax_profile(residential_status="NRI", dtaa_country="USA")
    assert result["dtaa_applicable"] is True
    assert result["dtaa_fd_rate"] == pytest.approx(0.15)


def test_uae_no_dtaa():
    """UAE has no DTAA → dtaa_applicable = False."""
    result = compute_nri_tax_profile(residential_status="NRI", dtaa_country="UAE")
    assert result["dtaa_applicable"] is False
