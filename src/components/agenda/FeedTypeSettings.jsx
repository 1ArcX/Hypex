import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../supabaseClient'
import { categoryColor, categoryLabel, categoryOfTypeId, typeIdOf } from '../../utils/category'
import { useItemTypes } from '../../hooks/useItemTypes'
import { IconButton, TypeSelect } from '../ui'

// Per koppeling: standaardtype + titelregels ("titel bevat ___ → type ___").
// Regels gelden ook voor items die later in de feed verschijnen; een handmatige aanpassing wint altijd.
export default function FeedTypeSettings({ connection }) {
  const { available } = useItemTypes()
  const [settings, setSettings] = useState(null) // { default_type_id, type_rules }
  const [error, setError] = useState(null)
  const [draft, setDraft] = useState({ contains: '', cat: 'persoonlijk' })

  useEffect(() => {
    supabase.from('calendar_connections').select('default_type_id,type_rules').eq('id', connection.id).single()
      .then(({ data, error }) => error ? setError('Types per feed kan pas na de database-migratie.') : setSettings({ default_type_id: data.default_type_id, type_rules: data.type_rules || [] }))
  }, [connection.id])

  const save = async (patch) => {
    const next = { ...settings, ...patch }
    setSettings(next)
    const { error } = await supabase.from('calendar_connections').update(patch).eq('id', connection.id)
    if (error) setError(`Opslaan mislukt: ${error.message}`)
    else window.dispatchEvent(new Event('refreshExternalCalendarEvents'))
  }

  if (error) return <div style={{ fontSize: 11, color: 'var(--c-text-3)', marginTop: 6 }}>{error}</div>
  if (!settings || !available) return null

  const defaultCat = categoryOfTypeId(settings.default_type_id) || (connection.provider === 'google' ? 'overig' : 'school')
  const rules = settings.type_rules
  const addRule = () => {
    const contains = draft.contains.trim()
    const type_id = typeIdOf(draft.cat)
    if (!contains || !type_id) return
    save({ type_rules: [...rules, { contains, type_id }] })
    setDraft({ ...draft, contains: '' })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0 4px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 11, color: 'var(--c-text-3)' }}>Standaardtype</span>
        <TypeSelect value={defaultCat} onChange={cat => save({ default_type_id: typeIdOf(cat) })} label="Standaardtype" />
      </div>
      <div style={{ fontSize: 11, color: 'var(--c-text-3)', marginTop: 2 }}>Regels <span style={{ opacity: 0.8 }}>· eerste regel die past wint</span></div>
      {rules.map((r, i) => {
        const cat = categoryOfTypeId(r.type_id)
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--c-text-2)' }}>
            <span style={{ flex: 1, minWidth: 0 }}>Titel bevat <b style={{ color: 'var(--c-text)' }}>"{r.contains}"</b> → {cat ? <TypeName cat={cat} /> : <i>verwijderd type</i>}</span>
            <IconButton icon={Trash2} label="Regel verwijderen" size={24} iconSize={12} tone="danger"
              onClick={() => save({ type_rules: rules.filter((_, j) => j !== i) })} />
          </div>
        )
      })}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) auto', gap: 6, alignItems: 'center' }}>
        <input className="glass-input" placeholder="titel bevat… (bv. vakantie)" value={draft.contains}
          onChange={e => setDraft({ ...draft, contains: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') addRule() }}
          style={{ padding: '6px 10px', fontSize: 12 }} />
        <TypeSelect value={draft.cat} onChange={cat => setDraft({ ...draft, cat })} label="Type voor regel" style={{ padding: '6px 10px', fontSize: 12 }} />
        <IconButton icon={Plus} label="Regel toevoegen" variant="soft" size={30} disabled={!draft.contains.trim()} onClick={addRule} />
      </div>
    </div>
  )
}

function TypeName({ cat }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--c-text)' }}>
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: categoryColor(cat) }} />{categoryLabel(cat)}
    </span>
  )
}
