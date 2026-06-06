import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { GROUPS, isPredictionLocked, PREDICTION_DEADLINE } from '../lib/groups'
import Header from '../components/Layout/Header'
import GroupPredictionModal from '../components/Groups/GroupPredictionModal'
import { computeStandings } from '../lib/groups'
import PreBracket from '../components/PreTournament/PreBracket'
import FlagImg from '../components/UI/FlagImg'
import Spinner from '../components/UI/Spinner'

// All 48 WC2026 teams (for champion picker)
const ALL_TEAMS = [...new Set(GROUPS.flatMap(g => g.teams))]

const SECTIONS = [
  { id: 'groups',   icon: '🏟️', label: 'ניחושי בתים'  },
  { id: 'bracket',  icon: '🏆', label: 'ברקט מקדים'   },
  { id: 'champion', icon: '🥇', label: 'בחירת אלופה'  },
]

/* ── Countdown to lock ─────────────────────────────────────── */
function LockCountdown() {
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

  if (diff === 0) return null
  return (
    <span className="text-xs font-bold text-amber-700 tabular-nums">
      ננעל בעוד: {days > 0 && `${days}י `}{String(hours).padStart(2,'0')}:{String(mins).padStart(2,'0')}:{String(secs).padStart(2,'0')}
    </span>
  )
}

/* ── Compact group prediction row ──────────────────────────── */
function GroupRow({ group, allMatches, prediction, user, locked, onPredict }) {
  const hasPred = !!(prediction?.first_place)
  const standings = computeStandings(group.name, group.teams, allMatches)
  // Show actual current leaders from standings (for visual context)
  const leader = standings[0]?.name

  return (
    <div className="flex items-center gap-3 py-2.5 px-4 border-b border-slate-100 last:border-0">
      {/* Group badge */}
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-700 to-emerald-600 flex items-center justify-center text-white font-extrabold text-sm shrink-0 shadow-sm">
        {group.name}
      </div>

      {/* Prediction display */}
      <div className="flex-1 min-w-0">
        {hasPred ? (
          <div className="flex items-center gap-1.5 text-xs flex-wrap">
            <span className="flex items-center gap-1 font-bold text-slate-700">
              <FlagImg team={prediction.first_place} size="xs" />
              🥇 <span className="truncate max-w-[80px]">{prediction.first_place}</span>
            </span>
            {prediction.second_place && (
              <>
                <span className="text-slate-300">·</span>
                <span className="flex items-center gap-1 text-slate-500">
                  <FlagImg team={prediction.second_place} size="xs" />
                  🥈 <span className="truncate max-w-[80px]">{prediction.second_place}</span>
                </span>
              </>
            )}
            {prediction.is_graded && (
              <span className="mr-auto text-emerald-600 font-extrabold">+{prediction.points_earned} נק׳</span>
            )}
          </div>
        ) : (
          <span className="text-xs text-slate-400 italic">טרם ניחשת</span>
        )}
      </div>

      {/* Action button */}
      {user && !locked && (
        <button
          onClick={() => onPredict(group)}
          className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${
            hasPred
              ? 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
              : 'bg-emerald-600 text-white border-transparent hover:bg-emerald-700 shadow-sm'
          }`}
        >
          {hasPred ? '✏️ ערוך' : '🔮 נחש'}
        </button>
      )}
    </div>
  )
}

/* ── Champion section ──────────────────────────────────────── */
function ChampionSection({ user, locked }) {
  const [myPick,   setMyPick]   = useState(null)
  const [community,setCommunity]= useState([])
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    async function load() {
      const [myRes, allRes] = await Promise.all([
        user
          ? supabase.from('champion_predictions').select('team').eq('user_id', user.id).maybeSingle()
          : Promise.resolve({ data: null }),
        locked
          ? supabase.from('champion_predictions').select('team')
          : Promise.resolve({ data: [] }),
      ])
      setMyPick(myRes.data?.team ?? null)
      setCommunity(allRes.data ?? [])
      setLoading(false)
    }
    load()
  }, [user, locked])

  async function pick(team) {
    if (!user || locked || saving) return
    setSaving(true)
    const { error } = await supabase.from('champion_predictions').upsert(
      { user_id: user.id, team, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    if (!error) { setMyPick(team); setSaved(true); setTimeout(() => setSaved(false), 2000) }
    setSaving(false)
  }

  if (loading) return <Spinner size="sm" />

  // Community stats post-lock
  const total = community.length
  const topPicks = (() => {
    const counts = {}
    community.forEach(p => { counts[p.team] = (counts[p.team] ?? 0) + 1 })
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8)
  })()

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="bg-gradient-to-br from-amber-500 to-yellow-400 rounded-2xl p-4 text-white">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🏆</span>
          <div>
            <h3 className="font-extrabold text-base">מי יזכה במונדיאל 2026?</h3>
            <p className="text-amber-100 text-xs">25 נקודות לניחוש נכון!</p>
          </div>
          <span className={`mr-auto text-xs font-bold px-2.5 py-1 rounded-full border ${
            locked ? 'bg-red-500/20 border-red-300/40 text-red-100'
                   : 'bg-white/20 border-white/30 text-white'
          }`}>
            {locked ? '🔒 ננעל' : '✅ פתוח'}
          </span>
        </div>
      </div>

      {/* Current pick */}
      {myPick && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl px-4 py-3 flex items-center gap-3">
          <FlagImg team={myPick} size="md" />
          <div>
            <p className="text-[10px] text-amber-600 font-semibold">הבחירה שלי לאלופה</p>
            <p className="font-extrabold text-amber-900">{myPick}</p>
          </div>
          {saved && <span className="mr-auto text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">✅ נשמר!</span>}
        </div>
      )}

      {!user && (
        <div className="text-center py-4">
          <Link to="/auth" className="text-sm bg-amber-500 hover:bg-amber-600 text-white font-bold px-5 py-2.5 rounded-xl transition-colors shadow-md">
            התחבר כדי לבחור אלופה
          </Link>
        </div>
      )}

      {/* Picker grid (pre-lock) */}
      {!locked && user && (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
          {ALL_TEAMS.map(team => (
            <button
              key={team}
              onClick={() => pick(team)}
              disabled={saving}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all text-center ${
                myPick === team
                  ? 'border-amber-400 bg-amber-50 shadow-sm'
                  : 'border-slate-200 bg-white hover:border-amber-300 hover:bg-amber-50/60'
              }`}
            >
              <FlagImg team={team} size="sm" />
              <span className={`text-[9px] font-semibold leading-tight line-clamp-2 ${
                myPick === team ? 'text-amber-800' : 'text-slate-600'
              }`}>{team}</span>
            </button>
          ))}
        </div>
      )}

      {/* Community breakdown (post-lock) */}
      {locked && total > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
          <h4 className="font-extrabold text-slate-700 text-sm flex items-center gap-2">
            <span>👥</span> בחירות הקהילה · {total} משתתפים
          </h4>
          {topPicks.map(([team, count], i) => {
            const pct = Math.round((count / total) * 100)
            return (
              <div key={team} className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 w-4">{i + 1}.</span>
                <FlagImg team={team} size="xs" />
                <span className="text-xs font-semibold text-slate-700 flex-1 truncate">{team}</span>
                <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden shrink-0">
                  <div className="h-full bg-amber-400 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs font-bold text-amber-600 tabular-nums w-8 text-left">{pct}%</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════ */
export default function PreTournamentPage() {
  const { user }                     = useAuth()
  const [searchParams]               = useSearchParams()
  const [activeSection, setSection]  = useState(
    SECTIONS.find(s => s.id === searchParams.get('s'))?.id ?? 'groups'
  )
  const [allMatches,  setAllMatches]  = useState([])
  const [predictions, setPredictions] = useState({})
  const [loading,     setLoading]     = useState(true)
  const [saveError,   setSaveError]   = useState(null)
  const [modalGroup,  setModalGroup]  = useState(null)

  const locked = isPredictionLocked()

  const fetchData = useCallback(async () => {
    const [matchRes, predRes] = await Promise.all([
      supabase.from('matches').select('*').not('group_name', 'is', null),
      user
        ? supabase.from('group_predictions').select('*').eq('user_id', user.id)
        : Promise.resolve({ data: [] }),
    ])
    setAllMatches(matchRes.data ?? [])
    const map = {}
    predRes.data?.forEach(p => { map[p.group_name] = p })
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
        { user_id: user.id, group_name: groupName, first_place: firstPlace, second_place: secondPlace },
        { onConflict: 'user_id,group_name' }
      )
      .select().single()
    if (error) { setSaveError('שגיאה בשמירת הניחוש'); return }
    if (data) setPredictions(prev => ({ ...prev, [groupName]: data }))
  }

  const predCount = Object.keys(predictions).length

  return (
    <>
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-4 space-y-4">

        {/* ── Hero banner ──────────────────────────────────── */}
        <div className="bg-gradient-to-br from-indigo-700 via-violet-700 to-purple-700 rounded-2xl p-4 text-white shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h1 className="font-extrabold text-base leading-tight">הימורים מקדימים 🔮</h1>
              <p className="text-violet-200 text-xs mt-0.5">
                ניחושי בתים · ברקט · אלופה — נועלים ב-11 ביוני 2026
              </p>
            </div>
            <div className="text-right shrink-0 space-y-1">
              {!locked && <LockCountdown />}
              {locked && <span className="text-xs font-bold bg-red-500/30 text-red-200 border border-red-400/30 px-2 py-1 rounded-full">🔒 ננעל</span>}
            </div>
          </div>

          {/* Progress bar */}
          {user && (
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-xs text-violet-200">
                <span>ניחושי בתים: {predCount}/{GROUPS.length}</span>
                <span>{Math.round((predCount / GROUPS.length) * 100)}%</span>
              </div>
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full transition-all duration-700"
                  style={{ width: `${(predCount / GROUPS.length) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Section tabs ─────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                activeSection === s.id
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-200'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-violet-300 hover:text-violet-700'
              }`}
            >
              <span>{s.icon}</span>
              <span>{s.label}</span>
              {s.id === 'groups' && predCount > 0 && predCount < GROUPS.length && (
                <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                  activeSection === s.id ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-600'
                }`}>{predCount}/{GROUPS.length}</span>
              )}
              {s.id === 'groups' && predCount === GROUPS.length && (
                <span className="text-[10px]">✅</span>
              )}
            </button>
          ))}
        </div>

        {saveError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-xl flex items-center justify-between">
            {saveError}
            <button onClick={() => setSaveError(null)} className="text-red-400 text-lg">×</button>
          </div>
        )}

        {/* ── Section A: Group predictions ─────────────────── */}
        {activeSection === 'groups' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-extrabold text-slate-800">🏟️ מי עולה מכל בית?</h2>
              <span className="text-xs text-slate-400">2 קבוצות עולות מכל בית</span>
            </div>

            {!user && (
              <div className="px-4 py-4 text-center">
                <p className="text-sm text-slate-500 mb-3">התחבר כדי לנחש מי יעלה מכל בית</p>
                <Link to="/auth" className="text-sm bg-violet-600 text-white font-bold px-4 py-2 rounded-xl hover:bg-violet-700 transition-colors">
                  כניסה
                </Link>
              </div>
            )}

            {loading ? (
              <Spinner size="sm" />
            ) : (
              GROUPS.map(group => (
                <GroupRow
                  key={group.name}
                  group={group}
                  allMatches={allMatches}
                  prediction={predictions[group.name] ?? null}
                  user={user}
                  locked={locked}
                  onPredict={g => setModalGroup(g)}
                />
              ))
            )}

            {!locked && user && predCount < GROUPS.length && (
              <div className="px-4 py-3 bg-amber-50 border-t border-amber-100">
                <p className="text-xs text-amber-700 font-medium">
                  💡 נותרו {GROUPS.length - predCount} בתים לניחוש
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Section B: Pre-tournament bracket ────────────── */}
        {activeSection === 'bracket' && (
          <PreBracket
            user={user}
            locked={locked}
            groupPredictions={predictions}
          />
        )}

        {/* ── Section C: Champion pick ──────────────────────── */}
        {activeSection === 'champion' && (
          <ChampionSection user={user} locked={locked} />
        )}

      </main>

      {/* ── Group prediction modal ─────────────────────────── */}
      {modalGroup && (
        <GroupPredictionModal
          group={modalGroup}
          standings={computeStandings(modalGroup.name, modalGroup.teams, allMatches)}
          existingPrediction={predictions[modalGroup.name] ?? null}
          onSave={async (first, second) => {
            await handlePredictionSave(modalGroup.name, first, second)
            setModalGroup(null)
          }}
          onClose={() => setModalGroup(null)}
        />
      )}
    </>
  )
}
