import { supabase } from '../supabaseClient'

export const XP_TASK = 5

function loadXP() {
  try { return parseInt(localStorage.getItem('habit_xp') || '0') } catch { return 0 }
}
function saveXP(xp) {
  localStorage.setItem('habit_xp', String(Math.max(0, xp)))
}
function getLevel(xp) { return Math.floor(xp / 100) + 1 }

// Returns { leveledUp, newLevel, oldLevel }
export async function awardXP(userId, delta) {
  if (!delta) return { leveledUp: false }
  const current = loadXP()
  const next = Math.max(0, current + delta)
  const oldLevel = getLevel(current)
  const newLevel = getLevel(next)
  saveXP(next)

  const leveledUp = newLevel > oldLevel
  if (leveledUp) {
    localStorage.setItem('levelup_pending', JSON.stringify({ newLevel, oldLevel }))
    window.dispatchEvent(new Event('levelup'))
  }

  if (!userId) return { leveledUp, newLevel, oldLevel }
  try {
    const { data } = await supabase.from('habit_achievements')
      .select('xp, seen_achievements, perfect_days').eq('user_id', userId).single()

    const cloudXp = data?.xp ?? current
    const newXp = Math.max(0, cloudXp + delta)

    await supabase.from('habit_achievements').upsert({
      user_id: userId,
      xp: newXp,
      seen_achievements: data?.seen_achievements ?? [],
      perfect_days: data?.perfect_days ?? [],
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    supabase.from('profiles').update({ xp: newXp }).eq('id', userId).then(() => {})
    saveXP(newXp)
  } catch {}

  return { leveledUp, newLevel, oldLevel }
}
