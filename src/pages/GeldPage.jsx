import React, { useState, useEffect, useCallback, useRef } from 'react'
import ReactDOM from 'react-dom'
import { supabase } from '../supabaseClient'
import { Plus, X, Trash2, Pencil, AlertTriangle, TrendingDown, Wallet, ChevronDown, ChevronUp } from 'lucide-react'

const CATEGORIES = [
  { id: 'eten',          label: 'Eten & drinken', emoji: '🍔', color: '#F97316' },
  { id: 'boodschappen',  label: 'Boodschappen',   emoji: '🛒', color: '#10B981' },
  { id: 'transport',     label: 'Transport',       emoji: '🚌', color: '#3B82F6' },
  { id: 'kleding',       label: 'Kleding',         emoji: '👕', color: '#8B5CF6' },
  { id: 'abonnementen',  label: 'Abonnementen',    emoji: '📱', color: '#EC4899' },
  { id: 'sport',         label: 'Sport',           emoji: '⚽', color: '#FACC15' },
  { id: 'overig',        label: 'Overig',          emoji: '💸', color: '#94A3B8' },
]

const DEFAULT_CAT_BUDGETS = {
  eten: 120, boodschappen: 80, transport: 40,
  kleding: 50, abonnementen: 30, sport: 20, overig: 60,
}

// iOS: scroll focused input above keyboard
const scrollFix = (e) => { const t = e.target; setTimeout(() => t.scrollIntoView({ behavior: 'smooth', block: 'center' }), 350) }

// iOS: prevent body from swallowing touch-scroll while modal is open.
// Walks up from the touch target; allows scroll if a scrollable ancestor exists.
function useModalScroll() {
  useEffect(() => {
    document.documentElement.style.overflow = 'auto'
    document.body.style.overflow = 'auto'

    const prevent = (e) => {
      let el = e.target
      while (el && el !== document.documentElement) {
        const s = window.getComputedStyle(el)
        if ((s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight) return
        el = el.parentElement
      }
      e.preventDefault()
    }
    document.addEventListener('touchmove', prevent, { passive: false })

    return () => {
      document.documentElement.style.overflow = 'hidden'
      document.body.style.overflow = 'hidden'
      document.removeEventListener('touchmove', prevent)
    }
  }, [])
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
function ExpenseModal({ onClose, onSave, editing }) {
  useModalScroll()
  const [amount, setAmount]   = useState(editing?.amount || '')
  const [cat, setCat]         = useState(editing?.category || 'eten')
  const [desc, setDesc]       = useState(editing?.description || '')
  const [date, setDate]       = useState(editing?.date || todayStr())

  const handleSave = () => {
    const n = parseFloat(String(amount).replace(',', '.'))
    if (!n || n <= 0) return
    onSave({ amount: n, category: cat, description: desc.trim(), date, is_savings_withdrawal: false })
  }

  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 480, background: 'var(--bg-sidebar)', borderRadius: '22px 22px 0 0', border: '1px solid var(--border)', borderBottom: 'none', padding: '20px 20px calc(24px + env(safe-area-inset-bottom))', animation: 'sheetUp 0.3s cubic-bezier(0.34,1.1,0.64,1)' }}>
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
              autoFocus type="number" inputMode="decimal" placeholder="0,00"
              value={amount} onChange={e => setAmount(e.target.value)}
              onFocus={scrollFix}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              style={{ width: '100%', padding: '14px 16px 14px 36px', borderRadius: 14, background: 'var(--bg-card-2)', border: '1px solid var(--border)', color: 'var(--text-1)', fontSize: 28, fontWeight: 700, colorScheme: 'dark' }}
            />
          </div>
        </div>

        {/* Category */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
          {CATEGORIES.map(c => (
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
  useModalScroll()
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  const handleSave = () => {
    const n = parseFloat(String(amount).replace(',', '.'))
    if (!n || n <= 0) return
    onSave({ amount: n, category: 'overig', description: reason.trim() || 'Spaargeld opname', date: todayStr(), is_savings_withdrawal: true, savings_reason: reason.trim() })
  }

  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 380, background: 'var(--bg-sidebar)', borderRadius: 22, border: '1px solid rgba(239,68,68,0.4)', padding: 24 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>⚠️</div>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: '#EF4444', margin: '0 0 6px' }}>Spaargeld afhalen</h3>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>Dit wordt bijgehouden. Zeker weten?</p>
        </div>

        <div style={{ position: 'relative', marginBottom: 12 }}>
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 20, fontWeight: 700, color: 'var(--text-3)' }}>€</span>
          <input autoFocus type="number" inputMode="decimal" placeholder="0,00" value={amount} onChange={e => setAmount(e.target.value)}
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

// ── Budget Settings Modal ─────────────────────────────────────────────────────
function BudgetModal({ config, onClose, onSave }) {
  useModalScroll()
  const [monthly, setMonthly] = useState(config?.monthly_budget || 400)
  const [cats, setCats] = useState(config?.category_budgets || DEFAULT_CAT_BUDGETS)

  const total = Object.values(cats).reduce((a, b) => a + Number(b), 0)

  return ReactDOM.createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
      {/* Backdrop */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)' }} onClick={onClose} />
      {/* Scrollable layer — separate from backdrop so iOS treats it as its own scroll container */}
      <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px 16px calc(32px + env(safe-area-inset-bottom))' }}>
      <div style={{ width: '100%', maxWidth: 420, background: 'var(--bg-sidebar)', borderRadius: 22, border: '1px solid var(--border)', padding: 24, position: 'relative', marginTop: 'auto', marginBottom: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>Budget instellen</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}><X size={18} /></button>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 8 }}>Maandbudget totaal</label>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: 'var(--text-3)' }}>€</span>
            <input type="number" value={monthly} onChange={e => setMonthly(+e.target.value)}
              onFocus={scrollFix}
              style={{ width: '100%', padding: '12px 14px 12px 30px', borderRadius: 12, background: 'var(--bg-card-2)', border: '1px solid var(--border)', color: 'var(--text-1)', fontSize: 20, fontWeight: 700, colorScheme: 'dark' }} />
          </div>
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

        <div style={{ padding: '10px 14px', borderRadius: 12, background: total > monthly ? 'rgba(239,68,68,0.08)' : 'rgba(0,255,209,0.06)', border: `1px solid ${total > monthly ? 'rgba(239,68,68,0.3)' : 'rgba(0,255,209,0.2)'}`, marginBottom: 18 }}>
          <span style={{ fontSize: 13, color: total > monthly ? '#EF4444' : 'var(--accent)' }}>
            {total > monthly ? `⚠️ Categorieën (${fmtShort(total)}) overschrijden maandbudget` : `✓ Categorieën: ${fmtShort(total)} van ${fmtShort(monthly)}`}
          </span>
        </div>

        <button onClick={() => onSave({ monthly_budget: monthly, category_budgets: cats })}
          style={{ width: '100%', padding: '14px', borderRadius: 14, background: 'var(--accent)', border: 'none', color: '#000', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
          Opslaan
        </button>
      </div>
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
  const [showSavings, setShowSavings] = useState(false)
  const [showBudget, setShowBudget]   = useState(false)
  const [editing, setEditing]         = useState(null)
  const [showAll, setShowAll]         = useState(false)

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
    setShowAdd(false); setShowSavings(false)
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

  // Derived stats
  const monthlyBudget  = config?.monthly_budget || 400
  const catBudgets     = config?.category_budgets || DEFAULT_CAT_BUDGETS
  const totalSpent     = expenses.filter(e => !e.is_savings_withdrawal).reduce((s, e) => s + Number(e.amount), 0)
  const remaining      = monthlyBudget - totalSpent
  const remainPct      = Math.max(0, Math.min(100, (remaining / monthlyBudget) * 100))
  const savingsWithdrawals = expenses.filter(e => e.is_savings_withdrawal)
  const savingsTotal   = savingsWithdrawals.reduce((s, e) => s + Number(e.amount), 0)

  const todayTotal = expenses.filter(e => !e.is_savings_withdrawal && e.date === todayStr())
    .reduce((s, e) => s + Number(e.amount), 0)

  const spentByCategory = {}
  for (const cat of CATEGORIES) {
    spentByCategory[cat.id] = expenses.filter(e => !e.is_savings_withdrawal && e.category === cat.id)
      .reduce((s, e) => s + Number(e.amount), 0)
  }

  const barColor = remainPct > 40 ? 'var(--accent)' : remainPct > 15 ? '#F59E0B' : '#EF4444'
  const regularExpenses = expenses.filter(e => !e.is_savings_withdrawal)
  const displayedExpenses = showAll ? regularExpenses : regularExpenses.slice(0, 8)

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
          <button onClick={() => setShowBudget(true)} style={{ padding: '8px 14px', borderRadius: 12, background: 'var(--bg-card-2)', border: '1px solid var(--border)', color: 'var(--text-2)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            Budget
          </button>
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
            <span>Budget: {fmt(monthlyBudget)}</span>
          </div>
        </div>

        {/* Quick stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div style={{ padding: '14px 16px', borderRadius: 16, background: 'var(--bg-card-2)', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>Vandaag</p>
            <p style={{ fontSize: 24, fontWeight: 700, margin: 0, color: todayTotal > 0 ? 'var(--text-1)' : 'var(--text-3)' }}>{fmt(todayTotal)}</p>
          </div>
          <div onClick={() => savingsWithdrawals.length > 0 && setShowAll(true)}
            style={{ padding: '14px 16px', borderRadius: 16, background: savingsWithdrawals.length > 0 ? 'rgba(239,68,68,0.08)' : 'var(--bg-card-2)', border: savingsWithdrawals.length > 0 ? '1px solid rgba(239,68,68,0.3)' : '1px solid var(--border)', cursor: savingsWithdrawals.length > 0 ? 'pointer' : 'default' }}>
            <p style={{ fontSize: 11, color: savingsWithdrawals.length > 0 ? '#EF4444' : 'var(--text-3)', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>💸 Spaargeld</p>
            <p style={{ fontSize: 24, fontWeight: 700, margin: 0, color: savingsWithdrawals.length > 0 ? '#EF4444' : 'var(--text-3)' }}>
              {savingsWithdrawals.length > 0 ? `${savingsWithdrawals.length}× ${fmtShort(savingsTotal)}` : '–'}
            </p>
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

        {/* Category envelopes */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 11, color: 'var(--text-3)', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Enveloppen</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {CATEGORIES.map(cat => {
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
                const cat = CATEGORIES.find(c => c.id === exp.category) || CATEGORIES[6]
                return (
                  <div key={exp.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 14, background: 'var(--bg-card-2)', border: '1px solid var(--border)' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${cat.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                      {cat.emoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {exp.description || cat.label}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0 }}>{exp.date}</p>
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 700, color: cat.color, flexShrink: 0 }}>{fmt(exp.amount)}</span>
                    <button onClick={() => { setEditing(exp); setShowAdd(true) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 4 }}>
                      <Pencil size={12} />
                    </button>
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
        <div style={{ display: 'flex', gap: 10, position: 'fixed', bottom: 'calc(70px + env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, padding: '0 16px', zIndex: 50 }}>
          <button onClick={() => { setShowSavings(true) }}
            style={{ flex: 1, padding: '14px', borderRadius: 16, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: '#EF4444', cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <TrendingDown size={16} /> Spaargeld af
          </button>
          <button onClick={() => { setEditing(null); setShowAdd(true) }}
            style={{ flex: 2, padding: '14px', borderRadius: 16, background: 'var(--accent)', border: 'none', color: '#000', cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Plus size={16} /> Uitgave toevoegen
          </button>
        </div>
      </div>

      {showAdd && (
        <ExpenseModal editing={editing} onClose={() => { setShowAdd(false); setEditing(null) }} onSave={saveExpense} />
      )}
      {showSavings && <SavingsModal onClose={() => setShowSavings(false)} onSave={saveExpense} />}
      {showBudget && <BudgetModal config={config} onClose={() => setShowBudget(false)} onSave={saveBudget} />}

      <style>{`@keyframes sheetUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </div>
  )
}
