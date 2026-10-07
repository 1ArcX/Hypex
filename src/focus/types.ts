export type CourseStatus = 'active' | 'paused' | 'completed' | 'archived'
export type SessionKind = 'reading' | 'practice' | 'review' | 'assignment'
export type TimerKind = 'stopwatch' | 'pomodoro' | 'manual'
export type FocusTab = 'home' | 'courses' | 'calendar' | 'insights'
export type ThemePref = 'auto' | 'light' | 'dark'

export interface Course {
  id: string
  name: string
  code: string | null
  color: string
  status: CourseStatus
  start_date: string | null
  final_date: string | null
  target_grade: number | null
  sort_order: number
  created_at: string
}

export interface CourseDate {
  id: string
  course_id: string
  title: string
  date: string
  is_final: boolean
  reminder_offsets: string[]
  reminder_time: string
  sent_offsets?: string[]
}

export interface Topic {
  id: string
  course_id: string
  name: string
  target_minutes: number
  sort_order: number
}

export interface GradePart {
  id: string
  course_id: string
  name: string
  weight: number
  grade: number | null
  is_final: boolean
  sort_order: number
}

export interface Session {
  id: string
  completed_at: string
  started_at: string | null
  duration_minutes: number
  course_id: string | null
  topic_id: string | null
  kind: SessionKind | null
  rating: number | null
  note: string | null
  timer_kind: TimerKind | null
  task_id: string | null
}

export type SessionInput = Partial<Omit<Session, 'id'>> & { completed_at: string; duration_minutes: number }
