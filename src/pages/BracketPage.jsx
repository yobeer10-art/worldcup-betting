import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Header from '../components/Layout/Header'
import KnockoutMatchCard from '../components/Bracket/KnockoutMatchCard'
import Spinner from '../components/UI/Spinner'

// ── Bracket feed-forward maps ──────────────────────────────────────────────
// For each match slot, which match's outcome (winner/loser) fills it?
const FEED_SOURCE = {
   89: { home: { m:  74 }, away: { m:  77 } },
   90: { home: { m:  73 }, away: { m:  75 } },
   91: { home: { m:  76 }, away: { m:  78 } },
   92: { home: { m:  79 }, away: { m:  80 } },
   93: { home: { m:  83 }, away: { m:  84 } },
   94: { home: { m:  81 }, away: { m:  82 } },
   95: { home: { m:  86 }, away: { m:  88 } },
   96: { home: { m:  85 }, away: { m:  87 } },
   97: { home: { m:  89 }, away: { m:  90 } },
   98: { home: { m:  93 }, away: { m:  94 } },
   99: { home: { m:  91 }, away: { m:  92 } },
  100: { home: { m:  95 }, away: { m:  96 } },
  101: { home: { m:  97 }, away: { m:  98 } },
  102: { home: { m:  99 }, away: { m: 100 } },
  103: { home: { m: 101, loser: true }, away: { m: 102, loser: true } },
  104: { home: { m: 101 }, away: { m: 102 } },
}

// Winner advance path (for cascade-invalidation traversal)
const ADVANCE = {
   73: { to:  90 },  74: { to:  89 },  75: { to:  90 },  76: { to:  91 },
   77: { to:  89 },  78: { to:  91 },  79: { to:  92 },  80: { to:  92 },
   81: { to:  94 },  82: { to:  94 },  83: { to:  93 },  84: { to:  93 },
   85: { to:  96 },  86: { to:  95 },  87: { to:  96 },  88: { to:  95 },
   89: { to:  97 },  90: { to:  97 },  91: { to:  99 },  92: { to:  99 },
   93: { to:  98 },  94: { to:  98 },  95: { to: 100 },  96: { to: 100 },
   97: { to: 101 },  98: { to: 101 },  99: { to: 102 }, 100: { to: 102 },
  101: { to: 104 }, 102: { to: 104 },
}

// SF losers also feed third-place
const LOSER_TO = { 101: 103, 102: 103 }

// All downstream match numbers reachable from matchNum (via winner and loser paths)
function getDownstreamOf(mn) {
  const seen = new Set()
  const queue = [mn]
  while (queue.length) {
    const cur = queue.shift()
    if (ADVANCE[cur] && !seen.has(ADVANCE[cur].to)) {
      seen.add(ADVANCE[cur].to)
      queue.push(ADVANCE[cur].to)
    }
    if (LOSER_TO[cur] && !seen.has(LOSER_TO[cur])) {
      seen.add(LOSER_TO[cur])
      // M103 feeds nowhere further
    }
  }
  return [...seen]
}

// Pure: resolve the effective team for one slot given current predByNum.
// Returns { team: string, predicted: boolean } or null.
// `predicted: true` means the team comes from the user's own upstream pick,
// not from confirmed DB data — rendered with lighter/dashed style.
function getEff(mn, slot, matchByNum, predByNum) {
  const match = matchByNum[mn]
  if (!match) return null

  // Real confirmed team from DB (seeded from group results or real match result)
  const real = slot === 'home' ? match.home_team : match.away_team
  if (real) return { team: real, predicted: false }

  const src = FEED_SOURCE[mn]?.[slot]
  if (!src) return null

  const feedMatch = matchByNum[src.m]
  if (!feedMatch) return null

  if (src.loser) {
    // M103 slots: loser of M101 / M102
    if (feedMatch.status === 'finished' && feedMatch.result) {
      const lt = feedMatch.result === 'home' ? feedMatch.away_team : feedMatch.home_team
      return lt ? { team: lt, predicted: false } : null
    }
    const pick = predByNum[src.m]
    if (pick) {
      const h = getEff(src.m, 'home', matchByNum, predByNum)
      const a = getEff(src.m, 'away', matchByNum, predByNum)
      if (h && a) {
        const loser = pick === h.team ? a.team : h.team
        return { team: loser, predicted: true }
      }
    }
    return null
  } else {
    // Winner path
    if (feedMatch.status === 'finished' && feedMatch.result) {
      const wt = feedMatch.result === 'home' ? feedMatch.home_team : feedMatch.away_team
      return wt ? { team: wt, predicted: false } : null
    }
    const pick = predByNum[src.m]
    return pick ? { team: pick, predicted: true } : null
  }
}

// ── Round config ───────────────────────────────────────────────────────────
const ROUNDS = [
  { id: 'round_of_32', label: 'שלב 32',     icon: '⚔️', pts: 2  },
  { id: 'round_of_16', label: 'שמינית גמר', icon: '🥊', pts: 3  },
  { id: 'quarter',     label: 'רבע גמר',    icon: '🔥', pts: 5  },
  { id: 'semi',        label: 'חצי גמר',    icon: '⚡', pts: 8  },
  { id: 'third_place', label: 'מקום שלישי', icon: '🥉', pts: 3  },
  { id: 'final',       label: 'גמר',        icon: '🏆', pts: 12 },
]

function RoundSection({ round, matches, renderCard }) {
  const cfg      = ROUNDS.find(r => r.id === round)
  const total    = matches.length
  const finished = matches.filter(m => m.status === 'finished').length

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">{cfg?.icon}</span>
        <div>
          <h3 className="font-extrabold text-slate-800">{cfg?.label}</h3>
          <p className="text-xs text-slate-400">
            {total} משחקים{cfg && ` · ${cfg.pts} נק׳ לניחוש נכון`}
          </p>
        </div>
        {finished === total && total > 0 && (
          <span className="mr-auto text-xs bg-emerald-100 text-emerald-700
                           px-2.5 py-1 rounded-full font-semibold">
            ✅ הסתיים
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {matches.map(m => renderCard(m))}
        {total === 0 && (
          <div className="col-span-2 text-center text-slate-400 py-6 text-sm">
            המשחקים ייקבעו בהמשך
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function BracketPage() {
  const { user } = useAuth()
  const [bracketMatches, setBracketMatches] = useState([])
  const [predictions,    setPredictions]    = useState({})  // keyed by bracket_match_id
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

  // ── Derived lookup tables ─────────────────────────────────────────────
  const matchByNum = useMemo(() => {
    const out = {}
    for (const m of bracketMatches) {
      if (m.match_number) out[m.match_number] = m
    }
    return out
  }, [bracketMatches])

  // match_number → user's predicted winner team name
  const predByNum = useMemo(() => {
    const out = {}
    for (const m of bracketMatches) {
      if (!m.match_number) continue
      const p = predictions[m.id]
      if (p?.predicted_winner) out[m.match_number] = p.predicted_winner
    }
    return out
  }, [bracketMatches, predictions])

  // ── Pick handler with cascade-invalidation ────────────────────────────
  async function handlePick(matchNum, teamName) {
    if (!user) return
    const match = matchByNum[matchNum]
    if (!match) return

    // Simulate new predByNum with this pick
    const newPbn = { ...predByNum, [matchNum]: teamName }

    // Walk downstream; clear any pick whose team is no longer in the effective lineup
    const downstream = getDownstreamOf(matchNum)
    const toClear = []
    for (const dn of downstream) {
      const existingPick = newPbn[dn]
      if (!existingPick) continue
      const h = getEff(dn, 'home', matchByNum, newPbn)
      const a = getEff(dn, 'away', matchByNum, newPbn)
      if (existingPick !== h?.team && existingPick !== a?.team) {
        toClear.push(dn)
        delete newPbn[dn]
      }
    }

    // Optimistic local state update
    const newPredictions = { ...predictions }
    newPredictions[match.id] = {
      ...(predictions[match.id] ?? {}),
      bracket_match_id: match.id,
      user_id: user.id,
      predicted_winner: teamName,
    }
    for (const mn of toClear) {
      const m = matchByNum[mn]
      if (m) delete newPredictions[m.id]
    }
    setPredictions(newPredictions)

    // Persist to DB (fire-and-forget; no full reload needed)
    supabase.from('knockout_predictions').upsert(
      { user_id: user.id, bracket_match_id: match.id, predicted_winner: teamName },
      { onConflict: 'user_id,bracket_match_id' },
    )
    for (const mn of toClear) {
      const m = matchByNum[mn]
      if (m) {
        supabase.from('knockout_predictions')
          .delete()
          .eq('user_id', user.id)
          .eq('bracket_match_id', m.id)
      }
    }
  }

  // ── Group by round ────────────────────────────────────────────────────
  const byRound = {}
  for (const m of bracketMatches) {
    if (!byRound[m.round]) byRound[m.round] = []
    byRound[m.round].push(m)
  }

  const totalPoints  = Object.values(predictions).reduce((s, p) => s + (p.points_earned ?? 0), 0)
  const correctPicks = Object.values(predictions).filter(p => p.is_graded && p.points_earned > 0).length

  // Render one card, computing effective teams from the user's flow-forward picks
  function renderCard(m) {
    const mn  = m.match_number
    const src = FEED_SOURCE[mn]

    const homeInfo = getEff(mn, 'home', matchByNum, predByNum)
    const awayInfo = getEff(mn, 'away', matchByNum, predByNum)

    // Placeholder label when no team known yet
    const homeSrc = src
      ? (src.home.loser ? `מפסיד M${src.home.m}` : `מנצח M${src.home.m}`)
      : (m.home_source ?? null)
    const awaySrc = src
      ? (src.away.loser ? `מפסיד M${src.away.m}` : `מנצח M${src.away.m}`)
      : (m.away_source ?? null)

    return (
      <KnockoutMatchCard
        key={m.id}
        match={m}
        homeTeam={homeInfo?.team ?? null}
        awayTeam={awayInfo?.team ?? null}
        homePredicted={homeInfo?.predicted ?? false}
        awayPredicted={awayInfo?.predicted ?? false}
        homeSource={homeSrc}
        awaySource={awaySrc}
        prediction={predictions[m.id] ?? null}
        onPick={(team) => handlePick(mn, team)}
      />
    )
  }

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
              <p className="text-slate-400 text-xs">
                נחש מי יעלה בכל שלב · הניחוש זורם קדימה אוטומטית
              </p>
            </div>
            <span className="mr-auto text-xs font-bold px-2.5 py-1 rounded-full
                             bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              ✅ פתוח
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
                          rounded-2xl px-5 py-3">
            <p className="font-extrabold text-emerald-800 text-sm">🏆 ניחושים נכונים: {correctPicks}</p>
            <p className="text-xs text-emerald-600 mt-0.5">{totalPoints} נקודות מהמדרגי עד כה</p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : bracketMatches.length === 0 ? (
          <div className="text-center py-12 space-y-3">
            <div className="text-5xl">⏳</div>
            <p className="text-slate-500 font-semibold">המדרגי עדיין לא הוגדר</p>
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
                  renderCard={renderCard}
                />
              )
            })}
          </div>
        )}

      </main>
    </>
  )
}
