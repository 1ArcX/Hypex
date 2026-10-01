// Geplande sync van gekoppelde agenda's (Google / MijnX-feed), ook als niemand de app open heeft.
// Schema in netlify.toml. De logica staat in ../calendar/calendar.js (syncAll).
const { syncAll } = require('../calendar/calendar')

exports.handler = async () => {
  try {
    const results = await syncAll()
    const synced = results.filter(r => r.count !== null && !r.error).length
    const failed = results.filter(r => r.error).length
    console.log(`[calendar-sync] ${results.length} koppelingen: ${synced} bijgewerkt, ${failed} fout`)
    return { statusCode: 200, body: JSON.stringify({ synced, failed }) }
  } catch (e) {
    console.error('[calendar-sync]', e)
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) }
  }
}
