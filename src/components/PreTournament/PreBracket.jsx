import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { GROUPS } from '../../lib/groups'
import FlagImg from '../UI/FlagImg'
import Spinner from '../UI/Spinner'

// ── All 48 teams from the official draw ──────────────────────────
const ALL_TEAMS = GROUPS.flatMap(g => g.teams)
const GROUPS_ARR = GROUPS.map(g => g.name) // ['א','ב',...]

// ── R32 match seedings (index into GROUPS_ARR, place=1|2) ─────────
// Pairs group winners (1) against runners-up (2) from crossing halves
// Matches 13-16 are for the 8 best 3rd-place teams (free selection)
const R32_SEEDS = [
  [['א', 1], ['ב', 2]],   // 1
  [['ג', 1], ['ד', 2]],   // 2
  [['ה', 1], ['ו', 2]],   // 3
  [['ז', 1], ['ח', 2]],   // 4
  [['ט', 1], ['י', 2]],   // 5
  [['יא', 1], ['יב', 2]], // 6
  [['ב', 1], ['א', 2]],   // 7
  [['ד', 1], ['ג', 2]],   // 8
  [['ו', 1], ['ה', 2]],   // 9
  [['ח', 1], ['ז', 2]],   // 10
  [['י', 1], ['ט', 2]],   // 11
  [['יב', 1], ['יא', 2]], // 12
  [null, null],            // 13 – 3rd place (free)
  [null, null],            // 14 – 3rd place (free)
  [null, null],            // 15 – 3rd place (free)
  [null, null],            // 16 – 3rd place (free)
]

// ── Round config ──────────────────────────────────────────────────
const ROUNDS = [
  { id: 'r32',   label: 'שלב 32',      n: 16 },
  { id: 'r16',   label: 'שמינית גמר',  n: 8  },
  { id: 'qf',    label: 'רבע גמר',     n: 4  },
  { id: 'semi',  label: 'חצי גמר',     n: 2  },
  { id: 'final', label: 'גמר',         n: 1  },
]
const ROUND_IDS = ROUNDS.map(r => r.id)

// prev round and its n
function prevRound(roundId) {
  const idx = ROUND_IDS.indexOf(roundId)
  return idx > 0 ? ROUND_IDS[idx - 1] : null
}

// For rounds after r32: teams come from previous-round picks
// Match N in current round → picks [(N-1)*2+1, N*2] in previous round
function getTeamsFromPicks(roundId, matchNum, picks) {
  const prev = prevRound(roundId)
  if (!prev) return [null, null]
  return [
    picks[prev]?.[(matchNum - 1) * 2 + 1] ?? null,
    picks[prev]?.[matchNum * 2] ?? null,
  ]
}

// For r32: derive team from group predictions
function getR32Team(seedSlot, groupPreds) {
  if (!seedSlot) return null
  const [groupName, place] = seedSlot
  const pred = groupPreds[groupName]
  if (!pred) return null
  return place === 1 ? pred.first_place : pred.second_place
}

/* ── Team picker button ──────────────────────────────────────── */
function TeamBtn({ team, picked, onPick, disabled, placeholder }) {
  if (!team) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-xs text-slate-300 font-medium">
        <span className="w-5 h-4 bg-slate-100 rounded-sm inline-block" />
        {placeholder ?? '?'}
      </div>
    )
  }
  return (
    <button
      onClick={() => !disabled && onPick(team)}
      disabled={disabled}
      className={`flex items-center gap-2 w-full px-2 py-1.5 rounded-xl text-xs font-semibold border-2 transition-all duration-150 active:scale-[0.97] text-right ${
        picked
          ? 'border-emerald-400 bg-emerald-50 text-emerald-800 shadow-sm'
          : disabled
            ? 'border-slate-100 bg-white text-slate-400'
            : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/60'
      }`}
    >
      <FlagImg team={team} size="xs" />
      <span className="truncate flex-1">{team}</span>
      {picked && <span className="text-emerald-500 text-[10px] shrink-0">✓</span>}
    </button>
  )
}

/* ── Free-select team picker (for 3rd-place R32 slots) ─────── */
function FreeTeamPicker({ value, onChange, disabled, label }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        className="flex items-center gap-2 w-full px-2 py-1.5 rounded-xl text-xs font-semibold border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 hover:border-emerald-300 transition-all"
      >
        {value ? <><FlagImg team={value} size="xs" /><span className="truncate">{value}</span></> : <span className="text-slate-400">{label ?? 'בחר קבוצה...'}</span>}
        {!disabled && <span className="mr-auto text-slate-300 text-[10px]">▼</span>}
      </button>
      {open && (
        <div className="absolute z-50 top-full mt-1 start-0 end-0 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto">
          {ALL_TEAMS.map(t => (
            <button
              key={t}
              onClick={() => { onChange(t); setOpen(false) }}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-emerald-50 text-right transition-colors"
            >
              <FlagImg team={t} size="xs" />
              <span>{t}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Single bracket match card ──────────────────────────────── */
function MatchCard({ matchNum, teamA, teamB, pickedTeam, onPick, disabled, isFree, onFreeChange }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-3 space-y-1.5">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">
        משחק {matchNum}
      </p>
      {isFree ? (
        <>
          <FreeTeamPicker
            value={teamA}
            onChange={v => onFreeChange('a', v)}
            disabled={disabled}
            label="קבוצה א"
          />
          <div className="text-center text-slate-300 text-[10px] font-bold py-0.5">vs</div>
          <FreeTeamPicker
            value={teamB}
            onChange={v => onFreeChange('b', v)}
            disabled={disabled}
            label="קבוצה ב"
          />
          {teamA && teamB && (
            <div className="pt-1 border-t border-slate-100 space-y-1">
              <p className="text-[10px] text-slate-400 font-semibold text-center">מי ינצח?</p>
              <TeamBtn team={teamA} picked={pickedTeam === teamA} onPick={onPick} disabled={disabled} />
              <TeamBtn team={teamB} picked={pickedTeam === teamB} onPick={onPick} disabled={disabled} />
            </div>
          )}
        </>
      ) : (
        <>
          <TeamBtn team={teamA} picked={pickedTeam === teamA} onPick={onPick} disabled={disabled || !teamA} />
          <div className="text-center text-slate-200 text-[10px] font-black">vs</div>
          <TeamBtn team={teamB} picked={pickedTeam === teamB} onPick={onPick} disabled={disabled || !teamB} placeholder="טרם ידוע" />
        </>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════ */
export default function PreBracket({ user, locked, groupPredictions }) {
  const [activeRound, setActiveRound] = useState('r32')
  const [picks, setPicks]             = useState({ r32:{}, r16:{}, qf:{}, semi:{}, final:{} })
  const [r32Free, setR32Free]         = useState({}) // { matchNum: { a, b } } for free-select slots
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(null) // matchNum currently saving

  // Load existing picks from DB
  const loadPicks = useCallback(async () => {
    if (!user) { setLoading(false); return }
    const { data } = await supabase
      .from('pre_bracket_picks')
      .select('round, match_num, team')
      .eq('user_id', user.id)
    const map = { r32:{}, r16:{}, qf:{}, semi:{}, final:{} }
    data?.forEach(r => { map[r.round][r.match_num] = r.team })
    setPicks(map)

    // Also load free-slot teams (slots 13-16) — stored with special round 'r32_free_a' / 'r32_free_b'
    const { data: freeData } = await supabase
      .from('pre_bracket_picks')
      .select('round, match_num, team')
      .eq('user_id', user.id)
      .in('round', ['r32_free_a', 'r32_free_b'])
    const freeMap = {}
    freeData?.forEach(r => {
      if (!freeMap[r.match_num]) freeMap[r.match_num] = {}
      freeMap[r.match_num][r.round === 'r32_free_a' ? 'a' : 'b'] = r.team
    })
    setR32Free(freeMap)
    setLoading(false)
  }, [user])

  useEffect(() => { loadPicks() }, [loadPicks])

  // Save a winner pick
  async function savePick(round, matchNum, team) {
    if (!user || locked) return
    setSaving(`${round}-${matchNum}`)
    await supabase.from('pre_bracket_picks').upsert(
      { user_id: user.id, round, match_num: matchNum, team },
      { onConflict: 'user_id,round,match_num' }
    )
    setPicks(prev => ({ ...prev, [round]: { ...prev[round], [matchNum]: team } }))
    setSaving(null)
  }

  // Save a free-slot team selection (side = 'a' | 'b')
  async function saveFreeTeam(matchNum, side, team) {
    if (!user || locked) return
    const freeRound = side === 'a' ? 'r32_free_a' : 'r32_free_b'
    await supabase.from('pre_bracket_picks').upsert(
      { user_id: user.id, round: freeRound, match_num: matchNum, team },
      { onConflict: 'user_id,round,match_num' }
    )
    setR32Free(prev => ({
      ...prev,
      [matchNum]: { ...(prev[matchNum] ?? {}), [side]: team }
    }))
  }

  // Compute teams for a given round/match
  function getTeams(roundId, matchNum) {
    if (roundId === 'r32') {
      const seed = R32_SEEDS[matchNum - 1]
      const isFree = !seed[0] && !seed[1]
      if (isFree) {
        const free = r32Free[matchNum] ?? {}
        return { teamA: free.a ?? null, teamB: free.b ?? null, isFree: true }
      }
      return {
        teamA: getR32Team(seed[0], groupPredictions),
        teamB: getR32Team(seed[1], groupPredictions),
        isFree: false,
      }
    }
    const [teamA, teamB] = getTeamsFromPicks(roundId, matchNum, picks)
    return { teamA, teamB, isFree: false }
  }

  const roundCfg = ROUNDS.find(r => r.id === activeRound)
  const matchCount = roundCfg?.n ?? 1

  /* ── Render ────────────────────────────────────────────── */
  if (!user) return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center space-y-2">
      <p className="text-sm font-semibold text-amber-800">התחבר כדי למלא את ברקט הניחושים שלך</p>
      <a href="/auth" className="inline-block text-sm bg-amber-500 text-white font-bold px-4 py-2 rounded-xl hover:bg-amber-600 transition-colors">
        כניסה
      </a>
    </div>
  )

  if (loading) return <Spinner size="md" />

  return (
    <div className="space-y-4">
      {/* Instruction */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
        <p className="font-bold mb-0.5">🏆 ברקט ניחושים מקדים</p>
        <p>בחר מי תנצח בכל משחק בדרך לגמר. בשלב 32, מקומות 1-12 מתמלאים אוטומטית מניחושי הבתים שלך.</p>
      </div>

      {locked && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-2.5 text-xs text-rose-700 font-semibold text-center">
          🔒 הברקט ננעל — הטורניר התחיל
        </div>
      )}

      {/* Round tab bar */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {ROUNDS.map(r => (
          <button
            key={r.id}
            onClick={() => setActiveRound(r.id)}
            className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-full border transition-all ${
              activeRound === r.id
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
            }`}
          >
            {r.label}
            {/* Completion dot */}
            {(() => {
              const picked = Object.keys(picks[r.id] ?? {}).length
              const done   = picked >= r.n
              return done
                ? <span className="mr-1 text-emerald-400">✓</span>
                : picked > 0
                  ? <span className="mr-1 text-amber-400">·</span>
                  : null
            })()}
          </button>
        ))}
      </div>

      {/* Matches grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.from({ length: matchCount }, (_, i) => {
          const matchNum = i + 1
          const { teamA, teamB, isFree } = getTeams(activeRound, matchNum)
          const pickedTeam = picks[activeRound]?.[matchNum] ?? null
          const isSaving   = saving === `${activeRound}-${matchNum}`

          return (
            <MatchCard
              key={matchNum}
              matchNum={matchNum}
              teamA={teamA}
              teamB={teamB}
              pickedTeam={pickedTeam}
              disabled={locked || isSaving}
              isFree={isFree}
              onPick={team => savePick(activeRound, matchNum, team)}
              onFreeChange={(side, team) => saveFreeTeam(matchNum, side, team)}
            />
          )
        })}
      </div>

      {/* Tip: if no group predictions yet */}
      {activeRound === 'r32' && Object.keys(groupPredictions).length === 0 && !locked && (
        <p className="text-xs text-center text-slate-400">
          💡 נחש מי יעלה מכל בית (בחלק "ניחושי בתים") כדי שהברקט יתמלא אוטומטית
        </p>
      )}
    </div>
  )
}
