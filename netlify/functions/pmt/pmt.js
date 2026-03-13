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
  const jan4 = new Date(d.getFullYear(), 0, 4)
  return Math.ceil(((d - jan4) / 86400000 + jan4.getDay() + 1) / 7)
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

  return err(`Onbekende actie: ${action}`)
}
