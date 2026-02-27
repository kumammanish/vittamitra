import { useState } from 'react'
import { apiClient } from '../services/api'
import type { AppState } from '../hooks/useAppState'
import { fmt, fmtK } from '../hooks/useAppState'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { CheckCircle, TrendingDown } from 'lucide-react'

interface Props { state: AppState; update: (p: Partial<AppState>) => void }

export default function RegimeComparePage({ state, update }: Props) {
    const [result, setResult] = useState<any>(state.comparison)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const deductionsClaimed = {
        '80C': state.claimed80C,
        '80CCD1B': state.claimedNPS,
        '80D': state.claimed80D,
        HRA: state.claimedHRA,
        home_loan_interest: state.claimedHomeLoan,
    }

    const run = async () => {
        if (!state.grossIncome) { setError('Enter your gross income in Settings first.'); return }
        setLoading(true); setError('')
        try {
            const res = await apiClient.compareRegimes({
                gross_income: state.grossIncome,
                deductions: deductionsClaimed,
                tds_paid: state.tds,
            })
            setResult(res.data)
            update({ comparison: res.data })
        } catch (e: any) {
            setError(e?.response?.data?.detail || 'Computation failed.')
        } finally { setLoading(false) }
    }

    const TaxCard = ({ data, recommended }: { data: any; recommended: boolean }) => (
        <div className="card" style={{
            flex: 1, border: recommended ? '1.5px solid var(--brand-primary)' : undefined,
            background: recommended ? 'rgba(108,99,255,0.07)' : undefined,
            position: 'relative', overflow: 'hidden',
        }}>
            {recommended && (
                <div style={{ position: 'absolute', top: 12, right: 12 }}>
                    <span className="badge badge-info"><CheckCircle size={10} /> Recommended</span>
                </div>
            )}
            <h3 style={{ marginBottom: '1.25rem', fontSize: '1.1rem' }}>
                {data.regime === 'old' ? '🏛️ Old Regime' : '✨ New Regime'}
            </h3>
            {[
                ['Gross Income', fmt(data.gross_income)],
                ['Standard Deduction', `- ${fmt(data.standard_deduction)}`],
                ['Chapter VI-A Deductions', `- ${fmt(data.chapter_vi_deductions)}`],
                ['Taxable Income', fmt(data.taxable_income)],
                ['Base Tax', fmt(data.base_tax)],
                ['After Rebate 87A', fmt(data.tax_after_rebate_87a)],
                ['Surcharge', fmt(data.surcharge)],
                ['Cess (4%)', fmt(data.cess)],
            ].map(([l, v]) => (
                <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.45rem 0', borderBottom: '1px solid var(--border)', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{l}</span>
                    <span style={{ fontWeight: 500 }}>{v}</span>
                </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.8rem 0 0.3rem', fontSize: '1.1rem', fontWeight: 800 }}>
                <span>Total Tax</span>
                <span style={{ color: recommended ? 'var(--success)' : 'var(--danger)' }}>{fmt(data.total_tax)}</span>
            </div>
            {data.refund > 0 && (
                <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: 'rgba(0,212,170,0.1)', borderRadius: 8, fontSize: '0.82rem', color: 'var(--success)' }}>
                    🎉 Refund due: {fmt(data.refund)}
                </div>
            )}
            {data.net_payable > 0 && (
                <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: 'rgba(255,107,107,0.08)', borderRadius: 8, fontSize: '0.82rem', color: 'var(--danger)' }}>
                    ⚠️ Net payable: {fmt(data.net_payable)}
                </div>
            )}
        </div>
    )

    return (
        <div>
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>Regime Comparison</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Old vs New tax regime — side by side for FY 2024-25</p>
            </div>

            {/* Quick income inputs */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ marginBottom: '1rem', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>Income & Deduction Inputs</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
                    {[
                        ['Gross Annual Income (₹)', 'grossIncome'],
                        ['TDS Already Paid (₹)', 'tds'],
                        ['80C Investments (₹)', 'claimed80C'],
                        ['80D Health Insurance (₹)', 'claimed80D'],
                        ['HRA Exemption (₹)', 'claimedHRA'],
                        ['NPS 80CCD(1B) (₹)', 'claimedNPS'],
                    ].map(([label, key]) => (
                        <div key={key}>
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
                <button className="btn btn-primary" onClick={run} disabled={loading}>
                    {loading ? <span className="animate-spin" style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #ffffff60', borderTopColor: '#fff', borderRadius: '50%' }} /> : null}
                    {loading ? ' Computing…' : '⚖️ Compare Regimes'}
                </button>
                {error && <p style={{ color: 'var(--danger)', marginTop: '0.75rem', fontSize: '0.85rem' }}>⚠️ {error}</p>}
            </div>

            {result && (
                <>
                    {/* Recommendation banner */}
                    <div className="card" style={{
                        marginBottom: '1.5rem',
                        background: result.recommended === 'old' ? 'rgba(108,99,255,0.08)' : 'rgba(0,212,170,0.08)',
                        borderColor: result.recommended === 'old' ? 'rgba(108,99,255,0.3)' : 'rgba(0,212,170,0.3)',
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <TrendingDown size={20} color="var(--success)" />
                            <div>
                                <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>
                                    {result.recommended === 'old' ? '🏛️ Old Regime' : '✨ New Regime'} saves you{' '}
                                    <span style={{ color: 'var(--success)' }}>{fmt(Math.abs(result.saving_if_old))}</span>
                                </div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{result.recommendation_note}</div>
                            </div>
                        </div>
                    </div>

                    {/* Side-by-side cards */}
                    <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                        <TaxCard data={result.old} recommended={result.recommended === 'old'} />
                        <TaxCard data={result.new} recommended={result.recommended === 'new'} />
                    </div>

                    {/* Bar chart comparison */}
                    <div className="card">
                        <h4 style={{ marginBottom: '1.25rem', fontSize: '0.95rem' }}>Tax Breakdown Comparison</h4>
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={[
                                { name: 'Old Regime', tax: result.old.total_tax },
                                { name: 'New Regime', tax: result.new.total_tax },
                            ]}>
                                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                <YAxis tickFormatter={v => fmtK(v)} tick={{ fontSize: 10 }} />
                                <Tooltip formatter={(v: any) => fmt(v)} />
                                <Bar dataKey="tax" name="Total Tax" radius={[8, 8, 0, 0]}>
                                    <Cell fill={result.recommended === 'old' ? '#6C63FF' : 'rgba(108,99,255,0.35)'} />
                                    <Cell fill={result.recommended === 'new' ? '#00D4AA' : 'rgba(0,212,170,0.35)'} />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </>
            )}
        </div>
    )
}
