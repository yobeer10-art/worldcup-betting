import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Header from '../components/Layout/Header'
import KnockoutMatchCard from '../components/Bracket/KnockoutMatchCard'
import Spinner from '../components/UI/Spinner'

const ROUNDS = [
  { id: 'round_of_32', label: 'שלב 32',      icon: '⚔️',  pts: 2  },
  { id: 'round_of_16', label: 'שמינית גמר',  icon: '🥊',  pts: 3  },
  { id: 'quarter',     label: 'רבע גמר',      icon: '🔥',  pts: 5  },
  { id: 'semi',        label: 'חצי גמר',      icon: '⚡',  pts: 8  },
  { id: 'third_place', label: 'מקום שלישי',   icon: '🥉',  pts: 3  },
  { id: 'final',       label: 'גמר',          icon: '🏆',  pts: 12 },
]

function RoundSection({ round, matches, predictions, onSaved }) {
  const cfg        = ROUNDS.find(r => r.id === round)
  const total      = matches.length
  const finished   = matches.filter(m => m.status === 'finished').length
  const teamsKnown = matches.filter(m => m.home_team && m.away_team).length
  const userPicked = predictions ? Object.keys(predictions).length : 0

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{cfg?.icon}</span>
        <div>
          <h3 className="font-extrabold text-slate-800">{cfg?.label}</h3>
          <p className="text-xs text-slate-400">
            {`${total} משחקים`}
            {cfg && ` · ${cfg.pts} נק׳ לניחוש נכון`}
          </p>
        </div>
        {teamsKnown < total && (
          <span className="mr-auto text-xs bg-slate-100 text-slate-500
                           px-2.5 py-1 rounded-full font-medium">
            {teamsKnown}/{total} קבוצות ידועות
          </span>
        )}
        {teamsKnown === total && userPicked < total && (
          <span className="mr-auto text-xs bg-blue-50 text-blue-600 border border-blue-200
                           px-2.5 py-1 rounded-full font-semibold">
            ניחשת {userPicked}/{total}
          </span>
        )}
        {finished === total && total > 0 && (
          <span className="mr-auto text-xs bg-emerald-100 text-emerald-700
                           px-2.5 py-1 rounded-full font-semibold">
            ✅ הסתיים
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {matches.map(m => (
          <KnockoutMatchCard
            key={m.id}
            match={m}
            prediction={predictions?.[m.id] ?? null}
            onSaved={onSaved}
          />
        ))}
        {total === 0 && (
          <div className="col-span-2 text-center text-slate-400 py-6 text-sm">
            המשחקים ייקבעו לאחר סיום שלב הבתים
          </div>
        )}
      </div>
    </div>
  )
}

export default function BracketPage() {
  const { user }       = useAuth()
  const [bracketMatches, setBracketMatches] = useState([])
  const [predictions,    setPredictions]    = useState({})
  const [loading,        setLoading]        = useState(true)

  const fetchData = useCallback(async () => {
    const [matchRes, predRes] = await Promise.all([
      supabase
        .from('knockout_bracket_matches')
        .select('*')
        .order('round')
        .order('position'),
      user
        ? supabase.from('knockout_predictions').select('*').eq('user_id', user.id)
        : Promise.resolve({ data: [] }),
    ])
    setBracketMatches(matchRes.data ?? [])
    const map = {}
    predRes.data?.forEach(p => { map[p.bracket_match_id] = p })
    setPredictions(map)
    setLoading(false)
  }, [user])

  useEffect(() => { fetchData() }, [fetchData])

  const byRound = {}
  for (const m of bracketMatches) {
    if (!byRound[m.round]) byRound[m.round] = []
    byRound[m.round].push(m)
  }

  const totalPoints  = Object.values(predictions).reduce((s, p) => s + (p.points_earned ?? 0), 0)
  const correctPicks = Object.values(predictions).filter(p => p.is_graded && p.points_earned > 0).length

  return (
    <>
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-5 pb-24 space-y-6">

        <div className="flex items-center gap-3">
          <span className="text-3xl">🎯</span>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 leading-none">ברקט הנוקאאוט</h1>
            <p className="text-slate-400 text-xs mt-0.5">שלב 32 → גמר · מונדיאל 2026</p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600
                            rounded-xl flex items-center justify-center text-lg shadow-md">
              🎯
            </div>
            <div>
              <h2 className="font-extrabold text-base">מדרגי הנוקאאוט</h2>
              <p className="text-slate-400 text-xs">נחש מי יעלה בכל שלב · כל משחק ננעל 5 דקות לפני קיקאוף</p>
            </div>
            <span className="mr-auto text-xs font-bold px-2.5 py-1 rounded-full
                             bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              ✅ פתוח להימורים
            </span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
            {ROUNDS.filter(r => r.id !== 'third_place').map(r => (
              <div key={r.id} className="bg-white/10 rounded-xl py-2 px-1">
                <div className="text-lg font-extrabold text-white">{r.pts}</div>
                <div className="text-[10px] text-slate-400 leading-tight mt-0.5">{r.label}</div>
              </div>
            ))}
          </div>
        </div>

        {user && correctPicks > 0 && (
          <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200
                          rounded-2xl px-5 py-3 flex items-center justify-between">
            <div>
              <p className="font-extrabold text-emerald-800 text-sm">
                🏆 ניחושים נכונים: {correctPicks}
              </p>
              <p className="text-xs text-emerald-600 mt-0.5">
                {totalPoints} נקודות מהמדרגי עד כה
              </p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : bracketMatches.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <div className="text-5xl">⏳</div>
            <p className="text-slate-500 font-semibold">המדרגי עדיין לא הוגדר</p>
            <p className="text-sm text-slate-400">יתעדכן אוטומטית לאחר סיום שלב הבתים</p>
          </div>
        ) : (
          <div className="space-y-8">
            {ROUNDS.map(({ id }) => {
              const matches = byRound[id] ?? []
              if (matches.length === 0 && id !== 'round_of_32') return null
              return (
                <RoundSection
                  key={id}
                  round={id}
                  matches={matches}
                  predictions={predictions}
                  onSaved={fetchData}
                />
              )
            })}
          </div>
        )}

      </main>
    </>
  )
}
