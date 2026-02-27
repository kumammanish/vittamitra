import { X, Key, DollarSign, User } from 'lucide-react'
import type { AppState } from '../hooks/useAppState'

interface Props { state: AppState; update: (p: Partial<AppState>) => void; onClose: () => void }

export default function SettingsPanel({ state, update, onClose }: Props) {
    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', justifyContent: 'flex-end',
        }} onClick={onClose}>
            <div
                onClick={e => e.stopPropagation()}
                className="glass"
                style={{ width: 420, height: '100vh', borderRadius: '20px 0 0 20px', padding: '2rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ fontSize: '1.3rem' }}>⚙️ Settings</h2>
                    <button className="btn btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
                </div>

                {/* Income */}
                <section>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        <DollarSign size={14} /> Income & Tax
                    </div>
                    {([
                        ['Gross Annual Income (₹)', 'grossIncome'],
                        ['TDS Already Paid (₹)', 'tds'],
                        ['80C Investments (₹)', 'claimed80C'],
                        ['80D Insurance Premium (₹)', 'claimed80D'],
                        ['HRA Exemption (₹)', 'claimedHRA'],
                        ['Home Loan Interest (₹)', 'claimedHomeLoan'],
                        ['NPS / 80CCD(1B) (₹)', 'claimedNPS'],
                    ] as [string, keyof AppState][]).map(([label, key]) => (
                        <div key={key as string} style={{ marginBottom: '0.85rem' }}>
                            <label>{label}</label>
                            <input
                                type="number"
                                value={(state as any)[key] || ''}
                                onChange={e => update({ [key]: parseFloat(e.target.value) || 0 } as any)}
                                placeholder="0"
                            />
                        </div>
                    ))}
                </section>

                {/* Profile */}
                <section>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        <User size={14} /> Profile
                    </div>
                    <div style={{ marginBottom: '0.85rem' }}>
                        <label>Your Age</label>
                        <input type="number" value={state.age} onChange={e => update({ age: parseInt(e.target.value) || 30 })} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {([
                            ['Metro City (Mumbai/Delhi/Chennai/Kolkata)', 'isMetro'],
                            ['Have Dependent Parents', 'hasParents'],
                            ['Parents are Senior Citizens (60+)', 'parentsSenior'],
                        ] as [string, keyof AppState][]).map(([label, key]) => (
                            <label key={key as string} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', textTransform: 'none', letterSpacing: 'normal', fontSize: '0.88rem', fontWeight: 'normal' }}>
                                <input type="checkbox" style={{ width: 'auto', cursor: 'pointer' }} checked={(state as any)[key]} onChange={e => update({ [key]: e.target.checked } as any)} />
                                {label}
                            </label>
                        ))}
                    </div>

                    {/* Residential Status */}
                    <div style={{ marginTop: '1rem' }}>
                        <label>Residential Status</label>
                        <select value={state.residentialStatus} onChange={e => update({ residentialStatus: e.target.value as any, dtaaCountry: '' })}>
                            <option value="Resident">Resident Indian</option>
                            <option value="RNOR">RNOR (Resident but Not Ordinarily Resident)</option>
                            <option value="NRI">NRI (Non-Resident Indian)</option>
                        </select>
                    </div>

                    {state.residentialStatus === 'NRI' && (
                        <div style={{ marginTop: '0.85rem' }}>
                            <label>Country of Residence (DTAA)</label>
                            <select value={state.dtaaCountry} onChange={e => update({ dtaaCountry: e.target.value })}>
                                <option value="">— Select country —</option>
                                <option value="USA">United States</option>
                                <option value="UK">United Kingdom</option>
                                <option value="UAE">UAE (No DTAA)</option>
                                <option value="SGP">Singapore</option>
                                <option value="AUS">Australia</option>
                                <option value="CAN">Canada</option>
                                <option value="DEU">Germany</option>
                                <option value="NLD">Netherlands</option>
                            </select>
                        </div>
                    )}
                </section>

                {/* LLM */}
                <section>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        <Key size={14} /> AI Chat (Optional)
                    </div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.85rem' }}>
                        Leave blank to use rule-based responses. For Ollama: set Base URL to <code style={{ color: 'var(--brand-primary)' }}>http://localhost:11434/v1</code> and model to <code style={{ color: 'var(--brand-primary)' }}>llama3.2</code>
                    </p>
                    <div style={{ marginBottom: '0.85rem' }}>
                        <label>API Key</label>
                        <input type="password" value={state.apiKey} onChange={e => update({ apiKey: e.target.value })} placeholder="sk-... or any value for Ollama" />
                    </div>
                    <div style={{ marginBottom: '0.85rem' }}>
                        <label>Model</label>
                        <input value={state.llmModel} onChange={e => update({ llmModel: e.target.value })} placeholder="gpt-4o-mini" />
                    </div>
                    <div>
                        <label>Base URL (leave blank for OpenAI)</label>
                        <input value={state.llmBaseUrl} onChange={e => update({ llmBaseUrl: e.target.value })} placeholder="http://localhost:11434/v1" />
                    </div>
                </section>

                <button className="btn btn-primary" onClick={onClose} style={{ marginTop: 'auto' }}>
                    ✓ Save & Close
                </button>
            </div>
        </div>
    )
}
