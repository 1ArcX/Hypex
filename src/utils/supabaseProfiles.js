// src/utils/supabaseProfiles.js
import { supabase } from '../supabaseClient'

export async function saveProfile(userId, data) {
  if (!userId) throw new Error('Geen userId')

  // Probeer eerst te updaten
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single()

  if (existing) {
    const { error } = await supabase
      .from('profiles')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', userId)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('profiles')
      .insert({ id: userId, ...data, updated_at: new Date().toISOString() })
    if (error) throw error
  }
}