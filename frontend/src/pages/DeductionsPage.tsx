import { useState } from 'react'
import { apiClient } from '../services/api'
import type { AppState } from '../hooks/useAppState'
import { fmt } from '../hooks/useAppState'
import { TrendingUp, AlertTriangle, Info } from 'lucide-react'

interface Props { state: AppState; update: (p: Partial<AppState>) => void }

const RISK_COLORS: Record<string, string> = { Low: 'var(--success)', Medium: 'var(--warning)', High: 'var(--danger)' }
const RISK_BADGE: Record<string, string> = { Low: 'badge-success', Medium: 'badge-warning', High: 'badge-danger' }

export default function DeductionsPage({ state, update }: Props) {
    const [result, setResult] = useState<any>(state.deductions)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const run = async () => {
        if (!state.grossIncome) { setError('Enter your gross income first.'); return }
        setLoading(true); setError('')
        try {
            const res = await apiClient.analyzeDeductions({
                gross_income: state.grossIncome,
                claimed: {
                    '80C': state.claimed80C,
                    '80CCD1B': state.claimedNPS,
                    '80D': state.claimed80D,
                    HRA: state.claimedHRA,
                    home_loan_interest: state.claimedHomeLoan,
                },
                tds_paid: state.tds,
                age: state.age,
                has_parents: state.hasParents,
                parents_senior: false,
                is_metro: state.isMetro,
            })
            setResult(res.data)
            update({ deductions: res.data })
        } catch (e: any) {
            setError(e?.response?.data?.detail || 'Analysis failed.')
        } finally { setLoading(false) }
    }

    return (
        <div>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>Deduction Optimizer</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Identify missed savings across 80C, 80D, HRA and more</p>
            </div>

            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ marginBottom: '1rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Profile & Claimed Deductions</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
                    {([
                        ['Gross Income (₹)', 'grossIncome', 'number'],
                        ['Your Age', 'age', 'number'],
                        ['TDS Paid (₹)', 'tds', 'number'],
                        ['80C Investments (₹)', 'claimed80C', 'number'],
                        ['NPS 80CCD(1B) (₹)', 'claimedNPS', 'number'],
                        ['80D Insurance (₹)', 'claimed80D', 'number'],
                        ['HRA Exemption (₹)', 'claimedHRA', 'number'],
                        ['Home Loan Interest (₹)', 'claimedHomeLoan', 'number'],
                    ] as [string, keyof AppState, string][]).map(([label, key]) => (
                        <div key={key as string}>
                            <label>{label}</label>
                            <input
                                type="number"
                                value={(state as any)[key] || ''}
                                onChange={e => update({ [key]: parseFloat(e.target.value) || 0 } as any)}
                                placeholder="0"
                            />
                        </div>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                    {[
                        ['Metro City', 'isMetro'],
                        ['Have Dependent Parents', 'hasParents'],
                    ].map(([label, key]) => (
                        <label key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', textTransform: 'none', letterSpacing: 'normal' }}>
                            <input
                                type="checkbox"
                                style={{ width: 'auto' }}
                                checked={(state as any)[key]}
                                onChange={e => update({ [key]: e.target.checked } as any)}
                            />
                            {label}
                        </label>
                    ))}
                </div>
                <button className="btn btn-primary" onClick={run} disabled={loading}>
                    {loading ? '⏳ Analyzing…' : '💡 Analyze Deductions'}
                </button>
                {error && <p style={{ color: 'var(--danger)', marginTop: '0.75rem', fontSize: '0.85rem' }}>⚠️ {error}</p>}
            </div>

            {result && (
                <>
                    {/* Total potential saving banner */}
                    {result.total_potential_saving > 0 && (
                        <div className="card" style={{ marginBottom: '1.5rem', background: 'rgba(0,212,170,0.07)', borderColor: 'rgba(0,212,170,0.25)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <TrendingUp size={28} color="var(--success)" />
                            <div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>{fmt(result.total_potential_saving)}</div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total estimated tax saving opportunity</div>
                            </div>
                        </div>
                    )}

                    {/* Section-wise meters */}
                    <div className="card" style={{ marginBottom: '1.5rem' }}>
                        <h3 style={{ marginBottom: '1.25rem', fontSize: '1rem' }}>Deduction Utilization</h3>
                        {Object.entries(result.analysis || {}).map(([section, data]: [string, any]) => (
                            data.limit > 0 && (
                                <div key={section} style={{ marginBottom: '1.25rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.85rem' }}>
                                        <div>
                                            <span style={{ fontWeight: 600 }}>{section}</span>
                                            <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem', fontSize: '0.78rem' }}>{data.label}</span>
                                        </div>
                                        <div style={{ color: 'var(--text-secondary)' }}>
                                            {fmt(data.claimed)} / {fmt(data.limit)}
                                            <span style={{ marginLeft: '0.5rem', color: data.utilized_pct >= 100 ? 'var(--success)' : 'var(--warning)', fontWeight: 600 }}>
                                                {data.utilized_pct}%
                                            </span>
                                        </div>
                                    </div>
                                    <div className="progress-track">
                                        <div className="progress-fill" style={{ width: `${Math.min(100, data.utilized_pct)}%`, background: data.utilized_pct >= 100 ? 'var(--success)' : 'var(--grad-brand)' }} />
                                    </div>
                                    {data.remaining > 0 && (
                                        <div style={{ fontSize: '0.75rem', color: 'var(--warning)', marginTop: '0.3rem' }}>
                                            ₹{fmt(data.remaining)} more can be claimed
                                        </div>
                                    )}
                                </div>
                            )
                        ))}
                    </div>

                    {/* Opportunity cards */}
                    {result.opportunities?.length > 0 && (
                        <div>
                            <h3 style={{ marginBottom: '1rem', fontSize: '1rem' }}>
                                💡 Personalized Tax-Saving Opportunities ({result.opportunities.length})
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                                {result.opportunities.map((opp: any, i: number) => (
                                    <div key={i} className="card" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                                        <div style={{
                                            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                                            background: 'rgba(108,99,255,0.15)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            color: 'var(--brand-primary)', fontWeight: 700, fontSize: '0.75rem',
                                        }}>{opp.section}</div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.3rem' }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{opp.title}</div>
                                                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '1rem' }}>
                                                    <div style={{ fontWeight: 700, color: 'var(--success)', fontSize: '1rem' }}>Save {fmt(opp.saving_estimate)}</div>
                                                    <span className={`badge ${RISK_BADGE[opp.risk_level]}`}>{opp.risk_level} Risk</span>
                                                </div>
                                            </div>
                                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.83rem', lineHeight: 1.5 }}>{opp.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    )
}
