import { useEffect } from 'react'
import { Database } from 'lucide-react'
import { Card, EmptyState, FilterTabs } from './components/ui'
import { useRecapStore } from './store/recapStore'
import { useActivity } from './hooks/useActivity'
import TodayView from './views/TodayView'
import WeekView from './views/WeekView'
import HistoryView from './views/HistoryView'
import type { RecapTab } from './types'
import './recap.css'

// Recap-tab: dagelijkse evaluatie + doelen voor morgen, weekrecap op zondag, geschiedenis.

const TABS: { value: RecapTab; label: string }[] = [
  { value: 'today', label: 'Vandaag' },
  { value: 'week', label: 'Week' },
  { value: 'history', label: 'Geschiedenis' },
]

export default function RecapPage({ userId, tasks, isAdmin }: { userId: string; tasks: { id: string }[]; isAdmin: boolean }) {
  const { loaded, needsMigration, tab, setTab, load } = useRecapStore()
  // 63 dagen: genoeg voor deze + vorige week in elke week die je terugbladert van de laatste twee maanden
  const activity = useActivity(userId, isAdmin, 63)

  useEffect(() => { load(userId) }, [userId, load])

  return (
    <div className="rc-page">
      <div className="rc-wrap">
        <div className="rc-head">
          <h1 className="t-page hide-mobile">Recap</h1>
          <FilterTabs items={TABS} value={tab} onChange={(v: RecapTab) => setTab(v)} label="Recap-weergave" />
        </div>

        {!loaded ? (
          <p className="t-meta">Laden…</p>
        ) : needsMigration ? (
          <Card>
            <EmptyState icon={Database} title="Database nog niet klaar" text="Draai supabase/migrations/add_recap.sql in Supabase → SQL Editor en herlaad de pagina." />
          </Card>
        ) : tab === 'week' ? (
          <WeekView activity={activity} />
        ) : tab === 'history' ? (
          <HistoryView />
        ) : (
          <TodayView tasks={tasks} activity={activity} />
        )}
      </div>
    </div>
  )
}
