import { supabase } from '../supabaseClient'

export const XP_TASK = 5
export const XP_POMODORO = 15 // per focus session

function loadXP() {
  try { return parseInt(localStorage.getItem('habit_xp') || '0') } catch { return 0 }
}
function saveXP(xp) {
  localStorage.setItem('habit_xp', String(Math.max(0, xp)))
}

export async function awardXP(userId, delta) {
  if (!delta) return
  const current = loadXP()
  const next = Math.max(0, current + delta)
  saveXP(next)

  if (!userId) return
  try {
    // Read existing cloud record first so we don't overwrite seen_achievements / perfect_days
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

    // Also keep localStorage in sync with cloud
    saveXP(newXp)
  } catch {}
}
