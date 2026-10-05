import React, { useState, useEffect, useRef, useMemo } from 'react'
import { taskOnDay, taskLastDate } from '../utils/taskStatus'
import { supabase } from '../supabaseClient'
import { isDueToday, isDoneToday, appliesOn, advanceOnComplete, todayISO, toISO } from '../utils/recurrence'
import DagbriefingStrip from '../components/ai/DagbriefingStrip'
import { useExpenses } from '../geld/hooks/useExpenses'
import { useBudgetConfig } from '../geld/hooks/useBudgetConfig'
import { useYearExpenses } from '../geld/hooks/useYearExpenses'
import { useBudgetStats } from '../geld/hooks/useBudgetStats'
import { greeting } from '../utils/greeting'

const ACCENT = 'var(--accent)'

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
  { icon: '🗓️', label: 'Plan mijn dag', prompt: 'Plan mijn dag in op basis van mijn taken van vandaag, mijn te-late taken en mijn routines. Geef een realistisch, kort tijdschema vanaf nu.' },
  { icon: '✅', label: 'Wat is nu belangrijk?', prompt: 'Wat is op dit moment het belangrijkste om op te pakken?' },
  { icon: '🔥', label: 'Hoe gaan mijn routines?', prompt: 'Hoe staan mijn routines en streaks ervoor vandaag? Wat moet ik nog doen?' },
  { icon: '💸', label: 'Hoe staat mijn budget?', prompt: 'Hoe staat mijn budget deze maand ervoor en kan ik nog iets besparen?' },
  { icon: '📋', label: 'Wat staat er te laat?', prompt: 'Welke taken staan er te laat en hoe pak ik die het beste aan?' },
]

// ── agentische acties ──
const CMD_RE = /\b(voeg|maak|zet|log|noteer|onthoud|herinner|schrijf|vink|streep|afvinken|toevoegen|gedaan|klaar|betaald|uitgegeven|gespendeerd|gekocht|uitgave|kostte|plan)\b/i
function looksLikeCommand(t) {
  return CMD_RE.test(t) || /gaf .* uit/i.test(t) || /^\s*(nieuwe taak|nieuwe notitie|taak:)/i.test(t)
}
function normDateISO(s) {
  const v = String(s || '').toLowerCase().trim()
  if (!v || v === 'vandaag' || v === 'today') return todayISO()
  if (v === 'morgen' || v === 'tomorrow') { const d = new Date(); d.setDate(d.getDate() + 1); return toISO(d) }
  const m = v.match(/(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : todayISO()
}
function addHour(hhmm) { const [h, m] = hhmm.split(':').map(Number); return String((h + 1) % 24).padStart(2, '0') + ':' + String(m).padStart(2, '0') }
const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
// Vind de bedoelde taak/routine op naam (soepel: bevat in beide richtingen, anders eerste woord)
function matchTask(want, list) {
  const w = norm(want)
  if (!w) return null
  return list.find(x => { const tt = norm(x.title); return tt.includes(w) || w.includes(tt) })
    || list.find(x => { const fw = w.split(' ')[0]; return fw.length > 2 && norm(x.title).includes(fw) })
    || null
}
const EXP_CATS = ['eten', 'boodschappen', 'transport', 'kleding', 'abonnementen', 'sport', 'overig']
const euro = n => '€' + Number(n).toFixed(2).replace('.', ',')
const CARD = {
  teal: { accent: 'var(--accent)', bg: 'color-mix(in srgb, var(--accent) 6%, transparent)', border: 'color-mix(in srgb, var(--accent) 20%, transparent)', iconBg: 'color-mix(in srgb, var(--accent) 12%, transparent)' },
  orange: { accent: '#FF8C42', bg: 'rgba(255,140,66,0.07)', border: 'rgba(255,140,66,0.25)', iconBg: 'rgba(255,140,66,0.14)' },
  purple: { accent: '#A78BFA', bg: 'rgba(167,139,250,0.07)', border: 'rgba(167,139,250,0.25)', iconBg: 'rgba(167,139,250,0.14)' },
}
const actCard = (icon, title, detail, c) => ({ id: 'act' + Date.now() + Math.random().toString(36).slice(2, 6), isAction: true, icon, title, detail, ...c })

export default function HypexAIPage({ tasks = [], subjects = [], userId, displayName = 'daar', calendarEvents = [], magisterLessons = [], onNavigate, onNavigateToTasks, onNavigateToAgenda }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  // Budget: dezelfde berekening als de Geld-pagina en het Dashboard (useBudgetStats)
  const { expenses, prevExpenses, loading: expLoading } = useExpenses(userId)
  const { config: budgetConfig, loading: cfgLoading } = useBudgetConfig(userId)
  const { yearExpenses } = useYearExpenses(userId)
  const budgetStats = useBudgetStats({ expenses, prevExpenses, yearExpenses, config: budgetConfig })
  const budgetLine = useMemo(() => {
    if (expLoading || cfgLoading || !budgetConfig) return ''
    const s = budgetStats
    const left = s.adjustedRemaining
    return `Budget deze maand: ongeveer €${Math.round(s.totalSpent)} uitgegeven van €${Math.round(s.adjustedBase)} (${left < 0 ? `€${Math.round(-left)} over het budget` : `€${Math.round(left)} over`}).`
  }, [budgetStats, budgetConfig, expLoading, cfgLoading])
  const [briefing, setBriefing] = useState('')
  const [briefBusy, setBriefBusy] = useState(false)
  const [appH, setAppH] = useState(0)
  const [dbg, setDbg] = useState({ iH: 0, top: 0, parentH: 0, h: 0 })
  const endRef = useRef(null)
  const scrollRef = useRef(null)
  const pageRef = useRef(null)

  const dataSummary = useMemo(() => {
    const today = todayISO()
    const subjName = id => subjects.find(s => s.id === id)?.name
    const oneoff = tasks.filter(t => !t.recurrence && !t.completed)
    const todayTasks = oneoff.filter(t => taskOnDay(t, today))
    const overdue = oneoff.filter(t => t.date && taskLastDate(t) < today)
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

  // Bij elke vraag opnieuw opgebouwd, zodat de actuele datum én tijd kloppen
  const buildSystem = () => {
    const d = new Date()
    const datum = d.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })
    const tijd = d.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
    const routineTitles = tasks.filter(t => t.recurrence).map(t => t.title)
    return [
      `Je bent "Hypex AI", de persoonlijke assistent binnen Hypex — het productiviteits- & planningsdashboard van ${displayName}. Je spreekt Nederlands. Vandaag is ${datum} en het is nu ${tijd}.`,
      `Houd rekening met het HUIDIGE TIJDSTIP (${tijd}): plan en adviseer alleen voor de tijd die vandaag nog resteert. Stel dus geen ochtend- of voorbije momenten meer voor als die al gepasseerd zijn, en houd realistische blokken aan vanaf nu.`,
      `Als je de dag plant, neem dan ook de TE LATE taken mee (zet die bij voorkeur als eerste in het schema, zodat de achterstand wordt ingelopen).`,
      `Antwoord BONDIG (meestal 2–5 zinnen of een korte lijst), tenzij om een plan of uitleg wordt gevraagd. Gebruik **vetgedrukt** voor cijfers, namen, tijden en data, en opsommingen met "- " waar dat helpt. Max 1 emoji per bericht. Verzin GEEN data die hieronder niet staat; zeg eerlijk als iets ontbreekt.`,
      ``,
      `=== DATA VAN ${displayName.toUpperCase()} (vandaag) ===`,
      dataSummary,
      ``,
      `Je kunt ook dingen voor ${displayName} OPSLAAN. Als (en alleen als) hij daar duidelijk om vraagt, bevestig je kort in je antwoord en zet je daarna op een NIEUWE laatste regel: @@ACTIES@@ gevolgd door een JSON-array met de wijzigingen. Bij een gewone vraag (geen wijziging) laat je die regel volledig weg.`,
      `Actie-vormen (objecten in de array):`,
      `{"type":"add_task","titel":"...","datum":"vandaag|morgen|YYYY-MM-DD","tijd":"HH:MM of null","prioriteit":"urgent|normaal","vak":"... of null"}`,
      `{"type":"complete_task","titel":"..."}`,
      `{"type":"add_expense","bedrag":12.5,"categorie":"eten|boodschappen|transport|kleding|abonnementen|sport|overig","omschrijving":"..."}`,
      `{"type":"routine_done","naam":"..."}`,
      `{"type":"add_note","tekst":"..."}`,
      routineTitles.length ? `Routines heten exact: ${routineTitles.join(', ')}.` : '',
      `Voorbeeld — gebruiker: "log 12 euro boodschappen" -> jouw antwoord eindigt met:`,
      `@@ACTIES@@ [{"type":"add_expense","bedrag":12,"categorie":"boodschappen","omschrijving":""}]`,
    ].join('\n')
  }

  // Standaard-briefing uit echte data
  useEffect(() => {
    const today = todayISO()
    const oneoff = tasks.filter(t => !t.recurrence && !t.completed)
    const todayCount = oneoff.filter(t => taskOnDay(t, today)).length
    const overdue = oneoff.filter(t => t.date && taskLastDate(t) < today).length
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

  // window.innerHeight krimpt op dit toestel mét het toetsenbord (793 -> ~428).
  // De pagina mag niet hoger zijn dan (a) zijn container, en (b) tot de boven-
  // kant van het toetsenbord (innerHeight - eigen top-offset). Pak de kleinste;
  // is dat de container, dan gewoon 100% (toetsenbord dicht).
  useEffect(() => {
    const vv = window.visualViewport
    let raf = 0
    const update = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const el = pageRef.current
        const iH = window.innerHeight
        const top = el ? Math.round(el.getBoundingClientRect().top) : 0
        const parentH = el && el.parentElement ? el.parentElement.clientHeight : iH
        const limited = iH - top
        const h = (limited < parentH - 8) ? Math.max(120, limited) : 0
        setDbg({ iH, top, parentH, h })
        setAppH(h)
        scrollSoon()
      })
    }
    update()
    window.addEventListener('resize', update)
    vv?.addEventListener('resize', update)
    return () => { window.removeEventListener('resize', update); vv?.removeEventListener('resize', update); cancelAnimationFrame(raf) }
  }, [])

  const callAI = async (msgs, system, opts = {}) => {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    const r = await fetch('/.netlify/functions/ai-chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({
        system, messages: msgs,
        ...(opts.json ? { json: true } : {}),
        ...(opts.temperature != null ? { temperature: opts.temperature } : {}),
      }),
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
      const reply = await callAI(history, buildSystem())
      let raw = reply.trim() || 'Sorry, ik kon even geen antwoord genereren.'
      // Acties staan achter de marker in hetzelfde antwoord (1 call i.p.v. 2)
      let actsRaw = null
      const mk = raw.match(/@@ACTIES@@/i)
      if (mk) { actsRaw = raw.slice(mk.index + mk[0].length); raw = raw.slice(0, mk.index).trim() }
      const out = raw.replace(/```[\s\S]*?```/g, '').replace(/<action>[\s\S]*?<\/action>/gi, '').replace(/\n{3,}/g, '\n\n').trim() || 'Oké!'
      setMessages(m => [...m, { id: Date.now() + 'a', isUser: false, raw: out }])
      setLoading(false)
      scrollSoon()
      if (actsRaw) {
        let acts = []
        const arr = actsRaw.match(/\[[\s\S]*\]/)
        if (arr) { try { const p = JSON.parse(arr[0]); if (Array.isArray(p)) acts = p.filter(a => a && a.type) } catch {} }
        const cards = []
        for (const a of acts) { const c = await executeAction(a); if (c) cards.push(c) }
        if (cards.length) { setMessages(m => [...m, ...cards]); scrollSoon() }
      }
      return
    } catch (e) {
      const msg = /geconfigureerd|API_KEY/i.test(e.message)
        ? 'De AI is nog niet geconfigureerd (GEMINI_API_KEY ontbreekt in Netlify).'
        : `Er ging iets mis: ${e.message || 'onbekende fout'}`
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
        [{ role: 'user', content: 'Schrijf een korte briefing (3–4 zinnen) over mijn dag vanaf nu. Begin NIET met een begroeting. Noem het belangrijkste qua taken, routines en budget, rekening houdend met het huidige tijdstip. Gebruik **vet** voor cijfers. Max 1 emoji.' }],
        buildSystem(),
      )
      if (reply.trim()) setBriefing(reply.trim())
    } catch { /* laat huidige staan */ }
    setBriefBusy(false)
  }

  // Voert een actie echt uit (schrijft naar Supabase) en geeft een kaartje terug
  const executeAction = async (a) => {
    const today = todayISO()
    try {
      if (a.type === 'add_task') {
        const date = normDateISO(a.datum)
        const tm = (a.tijd && String(a.tijd).match(/\d{1,2}:\d{2}/)) ? String(a.tijd).match(/\d{1,2}:\d{2}/)[0] : null
        const titel = a.titel || 'Nieuwe taak'
        const urgent = a.prioriteit === 'urgent'
        const subj = a.vak ? subjects.find(s => s.name.toLowerCase().includes(String(a.vak).toLowerCase())) : null
        const { error } = await supabase.from('tasks').insert({ user_id: userId, title: titel, date, time: tm, start_time: tm, end_time: tm ? addHour(tm) : null, priority: urgent ? 1 : 2, subject_id: subj?.id || null, completed: false })
        if (error) return actCard('⚠️', 'Kon taak niet opslaan', error.message, CARD.orange)
        window.dispatchEvent(new Event('refreshTasks'))
        return actCard('✅', 'Taak toegevoegd', `${titel} · ${date === today ? 'vandaag' : date}${tm ? ' om ' + tm : ''}${urgent ? ' · urgent' : ''}`, CARD.teal)
      }
      if (a.type === 'complete_task') {
        const t = matchTask(a.titel, tasks.filter(x => !x.completed))
        if (!t) return actCard('🔍', 'Taak niet gevonden', a.titel || '', CARD.purple)
        let error
        if (t.recurrence) { const upd = advanceOnComplete(t, today); if (upd) ({ error } = await supabase.from('tasks').update({ ...upd, updated_at: new Date().toISOString() }).eq('id', t.id)) }
        else ({ error } = await supabase.from('tasks').update({ completed: true, updated_at: new Date().toISOString() }).eq('id', t.id))
        if (error) return actCard('⚠️', 'Kon niet afvinken', error.message, CARD.orange)
        window.dispatchEvent(new Event('refreshTasks'))
        return actCard('☑️', 'Taak afgevinkt', t.title, CARD.teal)
      }
      if (a.type === 'add_expense') {
        const bedrag = Number(a.bedrag) || 0
        const cat = EXP_CATS.includes(a.categorie) ? a.categorie : 'overig'
        const { error } = await supabase.from('expenses').insert({ user_id: userId, amount: bedrag, category: cat, description: a.omschrijving || '', date: today, is_income: false, is_savings_withdrawal: false, is_savings_contribution: false, is_loan_repayment: false, paid_from_savings: false, is_planned: false })
        if (error) return actCard('⚠️', 'Kon uitgave niet opslaan', error.message, CARD.orange)
        return actCard('💸', 'Uitgave gelogd', `${euro(bedrag)} · ${cat}${a.omschrijving ? ' · ' + a.omschrijving : ''}`, CARD.orange)
      }
      if (a.type === 'routine_done') {
        const t = matchTask(a.naam, tasks.filter(x => x.recurrence))
        if (!t) return actCard('🔍', 'Routine niet gevonden', a.naam || '', CARD.purple)
        if (!isDoneToday(t, today)) {
          const upd = advanceOnComplete(t, today)
          if (upd) { const { error } = await supabase.from('tasks').update({ ...upd, updated_at: new Date().toISOString() }).eq('id', t.id); if (error) return actCard('⚠️', 'Kon routine niet afvinken', error.message, CARD.orange) }
          window.dispatchEvent(new Event('refreshTasks'))
        }
        return actCard('🔥', 'Routine afgevinkt', `${t.title} · streak ${(t.streak || 0) + 1} dagen`, CARD.orange)
      }
      if (a.type === 'add_note') {
        const tekst = String(a.tekst || '')
        const title = (tekst.split('\n')[0] || 'Notitie').slice(0, 40)
        const { error } = await supabase.from('notes').insert({ user_id: userId, title, content: tekst, folder_id: null })
        if (error) return actCard('⚠️', 'Kon notitie niet opslaan', error.message, CARD.purple)
        return actCard('📝', 'Notitie opgeslagen', tekst.length > 44 ? tekst.slice(0, 44) + '…' : tekst, CARD.purple)
      }
    } catch { /* stil */ }
    return null
  }

  const canSend = input.trim().length > 0 && !loading

  return (
    <div ref={pageRef} style={{ height: appH ? `${appH}px` : '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      {/* Op mobiel staat de titel al in de app-balk; daar alleen de 'Nieuw gesprek'-knop */}
      <div className="h-11 md:h-14" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '1px solid var(--c-border)', background: 'rgba(255,255,255,0.02)', flexShrink: 0 }}>
        <div className="hidden md:flex items-center" style={{ gap: 9 }}>
          <div style={{ width: 24, height: 24, borderRadius: 8, background: 'linear-gradient(140deg, color-mix(in srgb, var(--accent) 90%, transparent), color-mix(in srgb, var(--accent) 55%, #3b82f6))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 14px color-mix(in srgb, var(--accent) 40%, transparent)' }}>
            <span style={{ fontSize: 13, lineHeight: 1 }}>✦</span>
          </div>
          <h1 className="t-page" style={{ margin: 0, fontSize: 17 }}>Hypex AI</h1>
        </div>
        <button onClick={() => setMessages([])} title="Nieuw gesprek" aria-label="Nieuw gesprek" style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)', padding: 8, display: 'flex', alignItems: 'center' }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
        </button>
      </div>

      {/* Chat */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 14px 8px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Briefing */}
        {messages.length === 0 && briefing && (
          <div className="card glow-card" style={{ '--glow': 'var(--accent)', position: 'relative', padding: '16px 16px 15px', borderColor: 'color-mix(in srgb, var(--accent) 22%, transparent)', background: 'color-mix(in srgb, var(--accent) 4%, var(--c-surface))' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 12 }}>✦</span>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: ACCENT }}>Dagbriefing</span>
              </div>
              <button onClick={regenBriefing} aria-label="AI-briefing vernieuwen" title="AI-briefing vernieuwen" style={{ background: 'var(--accent-soft)', border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)', borderRadius: 8, cursor: 'pointer', color: ACCENT, padding: '4px 6px', display: 'flex', alignItems: 'center' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: briefBusy ? 'spin 0.8s linear infinite' : 'none' }}><path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v5h-5" /></svg>
              </button>
            </div>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text)', margin: '0 0 12px', letterSpacing: '-0.01em' }}>{greeting()}, {displayName}</p>
            <DagbriefingStrip tasks={tasks} calendarEvents={calendarEvents} magisterLessons={magisterLessons} userId={userId}
              onNavigate={onNavigate} onNavigateToTasks={onNavigateToTasks} onNavigateToAgenda={onNavigateToAgenda} />
            <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--c-text-2)' }}>
              <Blocks blocks={parseMd(briefing)} boldColor="rgba(255,255,255,0.92)" />
            </div>
          </div>
        )}

        {/* Chips */}
        {messages.length === 0 && (
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '2px 0 4px', scrollbarWidth: 'none' }}>
            {CHIPS.map(c => (
              <button key={c.label} onClick={() => ask(c.prompt)} className="btn-ghost" style={{ flex: 'none', gap: 7, padding: '9px 13px', borderRadius: 'var(--r-md)', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>
                <span style={{ fontSize: 14 }}>{c.icon}</span>{c.label}
              </button>
            ))}
          </div>
        )}

        {/* Messages */}
        {messages.map(m => m.isAction ? (
          <div key={m.id} style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11, width: '92%', padding: '11px 13px', borderRadius: 14, background: m.bg, border: `1px solid ${m.border}` }}>
              <div style={{ flex: 'none', width: 30, height: 30, borderRadius: 9, background: m.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{m.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: m.accent }}>{m.title}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--c-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.detail}</p>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', color: m.accent }}><polyline points="20 6 9 17 4 12" /></svg>
            </div>
          </div>
        ) : m.isUser ? (
          <div key={m.id} style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ maxWidth: '82%', padding: '11px 14px', borderRadius: '18px 18px 5px 18px', background: 'linear-gradient(140deg, color-mix(in srgb, var(--accent) 92%, transparent), color-mix(in srgb, var(--accent) 80%, #000))', color: 'var(--on-accent)', fontSize: 14, lineHeight: 1.5, fontWeight: 500, whiteSpace: 'pre-wrap' }}>
              {m.raw}
            </div>
          </div>
        ) : (
          <div key={m.id} style={{ display: 'flex', gap: 9 }}>
            <div style={{ flex: 'none', width: 26, height: 26, borderRadius: 9, background: 'linear-gradient(140deg, color-mix(in srgb, var(--accent) 90%, transparent), color-mix(in srgb, var(--accent) 55%, #3b82f6))', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2, boxShadow: '0 0 12px color-mix(in srgb, var(--accent) 30%, transparent)', fontSize: 13 }}>✦</div>
            <div style={{ maxWidth: '80%', padding: '12px 14px', borderRadius: '18px 18px 18px 5px', background: 'rgba(255,255,255,0.055)', border: '1px solid var(--c-border-strong)', color: 'var(--c-text)', fontSize: 14, lineHeight: 1.58 }}>
              <Blocks blocks={parseMd(m.raw)} boldColor="#4dffe0" />
            </div>
          </div>
        ))}

        {/* Typing */}
        {loading && (
          <div style={{ display: 'flex', gap: 9 }}>
            <div style={{ flex: 'none', width: 26, height: 26, borderRadius: 9, background: 'linear-gradient(140deg, color-mix(in srgb, var(--accent) 90%, transparent), color-mix(in srgb, var(--accent) 55%, #3b82f6))', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2, fontSize: 13 }}>✦</div>
            <div style={{ padding: '14px 16px', borderRadius: '18px 18px 18px 5px', background: 'rgba(255,255,255,0.055)', border: '1px solid var(--c-border-strong)', display: 'flex', gap: 5, alignItems: 'center' }}>
              {[0, 0.2, 0.4].map(d => <span key={d} style={{ width: 7, height: 7, borderRadius: '50%', background: ACCENT, animation: `aiblink 1.2s infinite ${d}s` }} />)}
            </div>
          </div>
        )}
        <div ref={endRef} style={{ height: 2, flexShrink: 0 }} />
      </div>
      </div>

      {/* Input */}
      <div style={{ flexShrink: 0, padding: '8px 14px calc(8px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--c-border)', background: 'rgba(255,255,255,0.02)' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', alignItems: 'flex-end', gap: 9, background: 'var(--c-surface-2)', border: '1px solid var(--c-border-strong)', borderRadius: 22, padding: '5px 5px 5px 16px' }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input) } }}
            placeholder="Vraag Hypex AI iets..."
            aria-label="Vraag Hypex AI iets"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--c-text)', fontSize: 14, padding: '8px 0', minWidth: 0 }}
          />
          <button onClick={() => ask(input)} disabled={!canSend} aria-label="Versturen" style={{ flex: 'none', width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: canSend ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', background: canSend ? 'linear-gradient(140deg, var(--accent), color-mix(in srgb, var(--accent) 80%, #000))' : 'rgba(255,255,255,0.08)', boxShadow: canSend ? '0 0 16px color-mix(in srgb, var(--accent) 35%, transparent)' : 'none' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: canSend ? 'var(--on-accent)' : 'var(--c-text-3)' }}><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </button>
        </div>
      </div>

      <style>{`@keyframes aiblink{0%,80%,100%{opacity:.25;transform:translateY(0)}40%{opacity:1;transform:translateY(-3px)}}`}</style>
    </div>
  )
}
