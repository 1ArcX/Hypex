import { supabase } from '../supabaseClient'

export const VAPID_PUBLIC = 'BCsu1QaHUead0cgQ23qUKIu3_MnSi0s21LaD_c9wBcqdP43A9ojEx-nWZ4_xUDYLVMQn0CqzqdhSuLQr6eOQqh4'

export function urlBase64ToUint8Array(b64) {
  const pad = '='.repeat((4 - b64.length % 4) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

/** Returns whether push is technically supported on this browser/device */
export function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && typeof Notification !== 'undefined'
}

/**
 * Requests notification permission (if not yet granted), then subscribes
 * and saves/updates the subscription in Supabase.
 * Returns 'granted' | 'denied' | 'unsupported' | 'error'
 */
export async function requestAndSubscribe(userId) {
  if (!pushSupported()) return 'unsupported'
  if (!userId) return 'error'

  // Request permission — must be called from a user gesture
  let permission = Notification.permission
  if (permission === 'default') {
    permission = await Notification.requestPermission()
  }
  if (permission !== 'granted') return 'denied'

  try {
    const reg = await navigator.serviceWorker.ready

    // Use existing subscription if still valid; create new one if iOS revoked it
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      })
    }
    const subJson = sub.toJSON()

    const { data: rows } = await supabase
      .from('push_subscriptions')
      .select('id, vracht_enabled, vracht_notify_stops')
      .eq('user_id', userId)

    if (rows && rows.length > 0) {
      const row = rows[0]
      const update = { subscription: subJson }
      if (row.vracht_notify_stops?.length) update.vracht_enabled = true
      await supabase.from('push_subscriptions').update(update).eq('id', row.id)
      if (rows.length > 1) {
        await supabase.from('push_subscriptions').delete().in('id', rows.slice(1).map(r => r.id))
      }
    } else {
      await supabase.from('push_subscriptions').insert({ user_id: userId, subscription: subJson })
    }
    return 'granted'
  } catch (e) {
    console.error('Push subscribe failed:', e)
    return 'error'
  }
}
