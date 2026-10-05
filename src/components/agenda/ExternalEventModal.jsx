import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, EyeOff, Eye, RotateCcw, Save } from 'lucide-react'
import { eventDisplay } from '../../utils/eventTitle'
import { eventCategory, typeIdOf } from '../../utils/category'
import { saveOverrides, resetOverrides } from '../../utils/externalEvents'
import { TypeSelect } from '../ui'
import TravelTimeField from './TravelTimeField'

const pad = n => String(n).padStart(2, '0')
const dateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const timeStr = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`
const isAllDay = (allDay, s, e) => !!allDay || (s.getHours() === 0 && s.getMinutes() === 0 && e.getHours() === 23 && e.getMinutes() === 59)

// HTML (Google) → tekst met behoud van regeleinden; platte tekst (MyX/ICS) blijft zoals hij is
function cleanDescription(raw = '') {
  if (!/<[a-z/][^>]*>/i.test(raw)) return raw.trim()
  return raw.replace(/<br\s*\/?>|<\/p>|<\/li>/gi, '\n').replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

function formFrom(ev) {
  const s = new Date(ev.start_time), e = new Date(ev.end_time)
  const allDay = isAllDay(ev.all_day, s, e)
  return {
    title: ev.title, note: ev.note || '', allDay,
    date: dateStr(s), endDate: dateStr(e) !== dateStr(s) ? dateStr(e) : '',
    startTime: allDay ? '09:00' : timeStr(s), endTime: allDay ? '10:00' : timeStr(e),
    cat: eventCategory(ev),
    travelBefore: ev.travel_before || 0, travelAfter: ev.travel_after || 0,
  }
}

/** Geïmporteerd item (Google / MijnX) bekijken en aanpassen. Aanpassingen overleven elke sync. */
export default function ExternalEventModal({ ev, siblings = [], onClose }) {
  const [form, setForm] = useState(() => formFrom(ev))
  // Zelfde titel in dezelfde feed (bv. 7× "herfstvakantie", één per dag): in één keer aanpassen.
  const [applyAll, setApplyAll] = useState(false)
  const targets = applyAll ? [ev, ...siblings] : [ev]
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const set = (patch) => setForm(f => ({ ...f, ...patch }))
  const { code } = eventDisplay(ev)
  const description = cleanDescription(ev.description)
  const orig = ev._original || ev
  const autoCat = eventCategory({ ...ev, type_id: null })
  const feedName = ev.connection?.name || (ev.connection?.provider === 'google' ? 'Google Agenda' : 'MijnX')

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const run = async (fn) => {
    setSaving(true); setError(null)
    const res = await fn()
    setSaving(false)
    if (res?.error) setError(res.error.message?.includes('external_event_overrides') || res.error.code === 'PGRST205'
      ? 'Aanpassen kan pas na de database-migratie (add_types_feed_overrides.sql).'
      : res.error.message?.includes('travel_') ? 'Reistijd opslaan kan pas na de database-migratie (add_travel_time.sql).'
      : `Opslaan mislukt: ${res.error.message}`)
    else onClose()
  }

  function save() {
    const endDs = form.endDate || form.date
    const start = form.allDay ? new Date(`${form.date}T00:00`) : new Date(`${form.date}T${form.startTime}`)
    let end = form.allDay ? new Date(`${endDs}T23:59`) : new Date(`${endDs}T${form.endTime}`)
    if (end <= start) end = new Date(start.getTime() + 3600000)
    // Alleen opslaan wat echt afwijkt van de feed, zodat latere feed-wijzigingen nog doorkomen.
    const os = new Date(orig.start_time), oe = new Date(orig.end_time)
    const origAllDay = isAllDay(orig.all_day, os, oe)
    const timeChanged = form.allDay !== origAllDay || start.getTime() !== os.getTime() || end.getTime() !== oe.getTime()
    const title = form.title.trim()
    const shared = {
      title: title && title !== orig.title ? title : null,
      note: form.note.trim() || null,
      type_id: form.cat !== autoCat ? typeIdOf(form.cat) : null,
      // Reistijd: alleen meesturen als die gezet is of was (kolom bestaat pas na add_travel_time.sql)
      ...(form.travelBefore || ev.travel_before ? { travel_before: form.travelBefore || null } : {}),
      ...(form.travelAfter || ev.travel_after ? { travel_after: form.travelAfter || null } : {}),
    }
    const items = [{ ev, patch: { ...shared, start_time: timeChanged ? start.toISOString() : null, end_time: timeChanged ? end.toISOString() : null, all_day: timeChanged ? form.allDay : null } }]
    // Andere items: zelfde hele-dag/tijden, maar op hun eigen datum(s).
    for (const sib of applyAll ? siblings : []) {
      const so = sib._original || sib
      const ss = new Date(so.start_time), se = new Date(so.end_time)
      const sStart = form.allDay ? new Date(ss.getFullYear(), ss.getMonth(), ss.getDate(), 0, 0)
        : new Date(`${dateStr(ss)}T${form.startTime}`)
      let sEnd = form.allDay ? new Date(se.getFullYear(), se.getMonth(), se.getDate(), 23, 59)
        : new Date(`${dateStr(se)}T${form.endTime}`)
      if (sEnd <= sStart) sEnd = new Date(sStart.getTime() + 3600000)
      const changed = form.allDay !== isAllDay(so.all_day, ss, se) || sStart.getTime() !== ss.getTime() || sEnd.getTime() !== se.getTime()
      const keepOwnTime = !timeChanged // alleen titel/type/notitie aangepast → tijden van dat item laten staan
      items.push({ ev: sib, patch: { ...shared,
        start_time: !keepOwnTime && changed ? sStart.toISOString() : keepOwnTime ? sib._override?.start_time ?? null : null,
        end_time: !keepOwnTime && changed ? sEnd.toISOString() : keepOwnTime ? sib._override?.end_time ?? null : null,
        all_day: !keepOwnTime && changed ? form.allDay : keepOwnTime ? sib._override?.all_day ?? null : null,
      } })
    }
    return run(() => saveOverrides(items))
  }

  const lbl = { fontSize: 10, color: 'var(--c-text-3)', marginBottom: 4, letterSpacing: '0.05em' }
  // Portal naar <body>: anders valt de modal binnen de stacking context van de pagina (onder de BottomNav)
  return createPortal(
    <div className="modal-overlay" style={{ padding: 16 }} onClick={onClose}>
      <div className="glass-card modal-content" role="dialog" aria-modal="true" aria-labelledby="ext-ev-title"
        style={{ width: '100%', maxWidth: 420, padding: 24, maxHeight: '90vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <div style={{ minWidth: 0 }}>
            <h2 id="ext-ev-title" style={{ color: 'white', fontWeight: 700, fontSize: 16, margin: 0, overflowWrap: 'anywhere' }}>{eventDisplay({ ...ev, title: orig.title }).title}</h2>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              <span className="hx-chip">↗ {feedName}</span>
              {ev.edited && <span className="hx-chip" style={{ color: 'var(--accent)', borderColor: 'color-mix(in srgb, var(--accent) 35%, transparent)' }}>Aangepast</span>}
              {ev.hidden && <span className="hx-chip">Verborgen</span>}
            </div>
          </div>
          <button onClick={onClose} aria-label="Sluiten" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-3)', flexShrink: 0 }}>
            <X size={18} />
          </button>
        </div>

        {/* Uit de feed (alleen lezen) */}
        {(code || ev.location || description) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12, borderRadius: 'var(--r-md)', background: 'var(--c-surface-2)', border: '1px solid var(--c-border)', marginBottom: 16 }}>
            {code && <InfoRow label="Code" value={code} />}
            {ev.location && <InfoRow label="Locatie" value={ev.location} />}
            {description && <InfoRow label="Beschrijving" value={description} small />}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input className="glass-input" aria-label="Titel" placeholder={orig.title} value={form.title}
            onChange={e => set({ title: e.target.value })} style={{ fontSize: 15 }} />
          <div>
            <div style={lbl}>Type</div>
            <TypeSelect value={form.cat} onChange={cat => set({ cat })} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" role="switch" aria-checked={form.allDay} aria-label="Hele dag" onClick={() => set({ allDay: !form.allDay })}
              style={{ width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', background: form.allDay ? 'var(--accent)' : 'rgba(255,255,255,0.14)', position: 'relative', flexShrink: 0, padding: 0 }}>
              <span style={{ position: 'absolute', top: 2, left: form.allDay ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: form.allDay ? '#000' : 'rgba(255,255,255,0.7)', transition: 'left 0.2s' }} />
            </button>
            <span style={{ fontSize: 12, color: 'var(--c-text-2)' }}>Hele dag</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={lbl}>Van</div>
              <input type="date" className="glass-input" value={form.date} onChange={e => set({ date: e.target.value })} style={{ width: '100%' }} />
            </div>
            <div>
              <div style={lbl}>Tot</div>
              <input type="date" className="glass-input" value={form.endDate || form.date} min={form.date}
                onChange={e => { const v = e.target.value; set({ endDate: v === form.date ? '' : v }) }} style={{ width: '100%' }} />
            </div>
          </div>
          {!form.allDay && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input type="time" className="glass-input" aria-label="Begintijd" value={form.startTime} onChange={e => set({ startTime: e.target.value })} />
              <input type="time" className="glass-input" aria-label="Eindtijd" value={form.endTime} onChange={e => set({ endTime: e.target.value })} />
            </div>
          )}
          {!form.allDay && (
            <TravelTimeField before={form.travelBefore} after={form.travelAfter}
              onChange={({ before, after }) => set({ travelBefore: before, travelAfter: after })} />
          )}
          <textarea className="glass-input" placeholder="Eigen notitie" value={form.note}
            onChange={e => set({ note: e.target.value })} style={{ resize: 'vertical', minHeight: 56 }} />
        </div>

        {siblings.length > 0 && (
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 14, padding: '10px 12px', borderRadius: 'var(--r-md)', cursor: 'pointer',
            background: applyAll ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'var(--c-surface-2)',
            border: `1px solid ${applyAll ? 'color-mix(in srgb, var(--accent) 35%, transparent)' : 'var(--c-border)'}`, fontSize: 12, color: 'var(--c-text-2)', lineHeight: 1.45 }}>
            <input type="checkbox" checked={applyAll} onChange={e => setApplyAll(e.target.checked)} style={{ accentColor: 'var(--accent)', marginTop: 2, cursor: 'pointer' }} />
            <span>
              Ook toepassen op de <b style={{ color: 'var(--c-text)' }}>{siblings.length} andere {siblings.length === 1 ? 'item' : 'items'}</b> met de titel "{orig.title}"
              <span style={{ display: 'block', color: 'var(--c-text-3)', fontSize: 11 }}>Elk item houdt zijn eigen datum; hele dag, tijden, titel, type en notitie worden overgenomen.</span>
            </span>
          </label>
        )}

        {error && <div style={{ fontSize: 12, color: 'var(--c-danger)', marginTop: 12, lineHeight: 1.5 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
          <button type="button" className="btn-ghost" disabled={saving} title={ev.hidden ? 'Weer tonen' : 'Verbergen'}
            onClick={() => run(() => saveOverrides(targets.map(t => ({ ev: t, patch: { hidden: !ev.hidden } }))))} style={{ padding: '9px 12px', fontSize: 12 }}>
            {ev.hidden ? <Eye size={13} /> : <EyeOff size={13} />} {ev.hidden ? 'Tonen' : 'Verbergen'}
          </button>
          {targets.some(t => t._override) && (
            <button type="button" className="btn-ghost" disabled={saving} title="Alle aanpassingen weg, terug naar de feed"
              onClick={() => run(() => resetOverrides(targets))} style={{ padding: '9px 12px', fontSize: 12 }}>
              <RotateCcw size={13} /> Herstel origineel
            </button>
          )}
          <button type="button" className="btn-primary" disabled={saving} onClick={save}
            style={{ flex: 1, minWidth: 120, padding: '9px 12px', fontSize: 12, justifyContent: 'center' }}>
            <Save size={13} /> {saving ? 'Opslaan…' : 'Opslaan'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function InfoRow({ label, value, small }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span style={{ fontSize: 11, color: 'var(--c-text-3)', width: 72, flexShrink: 0, paddingTop: 2 }}>{label}</span>
      <span style={{ fontSize: small ? 12 : 13, color: small ? 'var(--c-text-2)' : 'var(--c-text)', fontWeight: small ? 400 : 500, lineHeight: 1.4, minWidth: 0, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{value}</span>
    </div>
  )
}
