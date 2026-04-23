import React, { useState, useEffect, useCallback, useRef } from 'react'
import ReactDOM from 'react-dom'
import { supabase } from '../supabaseClient'
import { Plus, X, Trash2, Pencil, AlertTriangle, TrendingDown, Wallet, ChevronDown, ChevronUp, ArrowDownLeft } from 'lucide-react'

const CATEGORIES = [
  { id: 'eten',          label: 'Eten & drinken', emoji: '🍔', color: '#F97316' },
  { id: 'boodschappen',  label: 'Boodschappen',   emoji: '🛒', color: '#10B981' },
  { id: 'transport',     label: 'Transport',       emoji: '🚌', color: '#3B82F6' },
  { id: 'kleding',       label: 'Kleding',         emoji: '👕', color: '#8B5CF6' },
  { id: 'abonnementen',  label: 'Vaste lasten',     emoji: '🏠', color: '#EC4899' },
  { id: 'sport',         label: 'Sport',           emoji: '⚽', color: '#FACC15' },
  { id: 'overig',        label: 'Overig',          emoji: '💸', color: '#94A3B8' },
]

const INCOME_CATEGORIES = [
  { id: 'salaris',   label: 'Salaris',   emoji: '💼' },
  { id: 'bijbaan',   label: 'Bijbaan',   emoji: '🏪' },
  { id: 'freelance', label: 'Freelance', emoji: '💻' },
  { id: 'zakgeld',   label: 'Zakgeld',   emoji: '🎁' },
  { id: 'overig',    label: 'Overig',    emoji: '💰' },
]

// ── Recurring income helpers ──────────────────────────────────────────────────
function getNextPayDate(src) {
  const todayISO = todayStr()
  if (src.type === 'monthly') {
    const now = new Date()
    let d = new Date(now.getFullYear(), now.getMonth(), src.day)
    if (d.toISOString().slice(0, 10) <= todayISO) d = new Date(now.getFullYear(), now.getMonth() + 1, src.day)
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
  }
  if (src.type === 'interval' && src.ref_date) {
    const ms = src.interval_days * 86400000
    let d = new Date(src.ref_date + 'T12:00:00')
    while (d.toISOString().slice(0, 10) <= todayISO) d = new Date(d.getTime() + ms)
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
  }
  return null
}

function calcRecurringThisMonth(recurringIncome) {
  if (!recurringIncome?.length) return 0
  const mStart = new Date(monthStart() + 'T00:00:00')
  const mEnd   = new Date(monthEnd()   + 'T23:59:59')
  return recurringIncome.reduce((sum, src) => {
    if (src.type === 'monthly') return sum + src.amount
    if (src.type === 'interval' && src.ref_date) {
      const ms = src.interval_days * 86400000
      let d = new Date(src.ref_date + 'T12:00:00')
      while (d < mStart) d = new Date(d.getTime() + ms)
      let count = 0
      while (d <= mEnd) { count++; d = new Date(d.getTime() + ms) }
      return sum + src.amount * count
    }
    return sum
  }, 0)
}

const DEFAULT_CAT_BUDGETS = {
  eten: 120, boodschappen: 80, transport: 40,
  kleding: 50, abonnementen: 30, sport: 20, overig: 60,
}

const CAT_COLORS = ['#F97316','#EF4444','#10B981','#3B82F6','#8B5CF6','#EC4899','#FACC15','#06B6D4','#84CC16','#94A3B8','#FB923C','#A3E635']
const CAT_EMOJIS = ['🎮','🎸','✈️','🍕','🧴','📚','🐾','🎁','🏋️','💊','🎨','🛒','🚗','🎬','☕','🧹','🏠','💡','🔧','🎓']

// iOS: scroll focused input above keyboard
const scrollFix = (e) => { const t = e.target; setTimeout(() => t.scrollIntoView({ behavior: 'smooth', block: 'center' }), 350) }

// Prevent touchmove on an element entirely (for backdrops / non-scrollable overlays)
function usePreventTouch(ref) {
  useEffect(() => {
    const el = ref.current; if (!el) return
    const fn = (e) => e.preventDefault()
    el.addEventListener('touchmove', fn, { passive: false })
    return () => el.removeEventListener('touchmove', fn)
  }, [ref])
}

// Allow scroll inside el but block overscroll at top/bottom so iOS can't bounce the body
function useScrollContain(ref) {
  useEffect(() => {
    const el = ref.current; if (!el) return
    let startY = 0
    const onStart = (e) => { startY = e.touches[0].clientY }
    const onMove = (e) => {
      const dy = e.touches[0].clientY - startY
      const atTop    = el.scrollTop <= 0
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
      if ((atTop && dy > 0) || (atBottom && dy < 0)) e.preventDefault()
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove',  onMove,  { passive: false })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove',  onMove)
    }
  }, [ref])
}

function fmt(n) { return `€${Number(n).toFixed(2).replace('.', ',')}` }
function fmtShort(n) { return `€${Math.round(n)}` }
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
function monthStartOf(y, m) { return `${y}-${String(m+1).padStart(2,'0')}-01` }
function monthEndOf(y, m) {
  const last = new Date(y, m+1, 0)
  return `${last.getFullYear()}-${String(last.getMonth()+1).padStart(2,'0')}-${String(last.getDate()).padStart(2,'0')}`
}
function monthLabelOf(y, m) {
  return new Date(y, m, 1).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
}
// Legacy wrappers (still used by calcRecurringThisMonth)
function monthStart() { const d = new Date(); return monthStartOf(d.getFullYear(), d.getMonth()) }
function monthEnd()   { const d = new Date(); return monthEndOf(d.getFullYear(), d.getMonth()) }

// ── Income day helpers ────────────────────────────────────────────────────────
function isPayDayToday(src) {
  const today = new Date()
  if (src.type === 'monthly') return today.getDate() === src.day
  if (src.type === 'interval' && src.ref_date) {
    const todayISO = todayStr()
    const ms = src.interval_days * 86400000
    let d = new Date(src.ref_date + 'T12:00:00')
    while (d.toISOString().slice(0, 10) < todayISO) d = new Date(d.getTime() + ms)
    return d.toISOString().slice(0, 10) === todayISO
  }
  return false
}
function getFilledInToday(config) {
  const fromSupabase = (config?.income_confirmed_dates || {})[todayStr()] || []
  try {
    const local = JSON.parse(localStorage.getItem('income_filled_in') || '{}')[todayStr()] || []
    return [...new Set([...fromSupabase, ...local])]
  } catch { return fromSupabase }
}
function markFilledInToday(id) {
  try {
    const data = JSON.parse(localStorage.getItem('income_filled_in') || '{}')
    const today = todayStr()
    data[today] = [...new Set([...(data[today] || []), id])]
    Object.keys(data).forEach(d => { if (d < today) delete data[d] })
    localStorage.setItem('income_filled_in', JSON.stringify(data))
  } catch {}
}

// ── Expense Log Modal ─────────────────────────────────────────────────────────
function ExpenseModal({ onClose, onSave, editing, categories = CATEGORIES, defaultDate, plannedMode }) {
  const backdropRef = useRef(null)
  usePreventTouch(backdropRef)
  const isPlanned = plannedMode || editing?.is_planned
  const [amount, setAmount]             = useState(editing?.amount || '')
  const [cat, setCat]                   = useState(editing?.category || 'eten')
  const [desc, setDesc]                 = useState(editing?.description || '')
  const [date, setDate]                 = useState(editing?.date || defaultDate || todayStr())
  const [paidFromSavings, setPFS]       = useState(editing?.paid_from_savings || false)

  const handleSave = () => {
    const n = parseFloat(String(amount).replace(',', '.'))
    if (isPlanned) {
      // Planned: description required, amount optional
      if (!desc.trim()) return
      onSave({ amount: n || 0, category: cat, description: desc.trim(), date, is_savings_withdrawal: false, paid_from_savings: false, is_planned: !editing?.is_planned ? true : false })
      return
    }
    if (!n || n <= 0) return
    onSave({ amount: n, category: cat, description: desc.trim(), date, is_savings_withdrawal: false, paid_from_savings: paidFromSavings, is_planned: false })
  }

  return ReactDOM.createPortal(
    <div ref={backdropRef} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 480, background: 'var(--bg-sidebar)', borderRadius: '22px 22px 0 0', border: '1px solid var(--border)', borderBottom: 'none', padding: '20px 20px calc(24px + env(safe-area-inset-bottom) + var(--keyboard-height, 0px))', animation: 'sheetUp 0.3s cubic-bezier(0.34,1.1,0.64,1)' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 18px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: isPlanned ? '#F59E0B' : 'var(--text-1)', margin: 0 }}>
            {isPlanned ? '📌 Geplande uitgave' : editing ? 'Bewerken' : 'Uitgave toevoegen'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}><X size={18} /></button>
        </div>

        {/* Amount — optioneel bij planned */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 24, fontWeight: 700, color: isPlanned ? 'rgba(245,158,11,0.5)' : 'var(--text-3)' }}>€</span>
            <input
              autoFocus={!isPlanned} type="text" inputMode="decimal" placeholder={isPlanned ? '0,00 (optioneel)' : '0,00'}
              value={amount} onChange={e => setAmount(e.target.value)}
              onFocus={scrollFix}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              style={{ width: '100%', padding: '14px 16px 14px 36px', borderRadius: 14, background: 'var(--bg-card-2)', border: `1px solid ${isPlanned ? 'rgba(245,158,11,0.3)' : 'var(--border)'}`, color: 'var(--text-1)', fontSize: 28, fontWeight: 700, colorScheme: 'dark' }}
            />
          </div>
        </div>

        {/* Category */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
          {categories.map(c => (
            <button key={c.id} onClick={() => setCat(c.id)} style={{ padding: '10px 4px', borderRadius: 12, border: cat === c.id ? `1px solid ${c.color}` : '1px solid var(--border)', background: cat === c.id ? `${c.color}18` : 'var(--bg-card-2)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 20 }}>{c.emoji}</span>
              <span style={{ fontSize: 9, color: cat === c.id ? c.color : 'var(--text-3)', fontWeight: cat === c.id ? 600 : 400 }}>{c.label.split(' ')[0]}</span>
            </button>
          ))}
        </div>

        {/* Description — verplicht bij planned */}
        <input
          autoFocus={isPlanned}
          placeholder={isPlanned ? 'Omschrijving (verplicht)' : 'Omschrijving (optioneel)'}
          value={desc} onChange={e => setDesc(e.target.value)}
          onFocus={scrollFix}
          style={{ width: '100%', padding: '10px 14px', borderRadius: 12, background: 'var(--bg-card-2)', border: `1px solid ${isPlanned && !desc.trim() ? 'rgba(245,158,11,0.4)' : 'var(--border)'}`, color: 'var(--text-1)', fontSize: 14, marginBottom: 12, colorScheme: 'dark' }}
        />

        {/* Date */}
        <input
          type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ width: '100%', padding: '10px 14px', borderRadius: 12, background: 'var(--bg-card-2)', border: '1px solid var(--border)', color: 'var(--text-3)', fontSize: 13, marginBottom: 18, colorScheme: 'dark' }}
        />

        {/* Betaald van spaarrekening toggle — niet bij planned */}
        {!isPlanned && <div onClick={() => setPFS(p => !p)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderRadius: 12, background: paidFromSavings ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)', border: paidFromSavings ? '1px solid rgba(245,158,11,0.35)' : '1px solid var(--border)', marginBottom: 14, cursor: 'pointer' }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: paidFromSavings ? '#F59E0B' : 'var(--text-3)', margin: '0 0 1px' }}>🏦 Betaald van spaarrekening</p>
            <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>Voor noodzakelijke uitgaven buiten budget</p>
          </div>
          <div style={{ width: 40, height: 22, borderRadius: 11, background: paidFromSavings ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.1)', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
            <div style={{ position: 'absolute', width: 18, height: 18, borderRadius: '50%', background: paidFromSavings ? '#F59E0B' : 'rgba(255,255,255,0.35)', top: 2, left: paidFromSavings ? 20 : 2, transition: 'left 0.2s' }} />
          </div>
        </div>}

        <button onClick={handleSave}
          disabled={isPlanned && !desc.trim()}
          style={{ width: '100%', padding: '14px', borderRadius: 14, background: isPlanned ? (desc.trim() ? '#F59E0B' : 'rgba(245,158,11,0.2)') : 'var(--accent)', border: 'none', color: '#000', fontSize: 15, fontWeight: 700, cursor: isPlanned && !desc.trim() ? 'default' : 'pointer' }}>
          {editing?.is_planned ? '✓ Bevestig als echte uitgave' : isPlanned ? '📌 Vastpinnen' : editing ? 'Opslaan' : '+ Toevoegen'}
        </button>
      </div>
    </div>,
    document.body
  )
}

// ── Savings Withdrawal Modal ──────────────────────────────────────────────────
function SavingsModal({ onClose, onSave, editing }) {
  const backdropRef = useRef(null)
  usePreventTouch(backdropRef)
  const [amount, setAmount]   = useState(editing?.amount || '')
  const [reason, setReason]   = useState(editing?.description || '')
  const [savType, setSavType] = useState(editing?.savings_type || 'saved')

  const n       = parseFloat(String(amount).replace(',', '.'))
  const canSave = n > 0 && reason.trim().length > 0
  const interest = savType === 'loan' && n > 0 ? +(n * 0.1).toFixed(2) : 0

  const handleSave = () => {
    if (!canSave) return
    onSave({ amount: n, category: 'overig', description: reason.trim(), date: editing?.date || todayStr(), is_savings_withdrawal: true, savings_type: savType })
  }

  return ReactDOM.createPortal(
    <div ref={backdropRef} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 20px calc(20px + var(--keyboard-height, 0px))' }}>
      <div style={{ width: '100%', maxWidth: 380, background: 'var(--bg-sidebar)', borderRadius: 22, border: '1px solid rgba(239,68,68,0.35)', padding: 24 }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: 36, marginBottom: 6 }}>⚠️</div>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: '#EF4444', margin: '0 0 4px' }}>{editing ? 'Opname bewerken' : 'Spaargeld afhalen'}</h3>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>Wat voor soort opname is dit?</p>
        </div>

        {/* Type keuze */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
          <button onClick={() => setSavType('saved')} style={{ padding: '12px 8px', borderRadius: 14, border: savType === 'saved' ? '2px solid #10B981' : '1px solid var(--border)', background: savType === 'saved' ? 'rgba(16,185,129,0.1)' : 'var(--bg-card-2)', cursor: 'pointer', textAlign: 'center' }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>💰</div>
            <p style={{ fontSize: 12, fontWeight: 700, color: savType === 'saved' ? '#10B981' : 'var(--text-2)', margin: '0 0 2px' }}>Echt gespaard</p>
            <p style={{ fontSize: 10, color: 'var(--text-3)', margin: 0 }}>Geld dat ik had gespaard</p>
          </button>
          <button onClick={() => setSavType('loan')} style={{ padding: '12px 8px', borderRadius: 14, border: savType === 'loan' ? '2px solid #F59E0B' : '1px solid var(--border)', background: savType === 'loan' ? 'rgba(245,158,11,0.1)' : 'var(--bg-card-2)', cursor: 'pointer', textAlign: 'center' }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>🤝</div>
            <p style={{ fontSize: 12, fontWeight: 700, color: savType === 'loan' ? '#F59E0B' : 'var(--text-2)', margin: '0 0 2px' }}>Lening</p>
            <p style={{ fontSize: 10, color: 'var(--text-3)', margin: 0 }}>Leen van mezelf (+10%)</p>
          </button>
        </div>

        <div style={{ position: 'relative', marginBottom: 12 }}>
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 20, fontWeight: 700, color: 'var(--text-3)' }}>€</span>
          <input autoFocus type="text" inputMode="decimal" placeholder="0,00" value={amount} onChange={e => setAmount(e.target.value)}
            onFocus={scrollFix}
            style={{ width: '100%', padding: '12px 14px 12px 32px', borderRadius: 12, background: 'var(--bg-card-2)', border: `1px solid ${savType === 'loan' ? 'rgba(245,158,11,0.4)' : 'rgba(239,68,68,0.3)'}`, color: 'var(--text-1)', fontSize: 24, fontWeight: 700, colorScheme: 'dark' }} />
        </div>

        {/* Lening: rente preview */}
        {savType === 'loan' && n > 0 && (
          <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', marginBottom: 12, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text-3)' }}>Terug te storten incl. 10% rente</span>
            <span style={{ fontWeight: 700, color: '#F59E0B' }}>{fmt(n + interest)}</span>
          </div>
        )}

        <input placeholder="Waarom haal je dit af? (verplicht)" value={reason} onChange={e => setReason(e.target.value)}
          onFocus={scrollFix}
          style={{ width: '100%', padding: '10px 14px', borderRadius: 12, background: 'var(--bg-card-2)', border: '1px solid var(--border)', color: 'var(--text-1)', fontSize: 14, marginBottom: 16, colorScheme: 'dark' }} />

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'var(--bg-card-2)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontSize: 14 }}>Annuleer</button>
          <button onClick={handleSave} disabled={!canSave}
            style={{ flex: 1, padding: '12px', borderRadius: 12,
              background: !canSave ? 'rgba(255,255,255,0.05)' : savType === 'loan' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
              border: !canSave ? '1px solid var(--border)' : savType === 'loan' ? '1px solid rgba(245,158,11,0.5)' : '1px solid rgba(239,68,68,0.5)',
              color: !canSave ? 'var(--text-3)' : savType === 'loan' ? '#F59E0B' : '#EF4444',
              cursor: canSave ? 'pointer' : 'default', fontSize: 14, fontWeight: 700 }}>
            Loggen
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Income Modal ──────────────────────────────────────────────────────────────
function IncomeModal({ onClose, onSave }) {
  const backdropRef = useRef(null)
  usePreventTouch(backdropRef)
  const [amount, setAmount] = useState('')
  const [cat, setCat]       = useState('salaris')
  const [desc, setDesc]     = useState('')
  const [date, setDate]     = useState(todayStr())

  const handleSave = () => {
    const n = parseFloat(String(amount).replace(',', '.'))
    if (!n || n <= 0) return
    onSave({ amount: n, category: cat, description: desc.trim(), date, is_income: true, is_savings_withdrawal: false })
  }

  return ReactDOM.createPortal(
    <div ref={backdropRef} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 480, background: 'var(--bg-sidebar)', borderRadius: '22px 22px 0 0', border: '1px solid var(--border)', borderBottom: 'none', padding: '20px 20px calc(24px + env(safe-area-inset-bottom) + var(--keyboard-height, 0px))', animation: 'sheetUp 0.3s cubic-bezier(0.34,1.1,0.64,1)' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 18px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#10B981', margin: 0 }}>💚 Inkomsten toevoegen</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}><X size={18} /></button>
        </div>

        <div style={{ position: 'relative', marginBottom: 16 }}>
          <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 24, fontWeight: 700, color: '#10B981' }}>€</span>
          <input autoFocus type="text" inputMode="decimal" placeholder="0,00"
            value={amount} onChange={e => setAmount(e.target.value)}
            onFocus={scrollFix} onKeyDown={e => e.key === 'Enter' && handleSave()}
            style={{ width: '100%', padding: '14px 16px 14px 36px', borderRadius: 14, background: 'var(--bg-card-2)', border: '1px solid rgba(16,185,129,0.35)', color: 'var(--text-1)', fontSize: 28, fontWeight: 700, colorScheme: 'dark' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 14 }}>
          {INCOME_CATEGORIES.map(c => (
            <button key={c.id} onClick={() => setCat(c.id)} style={{ padding: '10px 4px', borderRadius: 12, border: cat === c.id ? '1px solid #10B981' : '1px solid var(--border)', background: cat === c.id ? 'rgba(16,185,129,0.12)' : 'var(--bg-card-2)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 18 }}>{c.emoji}</span>
              <span style={{ fontSize: 9, color: cat === c.id ? '#10B981' : 'var(--text-3)', fontWeight: cat === c.id ? 600 : 400 }}>{c.label}</span>
            </button>
          ))}
        </div>

        <input placeholder="Omschrijving (optioneel)" value={desc} onChange={e => setDesc(e.target.value)}
          onFocus={scrollFix}
          style={{ width: '100%', padding: '10px 14px', borderRadius: 12, background: 'var(--bg-card-2)', border: '1px solid var(--border)', color: 'var(--text-1)', fontSize: 14, marginBottom: 12, colorScheme: 'dark' }} />

        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ width: '100%', padding: '10px 14px', borderRadius: 12, background: 'var(--bg-card-2)', border: '1px solid var(--border)', color: 'var(--text-3)', fontSize: 13, marginBottom: 18, colorScheme: 'dark' }} />

        <button onClick={handleSave} style={{ width: '100%', padding: '14px', borderRadius: 14, background: '#10B981', border: 'none', color: '#000', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          + Toevoegen
        </button>
      </div>
    </div>,
    document.body
  )
}

// ── Budget Settings Modal ─────────────────────────────────────────────────────
function BudgetModal({ config, onClose, onSave }) {
  const backdropRef = useRef(null)
  const cardRef     = useRef(null)
  usePreventTouch(backdropRef)
  useScrollContain(cardRef)

  const [monthly,    setMonthly]    = useState(config?.monthly_budget || 400)
  const [cats,       setCats]       = useState(config?.category_budgets || DEFAULT_CAT_BUDGETS)
  const [customCats,   setCustomCats]   = useState(config?.custom_categories || [])
  const [savingsGoal,  setSavingsGoal]  = useState(config?.savings_goal || 0)
  const [minBalance,   setMinBalance]   = useState(config?.min_balance ?? 300)
  const [addingCat,    setAddingCat]    = useState(false)
  const [newName,    setNewName]    = useState('')
  const [newEmoji,   setNewEmoji]   = useState('🎮')
  const [newColor,   setNewColor]   = useState(CAT_COLORS[0])
  const [newBudget,  setNewBudget]  = useState('')

  const resetCatForm = () => { setNewName(''); setNewEmoji('🎮'); setNewColor(CAT_COLORS[0]); setNewBudget('') }

  const addCustomCat = () => {
    if (!newName.trim()) return
    const id = `cat_${Date.now()}`
    const budget = parseFloat(String(newBudget).replace(',', '.')) || 0
    setCustomCats(cs => [...cs, { id, label: newName.trim(), emoji: newEmoji, color: newColor }])
    setCats(c => ({ ...c, [id]: budget }))
    resetCatForm(); setAddingCat(false)
  }

  const deleteCustomCat = (id) => {
    setCustomCats(cs => cs.filter(c => c.id !== id))
    setCats(c => { const n = { ...c }; delete n[id]; return n })
  }

  const total = Object.values(cats).reduce((a, b) => a + Number(b), 0)

  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 'var(--keyboard-height, 0px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      {/* Backdrop covers full screen regardless of keyboard */}
      <div ref={backdropRef} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', zIndex: -1 }} onClick={onClose} />
      {/* Card centered in visible area above keyboard */}
      <div ref={cardRef} style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420, background: 'var(--bg-sidebar)', borderRadius: 22, border: '1px solid var(--border)', padding: 24, maxHeight: 'calc(100% - 32px)', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>Budget instellen</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}><X size={18} /></button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}>Maandbudget (fallback)</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: 'var(--text-3)' }}>€</span>
            <input type="number" value={monthly} onChange={e => setMonthly(+e.target.value)}
              onFocus={scrollFix}
              style={{ width: '100%', padding: '12px 14px 12px 30px', borderRadius: 12, background: 'var(--bg-card-2)', border: '1px solid var(--border)', color: 'var(--text-1)', fontSize: 20, fontWeight: 700, colorScheme: 'dark' }} />
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '6px 0 0' }}>Wordt gebruikt als je geen terugkerend inkomen hebt ingesteld.</p>
        </div>

        <div style={{ marginBottom: 20, padding: '14px 16px', borderRadius: 14, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
          <label style={{ fontSize: 11, color: '#10B981', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}>🏦 Spaardoel per maand</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: '#10B981' }}>€</span>
            <input type="number" value={savingsGoal} onChange={e => setSavingsGoal(+e.target.value)}
              onFocus={scrollFix}
              style={{ width: '100%', padding: '12px 14px 12px 30px', borderRadius: 12, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.25)', color: '#10B981', fontSize: 20, fontWeight: 700, colorScheme: 'dark' }} />
          </div>
          <p style={{ fontSize: 11, color: 'rgba(16,185,129,0.6)', margin: '6px 0 0' }}>Dit bedrag wordt automatisch van je inkomen afgetrokken. Beschikbaar = inkomen − spaardoel.</p>
        </div>

        <div style={{ marginBottom: 20, padding: '14px 16px', borderRadius: 14, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <label style={{ fontSize: 11, color: '#3B82F6', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}>💳 Minimum saldo hoofdrekening</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: '#3B82F6' }}>€</span>
            <input type="number" value={minBalance} onChange={e => setMinBalance(+e.target.value)}
              onFocus={scrollFix}
              style={{ width: '100%', padding: '12px 14px 12px 30px', borderRadius: 12, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.25)', color: '#3B82F6', fontSize: 20, fontWeight: 700, colorScheme: 'dark' }} />
          </div>
          <p style={{ fontSize: 11, color: 'rgba(59,130,246,0.6)', margin: '6px 0 0' }}>Hoeveel je minimaal op je hoofdrekening wil houden na overschrijvingen.</p>
        </div>

        <label style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 10 }}>Per categorie</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {CATEGORIES.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20, width: 28 }}>{c.emoji}</span>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--text-2)' }}>{c.label}</span>
              <div style={{ position: 'relative', width: 90 }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-3)' }}>€</span>
                <input type="number" value={cats[c.id] || 0} onChange={e => setCats(p => ({ ...p, [c.id]: +e.target.value }))}
                  onFocus={scrollFix}
                  style={{ width: '100%', padding: '8px 8px 8px 22px', borderRadius: 10, background: 'var(--bg-card-2)', border: `1px solid ${c.color}40`, color: c.color, fontSize: 14, fontWeight: 600, colorScheme: 'dark' }} />
              </div>
            </div>
          ))}
        </div>

        {/* Custom categories */}
        <label style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 10 }}>Eigen enveloppen</label>

        {customCats.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
            {customCats.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20, width: 28 }}>{c.emoji}</span>
                <span style={{ flex: 1, fontSize: 13, color: 'var(--text-2)' }}>{c.label}</span>
                <div style={{ position: 'relative', width: 90 }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-3)' }}>€</span>
                  <input type="number" value={cats[c.id] || 0} onChange={e => setCats(p => ({ ...p, [c.id]: +e.target.value }))}
                    onFocus={scrollFix}
                    style={{ width: '100%', padding: '8px 8px 8px 22px', borderRadius: 10, background: 'var(--bg-card-2)', border: `1px solid ${c.color}40`, color: c.color, fontSize: 14, fontWeight: 600, colorScheme: 'dark' }} />
                </div>
                <button onClick={() => deleteCustomCat(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(239,68,68,0.5)', padding: 4 }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {addingCat ? (
          <div style={{ padding: 14, borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', marginBottom: 12 }}>
            <input placeholder="Naam (bijv. Hobby, Huisdier)" value={newName} onChange={e => setNewName(e.target.value)} onFocus={scrollFix} autoFocus
              style={{ width: '100%', padding: '9px 12px', borderRadius: 10, background: 'var(--bg-card-2)', border: '1px solid var(--border)', color: 'var(--text-1)', fontSize: 14, marginBottom: 10, colorScheme: 'dark', boxSizing: 'border-box', fontFamily: 'inherit' }} />
            <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '0 0 6px', fontWeight: 600 }}>Emoji</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
              {CAT_EMOJIS.map(e => (
                <button key={e} onClick={() => setNewEmoji(e)} style={{ fontSize: 18, width: 32, height: 32, borderRadius: 8, border: newEmoji === e ? '2px solid var(--accent)' : '1px solid var(--border)', background: newEmoji === e ? 'rgba(0,255,209,0.08)' : 'var(--bg-card-2)', cursor: 'pointer' }}>{e}</button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '0 0 6px', fontWeight: 600 }}>Kleur</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {CAT_COLORS.map(col => (
                <button key={col} onClick={() => setNewColor(col)} style={{ width: 24, height: 24, borderRadius: 6, background: col, border: newColor === col ? '2px solid white' : '2px solid transparent', cursor: 'pointer' }} />
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Budget:</span>
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--text-3)' }}>€</span>
                <input type="text" inputMode="decimal" placeholder="0" value={newBudget} onChange={e => setNewBudget(e.target.value)} onFocus={scrollFix}
                  style={{ width: '100%', padding: '8px 8px 8px 22px', borderRadius: 10, background: 'var(--bg-card-2)', border: '1px solid var(--border)', color: 'var(--text-1)', fontSize: 14, fontWeight: 600, colorScheme: 'dark', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setAddingCat(false); resetCatForm() }} style={{ flex: 1, padding: '9px', borderRadius: 10, background: 'none', border: '1px solid var(--border)', color: 'var(--text-3)', cursor: 'pointer', fontSize: 13 }}>Annuleer</button>
              <button onClick={addCustomCat} disabled={!newName.trim()} style={{ flex: 2, padding: '9px', borderRadius: 10, background: newName.trim() ? 'var(--accent)' : 'rgba(255,255,255,0.07)', border: 'none', color: newName.trim() ? '#000' : 'rgba(255,255,255,0.25)', fontWeight: 700, fontSize: 13, cursor: newName.trim() ? 'pointer' : 'default' }}>Aanmaken</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddingCat(true)} style={{ width: '100%', padding: '10px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.15)', color: 'var(--text-3)', cursor: 'pointer', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Plus size={14} /> Envelop toevoegen
          </button>
        )}

        <div style={{ padding: '10px 14px', borderRadius: 12, background: total > monthly ? 'rgba(239,68,68,0.08)' : 'rgba(0,255,209,0.06)', border: `1px solid ${total > monthly ? 'rgba(239,68,68,0.3)' : 'rgba(0,255,209,0.2)'}`, marginBottom: 18 }}>
          <span style={{ fontSize: 13, color: total > monthly ? '#EF4444' : 'var(--accent)' }}>
            {total > monthly ? `⚠️ Categorieën (${fmtShort(total)}) overschrijden maandbudget` : `✓ Categorieën: ${fmtShort(total)} van ${fmtShort(monthly)}`}
          </span>
        </div>

        <button onClick={() => onSave({ monthly_budget: monthly, category_budgets: cats, custom_categories: customCats, savings_goal: savingsGoal, min_balance: minBalance })}
          style={{ width: '100%', padding: '14px', borderRadius: 14, background: 'var(--accent)', border: 'none', color: '#000', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          Opslaan
        </button>
      </div>
    </div>,
    document.body
  )
}

// ── Recurring Income Modal ────────────────────────────────────────────────────
const REC_EMOJIS = ['💼','🏪','🏥','🎓','💰','🏦','💻','🎁','🏠','📦']

function RecurringIncomeModal({ config, onClose, onSave }) {
  const backdropRef = useRef(null)
  const cardRef     = useRef(null)
  usePreventTouch(backdropRef)
  useScrollContain(cardRef)

  const [sources,   setSources]  = useState(config?.recurring_income || [])
  const [adding,    setAdding]   = useState((config?.recurring_income || []).length === 0)
  const [editingId, setEditingId] = useState(null)
  const [name,      setName]     = useState('')
  const [emoji,     setEmoji]    = useState('💼')
  const [amount,  setAmount]  = useState('')
  const [type,    setType]    = useState('monthly')
  const [day,     setDay]     = useState(1)
  const [intDays, setIntDays] = useState(28)
  const [refDate, setRefDate] = useState(todayStr())

  const resetForm = () => { setName(''); setEmoji('💼'); setAmount(''); setType('monthly'); setDay(1); setIntDays(28); setRefDate(todayStr()) }

  const startEdit = (src) => {
    setEditingId(src.id)
    setName(src.name); setEmoji(src.emoji); setAmount(String(src.amount))
    setType(src.type); setDay(src.day || 1); setIntDays(src.interval_days || 28); setRefDate(src.ref_date || todayStr())
    setAdding(false)
  }

  const handleAdd = () => {
    const n = parseFloat(String(amount).replace(',', '.'))
    if (!name.trim() || !n || n <= 0) return
    setSources(s => [...s, {
      id: `rec_${Date.now()}`,
      name: name.trim(), emoji, amount: n, type,
      ...(type === 'monthly' ? { day: Number(day) } : { interval_days: Number(intDays), ref_date: refDate }),
    }])
    resetForm(); setAdding(false)
  }

  const handleSaveEdit = () => {
    const n = parseFloat(String(amount).replace(',', '.'))
    if (!name.trim() || !n || n <= 0) return
    setSources(s => s.map(src => src.id === editingId ? {
      ...src, name: name.trim(), emoji, amount: n, type,
      ...(type === 'monthly' ? { day: Number(day) } : { interval_days: Number(intDays), ref_date: refDate }),
    } : src))
    resetForm(); setEditingId(null)
  }

  const handleClose = () => { onSave(sources); onClose() }

  const inputStyle = { width: '100%', padding: '10px 14px', borderRadius: 12, background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-1)', fontSize: 14, colorScheme: 'dark', boxSizing: 'border-box', fontFamily: 'inherit', outline: 'none' }

  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 'var(--keyboard-height, 0px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div ref={backdropRef} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', zIndex: -1 }} onClick={handleClose} />
      <div ref={cardRef} style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420, background: 'var(--bg-sidebar)', borderRadius: 22, border: '1px solid var(--border)', padding: 24, maxHeight: 'calc(100% - 32px)', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>Terugkerend inkomen</h3>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}><X size={18} /></button>
        </div>

        {/* Bestaande bronnen */}
        {sources.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
            {sources.map(src => {
              const next = getNextPayDate(src)
              if (editingId === src.id) return (
                <div key={src.id} style={{ padding: 14, borderRadius: 14, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.3)' }}>
                  <p style={{ fontSize: 11, color: '#10B981', fontWeight: 700, margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>✏ {src.name} bewerken</p>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
                    {REC_EMOJIS.map(e => (
                      <button key={e} onClick={() => setEmoji(e)} style={{ fontSize: 18, width: 32, height: 32, borderRadius: 8, border: emoji === e ? '2px solid #10B981' : '1px solid var(--border)', background: emoji === e ? 'rgba(16,185,129,0.1)' : 'var(--bg-sidebar)', cursor: 'pointer' }}>{e}</button>
                    ))}
                  </div>
                  <input placeholder="Naam" value={name} onChange={e => setName(e.target.value)} onFocus={scrollFix}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 10, background: 'var(--bg-sidebar)', border: '1px solid var(--border)', color: 'var(--text-1)', fontSize: 14, marginBottom: 8, colorScheme: 'dark', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                  <div style={{ position: 'relative', marginBottom: 10 }}>
                    <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: '#10B981' }}>€</span>
                    <input type="text" inputMode="decimal" placeholder="Bedrag" value={amount} onChange={e => setAmount(e.target.value)} onFocus={scrollFix} autoFocus
                      style={{ width: '100%', padding: '10px 12px 10px 26px', borderRadius: 10, background: 'var(--bg-sidebar)', border: '1px solid rgba(16,185,129,0.35)', color: '#10B981', fontSize: 20, fontWeight: 700, colorScheme: 'dark', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                    {[['monthly','Maandelijks'],['interval','Elke X weken']].map(([v,l]) => (
                      <button key={v} onClick={() => setType(v)} style={{ padding: '8px', borderRadius: 10, border: type === v ? '1px solid #10B981' : '1px solid var(--border)', background: type === v ? 'rgba(16,185,129,0.08)' : 'var(--bg-sidebar)', color: type === v ? '#10B981' : 'var(--text-3)', cursor: 'pointer', fontSize: 12, fontWeight: type === v ? 600 : 400 }}>{l}</button>
                    ))}
                  </div>
                  {type === 'monthly' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Dag van de maand:</span>
                      <input type="number" min="1" max="31" value={day} onChange={e => setDay(e.target.value)}
                        style={{ width: 60, padding: '7px 10px', borderRadius: 10, background: 'var(--bg-sidebar)', border: '1px solid var(--border)', color: 'var(--text-1)', fontSize: 15, fontWeight: 700, colorScheme: 'dark', textAlign: 'center' }} />
                    </div>
                  )}
                  {type === 'interval' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Elke</span>
                        <select value={intDays} onChange={e => setIntDays(+e.target.value)}
                          style={{ padding: '7px 10px', borderRadius: 10, background: 'var(--bg-sidebar)', border: '1px solid var(--border)', color: 'var(--text-1)', fontSize: 13, colorScheme: 'dark' }}>
                          <option value={7}>1 week</option><option value={14}>2 weken</option><option value={21}>3 weken</option><option value={28}>4 weken</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>Laatste betaling:</span>
                        <input type="date" value={refDate} onChange={e => setRefDate(e.target.value)}
                          style={{ flex: 1, padding: '7px 10px', borderRadius: 10, background: 'var(--bg-sidebar)', border: '1px solid var(--border)', color: 'var(--text-1)', fontSize: 13, colorScheme: 'dark' }} />
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => { setEditingId(null); resetForm() }} style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'none', border: '1px solid var(--border)', color: 'var(--text-3)', cursor: 'pointer', fontSize: 13 }}>Annuleer</button>
                    <button onClick={handleSaveEdit} style={{ flex: 2, padding: '10px', borderRadius: 10, background: '#10B981', border: 'none', color: '#000', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Opslaan</button>
                  </div>
                </div>
              )
              return (
                <div key={src.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 14, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <span style={{ fontSize: 22 }}>{src.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', margin: '0 0 1px' }}>{src.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>
                      {src.type === 'monthly' ? `${src.day}e van de maand` : `Elke ${src.interval_days} dagen`}
                      {next ? ` · volgende: ${next}` : ''}
                    </p>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#10B981', marginRight: 2 }}>€{Number(src.amount).toFixed(0)}</span>
                  <button onClick={() => startEdit(src)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(16,185,129,0.6)', padding: 4 }}>
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => setSources(s => s.filter(x => x.id !== src.id))}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(239,68,68,0.5)', padding: 4 }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Toevoegen form */}
        {adding ? (
          <div style={{ padding: 16, borderRadius: 16, background: 'var(--bg-card-2)', border: '1px solid var(--border)', marginBottom: 12 }}>
            {/* Emoji */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              {REC_EMOJIS.map(e => (
                <button key={e} onClick={() => setEmoji(e)} style={{ fontSize: 20, width: 36, height: 36, borderRadius: 10, border: emoji === e ? '2px solid var(--accent)' : '1px solid var(--border)', background: emoji === e ? 'rgba(0,255,209,0.08)' : 'var(--bg-sidebar)', cursor: 'pointer' }}>{e}</button>
              ))}
            </div>
            <input placeholder="Naam (bijv. Jumbo, Zorgtoeslag)" value={name} onChange={e => setName(e.target.value)} onFocus={scrollFix}
              style={{ ...inputStyle, marginBottom: 10 }} autoFocus />
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--text-3)' }}>€</span>
              <input type="text" inputMode="decimal" placeholder="0,00" value={amount} onChange={e => setAmount(e.target.value)} onFocus={scrollFix}
                style={{ ...inputStyle, paddingLeft: 30, fontSize: 20, fontWeight: 700 }} />
            </div>

            {/* Frequentie toggle */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              {[['monthly','Maandelijks'],['interval','Elke X weken']].map(([v,l]) => (
                <button key={v} onClick={() => setType(v)} style={{ padding: '9px', borderRadius: 12, border: type === v ? '1px solid var(--accent)' : '1px solid var(--border)', background: type === v ? 'rgba(0,255,209,0.08)' : 'var(--bg-sidebar)', color: type === v ? 'var(--accent)' : 'var(--text-3)', cursor: 'pointer', fontSize: 13, fontWeight: type === v ? 600 : 400 }}>{l}</button>
              ))}
            </div>

            {type === 'monthly' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Dag van de maand:</span>
                <input type="number" min="1" max="31" value={day} onChange={e => setDay(e.target.value)}
                  style={{ width: 60, padding: '8px 10px', borderRadius: 10, background: 'var(--bg-sidebar)', border: '1px solid var(--border)', color: 'var(--text-1)', fontSize: 15, fontWeight: 700, colorScheme: 'dark', textAlign: 'center' }} />
              </div>
            )}

            {type === 'interval' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Elke</span>
                  <select value={intDays} onChange={e => setIntDays(+e.target.value)}
                    style={{ padding: '8px 12px', borderRadius: 10, background: 'var(--bg-sidebar)', border: '1px solid var(--border)', color: 'var(--text-1)', fontSize: 13, colorScheme: 'dark' }}>
                    <option value={7}>1 week</option>
                    <option value={14}>2 weken</option>
                    <option value={21}>3 weken</option>
                    <option value={28}>4 weken</option>
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>Laatste betaling:</span>
                  <input type="date" value={refDate} onChange={e => setRefDate(e.target.value)}
                    style={{ flex: 1, padding: '8px 10px', borderRadius: 10, background: 'var(--bg-sidebar)', border: '1px solid var(--border)', color: 'var(--text-1)', fontSize: 13, colorScheme: 'dark' }} />
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>Vul de datum van de meest recente betaling in — de volgende wordt automatisch berekend.</p>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setAdding(false); resetForm() }} style={{ flex: 1, padding: '11px', borderRadius: 12, background: 'none', border: '1px solid var(--border)', color: 'var(--text-3)', cursor: 'pointer', fontSize: 13 }}>Annuleer</button>
              <button onClick={handleAdd} disabled={!name.trim() || !amount}
                style={{ flex: 2, padding: '11px', borderRadius: 12, background: (!name.trim() || !amount) ? 'rgba(255,255,255,0.07)' : '#10B981', border: 'none', color: (!name.trim() || !amount) ? 'rgba(255,255,255,0.25)' : '#000', fontWeight: 700, fontSize: 14, cursor: (!name.trim() || !amount) ? 'default' : 'pointer' }}>
                Toevoegen
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} style={{ width: '100%', marginBottom: 12, padding: '12px', borderRadius: 14, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: '#10B981', cursor: 'pointer', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Plus size={15} /> Bron toevoegen
          </button>
        )}

        <button onClick={handleClose} style={{ width: '100%', padding: '13px', borderRadius: 14, background: 'var(--accent)', border: 'none', color: '#000', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          Opslaan
        </button>
      </div>
    </div>,
    document.body
  )
}

// SQL migration needed: ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_savings_contribution boolean DEFAULT false; ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_loan_repayment boolean DEFAULT false;

// ── IncomeDayModal ────────────────────────────────────────────────────────────
// source = recurring income object | null (for manual one-time income)
function IncomeDayModal({ source, defaultDate, adjustedBase, savingsGoal, alreadySavedThisMonth, totalLoanRemaining, userId, onLater, onDone }) {
  const backdropRef = useRef(null)
  usePreventTouch(backdropRef)
  const [received, setReceived] = useState('')
  const [balance, setBalance]   = useState('')
  const [desc, setDesc]       = useState('')
  const [catId, setCatId]     = useState('salaris')
  const [date, setDate]       = useState(defaultDate || todayStr())
  const [saving, setSaving]   = useState(false)
  const isManual = !source

  const r2   = (n) => Math.round(n * 100) / 100
  const rd5  = (n) => Math.floor(n / 5) * 5   // afronden naar beneden op €5
  const rec          = parseFloat(String(received).replace(',', '.')) || 0
  const bal          = parseFloat(String(balance).replace(',', '.')) || 0
  const hasBal       = balance.trim().length > 0
  // Alleen berekenen als huidig saldo is ingevuld
  const transferable = hasBal ? r2(Math.max(0, bal - adjustedBase)) : 0
  const savNeeded    = r2(Math.max(0, savingsGoal - alreadySavedThisMonth))
  const toSavings    = rd5(Math.min(transferable, savNeeded))
  const toLoan       = rd5(totalLoanRemaining > 0 ? Math.min(Math.max(0, transferable - toSavings), totalLoanRemaining) : 0)
  const balAfter     = hasBal ? r2(bal - toSavings - toLoan) : null

  const canSave = rec > 0 && (!isManual || desc.trim().length > 0)

  const handleSave = async () => {
    if (!canSave || saving) return
    setSaving(true)
    try {
      const incomeDesc = isManual ? desc.trim() : source.name
      const incomeCat  = isManual ? catId : (source.category || 'salaris')
      const inserts = [
        supabase.from('expenses').insert({ user_id: userId, amount: rec, category: incomeCat, description: incomeDesc, date, is_income: true, is_savings_withdrawal: false }),
      ]
      if (toSavings > 0) inserts.push(supabase.from('expenses').insert({ user_id: userId, amount: toSavings, category: 'overig', description: '🏦 Spaarstorting', date, is_savings_contribution: true, is_income: false, is_savings_withdrawal: false }))
      if (toLoan > 0) inserts.push(supabase.from('expenses').insert({ user_id: userId, amount: toLoan, category: 'overig', description: '↩ Gedeeltelijke terugbetaling lening', date, is_loan_repayment: true, is_income: false, is_savings_withdrawal: false }))
      await Promise.all(inserts)
      // Markeer leningen als afgelost als het totaal nu gedekt is
      if (toLoan > 0 && toLoan >= totalLoanRemaining) {
        const { data: openLoanRows } = await supabase.from('expenses').select('id').eq('user_id', userId).eq('savings_type', 'loan').eq('repaid', false)
        if (openLoanRows?.length) await Promise.all(openLoanRows.map(l => supabase.from('expenses').update({ repaid: true }).eq('id', l.id)))
      }
      onDone()
    } finally {
      setSaving(false)
    }
  }

  return ReactDOM.createPortal(
    <div ref={backdropRef} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: 380, background: 'var(--bg-sidebar)', borderRadius: 22, border: '1px solid rgba(16,185,129,0.35)', padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 28, marginBottom: 4 }}>{isManual ? '💚' : source.emoji}</div>
            <h3 style={{ fontSize: 17, fontWeight: 700, color: '#10B981', margin: '0 0 2px' }}>
              {isManual ? 'Eenmalige inkomsten' : `Betaaldag: ${source.name}`}
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>Vul in wat je hebt ontvangen</p>
          </div>
          {isManual && <button onClick={onLater} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 4 }}><X size={18} /></button>}
        </div>

        {isManual && (
          <div style={{ marginBottom: 12 }}>
            <input type="text" placeholder="Beschrijving (bijv. Bijbaan)" value={desc} onChange={e => setDesc(e.target.value)} onFocus={scrollFix}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 12, background: 'var(--bg-card-2)', border: '1px solid var(--border)', color: 'var(--text-1)', fontSize: 14, colorScheme: 'dark', marginBottom: 8 }} />
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 12, background: 'var(--bg-card-2)', border: '1px solid var(--border)', color: 'var(--text-3)', fontSize: 13, colorScheme: 'dark', marginBottom: 8 }} />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[{ id:'salaris',label:'Salaris',emoji:'💼' },{ id:'bijbaan',label:'Bijbaan',emoji:'🏪' },{ id:'freelance',label:'Freelance',emoji:'💻' },{ id:'zakgeld',label:'Zakgeld',emoji:'🎁' },{ id:'overig',label:'Overig',emoji:'💰' }].map(c => (
                <button key={c.id} onClick={() => setCatId(c.id)}
                  style={{ padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: catId === c.id ? 'rgba(16,185,129,0.15)' : 'var(--bg-card-2)', border: catId === c.id ? '1px solid rgba(16,185,129,0.4)' : '1px solid var(--border)', color: catId === c.id ? '#10B981' : 'var(--text-3)' }}>
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ position: 'relative', marginBottom: 12 }}>
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 20, fontWeight: 700, color: '#10B981' }}>€</span>
          <input autoFocus={!isManual} type="text" inputMode="decimal" placeholder="0,00"
            value={received} onChange={e => setReceived(e.target.value)} onFocus={scrollFix}
            style={{ width: '100%', padding: '12px 14px 12px 32px', borderRadius: 12, background: 'var(--bg-card-2)', border: '1px solid rgba(16,185,129,0.4)', color: 'var(--text-1)', fontSize: 24, fontWeight: 700, colorScheme: 'dark' }} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, display: 'block', marginBottom: 5 }}>Huidig saldo hoofdrekening (optioneel)</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: 'var(--text-3)' }}>€</span>
            <input type="text" inputMode="decimal" placeholder="0,00" value={balance} onChange={e => setBalance(e.target.value)} onFocus={scrollFix}
              style={{ width: '100%', padding: '10px 14px 10px 30px', borderRadius: 12, background: 'var(--bg-card-2)', border: '1px solid var(--border)', color: 'var(--text-1)', fontSize: 16, colorScheme: 'dark' }} />
          </div>
        </div>

        {(rec > 0 || hasBal) && (toSavings > 0 || toLoan > 0 || hasBal) && (
          <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '0 0 4px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Advies verdeling</p>
            {toSavings > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-3)' }}>💰 Naar spaarrekening {savNeeded > toSavings ? `(${fmt(savNeeded - toSavings)} resterend doel)` : '✓'}</span>
                <span style={{ fontWeight: 700, color: '#10B981' }}>{fmt(toSavings)}</span>
              </div>
            )}
            {toLoan > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-3)' }}>↩ Lening aflossen</span>
                <span style={{ fontWeight: 700, color: '#F59E0B' }}>{fmt(toLoan)}</span>
              </div>
            )}
            {hasBal && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, borderTop: '1px solid var(--border)', paddingTop: 6, marginTop: 2 }}>
                <span style={{ color: 'var(--text-3)' }}>Hoofdrekening na overschrijvingen</span>
                <span style={{ fontWeight: 700, color: balAfter >= adjustedBase ? '#10B981' : '#F59E0B' }}>{fmt(balAfter)}</span>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          {!isManual && <button onClick={onLater} style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'var(--bg-card-2)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontSize: 14 }}>Later</button>}
          <button onClick={handleSave} disabled={!canSave || saving}
            style={{ flex: 2, padding: '12px', borderRadius: 12, background: canSave ? '#10B981' : 'rgba(255,255,255,0.05)', border: 'none', color: canSave ? '#000' : 'var(--text-3)', cursor: canSave ? 'pointer' : 'default', fontSize: 14, fontWeight: 700 }}>
            {saving ? '...' : 'Invullen'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const GELD_TABS = [
  { id: 'weergave',   label: 'Weergave',  emoji: '📊' },
  { id: 'enveloppen', label: 'Enveloppen',emoji: '📁' },
  { id: 'inkomsten',  label: 'Inkomsten', emoji: '💚' },
  { id: 'uitgaven',   label: 'Uitgaven',  emoji: '💸' },
  { id: 'jaar',       label: 'Jaar',      emoji: '📅' },
  { id: 'zoeken',     label: 'Zoeken',    emoji: '🔍' },
]

export default function GeldPage({ userId, onClose }) {
  const [expenses, setExpenses]       = useState([])
  const [config, setConfig]           = useState(null)
  const [loading, setLoading]         = useState(true)
  const [showAdd, setShowAdd]         = useState(false)
  const [showIncome, setShowIncome]   = useState(false)
  const [showSavings, setShowSavings] = useState(false)
  const [showBudget, setShowBudget]   = useState(false)
  const [editing, setEditing]         = useState(null)
  const [showPlanned, setShowPlanned] = useState(false)
  const [showAll, setShowAll]         = useState(false)
  const [showRecurring, setShowRecurring]   = useState(false)
  const [editingSavings, setEditingSavings]     = useState(null)
  const [confirmingLoanId, setConfirmingLoanId] = useState(null)
  const [prevExpenses, setPrevExpenses]     = useState([])
  const [yearSavings, setYearSavings]       = useState([])
  const [yearExpenses, setYearExpenses]     = useState([])
  const [savingsContribs, setSavingsContribs] = useState([])
  const [loanRepayments, setLoanRepayments]   = useState([])
  const [incomeDone, setIncomeDone] = useState(false)
  const [loanRepayInput, setLoanRepayInput]   = useState('')
  const [savingsInput, setSavingsInput]       = useState('')
  const _now = new Date()
  const [selYear, setSelYear]   = useState(_now.getFullYear())
  const [selMonth, setSelMonth] = useState(_now.getMonth())
  const [subView, setSubView]         = useState('weergave')
  const [isMobile, setIsMobile]       = useState(window.innerWidth < 768)
  const [searchQuery, setSearchQuery]   = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchTotal, setSearchTotal]   = useState(0)

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  // Debounced cross-month search
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([])
      setSearchTotal(0)
      return
    }
    setSearchLoading(true)
    const query = searchQuery.trim()
    const timer = setTimeout(async () => {
      const { data } = await supabase.from('expenses')
        .select('*')
        .eq('user_id', userId)
        .eq('is_income', false)
        .eq('is_savings_withdrawal', false)
        .ilike('description', `%${query}%`)
        .order('date', { ascending: false })
        .limit(100)
      setSearchResults(data || [])
      setSearchTotal(data?.reduce((s, e) => s + Number(e.amount), 0) || 0)
      setSearchLoading(false)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchQuery, userId])

  const fetchAll = useCallback(async () => {
    // prev month relative to selected month
    const prevY = selMonth === 0 ? selYear - 1 : selYear
    const prevM = selMonth === 0 ? 11 : selMonth - 1
    const [expRes, cfgRes, prevExpRes, yearSavRes, yearExpRes, savContribRes, loanRepRes] = await Promise.all([
      supabase.from('expenses').select('*').eq('user_id', userId)
        .gte('date', monthStartOf(selYear, selMonth)).lte('date', monthEndOf(selYear, selMonth))
        .order('date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('budget_config').select('*').eq('user_id', userId).single(),
      supabase.from('expenses').select('amount, is_income, is_savings_withdrawal').eq('user_id', userId)
        .gte('date', monthStartOf(prevY, prevM)).lte('date', monthEndOf(prevY, prevM)),
      supabase.from('expenses').select('id, amount, description, date, savings_type, repaid').eq('user_id', userId)
        .eq('is_savings_withdrawal', true)
        .gte('date', `${selYear}-01-01`),
      supabase.from('expenses').select('amount, date, is_income, is_savings_withdrawal, is_savings_contribution, is_loan_repayment, category').eq('user_id', userId)
        .gte('date', `${selYear}-01-01`).lte('date', `${selYear}-12-31`),
      // Savings contributions this month
      supabase.from('expenses').select('id, amount, date, description').eq('user_id', userId)
        .eq('is_savings_contribution', true)
        .gte('date', monthStartOf(selYear, selMonth)).lte('date', monthEndOf(selYear, selMonth))
        .order('date', { ascending: false }),
      // Loan repayments this year
      supabase.from('expenses').select('id, amount, date').eq('user_id', userId)
        .eq('is_loan_repayment', true)
        .gte('date', `${selYear}-01-01`)
        .order('date', { ascending: false }),
    ])
    setExpenses(expRes.data || [])
    setConfig(cfgRes.data || { monthly_budget: 400, category_budgets: DEFAULT_CAT_BUDGETS })
    setPrevExpenses(prevExpRes.data || [])
    setYearSavings(yearSavRes.data || [])
    setYearExpenses(yearExpRes.data || [])
    setSavingsContribs(savContribRes.data || [])
    setLoanRepayments(loanRepRes.data || [])
    setLoading(false)
  }, [userId, selYear, selMonth])

  useEffect(() => { fetchAll() }, [fetchAll])

  const saveExpense = async (data) => {
    if (editing) {
      await supabase.from('expenses').update(data).eq('id', editing.id)
      setEditing(null)
    } else {
      await supabase.from('expenses').insert({ ...data, user_id: userId })
    }
    setShowAdd(false); setShowSavings(false); setShowIncome(false)
    fetchAll()
  }

  const deleteExpense = async (id) => {
    await supabase.from('expenses').delete().eq('id', id)
    fetchAll()
  }

  const repayLoan = async (loan) => {
    const interest = +(Number(loan.amount) * 0.1).toFixed(2)
    const total    = Number(loan.amount) + interest
    await Promise.all([
      supabase.from('expenses').update({ repaid: true }).eq('id', loan.id),
      supabase.from('expenses').insert({
        user_id: userId, amount: total, category: 'overig',
        description: `↩ Terugstorting lening (incl. 10% rente)`,
        date: todayStr(), is_savings_withdrawal: false, is_income: false,
      }),
    ])
    fetchAll()
  }

  const saveBudget = async (data) => {
    await supabase.from('budget_config').upsert({ ...data, user_id: userId, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    setShowBudget(false); fetchAll()
  }

  const saveRecurring = async (sources) => {
    await supabase.from('budget_config').upsert({ recurring_income: sources, user_id: userId, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    setShowRecurring(false); fetchAll()
  }

  // Derived stats
  const monthlyBudget      = config?.monthly_budget || 400
  const minBalance         = config?.min_balance ?? 300
  const catBudgets         = config?.category_budgets || DEFAULT_CAT_BUDGETS
  const customCategories   = config?.custom_categories || []
  const allCategories      = [...CATEGORIES, ...customCategories]
  const manualIncome       = expenses.filter(e => e.is_income)
  const totalManualIncome  = manualIncome.reduce((s, e) => s + Number(e.amount), 0)
  const plannedExpenses    = expenses.filter(e => e.is_planned)
  const regularExpenses    = expenses.filter(e => !e.is_savings_withdrawal && !e.is_income && !e.is_savings_contribution && !e.is_loan_repayment)
  // Budget spending = regular expenses that were NOT paid from savings
  // (savings-funded spending is tracked separately and doesn't count against budget)
  // Vaste lasten (abonnementen) worden buiten het vrije budget gehouden
  const FIXED_CAT          = 'abonnementen'
  const budgetExpenses     = regularExpenses.filter(e => !e.paid_from_savings && e.category !== FIXED_CAT && (!e.is_planned || e.amount > 0))
  const savingsExpenses    = regularExpenses.filter(e => e.paid_from_savings)
  const totalSpent         = budgetExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const savingsExpTotal    = savingsExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const savingsWithdrawals = expenses.filter(e => e.is_savings_withdrawal)
  const savingsTotal       = savingsWithdrawals.reduce((s, e) => s + Number(e.amount), 0)
  const savedWithdrawals   = savingsWithdrawals.filter(e => e.savings_type !== 'loan')
  // Open loans come from the full-year query so repaid ones don't show up
  const openLoans          = yearSavings.filter(e => e.savings_type === 'loan' && !e.repaid)
  const openLoanPrincipal  = openLoans.reduce((s, e) => s + Number(e.amount), 0)
  const openLoanTotal      = +(openLoanPrincipal * 1.1).toFixed(2)

  const alreadySavedThisMonth = savingsContribs.reduce((s, e) => s + Number(e.amount), 0)
  const totalRepaid           = loanRepayments.reduce((s, e) => s + Number(e.amount), 0)
  const remainingLoan         = Math.max(0, openLoanTotal - totalRepaid)

  const recurringIncome    = config?.recurring_income || []
  const recurringExpected  = calcRecurringThisMonth(recurringIncome)
  const hasRecurring       = recurringIncome.length > 0
  const savingsGoal        = config?.savings_goal || 0
  // grossIncome alleen voor weergave (inkomen-kaartje, prognose etc.)
  const grossIncome = hasRecurring ? recurringExpected + totalManualIncome : (totalManualIncome > 0 ? totalManualIncome : monthlyBudget)
  // base is altijd het ingestelde maandbudget — extra inkomen gaat naar spaargeld, niet naar vrije ruimte
  const base        = monthlyBudget
  const remaining  = base - totalSpent
  const remainPct  = Math.max(0, Math.min(100, (remaining / base) * 100))


  const nowY = new Date().getFullYear(), nowM = new Date().getMonth()
  const isCurrentMonth = selYear === nowY && selMonth === nowM

  const filledInToday = isCurrentMonth ? getFilledInToday(config) : []
  const pendingIncomeSource = isCurrentMonth
    ? (recurringIncome.find(src => isPayDayToday(src) && !filledInToday.includes(src.id)) || null)
    : null
  const goToPrevMonth = () => { if (selMonth === 0) { setSelYear(y => y-1); setSelMonth(11) } else { setSelMonth(m => m-1) } }
  const goToNextMonth = () => {
    if (selYear < nowY || selMonth < nowM) {
      if (selMonth === 11) { setSelYear(y => y+1); setSelMonth(0) } else { setSelMonth(m => m+1) }
    }
  }

  const todayTotal = budgetExpenses.filter(e => e.date === todayStr())
    .reduce((s, e) => s + Number(e.amount), 0)

  // Year summary grouped by month
  const yearMonthly = Array.from({ length: 12 }, (_, m) => {
    const mStart = monthStartOf(selYear, m), mEnd = monthEndOf(selYear, m)
    const mExps  = yearExpenses.filter(e => e.date >= mStart && e.date <= mEnd)
    const spent  = mExps.filter(e => !e.is_income && !e.is_savings_withdrawal && !e.is_savings_contribution && !e.is_loan_repayment).reduce((s,e) => s + Number(e.amount), 0)
    const income = mExps.filter(e => e.is_income).reduce((s,e) => s + Number(e.amount), 0)
    const hasDat = mExps.length > 0
    return { m, spent, income, hasDat }
  })

  const spentByCategory = {}
  for (const cat of allCategories) {
    spentByCategory[cat.id] = regularExpenses.filter(e => e.category === cat.id && !e.paid_from_savings)
      .reduce((s, e) => s + Number(e.amount), 0)
  }

  // Savings-funded per category (for smart envelope display)
  const savingsByCategory = {}
  for (const cat of allCategories) {
    savingsByCategory[cat.id] = regularExpenses.filter(e => e.category === cat.id && e.paid_from_savings)
      .reduce((s, e) => s + Number(e.amount), 0)
  }

  // Carryover from previous month — same exclusions as budgetExpenses
  const prevRegular  = prevExpenses.filter(e => !e.is_savings_withdrawal && !e.is_income && !e.paid_from_savings && !e.is_savings_contribution && !e.is_loan_repayment && e.category !== FIXED_CAT && (!e.is_planned || e.amount > 0))
  const prevSpent    = prevRegular.reduce((s, e) => s + Number(e.amount), 0)
  // Maart 2026 wordt buiten beschouwing gelaten voor carryover (eenmalig)
  const _prevY = selMonth === 0 ? selYear - 1 : selYear
  const _prevM = selMonth === 0 ? 11 : selMonth - 1
  const prevIsMarch2026 = _prevY === 2026 && _prevM === 2
  const carryover    = prevIsMarch2026 ? 0 : Math.max(0, prevSpent - base)
  const vasteLastenBudget = catBudgets[FIXED_CAT] || 0
  const adjustedBase = Math.max(0, base - carryover - vasteLastenBudget)
  const adjustedRemaining = adjustedBase - totalSpent
  const adjustedRemainPct = adjustedBase > 0 ? Math.max(0, Math.min(100, (adjustedRemaining / adjustedBase) * 100)) : 0

  const barColor = adjustedRemainPct > 40 ? 'var(--accent)' : adjustedRemainPct > 15 ? '#F59E0B' : '#EF4444'

  // Envelop-schaling bij carryover: verdeel tekort proportioneel over variabele enveloppen
  const variableCats = allCategories.filter(c => c.id !== FIXED_CAT)
  const variableEnvelopeTotal = variableCats.reduce((s, c) => s + (catBudgets[c.id] || 0), 0)
  const envelopeScale = carryover > 0 && variableEnvelopeTotal > 0
    ? Math.max(0, adjustedBase / variableEnvelopeTotal)
    : 1
  const effectiveBudget = (catId) => {
    if (catId === FIXED_CAT) return catBudgets[catId] || 0
    return Math.round((catBudgets[catId] || 0) * envelopeScale)
  }
  const allTransactions = [...regularExpenses, ...manualIncome].sort((a, b) => b.date.localeCompare(a.date) || b.created_at?.localeCompare(a.created_at))
  const displayedExpenses = showAll ? allTransactions : allTransactions.slice(0, 8)

  // Smart stats
  const today        = new Date()
  const daysInMonth  = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const dayOfMonth   = today.getDate()
  const daysLeft     = daysInMonth - dayOfMonth + 1
  const dagBudget    = adjustedRemaining > 0 ? adjustedRemaining / daysLeft : 0
  const projectedTotal = dayOfMonth > 1 ? (totalSpent / dayOfMonth) * daysInMonth : null
  const projectedOver  = projectedTotal !== null && projectedTotal > adjustedBase

  // Week budget (Fri→Thu week)
  const weekStartDate = (() => {
    const d = new Date(today)
    const dow = d.getDay()
    d.setDate(d.getDate() - (dow === 5 ? 0 : dow === 6 ? 1 : dow + 2))
    d.setHours(0, 0, 0, 0)
    return d
  })()
  const _p2 = n => String(n).padStart(2, '0')
  const weekStartStr = `${weekStartDate.getFullYear()}-${_p2(weekStartDate.getMonth()+1)}-${_p2(weekStartDate.getDate())}`
  const weekSpentSoFar = budgetExpenses.filter(e => e.date >= weekStartStr && e.date <= todayStr()).reduce((s, e) => s + Number(e.amount), 0)
  const monthEndDate = new Date(today.getFullYear(), today.getMonth(), daysInMonth)
  let _weeksLeft = 0; let _ws = new Date(weekStartDate)
  while (_ws <= monthEndDate) { _weeksLeft++; _ws.setDate(_ws.getDate() + 7) }
  const remainingWeeks = Math.max(1, _weeksLeft)
  const weekAllowance  = Math.round((Math.max(0, adjustedRemaining) / remainingWeeks) * 100) / 100
  const weekRemaining  = Math.round((weekAllowance - weekSpentSoFar) * 100) / 100

  let spaarStreak = 0
  for (let i = 0; i < 366; i++) {
    const d = new Date(); d.setDate(d.getDate() - i)
    const ds = d.toISOString().slice(0, 10)
    if (savingsWithdrawals.some(e => e.date === ds)) break
    spaarStreak++
  }

  // Week bars
  const weekBudget  = base / 4
  const weekTotals  = [0, 0, 0, 0, 0]
  budgetExpenses.forEach(e => {
    const day = new Date(e.date).getDate()
    const wi  = day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : day <= 28 ? 3 : 4
    weekTotals[wi] += Number(e.amount)
  })
  const maxWeekVal    = Math.max(...weekTotals, weekBudget, 1)
  const currentWeekIdx = dayOfMonth <= 7 ? 0 : dayOfMonth <= 14 ? 1 : dayOfMonth <= 21 ? 2 : dayOfMonth <= 28 ? 3 : 4

  // Donut
  const circumference  = 2 * Math.PI * 55
  const catWithSpend   = allCategories.map(c => ({ ...c, spent: spentByCategory[c.id] || 0 })).filter(c => c.spent > 0)

  // Balance line (uses adjustedBase so carryover is reflected)
  const balanceByDay = []
  for (let d = 1; d <= daysInMonth; d++) {
    const spent = budgetExpenses.filter(e => new Date(e.date).getDate() <= d).reduce((s, e) => s + Number(e.amount), 0)
    balanceByDay.push(adjustedBase - spent)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )

  const renderTxRow = (exp) => {
    const isInc = exp.is_income
    const cat = isInc ? (INCOME_CATEGORIES.find(c => c.id === exp.category) || INCOME_CATEGORIES[4]) : (allCategories.find(c => c.id === exp.category) || CATEGORIES[6])
    const color = isInc ? '#10B981' : (cat.color || '#94A3B8')
    return (
      <div key={exp.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 14, background: isInc ? 'rgba(16,185,129,0.05)' : 'var(--bg-card-2)', border: `1px solid ${isInc ? 'rgba(16,185,129,0.2)' : 'var(--border)'}` }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{cat.emoji}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exp.description || cat.label}</p>
          <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>{exp.date}{isInc ? ' · inkomsten' : ''}</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color }}>{isInc ? '+' : ''}{fmt(exp.amount)}</span>
          {exp.paid_from_savings && <span style={{ fontSize: 9, fontWeight: 700, color: '#F59E0B', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 5, padding: '1px 5px' }}>GESPAARD</span>}
        </div>
        {!isInc && <button onClick={() => { setEditing(exp); setShowAdd(true) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}><Pencil size={12} /></button>}
        <button onClick={() => deleteExpense(exp.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(239,68,68,0.5)', padding: 4 }}><Trash2 size={12} /></button>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 24px' }}>

        {/* ── WEERGAVE ── */}
        {/* Shared header: month navigator + context button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <button onClick={goToPrevMonth} style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--bg-card-2)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>‹</button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: isCurrentMonth ? 'var(--text-1)' : 'var(--accent)', margin: 0, letterSpacing: '0.01em' }}>
              {monthLabelOf(selYear, selMonth)}
            </p>
            {!isCurrentMonth && <p style={{ fontSize: 10, color: 'var(--accent)', margin: 0, fontWeight: 600 }}>VORIGE MAAND — BEWERKBAAR</p>}
          </div>
          <button onClick={goToNextMonth} disabled={isCurrentMonth}
            style={{ width: 32, height: 32, borderRadius: 10, background: isCurrentMonth ? 'rgba(255,255,255,0.03)' : 'var(--bg-card-2)', border: '1px solid var(--border)', color: isCurrentMonth ? 'rgba(255,255,255,0.12)' : 'var(--text-2)', cursor: isCurrentMonth ? 'default' : 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>›</button>
        </div>

        {subView === 'weergave' && <>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>Overzicht</h2>
          <button onClick={() => setShowBudget(true)} style={{ padding: '8px 14px', borderRadius: 12, background: 'var(--bg-card-2)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            Budget
          </button>
        </div>

        {/* Alert strip: loans + savings counter */}
        {remainingLoan > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {remainingLoan > 0 && (
              <button onClick={() => setSubView('inkomsten')} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: 16 }}>🤝</span>
                <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#F59E0B' }}>
                  {openLoans.length}× openstaande lening — {fmt(remainingLoan)} nog terug te storten
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>→ Inkomsten</span>
              </button>
            )}
          </div>
        )}

        {/* Carryover banner */}
        {carryover > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 14, marginBottom: 10, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)', fontSize: 12, color: 'rgba(239,68,68,0.85)' }}>
            <span style={{ fontSize: 15 }}>↩</span>
            <span style={{ flex: 1 }}>Vorige maand {fmt(carryover)} over limiet — wordt afgetrokken van dit maandbudget</span>
            <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>−{fmt(carryover)}</span>
          </div>
        )}

        {/* Big remaining card */}
        <div style={{
          padding: '22px 22px 18px', borderRadius: 22, marginBottom: 14,
          background: adjustedRemaining < 0
            ? 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.04))'
            : adjustedRemainPct < 15
            ? 'linear-gradient(135deg, rgba(239,68,68,0.10), rgba(239,68,68,0.03))'
            : adjustedRemainPct < 40
            ? 'linear-gradient(135deg, rgba(245,158,11,0.10), rgba(245,158,11,0.03))'
            : 'linear-gradient(135deg, rgba(0,255,209,0.08), rgba(0,255,209,0.02))',
          border: `1px solid ${adjustedRemaining < 0 ? 'rgba(239,68,68,0.35)' : adjustedRemainPct < 15 ? 'rgba(239,68,68,0.25)' : adjustedRemainPct < 40 ? 'rgba(245,158,11,0.25)' : 'rgba(0,255,209,0.2)'}`,
        }}>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
            {adjustedRemaining < 0 ? '🚨 Budget overschreden' : 'Nog over deze maand'}
          </p>
          <p style={{ fontSize: 48, fontWeight: 800, margin: '0 0 14px', color: adjustedRemaining < 0 ? '#EF4444' : adjustedRemainPct < 15 ? '#EF4444' : adjustedRemainPct < 40 ? '#F59E0B' : 'var(--text-1)', lineHeight: 1 }}>
            {fmt(Math.abs(adjustedRemaining))}
          </p>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
            <div style={{ height: '100%', width: `${100 - adjustedRemainPct}%`, background: barColor, borderRadius: 8, transition: 'width 0.6s ease', boxShadow: `0 0 8px ${barColor}60` }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)' }}>
            <span>
              {fmt(totalSpent)} budget{savingsExpTotal > 0 ? ` · 💳 ${fmt(savingsExpTotal)} spaar` : ''}{carryover > 0 ? ` · ↩ ${fmt(carryover)}` : ''}
            </span>
            <span>
              {vasteLastenBudget > 0
                ? `Budget ${fmt(monthlyBudget)} − 🏠 ${fmt(vasteLastenBudget)} = ${fmt(adjustedBase)}`
                : `Budget: ${fmt(adjustedBase)}`
              }
            </span>
          </div>
        </div>

        {/* Quick stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div style={{ padding: '12px 14px', borderRadius: 16, background: 'var(--bg-card-2)', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Vandaag</p>
            <p style={{ fontSize: 20, fontWeight: 700, margin: 0, color: todayTotal > 0 ? 'var(--text-1)' : 'var(--text-3)' }}>{fmt(todayTotal)}</p>
          </div>
          <div onClick={() => setSubView('inkomsten')}
            style={{ padding: '12px 14px', borderRadius: 16, background: hasRecurring ? 'rgba(16,185,129,0.08)' : totalManualIncome > 0 ? 'rgba(16,185,129,0.08)' : 'var(--bg-card-2)', border: (hasRecurring || totalManualIncome > 0) ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--border)', cursor: 'pointer' }}>
            <p style={{ fontSize: 10, color: (hasRecurring || totalManualIncome > 0) ? '#10B981' : 'var(--text-3)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>💚 Inkomen</p>
            <p style={{ fontSize: 20, fontWeight: 700, margin: 0, color: (hasRecurring || totalManualIncome > 0) ? '#10B981' : 'var(--text-3)' }}>
              {hasRecurring ? fmt(recurringExpected) : totalManualIncome > 0 ? fmt(totalManualIncome) : '–'}
            </p>
            {hasRecurring && <p style={{ fontSize: 9, color: 'rgba(16,185,129,0.6)', margin: '2px 0 0', fontWeight: 600 }}>VERWACHT</p>}
          </div>
          <div onClick={() => savingsWithdrawals.length > 0 && setSubView('inkomsten')}
            style={{ padding: '12px 14px', borderRadius: 16, background: savingsWithdrawals.length > 0 ? 'rgba(239,68,68,0.08)' : 'var(--bg-card-2)', border: savingsWithdrawals.length > 0 ? '1px solid rgba(239,68,68,0.3)' : '1px solid var(--border)', cursor: savingsWithdrawals.length > 0 ? 'pointer' : 'default' }}>
            <p style={{ fontSize: 10, color: savingsWithdrawals.length > 0 ? '#EF4444' : 'var(--text-3)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>🏦 Opnames</p>
            <p style={{ fontSize: 20, fontWeight: 700, margin: 0, color: savingsWithdrawals.length > 0 ? '#EF4444' : 'var(--text-3)' }}>
              {savingsWithdrawals.length > 0 ? `${savingsWithdrawals.length}× ${fmtShort(savingsTotal)}` : '–'}
            </p>
          </div>
        </div>

        {/* Recurring income sources
        {hasRecurring && (
          <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 16, background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <p style={{ fontSize: 10, color: '#10B981', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                Verwacht inkomen{savingsGoal > 0 ? ` · 🎯 ${fmt(savingsGoal)} sparen` : ''}
              </p>
              <button onClick={() => setShowRecurring(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(16,185,129,0.6)', fontSize: 11, padding: 0 }}>bewerken</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recurringIncome.map(src => {
                const next = getNextPayDate(src)
                const paysThisMonth = src.type === 'monthly' || calcRecurringThisMonth([src]) > 0
                return (
                  <div key={src.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{src.emoji}</span>
                    <span style={{ flex: 1, fontSize: 12, color: paysThisMonth ? 'var(--text-2)' : 'var(--text-3)' }}>{src.name}</span>
                    {next && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{next}</span>}
                    <span style={{ fontSize: 13, fontWeight: 700, color: paysThisMonth ? '#10B981' : 'var(--text-3)' }}>
                      {paysThisMonth ? fmt(calcRecurringThisMonth([src])) : '–'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )} */}

        {/* Dagbudget — prominent */}
        {(() => {
          const dagColor = dagBudget > 15 ? '#10B981' : dagBudget > 5 ? '#F59E0B' : '#EF4444'
          const dagBg    = dagBudget > 15 ? 'rgba(16,185,129,0.07)' : dagBudget > 5 ? 'rgba(245,158,11,0.07)' : 'rgba(239,68,68,0.07)'
          const dagBorder= dagBudget > 15 ? 'rgba(16,185,129,0.25)' : dagBudget > 5 ? 'rgba(245,158,11,0.25)' : 'rgba(239,68,68,0.25)'
          return (
            <div style={{ padding: '16px 20px', borderRadius: 18, marginBottom: 10, background: dagBg, border: `1px solid ${dagBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 11, color: dagColor, margin: '0 0 3px', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 }}>Vandaag nog te besteden</p>
                <p style={{ fontSize: 38, fontWeight: 800, margin: 0, color: dagColor, lineHeight: 1 }}>{fmt(dagBudget - todayTotal)}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 2px' }}>{daysLeft} dagen over</p>
                <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>vandaag {fmt(todayTotal)} uit</p>
                <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>dag budget:  {fmt(dagBudget)}</p>
              </div>
            </div>
          )
        })()}

        {/* Weekbudget */}
        {isCurrentMonth && (() => {
          const wColor  = weekRemaining < 0 ? '#EF4444' : weekAllowance > 0 && weekRemaining / weekAllowance < 0.25 ? '#F59E0B' : '#10B981'
          const wBg     = weekRemaining < 0 ? 'rgba(239,68,68,0.07)' : weekAllowance > 0 && weekRemaining / weekAllowance < 0.25 ? 'rgba(245,158,11,0.07)' : 'rgba(16,185,129,0.06)'
          const wBorder = weekRemaining < 0 ? 'rgba(239,68,68,0.25)' : weekAllowance > 0 && weekRemaining / weekAllowance < 0.25 ? 'rgba(245,158,11,0.25)' : 'rgba(16,185,129,0.2)'
          const wPct    = weekAllowance > 0 ? Math.max(0, Math.min(100, (weekRemaining / weekAllowance) * 100)) : 0
          return (
            <div style={{ padding: '14px 16px', borderRadius: 16, marginBottom: 10, background: wBg, border: `1px solid ${wBorder}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div>
                  <p style={{ fontSize: 10, color: wColor, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 }}>
                    💳 Weekbudget · {remainingWeeks} {remainingWeeks !== 1 ? 'weken' : 'week'} resterend
                  </p>
                  <p style={{ fontSize: 30, fontWeight: 800, color: wColor, margin: 0, lineHeight: 1.1 }}>
                    {fmtShort(weekRemaining)}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '3px 0 0' }}>
                    {weekRemaining < 0 ? `${fmt(Math.abs(weekRemaining))} over weekbudget` : 'nog over deze week'}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '0 0 2px' }}>Uitgegeven</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>{fmt(weekSpentSoFar)}</p>
                  <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '2px 0 0' }}>van {fmt(weekAllowance)} · {remainingWeeks}× verdeeld</p>
                </div>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${weekRemaining < 0 ? 100 : wPct}%`, background: wColor, borderRadius: 4, transition: 'width 0.4s' }} />
              </div>
            </div>
          )
        })()}

        {/* Prognose + Spaarstreak */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div style={{ padding: '12px 14px', borderRadius: 16, background: projectedOver ? 'rgba(239,68,68,0.07)' : 'var(--bg-card-2)', border: projectedOver ? '1px solid rgba(239,68,68,0.25)' : '1px solid var(--border)' }}>
            <p style={{ fontSize: 10, color: projectedOver ? '#EF4444' : 'var(--text-3)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Prognose</p>
            {projectedTotal === null
              ? <p style={{ fontSize: 12, fontWeight: 600, margin: 0, color: 'var(--text-3)' }}>Geen data</p>
              : <>
                  <p style={{ fontSize: 18, fontWeight: 700, margin: '0 0 2px', lineHeight: 1.1, color: projectedOver ? '#EF4444' : '#10B981' }}>{fmtShort(projectedTotal)}</p>
                  <p style={{ fontSize: 10, margin: 0, color: projectedOver ? 'rgba(239,68,68,0.7)' : 'rgba(16,185,129,0.7)' }}>{projectedOver ? `⚠ +${fmtShort(projectedTotal - adjustedBase)}` : '✓ Op schema'}</p>
                </>
            }
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 16, background: spaarStreak < 3 ? 'rgba(239,68,68,0.07)' : 'rgba(16,185,129,0.07)', border: spaarStreak < 3 ? '1px solid rgba(239,68,68,0.25)' : '1px solid rgba(16,185,129,0.25)' }}>
            <p style={{ fontSize: 10, color: spaarStreak < 3 ? '#EF4444' : '#10B981', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Spaarstreak</p>
            <p style={{ fontSize: 18, fontWeight: 700, margin: '0 0 2px', lineHeight: 1.1, color: spaarStreak < 3 ? '#EF4444' : '#10B981' }}>{spaarStreak}d</p>
            <p style={{ fontSize: 10, margin: 0, color: spaarStreak < 3 ? 'rgba(239,68,68,0.7)' : 'rgba(16,185,129,0.7)' }}>{spaarStreak < 3 ? '🔓 Recent' : '🔒 Geen opname'}</p>
          </div>
        </div>

        {/* Savings warning */}
        {savingsWithdrawals.length > 0 && (
          <div style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertTriangle size={18} color="#EF4444" style={{ flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#EF4444', margin: '0 0 2px' }}>
                  Je hebt {savingsWithdrawals.length}× van je spaarrekening gehaald deze maand
                </p>
                <p style={{ fontSize: 12, color: 'rgba(239,68,68,0.7)', margin: 0 }}>
                  Totaal: {fmt(savingsTotal)} — {savingsWithdrawals[0]?.savings_reason || 'geen reden opgegeven'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Savings-funded expenses motivational card */}
        {savingsExpenses.length > 0 && (
          <div style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.25)', marginBottom: 14 }}>
            <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>🏦</span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B', margin: '0 0 2px' }}>
                  {savingsExpenses.length === 1 ? '1 noodaankoop' : `${savingsExpenses.length} noodaankopen`} van spaarrekening — {fmt(savingsExpTotal)}
                </p>
                <p style={{ fontSize: 12, color: 'rgba(245,158,11,0.7)', margin: 0 }}>
                  Noodzakelijk, maar probeer dit te vermijden
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
              {savingsExpenses.map(e => {
                const cat = allCategories.find(c => c.id === e.category) || CATEGORIES[6]
                return (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 10, background: 'rgba(245,158,11,0.05)' }}>
                    <span style={{ fontSize: 14 }}>{cat.emoji}</span>
                    <span style={{ flex: 1, fontSize: 12, color: 'var(--text-2)' }}>{e.description || cat.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#F59E0B' }}>{fmt(e.amount)}</span>
                  </div>
                )
              })}
            </div>
            <div style={{ padding: '9px 12px', borderRadius: 10, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <p style={{ fontSize: 11, color: 'rgba(245,158,11,0.85)', margin: 0, lineHeight: 1.55 }}>
                💡 Dit overkomt iedereen. Overweeg om volgend maand je <strong>{savingsExpenses.map(e => (CATEGORIES.find(c => c.id === e.category) || CATEGORIES[6]).label.split(' ')[0]).filter((v,i,a)=>a.indexOf(v)===i).join(' & ')}</strong>-budget wat hoger te zetten, of maak een kleine "onverwacht" envelop aan.
              </p>
            </div>
          </div>
        )}

        {/* Analyse */}
        {regularExpenses.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Analyse</p>

            {/* Week bars */}
            <div style={{ padding: '16px', borderRadius: 16, background: 'var(--bg-card-2)', border: '1px solid var(--border)', marginBottom: 10 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', margin: '0 0 12px' }}>Uitgaven per week</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[0,1,2,3,4].map(i => {
                  const weekStart = [1,8,15,22,29][i]
                  if (weekStart > dayOfMonth && weekTotals[i] === 0) return null
                  const pct  = (weekTotals[i] / maxWeekVal) * 100
                  const barC = weekTotals[i] > weekBudget * 1.2 ? '#EF4444' : weekTotals[i] > weekBudget * 0.8 ? '#F59E0B' : 'var(--accent)'
                  const cur  = i === currentWeekIdx
                  return (
                    <div key={i}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: cur ? 'var(--accent)' : 'var(--text-3)', fontWeight: cur ? 700 : 400 }}>Week {i+1}{cur ? ' ●' : ''}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>{fmtShort(weekTotals[i])}</span>
                      </div>
                      <div style={{ height: 7, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: barC, borderRadius: 4, transition: 'width 0.6s' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Day spending heatmap */}
            {(() => {
              const DAY_HEADERS = ['Ma','Di','Wo','Do','Vr','Za','Zo']
              const daysInSelMonth = new Date(selYear, selMonth + 1, 0).getDate()
              const todayISO = todayStr()
              // Build spentPerDay map
              const spentPerDay = {}
              budgetExpenses.forEach(e => {
                if (e.date >= monthStartOf(selYear, selMonth) && e.date <= monthEndOf(selYear, selMonth)) {
                  spentPerDay[e.date] = (spentPerDay[e.date] || 0) + Number(e.amount)
                }
              })
              const dayValues = Object.values(spentPerDay).filter(v => v > 0)
              const maxDaySpend = dayValues.length > 0 ? Math.max(...dayValues) : 1

              // First weekday of month (Mon=0 … Sun=6)
              const rawFirstDay = new Date(selYear, selMonth, 1).getDay() // 0=Sun
              const firstOffset = (rawFirstDay + 6) % 7 // Mon-first

              const cells = []
              for (let i = 0; i < firstOffset; i++) cells.push(null)
              for (let d = 1; d <= daysInSelMonth; d++) cells.push(d)

              const cellColor = (d) => {
                const iso = `${selYear}-${String(selMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
                if (iso > todayISO) return 'rgba(255,255,255,0.03)'
                const spent = spentPerDay[iso] || 0
                if (spent === 0) return 'rgba(255,255,255,0.05)'
                const ratio = spent / maxDaySpend
                if (ratio < 0.25) return 'rgba(0,255,209,0.18)'
                if (ratio < 0.5)  return 'rgba(250,204,21,0.35)'
                if (ratio < 0.75) return 'rgba(249,115,22,0.5)'
                return 'rgba(239,68,68,0.7)'
              }

              return (
                <div style={{ padding: '14px 14px 10px', borderRadius: 16, background: 'var(--bg-card-2)', border: '1px solid var(--border)', marginBottom: 10 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', margin: '0 0 10px' }}>📅 Uitgaven per dag</p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                    {DAY_HEADERS.map(h => (
                      <div key={h} style={{ textAlign: 'center', fontSize: 9, color: 'var(--text-3)', fontWeight: 700, paddingBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</div>
                    ))}
                    {cells.map((d, idx) => {
                      if (d === null) return <div key={`e${idx}`} />
                      const iso = `${selYear}-${String(selMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
                      const isFuture = iso > todayISO
                      const isToday  = iso === todayISO
                      return (
                        <div key={d} style={{
                          height: 36, borderRadius: 8,
                          background: cellColor(d),
                          border: isToday ? '1px solid var(--accent)' : '1px solid transparent',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
                          opacity: isFuture ? 0.3 : 1,
                        }}>
                          <span style={{ fontSize: 11, fontWeight: isToday ? 700 : 400, color: isFuture ? 'var(--text-3)' : 'var(--text-2)', lineHeight: 1 }}>{d}</span>
                          {!isFuture && spentPerDay[iso] > 0 && (
                            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.55)', lineHeight: 1 }}>€{Math.round(spentPerDay[iso])}</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* Donut + Lijn side by side */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>

              {/* Donut */}
              <div style={{ padding: '14px', borderRadius: 16, background: 'var(--bg-card-2)', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', margin: '0 0 10px' }}>Categorieën</p>
                {catWithSpend.length === 0
                  ? <p style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', margin: '20px 0' }}>Geen data</p>
                  : (() => {
                      let cum = 0
                      return (
                        <>
                          <svg viewBox="0 0 160 160" style={{ width: '100%', maxWidth: 130, display: 'block', margin: '0 auto 10px' }}>
                            <circle cx="80" cy="80" r="55" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="20" />
                            {catWithSpend.map(cat => {
                              const dash   = (cat.spent / totalSpent) * circumference
                              const offset = circumference - cum
                              cum += dash
                              return (
                                <circle key={cat.id} cx="80" cy="80" r="55" fill="none"
                                  stroke={cat.color} strokeWidth="20"
                                  strokeDasharray={`${dash} ${circumference - dash}`}
                                  strokeDashoffset={offset}
                                  style={{ transform: 'rotate(-90deg)', transformOrigin: '80px 80px' }}
                                />
                              )
                            })}
                            <text x="80" y="76" textAnchor="middle" style={{ fontSize: 13, fontWeight: 700, fill: 'white' }}>{fmtShort(totalSpent)}</text>
                            <text x="80" y="92" textAnchor="middle" style={{ fontSize: 9, fill: 'rgba(255,255,255,0.4)' }}>totaal</text>
                          </svg>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {catWithSpend.map(cat => (
                              <div key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <div style={{ width: 7, height: 7, borderRadius: 2, background: cat.color, flexShrink: 0 }} />
                                <span style={{ fontSize: 9, color: 'var(--text-3)', flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{cat.emoji} {cat.label.split(' ')[0]}</span>
                                <span style={{ fontSize: 9, color: 'var(--text-2)', fontWeight: 600 }}>{Math.round((cat.spent / totalSpent) * 100)}%</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )
                    })()
                }
              </div>

              {/* Saldo lijn */}
              <div style={{ padding: '14px', borderRadius: 16, background: 'var(--bg-card-2)', border: '1px solid var(--border)' }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', margin: '0 0 10px' }}>Saldo verloop</p>
                {(() => {
                  const svgW = 300, svgH = 120
                  const padL = 2, padR = 2, padT = 8, padB = 4
                  const chartW = svgW - padL - padR
                  const chartH = svgH - padT - padB
                  const maxY   = Math.max(adjustedBase, balanceByDay[0] || adjustedBase)
                  const minY   = Math.min(0, ...balanceByDay)
                  const range  = maxY - minY || 1
                  const toX = d => padL + ((d - 1) / Math.max(daysInMonth - 1, 1)) * chartW
                  const toY = v => padT + ((maxY - v) / range) * chartH

                  const actualPts = balanceByDay.slice(0, dayOfMonth).map((v, i) => `${toX(i+1)},${toY(v)}`).join(' ')

                  let projPts = ''
                  if (dayOfMonth < daysInMonth && totalSpent > 0) {
                    const rate = totalSpent / dayOfMonth
                    const pp = []
                    for (let d = dayOfMonth; d <= daysInMonth; d++) {
                      pp.push(`${toX(d)},${toY(adjustedBase - totalSpent - rate * (d - dayOfMonth))}`)
                    }
                    projPts = pp.join(' ')
                  }

                  const todayX  = toX(dayOfMonth)
                  const todayY  = toY(balanceByDay[dayOfMonth - 1] ?? 0)
                  const zeroY   = toY(0)
                  const baseY   = toY(adjustedBase)

                  return (
                    <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: '100%' }}>
                      <line x1={padL} y1={zeroY} x2={svgW-padR} y2={zeroY} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
                      <line x1={padL} y1={baseY} x2={svgW-padR} y2={baseY} stroke="rgba(255,255,255,0.06)" strokeWidth="1" strokeDasharray="3,3" />
                      <line x1={todayX} y1={padT} x2={todayX} y2={svgH-padB} stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="2,2" />
                      {projPts && <polyline points={projPts} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeOpacity="0.35" strokeDasharray="4,3" />}
                      {actualPts && <polyline points={actualPts} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
                      <circle cx={todayX} cy={todayY} r="3" fill="var(--accent)" />
                    </svg>
                  )
                })()}
              </div>

            </div>
          </div>
        )}

        </>}

        {/* ── ENVELOPPEN ── */}
        {subView === 'enveloppen' && <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>Enveloppen</h2>
            <button onClick={() => setShowBudget(true)} style={{ padding: '8px 14px', borderRadius: 12, background: 'var(--bg-card-2)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>Beheren</button>
          </div>
          {carryover > 0 && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderRadius: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', marginBottom: 10 }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>↩</span>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#F59E0B', margin: '0 0 1px' }}>Budgetten aangepast door overschrijding vorige maand</p>
                <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>{fmt(carryover)} tekort verdeeld over alle enveloppen ({Math.round((1 - envelopeScale) * 100)}% minder per categorie)</p>
              </div>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {allCategories.map(cat => {
              const budget   = effectiveBudget(cat.id)
              const origBudget = catBudgets[cat.id] || 0
              const spent    = spentByCategory[cat.id] || 0   // regular (budget) spending
              const fromSav  = savingsByCategory[cat.id] || 0 // savings-funded spending
              const total    = spent + fromSav                 // real total for this category
              const overAmt  = spent > budget && budget > 0 ? spent - budget : 0
              const over     = overAmt > 0
              // Bar segments as % of budget (capped at 100% each for visual clarity)
              const regPct   = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0
              const savPct   = budget > 0 ? Math.min(100 - Math.min(100, regPct), (fromSav / budget) * 100) : 0
              const barColor = over ? '#EF4444' : regPct > 75 ? '#F59E0B' : (cat.color || 'var(--accent)')
              if (budget === 0 && total === 0) return null
              return (
                <div key={cat.id} style={{ padding: '12px 14px', borderRadius: 14, background: over ? 'rgba(239,68,68,0.06)' : 'var(--bg-card-2)', border: `1px solid ${over ? 'rgba(239,68,68,0.3)' : fromSav > 0 ? 'rgba(245,158,11,0.2)' : 'var(--border)'}` }}>
                  {/* Top row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 18 }}>{cat.emoji}</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>{cat.label}</span>
                    <div style={{ textAlign: 'right' }}>
                      {budget > 0 ? (
                        over ? (
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#EF4444' }}>
                            −{fmt(overAmt)} over
                          </span>
                        ) : (
                          <span style={{ fontSize: 13, fontWeight: 700, color: regPct > 75 ? '#F59E0B' : 'var(--text-1)' }}>
                            {fmt(budget - spent)} nog
                          </span>
                        )
                      ) : (
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{fmt(total)}</span>
                      )}
                      {budget > 0 && origBudget !== budget ? (
                        <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 400 }}> / {fmt(budget)} <span style={{ textDecoration: 'line-through', opacity: 0.5 }}>{fmt(origBudget)}</span></span>
                      ) : budget > 0 ? (
                        <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 400 }}> / {fmt(budget)}</span>
                      ) : null}
                    </div>
                  </div>
                  {/* Progress bar: regular (solid) + savings (hatched/dim) */}
                  {budget > 0 && (
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden', marginBottom: 6, display: 'flex' }}>
                      <div style={{ height: '100%', width: `${regPct}%`, background: barColor, borderRadius: '4px 0 0 4px', transition: 'width 0.5s', flexShrink: 0 }} />
                      {fromSav > 0 && savPct > 0 && (
                        <div style={{ height: '100%', width: `${savPct}%`, background: 'rgba(245,158,11,0.45)', flexShrink: 0 }} />
                      )}
                    </div>
                  )}
                  {/* Footer labels */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {fromSav > 0 && (
                        <span style={{ fontSize: 10, color: '#F59E0B', fontWeight: 600 }}>🏦 {fmt(fromSav)} spaarrekening</span>
                      )}
                      {spent > 0 && fromSav > 0 && (
                        <span style={{ fontSize: 10, color: 'var(--text-3)' }}>+ {fmt(spent)} budget</span>
                      )}
                    </div>
                    {over && (
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#EF4444', background: 'rgba(239,68,68,0.12)', padding: '2px 7px', borderRadius: 6 }}>
                        +{fmt(overAmt)} over
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
            {allCategories.every(c => !(catBudgets[c.id] || 0) && !(spentByCategory[c.id] || 0)) && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📁</div>
                <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px', color: 'var(--text-2)' }}>Geen enveloppen</p>
                <p style={{ fontSize: 13, margin: 0 }}>Stel budgetten in via 'Beheren'</p>
              </div>
            )}
          </div>
        </>}

        {/* ── INKOMSTEN ── */}
        {subView === 'inkomsten' && <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>Inkomsten</h2>
            <button onClick={() => setShowRecurring(true)} style={{ padding: '8px 14px', borderRadius: 12, background: hasRecurring ? 'rgba(16,185,129,0.1)' : 'var(--bg-card-2)', border: hasRecurring ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--border)', color: hasRecurring ? '#10B981' : 'var(--text-2)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              {hasRecurring ? '✏ Beheren' : '+ Instellen'}
            </button>
          </div>
          {hasRecurring && (
            <div style={{ marginBottom: 16, padding: '14px 16px', borderRadius: 16, background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.18)' }}>
              <p style={{ fontSize: 11, color: '#10B981', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>Terugkerend · verwacht {fmt(recurringExpected)}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {recurringIncome.map(src => {
                  const next = getNextPayDate(src); const thisMonth = calcRecurringThisMonth([src])
                  return (
                    <div key={src.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{src.emoji}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', margin: '0 0 1px' }}>{src.name}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>{src.type === 'monthly' ? `${src.day}e van de maand` : `Elke ${src.interval_days} dagen`}{next ? ` · volgende: ${next}` : ''}</p>
                      </div>
                      <span style={{ fontSize: 14, fontWeight: 700, color: thisMonth > 0 ? '#10B981' : 'var(--text-3)' }}>{thisMonth > 0 ? fmt(thisMonth) : '–'}</span>
                    </div>
                  )
                })}
              </div>
              {savingsGoal > 0 && <>
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(16,185,129,0.15)', display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--text-3)' }}>🏦 Spaardoel</span><span style={{ color: '#10B981', fontWeight: 700 }}>− {fmt(savingsGoal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
                  <span style={{ color: 'var(--text-3)' }}>Beschikbaar budget</span><span style={{ color: 'var(--text-1)', fontWeight: 700 }}>{fmt(base)}</span>
                </div>
              </>}
            </div>
          )}
          {/* Leningen — consolidated card */}
          {openLoans.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ borderRadius: 16, background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.3)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B', margin: '0 0 4px' }}>🤝 Openstaande lening van mezelf</p>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 10px' }}>
                    {openLoans.length}× opnames · Totaal {fmt(openLoanPrincipal)} + 10% rente = {fmt(openLoanTotal)}
                  </p>
                  {/* Progress bar */}
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{ height: '100%', width: `${openLoanTotal > 0 ? Math.min(100, (totalRepaid / openLoanTotal) * 100) : 0}%`, background: '#10B981', borderRadius: 4, transition: 'width 0.5s' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)', marginBottom: loanRepayments.length > 0 ? 8 : 12 }}>
                    <span>Terugbetaald: {fmt(totalRepaid)}</span>
                    <span>Nog open: {fmt(remainingLoan)}</span>
                  </div>
                  {loanRepayments.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                      {loanRepayments.map(r => (
                        <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, padding: '5px 0', borderTop: '1px solid rgba(245,158,11,0.1)' }}>
                          <span style={{ color: 'var(--text-3)' }}>{r.date}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 700, color: '#F59E0B' }}>{fmt(r.amount)}</span>
                            <button onClick={async () => { await supabase.from('expenses').delete().eq('id', r.id); fetchAll() }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(239,68,68,0.5)', padding: 2 }}><Trash2 size={13} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Partial repay input */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--text-3)' }}>€</span>
                      <input type="text" inputMode="decimal" placeholder="Bedrag teruggestort"
                        value={loanRepayInput} onChange={e => setLoanRepayInput(e.target.value)}
                        onFocus={scrollFix}
                        style={{ width: '100%', padding: '9px 10px 9px 26px', borderRadius: 10, background: 'var(--bg-card-2)', border: '1px solid rgba(245,158,11,0.3)', color: 'var(--text-1)', fontSize: 14, colorScheme: 'dark' }} />
                    </div>
                    <button
                      onClick={async () => {
                        const partialAmount = parseFloat(String(loanRepayInput).replace(',', '.'))
                        if (!partialAmount || partialAmount <= 0) return
                        await supabase.from('expenses').insert({ user_id: userId, amount: partialAmount, category: 'overig', description: '↩ Gedeeltelijke terugbetaling lening', date: todayStr(), is_loan_repayment: true, is_income: false, is_savings_withdrawal: false })
                        if (remainingLoan - partialAmount <= 0) {
                          await Promise.all(openLoans.map(loan => supabase.from('expenses').update({ repaid: true }).eq('id', loan.id)))
                        }
                        setLoanRepayInput('')
                        fetchAll()
                      }}
                      style={{ padding: '9px 14px', borderRadius: 10, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: '#10B981', cursor: 'pointer', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
                      Storten
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Spaaroverschrijvingen deze maand */}
          {savingsGoal > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ borderRadius: 16, background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.3)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: '#10B981', margin: '0 0 4px' }}>🏦 Spaaroverboeking deze maand</p>
                  <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 10px' }}>
                    {fmt(alreadySavedThisMonth)} overgeboekt van {fmt(savingsGoal)} doel
                  </p>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{ height: '100%', width: `${savingsGoal > 0 ? Math.min(100, (alreadySavedThisMonth / savingsGoal) * 100) : 0}%`, background: '#10B981', borderRadius: 4, transition: 'width 0.5s' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)', marginBottom: savingsContribs.length > 0 ? 10 : 12 }}>
                    <span>Overgeboekt: {fmt(alreadySavedThisMonth)}</span>
                    <span>Nog te gaan: {fmt(Math.max(0, savingsGoal - alreadySavedThisMonth))}</span>
                  </div>
                  {/* Lijst van bijdragen */}
                  {savingsContribs.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                      {savingsContribs.map(c => (
                        <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, padding: '6px 0', borderTop: '1px solid rgba(16,185,129,0.1)' }}>
                          <span style={{ color: 'var(--text-3)' }}>{c.date} · {c.description || 'Spaarstorting'}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 700, color: '#10B981' }}>{fmt(c.amount)}</span>
                            <button onClick={async () => { await supabase.from('expenses').delete().eq('id', c.id); fetchAll() }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(239,68,68,0.5)', padding: 2 }}><Trash2 size={13} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Handmatig toevoegen */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--text-3)' }}>€</span>
                      <input type="text" inputMode="decimal" placeholder="Bedrag overgeboekt"
                        value={savingsInput} onChange={e => setSavingsInput(e.target.value)}
                        onFocus={scrollFix}
                        style={{ width: '100%', padding: '9px 10px 9px 26px', borderRadius: 10, background: 'var(--bg-card-2)', border: '1px solid rgba(16,185,129,0.3)', color: 'var(--text-1)', fontSize: 14, colorScheme: 'dark' }} />
                    </div>
                    <button
                      onClick={async () => {
                        const amt = parseFloat(String(savingsInput).replace(',', '.'))
                        if (!amt || amt <= 0) return
                        await supabase.from('expenses').insert({ user_id: userId, amount: amt, category: 'overig', description: '🏦 Spaarstorting', date: todayStr(), is_savings_contribution: true, is_income: false, is_savings_withdrawal: false })
                        setSavingsInput('')
                        fetchAll()
                      }}
                      style={{ padding: '9px 14px', borderRadius: 10, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: '#10B981', cursor: 'pointer', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
                      Toevoegen
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Echt gespaard opnames */}
          {savedWithdrawals.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, color: 'rgba(239,68,68,0.7)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>💰 Echt gespaard — opnames</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {savedWithdrawals.map(exp => (
                  <div key={exp.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 14, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.18)' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>💰</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exp.description || 'Spaaropname'}</p>
                      <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>{exp.date}</p>
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#EF4444', flexShrink: 0 }}>+{fmt(exp.amount)}</span>
                    <button onClick={() => { setEditingSavings(exp); setShowSavings(true) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4, flexShrink: 0 }}><Pencil size={14} /></button>
                    <button onClick={() => deleteExpense(exp.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(239,68,68,0.5)', padding: 4, flexShrink: 0 }}><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {manualIncome.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Eenmalig / extra</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{manualIncome.map(exp => renderTxRow(exp))}</div>
            </div>
          )}
          {manualIncome.length === 0 && !hasRecurring && savingsWithdrawals.length === 0 && openLoans.length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-3)' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>💚</div>
              <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px', color: 'var(--text-2)' }}>Geen inkomsten</p>
              <p style={{ fontSize: 13, margin: 0 }}>Stel terugkerend inkomen in of voeg een eenmalige toe</p>
            </div>
          )}
          <button onClick={() => setShowIncome(true)}
            style={{ width: '100%', padding: '14px', borderRadius: 16, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)', color: '#10B981', cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 }}>
            <Plus size={16} /> Eenmalige inkomsten toevoegen
          </button>
        </>}

        {/* ── UITGAVEN ── */}
        {subView === 'uitgaven' && <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>Uitgaven</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, color: 'var(--text-3)' }}>{fmt(totalSpent)} totaal</span>
              <button onClick={() => setShowPlanned(true)} style={{ padding: '6px 10px', borderRadius: 10, background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', color: '#F59E0B', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>📌 Plannen</button>
            </div>
          </div>

          {/* Geplande uitgaven */}
          {plannedExpenses.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, color: '#F59E0B', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 700 }}>📌 Gepland</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {plannedExpenses.map(exp => {
                  const cat = allCategories.find(c => c.id === exp.category) || CATEGORIES[6]
                  return (
                    <div key={exp.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 14, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.3)' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(245,158,11,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{cat.emoji}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exp.description}</p>
                        <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>{exp.date}{exp.amount > 0 ? ` · ${fmt(exp.amount)}` : ' · bedrag onbekend'}</p>
                      </div>
                      <button onClick={() => { setEditing(exp); setShowAdd(true) }} style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 8, cursor: 'pointer', color: '#F59E0B', padding: '5px 8px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>✓ Bevestig</button>
                      <button onClick={() => deleteExpense(exp.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(239,68,68,0.5)', padding: 4 }}><Trash2 size={14} /></button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {regularExpenses.length > 0 ? <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {(showAll ? regularExpenses : regularExpenses.slice(0, 12)).map(exp => renderTxRow(exp))}
            </div>
            {regularExpenses.length > 12 && (
              <button onClick={() => setShowAll(v => !v)} style={{ width: '100%', marginBottom: 12, padding: '10px', borderRadius: 12, background: 'none', border: '1px solid var(--border)', color: 'var(--text-3)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {showAll ? <><ChevronUp size={14} /> Minder tonen</> : <><ChevronDown size={14} /> Alle {regularExpenses.length} tonen</>}
              </button>
            )}
          </> : plannedExpenses.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>💰</div>
              <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px', color: 'var(--text-2)' }}>Nog geen uitgaves</p>
              <p style={{ fontSize: 13, margin: 0 }}>Voeg je eerste uitgave toe</p>
            </div>
          ) : null}
        </>}

        {subView === 'jaar' && <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>Jaaroverzicht {selYear}</h2>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setSelYear(y => y - 1)} style={{ padding: '6px 10px', borderRadius: 10, background: 'var(--bg-card-2)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontSize: 13 }}>‹ {selYear - 1}</button>
              {selYear < nowY && <button onClick={() => setSelYear(y => y + 1)} style={{ padding: '6px 10px', borderRadius: 10, background: 'var(--bg-card-2)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontSize: 13 }}>{selYear + 1} ›</button>}
            </div>
          </div>

          {/* Yearly totals */}
          {(() => {
            const totalYearSpent  = yearMonthly.reduce((s, m) => s + m.spent, 0)
            const totalYearIncome = yearMonthly.reduce((s, m) => s + m.income, 0)
            const maxSpent        = Math.max(...yearMonthly.map(m => m.spent), 1)
            const MONTHS_NL       = ['Jan','Feb','Mrt','Apr','Mei','Jun','Jul','Aug','Sep','Okt','Nov','Dec']
            return <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <p style={{ fontSize: 10, color: 'rgba(239,68,68,0.7)', margin: '0 0 4px', textTransform: 'uppercase', fontWeight: 700 }}>Totaal uitgegeven</p>
                  <p style={{ fontSize: 22, fontWeight: 800, color: '#EF4444', margin: 0 }}>{fmt(totalYearSpent)}</p>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: 14, background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
                  <p style={{ fontSize: 10, color: 'rgba(16,185,129,0.7)', margin: '0 0 4px', textTransform: 'uppercase', fontWeight: 700 }}>Totaal inkomen</p>
                  <p style={{ fontSize: 22, fontWeight: 800, color: '#10B981', margin: 0 }}>{fmt(totalYearIncome)}</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {yearMonthly.map(({ m, spent, income, hasDat }) => {
                  const isSelMonth = m === selMonth
                  const barW = maxSpent > 0 ? (spent / maxSpent) * 100 : 0
                  return (
                    <button key={m} onClick={() => { setSelMonth(m); setSubView('weergave') }}
                      style={{ padding: '12px 14px', borderRadius: 14, background: isSelMonth ? 'rgba(0,255,209,0.07)' : hasDat ? 'var(--bg-card-2)' : 'rgba(255,255,255,0.02)', border: isSelMonth ? '1px solid var(--accent)' : '1px solid var(--border)', cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: hasDat ? 8 : 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: isSelMonth ? 'var(--accent)' : 'var(--text-2)', width: 28, flexShrink: 0 }}>{MONTHS_NL[m]}</span>
                        <div style={{ flex: 1 }}>
                          {hasDat ? (
                            <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${barW}%`, background: spent > (income || base) ? '#EF4444' : 'var(--accent)', borderRadius: 4 }} />
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Geen data</span>
                          )}
                        </div>
                        {hasDat && <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#EF4444' }}>{fmt(spent)}</span>
                          {income > 0 && <span style={{ fontSize: 11, color: '#10B981', marginLeft: 6 }}>+{fmt(income)}</span>}
                        </div>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          })()}
        </>}

        {/* ── ZOEKEN ── */}
        {subView === 'zoeken' && (() => {
          // Group searchResults by month
          const grouped = []
          let lastKey = null
          searchResults.forEach(exp => {
            const d = new Date(exp.date)
            const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
            const label = d.toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
            if (key !== lastKey) { grouped.push({ key, label, items: [] }); lastKey = key }
            grouped[grouped.length - 1].items.push(exp)
          })
          return (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>Zoeken</h2>
              </div>
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, color: 'var(--text-3)' }}>🔍</span>
                <input
                  autoFocus
                  type="text"
                  placeholder="Zoek in alle uitgaven..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onFocus={scrollFix}
                  style={{ width: '100%', padding: '12px 14px 12px 40px', borderRadius: 14, background: 'var(--bg-card-2)', border: '1px solid var(--border)', color: 'var(--text-1)', fontSize: 15, colorScheme: 'dark', boxSizing: 'border-box' }}
                />
                {searchQuery.length > 0 && (
                  <button onClick={() => setSearchQuery('')} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}><X size={14} /></button>
                )}
              </div>

              {searchLoading && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '30px 0' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.7s linear infinite' }} />
                </div>
              )}

              {!searchLoading && searchQuery.trim().length < 2 && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
                  <p style={{ fontSize: 14, margin: 0 }}>Typ minimaal 2 tekens om te zoeken</p>
                </div>
              )}

              {!searchLoading && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>😶</div>
                  <p style={{ fontSize: 14, margin: 0 }}>Geen resultaten voor '{searchQuery.trim()}'</p>
                </div>
              )}

              {!searchLoading && searchResults.length > 0 && (
                <>
                  <div style={{ position: 'sticky', top: 0, zIndex: 10, padding: '8px 12px', borderRadius: 10, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', border: '1px solid var(--border)', marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{searchResults.length} resultaten</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>totaal {fmt(searchTotal)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {grouped.map(({ key, label, items }) => (
                      <div key={key}>
                        <p style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>{label}</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {items.map(exp => renderTxRow(exp))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )
        })()}

        </div>
      </div>

      {/* Persistent action bar — hidden on jaar and zoeken tabs */}
      <div style={{ padding: '10px 16px 0', flexShrink: 0, display: subView === 'jaar' || subView === 'zoeken' ? 'none' : 'block' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', gap: 8, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => setShowSavings(true)} style={{ flex: 1, padding: '11px 8px', borderRadius: 14, background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444', cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <TrendingDown size={14} /> Spaar af
          </button>
          <button onClick={() => { setEditing(null); setShowAdd(true) }} style={{ flex: 2, padding: '11px 8px', borderRadius: 14, background: 'var(--accent)', border: 'none', color: '#000', cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Plus size={15} /> Uitgave toevoegen
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-sidebar)', padding: isMobile ? '6px 6px' : '10px 16px', flexShrink: 0, display: 'flex', gap: isMobile ? 2 : 8, justifyContent: 'center' }}>
        {isMobile ? (
          <>
            {GELD_TABS.map(tab => (
              <button key={tab.id} onClick={() => setSubView(tab.id)}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '4px 2px', borderRadius: 10, background: subView === tab.id ? 'rgba(0,255,209,0.1)' : 'none', border: 'none', cursor: 'pointer' }}>
                <span style={{ fontSize: 16 }}>{tab.emoji}</span>
                <span style={{ fontSize: 9, color: subView === tab.id ? 'var(--accent)' : 'var(--text-3)', fontWeight: subView === tab.id ? 700 : 400 }}>{tab.label}</span>
              </button>
            ))}
          </>
        ) : (
          <div style={{ maxWidth: 480, width: '100%', display: 'flex', gap: 8 }}>
            {GELD_TABS.map(tab => (
              <button key={tab.id} onClick={() => setSubView(tab.id)}
                style={{ flex: 1, padding: '10px 6px', borderRadius: 12, border: subView === tab.id ? '1px solid var(--accent)' : '1px solid var(--border)', background: subView === tab.id ? 'rgba(0,255,209,0.08)' : 'var(--bg-card-2)', color: subView === tab.id ? 'var(--accent)' : 'var(--text-3)', cursor: 'pointer', fontSize: 12, fontWeight: subView === tab.id ? 600 : 400, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <span>{tab.emoji}</span> {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {showAdd && <ExpenseModal editing={editing} defaultDate={isCurrentMonth ? undefined : monthEndOf(selYear, selMonth)} onClose={() => { setShowAdd(false); setEditing(null) }} onSave={saveExpense} categories={allCategories} />}
      {showPlanned && <ExpenseModal plannedMode onClose={() => setShowPlanned(false)} onSave={(data) => { saveExpense(data); setShowPlanned(false) }} categories={allCategories} defaultDate={isCurrentMonth ? undefined : monthEndOf(selYear, selMonth)} />}
      {showIncome && (
        <IncomeDayModal
          source={null}
          defaultDate={isCurrentMonth ? todayStr() : monthEndOf(selYear, selMonth)}
          adjustedBase={minBalance}
          savingsGoal={savingsGoal}
          alreadySavedThisMonth={alreadySavedThisMonth}
          totalLoanRemaining={remainingLoan}
          userId={userId}
          onLater={() => setShowIncome(false)}
          onDone={() => { setShowIncome(false); fetchAll() }}
        />
      )}
      {showSavings && <SavingsModal editing={editingSavings} onClose={() => { setShowSavings(false); setEditingSavings(null) }} onSave={async (data) => { if (editingSavings) { await supabase.from('expenses').update(data).eq('id', editingSavings.id); setEditingSavings(null); setShowSavings(false); fetchAll() } else { saveExpense(data) } }} />}
      {showBudget && <BudgetModal config={config} onClose={() => setShowBudget(false)} onSave={saveBudget} />}
      {showRecurring && <RecurringIncomeModal config={config} onClose={() => setShowRecurring(false)} onSave={saveRecurring} />}
      {pendingIncomeSource && !incomeDone && (
        <IncomeDayModal
          source={pendingIncomeSource}
          adjustedBase={minBalance}
          savingsGoal={savingsGoal}
          alreadySavedThisMonth={alreadySavedThisMonth}
          totalLoanRemaining={remainingLoan}
          userId={userId}
          onLater={() => setIncomeDone(true)}
          onDone={async () => {
            markFilledInToday(pendingIncomeSource.id)
            setIncomeDone(true)
            const today = todayStr()
            const existing = config?.income_confirmed_dates || {}
            const updated = { ...existing, [today]: [...new Set([...(existing[today] || []), pendingIncomeSource.id])] }
            Object.keys(updated).forEach(d => { if (d < today) delete updated[d] })
            supabase.from('budget_config').upsert({ income_confirmed_dates: updated, user_id: userId, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
            fetchAll()
          }}
        />
      )}
      <style>{`@keyframes sheetUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </div>
  )
}
