import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { GROUPS } from '../lib/groups'
import Header from '../components/Layout/Header'
import GroupCard from '../components/Groups/GroupCard'
import Spinner from '../components/UI/Spinner'

export default function TablesPage() {
  const [allMatches, setAllMatches] = useState([])
  const [loading,    setLoading]    = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('matches')
      .select('*')
      .not('group_name', 'is', null)
    setAllMatches(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <>
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-5">

        <div className="flex items-center gap-3 mb-5">
          <span className="text-3xl">📊</span>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 leading-none">טבלאות שלב הבתים</h1>
            <p className="text-slate-400 text-xs mt-0.5">12 בתים · 48 קבוצות · עדכון לפי תוצאות אמיתיות</p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4">
          {[
            { dot: 'bg-emerald-500', label: 'עולה לשלב הנוקאאוט' },
            { dot: 'bg-amber-400',   label: 'מחזיקות (אולי עולה)' },
            { dot: 'bg-rose-400',    label: 'נפסלת' },
          ].map(({ dot, label }) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dot}`} />
              {label}
            </div>
          ))}
          <div className="mr-auto text-xs text-slate-400">
            מ=משחקים · נ=ניצחון · ת=תיקו · ה=הפסד · נק=נקודות
          </div>
        </div>

        {loading ? (
          <Spinner size="lg" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {GROUPS.map(group => (
              <GroupCard
                key={group.name}
                group={group}
                allMatches={allMatches}
                prediction={null}
                onPredictionSaved={() => {}}
                user={null}
                readOnly={true}
              />
            ))}
          </div>
        )}
      </main>
    </>
  )
}
