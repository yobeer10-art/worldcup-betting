import { useEffect, useState } from 'react'
import { Link }              from 'react-router-dom'
import { useAuth }           from '../context/AuthContext'
import { supabase }          from '../lib/supabase'
import { GROUPS, isPredictionLocked } from '../lib/groups'
import { TOP_SCORERS }       from '../lib/players'
import Header                from '../components/Layout/Header'
import FlagImg               from '../components/UI/FlagImg'
import Spinner               from '../components/UI/Spinner'

const ALL_TEAMS = [...new Set(GROUPS.flatMap(g => g.teams))]

// ── Community bar chart ────────────────────────────────────────────
function CommunityBar({ picks, valueKey, renderLabel }) {
  if (!picks?.length) return null
  const total  = picks.length
  const counts = {}
  picks.forEach(p => { counts[p[valueKey]] = (counts[p[valueKey]] ?? 0) + 1 })
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8)

  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 space-y-2.5">
      <h3 className="text-xs font-extrabold text-slate-500 uppercase tracking-wide">
        👥 בחירות הקהילה · {total} משתתפים
      </h3>
      {sorted.map(([val, count], i) => {
        const pct = Math.round((count / total) * 100)
        return (
          <div key={val} className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 w-4 shrink-0">{i + 1}.</span>
            {renderLabel(val)}
            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden min-w-0">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-yellow-300 rounded-full"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs font-bold text-amber-600 tabular-nums w-9 text-left shrink-0">
              {pct}%
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Section wrapper ────────────────────────────────────────────────
function Section({ icon, title, points, locked, children }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{icon}</span>
            <div>
              <h2 className="font-extrabold text-slate-800 leading-tight">{title}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{points} נקודות לניחוש נכון</p>
            </div>
          </div>
          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${
            locked
              ? 'bg-rose-50 border-rose-200 text-rose-600'
              : 'bg-emerald-50 border-emerald-200 text-emerald-600'
          }`}>
            {locked ? '🔒 נעול' : '✅ פתוח'}
          </span>
        </div>
      </div>
      {/* Body */}
      <div className="px-5 py-4 space-y-4">{children}</div>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════════
export default function SpecialPage() {
  const { user } = useAuth()
  const locked   = isPredictionLocked()

  // Champion state
  const [myChampion,  setMyChampion]  = useState(null)
  const [champBusy,   setChampBusy]   = useState(false)
  const [champSaved,  setChampSaved]  = useState(false)
  const [champAll,    setChampAll]    = useState([])

  // Top scorer state
  const [myScorer,    setMyScorer]    = useState(null)
  const [scorerBusy,  setScorerBusy]  = useState(false)
  const [scorerSaved, setScorerSaved] = useState(false)
  const [scorerAll,   setScorerAll]   = useState([])
  const [search,      setSearch]      = useState('')

  const [loading, setLoading] = useState(true)

  // ── Load ──────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const [cMyRes, cAllRes, sMyRes, sAllRes] = await Promise.all([
        user
          ? supabase.from('champion_predictions')
              .select('team, points_earned, is_graded')
              .eq('user_id', user.id).maybeSingle()
          : Promise.resolve({ data: null }),
        locked
          ? supabase.from('champion_predictions').select('team')
          : Promise.resolve({ data: [] }),
        user
          ? supabase.from('top_scorer_predictions')
              .select('player_name, points_earned, is_graded')
              .eq('user_id', user.id).maybeSingle()
          : Promise.resolve({ data: null }),
        locked
          ? supabase.from('top_scorer_predictions').select('player_name')
          : Promise.resolve({ data: [] }),
      ])
      setMyChampion(cMyRes.data  ?? null)
      setChampAll(cAllRes.data   ?? [])
      setMyScorer(sMyRes.data    ?? null)
      setScorerAll(sAllRes.data  ?? [])
      setLoading(false)
    }
    load()
  }, [user, locked])

  // ── Save champion ──────────────────────────────────────────────────
  async function pickChampion(team) {
    if (!user || locked || champBusy) return
    setChampBusy(true)
    const { error } = await supabase.from('champion_predictions').upsert(
      { user_id: user.id, team, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    if (!error) {
      setMyChampion(prev => ({ ...(prev ?? {}), team }))
      setChampSaved(true)
      setTimeout(() => setChampSaved(false), 2000)
    }
    setChampBusy(false)
  }

  // ── Save scorer ────────────────────────────────────────────────────
  async function pickScorer(player) {
    if (!user || locked || scorerBusy) return
    setScorerBusy(true)
    const { error } = await supabase.from('top_scorer_predictions').upsert(
      { user_id: user.id, player_name: player, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    if (!error) {
      setMyScorer(prev => ({ ...(prev ?? {}), player_name: player }))
      setScorerSaved(true)
      setTimeout(() => setScorerSaved(false), 2000)
    }
    setScorerBusy(false)
  }

  const filteredScorers = search.trim()
    ? TOP_SCORERS.filter(s =>
        s.player.includes(search.trim()) || s.team.includes(search.trim())
      )
    : TOP_SCORERS

  // ── Render ────────────────────────────────────────────────────────
  return (
    <>
      <Header />
      <main className="max-w-lg mx-auto px-4 pt-5 pb-28 space-y-5">

        {/* Page title */}
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">🏆 ניחושים מיוחדים</h1>
          <p className="text-slate-400 text-xs mt-0.5">
            25 נקודות לכל ניחוש נכון · נעול עם תחילת הטורניר (11.6.2026)
          </p>
        </div>

        {/* Guest CTA */}
        {!user && (
          <Link
            to="/auth"
            className="flex items-center justify-between bg-emerald-500 hover:bg-emerald-600
                       text-white font-bold px-5 py-3 rounded-2xl transition-colors shadow-sm"
          >
            <span>התחבר כדי לנחש</span>
            <span>←</span>
          </Link>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : (
          <>
            {/* ══════════════════════════════════════════════════════
                SECTION 1 — CHAMPION
            ══════════════════════════════════════════════════════ */}
            <Section icon="🥇" title="מי תיקח את הגביע?" points={25} locked={locked}>

              {/* Current pick */}
              {myChampion?.team && (
                <div className="flex items-center gap-3 bg-amber-50 border-2 border-amber-300
                                rounded-xl px-4 py-3">
                  <FlagImg team={myChampion.team} size="md" className="shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-amber-600 font-semibold">הבחירה שלך</p>
                    <p className="font-extrabold text-amber-900 truncate">{myChampion.team}</p>
                  </div>
                  {myChampion.is_graded && myChampion.points_earned > 0 && (
                    <span className="text-sm font-extrabold text-emerald-600 shrink-0">
                      +{myChampion.points_earned} נק׳ 🎉
                    </span>
                  )}
                  {champSaved && (
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50
                                     border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                      ✅ נשמר
                    </span>
                  )}
                </div>
              )}

              {/* Team grid (pre-lock) */}
              {!locked && user && (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {ALL_TEAMS.map(team => {
                    const active = myChampion?.team === team
                    return (
                      <button
                        key={team}
                        onClick={() => pickChampion(team)}
                        disabled={champBusy}
                        className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2
                                    transition-all duration-150 active:scale-95 text-center ${
                          active
                            ? 'border-amber-400 bg-amber-50 shadow-sm'
                            : 'border-slate-100 bg-white hover:border-amber-300 hover:bg-amber-50/60'
                        }`}
                      >
                        <FlagImg team={team} size="sm" />
                        <span className={`text-[9px] font-semibold leading-tight line-clamp-2 ${
                          active ? 'text-amber-800' : 'text-slate-600'
                        }`}>
                          {team}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Locked — no pick */}
              {locked && !myChampion?.team && user && (
                <p className="text-slate-400 text-sm text-center py-2">
                  לא בחרת אלופה לפני נעילה
                </p>
              )}

              {/* Community chart (post-lock) */}
              {locked && champAll.length > 0 && (
                <CommunityBar
                  picks={champAll}
                  valueKey="team"
                  renderLabel={val => (
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <FlagImg team={val} size="xs" className="shrink-0" />
                      <span className="text-xs font-semibold text-slate-700 truncate">{val}</span>
                    </div>
                  )}
                />
              )}
            </Section>

            {/* ══════════════════════════════════════════════════════
                SECTION 2 — TOP SCORER
            ══════════════════════════════════════════════════════ */}
            <Section icon="⚽" title="מי מלך השערים?" points={25} locked={locked}>

              {/* Current pick */}
              {myScorer?.player_name && (
                <div className="bg-sky-50 border-2 border-sky-300 rounded-xl px-4 py-3">
                  <p className="text-[10px] text-sky-600 font-semibold mb-0.5">הבחירה שלך</p>
                  <div className="flex items-center gap-2">
                    <FlagImg
                      team={TOP_SCORERS.find(s => s.player === myScorer.player_name)?.team ?? ''}
                      size="sm"
                      className="shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-extrabold text-sky-900 truncate">{myScorer.player_name}</p>
                      <p className="text-[10px] text-sky-500">
                        {TOP_SCORERS.find(s => s.player === myScorer.player_name)?.team ?? ''}
                      </p>
                    </div>
                    {myScorer.is_graded && myScorer.points_earned > 0 && (
                      <span className="text-sm font-extrabold text-emerald-600 shrink-0">
                        +{myScorer.points_earned} נק׳ 🎉
                      </span>
                    )}
                    {scorerSaved && (
                      <span className="text-xs font-bold text-emerald-600 bg-emerald-50
                                       border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                        ✅ נשמר
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Player list (pre-lock) */}
              {!locked && user && (
                <>
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="🔍 חפש שחקן או קבוצה..."
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm
                               focus:outline-none focus:border-sky-400 bg-white"
                    dir="rtl"
                  />

                  <div className="space-y-1.5 max-h-96 overflow-y-auto pr-0.5">
                    {filteredScorers.map(({ player, team }) => {
                      const active = myScorer?.player_name === player
                      return (
                        <button
                          key={player}
                          onClick={() => pickScorer(player)}
                          disabled={scorerBusy}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl
                                      border-2 text-right transition-all duration-150 active:scale-[0.98] ${
                            active
                              ? 'border-sky-400 bg-sky-50'
                              : 'border-slate-100 bg-white hover:border-sky-200 hover:bg-sky-50/40'
                          }`}
                        >
                          <FlagImg team={team} size="xs" className="shrink-0" />
                          <div className="flex-1 min-w-0 text-right">
                            <p className={`font-bold text-sm truncate ${
                              active ? 'text-sky-800' : 'text-slate-800'
                            }`}>
                              {player}
                            </p>
                            <p className="text-[10px] text-slate-400">{team}</p>
                          </div>
                          {active && (
                            <span className="text-sky-500 text-base shrink-0">✓</span>
                          )}
                        </button>
                      )
                    })}
                    {filteredScorers.length === 0 && (
                      <p className="text-center text-slate-400 text-sm py-6">לא נמצאו שחקנים</p>
                    )}
                  </div>

                  <p className="text-[10px] text-slate-400 text-center">
                    {TOP_SCORERS.length} שחקנים · ניתן לשנות עד נעילה
                  </p>
                </>
              )}

              {/* Locked — no pick */}
              {locked && !myScorer?.player_name && user && (
                <p className="text-slate-400 text-sm text-center py-2">
                  לא בחרת מלך שערים לפני נעילה
                </p>
              )}

              {/* Community chart (post-lock) */}
              {locked && scorerAll.length > 0 && (
                <CommunityBar
                  picks={scorerAll}
                  valueKey="player_name"
                  renderLabel={val => {
                    const entry = TOP_SCORERS.find(s => s.player === val)
                    return (
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {entry && <FlagImg team={entry.team} size="xs" className="shrink-0" />}
                        <span className="text-xs font-semibold text-slate-700 truncate">{val}</span>
                      </div>
                    )
                  }}
                />
              )}
            </Section>
          </>
        )}

      </main>
    </>
  )
}
