// Terugkeer uit de bank-autorisatie (Enable Banking → /geld/bank-callback?code=…&state=…).
// App.jsx roept dit bij het laden aan: code bewaren, URL opruimen en de Geld-pagina openen.
// De Geld-app (src/geld/hooks/useBank.ts) handelt de bewaarde code daarna af.
export const BANK_CALLBACK_KEY = 'bank_callback'

export function captureBankCallback() {
  if (typeof window === 'undefined' || !window.location.pathname.startsWith('/geld/bank-callback')) return false
  const p = new URLSearchParams(window.location.search)
  try { sessionStorage.setItem(BANK_CALLBACK_KEY, JSON.stringify({ code: p.get('code'), state: p.get('state'), error: p.get('error') })) } catch { /* privémodus */ }
  window.history.replaceState(null, '', '/')
  return true
}
