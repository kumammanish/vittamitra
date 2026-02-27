import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Zap } from 'lucide-react'
import { apiClient } from '../services/api'
import type { AppState } from '../hooks/useAppState'
import ReactMarkdown from 'react-markdown'

interface Props { state: AppState }

interface Message {
    role: 'user' | 'assistant'
    content: string
    source?: string
}

const SUGGESTED = [
    'Should I opt for old or new regime?',
    'How much more should I invest under 80C?',
    'Am I overpaying tax?',
    'What is Section 87A rebate?',
    'Can I claim health insurance under 80D?',
    'How does HRA exemption work?',
]

export default function ChatPage({ state }: Props) {
    const [messages, setMessages] = useState<Message[]>([
        {
            role: 'assistant',
            content: "Namaste! 🙏 I'm VittaMitra, your AI tax co-pilot.\n\nI can help you with regime selection, deduction planning, TDS checks, and Indian tax strategy.\n\nUpload your bank statement and fill in your income details for personalised advice.\n\n⚠️ Advisory only. Consult a licensed CA before filing.",
        }
    ])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const bottomRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const send = async (text?: string) => {
        const msg = text || input
        if (!msg.trim()) return
        setInput('')
        setMessages(m => [...m, { role: 'user', content: msg }])
        setLoading(true)
        try {
            const res = await apiClient.chat({
                message: msg,
                api_key: state.apiKey || undefined,
                model: state.llmModel || 'gpt-4o-mini',
                base_url: state.llmBaseUrl || undefined,
            })
            setMessages(m => [...m, { role: 'assistant', content: res.data.response, source: res.data.source }])
        } catch {
            setMessages(m => [...m, { role: 'assistant', content: '⚠️ Could not reach the backend. Make sure the FastAPI server is running on port 8000.' }])
        } finally { setLoading(false) }
    }

    return (
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)', minHeight: 500 }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.8rem', marginBottom: '0.25rem' }}>AI Tax Advisor</h1>
                <p style={{ color: 'var(--text-secondary)' }}>
                    Ask anything about Indian income tax, deductions, or financial planning
                    {state.apiKey ? <span className="badge badge-success" style={{ marginLeft: 8 }}><Zap size={10} /> LLM Active</span> : <span className="badge badge-warning" style={{ marginLeft: 8 }}>Rule-based mode</span>}
                </p>
            </div>

            {/* Message area */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem', paddingRight: '0.25rem' }}>
                {messages.map((m, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', gap: '0.75rem', alignItems: 'flex-start' }}>
                        {m.role === 'assistant' && (
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--grad-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                                <Bot size={18} />
                            </div>
                        )}
                        <div style={{
                            maxWidth: '75%',
                            padding: '0.85rem 1.1rem',
                            borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                            background: m.role === 'user' ? 'var(--grad-brand)' : 'var(--bg-glass)',
                            border: m.role === 'assistant' ? '1px solid var(--border)' : 'none',
                            backdropFilter: m.role === 'assistant' ? 'blur(10px)' : undefined,
                            fontSize: '0.88rem',
                            lineHeight: 1.6,
                            color: 'var(--text-primary)',
                        }}>
                            <ReactMarkdown>{m.content}</ReactMarkdown>
                            {m.source === 'rule_based' && (
                                <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>Rule-based response • Add an API key in Settings for AI responses</div>
                            )}
                        </div>
                        {m.role === 'user' && (
                            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.1)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                                <User size={18} />
                            </div>
                        )}
                    </div>
                ))}

                {loading && (
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--grad-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Bot size={18} />
                        </div>
                        <div className="glass" style={{ padding: '0.85rem 1.1rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            {[0, 150, 300].map(d => (
                                <div key={d} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--brand-primary)', animation: `pulse-glow 1.2s ${d}ms infinite` }} />
                            ))}
                        </div>
                    </div>
                )}
                <div ref={bottomRef} />
            </div>

            {/* Suggested chips */}
            {messages.length <= 1 && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                    {SUGGESTED.map(q => (
                        <button key={q} className="btn btn-ghost btn-sm" onClick={() => send(q)} style={{ fontSize: '0.78rem', padding: '0.35rem 0.8rem' }}>
                            {q}
                        </button>
                    ))}
                </div>
            )}

            {/* Input bar */}
            <div className="glass" style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem', alignItems: 'center' }}>
                <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
                    placeholder="Ask about your taxes, deductions, or regime choice…"
                    style={{ flex: 1, background: 'transparent', border: 'none', fontSize: '0.9rem', outline: 'none', color: 'var(--text-primary)' }}
                    disabled={loading}
                />
                <button className="btn btn-primary btn-sm" onClick={() => send()} disabled={loading || !input.trim()}>
                    <Send size={15} />
                </button>
            </div>
        </div>
    )
}
