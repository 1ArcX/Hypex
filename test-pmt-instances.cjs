const fetch = require('node-fetch')
const BASE = 'https://jumbo7044.personeelstool.nl'
const H = { 'x-api-context': 'PfqzYJeZX8mp1ewJb9MCFfHOkiXvLEUq', 'Content-Type': 'application/json', 'Accept': 'application/json' }

async function login() {
  const res = await fetch(BASE + '/pmtLoginSso?subdomain=jumbo7044', {
    method: 'POST', headers: H, timeout: 10000,
    body: JSON.stringify({ username: 'Fachri.zhafir', password: '5499@84418938FZP@@s3i08?', browser_info: { os_name: 'Windows 10.0', browser_name: 'Chrome', browser_version: 120, screen_resolution: '1920x1080' } })
  })
  const r = (await res.json()).result
  return { token: r.user_token, accountId: r.account_id, storeId: r.store_id, h: { ...H, 'x-api-user': r.user_token } }
}

async function main() {
  const { h, storeId, accountId } = await login()
  const date = '2026-03-13'

  const deptRes = await fetch(BASE + '/api/v2/departments?date=' + date, { headers: h, timeout: 10000 })
  const depts = (await deptRes.json()).result || []
  const deptIds = depts.map(d => d.department_id).join(',')
  const deptMap = {}
  depts.forEach(d => { deptMap[d.department_id] = d.department_name })

  // Eigen shifts ook
  const myQs = new URLSearchParams({ date, account_id: accountId }).toString()
  const myRes = await fetch(BASE + '/api/v2/shifts?' + myQs, { headers: h, timeout: 10000 })
  const myShifts = ((await myRes.json()).result || []).filter(s => s.start_datetime && s.start_datetime.startsWith(date))

  // Collega shifts
  const qs = new URLSearchParams({ date, ignore_lent_out: true, 'account_id[neq]': accountId, department_id: deptIds }).toString()
  const res = await fetch(BASE + '/api/v2/shifts?' + qs, { headers: h, timeout: 10000 })
  const shifts = ((await res.json()).result || []).filter(s => s.start_datetime && s.start_datetime.startsWith(date))

  const all = [...myShifts, ...shifts]
  console.log('Totaal shifts:', all.length)
  console.log('Totaal instances:')

  // Gebruik instances zoals de app dat doet (combineDayScheduleData)
  const peopleMap = {}
  for (const shift of all) {
    const insts = shift.instances || []
    if (insts.length === 0) {
      // Geen instance, gebruik shift zelf
      const key = String(shift.account_id)
      if (!peopleMap[key]) peopleMap[key] = { accountId: shift.account_id, shifts: [], instKeys: [] }
      peopleMap[key].shifts.push({ start: shift.start_datetime.slice(11,16), end: shift.end_datetime.slice(11,16), dept: shift.department_id })
    } else {
      for (const inst of insts) {
        const key = String(inst.account_id)
        if (!peopleMap[key]) peopleMap[key] = { accountId: inst.account_id, name: inst.employeeName || inst.employee_name || inst.name, shifts: [], instKeys: Object.keys(inst) }
        peopleMap[key].shifts.push({ start: inst.start_datetime.slice(11,16), end: inst.end_datetime.slice(11,16), dept: inst.department_id, status: inst.status })
      }
    }
  }

  // Haal namen op via employees
  const empRes = await fetch(BASE + '/api/v2/stores/' + storeId + '/employees?exchange=true&week=2026-11&limit=10000', { headers: h, timeout: 10000 })
  const empMap = {}
  for (const e of ((await empRes.json()).result || [])) empMap[String(e.account_id)] = e.name

  // Log resultaat
  console.log('\nMensen via instances aanpak:', Object.keys(peopleMap).length)
  const people = Object.values(peopleMap).sort((a,b) => (a.shifts[0]?.start || '').localeCompare(b.shifts[0]?.start || ''))
  people.forEach(p => {
    const naam = p.name || empMap[String(p.accountId)] || '(id:' + p.accountId + ')'
    const dept102Shifts = p.shifts.filter(s => s.dept === 102)
    if (dept102Shifts.length > 0) {
      console.log(' ', naam.padEnd(30), '|', dept102Shifts.map(s => s.start + '-' + s.end).join(', '), '| Goederenverwerking')
    }
  })
  console.log('\nGoederenverwerking totaal:', people.filter(p => p.shifts.some(s => s.dept === 102)).length)

  // Log ook instance keys van eerste shift
  if (shifts[0] && shifts[0].instances[0]) {
    console.log('\nInstance keys:', Object.keys(shifts[0].instances[0]))
    console.log('Instance voorbeeld:', JSON.stringify(shifts[0].instances[0], null, 2))
  }
}
main().catch(e => console.error('FATAL:', e.message))
