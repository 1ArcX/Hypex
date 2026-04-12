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
  const now = new Date()
  if (src.type === 'monthly') {
    let d = new Date(now.getFullYear(), now.getMonth(), src.day)
    if (d <= now) d = new Date(now.getFullYear(), now.getMonth() + 1, src.day)
    return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })
  }
  if (src.type === 'interval' && src.ref_date) {
    const ms = src.interval_days * 86400000
    let d = new Date(src.ref_date + 'T12:00:00')
    while (d <= now) d = new Date(d.getTime() + ms)
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
function todayStr() { return new Date().toISOString().slice(0, 10) }
function monthStart() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01` }
function monthEnd() {
  const d = new Date(); const last = new Date(d.getFullYear(), d.getMonth()+1, 0)
  return `${last.getFullYear()}-${String(last.getMonth()+1).padStart(2,'0')}-${String(last.getDate()).padStart(2,'0')}`
}
function monthLabel() {
  return new Date().toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' })
}

// ── Expense Log Modal ─────────────────────────────────────────────────────────
function ExpenseModal({ onClose, onSave, editing, categories = CATEGORIES }) {
  const backdropRef = useRef(null)
  usePreventTouch(backdropRef)
  const [amount, setAmount]             = useState(editing?.amount || '')
  const [cat, setCat]                   = useState(editing?.category || 'eten')
  const [desc, setDesc]                 = useState(editing?.description || '')
  const [date, setDate]                 = useState(editing?.date || todayStr())
  const [paidFromSavings, setPFS]       = useState(editing?.paid_from_savings || false)

  const handleSave = () => {
    const n = parseFloat(String(amount).replace(',', '.'))
    if (!n || n <= 0) return
    onSave({ amount: n, category: cat, description: desc.trim(), date, is_savings_withdrawal: false, paid_from_savings: paidFromSavings })
  }

  return ReactDOM.createPortal(
    <div ref={backdropRef} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 480, background: 'var(--bg-sidebar)', borderRadius: '22px 22px 0 0', border: '1px solid var(--border)', borderBottom: 'none', padding: '20px 20px calc(24px + env(safe-area-inset-bottom) + var(--keyboard-height, 0px))', animation: 'sheetUp 0.3s cubic-bezier(0.34,1.1,0.64,1)' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 18px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>{editing ? 'Bewerken' : 'Uitgave toevoegen'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}><X size={18} /></button>
        </div>

        {/* Amount */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 24, fontWeight: 700, color: 'var(--text-3)' }}>€</span>
            <input
              autoFocus type="text" inputMode="decimal" placeholder="0,00"
              value={amount} onChange={e => setAmount(e.target.value)}
              onFocus={scrollFix}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              style={{ width: '100%', padding: '14px 16px 14px 36px', borderRadius: 14, background: 'var(--bg-card-2)', border: '1px solid var(--border)', color: 'var(--text-1)', fontSize: 28, fontWeight: 700, colorScheme: 'dark' }}
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

        {/* Description */}
        <input
          placeholder="Omschrijving (optioneel)"
          value={desc} onChange={e => setDesc(e.target.value)}
          onFocus={scrollFix}
          style={{ width: '100%', padding: '10px 14px', borderRadius: 12, background: 'var(--bg-card-2)', border: '1px solid var(--border)', color: 'var(--text-1)', fontSize: 14, marginBottom: 12, colorScheme: 'dark' }}
        />

        {/* Date */}
        <input
          type="date" value={date} onChange={e => setDate(e.target.value)}
          style={{ width: '100%', padding: '10px 14px', borderRadius: 12, background: 'var(--bg-card-2)', border: '1px solid var(--border)', color: 'var(--text-3)', fontSize: 13, marginBottom: 18, colorScheme: 'dark' }}
        />

        {/* Betaald van spaarrekening toggle */}
        <div onClick={() => setPFS(p => !p)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', borderRadius: 12, background: paidFromSavings ? 'rgba(245,158,11,0.08)' : 'rgba(255,255,255,0.03)', border: paidFromSavings ? '1px solid rgba(245,158,11,0.35)' : '1px solid var(--border)', marginBottom: 14, cursor: 'pointer' }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: paidFromSavings ? '#F59E0B' : 'var(--text-3)', margin: '0 0 1px' }}>🏦 Betaald van spaarrekening</p>
            <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>Voor noodzakelijke uitgaven buiten budget</p>
          </div>
          <div style={{ width: 40, height: 22, borderRadius: 11, background: paidFromSavings ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.1)', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}>
            <div style={{ position: 'absolute', width: 18, height: 18, borderRadius: '50%', background: paidFromSavings ? '#F59E0B' : 'rgba(255,255,255,0.35)', top: 2, left: paidFromSavings ? 20 : 2, transition: 'left 0.2s' }} />
          </div>
        </div>

        <button onClick={handleSave} style={{ width: '100%', padding: '14px', borderRadius: 14, background: 'var(--accent)', border: 'none', color: '#000', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          {editing ? 'Opslaan' : '+ Toevoegen'}
        </button>
      </div>
    </div>,
    document.body
  )
}

// ── Savings Withdrawal Modal ──────────────────────────────────────────────────
function SavingsModal({ onClose, onSave }) {
  const backdropRef = useRef(null)
  usePreventTouch(backdropRef)
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  const handleSave = () => {
    const n = parseFloat(String(amount).replace(',', '.'))
    if (!n || n <= 0) return
    onSave({ amount: n, category: 'overig', description: reason.trim() || 'Spaargeld opname', date: todayStr(), is_savings_withdrawal: true, savings_reason: reason.trim() })
  }

  return ReactDOM.createPortal(
    <div ref={backdropRef} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 20px calc(20px + var(--keyboard-height, 0px))' }}>
      <div style={{ width: '100%', maxWidth: 380, background: 'var(--bg-sidebar)', borderRadius: 22, border: '1px solid rgba(239,68,68,0.4)', padding: 24 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: '#EF4444', margin: '0 0 6px' }}>Spaargeld afhalen</h3>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>Dit wordt bijgehouden. Zeker weten?</p>
        </div>

        <div style={{ position: 'relative', marginBottom: 12 }}>
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 20, fontWeight: 700, color: 'var(--text-3)' }}>€</span>
          <input autoFocus type="text" inputMode="decimal" placeholder="0,00" value={amount} onChange={e => setAmount(e.target.value)}
            onFocus={scrollFix}
            style={{ width: '100%', padding: '12px 14px 12px 32px', borderRadius: 12, background: 'var(--bg-card-2)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--text-1)', fontSize: 24, fontWeight: 700, colorScheme: 'dark' }} />
        </div>
        <input placeholder="Waarom haal je dit af?" value={reason} onChange={e => setReason(e.target.value)}
          onFocus={scrollFix}
          style={{ width: '100%', padding: '10px 14px', borderRadius: 12, background: 'var(--bg-card-2)', border: '1px solid var(--border)', color: 'var(--text-1)', fontSize: 14, marginBottom: 18, colorScheme: 'dark' }} />

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'var(--bg-card-2)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontSize: 14 }}>Annuleer</button>
          <button onClick={handleSave} style={{ flex: 1, padding: '12px', borderRadius: 12, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.5)', color: '#EF4444', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}>Loggen</button>
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

        <button onClick={() => onSave({ monthly_budget: monthly, category_budgets: cats, custom_categories: customCats, savings_goal: savingsGoal })}
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

  const [sources, setSources] = useState(config?.recurring_income || [])
  const [adding,  setAdding]  = useState((config?.recurring_income || []).length === 0)
  const [name,    setName]    = useState('')
  const [emoji,   setEmoji]   = useState('💼')
  const [amount,  setAmount]  = useState('')
  const [type,    setType]    = useState('monthly')
  const [day,     setDay]     = useState(1)
  const [intDays, setIntDays] = useState(28)
  const [refDate, setRefDate] = useState(todayStr())

  const resetForm = () => { setName(''); setEmoji('💼'); setAmount(''); setType('monthly'); setDay(1); setIntDays(28); setRefDate(todayStr()) }

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
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#10B981', marginRight: 4 }}>€{Number(src.amount).toFixed(0)}</span>
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

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function GeldPage({ userId }) {
  const [expenses, setExpenses]       = useState([])
  const [config, setConfig]           = useState(null)
  const [loading, setLoading]         = useState(true)
  const [showAdd, setShowAdd]         = useState(false)
  const [showIncome, setShowIncome]   = useState(false)
  const [showSavings, setShowSavings] = useState(false)
  const [showBudget, setShowBudget]   = useState(false)
  const [editing, setEditing]         = useState(null)
  const [showAll, setShowAll]         = useState(false)
  const [showRecurring, setShowRecurring] = useState(false)

  const fetchAll = useCallback(async () => {
    const [expRes, cfgRes] = await Promise.all([
      supabase.from('expenses').select('*').eq('user_id', userId)
        .gte('date', monthStart()).lte('date', monthEnd()).order('date', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('budget_config').select('*').eq('user_id', userId).single(),
    ])
    setExpenses(expRes.data || [])
    setConfig(cfgRes.data || { monthly_budget: 400, category_budgets: DEFAULT_CAT_BUDGETS })
    setLoading(false)
  }, [userId])

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
  const catBudgets         = config?.category_budgets || DEFAULT_CAT_BUDGETS
  const customCategories   = config?.custom_categories || []
  const allCategories      = [...CATEGORIES, ...customCategories]
  const manualIncome       = expenses.filter(e => e.is_income)
  const totalManualIncome  = manualIncome.reduce((s, e) => s + Number(e.amount), 0)
  const regularExpenses    = expenses.filter(e => !e.is_savings_withdrawal && !e.is_income)
  const totalSpent         = regularExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const savingsWithdrawals = expenses.filter(e => e.is_savings_withdrawal)
  const savingsTotal       = savingsWithdrawals.reduce((s, e) => s + Number(e.amount), 0)
  const savingsExpenses    = regularExpenses.filter(e => e.paid_from_savings)
  const savingsExpTotal    = savingsExpenses.reduce((s, e) => s + Number(e.amount), 0)

  const recurringIncome    = config?.recurring_income || []
  const recurringExpected  = calcRecurringThisMonth(recurringIncome)
  const hasRecurring       = recurringIncome.length > 0
  const savingsGoal        = config?.savings_goal || 0
  // base: income minus savings goal = what's available to spend
  const grossIncome = hasRecurring ? recurringExpected + totalManualIncome : (totalManualIncome > 0 ? totalManualIncome : monthlyBudget)
  const base        = savingsGoal > 0 ? Math.max(0, grossIncome - savingsGoal) : grossIncome
  const remaining  = base - totalSpent
  const remainPct  = Math.max(0, Math.min(100, (remaining / base) * 100))

  const todayTotal = regularExpenses.filter(e => e.date === todayStr())
    .reduce((s, e) => s + Number(e.amount), 0)

  const spentByCategory = {}
  for (const cat of allCategories) {
    spentByCategory[cat.id] = regularExpenses.filter(e => e.category === cat.id)
      .reduce((s, e) => s + Number(e.amount), 0)
  }

  const barColor = remainPct > 40 ? 'var(--accent)' : remainPct > 15 ? '#F59E0B' : '#EF4444'
  const allTransactions = [...regularExpenses, ...manualIncome].sort((a, b) => b.date.localeCompare(a.date) || b.created_at?.localeCompare(a.created_at))
  const displayedExpenses = showAll ? allTransactions : allTransactions.slice(0, 8)

  // Smart stats
  const today        = new Date()
  const daysInMonth  = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const dayOfMonth   = today.getDate()
  const daysLeft     = daysInMonth - dayOfMonth + 1
  const dagBudget    = remaining > 0 ? remaining / daysLeft : 0
  const projectedTotal = dayOfMonth > 1 ? (totalSpent / dayOfMonth) * daysInMonth : null
  const projectedOver  = projectedTotal !== null && projectedTotal > base

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
  regularExpenses.forEach(e => {
    const day = new Date(e.date).getDate()
    const wi  = day <= 7 ? 0 : day <= 14 ? 1 : day <= 21 ? 2 : day <= 28 ? 3 : 4
    weekTotals[wi] += Number(e.amount)
  })
  const maxWeekVal    = Math.max(...weekTotals, weekBudget, 1)
  const currentWeekIdx = dayOfMonth <= 7 ? 0 : dayOfMonth <= 14 ? 1 : dayOfMonth <= 21 ? 2 : dayOfMonth <= 28 ? 3 : 4

  // Donut
  const circumference  = 2 * Math.PI * 55
  const catWithSpend   = allCategories.map(c => ({ ...c, spent: spentByCategory[c.id] || 0 })).filter(c => c.spent > 0)

  // Balance line
  const balanceByDay = []
  for (let d = 1; d <= daysInMonth; d++) {
    const spent = regularExpenses.filter(e => new Date(e.date).getDate() <= d).reduce((s, e) => s + Number(e.amount), 0)
    balanceByDay.push(base - spent)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', animation: 'spin 0.7s linear infinite' }} />
    </div>
  )

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--bg-base)' }}>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '20px 16px 100px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-1)', margin: '0 0 2px' }}>Geld</h2>
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>{monthLabel()}</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowRecurring(true)} style={{ padding: '8px 14px', borderRadius: 12, background: hasRecurring ? 'rgba(16,185,129,0.1)' : 'var(--bg-card-2)', border: hasRecurring ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--border)', color: hasRecurring ? '#10B981' : 'var(--text-2)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              💚 Inkomen
            </button>
            <button onClick={() => setShowBudget(true)} style={{ padding: '8px 14px', borderRadius: 12, background: 'var(--bg-card-2)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
              Budget
            </button>
          </div>
        </div>

        {/* Big remaining card */}
        <div style={{
          padding: '22px 22px 18px', borderRadius: 22, marginBottom: 14,
          background: remaining < 0
            ? 'linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.04))'
            : remainPct < 15
            ? 'linear-gradient(135deg, rgba(239,68,68,0.10), rgba(239,68,68,0.03))'
            : remainPct < 40
            ? 'linear-gradient(135deg, rgba(245,158,11,0.10), rgba(245,158,11,0.03))'
            : 'linear-gradient(135deg, rgba(0,255,209,0.08), rgba(0,255,209,0.02))',
          border: `1px solid ${remaining < 0 ? 'rgba(239,68,68,0.35)' : remainPct < 15 ? 'rgba(239,68,68,0.25)' : remainPct < 40 ? 'rgba(245,158,11,0.25)' : 'rgba(0,255,209,0.2)'}`,
        }}>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
            {remaining < 0 ? '🚨 Budget overschreden' : 'Nog over deze maand'}
          </p>
          <p style={{ fontSize: 48, fontWeight: 800, margin: '0 0 14px', color: remaining < 0 ? '#EF4444' : remainPct < 15 ? '#EF4444' : remainPct < 40 ? '#F59E0B' : 'var(--text-1)', lineHeight: 1 }}>
            {fmt(Math.abs(remaining))}
          </p>
          <div style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
            <div style={{ height: '100%', width: `${100 - remainPct}%`, background: barColor, borderRadius: 8, transition: 'width 0.6s ease', boxShadow: `0 0 8px ${barColor}60` }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-3)' }}>
            <span>{fmt(totalSpent)} uitgegeven</span>
            <span>
              {savingsGoal > 0
                ? `${fmt(grossIncome)} − 🏦 ${fmt(savingsGoal)} = ${fmt(base)}`
                : hasRecurring
                  ? `Verwacht: ${fmt(recurringExpected)}${totalManualIncome > 0 ? ` + ${fmt(totalManualIncome)}` : ''}`
                  : totalManualIncome > 0 ? `Inkomsten: ${fmt(totalManualIncome)}` : `Budget: ${fmt(monthlyBudget)}`
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
          <div onClick={() => setShowRecurring(true)}
            style={{ padding: '12px 14px', borderRadius: 16, background: hasRecurring ? 'rgba(16,185,129,0.08)' : totalManualIncome > 0 ? 'rgba(16,185,129,0.08)' : 'var(--bg-card-2)', border: (hasRecurring || totalManualIncome > 0) ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--border)', cursor: 'pointer' }}>
            <p style={{ fontSize: 10, color: (hasRecurring || totalManualIncome > 0) ? '#10B981' : 'var(--text-3)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>💚 Inkomen</p>
            <p style={{ fontSize: 20, fontWeight: 700, margin: 0, color: (hasRecurring || totalManualIncome > 0) ? '#10B981' : 'var(--text-3)' }}>
              {hasRecurring ? fmt(recurringExpected) : totalManualIncome > 0 ? fmt(totalManualIncome) : '–'}
            </p>
            {hasRecurring && <p style={{ fontSize: 9, color: 'rgba(16,185,129,0.6)', margin: '2px 0 0', fontWeight: 600 }}>VERWACHT</p>}
          </div>
          <div onClick={() => savingsWithdrawals.length > 0 && setShowAll(true)}
            style={{ padding: '12px 14px', borderRadius: 16, background: savingsWithdrawals.length > 0 ? 'rgba(239,68,68,0.08)' : 'var(--bg-card-2)', border: savingsWithdrawals.length > 0 ? '1px solid rgba(239,68,68,0.3)' : '1px solid var(--border)', cursor: savingsWithdrawals.length > 0 ? 'pointer' : 'default' }}>
            <p style={{ fontSize: 10, color: savingsWithdrawals.length > 0 ? '#EF4444' : 'var(--text-3)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>💸 Spaar</p>
            <p style={{ fontSize: 20, fontWeight: 700, margin: 0, color: savingsWithdrawals.length > 0 ? '#EF4444' : 'var(--text-3)' }}>
              {savingsWithdrawals.length > 0 ? `${savingsWithdrawals.length}× ${fmtShort(savingsTotal)}` : '–'}
            </p>
          </div>
        </div>

        {/* Recurring income sources */}
        {hasRecurring && (
          <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 16, background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <p style={{ fontSize: 10, color: '#10B981', margin: 0, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
                Verwacht inkomen{savingsGoal > 0 ? ` · 🏦 ${fmt(savingsGoal)} sparen` : ''}
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
        )}

        {/* Smart stats — Dagbudget / Prognose / Spaarstreak */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div style={{ padding: '12px 14px', borderRadius: 16, background: 'var(--bg-card-2)', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: 10, color: 'var(--text-3)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Dagbudget</p>
            <p style={{ fontSize: 18, fontWeight: 700, margin: '0 0 2px', lineHeight: 1.1, color: dagBudget > 15 ? '#10B981' : dagBudget > 5 ? '#F59E0B' : '#EF4444' }}>{fmtShort(dagBudget)}</p>
            <p style={{ fontSize: 10, color: 'var(--text-3)', margin: 0 }}>{daysLeft}d over</p>
          </div>
          <div style={{ padding: '12px 14px', borderRadius: 16, background: projectedOver ? 'rgba(239,68,68,0.07)' : 'var(--bg-card-2)', border: projectedOver ? '1px solid rgba(239,68,68,0.25)' : '1px solid var(--border)' }}>
            <p style={{ fontSize: 10, color: projectedOver ? '#EF4444' : 'var(--text-3)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Prognose</p>
            {projectedTotal === null
              ? <p style={{ fontSize: 12, fontWeight: 600, margin: 0, color: 'var(--text-3)' }}>Geen data</p>
              : <>
                  <p style={{ fontSize: 18, fontWeight: 700, margin: '0 0 2px', lineHeight: 1.1, color: projectedOver ? '#EF4444' : '#10B981' }}>{fmtShort(projectedTotal)}</p>
                  <p style={{ fontSize: 10, margin: 0, color: projectedOver ? 'rgba(239,68,68,0.7)' : 'rgba(16,185,129,0.7)' }}>{projectedOver ? `⚠ +${fmtShort(projectedTotal - base)}` : '✓ Op schema'}</p>
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
                  const maxY   = Math.max(base, balanceByDay[0] || base)
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
                      pp.push(`${toX(d)},${toY(base - totalSpent - rate * (d - dayOfMonth))}`)
                    }
                    projPts = pp.join(' ')
                  }

                  const todayX  = toX(dayOfMonth)
                  const todayY  = toY(balanceByDay[dayOfMonth - 1] ?? 0)
                  const zeroY   = toY(0)
                  const baseY   = toY(base)

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

        {/* Category envelopes */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Enveloppen</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {allCategories.map(cat => {
              const budget = catBudgets[cat.id] || 0
              const spent  = spentByCategory[cat.id] || 0
              const pct    = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0
              const over   = spent > budget && budget > 0
              if (budget === 0 && spent === 0) return null
              return (
                <div key={cat.id} style={{ padding: '12px 14px', borderRadius: 14, background: over ? 'rgba(239,68,68,0.06)' : 'var(--bg-card-2)', border: `1px solid ${over ? 'rgba(239,68,68,0.25)' : 'var(--border)'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 18 }}>{cat.emoji}</span>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>{cat.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: over ? '#EF4444' : pct > 75 ? '#F59E0B' : 'var(--text-1)' }}>
                      {fmt(spent)}
                      {budget > 0 && <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 400 }}> / {fmt(budget)}</span>}
                    </span>
                  </div>
                  {budget > 0 && (
                    <div style={{ height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: over ? '#EF4444' : pct > 75 ? '#F59E0B' : cat.color, borderRadius: 4, transition: 'width 0.5s' }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Recent expenses */}
        {regularExpenses.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Transacties</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {displayedExpenses.map(exp => {
                const isInc = exp.is_income
                const cat   = isInc
                  ? (INCOME_CATEGORIES.find(c => c.id === exp.category) || INCOME_CATEGORIES[4])
                  : (allCategories.find(c => c.id === exp.category) || CATEGORIES[6])
                const color = isInc ? '#10B981' : (cat.color || '#94A3B8')
                return (
                  <div key={exp.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 14, background: isInc ? 'rgba(16,185,129,0.05)' : 'var(--bg-card-2)', border: `1px solid ${isInc ? 'rgba(16,185,129,0.2)' : 'var(--border)'}` }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                      {cat.emoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {exp.description || cat.label}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>{exp.date}{isInc ? ' · inkomsten' : ''}</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color }}>{isInc ? '+' : ''}{fmt(exp.amount)}</span>
                      {exp.paid_from_savings && <span style={{ fontSize: 9, fontWeight: 700, color: '#F59E0B', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 5, padding: '1px 5px' }}>GESPAARD</span>}
                    </div>
                    {!isInc && <button onClick={() => { setEditing(exp); setShowAdd(true) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}>
                      <Pencil size={12} />
                    </button>}
                    <button onClick={() => deleteExpense(exp.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(239,68,68,0.5)', padding: 4 }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                )
              })}
            </div>
            {regularExpenses.length > 8 && (
              <button onClick={() => setShowAll(v => !v)} style={{ width: '100%', marginTop: 8, padding: '10px', borderRadius: 12, background: 'none', border: '1px solid var(--border)', color: 'var(--text-3)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {showAll ? <><ChevronUp size={14} /> Minder tonen</> : <><ChevronDown size={14} /> Alle {regularExpenses.length} tonen</>}
              </button>
            )}
          </div>
        )}

        {regularExpenses.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>💰</div>
            <p style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px', color: 'var(--text-2)' }}>Nog geen uitgaves</p>
            <p style={{ fontSize: 13, margin: 0 }}>Voeg je eerste uitgave toe</p>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, position: 'fixed', bottom: 'calc(70px + env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, padding: '0 16px', zIndex: 50 }}>
          <button onClick={() => setShowSavings(true)}
            style={{ flex: 1, padding: '12px 6px', borderRadius: 16, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#EF4444', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <TrendingDown size={14} /> Spaar af
          </button>
          <button onClick={() => setShowIncome(true)}
            style={{ flex: 1, padding: '12px 6px', borderRadius: 16, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)', color: '#10B981', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
            <ArrowDownLeft size={14} /> Inkomsten
          </button>
          <button onClick={() => { setEditing(null); setShowAdd(true) }}
            style={{ flex: 2, padding: '12px 8px', borderRadius: 16, background: 'var(--accent)', border: 'none', color: '#000', cursor: 'pointer', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Plus size={15} /> Uitgave
          </button>
        </div>
      </div>

      {showAdd && (
        <ExpenseModal editing={editing} onClose={() => { setShowAdd(false); setEditing(null) }} onSave={saveExpense} categories={allCategories} />
      )}
      {showIncome && <IncomeModal onClose={() => setShowIncome(false)} onSave={saveExpense} />}
      {showSavings && <SavingsModal onClose={() => setShowSavings(false)} onSave={saveExpense} />}
      {showBudget && <BudgetModal config={config} onClose={() => setShowBudget(false)} onSave={saveBudget} />}
      {showRecurring && <RecurringIncomeModal config={config} onClose={() => setShowRecurring(false)} onSave={saveRecurring} />}

      <style>{`@keyframes sheetUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </div>
  )
}
