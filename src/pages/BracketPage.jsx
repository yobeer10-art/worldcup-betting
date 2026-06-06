import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { GROUPS, isPredictionLocked } from '../lib/groups'
import Header from '../components/Layout/Header'
import KnockoutMatchCard from '../components/Bracket/KnockoutMatchCard'
import Spinner from '../components/UI/Spinner'

// ── Phase B unlocks after group stage ends (June 28, 2026 00:00 UTC)
const BRACKET_UNLOCK = new Date('2026-06-28T00:00:00Z')
function isBracketUnlocked() { return new Date() >= BRACKET_UNLOCK }

// ── Round display config ──────────────────────────────────────
const ROUNDS = [
  { id: 'round_of_32', label: 'שלב 32',        icon: '⚔️',  pts: 1  },
  { id: 'round_of_16', label: 'שמינית גמר',    icon: '🥊',  pts: 2  },
  { id: 'quarter',     label: 'רבע גמר',        icon: '🔥',  pts: 4  },
  { id: 'semi',        label: 'חצי גמר',        icon: '⚡',  pts: 8  },
  { id: 'third_place', label: 'מקום שלישי',     icon: '🥉',  pts: 4  },
  { id: 'final',       label: 'גמר',            icon: '🏆',  pts: 16 },
]

// ── Countdown component ───────────────────────────────────────
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
      <div className="bg-slate-900 text-white text-2xl font-extrabold w-16 h-16 rounded-2xl flex items-center justify-center tabular-nums shadow-lg">
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

// ── Phase A summary card ──────────────────────────────────────
function PhaseACard({ user }) {
  const [predCount, setPredCount] = useState(null)
  useEffect(() => {
    if (!user) return
    supabase.from('group_predictions').select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .then(({ count }) => setPredCount(count ?? 0))
  }, [user])

  const locked = isPredictionLocked()
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center text-lg shadow-sm">
          🏟️
        </div>
        <div>
          <h3 className="font-extrabold text-slate-800 text-sm">שלב א׳ — ניחושי בתים</h3>
          <p className="text-xs text-slate-400">מי ינצח בכל בית?</p>
        </div>
        <span className={`mr-auto text-xs font-bold px-2.5 py-1 rounded-full ${
          locked ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'
        }`}>
          {locked ? '🔒 נעול' : '✅ פתוח'}
        </span>
      </div>

      {user ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-600">
            ניחשת{' '}
            <span className="font-extrabold text-emerald-600 text-lg">{predCount ?? '…'}</span>
            {' '}מתוך{' '}
            <span className="font-bold">{GROUPS.length}</span> בתים
          </p>
          <Link
            to="/groups"
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl transition-colors"
          >
            {locked || predCount === GROUPS.length ? 'צפה בבתים' : 'השלם ניחושים'}
          </Link>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">התחבר כדי לנחש</p>
          <Link to="/auth" className="text-xs bg-emerald-600 text-white font-bold px-3 py-1.5 rounded-xl">
            כניסה
          </Link>
        </div>
      )}
    </div>
  )
}

// ── Round section ─────────────────────────────────────────────
function RoundSection({ round, matches, predictions, onSaved }) {
  const cfg   = ROUNDS.find(r => r.id === round)
  const total = matches.length
  const userPredicted = predictions ? Object.keys(predictions).length : 0
  const finished  = matches.filter(m => m.status === 'finished').length
  const teamsKnown = matches.filter(m => m.home_team && m.away_team).length

  return (
    <div>
      {/* Round header */}
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
          <span className="mr-auto text-xs bg-slate-100 text-slate-500 px-2.5 py-1 rounded-full font-medium">
            {teamsKnown}/{total} קבוצות ידועות
          </span>
        )}
        {teamsKnown === total && userPredicted < total && (
          <span className="mr-auto text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2.5 py-1 rounded-full font-semibold">
            ניחשת {userPredicted}/{total}
          </span>
        )}
        {finished === total && total > 0 && (
          <span className="mr-auto text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-semibold">
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

// ── Main page ─────────────────────────────────────────────────
export default function BracketPage() {
  const { user }       = useAuth()
  const [bracketMatches, setBracketMatches] = useState([])
  const [predictions,    setPredictions]    = useState({}) // { matchId: row }
  const [loading,        setLoading]        = useState(true)
  const [unlocked]       = useState(isBracketUnlocked)

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

  useEffect(() => { if (unlocked) { fetchData() } else { setLoading(false) } }, [fetchData, unlocked])

  // Group matches by round
  const byRound = {}
  for (const m of bracketMatches) {
    if (!byRound[m.round]) byRound[m.round] = []
    byRound[m.round].push(m)
  }

  // Points summary
  const totalPoints = Object.values(predictions).reduce(
    (sum, p) => sum + (p.points_earned ?? 0), 0
  )
  const correctPicks = Object.values(predictions).filter(p => p.is_graded && p.points_earned > 0).length

  return (
    <>
      <Header />
      <main className="max-w-5xl mx-auto px-4 py-5 space-y-6">

        {/* Page title */}
        <div className="flex items-center gap-3">
          <span className="text-3xl">🏆</span>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 leading-none">שלב הנוקאאוט</h1>
            <p className="text-slate-400 text-xs mt-0.5">
              שלב הבתים → שלב 32 → גמר · מונדיאל 2026
            </p>
          </div>
        </div>

        {/* Phase A */}
        <PhaseACard user={user} />

        {/* Phase B header */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-5 text-white shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-lg shadow-md">
              🎯
            </div>
            <div>
              <h2 className="font-extrabold text-base">שלב ב׳ — מדרגי הנוקאאוט</h2>
              <p className="text-slate-400 text-xs">
                נפתח לאחר סיום שלב הבתים (28 ביוני 2026)
              </p>
            </div>
            <span className={`mr-auto text-xs font-bold px-2.5 py-1 rounded-full ${
              unlocked ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                       : 'bg-white/10 text-slate-400 border border-white/10'
            }`}>
              {unlocked ? '✅ פתוח' : '🔒 נעול'}
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

        {/* Countdown (if locked) */}
        {!unlocked && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center space-y-4">
            <div className="text-4xl">⏳</div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-lg mb-1">
                המדרגי נפתח בעוד:
              </h3>
              <p className="text-xs text-slate-400">28 ביוני 2026 · לאחר סיום כל משחקי שלב הבתים</p>
            </div>
            <Countdown />
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-700 font-medium">
              בינתיים — נחש מי יעלה מכל בית בעמוד{' '}
              <Link to="/groups" className="font-extrabold underline">הבתים</Link>!
            </div>
          </div>
        )}

        {/* Bracket content (when unlocked) */}
        {unlocked && (
          <>
            {/* User stats */}
            {user && correctPicks > 0 && (
              <div className="bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-2xl px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="font-extrabold text-emerald-800 text-sm">
                    🏆 ניחוש מדרגי נכונים: {correctPicks}
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
                  המנהל יגדיר את המשחקים לאחר סיום שלב הבתים
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
