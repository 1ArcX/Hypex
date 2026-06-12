import { r2, rd5 } from './format'

// Lening van jezelf kost 10% rente bij terugstorten
export const LOAN_INTEREST_RATE = 0.1

export function loanInterest(principal: number): number {
  return +(Number(principal) * LOAN_INTEREST_RATE).toFixed(2)
}

export function loanTotalWithInterest(principal: number): number {
  return Number(principal) + loanInterest(principal)
}

export interface SavingsAdviceArgs {
  balance: number // huidig saldo hoofdrekening
  hasBalance: boolean // is het saldo-veld ingevuld?
  adjustedBase: number // budget dat op de hoofdrekening moet blijven
  savingsGoal: number
  alreadySavedThisMonth: number
  totalLoanRemaining: number
}

export interface SavingsAdvice {
  transferable: number
  savNeeded: number
  toSavings: number
  toLoan: number
  balAfter: number | null
}

// Adviesverdeling bij inkomen: eerst spaardoel aanvullen, daarna lening
// aflossen — beide afgerond naar beneden op €5
export function calcSavingsAdvice(args: SavingsAdviceArgs): SavingsAdvice {
  const { balance, hasBalance, adjustedBase, savingsGoal, alreadySavedThisMonth, totalLoanRemaining } = args
  const transferable = hasBalance ? r2(Math.max(0, balance - adjustedBase)) : 0
  const savNeeded    = r2(Math.max(0, savingsGoal - alreadySavedThisMonth))
  const toSavings    = rd5(Math.min(transferable, savNeeded))
  const toLoan       = rd5(totalLoanRemaining > 0 ? Math.min(Math.max(0, transferable - toSavings), totalLoanRemaining) : 0)
  const balAfter     = hasBalance ? r2(balance - toSavings - toLoan) : null
  return { transferable, savNeeded, toSavings, toLoan, balAfter }
}
