const fetch = require('node-fetch')

const BASE_URL = 'https://jumbo7044.personeelstool.nl'
const API_V2 = `${BASE_URL}/api/v2`
const X_API_CONTEXT = 'PfqzYJeZX8mp1ewJb9MCFfHOkiXvLEUq'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
}

const PMT_HEADERS = {
  'x-api-context': X_API_CONTEXT,
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

function ok(data) {
  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(data) }
}
function err(msg, status = 400) {
  return { statusCode: status, headers: CORS_HEADERS, body: JSON.stringify({ error: msg }) }
}

// Convert ISO week + year to Monday–Sunday date strings
function weekToDateRange(week, year) {
  const simple = new Date(year, 0, 1 + (week - 1) * 7)
  const dow = simple.getDay()
  const monday = new Date(simple)
  monday.setDate(simple.getDate() - (dow === 0 ? 6 : dow - 1))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return {
    dateFrom: monday.toISOString().slice(0, 10),
    dateTo: sunday.toISOString().slice(0, 10)
  }
}

async function loginPmt(username, password) {
  const res = await fetch(`${BASE_URL}/pmtLoginSso?subdomain=jumbo7044`, {
    method: 'POST',
    headers: PMT_HEADERS,
    body: JSON.stringify({
      username,
      password,
      browser_info: {
        os_name: 'Windows 10.0',
        browser_name: 'Chrome',
        browser_version: 120,
        screen_resolution: '1920x1080'
      }
    }),
    timeout: 10000
  })

  const data = await res.json()
  const result = data?.result

  if (!res.ok || !result || result.authenticated !== true) {
    const msg = Array.isArray(result)
      ? (result[0]?.message || result[0]?.code || 'Inloggen mislukt')
      : 'Inloggen mislukt. Controleer je gebruikersnaam en wachtwoord.'
    throw new Error(msg)
  }

  return {
    token: result.user_token,
    accountId: result.account_id,
    storeId: result.store_id
  }
}

async function fetchSchedule(auth, week, year) {
  const { dateFrom, dateTo } = weekToDateRange(week, year)
  const authHeaders = { ...PMT_HEADERS, 'x-api-user': auth.token }

  const qs = new URLSearchParams({
    'date[gte]': dateFrom,
    'date[lte]': dateTo,
    account_id: auth.accountId
  }).toString()

  const res = await fetch(`${API_V2}/schedules?${qs}`, {
    headers: authHeaders,
    timeout: 10000
  })

  const data = await res.json()
  if (!res.ok) {
    const msg = data?.result?.[0]?.message || 'Rooster ophalen mislukt'
    throw new Error(msg)
  }

  return data.result || []
}

// Map PMT schedule item to our normalized format
function mapShift(item) {
  // schedule_time_from: "2026-03-09 18:30"
  const fromParts = (item.schedule_time_from || '').split(' ')
  const toParts = (item.schedule_time_to || '').split(' ')
  return {
    date: fromParts[0] || '',
    start: fromParts[1]?.slice(0, 5) || '',
    end: toParts[1]?.slice(0, 5) || '',
    label: item.department?.department_name || '',
    location: 'Jumbo Wim en Jeanette Bleeker'
  }
}

function currentISOWeek() {
  const d = new Date()
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil((((date - yearStart) / 86400000) + 1) / 7)
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS_HEADERS, body: '' }
  if (event.httpMethod !== 'POST') return err('Method not allowed', 405)

  let body
  try { body = JSON.parse(event.body || '{}') } catch { return err('Invalid JSON') }

  const { action, username, password, week, year } = body
  if (!action || !username || !password) return err('action, username en password zijn verplicht')

  let auth
  try {
    auth = await loginPmt(username, password)
  } catch (e) {
    return err(e.message || 'Inloggen mislukt', 401)
  }

  if (action === 'login') {
    return ok({ success: true })
  }

  if (action === 'schedule') {
    const targetWeek = parseInt(week) || currentISOWeek()
    const targetYear = parseInt(year) || new Date().getFullYear()
    try {
      const raw = await fetchSchedule(auth, targetWeek, targetYear)
      const shifts = raw.map(mapShift).filter(s => s.date)
      return ok({ shifts, week: targetWeek, year: targetYear })
    } catch (e) {
      console.error('PMT schedule error:', e)
      return err(`Rooster ophalen mislukt: ${e.message}`, 500)
    }
  }

  if (action === 'day_planning') {
    const date = body.date
    if (!date) return err('date is verplicht')
    const authHeaders = { ...PMT_HEADERS, 'x-api-user': auth.token }

    // Geen sorting param — die breekt de date filter in de PMT API
    const shiftsQs = new URLSearchParams({
      'date[gte]': date, 'date[lte]': date, limit: 200
    }).toString()

    // ISO week berekenen voor employees endpoint (vereist YYYY-WW formaat)
    const dateObj = new Date(date)
    const utcDate = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()))
    const dow = utcDate.getUTCDay() || 7
    utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dow)
    const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1))
    const isoWeek = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7)
    const yearWeek = `${utcDate.getUTCFullYear()}-${String(isoWeek).padStart(2, '0')}`

    const [deptRes, empRes, shiftsRes] = await Promise.all([
      fetch(`${API_V2}/departments?date=${date}`, { headers: authHeaders, timeout: 10000 }),
      fetch(`${API_V2}/stores/${auth.storeId}/employees?exchange=true&week=${yearWeek}&limit=10000`, { headers: authHeaders, timeout: 10000 }),
      fetch(`${API_V2}/shifts?${shiftsQs}`, { headers: authHeaders, timeout: 10000 })
    ])

    const [deptData, empData, shiftsData] = await Promise.all([
      deptRes.json(), empRes.json(), shiftsRes.json()
    ])

    if (!shiftsRes.ok) return err(shiftsData?.result?.[0]?.message || 'Dag planning ophalen mislukt', 500)

    const deptMap = {}
    for (const d of (deptData.result || [])) deptMap[d.department_id] = d.department_name
    const empMap = {}
    for (const e of (empData.result || [])) empMap[String(e.account_id)] = e.name

    const raw = (shiftsData.result || []).filter(s =>
      s.start_datetime &&
      s.start_datetime.startsWith(date) &&
      s.start_datetime !== s.end_datetime &&
      !s.start_datetime.endsWith('00:00')
    )
    raw.sort((a, b) => a.start_datetime.localeCompare(b.start_datetime))
    const dayShifts = raw.map(s => ({
      start: s.start_datetime.split(' ')[1]?.slice(0, 5) || '',
      end:   s.end_datetime.split(' ')[1]?.slice(0, 5) || '',
      department: deptMap[s.department_id] || String(s.department_id),
      name: empMap[String(s.account_id)] || null,
      isOwn: String(s.account_id) === String(auth.accountId)
    }))
    return ok({ dayShifts, date, total: dayShifts.length })
  }

  return err(`Onbekende actie: ${action}`)
}
