import { useCallback, useEffect, useState } from 'react'
import { Link }               from 'react-router-dom'
import { useAuth }            from '../context/AuthContext'
import { supabase }           from '../lib/supabase'
import { isPredictionLocked, PREDICTION_DEADLINE } from '../lib/groups'
import { GROUPS }             from '../lib/groups'
import { TOP_SCORERS }        from '../lib/players'
import Header                 from '../components/Layout/Header'
import FlagImg                from '../components/UI/FlagImg'
import Spinner                from '../components/UI/Spinner'

/* ── Israel date helpers ──────────────────────────────────────── */
function israelTime(iso) {
  return new Date(iso).toLocaleTimeString('he-IL', {
    timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}
function israelShortDate(iso) {
  return new Date(iso).toLocaleDateString('he-IL', {
    timeZone: 'Asia/Jerusalem', weekday: 'short', day: 'numeric', month: 'short',
  })
}

/* ── All unique teams from GROUPS ─────────────────────────────── */
const ALL_TEAMS = [...new Set(GROUPS.flatMap(g => g.teams))]

/* ── Bet result badge ─────────────────────────────────────────── */
const PRED_LABEL = { home: 'בית', draw: 'תיקו', away: 'אורח' }
const PRED_ICON  = { home: '🏠',  draw: '🤝',   away: '✈️'   }

/* ═══════════════════════════════════════════════════════════════ */
export default function MyBetsPage() {
  const { user } = useAuth()

  /* ── State ──────────────────────────────────────────────────── */
  const [allMatches,  setAllMatches]  = useState([])
  const [userBets,    setUserBets]    = useState({})   // matchId → bet row
  const [champion,    setChampion]    = useState(null) // { team, is_correct }
  const [scorer,      setScorer]      = useState(null) // { player_name, is_correct }
  const [loading,     setLoading]     = useState(true)

  // Special picks inline editing
  const [champEdit,   setChampEdit]   = useState(false)
  const [scorerEdit,  setScorerEdit]  = useState(false)
  const [champTeam,   setChampTeam]   = useState('')
  const [scorerPlayer,setScorerPlayer]= useState('')
  const [scorerSearch,setScorerSearch]= useState('')
  const [champBusy,   setChampBusy]   = useState(false)
  const [scorerBusy,  setScorerBusy]  = useState(false)

  const specialLocked = isPredictionLocked()

  /* ── Fetch all data ─────────────────────────────────────────── */
  const fetchAll = useCallback(async () => {
    if (!user) { setLoading(false); return }
    setLoading(true)

    const [matchRes, champRes, scorerRes] = await Promise.all([
      supabase.from('matches').select('*').order('match_date', { ascending: true }),
      supabase.from('champion_predictions').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('top_scorer_predictions').select('*').eq('user_id', user.id).maybeSingle(),
    ])

    const matches = matchRes.data ?? []
    setAllMatches(matches)

    const ids = matches.map(m => m.id)
    const betsRes = ids.length
      ? await supabase.from('bets').select('*').eq('user_id', user.id).in('match_id', ids)
      : { data: [] }

    const bm = {}
    betsRes.data?.forEach(b => { bm[b.match_id] = b })
    setUserBets(bm)

    setChampion(champRes.data ?? null)
    setScorer(scorerRes.data ?? null)
    setChampTeam(champRes.data?.team ?? '')
    setScorerPlayer(scorerRes.data?.player_name ?? '')

    setLoading(false)
  }, [user])

  useEffect(() => { fetchAll() }, [fetchAll])

  /* ── Save champion ──────────────────────────────────────────── */
  async function saveChampion() {
    if (!champTeam || champBusy) return
    setChampBusy(true)
    await supabase.from('champion_predictions').upsert(
      { user_id: user.id, team: champTeam },
      { onConflict: 'user_id' }
    )
    setChampBusy(false)
    setChampEdit(false)
    setChampion(prev => ({ ...prev, team: champTeam }))
  }

  /* ── Save scorer ────────────────────────────────────────────── */
  async function saveScorer() {
    if (!scorerPlayer || scorerBusy) return
    setScorerBusy(true)
    await supabase.from('top_scorer_predictions').upsert(
      { user_id: user.id, player_name: scorerPlayer },
      { onConflict: 'user_id' }
    )
    setScorerBusy(false)
    setScorerEdit(false)
    setScorer(prev => ({ ...prev, player_name: scorerPlayer }))
  }

  /* ── Match-level bet save ───────────────────────────────────── */
  async function saveMatchBet(matchId, pred, homeScore, awayScore) {
    if (!pred) return
    await supabase.from('bets').upsert(
      {
        user_id:              user.id,
        match_id:             matchId,
        prediction:           pred,
        predicted_home_score: homeScore !== '' && awayScore !== '' ? parseInt(homeScore, 10) : null,
        predicted_away_score: homeScore !== '' && awayScore !== '' ? parseInt(awayScore, 10) : null,
      },
      { onConflict: 'user_id,match_id' }
    )
    fetchAll()
  }

  /* ── Computed stats ─────────────────────────────────────────── */
  const matchBets     = Object.values(userBets)
  const finishedBets  = matchBets.filter(b => {
    const m = allMatches.find(m => m.id === b.match_id)
    return m?.status === 'finished'
  })
  const matchPoints   = finishedBets.reduce((s, b) => s + (b.points_earned ?? 0), 0)
  const champPoints   = champion?.is_correct === true  ? 25 : 0
  const scorerPoints  = scorer?.is_correct  === true  ? 25 : 0
  const totalPoints   = matchPoints + champPoints + scorerPoints

  /* ── Split matches ──────────────────────────────────────────── */
  const finishedMatches  = allMatches.filter(m => m.status === 'finished').reverse()
  const upcomingMatches  = allMatches.filter(m => m.status === 'upcoming')
  const myBettedFinished = finishedMatches.filter(m => userBets[m.id])
  const myBettedUpcoming = upcomingMatches.filter(m => userBets[m.id])
  const unbettedUpcoming = upcomingMatches.filter(m => !userBets[m.id])

  /* ── Filtered scorers for search ────────────────────────────── */
  const filteredScorers = scorerSearch.trim()
    ? TOP_SCORERS.filter(s =>
        s.player.includes(scorerSearch.trim()) || s.team.includes(scorerSearch.trim())
      )
    : TOP_SCORERS

  /* ── Guest screen ───────────────────────────────────────────── */
  if (!user) {
    return (
      <>
        <Header />
        <main className="max-w-lg mx-auto px-4 py-10 text-center space-y-4 pb-24">
          <div className="text-5xl">📋</div>
          <h1 className="text-xl font-extrabold text-slate-800">ההימורים שלי</h1>
          <p className="text-slate-500 text-sm">התחבר כדי לראות את ההימורים שלך</p>
          <Link to="/auth"
            className="inline-block bg-emerald-500 text-white font-bold px-6 py-3
                       rounded-2xl hover:bg-emerald-600 transition-colors">
            התחבר
          </Link>
        </main>
      </>
    )
  }

  /* ── Loading screen ─────────────────────────────────────────── */
  if (loading) {
    return (
      <>
        <Header />
        <main className="flex justify-center py-20 pb-24">
          <Spinner size="lg" />
        </main>
      </>
    )
  }

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <>
      <Header />
      <main className="max-w-lg mx-auto px-4 pt-5 pb-28 space-y-5" dir="rtl">

        {/* ══ PAGE TITLE ══════════════════════════════════════════ */}
        <div>
          <h1 className="text-xl font-extrabold text-slate-800">📋 ההימורים שלי</h1>
          <p className="text-slate-400 text-xs mt-0.5">כל הניחושים שלך במקום אחד</p>
        </div>

        {/* ══ SUMMARY CARD ════════════════════════════════════════ */}
        <div className="bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600
                        rounded-2xl p-4 text-white shadow-md">
          <p className="text-emerald-100 text-xs mb-2">סך הכל</p>
          <div className="flex items-end justify-between">
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-extrabold tabular-nums">{totalPoints}</span>
              <span className="text-emerald-200">נקודות</span>
            </div>
            <div className="text-right space-y-0.5">
              <p className="text-emerald-100 text-[11px]">
                משחקים: <span className="font-bold text-white">{matchPoints}</span>
              </p>
              <p className="text-emerald-100 text-[11px]">
                אלופה: <span className="font-bold text-white">{champPoints}</span>
              </p>
              <p className="text-emerald-100 text-[11px]">
                מלך שערים: <span className="font-bold text-white">{scorerPoints}</span>
              </p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-emerald-400/40 grid grid-cols-3 gap-1 text-center">
            <div>
              <div className="text-lg font-extrabold">{matchBets.length}</div>
              <div className="text-emerald-200 text-[10px]">הימורי משחק</div>
            </div>
            <div>
              <div className="text-lg font-extrabold">{champion?.team ? '✅' : '—'}</div>
              <div className="text-emerald-200 text-[10px]">אלופה</div>
            </div>
            <div>
              <div className="text-lg font-extrabold">{scorer?.player_name ? '✅' : '—'}</div>
              <div className="text-emerald-200 text-[10px]">מלך שערים</div>
            </div>
          </div>
        </div>

        {/* ══ SPECIAL PICKS ═══════════════════════════════════════ */}
        <section className="space-y-3">
          <h2 className="text-sm font-extrabold text-slate-700">🏆 ניחושים מיוחדים</h2>

          {/* Lock status */}
          <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl font-semibold
            ${specialLocked
              ? 'bg-red-50 text-red-600 border border-red-200'
              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
            <span>{specialLocked ? '🔒' : '✅'}</span>
            <span>
              {specialLocked
                ? 'הניחושים ננעלו'
                : `פתוח לשינוי עד 20.6.2026 23:59`}
            </span>
          </div>

          {/* Champion pick */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-extrabold text-slate-600 uppercase tracking-wide">
                🥇 אלופת העולם · 25 נק׳
              </p>
              {!specialLocked && !champEdit && (
                <button
                  onClick={() => setChampEdit(true)}
                  className="text-[10px] text-emerald-600 font-semibold hover:underline">
                  שנה
                </button>
              )}
            </div>

            {!champEdit ? (
              /* Display mode */
              champion?.team ? (
                <div className="flex items-center gap-3">
                  <FlagImg team={champion.team} size="md" className="shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 text-sm">{champion.team}</p>
                    {champion.is_correct === true  && <p className="text-[10px] text-amber-600 font-bold">🌟 נכון! +25נק׳</p>}
                    {champion.is_correct === false && <p className="text-[10px] text-red-500">❌ לא נכון</p>}
                    {champion.is_correct == null   && <p className="text-[10px] text-slate-400">ממתין לתוצאה</p>}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-amber-600 font-bold">
                  {specialLocked ? 'לא בחרת אלופה' : <Link to="/special" className="hover:underline">לחץ לבחור →</Link>}
                </p>
              )
            ) : (
              /* Edit mode */
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-1.5 max-h-52 overflow-y-auto">
                  {ALL_TEAMS.map(team => (
                    <button
                      key={team}
                      onClick={() => setChampTeam(team)}
                      className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border text-[9px] font-bold
                                  transition-all ${champTeam === team
                                    ? 'border-amber-400 bg-amber-50 text-amber-700'
                                    : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}
                    >
                      <FlagImg team={team} size="sm" />
                      <span className="leading-tight text-center line-clamp-2">{team}</span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={saveChampion}
                    disabled={!champTeam || champBusy}
                    className="flex-1 py-2 bg-emerald-500 text-white text-xs font-bold rounded-xl
                               disabled:opacity-50 hover:bg-emerald-600 transition-colors">
                    {champBusy ? '...' : '💾 שמור'}
                  </button>
                  <button
                    onClick={() => { setChampEdit(false); setChampTeam(champion?.team ?? '') }}
                    className="px-4 py-2 border border-slate-200 text-xs font-semibold rounded-xl
                               text-slate-500 hover:bg-slate-50">
                    ביטול
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Top scorer pick */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-extrabold text-slate-600 uppercase tracking-wide">
                ⚽ מלך שערים · 25 נק׳
              </p>
              {!specialLocked && !scorerEdit && (
                <button
                  onClick={() => setScorerEdit(true)}
                  className="text-[10px] text-emerald-600 font-semibold hover:underline">
                  שנה
                </button>
              )}
            </div>

            {!scorerEdit ? (
              /* Display mode */
              scorer?.player_name ? (
                <div>
                  <p className="font-bold text-slate-800 text-sm">{scorer.player_name}</p>
                  {scorer.is_correct === true  && <p className="text-[10px] text-amber-600 font-bold mt-0.5">🌟 נכון! +25נק׳</p>}
                  {scorer.is_correct === false && <p className="text-[10px] text-red-500 mt-0.5">❌ לא נכון</p>}
                  {scorer.is_correct == null   && <p className="text-[10px] text-slate-400 mt-0.5">ממתין לתוצאה</p>}
                </div>
              ) : (
                <p className="text-sm text-sky-600 font-bold">
                  {specialLocked ? 'לא בחרת שחקן' : <Link to="/special" className="hover:underline">לחץ לבחור →</Link>}
                </p>
              )
            ) : (
              /* Edit mode */
              <div className="space-y-2">
                <input
                  type="text"
                  value={scorerSearch}
                  onChange={e => setScorerSearch(e.target.value)}
                  placeholder="חפש שחקן..."
                  className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2
                             focus:outline-none focus:border-emerald-400"
                  dir="rtl"
                />
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredScorers.map(s => (
                    <button
                      key={s.player}
                      onClick={() => setScorerPlayer(s.player)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-right
                                  border transition-all ${scorerPlayer === s.player
                                    ? 'border-sky-400 bg-sky-50 text-sky-700'
                                    : 'border-transparent hover:bg-slate-50 text-slate-700'}`}
                    >
                      <FlagImg team={s.team} size="sm" className="shrink-0" />
                      <span className="font-semibold">{s.player}</span>
                      <span className="text-slate-400 text-[10px] mr-auto">{s.team}</span>
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={saveScorer}
                    disabled={!scorerPlayer || scorerBusy}
                    className="flex-1 py-2 bg-emerald-500 text-white text-xs font-bold rounded-xl
                               disabled:opacity-50 hover:bg-emerald-600 transition-colors">
                    {scorerBusy ? '...' : '💾 שמור'}
                  </button>
                  <button
                    onClick={() => { setScorerEdit(false); setScorerPlayer(scorer?.player_name ?? ''); setScorerSearch('') }}
                    className="px-4 py-2 border border-slate-200 text-xs font-semibold rounded-xl
                               text-slate-500 hover:bg-slate-50">
                    ביטול
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ══ FINISHED MATCH BETS ═════════════════════════════════ */}
        {myBettedFinished.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-extrabold text-slate-700">
              ✅ משחקים שנגמרו ({myBettedFinished.length})
            </h2>
            <div className="space-y-2">
              {myBettedFinished.map(m => {
                const bet = userBets[m.id]
                const exact = bet?.predicted_home_score != null && bet?.predicted_away_score != null
                return (
                  <div
                    key={m.id}
                    className={`bg-white border rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm ${
                      bet?.is_correct
                        ? (bet.points_earned >= 3 ? 'border-amber-300' : 'border-emerald-300')
                        : 'border-rose-200'
                    }`}
                  >
                    {/* Teams + score */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-slate-400 font-semibold mb-0.5">
                        {israelShortDate(m.match_date)}
                      </p>
                      <div className="flex items-center gap-1.5">
                        <FlagImg team={m.home_team} size="sm" className="shrink-0" />
                        <span className="text-xs font-bold text-slate-800 truncate">{m.home_team}</span>
                        <span className="text-slate-300 font-black text-xs mx-0.5">
                          {m.home_score}–{m.away_score}
                        </span>
                        <span className="text-xs font-bold text-slate-800 truncate">{m.away_team}</span>
                        <FlagImg team={m.away_team} size="sm" className="shrink-0" />
                      </div>
                    </div>

                    {/* Bet result */}
                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1 justify-end">
                        <span className="text-[11px] font-bold text-slate-700">
                          {PRED_ICON[bet?.prediction]} {PRED_LABEL[bet?.prediction]}
                        </span>
                        <span className="text-base">
                          {bet?.is_correct
                            ? (bet.points_earned >= 3 ? '🌟' : '✅')
                            : '❌'}
                        </span>
                      </div>
                      {exact && (
                        <p className="text-[9px] text-slate-400 text-right">
                          {bet.predicted_home_score}–{bet.predicted_away_score}
                        </p>
                      )}
                      <p className={`text-[11px] font-extrabold ${
                        bet?.is_correct
                          ? (bet.points_earned >= 3 ? 'text-amber-600' : 'text-emerald-600')
                          : 'text-rose-400'
                      }`}>
                        {bet?.is_correct ? `+${bet.points_earned}נק׳` : '0נק׳'}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ══ UPCOMING BETS (editable) ════════════════════════════ */}
        {myBettedUpcoming.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-extrabold text-slate-700">
              ⏳ הימורים על משחקים קרובים ({myBettedUpcoming.length})
            </h2>
            <div className="space-y-2">
              {myBettedUpcoming.map(m => (
                <UpcomingBetRow
                  key={m.id}
                  match={m}
                  bet={userBets[m.id]}
                  onSave={saveMatchBet}
                />
              ))}
            </div>
          </section>
        )}

        {/* ══ NO BETS YET ═════════════════════════════════════════ */}
        {unbettedUpcoming.length > 0 && (
          <section>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-center">
              <p className="text-sm font-bold text-amber-700">
                עוד {unbettedUpcoming.length} משחקים ממתינים להימור שלך
              </p>
              <Link
                to="/matches"
                className="inline-block mt-2 text-xs text-amber-600 font-semibold hover:underline"
              >
                לדף ההימורים ←
              </Link>
            </div>
          </section>
        )}

        {/* ══ EMPTY STATE ═════════════════════════════════════════ */}
        {matchBets.length === 0 && (
          <div className="text-center py-10 space-y-3">
            <div className="text-5xl">⚽</div>
            <p className="text-slate-500 font-semibold">עוד לא הימרת על אף משחק</p>
            <Link
              to="/matches"
              className="inline-block bg-emerald-500 text-white text-sm font-bold
                         px-5 py-2.5 rounded-2xl hover:bg-emerald-600 transition-colors"
            >
              להמר עכשיו
            </Link>
          </div>
        )}

      </main>
    </>
  )
}

/* ── Editable upcoming bet row ────────────────────────────────── */
function UpcomingBetRow({ match, bet, onSave }) {
  const [now,       setNow]       = useState(() => Date.now())
  const [pred,      setPred]      = useState(bet?.prediction ?? null)
  const [homeScore, setHomeScore] = useState(bet?.predicted_home_score != null ? String(bet.predicted_home_score) : '')
  const [awayScore, setAwayScore] = useState(bet?.predicted_away_score != null ? String(bet.predicted_away_score) : '')
  const [saving,    setSaving]    = useState(false)
  const [saved,     setSaved]     = useState(false)
  const [scoreOpen, setScoreOpen] = useState(false)

  useEffect(() => {
    const ms = new Date(match.match_date).getTime()
    const remaining = ms - Date.now()
    if (remaining <= 0) return
    const interval = remaining < 3_600_000 ? 10_000 : 60_000
    const t = setInterval(() => setNow(Date.now()), interval)
    return () => clearInterval(t)
  }, [match.match_date])

  const msToKick  = new Date(match.match_date).getTime() - now
  const minsToKick = Math.floor(msToKick / 60_000)
  const isAutoLocked = minsToKick > 0 && minsToKick <= 5
  const isLocked     = match.is_locked || isAutoLocked || msToKick <= 0

  const BET_CFG = {
    home: { label: 'בית',  icon: '🏠', activeClass: 'bg-sky-500 text-white border-sky-500' },
    draw: { label: 'תיקו', icon: '🤝', activeClass: 'bg-amber-400 text-white border-amber-400' },
    away: { label: 'אורח', icon: '✈️', activeClass: 'bg-violet-500 text-white border-violet-500' },
  }

  function handleScoreChange(side, value) {
    const hs  = side === 'home' ? value : homeScore
    const as_ = side === 'away' ? value : awayScore
    if (side === 'home') setHomeScore(value)
    else                 setAwayScore(value)
    const h = parseInt(hs, 10), a = parseInt(as_, 10)
    if (!isNaN(h) && !isNaN(a)) {
      if      (h > a) setPred('home')
      else if (a > h) setPred('away')
      else            setPred('draw')
    }
  }

  async function handleSave() {
    if (!pred || saving || isLocked) return
    setSaving(true)
    await onSave(match.id, pred, homeScore, awayScore)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className={`bg-white border rounded-2xl px-4 py-3 shadow-sm ${
      isLocked ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200'
    }`}>
      {/* Match header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <FlagImg team={match.home_team} size="sm" className="shrink-0" />
          <span className="text-xs font-bold text-slate-800 truncate">{match.home_team}</span>
          <span className="text-slate-300 font-black text-xs mx-0.5">—</span>
          <span className="text-xs font-bold text-slate-800 truncate">{match.away_team}</span>
          <FlagImg team={match.away_team} size="sm" className="shrink-0" />
        </div>
        <div className="text-[10px] text-slate-400 shrink-0 mr-2">
          {israelTime(match.match_date)}
          {isAutoLocked && <span className="text-amber-500 mr-1">🔒</span>}
        </div>
      </div>

      {isLocked ? (
        /* Locked: show current bet read-only */
        <div className="text-xs text-slate-500 font-semibold">
          {PRED_ICON[pred]} {PRED_LABEL[pred]}
          {homeScore !== '' && ` · ${homeScore}–${awayScore}`}
          <span className="text-[10px] text-amber-500 mr-2">🔒 ננעל</span>
        </div>
      ) : (
        /* Editable */
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-1">
            {['home', 'draw', 'away'].map(key => {
              const cfg    = BET_CFG[key]
              const active = pred === key
              return (
                <button
                  key={key}
                  onClick={() => { setPred(key); setScoreOpen(true) }}
                  className={`flex flex-col items-center gap-0.5 py-1.5 rounded-lg border text-[9px] font-bold
                              transition-all ${active ? cfg.activeClass : 'bg-white text-slate-500 border-slate-200'}`}
                >
                  <span className="text-sm">{cfg.icon}</span>
                  <span>{cfg.label}</span>
                </button>
              )
            })}
          </div>

          {pred && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setScoreOpen(o => !o)}
                className="text-[9px] text-slate-400 hover:text-amber-500 font-semibold shrink-0"
              >
                {scoreOpen ? '▲' : '▼'} תוצאה מדויקת
              </button>
              {scoreOpen && (
                <>
                  <input
                    type="number" min="0" max="20" value={homeScore}
                    onChange={e => handleScoreChange('home', e.target.value)}
                    placeholder="0"
                    className="w-8 text-center text-xs font-bold border border-slate-200 rounded-md py-0.5 focus:outline-none focus:border-emerald-400"
                  />
                  <span className="text-slate-300 text-xs font-black">—</span>
                  <input
                    type="number" min="0" max="20" value={awayScore}
                    onChange={e => handleScoreChange('away', e.target.value)}
                    placeholder="0"
                    className="w-8 text-center text-xs font-bold border border-slate-200 rounded-md py-0.5 focus:outline-none focus:border-emerald-400"
                  />
                  <span className="text-[8px] text-amber-500 font-bold shrink-0">+2נק׳</span>
                </>
              )}
            </div>
          )}

          {pred && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px]
                         font-extrabold rounded-lg transition-colors disabled:opacity-60"
            >
              {saving ? '...' : saved ? '✅ נשמר!' : '💾 עדכן הימור'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
