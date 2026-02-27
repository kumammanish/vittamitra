import { useState } from 'react'
import type { AppState } from '../hooks/useAppState'
import { fmt } from '../hooks/useAppState'
import { apiClient, type ITRSummarySchedule } from '../services/api'

interface Props { state: AppState; update: (p: Partial<AppState>) => void }

export default function ITRSummaryPage({ state, update }: Props) {
    const [loading, setLoading] = useState(false)
    const [error,   setError]   = useState('')
    const summary = state.itrSummary as ITRSummarySchedule | null

    const generate = async () => {
        setLoading(true); setError('')
        try {
            const res = await apiClient.generateITRSummary({
                regime: 'old',
                include_capital_gains: true,
                include_other_income: true,
            })
            update({ itrSummary: res.data })
        } catch (e: any) {
            setError(e.response?.data?.detail || 'Failed to generate ITR summary.')
        } finally {
            setLoading(false)
        }
    }

    // Status indicators
    const sections = [
        { label: 'Form 16',       filled: !!state.form16Result?.gross_salary },
        { label: 'Other Income',  filled: !!state.otherIncomeResult },
        { label: 'Rental',        filled: state.annualRentReceived > 0 || state.isSelfOccupied },
        { label: 'Capital Gains', filled: !!state.capitalGainsResult },
        { label: 'NRI Status',    filled: !!state.nriProfile },
    ]

    return (
        <div className="no-print-header">
            <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '1.6rem', marginBottom: '0.3rem' }}>
                        🗂️ ITR Summary — FY 2024-25
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        Assessment Year 2025-26 · Advisory only — transcribe into actual ITR forms with CA guidance.
                    </p>
                </div>
                <button className="btn btn-ghost btn-sm no-print" onClick={() => window.print()}>
                    🖨️ Print
                </button>
            </div>

            {/* Status chips */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                {sections.map(s => (
                    <span key={s.label} style={{
                        padding: '0.25rem 0.75rem', borderRadius: 99, fontSize: '0.75rem', fontWeight: 600,
                        background: s.filled ? 'rgba(0,212,170,0.12)' : 'rgba(255,255,255,0.04)',
                        color: s.filled ? 'var(--success)' : 'var(--text-muted)',
                        border: `1px solid ${s.filled ? 'rgba(0,212,170,0.25)' : 'var(--border-lt)'}`,
                    }}>
                        {s.filled ? '✓' : '○'} {s.label}
                    </span>
                ))}
            </div>

            <button className="btn btn-primary no-print" onClick={generate} disabled={loading}
                style={{ marginBottom: '1.75rem' }}>
                {loading ? 'Generating…' : '🗂️ Generate / Refresh ITR Summary'}
            </button>
            {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</p>}

            {summary && (
                <div>
                    {/* Header info */}
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
                        <InfoBadge label="ITR Form"        value={summary.filing_type} />
                        <InfoBadge label="Regime"          value={summary.regime === 'old' ? 'Old Regime' : 'New Regime'} />
                        <InfoBadge label="Residential"     value={summary.residential_status} />
                        <InfoBadge label="Assessment Year" value={summary.assessment_year} />
                    </div>

                    {/* Schedule Salary */}
                    <ScheduleCard title="Schedule S — Salary Income" id="schedule-salary">
                        <ScheduleRow label="Gross Salary"          value={fmt(summary.schedule_salary.gross_salary ?? 0)} />
                        <ScheduleRow label="Less: Standard Deduction" value={`-${fmt(summary.schedule_salary.standard_deduction ?? 0)}`} />
                        <ScheduleRow label="Less: Professional Tax"   value={`-${fmt(summary.schedule_salary.professional_tax ?? 0)}`} />
                        <ScheduleRow label="Net Taxable Salary"       value={fmt(summary.schedule_salary.net_taxable_salary ?? 0)} bold total />
                    </ScheduleCard>

                    {/* Schedule HP */}
                    {(summary.schedule_hp.gross_annual_value > 0 || summary.schedule_hp.sec24b_deduction > 0) && (
                        <ScheduleCard title="Schedule HP — House Property" id="schedule-hp">
                            <ScheduleRow label="Gross Annual Value"     value={fmt(summary.schedule_hp.gross_annual_value ?? 0)} />
                            <ScheduleRow label="Less: Municipal Taxes"  value={`-${fmt(summary.schedule_hp.municipal_taxes ?? 0)}`} />
                            <ScheduleRow label="Net Annual Value"       value={fmt(summary.schedule_hp.net_annual_value ?? 0)} />
                            <ScheduleRow label="Less: Sec 24(a) 30%"    value={`-${fmt(summary.schedule_hp.sec24a_deduction ?? 0)}`} />
                            <ScheduleRow label="Less: Sec 24(b) Interest" value={`-${fmt(summary.schedule_hp.sec24b_deduction ?? 0)}`} />
                            <ScheduleRow label="Income from House Property" value={fmt(summary.schedule_hp.income_from_hp ?? 0)} bold total
                                valueColor={(summary.schedule_hp.income_from_hp ?? 0) < 0 ? 'var(--success)' : undefined} />
                        </ScheduleCard>
                    )}

                    {/* Schedule CG */}
                    {(summary.schedule_cg.total_cg_tax > 0 || summary.schedule_cg.ltcg_equity > 0) && (
                        <ScheduleCard title="Schedule CG — Capital Gains" id="schedule-cg">
                            {(summary.schedule_cg.ltcg_equity ?? 0) > 0 && (
                                <ScheduleRow label={`LTCG — Equity (10%, ₹${((summary.schedule_cg.ltcg_exemption_used ?? 0)/1000).toFixed(0)}K exempt)`}
                                    value={fmt(summary.schedule_cg.ltcg_equity ?? 0)} />
                            )}
                            {(summary.schedule_cg.stcg_equity ?? 0) > 0 && (
                                <ScheduleRow label="STCG — Equity (20%)" value={fmt(summary.schedule_cg.stcg_equity ?? 0)} />
                            )}
                            {(summary.schedule_cg.stcg_debt_property ?? 0) > 0 && (
                                <ScheduleRow label="STCG — Debt/Property (slab)" value={fmt(summary.schedule_cg.stcg_debt_property ?? 0)} />
                            )}
                            {(summary.schedule_cg.vda_income ?? 0) > 0 && (
                                <ScheduleRow label="Crypto/VDA Income (30%)" value={fmt(summary.schedule_cg.vda_income ?? 0)} />
                            )}
                            <ScheduleRow label="Capital Gains Tax" value={fmt(summary.schedule_cg.total_cg_tax ?? 0)} />
                            <ScheduleRow label="CG Tax + Cess"     value={fmt((summary.schedule_cg.total_cg_tax ?? 0) + (summary.schedule_cg.cg_cess ?? 0))} bold total />
                        </ScheduleCard>
                    )}

                    {/* Schedule OS */}
                    {(summary.schedule_os.gross_other_sources ?? 0) > 0 && (
                        <ScheduleCard title="Schedule OS — Other Sources" id="schedule-os">
                            {(summary.schedule_os.fd_interest ?? 0) > 0 && <ScheduleRow label="FD / Bank Interest" value={fmt(summary.schedule_os.fd_interest)} />}
                            {(summary.schedule_os.savings_interest ?? 0) > 0 && <ScheduleRow label="Savings Interest" value={fmt(summary.schedule_os.savings_interest)} />}
                            {(summary.schedule_os.other_interest ?? 0) > 0 && <ScheduleRow label="Other Interest" value={fmt(summary.schedule_os.other_interest)} />}
                            {(summary.schedule_os.dividend_income ?? 0) > 0 && <ScheduleRow label="Dividend Income" value={fmt(summary.schedule_os.dividend_income)} />}
                            <ScheduleRow label="Gross Other Sources Income" value={fmt(summary.schedule_os.gross_other_sources ?? 0)} bold total />
                        </ScheduleCard>
                    )}

                    {/* Schedule VI-A */}
                    {(summary.schedule_vi_a.total_deductions ?? 0) > 0 && (
                        <ScheduleCard title="Schedule VI-A — Deductions" id="schedule-via">
                            {(summary.schedule_vi_a['80C'] ?? 0) > 0           && <ScheduleRow label="Sec 80C (PPF/ELSS/LIC/PF)" value={fmt(summary.schedule_vi_a['80C'])} />}
                            {(summary.schedule_vi_a['80CCD1B_NPS'] ?? 0) > 0   && <ScheduleRow label="Sec 80CCD(1B) — NPS"      value={fmt(summary.schedule_vi_a['80CCD1B_NPS'])} />}
                            {(summary.schedule_vi_a['80D'] ?? 0) > 0           && <ScheduleRow label="Sec 80D — Health Insurance" value={fmt(summary.schedule_vi_a['80D'])} />}
                            {(summary.schedule_vi_a['80TTA_80TTB'] ?? 0) > 0   && <ScheduleRow label="Sec 80TTA / 80TTB — Interest" value={fmt(summary.schedule_vi_a['80TTA_80TTB'])} />}
                            <ScheduleRow label="Total Deductions" value={fmt(summary.schedule_vi_a.total_deductions ?? 0)} bold total />
                        </ScheduleCard>
                    )}

                    {/* Part B-TTI */}
                    <ScheduleCard title="Part B-TTI — Tax Computation" id="part-b-tti" highlight>
                        <ScheduleRow label="Total Income"              value={fmt(summary.part_b_tti.total_income ?? 0)} />
                        <ScheduleRow label="Tax on Total Income"       value={fmt(summary.part_b_tti.tax_on_total_income ?? 0)} />
                        {(summary.part_b_tti.rebate_87a ?? 0) > 0 && <ScheduleRow label="Less: Rebate 87A"  value={`-${fmt(summary.part_b_tti.rebate_87a)}`} />}
                        {(summary.part_b_tti.surcharge ?? 0) > 0    && <ScheduleRow label="Add: Surcharge"   value={fmt(summary.part_b_tti.surcharge)} />}
                        <ScheduleRow label="Health & Education Cess (4%)" value={fmt(summary.part_b_tti.cess ?? 0)} />
                        <ScheduleRow label="Total Tax Liability"      value={fmt(summary.part_b_tti.total_tax_liability ?? 0)} bold />
                        <ScheduleRow label="Less: TDS Deducted"       value={`-${fmt(summary.part_b_tti.tds_deducted ?? 0)}`} />
                        {(summary.part_b_tti.net_payable ?? 0) > 0
                            ? <ScheduleRow label="Tax Payable" value={fmt(summary.part_b_tti.net_payable)} bold total valueColor="var(--danger)" />
                            : <ScheduleRow label="Refund Due"  value={fmt(summary.part_b_tti.refund ?? 0)} bold total valueColor="var(--success)" />
                        }
                    </ScheduleCard>

                    {/* TDS Schedule */}
                    <ScheduleCard title="TDS Schedule" id="tds-schedule">
                        <ScheduleRow label="TDS on Salary (Form 16)"  value={fmt(summary.tds_schedule.tds_on_salary ?? 0)} />
                        {(summary.tds_schedule.tds_on_interest ?? 0) > 0 && <ScheduleRow label="TDS on Interest (26AS)" value={fmt(summary.tds_schedule.tds_on_interest)} />}
                        {(summary.tds_schedule.tds_on_dividend ?? 0) > 0 && <ScheduleRow label="TDS on Dividend"        value={fmt(summary.tds_schedule.tds_on_dividend)} />}
                        {(summary.tds_schedule.tds_on_crypto ?? 0)   > 0 && <ScheduleRow label="TDS on Crypto (1%)"     value={fmt(summary.tds_schedule.tds_on_crypto)} />}
                        <ScheduleRow label="Total TDS" value={fmt(summary.tds_schedule.total_tds ?? 0)} bold total />
                    </ScheduleCard>

                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '1.25rem', fontStyle: 'italic' }}>
                        ⚠️ Advisory only. This summary is for reference purposes. Verify all figures against your Form 26AS, AIS, and actual documents before filing your ITR.
                    </p>
                </div>
            )}
        </div>
    )
}

// ── Schedule Card ─────────────────────────────────────────────────────────────
function ScheduleCard({ title, id, children, highlight }: {
    title: string; id: string; children: React.ReactNode; highlight?: boolean
}) {
    const [collapsed, setCollapsed] = useState(false)

    const copyText = () => {
        const rows = document.querySelectorAll(`#${id} .schedule-row`)
        const lines = [title, '─'.repeat(50)]
        rows.forEach(r => {
            const [l, v] = r.querySelectorAll('span')
            if (l && v) lines.push(`${l.textContent?.padEnd(35, ' ')}${v.textContent}`)
        })
        navigator.clipboard.writeText(lines.join('\n'))
    }

    return (
        <div className="card itr-schedule-card" id={id} style={{ marginBottom: '1rem', borderLeft: highlight ? '3px solid var(--brand)' : undefined }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: collapsed ? 0 : '1rem', cursor: 'pointer' }}
                onClick={() => setCollapsed(c => !c)}>
                <h3 style={{ fontFamily: 'Outfit', fontWeight: 700, fontSize: '0.95rem', color: highlight ? 'var(--brand)' : 'var(--text-h)' }}>
                    {collapsed ? '▶' : '▼'} {title}
                </h3>
                <div style={{ display: 'flex', gap: '0.5rem' }} onClick={e => e.stopPropagation()}>
                    <button className="btn btn-ghost btn-sm no-print" onClick={copyText} style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem' }}>
                        📋 Copy
                    </button>
                </div>
            </div>
            {!collapsed && (
                <div style={{ borderTop: '1px solid var(--border-lt)', paddingTop: '0.85rem' }}>
                    {children}
                </div>
            )}
        </div>
    )
}

function ScheduleRow({ label, value, bold, total, valueColor }: {
    label: string; value: string; bold?: boolean; total?: boolean; valueColor?: string
}) {
    return (
        <div className="schedule-row" style={{
            display: 'flex', justifyContent: 'space-between',
            padding: `${total ? '0.6rem' : '0.35rem'} 0`,
            borderTop: total ? '1px solid var(--border-lt)' : undefined,
            marginTop: total ? '0.35rem' : undefined,
        }}>
            <span style={{ fontSize: '0.85rem', color: bold ? 'var(--text-h)' : 'var(--text-secondary)', fontWeight: bold ? 700 : 400 }}>{label}</span>
            <span style={{ fontSize: '0.85rem', fontWeight: bold ? 700 : 500, color: valueColor || (bold ? 'var(--text-h)' : undefined) }}>{value}</span>
        </div>
    )
}

function InfoBadge({ label, value }: { label: string; value: string }) {
    return (
        <div style={{ padding: '0.4rem 0.85rem', background: 'var(--bg-input)', borderRadius: 8, border: '1px solid var(--border-lt)' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block' }}>{label}</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{value}</span>
        </div>
    )
}
