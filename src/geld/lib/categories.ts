import type { CategoryConfig, IncomeCategory } from '../types'

export const CATEGORIES: CategoryConfig[] = [
  { id: 'eten',          label: 'Eten & drinken', emoji: '🍔', color: '#F97316' },
  { id: 'boodschappen',  label: 'Boodschappen',   emoji: '🛒', color: '#10B981' },
  { id: 'transport',     label: 'Transport',       emoji: '🚌', color: '#3B82F6' },
  { id: 'kleding',       label: 'Kleding',         emoji: '👕', color: '#8B5CF6' },
  { id: 'abonnementen',  label: 'Vaste lasten',     emoji: '🏠', color: '#EC4899' },
  { id: 'sport',         label: 'Sport',           emoji: '⚽', color: '#FACC15' },
  { id: 'overig',        label: 'Overig',          emoji: '💸', color: '#94A3B8' },
]

export const INCOME_CATEGORIES: IncomeCategory[] = [
  { id: 'salaris',   label: 'Salaris',   emoji: '💼' },
  { id: 'bijbaan',   label: 'Bijbaan',   emoji: '🏪' },
  { id: 'freelance', label: 'Freelance', emoji: '💻' },
  { id: 'zakgeld',   label: 'Zakgeld',   emoji: '🎁' },
  { id: 'overig',    label: 'Overig',    emoji: '💰' },
]

export const DEFAULT_CAT_BUDGETS: Record<string, number> = {
  eten: 120, boodschappen: 80, transport: 40,
  kleding: 50, abonnementen: 30, sport: 20, overig: 60,
}

// Vaste lasten staan buiten het vrije budget
export const FIXED_CAT = 'abonnementen'

export const CAT_COLORS = ['#F97316','#EF4444','#10B981','#3B82F6','#8B5CF6','#EC4899','#FACC15','#06B6D4','#84CC16','#94A3B8','#FB923C','#A3E635']
export const CAT_EMOJIS = ['🎮','🎸','✈️','🍕','🧴','📚','🐾','🎁','🏋️','💊','🎨','🛒','🚗','🎬','☕','🧹','🏠','💡','🔧','🎓']
export const REC_EMOJIS = ['💼','🏪','🏥','🎓','💰','🏦','💻','🎁','🏠','📦']

export function findCategory(allCategories: CategoryConfig[], id: string): CategoryConfig {
  return allCategories.find(c => c.id === id) || CATEGORIES[6]
}

export function findIncomeCategory(id: string): IncomeCategory {
  return INCOME_CATEGORIES.find(c => c.id === id) || INCOME_CATEGORIES[4]
}
