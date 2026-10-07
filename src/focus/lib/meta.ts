import { BookOpen, PenLine, Target, RotateCcw, type LucideIcon } from 'lucide-react'
import type { CourseStatus, SessionKind } from '../types'

export const KINDS: { id: SessionKind; label: string; color: string; Icon: LucideIcon }[] = [
  { id: 'reading',    label: 'Lezen',    color: '#F43F5E', Icon: BookOpen },
  { id: 'assignment', label: 'Opdracht', color: '#C936E0', Icon: PenLine },
  { id: 'practice',   label: 'Oefenen',  color: '#06B6D4', Icon: Target },
  { id: 'review',     label: 'Herhalen', color: '#F97362', Icon: RotateCcw },
]
export const KIND_BY_ID = Object.fromEntries(KINDS.map(k => [k.id, k])) as Record<SessionKind, (typeof KINDS)[number]>

export const STATUSES: { id: CourseStatus; label: string }[] = [
  { id: 'active',    label: 'Actief' },
  { id: 'paused',    label: 'Gepauzeerd' },
  { id: 'completed', label: 'Afgerond' },
  { id: 'archived',  label: 'Archief' },
]

export const COURSE_COLORS = ['#5B5BD6', '#F0365A', '#22A6B8', '#F58A2C', '#2FB463', '#A855F7', '#E5B30B', '#3B82F6', '#B7794A', '#64748B']

export const NO_COURSE = { id: '__none', name: 'Zonder vak', code: '—', color: '#8E8E93' }

/** Accent van de Focus-tab: themakleur in het Dash-thema, oranje in Licht (zie focus.css). Alleen binnen .fx gebruiken. */
export const ORANGE = 'var(--fx-orange)'
