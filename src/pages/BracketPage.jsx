import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { FEED_SOURCE, ADVANCE, LOSER_TO, getDownstreamOf, getEff } from '../lib/bracketUtils'
import Header from '../components/Layout/Header'
import KnockoutMatchCard from '../components/Bracket/KnockoutMatchCard'
import BracketExportCanvas from '../components/Bracket/BracketExportCanvas'
import Spinner from '../components/UI/Spinner'

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
  const { user, profile } = useAuth()
  const [bracketMatches, setBracketMatches] = useState([])
  const [predictions,    setPredictions]    = useState({})  // keyed by bracket_match_id
  const [loading,        setLoading]        = useState(true)
  const [downloading,    setDownloading]    = useState(false)
  const exportRef = useRef(null)

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

    // Snapshot pre-update state so the DB write uses the correct existing ids
    const predBefore   = predictions[match.id]   // may have .id if already in DB
    const clearBefore  = {}
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
        const cm = matchByNum[dn]
        if (cm) clearBefore[dn] = predictions[cm.id]   // snapshot before optimistic clear
      }
    }

    // Optimistic local state update (instant UI response)
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

    // ── Persist to DB ────────────────────────────────────────────────
    // Use INSERT-or-UPDATE keyed by the row's own `id` so we don't need
    // a UNIQUE constraint.  The upsert(onConflict) pattern requires one and
    // fails silently (PostgreSQL error 42P10) when it doesn't exist.
    ;(async () => {
      try {
        if (predBefore?.id) {
          // Row already exists in DB → UPDATE it
          const { error } = await supabase
            .from('knockout_predictions')
            .update({ predicted_winner: teamName })
            .eq('id', predBefore.id)
          if (error) throw error
        } else {
          // New prediction → INSERT and capture the returned id
          const { data, error } = await supabase
            .from('knockout_predictions')
            .insert({ user_id: user.id, bracket_match_id: match.id, predicted_winner: teamName })
            .select('id')
            .single()
          if (error) throw error
          // Store the DB-assigned id so the next change on this match uses UPDATE
          if (data?.id) {
            setPredictions(prev => ({
              ...prev,
              [match.id]: { ...(prev[match.id] ?? {}), id: data.id },
            }))
          }
        }

        // Delete cleared downstream predictions
        for (const mn of toClear) {
          const m = matchByNum[mn]
          if (!m) continue
          const pred = clearBefore[mn]
          if (pred?.id) {
            const { error } = await supabase
              .from('knockout_predictions')
              .delete()
              .eq('id', pred.id)
            if (error) console.error('[bracket] delete cleared pick failed:', error)
          }
        }
      } catch (err) {
        console.error('[bracket] save pick failed — reverting to DB state:', err)
        fetchData()   // revert optimistic state
      }
    })()
  }

  // ── Download bracket image ────────────────────────────────────────────
  async function downloadBracket() {
    if (!exportRef.current || downloading) return
    setDownloading(true)
    try {
      const canvas = await html2canvas(exportRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: null,
        logging: false,
      })
      canvas.toBlob(blob => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a   = document.createElement('a')
        a.href     = url
        a.download = `bracket-${(profile?.display_name ?? 'my')}-2026.png`
        a.click()
        setTimeout(() => URL.revokeObjectURL(url), 2000)
      }, 'image/png')
    } catch (err) {
      console.error('bracket export failed:', err)
    } finally {
      setDownloading(false)
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
          <div className="flex-1">
            <h1 className="text-2xl font-extrabold text-slate-800 leading-none">ברקט הנוקאאוט</h1>
            <p className="text-slate-400 text-xs mt-0.5">שלב 32 → גמר · מונדיאל 2026</p>
          </div>
          {user && (
            <button
              onClick={downloadBracket}
              disabled={downloading || loading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold
                         bg-emerald-600 text-white shadow-sm
                         hover:bg-emerald-700 active:scale-95 transition-all
                         disabled:opacity-50 disabled:cursor-wait"
            >
              {downloading ? '⏳' : '📸'}
              <span className="hidden sm:inline">{downloading ? 'מייצר...' : 'הורד ברקט'}</span>
            </button>
          )}
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

      {/* Hidden export canvas — captured by html2canvas on download */}
      <BracketExportCanvas
        ref={exportRef}
        bracketMatches={bracketMatches}
        matchByNum={matchByNum}
        predByNum={predByNum}
        userName={profile?.display_name ?? user?.email?.split('@')[0] ?? 'שחקן'}
      />
    </>
  )
}
