import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { GROUPS, isPredictionLocked, PREDICTION_DEADLINE } from '../lib/groups'
import Header from '../components/Layout/Header'
import FlagImg from '../components/UI/FlagImg'
import Spinner from '../components/UI/Spinner'

// ── All 48 WC 2026 teams extracted from the official group draw ──
const ALL_TEAMS = [...new Set(GROUPS.flatMap(g => g.teams))]

// ── Countdown component ────────────────────────────────────────────
function Countdown() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const diff  = Math.max(0, PREDICTION_DEADLINE - now)
  const days  = Math.floor(diff / 86_400_000)
  const hours = Math.floor((diff % 86_400_000) / 3_600_000)
  const mins  = Math.floor((diff % 3_600_000) / 60_000)
  const secs  = Math.floor((diff % 60_000) / 1000)

  return (
    <div className="flex items-center justify-center gap-2 text-sm font-extrabold text-amber-800 tabular-nums">
      {[
        { n: days,  label: 'ימים'  },
        { n: hours, label: 'שעות'  },
        { n: mins,  label: 'דקות'  },
        { n: secs,  label: 'שניות' },
      ].map(({ n, label }, i) => (
        <span key={label} className="flex items-center gap-0.5">
          {i > 0 && <span className="text-amber-400 mx-0.5">:</span>}
          <span className="bg-amber-900/10 rounded-lg px-1.5 py-0.5">
            {String(n).padStart(2, '0')} <span className="text-[9px] text-amber-600 font-semibold">{label}</span>
          </span>
        </span>
      ))}
    </div>
  )
}

// ── Community pick chart (post-lock) ──────────────────────────────
function CommunityChart({ picks }) {
  if (!picks || picks.length === 0) return null
  const total = picks.length
  // Count by team
  const counts = {}
  picks.forEach(p => {
    counts[p.team] = (counts[p.team] ?? 0) + 1
  })
  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)  // top 10 teams

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
      <h3 className="font-extrabold text-slate-800 flex items-center gap-2">
        <span className="text-xl">👥</span>
        בחירות הקהילה · {total} משתתפים
      </h3>
      <div className="space-y-2">
        {sorted.map(([team, count], i) => {
          const pct = Math.round((count / total) * 100)
          return (
            <div key={team} className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-bold w-5 text-left shrink-0">
                {i + 1}.
              </span>
              <FlagImg team={team} size="xs" />
              <span className="text-sm font-semibold text-slate-700 flex-1 truncate">{team}</span>
              <div className="w-24 h-2.5 bg-slate-100 rounded-full overflow-hidden shrink-0">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-yellow-300 rounded-full transition-all duration-700"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs font-extrabold text-amber-600 tabular-nums w-10 text-left shrink-0">
                {pct}%
              </span>
            </div>
          )
        })}
        {Object.keys(counts).length > 10 && (
          <p className="text-xs text-slate-400 text-center pt-1">
            +{Object.keys(counts).length - 10} קבוצות נוספות
          </p>
        )}
      </div>
    </div>
  )
}

// ── Team picker grid ──────────────────────────────────────────────
function TeamGrid({ teams, selected, onPick, disabled }) {
  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
      {teams.map(team => {
        const isSelected = selected === team
        return (
          <button
            key={team}
            onClick={() => !disabled && onPick(team)}
            disabled={disabled}
            className={`flex flex-col items-center gap-1.5 p-2 rounded-2xl border-2 transition-all duration-200 active:scale-95 text-center
              ${isSelected
                ? 'border-amber-400 bg-gradient-to-br from-amber-50 to-yellow-50 shadow-md shadow-amber-200/60'
                : disabled
                  ? 'border-slate-100 bg-white cursor-default'
                  : 'border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50/50 hover:shadow-sm'
              }`}
          >
            <FlagImg team={team} size="sm" />
            <span className={`text-[10px] font-bold leading-tight text-center line-clamp-2 ${
              isSelected ? 'text-amber-800' : 'text-slate-600'
            }`}>
              {team}
            </span>
            {isSelected && (
              <span className="text-[10px] text-amber-600 font-extrabold">✓ הבחירה שלי</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════
export default function ChampionPage() {
  const { user } = useAuth()
  const locked   = isPredictionLocked()

  const [myPick,      setMyPick]      = useState(null)
  const [saving,      setSaving]      = useState(false)
  const [justSaved,   setJustSaved]   = useState(false)
  const [saveErr,     setSaveErr]     = useState(null)
  const [communityPicks, setCommunityPicks] = useState([])
  const [loading,     setLoading]     = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [myRes, allRes] = await Promise.all([
      user
        ? supabase.from('champion_predictions').select('team').eq('user_id', user.id).maybeSingle()
        : Promise.resolve({ data: null }),
      locked
        ? supabase.from('champion_predictions').select('team')
        : Promise.resolve({ data: [] }),
    ])
    setMyPick(myRes.data?.team ?? null)
    setCommunityPicks(allRes.data ?? [])
    setLoading(false)
  }, [user, locked])

  useEffect(() => { load() }, [load])

  async function savePick(team) {
    if (!user || locked || saving) return
    setSaving(true); setSaveErr(null)
    const { error } = await supabase.from('champion_predictions').upsert(
      { user_id: user.id, team, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
    setSaving(false)
    if (error) { setSaveErr(error.message); return }
    setMyPick(team)
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 2000)
  }

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <>
      <Header />
      <main className="max-w-2xl mx-auto px-4 py-5 space-y-5">

        {/* Hero */}
        <div className="relative overflow-hidden bg-gradient-to-br from-amber-600 via-yellow-500 to-amber-400 rounded-3xl p-5 shadow-xl text-white">
          <div className="absolute -top-8 -end-8 text-[120px] opacity-10 pointer-events-none select-none">🏆</div>
          <div className="relative">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">🏆</span>
              <div>
                <h1 className="text-xl font-extrabold leading-tight">מי יזכה במונדיאל 2026?</h1>
                <p className="text-amber-100 text-sm">בחר את האלופה שלך — שווה 25 נקודות!</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="bg-white/20 text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/30">
                🎯 25 נקודות לניחוש נכון
              </span>
              <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
                locked
                  ? 'bg-red-500/30 border-red-300/40 text-red-100'
                  : 'bg-white/20 border-white/30 text-white'
              }`}>
                {locked ? '🔒 הבחירה ננעלה' : '✅ הבחירה פתוחה'}
              </span>
            </div>
          </div>
        </div>

        {loading ? (
          <Spinner size="lg" />
        ) : (
          <>
            {/* Current pick banner */}
            {myPick && (
              <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-2xl p-4 flex items-center gap-3">
                <FlagImg team={myPick} size="md" className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-amber-600 font-semibold">הבחירה שלי</p>
                  <p className="font-extrabold text-amber-900 text-lg truncate">{myPick}</p>
                </div>
                <span className="text-2xl shrink-0">⭐</span>
              </div>
            )}

            {/* Locked state */}
            {locked && !myPick && user && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
                <p className="text-slate-500 text-sm font-medium">לא בחרת אלופה לפני נעילה</p>
              </div>
            )}

            {/* Not logged in */}
            {!user && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-3">
                <p className="text-sm text-amber-800 font-medium">
                  {locked ? 'הבחירה ננעלה' : 'התחבר כדי לבחור אלופה'}
                </p>
                {!locked && (
                  <Link to="/auth"
                    className="shrink-0 text-sm bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2 rounded-xl transition-colors"
                  >
                    כניסה
                  </Link>
                )}
              </div>
            )}

            {/* Countdown (before lock) */}
            {!locked && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2 text-center">
                <p className="text-xs font-semibold text-amber-700">
                  הבחירה ננעלת בתחילת הטורניר
                </p>
                <Countdown />
              </div>
            )}

            {/* Team picker (before lock) */}
            {!locked && user && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-extrabold text-slate-800">בחר את האלופה שלך</h2>
                  {justSaved && (
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                      ✅ נשמר!
                    </span>
                  )}
                </div>
                {saveErr && <p className="text-xs text-red-500">{saveErr}</p>}
                {saving && (
                  <p className="text-xs text-slate-400 text-center">שומר...</p>
                )}
                <TeamGrid
                  teams={ALL_TEAMS}
                  selected={myPick}
                  onPick={savePick}
                  disabled={saving}
                />
                <p className="text-[10px] text-slate-400 text-center">
                  48 קבוצות · לחץ על קבוצה כדי לבחור. ניתן לשנות עד נעילה.
                </p>
              </div>
            )}

            {/* Community picks (post-lock) */}
            {locked && communityPicks.length > 0 && (
              <CommunityChart picks={communityPicks} />
            )}

            {/* Locked + no community data yet */}
            {locked && communityPicks.length === 0 && (
              <div className="text-center py-6 text-slate-400 text-sm">
                אין נתוני קהילה להצגה עדיין
              </div>
            )}
          </>
        )}

      </main>
    </>
  )
}
