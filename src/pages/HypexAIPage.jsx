import React, { useState, useEffect, useRef, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { isDueToday, isDoneToday, appliesOn, todayISO } from '../utils/recurrence'

const ACCENT = '#00FFD1'

// ── lichte markdown → blokken (vet + lijsten) ──
function parseInline(line) {
  const segs = []
  const re = /\*\*(.+?)\*\*/g
  let last = 0, m
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) segs.push({ text: line.slice(last, m.index), bold: false })
    segs.push({ text: m[1], bold: true })
    last = re.lastIndex
  }
  if (last < line.length) segs.push({ text: line.slice(last), bold: false })
  if (!segs.length) segs.push({ text: line, bold: false })
  return segs
}
function parseMd(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n')
  const blocks = []
  let list = null
  const flush = () => { if (list) { blocks.push(list); list = null } }
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) { flush(); continue }
    const bullet = line.match(/^[-*•]\s+(.*)$/)
    const num = line.match(/^(\d+)[.)]\s+(.*)$/)
    if (bullet) {
      if (!list) { flush(); list = { isList: true, items: [] } }
      list.items.push({ label: '•', segs: parseInline(bullet[1]) })
    } else if (num) {
      if (!list) { flush(); list = { isList: true, items: [] } }
      list.items.push({ label: num[1] + '.', segs: parseInline(num[2]) })
    } else {
      flush()
      blocks.push({ isP: true, segs: parseInline(line) })
    }
  }
  flush()
  return blocks
}

function Segs({ segs, boldColor }) {
  return segs.map((s, i) => s.bold
    ? <strong key={i} style={{ color: boldColor, fontWeight: 700 }}>{s.text}</strong>
    : <React.Fragment key={i}>{s.text}</React.Fragment>)
}

function Blocks({ blocks, boldColor }) {
  return blocks.map((b, i) => b.isList ? (
    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 5, margin: '5px 0 8px' }}>
      {b.items.map((it, j) => (
        <div key={j} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
          <span style={{ color: ACCENT, flex: 'none', fontWeight: 700, minWidth: 14 }}>{it.label}</span>
          <span><Segs segs={it.segs} boldColor={boldColor} /></span>
        </div>
      ))}
    </div>
  ) : (
    <p key={i} style={{ margin: '0 0 7px' }}><Segs segs={b.segs} boldColor={boldColor} /></p>
  ))
}

const CHIPS = [
  { icon: '🗓️', label: 'Plan mijn dag', prompt: 'Plan mijn dag in op basis van mijn taken en routines van vandaag. Geef een realistisch, kort tijdschema.' },
  { icon: '✅', label: 'Wat is nu belangrijk?', prompt: 'Wat is op dit moment het belangrijkste om op te pakken?' },
  { icon: '🔥', label: 'Hoe gaan mijn routines?', prompt: 'Hoe staan mijn routines en streaks ervoor vandaag? Wat moet ik nog doen?' },
  { icon: '💸', label: 'Hoe staat mijn budget?', prompt: 'Hoe staat mijn budget deze maand ervoor en kan ik nog iets besparen?' },
  { icon: '📋', label: 'Wat staat er te laat?', prompt: 'Welke taken staan er te laat en hoe pak ik die het beste aan?' },
]

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Goedemorgen' : h < 18 ? 'Goedemiddag' : 'Goedenavond'
}

export default function HypexAIPage({ tasks = [], subjects = [], userId, displayName = 'daar' }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [budgetLine, setBudgetLine] = useState('')
  const [briefing, setBriefing] = useState('')
  const [briefBusy, setBriefBusy] = useState(false)
  const endRef = useRef(null)
  const scrollRef = useRef(null)

  // Budgetsamenvatting van deze maand ophalen (indicatief)
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    ;(async () => {
      try {
        const today = todayISO()
        const monthStart = today.slice(0, 8) + '01'
        const [{ data: cfg }, { data: exp }] = await Promise.all([
          supabase.from('budget_config').select('monthly_budget').eq('user_id', userId).maybeSingle(),
          supabase.from('expenses').select('amount,is_income,is_savings_withdrawal,is_savings_contribution,is_loan_repayment,paid_from_savings,category,is_planned,date')
            .eq('user_id', userId).gte('date', monthStart).lte('date', today),
        ])
        if (cancelled) return
        const budget = cfg?.monthly_budget || 0
        const spent = (exp || [])
          .filter(e => !e.is_income && !e.is_savings_withdrawal && !e.is_savings_contribution && !e.is_loan_repayment && !e.paid_from_savings && (!e.is_planned || e.amount > 0))
          .reduce((s, e) => s + Number(e.amount), 0)
        if (budget > 0) setBudgetLine(`Budget deze maand: ongeveer €${Math.round(spent)} uitgegeven van €${Math.round(budget)} (±€${Math.round(budget - spent)} over).`)
      } catch { /* stil */ }
    })()
    return () => { cancelled = true }
  }, [userId])

  const dataSummary = useMemo(() => {
    const today = todayISO()
    const subjName = id => subjects.find(s => s.id === id)?.name
    const oneoff = tasks.filter(t => !t.recurrence && !t.completed)
    const todayTasks = oneoff.filter(t => t.date === today)
    const overdue = oneoff.filter(t => t.date && t.date < today)
    const unplanned = oneoff.filter(t => !t.date)
    const routines = tasks.filter(t => t.recurrence && (isDueToday(t, today) || isDoneToday(t, today)))
    const fmtTask = t => `${t.title}${(t.start_time || t.time) ? ` om ${t.start_time || t.time}` : ''}${(t.priority ?? 2) === 1 ? ' [urgent]' : ''}${subjName(t.subject_id) ? ` (${subjName(t.subject_id)})` : ''}`
    return [
      `Taken vandaag (${todayTasks.length}):` + (todayTasks.length ? '\n- ' + todayTasks.map(fmtTask).join('\n- ') : ' geen'),
      `Te laat (${overdue.length}):` + (overdue.length ? '\n- ' + overdue.map(fmtTask).join('\n- ') : ' geen'),
      `Nog in te plannen (${unplanned.length}):` + (unplanned.length ? '\n- ' + unplanned.map(t => t.title).join('\n- ') : ' geen'),
      `Routines vandaag (streak | gedaan):` + (routines.length ? '\n- ' + routines.map(r => `${r.title}: ${r.streak || 0} dagen, ${isDoneToday(r, today) ? 'gedaan' : 'NOG NIET'}`).join('\n- ') : ' geen'),
      budgetLine,
    ].filter(Boolean).join('\n')
  }, [tasks, subjects, budgetLine])

  const systemPrompt = useMemo(() => {
    const d = new Date()
    const datum = d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
    return [
      `Je bent "Hypex AI", de persoonlijke assistent binnen Hypex — het productiviteits- & planningsdashboard van ${displayName}. Je spreekt Nederlands. Vandaag is ${datum}.`,
      `Antwoord BONDIG (meestal 2–5 zinnen of een korte lijst), tenzij om een plan of uitleg wordt gevraagd. Gebruik **vetgedrukt** voor cijfers, namen en data, en opsommingen met "- " waar dat helpt. Max 1 emoji per bericht. Verzin GEEN data die hieronder niet staat; zeg eerlijk als iets ontbreekt.`,
      ``,
      `=== DATA VAN ${displayName.toUpperCase()} (vandaag) ===`,
      dataSummary,
    ].join('\n')
  }, [dataSummary, displayName])

  // Standaard-briefing uit echte data
  useEffect(() => {
    const today = todayISO()
    const oneoff = tasks.filter(t => !t.recurrence && !t.completed)
    const todayCount = oneoff.filter(t => t.date === today).length
    const overdue = oneoff.filter(t => t.date && t.date < today).length
    const urgent = oneoff.filter(t => (t.priority ?? 2) === 1)
    const routines = tasks.filter(t => t.recurrence && isDueToday(t, today))
    const routinesTodo = routines.filter(t => !isDoneToday(t, today)).length
    const lines = []
    lines.push(`Je hebt vandaag **${todayCount} ${todayCount === 1 ? 'taak' : 'taken'}** gepland${routines.length ? ` en **${routines.length} ${routines.length === 1 ? 'routine' : 'routines'}**` : ''}.`)
    if (urgent.length) lines.push(`Urgent: **${urgent[0].title}**${urgent.length > 1 ? ` (+${urgent.length - 1} meer)` : ''}.`)
    if (overdue) lines.push(`Let op: **${overdue} ${overdue === 1 ? 'taak staat' : 'taken staan'} te laat**.`)
    if (routinesTodo) lines.push(`Nog **${routinesTodo}** ${routinesTodo === 1 ? 'routine' : 'routines'} te doen vandaag — hou je streak vast. 🔥`)
    if (budgetLine) lines.push(budgetLine.replace('Budget deze maand: ongeveer', 'Budget: ongeveer'))
    setBriefing(lines.join('\n'))
  }, [tasks, budgetLine])

  const scrollSoon = () => requestAnimationFrame(() => setTimeout(() => {
    try { scrollRef.current?.scrollTo({ top: 999999, behavior: 'smooth' }) } catch {}
  }, 60))

  const callAI = async (msgs, system) => {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    const r = await fetch('/.netlify/functions/ai-chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ system, messages: msgs }),
    })
    const j = await r.json()
    if (!r.ok) throw new Error(j?.error || 'AI-fout')
    return j.reply || ''
  }

  const ask = async (text) => {
    const t = text.trim()
    if (!t || loading) return
    const userMsg = { id: Date.now() + 'u', isUser: true, raw: t }
    setMessages(m => [...m, userMsg])
    setInput('')
    setLoading(true)
    scrollSoon()
    try {
      const history = [...messages, userMsg].filter(m => m.raw).slice(-12).map(m => ({ role: m.isUser ? 'user' : 'assistant', content: m.raw }))
      const reply = await callAI(history, systemPrompt)
      const out = reply.trim() || 'Sorry, ik kon even geen antwoord genereren.'
      setMessages(m => [...m, { id: Date.now() + 'a', isUser: false, raw: out }])
    } catch (e) {
      const msg = /geconfigureerd|API_KEY/i.test(e.message)
        ? 'De AI is nog niet geconfigureerd (GEMINI_API_KEY ontbreekt in Netlify).'
        : 'Er ging iets mis bij het ophalen. Probeer het zo nog eens.'
      setMessages(m => [...m, { id: Date.now() + 'a', isUser: false, raw: msg }])
    }
    setLoading(false)
    scrollSoon()
  }

  const regenBriefing = async () => {
    if (briefBusy) return
    setBriefBusy(true)
    try {
      const reply = await callAI(
        [{ role: 'user', content: 'Schrijf een korte ochtendbriefing (3–4 zinnen) over mijn dag. Begin NIET met een begroeting. Noem het belangrijkste qua taken, routines en budget. Gebruik **vet** voor cijfers. Max 1 emoji.' }],
        systemPrompt,
      )
      if (reply.trim()) setBriefing(reply.trim())
    } catch { /* laat huidige staan */ }
    setBriefBusy(false)
  }

  const canSend = input.trim().length > 0 && !loading

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 52, padding: '0 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(24px)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 24, height: 24, borderRadius: 8, background: 'linear-gradient(140deg, rgba(0,255,209,0.9), rgba(0,180,255,0.7))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 14px rgba(0,255,209,0.4)' }}>
            <span style={{ fontSize: 13, lineHeight: 1 }}>✦</span>
          </div>
          <span style={{ fontWeight: 600, fontSize: 17, color: 'rgba(255,255,255,0.92)', letterSpacing: '-0.02em' }}>Hypex AI</span>
        </div>
        <button onClick={() => setMessages([])} title="Nieuw gesprek" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.45)', padding: 8, display: 'flex', alignItems: 'center' }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </div>

      {/* Chat */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 14px 8px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Briefing */}
        {messages.length === 0 && briefing && (
          <div style={{ position: 'relative', padding: '16px 16px 15px', borderRadius: 18, background: 'rgba(0,255,209,0.05)', border: '1px solid rgba(0,255,209,0.16)', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -30, right: -20, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,255,209,0.16), transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 12 }}>✦</span>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: ACCENT }}>Dagbriefing</span>
              </div>
              <button onClick={regenBriefing} style={{ background: 'rgba(0,255,209,0.08)', border: '1px solid rgba(0,255,209,0.2)', borderRadius: 8, cursor: 'pointer', color: ACCENT, padding: '4px 6px', display: 'flex', alignItems: 'center' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: briefBusy ? 'spin 0.8s linear infinite' : 'none' }}><path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v5h-5" /></svg>
              </button>
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.92)', margin: '0 0 8px', letterSpacing: '-0.01em' }}>{greeting()}, {displayName}</p>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(255,255,255,0.7)' }}>
              <Blocks blocks={parseMd(briefing)} boldColor="rgba(255,255,255,0.92)" />
            </div>
          </div>
        )}

        {/* Chips */}
        {messages.length === 0 && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '2px 0 4px', scrollbarWidth: 'none' }}>
            {CHIPS.map(c => (
              <button key={c.label} onClick={() => ask(c.prompt)} style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 7, padding: '9px 13px', borderRadius: 13, background: 'rgba(255,255,255,0.045)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', color: 'rgba(255,255,255,0.82)', fontSize: 12.5, fontWeight: 500, whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: 14 }}>{c.icon}</span>{c.label}
              </button>
            ))}
          </div>
        )}

        {/* Messages */}
        {messages.map(m => m.isUser ? (
          <div key={m.id} style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ maxWidth: '82%', padding: '11px 14px', borderRadius: '18px 18px 5px 18px', background: 'linear-gradient(140deg, rgba(0,255,209,0.92), rgba(0,210,200,0.82))', color: '#042420', fontSize: 14, lineHeight: 1.5, fontWeight: 500, whiteSpace: 'pre-wrap' }}>
              {m.raw}
            </div>
          </div>
        ) : (
          <div key={m.id} style={{ display: 'flex', gap: 9 }}>
            <div style={{ flex: 'none', width: 26, height: 26, borderRadius: 9, background: 'linear-gradient(140deg, rgba(0,255,209,0.9), rgba(0,180,255,0.7))', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2, boxShadow: '0 0 12px rgba(0,255,209,0.3)', fontSize: 13 }}>✦</div>
            <div style={{ maxWidth: '80%', padding: '12px 14px', borderRadius: '18px 18px 18px 5px', background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 1.58 }}>
              <Blocks blocks={parseMd(m.raw)} boldColor="#4dffe0" />
            </div>
          </div>
        ))}

        {/* Typing */}
        {loading && (
          <div style={{ display: 'flex', gap: 9 }}>
            <div style={{ flex: 'none', width: 26, height: 26, borderRadius: 9, background: 'linear-gradient(140deg, rgba(0,255,209,0.9), rgba(0,180,255,0.7))', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2, fontSize: 13 }}>✦</div>
            <div style={{ padding: '14px 16px', borderRadius: '18px 18px 18px 5px', background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: 5, alignItems: 'center' }}>
              {[0, 0.2, 0.4].map(d => <span key={d} style={{ width: 7, height: 7, borderRadius: '50%', background: ACCENT, animation: `aiblink 1.2s infinite ${d}s` }} />)}
            </div>
          </div>
        )}
        <div ref={endRef} style={{ height: 2, flexShrink: 0 }} />
      </div>

      {/* Input */}
      <div style={{ flexShrink: 0, padding: '8px 14px calc(8px + env(safe-area-inset-bottom))', borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', backdropFilter: 'blur(24px)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 9, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 22, padding: '5px 5px 5px 16px' }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input) } }}
            placeholder="Vraag Hypex AI iets..."
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'rgba(255,255,255,0.92)', fontSize: 14, padding: '8px 0', minWidth: 0 }}
          />
          <button onClick={() => ask(input)} disabled={!canSend} style={{ flex: 'none', width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: canSend ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', background: canSend ? 'linear-gradient(140deg, #00FFD1, #00d2c8)' : 'rgba(255,255,255,0.08)', boxShadow: canSend ? '0 0 16px rgba(0,255,209,0.35)' : 'none' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={canSend ? '#042420' : 'rgba(255,255,255,0.35)'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </button>
        </div>
      </div>

      <style>{`@keyframes aiblink{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}`}</style>
    </div>
  )
}
