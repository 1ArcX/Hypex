import { Home, Mails, CalendarRange, Plus } from 'lucide-react'
import { useGeldStore, type GeldTab } from '../store/geldStore'

const TABS: { id: GeldTab; label: string; Icon: typeof Home }[] = [
  { id: 'home',       label: 'Home',       Icon: Home },
  { id: 'enveloppen', label: 'Enveloppen', Icon: Mails },
  { id: 'jaar',       label: 'Jaar',       Icon: CalendarRange },
]

// Zwevende glazen tabbar met centrale +-knop (opent het actiemenu)
export function TabBar({ onAdd }: { onAdd: () => void }) {
  const activeTab = useGeldStore(s => s.activeTab)
  const setActiveTab = useGeldStore(s => s.setActiveTab)

  return (
    <div className="absolute left-0 right-0 bottom-0 z-40 flex justify-center pointer-events-none"
      style={{ paddingBottom: 'calc(10px + env(safe-area-inset-bottom))' }}>
      <div className="pointer-events-auto flex items-center gap-1 px-2 py-1.5 rounded-[26px] bg-[#17171d]/80 backdrop-blur-2xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.55)]">
        {TABS.slice(0, 2).map(t => <TabButton key={t.id} tab={t} active={activeTab === t.id} onClick={() => setActiveTab(t.id)} />)}
        <button onClick={onAdd}
          className="w-12 h-12 -my-3 mx-1 rounded-full bg-teal-300 text-black flex items-center justify-center cursor-pointer shadow-[0_0_24px_rgba(94,234,212,0.45)] active:scale-95 transition-transform border-none">
          <Plus size={22} strokeWidth={2.5} />
        </button>
        {TABS.slice(2).map(t => <TabButton key={t.id} tab={t} active={activeTab === t.id} onClick={() => setActiveTab(t.id)} />)}
      </div>
    </div>
  )
}

function TabButton({ tab, active, onClick }: {
  tab: { id: GeldTab; label: string; Icon: typeof Home }
  active: boolean
  onClick: () => void
}) {
  const { Icon } = tab
  return (
    <button onClick={onClick}
      className={`flex flex-col items-center gap-0.5 px-4 py-1.5 rounded-2xl border-none cursor-pointer transition-colors ${
        active ? 'bg-white/[0.08] text-teal-300' : 'bg-transparent text-white/35'
      }`}>
      <Icon size={18} />
      <span className={`text-[9px] ${active ? 'font-bold' : 'font-medium'}`}>{tab.label}</span>
    </button>
  )
}
