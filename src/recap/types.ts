export type RecapKind = 'day' | 'week'
export type RecapTab = 'today' | 'week' | 'history'

/** Doel voor de volgende dag/week, afgevinkt op die dag/week zelf */
export interface Goal { text: string; done: boolean }

export interface Recap {
  id: string
  kind: RecapKind
  /** dag: de dag zelf · week: maandag van die week (YYYY-MM-DD) */
  day: string
  energy: number | null
  focus: number | null
  mood: number | null
  /** dag: wat ging goed · week: grootste winst */
  went_well: string | null
  /** dag: wat kan beter · week: lessen */
  improve: string | null
  /** dag: hoogtepunt / dankbaar voor */
  highlight: string | null
  /** Bericht aan jezelf voor de volgende dag/week, bovenaan die recap getoond */
  note_next: string | null
  goals: Goal[]
  updated_at: string
}

export type RecapInput = Omit<Recap, 'id' | 'updated_at'>
