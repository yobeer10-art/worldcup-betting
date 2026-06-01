import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { GROUPS, isPredictionLocked } from '../lib/groups'
import Header from '../components/Layout/Header'
import GroupCard from '../components/Groups/GroupCard'
import Spinner from '../components/UI/Spinner'

const TOTAL_GROUPS = GROUPS.length // 12

/* ── Progress bar ───────────────────────────────────────────────── */
function ProgressBar({ value, max }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100)
  return (
    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-emerald-400 to-green-500 rounded-full transition-all duration-700"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export default function GroupsPage() {
  const { user } = useAuth()
  const [allMatches,  setAllMatches]  = useState([])
  const [predictions, setPredictions] = useState({})   // { groupName: row }
  const [loading,     setLoading]     = useState(true)
  const [saveError,   setSaveError]   = useState(null)

  const fetchData = useCallback(async () => {
    const [matchesRes, predsRes] = await Promise.all([
      // Only group-stage matches needed for standings
      supabase
        .from('matches')
        .select('*')
        .not('group_name', 'is', null),
      user
        ? supabase
            .from('group_predictions')
            .select('*')
            .eq('user_id', user.id)
        : Promise.resolve({ data: [] }),
    ])

    setAllMatches(matchesRes.data ?? [])

    const map = {}
    predsRes.data?.forEach((p) => { map[p.group_name] = p })
    setPredictions(map)

    setLoading(false)
  }, [user])

  useEffect(() => { fetchData() }, [fetchData])

  async function handlePredictionSave(groupName, firstPlace, secondPlace) {
    if (!user) return
    setSaveError(null)

    const { data, error } = await supabase
      .from('group_predictions')
      .upsert(
        {
          user_id:      user.id,
          group_name:   groupName,
          first_place:  firstPlace,
          second_place: secondPlace,
        },
        { onConflict: 'user_id,group_name' },
      )
      .select()
      .single()

    if (error) {
      setSaveError('שגיאה בשמירת הניחוש. נסה שוב.')
      console.error(error)
    } else if (data) {
      setPredictions((prev) => ({ ...prev, [groupName]: data }))
    }
  }

  const predCount = Object.keys(predictions).length
  const locked    = isPredictionLocked()

  return (
    <>
      <Header />

      <main className="max-w-5xl mx-auto px-4 py-5">

        {/* ── Page title ───────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">🏟️</span>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 leading-none">שלב הבתים</h1>
            <p className="text-slate-400 text-xs mt-0.5">
              12 בתים · 48 קבוצות · מונדיאל 2026
            </p>
          </div>
        </div>

        {/* ── Prediction progress banner ───────────────────────── */}
        {user ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 mb-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-slate-700 font-semibold text-sm">
                🎯 ניחשת{' '}
                <span className="text-emerald-600 font-extrabold text-lg">
                  {predCount}
                </span>
                {' '}מתוך{' '}
                <span className="text-slate-500 font-bold">{TOTAL_GROUPS}</span>
                {' '}בתים
              </p>
              <span className="text-2xl font-extrabold text-emerald-600 tabular-nums">
                {Math.round((predCount / TOTAL_GROUPS) * 100)}%
              </span>
            </div>
            <ProgressBar value={predCount} max={TOTAL_GROUPS} />
            {locked ? (
              <p className="text-xs text-slate-400 mt-1.5 text-center">
                🔒 הניחושים ננעלו — הטורניר התחיל!
              </p>
            ) : predCount < TOTAL_GROUPS ? (
              <p className="text-xs text-amber-600 mt-1.5">
                {TOTAL_GROUPS - predCount} בתים עוד ממתינים לניחוש שלך
              </p>
            ) : (
              <p className="text-xs text-emerald-600 font-semibold mt-1.5">
                ✅ נחשת את כל הבתים — בהצלחה!
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3.5 mb-5 shadow-sm">
            <div>
              <p className="text-amber-900 font-bold text-sm">
                התחבר כדי לנחש מי יעלה מכל בית 🔮
              </p>
              <p className="text-amber-700 text-xs mt-0.5">
                2 נקודות על ניצחון הבית · 1 נקודה על המקום השני
              </p>
            </div>
            <Link
              to="/auth"
              className="shrink-0 bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-green-700 active:scale-95 transition-all shadow"
            >
              כניסה
            </Link>
          </div>
        )}

        {/* ── Save error toast ─────────────────────────────────── */}
        {saveError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-2xl mb-4 flex items-center justify-between">
            <span>{saveError}</span>
            <button onClick={() => setSaveError(null)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
          </div>
        )}

        {/* ── Legend ───────────────────────────────────────────── */}
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
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mr-auto">
            <span>מ=משחקים · נ=ניצחון · ת=תיקו · ה=הפסד · נק=נקודות</span>
          </div>
        </div>

        {/* ── Groups grid ──────────────────────────────────────── */}
        {loading ? (
          <Spinner size="lg" />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {GROUPS.map((group) => (
              <GroupCard
                key={group.name}
                group={group}
                allMatches={allMatches}
                prediction={predictions[group.name] ?? null}
                onPredictionSaved={handlePredictionSave}
                user={user}
              />
            ))}
          </div>
        )}
      </main>
    </>
  )
}
