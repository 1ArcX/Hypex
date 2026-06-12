import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useGeldStore } from './store/geldStore'
import { useMonthNav } from './hooks/useMonthNav'
import { useExpenses } from './hooks/useExpenses'
import { useBudgetConfig } from './hooks/useBudgetConfig'
import { useRecurringIncome } from './hooks/useRecurringIncome'
import { useSavingsData } from './hooks/useSavingsData'
import { useYearExpenses } from './hooks/useYearExpenses'
import { useBudgetStats } from './hooks/useBudgetStats'
import { TabBar } from './components/TabBar'
import { ActionSheet, type GeldAction } from './components/ActionSheet'
import { Spinner } from './components/ui/Glass'
import { HomeView } from './views/HomeView'
import { EnveloppenView } from './views/EnveloppenView'
import { JaarView } from './views/JaarView'
import { SearchSheet } from './sheets/SearchSheet'
import { AnalyseSheet } from './sheets/AnalyseSheet'
import { InkomstenSheet } from './sheets/InkomstenSheet'
import { UitgavenSheet } from './sheets/UitgavenSheet'
import { ExpenseModal } from './modals/ExpenseModal'
import { SavingsModal } from './modals/SavingsModal'
import { BudgetModal } from './modals/BudgetModal'
import { RecurringIncomeModal } from './modals/RecurringIncomeModal'
import { IncomeDayModal } from './modals/IncomeDayModal'
import type { Expense, ExpenseInput, RecurringSource } from './types'
import { monthEndOf, todayStr } from './lib/format'

export default function GeldPage({ userId }: { userId: string; onClose?: () => void }) {
  const activeTab = useGeldStore(s => s.activeTab)
  const searchOpen = useGeldStore(s => s.searchOpen)
  const setSearchOpen = useGeldStore(s => s.setSearchOpen)
  const refresh = useGeldStore(s => s.refresh)
  const { selYear, selMonth, isCurrentMonth } = useMonthNav()

  // Data
  const { expenses, prevExpenses, loading: expensesLoading, deleteExpense } = useExpenses(userId)
  const { config, loading: configLoading, saveBudget } = useBudgetConfig(userId)
  const { pendingIncomeSource, saveRecurringIncome, confirmIncomeToday } = useRecurringIncome(userId, config, isCurrentMonth)
  const savings = useSavingsData(userId)
  const { yearExpenses } = useYearExpenses(userId)
  const stats = useBudgetStats({ expenses, prevExpenses, yearExpenses, config })

  // UI-state (modals & sheets)
  const [actionOpen, setActionOpen] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showPlanned, setShowPlanned] = useState(false)
  const [showIncome, setShowIncome] = useState(false)
  const [showSavings, setShowSavings] = useState(false)
  const [showBudget, setShowBudget] = useState(false)
  const [showRecurring, setShowRecurring] = useState(false)
  const [showAnalyse, setShowAnalyse] = useState(false)
  const [showInkomsten, setShowInkomsten] = useState(false)
  const [showUitgaven, setShowUitgaven] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [editingSavings, setEditingSavings] = useState<Expense | null>(null)
  const [showEarlyIncome, setShowEarlyIncome] = useState<RecurringSource | null>(null)
  const [incomeDone, setIncomeDone] = useState(false)

  const saveExpense = async (data: ExpenseInput) => {
    if (editing) {
      await supabase.from('expenses').update(data).eq('id', editing.id)
      setEditing(null)
    } else {
      await supabase.from('expenses').insert({ ...data, user_id: userId })
    }
    setShowAdd(false)
    setShowPlanned(false)
    refresh()
  }

  const openEdit = (exp: Expense) => { setEditing(exp); setShowAdd(true) }

  const handleAction = (action: GeldAction) => {
    setActionOpen(false)
    if (action === 'expense') { setEditing(null); setShowAdd(true) }
    if (action === 'planned') setShowPlanned(true)
    if (action === 'income') setShowIncome(true)
    if (action === 'savings') { setEditingSavings(null); setShowSavings(true) }
  }

  if (expensesLoading || configLoading) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <Spinner />
      </div>
    )
  }

  const defaultDate = isCurrentMonth ? undefined : monthEndOf(selYear, selMonth)
  const minBalance = stats.minBalance

  return (
    <div className="h-full relative overflow-hidden"
      style={{ background: 'radial-gradient(1100px 500px at 80% -10%, rgba(45,212,191,0.07), transparent 60%), radial-gradient(900px 500px at -10% 100%, rgba(52,211,153,0.05), transparent 55%), #0b0b0f' }}>
      <div className="h-full overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="max-w-[480px] mx-auto px-4 pt-5" style={{ paddingBottom: 'calc(110px + env(safe-area-inset-bottom))' }}>
          {activeTab === 'home' && (
            <HomeView stats={stats} isCurrentMonth={isCurrentMonth}
              remainingLoan={savings.remainingLoan} openLoansCount={savings.openLoans.length}
              onOpenBudget={() => setShowBudget(true)}
              onOpenAnalyse={() => setShowAnalyse(true)}
              onOpenInkomsten={() => setShowInkomsten(true)}
              onOpenUitgaven={() => setShowUitgaven(true)}
              onEdit={openEdit} onDelete={deleteExpense} />
          )}
          {activeTab === 'enveloppen' && (
            <EnveloppenView stats={stats} onOpenBudget={() => setShowBudget(true)} />
          )}
          {activeTab === 'jaar' && (
            <JaarView stats={stats} yearExpenses={yearExpenses} config={config} />
          )}
        </div>
      </div>

      <TabBar onAdd={() => setActionOpen(true)} />

      {/* Sheets */}
      {actionOpen && <ActionSheet onClose={() => setActionOpen(false)} onAction={handleAction} />}
      {searchOpen && (
        <SearchSheet userId={userId} allCategories={stats.allCategories}
          onClose={() => setSearchOpen(false)} onEdit={openEdit} onDelete={deleteExpense} />
      )}
      {showAnalyse && <AnalyseSheet stats={stats} onClose={() => setShowAnalyse(false)} />}
      {showInkomsten && (
        <InkomstenSheet stats={stats} savings={savings} userId={userId} isCurrentMonth={isCurrentMonth}
          onClose={() => setShowInkomsten(false)}
          onManageRecurring={() => setShowRecurring(true)}
          onEarlyIncome={src => setShowEarlyIncome(src)}
          onAddIncome={() => setShowIncome(true)}
          onEditSavings={exp => { setEditingSavings(exp); setShowSavings(true) }}
          onDelete={deleteExpense} />
      )}
      {showUitgaven && (
        <UitgavenSheet stats={stats} onClose={() => setShowUitgaven(false)}
          onEdit={openEdit} onDelete={deleteExpense} onPlan={() => setShowPlanned(true)} />
      )}

      {/* Modals */}
      {showAdd && (
        <ExpenseModal editing={editing} defaultDate={defaultDate} categories={stats.allCategories}
          onClose={() => { setShowAdd(false); setEditing(null) }} onSave={saveExpense} />
      )}
      {showPlanned && (
        <ExpenseModal plannedMode defaultDate={defaultDate} categories={stats.allCategories}
          onClose={() => setShowPlanned(false)} onSave={saveExpense} />
      )}
      {showIncome && (
        <IncomeDayModal source={null}
          defaultDate={isCurrentMonth ? todayStr() : monthEndOf(selYear, selMonth)}
          adjustedBase={minBalance} savingsGoal={stats.savingsGoal}
          alreadySavedThisMonth={savings.alreadySavedThisMonth} totalLoanRemaining={savings.remainingLoan}
          userId={userId}
          onLater={() => setShowIncome(false)}
          onDone={() => { setShowIncome(false); refresh() }} />
      )}
      {showSavings && (
        <SavingsModal editing={editingSavings}
          onClose={() => { setShowSavings(false); setEditingSavings(null) }}
          onSave={async (data) => {
            if (editingSavings) {
              await supabase.from('expenses').update(data).eq('id', editingSavings.id)
              setEditingSavings(null)
              setShowSavings(false)
              refresh()
            } else {
              await supabase.from('expenses').insert({ ...data, user_id: userId })
              setShowSavings(false)
              refresh()
            }
          }} />
      )}
      {showBudget && (
        <BudgetModal config={config} onClose={() => setShowBudget(false)}
          onSave={async (data) => { await saveBudget(data); setShowBudget(false) }} />
      )}
      {showRecurring && (
        <RecurringIncomeModal config={config} onClose={() => setShowRecurring(false)}
          onSave={saveRecurringIncome} />
      )}
      {showEarlyIncome && (
        <IncomeDayModal source={showEarlyIncome} defaultDate={todayStr()}
          adjustedBase={minBalance} savingsGoal={stats.savingsGoal}
          alreadySavedThisMonth={savings.alreadySavedThisMonth} totalLoanRemaining={savings.remainingLoan}
          userId={userId}
          onLater={() => setShowEarlyIncome(null)}
          onDone={() => { setShowEarlyIncome(null); refresh() }} />
      )}
      {pendingIncomeSource && !incomeDone && (
        <IncomeDayModal source={pendingIncomeSource}
          adjustedBase={minBalance} savingsGoal={stats.savingsGoal}
          alreadySavedThisMonth={savings.alreadySavedThisMonth} totalLoanRemaining={savings.remainingLoan}
          userId={userId}
          onLater={() => setIncomeDone(true)}
          onDone={async () => {
            setIncomeDone(true)
            await confirmIncomeToday(pendingIncomeSource.id)
          }} />
      )}

      <style>{`@keyframes geldSheetUp { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </div>
  )
}
