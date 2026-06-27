import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Header from '../components/Layout/Header'
import KnockoutMatchCard from '../components/Bracket/KnockoutMatchCard'
import Spinner from '../components/UI/Spinner'

// Phase B page unlocks after group stage ends (June 28, 2026 00:00 UTC)
const BRACKET_UNLOCK = new Date('2026-06-28T00:00:00Z')
function isBracketUnlocked() { return new Date() >= BRACKET_UNLOCK }

// Round display config (used in UI)
const ROUNDS = [
  { id: 'round_of_32', label: 'שלב 32',      icon: '⚔️',  pts: 2  },
  { id: 'round_of_16', label: 'שמינית גמר',  icon: '🥊',  pts: 3  },
  { id: 'quarter',     label: 'רבע גמר',      icon: '🔥',  pts: 5  },
  { id: 'semi',        label: 'חצי גמר',      icon: '⚡',  pts: 8  },
  { id: 'third_place', label: 'מקום שלישי',   icon: '🥉',  pts: 3  },
  { id: 'final',       label: 'גמר',          icon: '🏆',  pts: 12 },
]

// Countdown to bracket unlock
function Countdown() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const diff = Math.max(0, BRACKET_UNLOCK - now)
  const days  = Math.floor(diff / 86400000)
  const hours = Math.floor((diff % 86400000) / 3600000)
  const mins  = Math.floor((diff % 3600000) / 60000)
  const secs  = Math.floor((diff % 60000) / 1000)

  const Digit = ({ n, label }) => (
    <div className="flex flex-col items-center gap-1">
      <div className="bg-slate-900 text-white text-2xl font-extrabold w-16 h-16
                      rounded-2xl flex items-center justify-center tabular-nums shadow-lg">
        {String(n).padStart(2, '0')}
      </div>
      <span className="text-xs text-slate-400 font-medium">{label}</span>
    </div>
  )

  return (
    <div className="flex items-center justify-center gap-3">
      <Digit n={days}  label="ימים" />
      <span className="text-slate-300 text-2xl font-black mt-0 pb-5">:</span>
      <Digit n={hours} label="שעות" />
      <span className="text-slate-300 text-2xl font-black pb-5">:</span>
      <Digit n={mins}  label="דקות" />
      <span className="text-slate-300 text-2xl font-black pb-5">:</span>
      <Digit n={secs}  label="שניות" />
    </div>
  )
}

// Round section
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
            locked={locked}
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

// ── Main page ─────────────────────────────────────────────────────
export default function BracketPage() {
  const { user }       = useAuth()
  const [bracketMatches, setBracketMatches] = useState([])
  const [predictions,    setPredictions]    = useState({})
  const [loading,        setLoading]        = useState(true)
  const [unlocked,       setUnlocked]       = useState(isBracketUnlocked)

  // Auto-unlock when countdown expires (for users who leave the tab open)
  useEffect(() => {
    if (unlocked) return
    const diff = BRACKET_UNLOCK.getTime() - Date.now()
    if (diff <= 0) { setUnlocked(true); return }
    const t = setTimeout(() => setUnlocked(true), diff)
    return () => clearTimeout(t)
  }, [unlocked])

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

  useEffect(() => {
    if (unlocked) fetchData()
    else setLoading(false)
  }, [fetchData, unlocked])

  // Group matches by round
  const byRound = {}
  for (const m of bracketMatches) {
    if (!byRound[m.round]) byRound[m.round] = []
    byRound[m.round].push(m)
  }

  // Points summary
  const totalPoints  = Object.values(predictions).reduce((s, p) => s + (p.points_earned ?? 0), 0)
  const correctPicks = Object.values(predictions).filter(p => p.is_graded && p.points_earned > 0).length

  return (
    <>
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-5 pb-24 space-y-6">

        {/* Page title */}
        <div className="flex items-center gap-3">
          <span className="text-3xl">🎯</span>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 leading-none">ברקט הנוקאאוט</h1>
            <p className="text-slate-400 text-xs mt-0.5">שלב 32 → גמר · מונדיאל 2026</p>
          </div>
        </div>

        {/* Header card */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600
                            rounded-xl flex items-center justify-center text-lg shadow-md">
              🎯
            </div>
            <div>
              <h2 className="font-extrabold text-base">מדרגי הנוקאאוט</h2>
              <p className="text-slate-400 text-xs">
                {unlocked
                  ? 'נחש מי יעלה בכל שלב'
                  : 'נפתח לאחר סיום שלב הבתים (28 ביוני 2026)'}
              </p>
            </div>
            <span className={`mr-auto text-xs font-bold px-2.5 py-1 rounded-full ${
              !unlocked
                ? 'bg-white/10 text-slate-400 border border-white/10'
                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            }`}>
              {!unlocked ? '🔒 נעול' : '✅ פתוח להימורים'}
            </span>
          </div>

          {/* Point breakdown */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
            {ROUNDS.filter(r => r.id !== 'third_place').map(r => (
              <div key={r.id} className="bg-white/10 rounded-xl py-2 px-1">
                <div className="text-lg font-extrabold text-white">{r.pts}</div>
                <div className="text-[10px] text-slate-400 leading-tight mt-0.5">{r.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Countdown (locked / pre-unlock) */}
        {!unlocked && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center space-y-4">
            <div className="text-4xl">⏳</div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-lg mb-1">המדרגי נפתח בעוד:</h3>
              <p className="text-xs text-slate-400">28 ביוני 2026 · לאחר סיום כל משחקי שלב הבתים</p>
            </div>
            <Countdown />
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700 font-medium">
              בינתיים — בחר את{' '}
              <Link to="/champion" className="font-extrabold underline">אלופת הטורניר</Link>
              {' '}שלך! (25 נקודות)
            </div>
          </div>
        )}

{/* Bracket content */}
        {unlocked && (
          <>
            {/* User stats */}
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
                <p className="text-sm text-slate-400">
                  יתעדכן אוטומטית לאחר סיום שלב הבתים
                </p>
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
                      locked={false}
                      onSaved={fetchData}
                    />
                  )
                })}
              </div>
            )}
          </>
        )}

      </main>
    </>
  )
}
