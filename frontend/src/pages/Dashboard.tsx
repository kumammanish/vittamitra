import { useEffect, useState } from 'react'
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, Activity, ExternalLink } from 'lucide-react'
import { apiClient } from '../services/api'
import type { AppState } from '../hooks/useAppState'
import { fmt, fmtK } from '../hooks/useAppState'

interface Props { state: AppState }

const COLORS = ['#6C63FF', '#FF6B6B', '#00D4AA', '#FFB347', '#A78BFA', '#34D399', '#F472B6', '#60A5FA']

const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
        <div style={{ background: '#0F1020', border: '1px solid var(--border)', borderRadius: 10, padding: '0.75rem 1rem', fontSize: '0.8rem' }}>
            <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
            {payload.map((p: any) => (
                <div key={p.name} style={{ color: p.color, fontWeight: 600 }}>{p.name}: {fmtK(p.value)}</div>
            ))}
        </div>
    )
}

// ── Tax slab data (FY 2024-25) ────────────────────────────────────────────────
const OLD_SLABS = [
    { range: '≤ ₹2,50,000',          rate: '0%',  taxOnSlab: '₹0',      cumulative: '₹0' },
    { range: '₹2,50,001 – ₹5,00,000', rate: '5%',  taxOnSlab: '₹12,500', cumulative: '₹12,500' },
    { range: '₹5,00,001 – ₹10,00,000', rate: '20%', taxOnSlab: '₹1,00,000', cumulative: '₹1,12,500' },
    { range: '> ₹10,00,000',           rate: '30%', taxOnSlab: 'on balance', cumulative: '₹1,12,500 + 30%' },
]

const NEW_SLABS = [
    { range: '≤ ₹3,00,000',            rate: '0%',  taxOnSlab: '₹0',      cumulative: '₹0' },
    { range: '₹3,00,001 – ₹6,00,000',  rate: '5%',  taxOnSlab: '₹15,000', cumulative: '₹15,000' },
    { range: '₹6,00,001 – ₹9,00,000',  rate: '10%', taxOnSlab: '₹30,000', cumulative: '₹45,000' },
    { range: '₹9,00,001 – ₹12,00,000', rate: '15%', taxOnSlab: '₹45,000', cumulative: '₹90,000' },
    { range: '₹12,00,001 – ₹15,00,000', rate: '20%', taxOnSlab: '₹60,000', cumulative: '₹1,50,000' },
    { range: '> ₹15,00,000',            rate: '30%', taxOnSlab: 'on balance', cumulative: '₹1,50,000 + 30%' },
]

const KEY_INFO = [
    { label: 'Standard Deduction', old: '₹50,000', new: '₹75,000' },
    { label: 'Rebate Sec 87A', old: '₹12,500 (income ≤ ₹5L)', new: '₹25,000 (income ≤ ₹7L)' },
    { label: 'Health & Education Cess', old: '4% on tax + surcharge', new: '4% on tax + surcharge' },
    { label: 'Surcharge (>₹50L)', old: '10% – 37%', new: '10% – 25% (capped)' },
    { label: 'Sec 80C (PPF/ELSS/LIC)', old: 'Up to ₹1,50,000', new: 'Not allowed' },
    { label: 'Sec 80CCD(1B) NPS', old: 'Up to ₹50,000', new: 'Not allowed' },
    { label: 'Sec 80D Health Insurance', old: '₹25K self + ₹25–50K parents', new: 'Not allowed' },
    { label: 'Home Loan Interest (24b)', old: 'Up to ₹2,00,000', new: 'Not allowed' },
    { label: 'HRA Exemption', old: 'City-based formula', new: 'Not allowed' },
]

const LEARNING_LINKS = [
    {
        icon: '🏛️',
        label: 'IT e-Filing Portal',
        desc: 'File your ITR, view Form 26AS, AIS, TIS',
        url: 'https://eportal.incometax.gov.in/iec/foservices/',
        badge: 'Official',
    },
    {
        icon: '📘',
        label: 'Income Tax India',
        desc: 'Acts, rules, circulars & department FAQs',
        url: 'https://www.incometaxindia.gov.in',
        badge: 'Official',
    },
    {
        icon: '📋',
        label: 'TRACES — Form 16 / 26AS',
        desc: 'Download Form 16, Form 26AS, TDS certificates',
        url: 'https://www.tdscpc.gov.in',
        badge: 'Official',
    },
    {
        icon: '🪪',
        label: 'Protean (PAN / TAN)',
        desc: 'Apply / update PAN, TAN services',
        url: 'https://www.protean-tinpan.com',
        badge: 'Official',
    },
    {
        icon: '🏦',
        label: 'NPS Trust',
        desc: 'National Pension System — Sec 80CCD(1B)',
        url: 'https://npstrust.org.in',
        badge: 'Govt.',
    },
    {
        icon: '📑',
        label: 'GST Portal',
        desc: 'GST registration, returns, and refunds',
        url: 'https://www.gst.gov.in',
        badge: 'Official',
    },
]

// ── Capability feature items ───────────────────────────────────────────────────
const FEATURES = [
    { icon: '📂', label: 'Bank Statements', desc: 'CSV / XLSX / PDF auto-parsed' },
    { icon: '📄', label: 'Form 16 / 16A / 16B', desc: 'PDF & Excel parser, auto-fills TDS' },
    { icon: '⚖️', label: 'Regime Comparison', desc: 'Old vs New — detailed breakdown' },
    { icon: '💡', label: 'Deduction Optimizer', desc: '80C, 80D, NPS, HRA, Home Loan' },
    { icon: '📈', label: 'Capital Gains', desc: 'All 4 types — Budget 2024 rates' },
    { icon: '🏠', label: 'Rental Income', desc: 'Sec 24(a/b) waterfall computation' },
    { icon: '🌐', label: 'NRI / DTAA Support', desc: 'RNOR/NRI rules, 8 DTAA countries' },
    { icon: '🗂️', label: 'ITR Summary', desc: 'All schedules — print-ready output' },
]

export default function Dashboard({ state }: Props) {
    const [monthly, setMonthly] = useState<any[]>([])
    const [categories, setCategories] = useState<any[]>([])
    const [health, setHealth] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        Promise.all([
            apiClient.getMonthlyExpenses(),
            apiClient.getCategoryBreakdown(),
            apiClient.getHealthScore(),
        ]).then(([m, c, h]) => {
            setMonthly(m.data)
            setCategories(c.data.slice(0, 8))
            setHealth(h.data)
        }).finally(() => setLoading(false))
    }, [])

    const s = state.summary ?? {}
    const noData = !s.salary_income && !monthly.length

    return (
        <div>
            {/* ── Capability Banner (always visible) ── */}
            <div style={{ marginBottom: '2rem' }}>
                <div style={{ marginBottom: '1rem' }}>
                    <h1 style={{ fontSize: '1.8rem', marginBottom: '0.2rem' }}>Financial Dashboard</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        AI TAX CO-PILOT · FY 2024-25 · Upload a bank statement or Form 16 / 16A / 16B to get started
                    </p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                    {FEATURES.map(f => (
                        <div key={f.label} style={{
                            display: 'flex', alignItems: 'flex-start', gap: '0.65rem',
                            padding: '0.75rem 0.9rem',
                            background: 'var(--bg-white)',
                            border: '1px solid var(--border-lt)',
                            borderRadius: 'var(--r-md)',
                            boxShadow: 'var(--shadow-sm)',
                        }}>
                            <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>{f.icon}</span>
                            <div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-h)', lineHeight: 1.2 }}>{f.label}</div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{f.desc}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── No Data prompt ── */}
            {noData ? (
                <div style={{ textAlign: 'center', padding: '3.5rem 2rem', background: 'var(--bg-white)', border: '1px solid var(--border-lt)', borderRadius: 'var(--r-lg)', marginBottom: '2rem' }}>
                    <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>📊</div>
                    <h2 style={{ marginBottom: '0.5rem' }}>No Data Yet</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem', maxWidth: 420, margin: '0 auto 1.25rem' }}>
                        Upload a <strong>bank statement</strong> (CSV/XLSX/PDF) from the Documents tab, or go to <strong>Tax Filing</strong> to parse your Form 16 / 16A / 16B directly.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <span style={{ padding: '0.35rem 0.9rem', background: 'rgba(108,92,231,0.1)', borderRadius: 99, fontSize: '0.78rem', color: 'var(--brand)', fontWeight: 600 }}>
                            📂 Documents tab → bank statement
                        </span>
                        <span style={{ padding: '0.35rem 0.9rem', background: 'rgba(0,184,148,0.1)', borderRadius: 99, fontSize: '0.78rem', color: 'var(--success)', fontWeight: 600 }}>
                            📋 Tax Filing tab → Form 16 / 16A / 16B
                        </span>
                    </div>
                </div>
            ) : (
                <>
                    {/* Stat cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                        {[
                            { icon: '💰', label: 'Annual Salary',  value: fmtK(s.salary_income || 0), color: 'var(--success)' },
                            { icon: '💸', label: 'Total Expenses', value: fmtK(s.total_debits || 0),  color: 'var(--danger)' },
                            { icon: '📈', label: 'Savings Rate',   value: `${s.savings_ratio || 0}%`,
                              color: (s.savings_ratio || 0) >= 20 ? 'var(--success)' : 'var(--warning)' },
                            { icon: '🏦', label: 'Investments',    value: fmtK(s.investments || 0),   color: 'var(--brand)' },
                        ].map(c => (
                            <div key={c.label} className="card" style={{ position: 'relative', overflow: 'hidden' }}>
                                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{c.icon}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>{c.label}</div>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: c.color }}>{c.value}</div>
                                <div style={{ position: 'absolute', right: -10, bottom: -10, fontSize: '4rem', opacity: 0.05 }}>{c.icon}</div>
                            </div>
                        ))}
                    </div>

                    {/* Health Score */}
                    {health && (
                        <div className="card" style={{ background: 'var(--grad-card)', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
                            <div style={{ textAlign: 'center', minWidth: 120 }}>
                                <div style={{
                                    width: 90, height: 90, borderRadius: '50%', margin: '0 auto 0.5rem',
                                    background: `conic-gradient(var(--brand) ${health.score * 3.6}deg, rgba(108,92,231,0.1) 0deg)`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '1.5rem', fontWeight: 800,
                                    boxShadow: 'inset 0 0 0 12px var(--bg-white)',
                                }}>
                                    <span style={{ background: 'var(--grad-brand)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                                        {Math.round(health.score)}
                                    </span>
                                </div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>Grade {health.grade}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Financial Health</div>
                            </div>
                            <div style={{ flex: 1 }}>
                                <h3 style={{ marginBottom: '1rem' }}>Health Breakdown</h3>
                                {Object.entries(health.breakdown || {}).map(([key, val]: any) => (
                                    <div key={key} style={{ marginBottom: '0.6rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                                            <span style={{ color: 'var(--text-muted)', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</span>
                                            <span style={{ fontWeight: 600 }}>{Math.round(val)} pts</span>
                                        </div>
                                        <div className="progress-track">
                                            <div className="progress-fill" style={{ width: `${(val / 30) * 100}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 160 }}>
                                <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Avg Savings Rate</div>
                                    <div style={{ fontWeight: 700, color: 'var(--success)' }}>{health.avg_monthly_savings_rate}%</div>
                                </div>
                                <div className="card" style={{ padding: '0.75rem', textAlign: 'center' }}>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Investment Ratio</div>
                                    <div style={{ fontWeight: 700, color: 'var(--brand)' }}>{health.investment_ratio}%</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Charts row */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                        <div className="card">
                            <h3 style={{ marginBottom: '1.25rem', fontSize: '1rem' }}>Monthly Cash Flow</h3>
                            {loading ? <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Loading…</div> : (
                                <ResponsiveContainer width="100%" height={220}>
                                    <AreaChart data={monthly}>
                                        <defs>
                                            <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#00B894" stopOpacity={0.3} />
                                                <stop offset="100%" stopColor="#00B894" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#E17055" stopOpacity={0.3} />
                                                <stop offset="100%" stopColor="#E17055" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                                        <YAxis tickFormatter={v => fmtK(v)} tick={{ fontSize: 10 }} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Area type="monotone" dataKey="total_income"  name="Income"  stroke="#00B894" fill="url(#gIncome)"  strokeWidth={2} />
                                        <Area type="monotone" dataKey="total_expense" name="Expense" stroke="#E17055" fill="url(#gExpense)" strokeWidth={2} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </div>

                        <div className="card">
                            <h3 style={{ marginBottom: '1.25rem', fontSize: '1rem' }}>Expense Categories</h3>
                            {loading ? <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Loading…</div> : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                    <ResponsiveContainer width={180} height={180}>
                                        <PieChart>
                                            <Pie data={categories} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="amount" paddingAngle={3}>
                                                {categories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip formatter={(v: any) => fmtK(v)} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div style={{ flex: 1 }}>
                                        {categories.map((c, i) => (
                                            <div key={c.category} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', fontSize: '0.8rem' }}>
                                                <div style={{ width: 10, height: 10, borderRadius: 3, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                                                <span style={{ color: 'var(--text-muted)', flex: 1, textTransform: 'capitalize' }}>{c.category}</span>
                                                <span style={{ fontWeight: 600 }}>{c.pct}%</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {monthly.length > 0 && (
                        <div className="card" style={{ marginBottom: '2rem' }}>
                            <h3 style={{ marginBottom: '1.25rem', fontSize: '1rem' }}>Monthly Net Savings</h3>
                            <ResponsiveContainer width="100%" height={180}>
                                <BarChart data={monthly}>
                                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                                    <YAxis tickFormatter={v => fmtK(v)} tick={{ fontSize: 10 }} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="net_savings" name="Net Savings" radius={[6, 6, 0, 0]}>
                                        {monthly.map((entry, i) => (
                                            <Cell key={i} fill={entry.net_savings >= 0 ? '#00B894' : '#E17055'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </>
            )}

            {/* ── Tax Learning Hub ─────────────────────────────────────────── */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>📚</span>
                    <h3 style={{ fontSize: '1rem', margin: 0 }}>Tax Learning Hub</h3>
                    <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Official Indian Government Portals — opens in new tab
                    </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                    {LEARNING_LINKS.map(link => (
                        <a
                            key={link.label}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ textDecoration: 'none' }}
                        >
                            <div style={{
                                display: 'flex', alignItems: 'flex-start', gap: '0.65rem',
                                padding: '0.75rem 0.9rem',
                                background: 'var(--bg-input)',
                                border: '1px solid var(--border-lt)',
                                borderRadius: 'var(--r-md)',
                                transition: 'all 0.18s',
                                cursor: 'pointer',
                            }}
                                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brand)', e.currentTarget.style.background = 'rgba(108,92,231,0.04)')}
                                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-lt)', e.currentTarget.style.background = 'var(--bg-input)')}
                            >
                                <span style={{ fontSize: '1.2rem', lineHeight: 1, flexShrink: 0 }}>{link.icon}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-h)' }}>{link.label}</span>
                                        <span style={{
                                            padding: '0.1rem 0.4rem', borderRadius: 99, fontSize: '0.62rem', fontWeight: 700,
                                            background: 'rgba(0,184,148,0.12)', color: 'var(--success)',
                                        }}>{link.badge}</span>
                                    </div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{link.desc}</div>
                                </div>
                                <ExternalLink size={12} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
                            </div>
                        </a>
                    ))}
                </div>
            </div>

            {/* ── Income Tax Slab Reference (FY 2024-25) ───────────────────── */}
            <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>📊</span>
                    <h3 style={{ fontSize: '1rem', margin: 0 }}>Income Tax Slab Reference — FY 2024-25</h3>
                    <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        + 4% H&E Cess on all tax amounts
                    </span>
                </div>

                {/* Side-by-side slab tables */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.5rem' }}>
                    {/* Old Regime */}
                    <div>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem',
                            padding: '0.4rem 0.75rem', background: 'rgba(108,92,231,0.08)', borderRadius: 'var(--r-sm)',
                        }}>
                            <span style={{ fontSize: '0.85rem' }}>🏛️</span>
                            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--brand)' }}>Old Regime</span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>Deductions allowed</span>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-input)' }}>
                                    {['Income Range', 'Rate', 'Tax on Slab', 'Cumulative Tax'].map(h => (
                                        <th key={h} style={{ padding: '0.45rem 0.6rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid var(--border-lt)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {OLD_SLABS.map((row, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border-lt)', background: i % 2 === 0 ? 'transparent' : 'rgba(108,92,231,0.02)' }}>
                                        <td style={{ padding: '0.45rem 0.6rem', color: 'var(--text-body)', fontWeight: 500 }}>{row.range}</td>
                                        <td style={{ padding: '0.45rem 0.6rem', fontWeight: 700, color: row.rate === '0%' ? 'var(--success)' : row.rate === '30%' ? 'var(--danger)' : 'var(--warning)' }}>{row.rate}</td>
                                        <td style={{ padding: '0.45rem 0.6rem', color: 'var(--text-muted)' }}>{row.taxOnSlab}</td>
                                        <td style={{ padding: '0.45rem 0.6rem', color: 'var(--text-body)', fontWeight: 500 }}>{row.cumulative}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* New Regime */}
                    <div>
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem',
                            padding: '0.4rem 0.75rem', background: 'rgba(0,184,148,0.08)', borderRadius: 'var(--r-sm)',
                        }}>
                            <span style={{ fontSize: '0.85rem' }}>✨</span>
                            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--success)' }}>New Regime</span>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>Default from FY 23-24</span>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-input)' }}>
                                    {['Income Range', 'Rate', 'Tax on Slab', 'Cumulative Tax'].map(h => (
                                        <th key={h} style={{ padding: '0.45rem 0.6rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid var(--border-lt)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {NEW_SLABS.map((row, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border-lt)', background: i % 2 === 0 ? 'transparent' : 'rgba(0,184,148,0.02)' }}>
                                        <td style={{ padding: '0.45rem 0.6rem', color: 'var(--text-body)', fontWeight: 500 }}>{row.range}</td>
                                        <td style={{ padding: '0.45rem 0.6rem', fontWeight: 700, color: row.rate === '0%' ? 'var(--success)' : row.rate === '30%' ? 'var(--danger)' : 'var(--warning)' }}>{row.rate}</td>
                                        <td style={{ padding: '0.45rem 0.6rem', color: 'var(--text-muted)' }}>{row.taxOnSlab}</td>
                                        <td style={{ padding: '0.45rem 0.6rem', color: 'var(--text-body)', fontWeight: 500 }}>{row.cumulative}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Key differences / deductions comparison table */}
                <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.65rem' }}>
                        Key Differences — Deductions & Exemptions
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-input)' }}>
                                    {['Feature / Section', '🏛️ Old Regime', '✨ New Regime'].map(h => (
                                        <th key={h} style={{ padding: '0.45rem 0.75rem', textAlign: 'left', fontWeight: 700, color: 'var(--text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid var(--border-lt)' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {KEY_INFO.map((row, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid var(--border-lt)', background: i % 2 === 0 ? 'transparent' : 'rgba(108,92,231,0.02)' }}>
                                        <td style={{ padding: '0.45rem 0.75rem', fontWeight: 600, color: 'var(--text-body)' }}>{row.label}</td>
                                        <td style={{ padding: '0.45rem 0.75rem', color: 'var(--brand)', fontWeight: 500 }}>{row.old}</td>
                                        <td style={{ padding: '0.45rem 0.75rem', color: row.new === 'Not allowed' ? 'var(--text-muted)' : 'var(--success)', fontWeight: 500 }}>{row.new}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.75rem', fontStyle: 'italic' }}>
                        ⚠️ Advisory only. Slab rates for FY 2024-25 (AY 2025-26). Surcharge applies on income above ₹50L. Consult a licensed CA before filing.
                    </p>
                </div>
            </div>
        </div>
    )
}
