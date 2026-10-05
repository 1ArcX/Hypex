import { useState } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { IconButton, TYPE_SWATCHES } from './ui'
import { useItemTypes, addItemType, updateItemType, deleteItemType, reorderItemTypes } from '../hooks/useItemTypes'

// Instellingen → Types: naam + kleur per type, volgorde, toevoegen en verwijderen.
// Overig is het vangnet en kan niet weg.
export default function TypesManager() {
  const { types, available, loaded } = useItemTypes()
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(TYPE_SWATCHES[4])
  const [editColorFor, setEditColorFor] = useState(null)

  if (!loaded) return <div style={{ fontSize: 12, color: 'var(--c-text-3)' }}>Laden…</div>
  if (!available) return (
    <div style={{ fontSize: 12, color: 'var(--c-text-3)', lineHeight: 1.5 }}>
      Eigen types zijn nog niet beschikbaar: voer <code>supabase/migrations/add_types_feed_overrides.sql</code> uit in Supabase.
    </div>
  )

  const move = (i, dir) => {
    const ids = types.map(t => t.id)
    const j = i + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    reorderItemTypes(ids)
  }

  const remove = (t) => {
    if (!confirm(`Type "${t.name}" verwijderen? Taken en agenda-items van dit type gaan naar Overig.`)) return
    deleteItemType(t.id)
  }

  const add = async () => {
    const name = newName.trim()
    if (!name) return
    if (await addItemType({ name, color: newColor })) setNewName('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {types.map((t, i) => (
        <div key={t.id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button type="button" aria-label={`Kleur van ${t.name} wijzigen`} onClick={() => setEditColorFor(editColorFor === t.id ? null : t.id)}
              style={{ width: 22, height: 22, borderRadius: '50%', background: t.color, border: '2px solid var(--c-border-strong)', cursor: 'pointer', flexShrink: 0 }} />
            <input className="glass-input" aria-label="Naam van type" defaultValue={t.name}
              onBlur={e => { const v = e.target.value.trim(); if (v && v !== t.name) updateItemType(t.id, { name: v }); else e.target.value = t.name }}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
              style={{ flex: 1, minWidth: 0, padding: '6px 10px' }} />
            <IconButton icon={ArrowUp} label="Omhoog" size={26} iconSize={13} disabled={i === 0} onClick={() => move(i, -1)} />
            <IconButton icon={ArrowDown} label="Omlaag" size={26} iconSize={13} disabled={i === types.length - 1} onClick={() => move(i, 1)} />
            <IconButton icon={Trash2} label={t.key === 'overig' ? 'Overig kan niet weg' : `${t.name} verwijderen`} size={26} iconSize={13}
              tone="danger" disabled={t.key === 'overig'} onClick={() => remove(t)} />
          </div>
          {editColorFor === t.id && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', padding: '8px 0 4px 28px' }}>
              {TYPE_SWATCHES.map(c => (
                <button key={c} type="button" aria-label={`Kleur ${c}`} onClick={() => updateItemType(t.id, { color: c })}
                  style={{ width: 20, height: 20, borderRadius: '50%', background: c, cursor: 'pointer', border: t.color.toLowerCase() === c.toLowerCase() ? '2px solid white' : '2px solid transparent' }} />
              ))}
              <input type="color" value={t.color} aria-label="Eigen kleur" onChange={e => updateItemType(t.id, { color: e.target.value })}
                style={{ width: 24, height: 24, border: 'none', background: 'none', padding: 0, cursor: 'pointer' }} />
            </div>
          )}
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        <label style={{ width: 22, height: 22, borderRadius: '50%', background: newColor, border: '2px solid var(--c-border-strong)', cursor: 'pointer', flexShrink: 0, position: 'relative', overflow: 'hidden' }}>
          <input type="color" value={newColor} aria-label="Kleur nieuw type" onChange={e => setNewColor(e.target.value)}
            style={{ opacity: 0, position: 'absolute', inset: 0, cursor: 'pointer' }} />
        </label>
        <input className="glass-input" placeholder="Nieuw type (bv. Sport)" value={newName}
          onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }}
          style={{ flex: 1, minWidth: 0, padding: '6px 10px' }} />
        <IconButton icon={Plus} label="Type toevoegen" variant="soft" size={30} disabled={!newName.trim()} onClick={add} />
      </div>
    </div>
  )
}
