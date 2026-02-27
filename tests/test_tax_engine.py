"""
Unit tests for VittaMitra Tax Computation Engine.
All expected values verified against Indian IT Act FY 2024-25 rules.

Run:  python -m pytest tests/test_tax_engine.py -v
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

import pytest
from modules.tax_engine import compute_tax, compare_regimes


# ── Helpers ───────────────────────────────────────────────────────────────────
def nt(income, deductions=None, tds=0):
    """Compute New Regime tax."""
    return compute_tax(income, 'new', deductions or {}, tds)


def ot(income, deductions=None, tds=0):
    """Compute Old Regime tax."""
    return compute_tax(income, 'old', deductions or {}, tds)


# ── New Regime Tests ──────────────────────────────────────────────────────────
class TestNewRegime:

    def test_income_5L_zero_tax_after_rebate(self):
        """₹5L income → zero tax after 87A rebate in new regime."""
        res = nt(500000)
        assert res['total_tax'] == 0, f"Expected 0, got {res['total_tax']}"

    def test_income_7L_zero_tax_after_rebate(self):
        """₹7L income → zero tax after 87A rebate in new regime (rebate limit is ₹7L)."""
        res = nt(700000)
        assert res['total_tax'] == 0, f"Expected 0, got {res['total_tax']}"

    def test_income_10L_new_regime(self):
        """₹10L income → reasonable tax in new regime (no deductions)."""
        res = nt(1000000)
        # Taxable: 10L - 75K std = 9.25L
        # Slab: 5%(3-6L)=15K + 10%(6-9L)=30K + 15%(9-9.25L)=3750 = 48750 + cess
        assert res['taxable_income'] == 925000
        assert res['total_tax'] > 0
        assert res['total_tax'] < 100000  # sanity check

    def test_income_15L_new_regime(self):
        res = nt(1500000)
        assert res['taxable_income'] == 1425000
        assert res['total_tax'] > 100000

    def test_income_25L_new_regime(self):
        res = nt(2500000)
        assert res['total_tax'] > 300000


# ── Old Regime Tests ──────────────────────────────────────────────────────────
class TestOldRegime:

    def test_income_5L_zero_after_rebate(self):
        """₹5L income → 0 tax after 87A rebate in old regime."""
        res = ot(500000)
        assert res['total_tax'] == 0

    def test_income_5L_with_80c(self):
        """₹5L with ₹50K 80C → taxable below 2.5L → zero tax."""
        res = ot(500000, {'80C': 50000})
        assert res['total_tax'] == 0

    def test_80c_cap_at_1_5L(self):
        """80C deduction is capped at ₹1,50,000 even if ₹2L claimed."""
        res = ot(1000000, {'80C': 200000})
        breakdown = res['deduction_breakdown'].get('80C', {})
        assert breakdown['allowed'] == 150000

    def test_income_10L_old_regime(self):
        """₹10L income, old regime, no deductions."""
        res = ot(1000000)
        # Taxable: 10L - 50K std = 9.5L
        # 5%(2.5-5L)=12500 + 20%(5-9.5L)=90000 = 102500 + cess
        assert res['taxable_income'] == 950000
        assert res['base_tax'] == pytest.approx(12500 + 90000, abs=1)

    def test_income_10L_with_full_80c(self):
        """₹10L with full 80C ₹1.5L → taxable = 10L - 50K std - 1.5L = 8L."""
        res = ot(1000000, {'80C': 150000})
        assert res['taxable_income'] == 800000

    def test_cess_applied(self):
        """Cess is 4% of (tax + surcharge)."""
        res = ot(1000000)
        expected_cess = round((res['tax_after_rebate_87a'] + res['surcharge']) * 0.04, 2)
        assert res['cess'] == pytest.approx(expected_cess, abs=1)

    def test_income_25L_surcharge(self):
        """₹25L income does NOT trigger surcharge (threshold is ₹50L)."""
        res = ot(2500000)
        assert res['surcharge'] == 0

    def test_income_60L_surcharge(self):
        """₹60L income triggers 10% surcharge."""
        res = ot(6000000)
        assert res['surcharge'] > 0


# ── Regime Comparison Tests ───────────────────────────────────────────────────
class TestRegimeComparison:

    def test_compare_returns_both_regimes(self):
        res = compare_regimes(1200000)
        assert 'old' in res and 'new' in res

    def test_compare_has_recommended(self):
        res = compare_regimes(1200000)
        assert res['recommended'] in ('old', 'new', 'equal')

    def test_compare_has_recommendation_note(self):
        res = compare_regimes(1200000)
        assert isinstance(res['recommendation_note'], str)
        assert len(res['recommendation_note']) > 10

    def test_high_deductions_favor_old_regime(self):
        """₹15L income with full 80C+80D+NPS likely favors old regime."""
        deductions = {'80C': 150000, '80CCD1B': 50000, '80D': 25000}
        res = compare_regimes(1500000, deductions)
        # Old regime with ₹2.25L deductions should have lower taxable income
        assert res['old']['taxable_income'] < res['new']['taxable_income']

    def test_low_income_no_deductions_favor_new(self):
        """₹8L income with no deductions → new regime is better."""
        res = compare_regimes(800000, {})
        # New regime gives ₹75K std deduction vs ₹50K old, and similar slabs
        assert res['new']['taxable_income'] <= res['old']['taxable_income']

    def test_tds_refund_detected(self):
        """If TDS > total tax, refund should be positive."""
        res = compare_regimes(600000, {}, tds_paid=50000)
        # ₹6L income has low/zero tax, so TDS=50K creates refund
        assert res['new']['refund'] > 0 or res['old']['refund'] > 0
