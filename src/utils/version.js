// Gedeelde check op /version.json (App + VersionChecker): één request per minuut,
// ook als meerdere componenten tegelijk vragen.
let cache = null // { at, promise }

export function fetchLatestVersion() {
  if (cache && Date.now() - cache.at < 60 * 1000) return cache.promise
  const promise = fetch('/version.json?t=' + Date.now())
    .then(r => (r.ok ? r.json() : null))
    .then(d => d?.t ?? null)
    .catch(() => null)
  cache = { at: Date.now(), promise }
  return promise
}
