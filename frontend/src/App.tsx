import { useState } from 'react'
import { AlertTriangle, Shield, ExternalLink } from 'lucide-react'
import Dashboard from './pages/Dashboard'
import UploadPage from './pages/UploadPage'
import RegimeComparePage from './pages/RegimeComparePage'
import DeductionsPage from './pages/DeductionsPage'
import ChatPage from './pages/ChatPage'
import TaxFilingPage from './pages/TaxFilingPage'
import ITRSummaryPage from './pages/ITRSummaryPage'
import SettingsPanel from './components/SettingsPanel'
import { useAppState } from './hooks/useAppState'

const TABS = [
    { id: 'upload', label: '📂 Documents' },
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'regime', label: '⚖️ Regime Compare' },
    { id: 'deductions', label: '💡 Deductions' },
    { id: 'filing', label: '📋 Tax Filing' },
    { id: 'itr', label: '🗂️ ITR Summary' },
    { id: 'chat', label: '🤖 Tax Advisor' },
]

const MK_URL = 'https://kumammanish.github.io/'

export default function App() {
    const [activeTab, setActiveTab] = useState('dashboard')
    const [showSettings, setShowSettings] = useState(false)
    const { state, update } = useAppState()

    return (
        <div id="root" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

            {/* ── Top Nav ── */}
            <header className="top-nav">
                {/* Logo */}
                <a href={MK_URL} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', textDecoration: 'none' }}>
                    <span className="mk-pill">MK</span>
                    <div>
                        <div style={{ fontFamily: 'Outfit', fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--text-h)' }}>
                            Vitta<span className="grad-text">Mitra</span>
                        </div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase' }}>AI TAX CO-PILOT</div>
                    </div>
                </a>

                {/* Tabs */}
                <nav className="no-print" style={{ display: 'flex', gap: '0.15rem', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                    {TABS.map(tab => (
                        <button key={tab.id} className="btn btn-ghost btn-sm"
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                background: activeTab === tab.id ? 'rgba(108,92,231,0.12)' : 'transparent',
                                borderColor: activeTab === tab.id ? 'rgba(108,92,231,0.3)' : 'transparent',
                                color: activeTab === tab.id ? 'var(--brand)' : 'var(--text-muted)',
                                fontWeight: activeTab === tab.id ? 700 : 500,
                            }}>
                            {tab.label}
                        </button>
                    ))}
                </nav>

                {/* Right */}
                <button className="btn btn-ghost btn-sm" onClick={() => setShowSettings(s => !s)}>
                    ⚙️ Settings
                </button>
            </header>

            {/* ── Disclaimer strip ── */}
            <div style={{ padding: '0.4rem 2rem', background: '#FFFBEB', borderBottom: '1px solid rgba(240,165,0,0.2)' }}>
                <div style={{ maxWidth: 1160, margin: '0 auto', display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.75rem', color: '#7A5200' }}>
                    <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1 }}><strong>Advisory only.</strong> VittaMitra does not file taxes or provide legal advice. Consult a licensed CA before making decisions.</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', flexShrink: 0 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--success)', fontWeight: 600 }}>
                            <Shield size={11} /> 100% Local
                        </span>
                        <a href={MK_URL} target="_blank" rel="noopener noreferrer"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--brand)', fontWeight: 600, textDecoration: 'none' }}>
                            <ExternalLink size={11} /> Built by Manish Kumar
                        </a>
                    </span>
                </div>
            </div>

            {/* ── Main ── */}
            <main style={{ flex: 1, padding: '1.75rem 2rem', maxWidth: 1200, width: '100%', margin: '0 auto' }}>
                {showSettings && <SettingsPanel state={state} update={update} onClose={() => setShowSettings(false)} />}
                <div className="animate-fadeUp">
                    {activeTab === 'upload' && <UploadPage state={state} update={update} onDone={() => setActiveTab('dashboard')} />}
                    {activeTab === 'dashboard' && <Dashboard state={state} />}
                    {activeTab === 'regime' && <RegimeComparePage state={state} update={update} />}
                    {activeTab === 'deductions' && <DeductionsPage state={state} update={update} />}
                    {activeTab === 'filing' && <TaxFilingPage state={state} update={update} />}
                    {activeTab === 'itr' && <ITRSummaryPage state={state} update={update} />}
                    {activeTab === 'chat' && <ChatPage state={state} />}
                </div>
            </main>

            {/* ── Footer ── */}
            <footer className="app-footer">
                <a className="mk-pill" href={MK_URL} target="_blank" rel="noopener noreferrer" style={{ width: 30, height: 30, borderRadius: 8, fontSize: '0.7rem' }}>MK</a>
                Built by{' '}
                <a href={MK_URL} target="_blank" rel="noopener noreferrer">Manish Kumar</a>
                <span style={{ color: 'var(--border-lt)' }}>·</span>
                <span>VittaMitra v1.0 · FY 2024-25</span>
                <span style={{ color: 'var(--border-lt)' }}>·</span>
                <span>Indian Tax Advisory Platform</span>
            </footer>
        </div>
    )
}
