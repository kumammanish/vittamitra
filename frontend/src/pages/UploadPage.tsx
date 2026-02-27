import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, CheckCircle, TrendingUp, Wallet, Target, ExternalLink } from 'lucide-react'
import { apiClient } from '../services/api'
import type { AppState } from '../hooks/useAppState'
import { fmt } from '../hooks/useAppState'

interface Props { state: AppState; update: (p: Partial<AppState>) => void; onDone?: () => void }

// ── Tax slab data ──────────────────────────────────────────────────────────
const NEW_SLABS_2526 = [
    { range: 'Up to ₹4L', rate: 'Nil' },
    { range: '₹4L – ₹8L', rate: '5%' },
    { range: '₹8L – ₹12L', rate: '10%' },
    { range: '₹12L – ₹16L', rate: '15%' },
    { range: '₹16L – ₹20L', rate: '20%' },
    { range: '₹20L – ₹24L', rate: '25%' },
    { range: 'Above ₹24L', rate: '30%' },
]
const NEW_SLABS_2425 = [
    { range: 'Up to ₹3L', rate: 'Nil' },
    { range: '₹3L – ₹7L', rate: '5%' },
    { range: '₹7L – ₹10L', rate: '10%' },
    { range: '₹10L – ₹12L', rate: '15%' },
    { range: '₹12L – ₹15L', rate: '20%' },
    { range: 'Above ₹15L', rate: '30%' },
]
const OLD_SLABS = [
    { range: 'Up to ₹2.5L', rate: 'Nil' },
    { range: '₹2.5L – ₹5L', rate: '5%' },
    { range: '₹5L – ₹10L', rate: '20%' },
    { range: 'Above ₹10L', rate: '30%' },
]

const TAX_LINKS = [
    { label: 'Income Tax e-Filing Portal', url: 'https://www.incometax.gov.in/', tag: 'Official' },
    { label: 'CBDT Circulars & Notifications', url: 'https://www.incometax.gov.in/iec/foportal/help/news-updates', tag: 'Official' },
    { label: 'Tax Slab FY 2025-26 — IT Dept', url: 'https://www.incometax.gov.in/iec/foportal/help/individual/return-applicable-1', tag: 'Official' },
    { label: 'Section 80C Deduction Guide', url: 'https://cleartax.in/s/80c-80ccc-80ccd-deductions', tag: 'Guide' },
    { label: 'Old vs New Regime Calculator', url: 'https://www.incometaxindia.gov.in/Pages/tools/tax-calculator.aspx', tag: 'Official' },
    { label: 'Section 87A Rebate Explained', url: 'https://cleartax.in/s/section-87a-tax-rebate', tag: 'Guide' },
    { label: 'NPS Tax Benefits (80CCD)', url: 'https://npstrust.org.in/tax-benefit', tag: 'Official' },
    { label: 'HRA Exemption Rules', url: 'https://cleartax.in/s/hra-house-rent-allowance', tag: 'Guide' },
]

const TAG_COLOR: Record<string, string> = {
    'Official': 'rgba(0,184,148,0.13)',
    'Guide': 'rgba(108,92,231,0.10)',
}
const TAG_TEXT: Record<string, string> = {
    'Official': 'var(--success)',
    'Guide': 'var(--brand)',
}

export default function UploadPage({ state, update, onDone }: Props) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [fileName, setFileName] = useState('')
    const [slabTab, setSlabTab] = useState<'new2526' | 'new2425' | 'old'>('new2526')

    const onDrop = useCallback(async (files: File[]) => {
        if (!files.length) return
        const file = files[0]
        setFileName(file.name)
        setLoading(true); setError('')
        try {
            const form = new FormData()
            form.append('file', file)
            const res = await apiClient.ingest(form)
            update({ summary: res.data })
            setLoading(false)
            onDone?.()
        } catch (e: any) {
            setError(e?.response?.data?.detail || 'Upload failed. Check the backend is running on port 8000.')
            setLoading(false)
        }
    }, [update, onDone])

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop, accept: { 'text/csv': ['.csv'], 'application/vnd.ms-excel': ['.xls'], 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'application/pdf': ['.pdf'] },
        multiple: false,
    })

    const slabs = slabTab === 'new2526' ? NEW_SLABS_2526 : slabTab === 'new2425' ? NEW_SLABS_2425 : OLD_SLABS

    return (
        <div>
            {/* ── Hero ── */}
            <div className="hero" style={{ marginBottom: '2rem' }}>
                <a href="https://kumammanish.github.io/" target="_blank" rel="noopener noreferrer"
                    style={{
                        position: 'absolute', top: '1.25rem', right: '1.25rem', zIndex: 2,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 42, height: 42, borderRadius: 12,
                        background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(10px)',
                        color: '#fff', fontFamily: 'Outfit', fontWeight: 800, fontSize: '0.9rem',
                        textDecoration: 'none', border: '1.5px solid rgba(255,255,255,0.35)',
                        transition: 'all .2s',
                    }}>
                    MK
                </a>

                <div style={{ maxWidth: 600, margin: '0 auto' }}>
                    <div style={{ fontSize: '0.75rem', letterSpacing: '0.12em', fontWeight: 600, marginBottom: '0.75rem', opacity: 0.85, textTransform: 'uppercase' }}>
                        ✨ VittaMitra · AI Tax Co-Pilot · FY 2024-25
                    </div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: 900, color: '#fff', marginBottom: '0.75rem', fontFamily: 'Outfit' }}>
                        Your Money. Your Privacy.
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.82)', fontSize: '1.05rem', lineHeight: 1.65, marginBottom: '1.75rem' }}>
                        Upload your bank statement and VittaMitra will compute your tax liability,
                        compare regimes, and find hidden deductions — all locally on your device.
                    </p>
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <span className="badge" style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(8px)' }}>
                            🔒 100% Local
                        </span>
                        <span className="badge" style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(8px)' }}>
                            📄 CSV · XLSX · PDF
                        </span>
                        <span className="badge" style={{ background: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', backdropFilter: 'blur(8px)' }}>
                            ⚡ Old &amp; New Regime
                        </span>
                    </div>
                </div>
            </div>

            {/* ── Two-column layout: Upload (left) + Resources (right) ── */}
            {!state.summary ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.5rem', alignItems: 'start' }} className="upload-grid">

                    {/* ─ LEFT: Upload card ─ */}
                    <div className="card">
                        <h3 style={{ marginBottom: '0.4rem', fontSize: '1.05rem' }}>Upload Bank Statement</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1.5rem' }}>
                            We accept bank exports in CSV, Excel (.xlsx/.xls), or PDF format.
                            All processing happens on your machine.
                        </p>

                        <div {...getRootProps()} className={`dropzone${isDragActive ? ' active' : ''}`}>
                            <input {...getInputProps()} />
                            {loading ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                    <div className="animate-spin" style={{ width: 40, height: 40, border: '3px solid rgba(108,92,231,0.15)', borderTopColor: 'var(--brand)', borderRadius: '50%' }} />
                                    <div style={{ fontWeight: 600, color: 'var(--brand)' }}>Analysing {fileName}…</div>
                                    <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Tagging transactions &amp; computing summaries</div>
                                </div>
                            ) : isDragActive ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                                    <Upload size={40} color="var(--brand)" />
                                    <div style={{ fontWeight: 700, color: 'var(--brand)', fontSize: '1.1rem' }}>Drop it here!</div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                                    <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(108,92,231,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Upload size={28} color="var(--brand)" />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.3rem', color: 'var(--text-h)' }}>
                                            Drag &amp; drop your bank statement
                                        </div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>or click to browse</div>
                                    </div>
                                    <button className="btn btn-primary btn-sm" type="button">
                                        <FileText size={14} /> Choose File
                                    </button>
                                    <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>CSV · XLSX · XLS · PDF</div>
                                </div>
                            )}
                        </div>

                        {error && (
                            <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: 'var(--r-sm)', background: 'rgba(225,112,85,0.08)', border: '1px solid rgba(225,112,85,0.2)', color: 'var(--danger)', fontSize: '0.82rem' }}>
                                ⚠️ {error}
                            </div>
                        )}

                        {/* Format tip */}
                        <details style={{ marginTop: '1.5rem' }}>
                            <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: 'var(--brand)', fontWeight: 600 }}>
                                📋 Expected CSV format
                            </summary>
                            <div style={{ marginTop: '0.75rem', background: 'var(--bg-input)', borderRadius: 'var(--r-sm)', padding: '0.85rem', fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-body)', lineHeight: 2 }}>
                                Date, Description, Debit, Credit, Balance<br />
                                01-Apr-2024, SALARY CREDIT, , 120000, 145200<br />
                                05-Apr-2024, SIP INVESTMENT, 5000, , 140200<br />
                                10-Apr-2024, HOUSE RENT, 22000, , 118200
                            </div>
                        </details>
                    </div>

                    {/* ─ RIGHT: Tax Resources panel ─ */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                        {/* Tax Slab card */}
                        <div className="card" style={{ padding: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                <span style={{ fontSize: '1.1rem' }}>📊</span>
                                <h4 style={{ fontSize: '0.95rem', margin: 0 }}>Income Tax Slabs</h4>
                            </div>

                            {/* Slab tabs */}
                            <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0.85rem', flexWrap: 'wrap' }}>
                                {([
                                    ['new2526', '✨ New 25-26'],
                                    ['new2425', '⚡ New 24-25'],
                                    ['old', '🏛️ Old Regime'],
                                ] as const).map(([key, lbl]) => (
                                    <button
                                        key={key}
                                        onClick={() => setSlabTab(key)}
                                        style={{
                                            padding: '0.28rem 0.65rem', borderRadius: 'var(--r-sm)',
                                            fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', border: 'none',
                                            background: slabTab === key ? 'var(--grad-brand)' : 'var(--bg-input)',
                                            color: slabTab === key ? '#fff' : 'var(--text-muted)',
                                            transition: 'all .18s',
                                        }}
                                    >{lbl}</button>
                                ))}
                            </div>

                            {slabTab === 'new2526' && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--success)', background: 'rgba(0,184,148,0.08)', borderRadius: 'var(--r-sm)', padding: '0.45rem 0.7rem', marginBottom: '0.7rem', fontWeight: 600 }}>
                                    🎉 Zero tax up to ₹12L with 87A rebate
                                </div>
                            )}
                            {slabTab === 'new2425' && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--brand)', background: 'rgba(108,92,231,0.08)', borderRadius: 'var(--r-sm)', padding: '0.45rem 0.7rem', marginBottom: '0.7rem', fontWeight: 600 }}>
                                    ℹ️ Zero tax up to ₹7L with 87A rebate
                                </div>
                            )}
                            {slabTab === 'old' && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--warning)', background: 'rgba(240,165,0,0.08)', borderRadius: 'var(--r-sm)', padding: '0.45rem 0.7rem', marginBottom: '0.7rem', fontWeight: 600 }}>
                                    ℹ️ Available until FY 2025-26; no new changes
                                </div>
                            )}

                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '0.35rem 0.5rem', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border-lt)', fontSize: '0.72rem' }}>Income Range</th>
                                        <th style={{ textAlign: 'right', padding: '0.35rem 0.5rem', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border-lt)', fontSize: '0.72rem' }}>Tax Rate</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {slabs.map((s, i) => (
                                        <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-input)' }}>
                                            <td style={{ padding: '0.38rem 0.5rem', color: 'var(--text-body)', borderRadius: i % 2 !== 0 ? '6px 0 0 6px' : 0 }}>{s.range}</td>
                                            <td style={{ padding: '0.38rem 0.5rem', textAlign: 'right', fontWeight: 700, color: s.rate === 'Nil' ? 'var(--success)' : s.rate === '30%' ? 'var(--danger)' : 'var(--brand)', borderRadius: i % 2 !== 0 ? '0 6px 6px 0' : 0 }}>{s.rate}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div style={{ marginTop: '0.75rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                + 4% Health &amp; Education Cess on tax. Surcharge applies above ₹50L.
                            </div>
                        </div>

                        {/* Official Links card */}
                        <div className="card" style={{ padding: '1.25rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                                <span style={{ fontSize: '1.1rem' }}>🔗</span>
                                <h4 style={{ fontSize: '0.95rem', margin: 0 }}>Tax Learning Hub</h4>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {TAX_LINKS.map((lnk, i) => (
                                    <a
                                        key={i}
                                        href={lnk.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '0.6rem',
                                            padding: '0.55rem 0.75rem', borderRadius: 'var(--r-sm)',
                                            background: 'var(--bg-input)', border: '1px solid var(--border-lt)',
                                            textDecoration: 'none', transition: 'all .18s',
                                            color: 'var(--text-body)',
                                        }}
                                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--brand-lt)')}
                                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-lt)')}
                                    >
                                        <span style={{
                                            fontSize: '0.65rem', fontWeight: 700, padding: '0.18rem 0.45rem',
                                            borderRadius: 99, background: TAG_COLOR[lnk.tag],
                                            color: TAG_TEXT[lnk.tag], flexShrink: 0, textTransform: 'uppercase',
                                            letterSpacing: '0.04em',
                                        }}>
                                            {lnk.tag}
                                        </span>
                                        <span style={{ flex: 1, fontSize: '0.8rem', fontWeight: 500, lineHeight: 1.35 }}>{lnk.label}</span>
                                        <ExternalLink size={12} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                                    </a>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                /* ── Success summary ── */
                <div className="animate-fadeUp">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(0,184,148,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CheckCircle size={22} color="var(--success)" />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1.2rem', marginBottom: '0.1rem' }}>Statement Processed ✓</h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Head to the Dashboard or Regime Compare tabs to explore your insights</p>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }} className="resp-grid-4">
                        {[
                            { icon: <TrendingUp size={20} color="var(--success)" />, label: 'Annual Salary', value: fmt(state.summary.salary_income), color: 'var(--success)' },
                            { icon: <Wallet size={20} color="var(--danger)" />, label: 'Total Expenses', value: fmt(state.summary.total_debits), color: 'var(--danger)' },
                            { icon: <Target size={20} color="var(--brand)" />, label: 'Net Savings', value: fmt(state.summary.net_savings), color: 'var(--brand)' },
                        ].map(c => (
                            <div key={c.label} className="metric-card">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.75rem' }}>
                                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{c.icon}</div>
                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.label}</span>
                                </div>
                                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: c.color, fontFamily: 'Outfit' }}>{c.value}</div>
                            </div>
                        ))}
                    </div>

                    <div style={{ marginTop: '1.25rem' }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => update({ summary: null })}>
                            ↑ Upload different file
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
