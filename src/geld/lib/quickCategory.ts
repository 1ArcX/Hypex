import { supabase } from '../../supabaseClient'
import type { BankDetail } from '../store/geldStore'

// Categorie van een uitgave in één tik wijzigen (TransactionRow). Komt de uitgave van de bank, dan wordt
// de keuze onthouden voor die tegenpartij (budget_config.bank_rules), zodat de inbox hem voortaan voorstelt.

const ruleKey = (s: string | null) => String(s || '').toLowerCase().replace(/[0-9]+/g, ' ').replace(/[^a-zà-ÿ&.\- ]/g, ' ')
  .replace(/\s+/g, ' ').trim().split(' ').slice(0, 3).join(' ')

export async function setExpenseCategory(expenseId: string, category: string, bankTxs?: BankDetail[]) {
  const { error } = await supabase.from('expenses').update({ category }).eq('id', expenseId)
  if (error) throw new Error(error.message)
  // Alleen bij één banktransactie: bij een samengestelde invoer is niet duidelijk welke winkel bedoeld is
  if (bankTxs?.length === 1) {
    const key = ruleKey(bankTxs[0].counterparty)
    if (!key) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: cfg } = await supabase.from('budget_config').select('bank_rules').eq('user_id', user.id).maybeSingle()
    if (cfg) await supabase.from('budget_config')
      .update({ bank_rules: { ...((cfg as { bank_rules?: Record<string, string> }).bank_rules || {}), [key]: category } })
      .eq('user_id', user.id)
  }
}
