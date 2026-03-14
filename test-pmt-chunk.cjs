const fetch = require('node-fetch')
const BASE = 'https://jumbo7044.personeelstool.nl'

async function main() {
  const chunks = ['MyDepartmentSchedulePage-CrAPerxW.js', 'useScheduleStore-CuW1a5Mp.js']
  for (const chunk of chunks) {
    const res = await fetch(BASE + '/media/js/' + chunk, { timeout: 15000 })
    const js = await res.text()
    console.log('\n=== ' + chunk + ' (' + js.length + ' chars) ===')

    // Alle strings die /api/ bevatten
    const apiStrings = []
    const re = /["'`]([^"'`\n]{3,120})["'`]/g
    let m
    while ((m = re.exec(js)) !== null) {
      if (m[1].includes('/api/') || m[1].includes('shift') || m[1].includes('schedule')) {
        apiStrings.push(m[1])
      }
    }
    const unique = [...new Set(apiStrings)].filter(s => !s.includes('stylesheet') && !s.includes('media/'))
    unique.slice(0, 30).forEach(s => console.log(' ', s))

    // Zoek specifieke calls
    for (const kw of ['shifts', 'schedules', 'employees', 'department', 'planning']) {
      let idx = 0
      while (true) {
        idx = js.indexOf(kw, idx + 1)
        if (idx === -1 || idx > 11000) break
        const ctx = js.slice(Math.max(0, idx-60), idx+120)
        if (ctx.includes('api') || ctx.includes('get(') || ctx.includes('fetch')) {
          console.log('\n[' + kw + ' @' + idx + ']', ctx)
          break
        }
      }
    }
  }
}
main().catch(e => console.error(e.message))
