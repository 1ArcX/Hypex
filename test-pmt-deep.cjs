const fetch = require('node-fetch')
const BASE = 'https://jumbo7044.personeelstool.nl'
const H = { 'x-api-context': 'PfqzYJeZX8mp1ewJb9MCFfHOkiXvLEUq', 'Content-Type': 'application/json', 'Accept': 'application/json' }

async function login() {
  const res = await fetch(BASE + '/pmtLoginSso?subdomain=jumbo7044', {
    method: 'POST', headers: H, timeout: 10000,
    body: JSON.stringify({ username: 'Fachri.Zhafir', password: '5499@84418938FZP@@s3i08?', browser_info: { os_name: 'Windows 10.0', browser_name: 'Chrome', browser_version: 120, screen_resolution: '1920x1080' } })
  })
  const r = (await res.json()).result
  return { token: r.user_token, accountId: r.account_id, storeId: r.store_id, h: { ...H, 'x-api-user': r.user_token } }
}

async function main() {
  const { h, accountId, storeId } = await login()
  console.log('accountId:', accountId, 'storeId:', storeId)

  // 1. Eigen profiel via employees
  console.log('\n=== 1. EIGEN PROFIEL (/api/v2/employees?account_id=) ===')
  const empRes = await fetch(BASE + `/api/v2/employees?account_id=${accountId}`, { headers: h })
  const emp = (await empRes.json()).result?.[0]
  console.log(JSON.stringify(emp, null, 2))

  // 2. Contract
  console.log('\n=== 2. CONTRACT (/api/v2/contracts?account_id=) ===')
  const contRes = await fetch(BASE + `/api/v2/contracts?account_id=${accountId}`, { headers: h })
  const cont = (await contRes.json()).result
  console.log(JSON.stringify(cont, null, 2))

  // 3. Vestiging info via stores lijst
  console.log('\n=== 3. VESTIGING (/api/v2/stores) ===')
  const storesRes = await fetch(BASE + `/api/v2/stores`, { headers: h })
  const stores = (await storesRes.json()).result
  console.log(JSON.stringify(stores, null, 2))

  // 4. Afdelingen via store (meer details)
  console.log('\n=== 4. AFDELINGEN VIA STORE (/api/v2/stores/287/departments) ===')
  const deptStoreRes = await fetch(BASE + `/api/v2/stores/${storeId}/departments`, { headers: h })
  const deptStore = (await deptStoreRes.json()).result
  deptStore?.forEach(d => console.log(`  dept_id: ${d.department_id} | ${d.department_name} | ${d.department_shortname || ''} | color: ${d.color}`))

  // 5. Nieuws — eerste 3 berichten volledig
  console.log('\n=== 5. NIEUWS (eerste 3) ===')
  const newsRes = await fetch(BASE + `/api/v2/news`, { headers: h })
  const news = (await newsRes.json()).result?.slice(0, 3)
  news?.forEach(n => {
    console.log(`\n  [${n.news_id}] ${n.news_title}`)
    console.log(`  Datum: ${n.created_at || n.date || '?'}`)
    console.log(`  Tekst: ${(n.news_body || n.news_text || n.news_title_text || '').slice(0, 200)}`)
  })

  // 6. Definitief rooster voor heel maart (eigen)
  console.log('\n=== 6. ROOSTER MAART (eigen) ===')
  const schedRes = await fetch(BASE + `/api/v2/schedules?date[gte]=2026-03-01&date[lte]=2026-03-31&account_id=${accountId}`, { headers: h })
  const sched = (await schedRes.json()).result
  sched?.forEach(s => {
    const dept = s.department?.department_name || s.department_id || '?'
    console.log(`  ${s.schedule_time_from?.slice(0,10)} | ${s.schedule_time_from?.slice(11,16)} - ${s.schedule_time_to?.slice(11,16)} | ${dept} | pauze: ${s.break}`)
  })

  // 7. Rooster toekomstige weken
  console.log('\n=== 7. ROOSTER KOMENDE 4 WEKEN ===')
  const futureRes = await fetch(BASE + `/api/v2/schedules?date[gte]=2026-03-15&date[lte]=2026-04-15&account_id=${accountId}`, { headers: h })
  const future = (await futureRes.json()).result
  console.log('Shifts gevonden:', future?.length)
  future?.forEach(s => {
    const dept = s.department?.department_name || s.department_id || '?'
    console.log(`  ${s.schedule_time_from?.slice(0,10)} | ${s.schedule_time_from?.slice(11,16)} - ${s.schedule_time_to?.slice(11,16)} | ${dept}`)
  })

  // 8. Shifts voor heel maand (alle collega's)
  console.log('\n=== 8. ALLE SHIFTS WEEK 12 (17-23 mrt) ===')
  const allShiftsRes = await fetch(BASE + `/api/v2/shifts?date[gte]=2026-03-17&date[lte]=2026-03-23&limit=200`, { headers: h })
  const allShifts = (await allShiftsRes.json()).result
  console.log('Totaal shifts week 12:', allShifts?.length)
  // Groepeer per datum
  const byDate = {}
  for (const s of (allShifts || [])) {
    const d = s.start_datetime?.slice(0,10)
    if (d) { byDate[d] = (byDate[d] || 0) + 1 }
  }
  Object.entries(byDate).sort().forEach(([d, c]) => console.log(`  ${d}: ${c} shifts`))

  // 9. Eigen medewerkers lijst (store employees zonder week param) — check alle velden
  console.log('\n=== 9. MEDEWERKER VELDEN (eerste record) ===')
  const empListRes = await fetch(BASE + `/api/v2/stores/${storeId}/employees?exchange=true&week=2026-11&limit=5`, { headers: h })
  const empList = (await empListRes.json()).result
  if (empList?.[0]) console.log(JSON.stringify(empList[0], null, 2))

  // 10. Hoe veel medewerkers totaal?
  console.log('\n=== 10. TOTAAL MEDEWERKERS ===')
  const empAllRes = await fetch(BASE + `/api/v2/stores/${storeId}/employees?exchange=true&week=2026-11&limit=500`, { headers: h })
  const empAll = (await empAllRes.json()).result
  console.log('Totaal medewerkers:', empAll?.length)

  // 11. Checks op rooster data — velden
  console.log('\n=== 11. ROOSTER ITEM VELDEN ===')
  if (sched?.[0]) console.log(JSON.stringify(sched[0], null, 2))

  // 12. Shift item velden
  console.log('\n=== 12. SHIFT ITEM VELDEN ===')
  const shiftOneRes = await fetch(BASE + `/api/v2/shifts?date=2026-03-13&ignore_lent_out=true`, { headers: h })
  const shiftOne = (await shiftOneRes.json()).result?.[0]
  if (shiftOne) console.log(JSON.stringify(shiftOne, null, 2))

  // 13. Probeer departments/employees combo voor eigen afdeling
  console.log('\n=== 13. EIGEN AFDELING COLLEGA DETAILS ===')
  // Vind eigen afdeling uit rooster
  const myDept = sched?.[0]?.department?.department_id || sched?.[0]?.department_id
  if (myDept) {
    console.log('Eigen afdeling ID:', myDept)
    const myDeptShiftsRes = await fetch(BASE + `/api/v2/shifts?date=2026-03-13&department_id=${myDept}`, { headers: h })
    const myDeptShifts = (await myDeptShiftsRes.json()).result
    console.log('Shifts eigen afdeling 13 mrt:', myDeptShifts?.length)
    // Haal namen op
    const empMapRes = await fetch(BASE + `/api/v2/stores/${storeId}/employees?exchange=true&week=2026-11&limit=500`, { headers: h })
    const empMapData = {}
    for (const e of ((await empMapRes.json()).result || [])) empMapData[String(e.account_id)] = e.name
    myDeptShifts?.filter(s => s.start_datetime?.startsWith('2026-03-13')).forEach(s => {
      console.log(`  ${empMapData[String(s.account_id)] || s.account_id} | ${s.start_datetime?.slice(11,16)} - ${s.end_datetime?.slice(11,16)}`)
    })
  }

  // 14. Probeer shifts met limit=500 voor alle afdelingen
  console.log('\n=== 14. ALLE SHIFTS 13 MRT (limit=500) ===')
  const bigShiftRes = await fetch(BASE + `/api/v2/shifts?date=2026-03-13&ignore_lent_out=true&limit=500`, { headers: h })
  const bigShifts = (await bigShiftRes.json()).result
  console.log('Totaal shifts 13 mrt (limit 500):', bigShifts?.length)
  const deptRes2 = await fetch(BASE + `/api/v2/departments?date=2026-03-13`, { headers: h })
  const deptMap2 = {}
  for (const d of ((await deptRes2.json()).result || [])) deptMap2[d.department_id] = d.department_name
  // Groepeer per afdeling
  const byDept = {}
  for (const s of (bigShifts || [])) {
    const d = deptMap2[s.department_id] || String(s.department_id || '?')
    byDept[d] = (byDept[d] || 0) + 1
  }
  Object.entries(byDept).sort().forEach(([d, c]) => console.log(`  ${d}: ${c} shifts`))
}
main().catch(e => console.error('FATAL:', e.message))
