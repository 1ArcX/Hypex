// Datamodellen voor de geld-sectie. Sluit 1-op-1 aan op de bestaande
// Supabase-tabellen "expenses" en "budget_config" — geen migraties nodig.

export interface Expense {
  id: string
  user_id?: string
  amount: number
  category: string
  description: string | null
  date: string // YYYY-MM-DD
  created_at?: string
  is_income?: boolean
  is_savings_withdrawal?: boolean
  is_savings_contribution?: boolean
  is_loan_repayment?: boolean
  paid_from_savings?: boolean
  is_planned?: boolean
  savings_type?: 'saved' | 'loan' | null
  repaid?: boolean
}

// Payload voor insert/update — id en user_id worden door de hook gezet
export type ExpenseInput = Partial<Omit<Expense, 'id' | 'user_id' | 'created_at'>> & {
  amount: number
  category: string
  date: string
}

export interface CategoryConfig {
  id: string
  label: string
  emoji: string
  color: string
}

export interface IncomeCategory {
  id: string
  label: string
  emoji: string
}

export interface RecurringSource {
  id: string
  name: string
  emoji: string
  amount: number
  type: 'monthly' | 'interval'
  day?: number // type 'monthly': dag van de maand
  interval_days?: number // type 'interval': elke N dagen
  ref_date?: string // type 'interval': laatste betaaldatum
  category?: string // inkomenscategorie, default 'salaris'
}

export interface VacationEntry {
  start: string
  end: string
  budget?: number
}

export interface BudgetConfig {
  user_id?: string
  monthly_budget: number
  category_budgets: Record<string, number>
  custom_categories?: CategoryConfig[]
  savings_goal?: number
  min_balance?: number
  recovery_months?: number
  vacation_mode?: boolean
  vacation_budget?: number
  vacation_start?: string | null
  vacation_end?: string | null
  vacation_history?: VacationEntry[]
  recurring_income?: RecurringSource[]
  // per datum (YYYY-MM-DD) de ids van bevestigde recurring-bronnen
  income_confirmed_dates?: Record<string, string[]>
  // per maand (YYYY-MM) een extra bedrag dat alleen die maand geldt (+ of −)
  month_adjustments?: Record<string, number>
  updated_at?: string
}

// Velden die de budget-instellingen-modal opslaat
export interface BudgetConfigInput {
  monthly_budget: number
  category_budgets: Record<string, number>
  custom_categories: CategoryConfig[]
  savings_goal: number
  min_balance: number
  recovery_months: number
  vacation_mode: boolean
  vacation_budget: number
  vacation_start: string | null
  vacation_end: string | null
  month_adjustments?: Record<string, number>
}
