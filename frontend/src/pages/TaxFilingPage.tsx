import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import type { AppState } from '../hooks/useAppState'
import { fmt } from '../hooks/useAppState'
import { apiClient, type CapitalGainEntry } from '../services/api'

type FilingSection = 'form16' | 'otherIncome' | 'rental' | 'capitalGains' | 'nri'

const SUB_TABS: { id: FilingSection; label: string }[] = [
    { id: 'form16',       label: '📄 Form 16' },
    { id: 'otherIncome',  label: '💰 Interest & Dividends' },
    { id: 'rental',       label: '🏠 Rental Income' },
    { id: 'capitalGains', label: '📈 Capital Gains' },
    { id: 'nri',          label: '🌏 NRI / Foreign Income' },
]

const ASSET_TYPE_LABELS: Record<string, string> = {
    listed_equity: 'Listed Equity (Shares)',
    equity_mf:     'Equity Mutual Fund',
    debt_mf:       'Debt MF / Bonds',
    property:      'Property (Real Estate)',
    crypto_vda:    'Crypto / VDA',
}

interface Props { state: AppState; update: (p: Partial<AppState>) => void }

export default function TaxFilingPage({ state, update }: Props) {
    const [section, setSection] = useState<FilingSection>('form16')

    return (
        <div>
            <div style={{ marginBottom: '1.5rem' }}>
                <h1 style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '1.6rem', marginBottom: '0.3rem' }}>
                    📋 Tax Filing Assistance
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Enter all income sources to generate your ITR-ready summary. Advisory only — consult a CA before filing.
                </p>
            </div>

            {/* Sub-tab pills */}
            <div className="filing-subtabs">
                {SUB_TABS.map(t => (
                    <button key={t.id} className={`filing-subtab-btn${section === t.id ? ' active' : ''}`}
                        onClick={() => setSection(t.id)}>
                        {t.label}
                    </button>
                ))}
            </div>

            <div className="animate-fadeUp">
                {section === 'form16'       && <Form16Section state={state} update={update} />}
                {section === 'otherIncome'  && <OtherIncomeSection state={state} update={update} />}
                {section === 'rental'       && <RentalSection state={state} update={update} />}
                {section === 'capitalGains' && <CapitalGainsSection state={state} update={update} />}
                {section === 'nri'          && <NRISection state={state} update={update} />}
            </div>
        </div>
    )
}

// ── Form 16 Section ───────────────────────────────────────────────────────────
function Form16Section({ state, update }: Props) {
    const [loading, setLoading] = useState(false)
    const [error,   setError]   = useState('')
    const result = state.form16Result

    const onDrop = useCallback(async (files: File[]) => {
        if (!files[0]) return
        setLoading(true); setError('')
        const fd = new FormData()
        fd.append('file', files[0])
        try {
            const res = await apiClient.parseForm16(fd)
            update({ form16Result: res.data })
        } catch (e: any) {
            setError(e.response?.data?.detail || 'Failed to parse Form 16.')
        } finally {
            setLoading(false)
        }
    }, [update])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop, accept: { 'application/pdf': ['.pdf'], 'application/vnd.ms-excel': ['.xls'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] },
        maxFiles: 1,
    })

    const confidenceColor = (c?: string) =>
        c === 'high' ? 'var(--success)' : c === 'medium' ? 'var(--warning)' : 'var(--danger)'

    return (
        <div className="card">
            <h2 style={{ fontSize: '1.1rem', marginBottom: '0.4rem' }}>Form 16 / 16A / 16B Parser</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                Upload the TDS certificate issued by your employer. Supports PDF and Excel exports.
            </p>

            <div {...getRootProps()} style={{
                border: `2px dashed ${isDragActive ? 'var(--brand)' : 'var(--border-lt)'}`,
                borderRadius: 12, padding: '2rem', textAlign: 'center', cursor: 'pointer',
                background: isDragActive ? 'rgba(108,92,231,0.06)' : 'var(--bg-input)',
                marginBottom: '1.25rem', transition: 'all .2s',
            }}>
                <input {...getInputProps()} />
                {loading
                    ? <p style={{ color: 'var(--text-muted)' }}>Parsing Form 16…</p>
                    : isDragActive
                        ? <p style={{ color: 'var(--brand)' }}>Drop Form 16 here…</p>
                        : <p style={{ color: 'var(--text-muted)' }}>
                            📎 Drag & drop Form 16 (PDF / XLSX / XLS) or <span style={{ color: 'var(--brand)', fontWeight: 600 }}>browse</span>
                        </p>
                }
            </div>

            {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.85rem' }}>{error}</p>}

            {result && (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                            Parse confidence:
                        </span>
                        <span className="badge" style={{ background: confidenceColor(result.parse_confidence), color: '#fff', fontSize: '0.75rem' }}>
                            {result.parse_confidence?.toUpperCase()}
                        </span>
                    </div>

                    {result.notes?.length > 0 && (
                        <div style={{ background: 'rgba(255,179,71,0.1)', border: '1px solid rgba(255,179,71,0.3)', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.82rem', color: 'var(--warning)' }}>
                            {result.notes.map((n: string, i: number) => <p key={i}>{n}</p>)}
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem 1.5rem', marginBottom: '1.25rem' }}>
                        {[
                            ['Employer', result.employer_name],
                            ['TAN', result.employer_tan],
                            ['Employee', result.employee_name],
                            ['PAN', result.employee_pan],
                            ['Assessment Year', result.assessment_year],
                            ['Gross Salary', result.gross_salary != null ? fmt(result.gross_salary) : null],
                            ['TDS Deducted', result.tds_deducted != null ? fmt(result.tds_deducted) : null],
                            ['Net Taxable Salary', result.net_taxable_salary != null ? fmt(result.net_taxable_salary) : null],
                        ].map(([label, val]) => val != null && (
                            <div key={label as string}>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>{label}</span>
                                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{val}</span>
                            </div>
                        ))}
                    </div>

                    <button className="btn btn-primary" style={{ fontSize: '0.85rem' }}
                        onClick={() => update({
                            grossIncome: result.gross_salary ?? state.grossIncome,
                            tds: result.tds_deducted ?? state.tds,
                        })}>
                        ▶ Use this data — auto-fill income &amp; TDS
                    </button>
                </div>
            )}
        </div>
    )
}

// ── Interest & Dividend Section ───────────────────────────────────────────────
function OtherIncomeSection({ state, update }: Props) {
    const [loading, setLoading] = useState(false)
    const [error,   setError]   = useState('')
    const result = state.otherIncomeResult

    const compute = async () => {
        setLoading(true); setError('')
        try {
            const [intRes, divRes] = await Promise.all([
                apiClient.computeInterestIncome({
                    fd_interest: state.fdInterest,
                    savings_interest: state.savingsInterest,
                    other_interest: state.otherInterest,
                    age: state.age,
                    residential_status: state.residentialStatus,
                    regime: 'old',
                    dtaa_country: state.dtaaCountry || undefined,
                }),
                apiClient.computeDividendIncome({
                    dividend_amount: state.dividendIncome,
                    age: state.age,
                    residential_status: state.residentialStatus,
                    dtaa_country: state.dtaaCountry || undefined,
                }),
            ])
            update({ otherIncomeResult: { interest: intRes.data, dividend: divRes.data } })
        } catch (e: any) {
            setError(e.response?.data?.detail || 'Computation failed.')
        } finally {
            setLoading(false)
        }
    }

    const int = result?.interest
    const div = result?.dividend

    return (
        <div className="card">
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1.25rem' }}>Interest &amp; Dividend Income</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
                {([
                    ['FD / Bank Interest (₹)', 'fdInterest'],
                    ['Savings A/C Interest (₹)', 'savingsInterest'],
                    ['Other Interest (₹)', 'otherInterest'],
                    ['Dividend Income (₹)', 'dividendIncome'],
                ] as [string, keyof AppState][]).map(([label, key]) => (
                    <div key={key as string}>
                        <label>{label}</label>
                        <input type="number" value={(state as any)[key] || ''} placeholder="0"
                            onChange={e => update({ [key]: parseFloat(e.target.value) || 0 } as any)} />
                    </div>
                ))}
            </div>

            <button className="btn btn-primary" onClick={compute} disabled={loading} style={{ marginBottom: '1.5rem' }}>
                {loading ? 'Computing…' : '💰 Compute Tax on Interest & Dividends'}
            </button>
            {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</p>}

            {int && (
                <div style={{ marginBottom: '1.25rem' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>Interest Income</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1.5rem', fontSize: '0.88rem' }}>
                        <WRow label="Gross Interest" value={fmt(int.gross_interest)} />
                        {int.deduction_80ttb > 0 && <WRow label="Less: 80TTB Deduction" value={`-${fmt(int.deduction_80ttb)}`} neg />}
                        {int.deduction_80tta > 0 && <WRow label="Less: 80TTA Deduction" value={`-${fmt(int.deduction_80tta)}`} neg />}
                        <WRow label="Taxable Interest" value={fmt(int.taxable_interest)} bold />
                        <WRow label="Estimated TDS on FD" value={fmt(int.estimated_tds_on_fd)} />
                    </div>
                    {int.notes?.length > 0 && <Notes notes={int.notes} />}
                </div>
            )}

            {div && div.dividend_amount > 0 && (
                <div>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>Dividend Income</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1.5rem', fontSize: '0.88rem' }}>
                        <WRow label="Dividend (Taxable at slab)" value={fmt(div.taxable_dividend)} bold />
                        <WRow label="Estimated TDS" value={fmt(div.estimated_tds)} />
                    </div>
                    {div.notes?.length > 0 && <Notes notes={div.notes} />}
                </div>
            )}
        </div>
    )
}

// ── Rental Income Section ─────────────────────────────────────────────────────
function RentalSection({ state, update }: Props) {
    const [loading, setLoading] = useState(false)
    const [error,   setError]   = useState('')
    const [result,  setResult]  = useState<any>(null)

    const compute = async () => {
        setLoading(true); setError('')
        try {
            const res = await apiClient.computeRentalIncome({
                annual_rent_received: state.annualRentReceived,
                municipal_taxes_paid: state.municipalTaxesPaid,
                home_loan_interest: state.rentalHomeLoanInterest,
                is_self_occupied: state.isSelfOccupied,
            })
            setResult(res.data)
        } catch (e: any) {
            setError(e.response?.data?.detail || 'Computation failed.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="card">
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1.25rem' }}>Rental Income — House Property (Sec 24)</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                    <label>Annual Rent Received (₹)</label>
                    <input type="number" value={state.annualRentReceived || ''} placeholder="0"
                        onChange={e => update({ annualRentReceived: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                    <label>Municipal Taxes Paid (₹)</label>
                    <input type="number" value={state.municipalTaxesPaid || ''} placeholder="0"
                        onChange={e => update({ municipalTaxesPaid: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                    <label>Home Loan Interest (₹)</label>
                    <input type="number" value={state.rentalHomeLoanInterest || ''} placeholder="0"
                        onChange={e => update({ rentalHomeLoanInterest: parseFloat(e.target.value) || 0 })} />
                </div>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer',
                textTransform: 'none', letterSpacing: 'normal', fontSize: '0.88rem', fontWeight: 'normal',
                marginBottom: '1.25rem' }}>
                <input type="checkbox" style={{ width: 'auto', cursor: 'pointer' }}
                    checked={state.isSelfOccupied}
                    onChange={e => update({ isSelfOccupied: e.target.checked })} />
                This is a Self-Occupied Property (no rent received)
            </label>

            <button className="btn btn-primary" onClick={compute} disabled={loading} style={{ marginBottom: '1.5rem' }}>
                {loading ? 'Computing…' : '🏠 Compute House Property Income'}
            </button>
            {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</p>}

            {result && (
                <div>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.85rem', color: 'var(--text-secondary)' }}>
                        Sec 24 Computation
                    </h3>
                    <div style={{ maxWidth: 440 }}>
                        <WaterfallRow label="Gross Annual Value (GAV)" value={fmt(result.gross_annual_value)} />
                        <WaterfallRow label="Less: Municipal Taxes" value={`-${fmt(result.municipal_taxes_paid)}`} neg />
                        <WaterfallRow label="Net Annual Value (NAV)" value={fmt(result.net_annual_value)} />
                        {result.sec24a_standard_deduction > 0 &&
                            <WaterfallRow label="Less: Sec 24(a) — 30% std deduction" value={`-${fmt(result.sec24a_standard_deduction)}`} neg />}
                        <WaterfallRow label="Less: Sec 24(b) — Loan Interest" value={`-${fmt(result.sec24b_interest_deduction)}`} neg />
                        <WaterfallRow label="Net Income from House Property" value={fmt(result.net_income_from_hp)} bold total
                            valueStyle={{ color: result.is_loss ? 'var(--success)' : 'var(--text-h)' }} />
                    </div>
                    {result.is_loss && (
                        <div style={{ marginTop: '0.75rem', padding: '0.6rem 1rem', background: 'rgba(0,212,170,0.08)',
                            border: '1px solid rgba(0,212,170,0.2)', borderRadius: 8, fontSize: '0.82rem', color: 'var(--success)' }}>
                            ✓ Loss of {fmt(Math.abs(result.net_income_from_hp))} can be set off against salary income
                            (up to {fmt(result.set_off_against_salary)} this year).
                        </div>
                    )}
                    {result.notes?.length > 0 && <Notes notes={result.notes} />}
                </div>
            )}
        </div>
    )
}

// ── Capital Gains Section ─────────────────────────────────────────────────────
const EMPTY_ENTRY: Omit<CapitalGainEntry, 'asset_type'> & { asset_type: CapitalGainEntry['asset_type'] } = {
    asset_type: 'listed_equity', description: '', purchase_price: 0, sale_price: 0,
    purchase_date: '', sale_date: '', cost_of_improvement: 0, property_acquired_pre_jul23: false,
}

function CapitalGainsSection({ state, update }: Props) {
    const [loading,  setLoading]  = useState(false)
    const [error,    setError]    = useState('')
    const [entries,  setEntries]  = useState<CapitalGainEntry[]>([])
    const [newEntry, setNewEntry] = useState<CapitalGainEntry>({ ...EMPTY_ENTRY })
    const [showForm, setShowForm] = useState(false)
    const result = state.capitalGainsResult

    const addEntry = () => {
        if (!newEntry.purchase_date || !newEntry.sale_date) {
            setError('Please fill in all date fields.'); return
        }
        setEntries(prev => [...prev, { ...newEntry }])
        setNewEntry({ ...EMPTY_ENTRY })
        setShowForm(false); setError('')
    }

    const removeEntry = (i: number) => setEntries(prev => prev.filter((_, idx) => idx !== i))

    const compute = async () => {
        if (!entries.length) { setError('Add at least one transaction first.'); return }
        setLoading(true); setError('')
        try {
            const res = await apiClient.computeCapitalGains({ entries, slab_rate: 0.30 })
            update({ capitalGainsResult: res.data })
        } catch (e: any) {
            setError(e.response?.data?.detail || 'Computation failed.')
        } finally {
            setLoading(false)
        }
    }

    const sum = result?.summary

    return (
        <div className="card">
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1.25rem' }}>Capital Gains Schedule</h2>

            {/* Entry form */}
            {showForm ? (
                <div style={{ background: 'var(--bg-input)', borderRadius: 10, padding: '1.25rem', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.85rem', marginBottom: '0.85rem' }}>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label>Asset Type</label>
                            <select value={newEntry.asset_type}
                                onChange={e => setNewEntry(p => ({ ...p, asset_type: e.target.value as any }))}>
                                {Object.entries(ASSET_TYPE_LABELS).map(([v, l]) =>
                                    <option key={v} value={v}>{l}</option>)}
                            </select>
                        </div>
                        <div style={{ gridColumn: '1 / -1' }}>
                            <label>Description (optional)</label>
                            <input value={newEntry.description} placeholder="e.g. HDFC Bank 100 shares"
                                onChange={e => setNewEntry(p => ({ ...p, description: e.target.value }))} />
                        </div>
                        <div>
                            <label>Purchase Price (₹)</label>
                            <input type="number" value={newEntry.purchase_price || ''} placeholder="0"
                                onChange={e => setNewEntry(p => ({ ...p, purchase_price: parseFloat(e.target.value) || 0 }))} />
                        </div>
                        <div>
                            <label>Sale Price (₹)</label>
                            <input type="number" value={newEntry.sale_price || ''} placeholder="0"
                                onChange={e => setNewEntry(p => ({ ...p, sale_price: parseFloat(e.target.value) || 0 }))} />
                        </div>
                        {newEntry.asset_type === 'property' && (
                            <div>
                                <label>Cost of Improvement (₹)</label>
                                <input type="number" value={newEntry.cost_of_improvement || ''} placeholder="0"
                                    onChange={e => setNewEntry(p => ({ ...p, cost_of_improvement: parseFloat(e.target.value) || 0 }))} />
                            </div>
                        )}
                        <div>
                            <label>Purchase Date</label>
                            <input type="date" value={newEntry.purchase_date}
                                onChange={e => setNewEntry(p => ({ ...p, purchase_date: e.target.value }))} />
                        </div>
                        <div>
                            <label>Sale Date</label>
                            <input type="date" value={newEntry.sale_date}
                                onChange={e => setNewEntry(p => ({ ...p, sale_date: e.target.value }))} />
                        </div>
                        {newEntry.asset_type === 'property' && (
                            <div style={{ gridColumn: '1 / -1' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer',
                                    textTransform: 'none', letterSpacing: 'normal', fontSize: '0.88rem', fontWeight: 'normal' }}>
                                    <input type="checkbox" style={{ width: 'auto' }}
                                        checked={newEntry.property_acquired_pre_jul23}
                                        onChange={e => setNewEntry(p => ({ ...p, property_acquired_pre_jul23: e.target.checked }))} />
                                    Property acquired before Jul 23, 2024 (can choose old indexation rules)
                                </label>
                            </div>
                        )}
                    </div>
                    {error && <p style={{ color: 'var(--danger)', fontSize: '0.82rem', marginBottom: '0.75rem' }}>{error}</p>}
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button className="btn btn-primary" onClick={addEntry}>+ Add</button>
                        <button className="btn btn-ghost" onClick={() => { setShowForm(false); setError('') }}>Cancel</button>
                    </div>
                </div>
            ) : (
                <button className="btn btn-ghost" style={{ marginBottom: '1.25rem', fontSize: '0.85rem' }}
                    onClick={() => setShowForm(true)}>+ Add Transaction</button>
            )}

            {/* Entries table */}
            {entries.length > 0 && (
                <div style={{ marginBottom: '1.25rem', overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-lt)', color: 'var(--text-muted)', textAlign: 'left' }}>
                                <th style={{ padding: '0.4rem 0.6rem' }}>Asset</th>
                                <th style={{ padding: '0.4rem 0.6rem' }}>Description</th>
                                <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>Buy</th>
                                <th style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>Sell</th>
                                <th style={{ padding: '0.4rem 0.6rem' }}>Dates</th>
                                <th style={{ padding: '0.4rem 0.6rem' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map((e, i) => (
                                <tr key={i} style={{ borderBottom: '1px solid var(--border-lt)' }}>
                                    <td style={{ padding: '0.4rem 0.6rem' }}>{ASSET_TYPE_LABELS[e.asset_type]}</td>
                                    <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-muted)' }}>{e.description || '—'}</td>
                                    <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>{fmt(e.purchase_price)}</td>
                                    <td style={{ padding: '0.4rem 0.6rem', textAlign: 'right' }}>{fmt(e.sale_price)}</td>
                                    <td style={{ padding: '0.4rem 0.6rem', color: 'var(--text-muted)' }}>
                                        {e.purchase_date} → {e.sale_date}
                                    </td>
                                    <td style={{ padding: '0.4rem 0.6rem' }}>
                                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)', padding: '0.2rem 0.5rem' }}
                                            onClick={() => removeEntry(i)}>✕</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {!showForm && (
                <button className="btn btn-primary" onClick={compute} disabled={loading || !entries.length}
                    style={{ marginBottom: '1.5rem' }}>
                    {loading ? 'Computing…' : '📈 Compute Capital Gains Tax'}
                </button>
            )}
            {error && !showForm && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</p>}

            {sum && (
                <div>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.85rem', color: 'var(--text-secondary)' }}>
                        Capital Gains Tax Summary
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '0.5rem 1.5rem', fontSize: '0.88rem', marginBottom: '1rem' }}>
                        {sum.total_stcg_equity > 0 && <WRow label="STCG — Equity (20%)" value={fmt(sum.total_tax_stcg_equity)} />}
                        {sum.total_ltcg_equity > 0 && <WRow label={`LTCG — Equity (10%) [₹${(sum.ltcg_exemption_used/1000).toFixed(0)}K exempt]`} value={fmt(sum.total_tax_ltcg)} />}
                        {sum.total_stcg_debt_property > 0 && <WRow label="STCG — Debt/Property (slab)" value={fmt(sum.total_tax_slab_rate)} />}
                        {sum.total_crypto_gain > 0 && <WRow label="Crypto/VDA (30%)" value={fmt(sum.total_tax_crypto)} />}
                        <WRow label="Cess (4%)" value={fmt(sum.cess)} />
                        <WRow label="Total Capital Gains Tax" value={fmt(sum.total_with_cess)} bold />
                    </div>
                    {result.schedule_cg_notes?.map((n: string, i: number) => (
                        <p key={i} style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>💡 {n}</p>
                    ))}
                    {result.carry_forward_eligible && (
                        <p style={{ fontSize: '0.82rem', color: 'var(--warning)', marginTop: '0.5rem' }}>
                            ⚠️ Some losses are eligible for 8-year carry-forward. Report them in Schedule CFL of your ITR.
                        </p>
                    )}

                    {/* Per-entry results */}
                    {result.entries?.filter((e: any) => !e.is_loss).map((e: any, i: number) => (
                        <div key={i} style={{ marginTop: '0.75rem', padding: '0.75rem 1rem',
                            background: 'var(--bg-input)', borderRadius: 8, fontSize: '0.82rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                <strong>{e.description || ASSET_TYPE_LABELS[e.asset_type]}</strong>
                                <span className="badge" style={{ fontSize: '0.72rem' }}>{e.gain_type?.toUpperCase()} @ {(e.tax_rate * 100).toFixed(0)}%</span>
                            </div>
                            <span style={{ color: 'var(--text-muted)' }}>
                                Held {e.months_held}mo · Gain {fmt(e.gross_gain)} · Tax {fmt(e.tax_amount)}
                            </span>
                            {e.option_b_property && (
                                <div style={{ marginTop: '0.4rem', padding: '0.4rem 0.6rem',
                                    background: 'rgba(255,179,71,0.08)', borderRadius: 6, color: 'var(--warning)' }}>
                                    {e.option_b_property.note}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

// ── NRI Section ───────────────────────────────────────────────────────────────
const DTAA_COUNTRIES = [
    { code: 'USA', name: 'United States' }, { code: 'UK', name: 'United Kingdom' },
    { code: 'UAE', name: 'UAE' }, { code: 'SGP', name: 'Singapore' },
    { code: 'AUS', name: 'Australia' }, { code: 'CAN', name: 'Canada' },
    { code: 'DEU', name: 'Germany' }, { code: 'NLD', name: 'Netherlands' },
]

function NRISection({ state, update }: Props) {
    const [loading, setLoading] = useState(false)
    const [error,   setError]   = useState('')
    const result = state.nriProfile

    const [nroFD, setNroFD] = useState(0)
    const [nreFD, setNreFD] = useState(0)

    const submit = async () => {
        setLoading(true); setError('')
        try {
            const res = await apiClient.setNRIProfile({
                residential_status: state.residentialStatus,
                dtaa_country: state.dtaaCountry || undefined,
                fd_interest_nro: nroFD,
                fd_interest_nre: nreFD,
                gross_income: state.grossIncome,
            })
            update({ nriProfile: res.data })
        } catch (e: any) {
            setError(e.response?.data?.detail || 'Failed to set NRI profile.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="card">
            <h2 style={{ fontSize: '1.1rem', marginBottom: '1.25rem' }}>NRI / Foreign Income Status</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                    <label>Residential Status (FY 2024-25)</label>
                    <select value={state.residentialStatus}
                        onChange={e => update({ residentialStatus: e.target.value as any, nriProfile: null })}>
                        <option value="Resident">Resident Indian</option>
                        <option value="RNOR">RNOR (Resident, Not Ordinarily Resident)</option>
                        <option value="NRI">NRI (Non-Resident Indian)</option>
                    </select>
                </div>
                {state.residentialStatus === 'NRI' && (
                    <div>
                        <label>DTAA Country</label>
                        <select value={state.dtaaCountry}
                            onChange={e => update({ dtaaCountry: e.target.value })}>
                            <option value="">— Select country —</option>
                            {DTAA_COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                        </select>
                    </div>
                )}
                {state.residentialStatus === 'NRI' && (
                    <>
                        <div>
                            <label>NRO FD Interest (₹) — taxable</label>
                            <input type="number" value={nroFD || ''} placeholder="0"
                                onChange={e => setNroFD(parseFloat(e.target.value) || 0)} />
                        </div>
                        <div>
                            <label>NRE FD Interest (₹) — exempt</label>
                            <input type="number" value={nreFD || ''} placeholder="0"
                                onChange={e => setNreFD(parseFloat(e.target.value) || 0)} />
                        </div>
                    </>
                )}
            </div>

            <button className="btn btn-primary" onClick={submit} disabled={loading} style={{ marginBottom: '1.5rem' }}>
                {loading ? 'Saving…' : '🌏 Set NRI Profile'}
            </button>
            {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</p>}

            {result && (
                <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '0.85rem', marginBottom: '1rem' }}>
                        <InfoCard label="Status" value={result.residential_status} />
                        <InfoCard label="Sec 87A Rebate" value={result.rebate_87a_eligible ? '✓ Eligible' : '✗ Not Eligible'}
                            valueColor={result.rebate_87a_eligible ? 'var(--success)' : 'var(--danger)'} />
                        {result.is_nri && (
                            <InfoCard label="NRE Interest" value="Exempt from Indian Tax" valueColor="var(--success)" />
                        )}
                        {result.dtaa_applicable && result.dtaa_fd_rate != null && (
                            <InfoCard label={`DTAA (${result.dtaa_country})`}
                                value={`FD: ${(result.dtaa_fd_rate * 100).toFixed(0)}% · Div: ${(result.dtaa_dividend_rate * 100).toFixed(0)}%`} />
                        )}
                    </div>
                    {result.nri_notes?.length > 0 && (
                        <div style={{ background: 'rgba(108,99,255,0.08)', border: '1px solid rgba(108,99,255,0.2)',
                            borderRadius: 8, padding: '0.75rem 1rem', fontSize: '0.82rem' }}>
                            {result.nri_notes.map((n: string, i: number) => (
                                <p key={i} style={{ marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>💡 {n}</p>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ── Shared micro-components ───────────────────────────────────────────────────
function WRow({ label, value, neg, bold }: { label: string; value: string; neg?: boolean; bold?: boolean }) {
    return (
        <>
            <span style={{ color: neg ? 'var(--text-muted)' : 'var(--text-secondary)', fontWeight: bold ? 700 : 400 }}>{label}</span>
            <span style={{ textAlign: 'right', color: neg ? 'var(--success)' : bold ? 'var(--text-h)' : undefined, fontWeight: bold ? 700 : 400 }}>{value}</span>
        </>
    )
}

function WaterfallRow({ label, value, neg, bold, total, valueStyle }: {
    label: string; value: string; neg?: boolean; bold?: boolean; total?: boolean; valueStyle?: React.CSSProperties
}) {
    return (
        <div className={`waterfall-row${total ? ' total' : ''}`}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: bold ? 700 : 400 }}>{label}</span>
            <span style={{ color: neg ? 'var(--success)' : undefined, ...valueStyle, fontWeight: bold ? 700 : 400 }}>{value}</span>
        </div>
    )
}

function Notes({ notes }: { notes: string[] }) {
    return (
        <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {notes.map((n, i) => <p key={i} style={{ marginBottom: '0.2rem' }}>💡 {n}</p>)}
        </div>
    )
}

function InfoCard({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
    return (
        <div style={{ padding: '0.75rem 1rem', background: 'var(--bg-input)', borderRadius: 8 }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.2rem' }}>{label}</span>
            <span style={{ fontWeight: 700, color: valueColor || 'var(--text-h)' }}>{value}</span>
        </div>
    )
}
