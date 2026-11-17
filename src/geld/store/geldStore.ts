import { create } from 'zustand'

export type GeldTab = 'home' | 'enveloppen' | 'jaar'

interface GeldStore {
  activeTab: GeldTab
  setActiveTab: (tab: GeldTab) => void

  // Geselecteerde maand (m is 0-based); navigeren kan niet voorbij de huidige maand
  selYear: number
  selMonth: number
  goToPrevMonth: () => void
  goToNextMonth: () => void

  // Zoeken als slide-up sheet vanuit Home
  searchOpen: boolean
  setSearchOpen: (open: boolean) => void
  searchQuery: string
  setSearchQuery: (q: string) => void

  // Banktransacties (ING) per uitgave-id, gevuld door useBank — TransactionRow toont daarmee de bankgegevens
  bankByExpense: Record<string, BankDetail[]>
  setBankByExpense: (m: Record<string, BankDetail[]>) => void

  // Wordt opgehoogd na elke mutatie zodat alle data-hooks refetchen
  refreshKey: number
  refresh: () => void
}

export interface BankDetail {
  id: string; booking_date: string; amount: number; counterparty: string | null
  counterparty_iban: string | null; description: string | null; account_name?: string | null
}

const now = new Date()

export const useGeldStore = create<GeldStore>((set) => ({
  activeTab: 'home',
  setActiveTab: (tab) => set({ activeTab: tab }),

  selYear: now.getFullYear(),
  selMonth: now.getMonth(),
  goToPrevMonth: () => set((s) =>
    s.selMonth === 0
      ? { selYear: s.selYear - 1, selMonth: 11 }
      : { selMonth: s.selMonth - 1 }
  ),
  goToNextMonth: () => set((s) => {
    const d = new Date()
    const nowY = d.getFullYear(), nowM = d.getMonth()
    if (s.selYear > nowY || (s.selYear === nowY && s.selMonth >= nowM)) return s
    return s.selMonth === 11
      ? { selYear: s.selYear + 1, selMonth: 0 }
      : { selMonth: s.selMonth + 1 }
  }),

  searchOpen: false,
  setSearchOpen: (open) => set({ searchOpen: open, ...(open ? {} : { searchQuery: '' }) }),
  searchQuery: '',
  setSearchQuery: (q) => set({ searchQuery: q }),

  bankByExpense: {},
  setBankByExpense: (m) => set({ bankByExpense: m }),

  refreshKey: 0,
  refresh: () => set((s) => ({ refreshKey: s.refreshKey + 1 })),
}))
