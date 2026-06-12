import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getFlag } from '../../lib/flags'
import Spinner from '../UI/Spinner'

function StatCard({ icon, label, value, sub, color = 'emerald' }) {
  const colors = {
    emerald: 'from-emerald-500 to-green-600',
    blue:    'from-blue-500 to-blue-600',
    amber:   'from-amber-400 to-orange-500',
    rose:    'from-rose-400 to-red-500',
    violet:  'from-violet-500 to-purple-600',
  }
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colors[color]} flex items-center justify-center text-xl flex-shrink-0`}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-extrabold text-slate-800 tabular-nums leading-none">
          {value ?? <span className="text-slate-300">—</span>}
        </div>
        <div className="text-sm font-semibold text-slate-600 mt-0.5">{label}</div>
        {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const [stats,      setStats]      = useState(null)
  const [topMatches, setTopMatches] = useState([])
  const [syncLog,    setSyncLog]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [recalcMsg,  setRecalcMsg]  = useState(null)
  const [recalcing,  setRecalcing]  = useState(false)

  // ── Special grading state ──────────────────────────────────────
  const [champTeam,    setChampTeam]    = useState('')
  const [champGrading, setChampGrading] = useState(false)
  const [champGradeMsg,setChampGradeMsg]= useState(null)
  const [scorerPlayer, setScorerPlayer] = useState('')
  const [scorerGrading,setScorerGrading]= useState(false)
  const [scorerGradeMsg,setScorerGradeMsg]=useState(null)

  useEffect(() => { loadDashboard() }, [])

  async function loadDashboard() {
    setLoading(true)
    const [usersRes, betsRes, finishedRes, lockedRes, betsDetailRes, syncRes] =
      await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('bets').select('*',  { count: 'exact', head: true }),
        supabase.from('matches').select('*', { count: 'exact', head: true }).eq('status', 'finished'),
        supabase.from('matches').select('*', { count: 'exact', head: true }).eq('is_locked', true),
        supabase.from('bets').select('match_id, prediction, matches!inner(home_team, away_team, group_name)'),
        supabase.from('sync_log').select('*').order('ran_at', { ascending: false }).limit(5),
      ])

    setStats({
      users:    usersRes.count ?? 0,
      bets:     betsRes.count  ?? 0,
      finished: finishedRes.count ?? 0,
      locked:   lockedRes.count   ?? 0,
    })

    // Aggregate bets by match
    const byMatch = {}
    for (const b of (betsDetailRes.data ?? [])) {
      if (!byMatch[b.match_id]) {
        byMatch[b.match_id] = {
          id: b.match_id,
          home: b.matches.home_team,
          away: b.matches.away_team,
          group: b.matches.group_name,
          home_count: 0, draw_count: 0, away_count: 0, total: 0,
        }
      }
      byMatch[b.match_id][`${b.prediction}_count`]++
      byMatch[b.match_id].total++
    }
    setTopMatches(
      Object.values(byMatch).sort((a, b) => b.total - a.total).slice(0, 5)
    )

    setSyncLog(syncRes.data ?? [])
    setLoading(false)
  }

  async function handleRecalculate() {
    setRecalcing(true)
    setRecalcMsg(null)
    const { data, error } = await supabase.rpc('admin_recalculate_all_points')
    if (error) setRecalcMsg({ type: 'error', text: `שגיאה: ${error.message}` })
    else       setRecalcMsg({ type: 'ok',    text: `✅ עודכנו ${data} משתמשים` })
    setRecalcing(false)
    loadDashboard()
  }

  async function handleGradeChampion() {
    if (!champTeam.trim()) return
    setChampGrading(true); setChampGradeMsg(null)
    const { data, error } = await supabase.rpc('admin_grade_champion', { p_team: champTeam.trim() })
    if (error) setChampGradeMsg({ type: 'error', text: `שגיאה: ${error.message}` })
    else       setChampGradeMsg({ type: 'ok',    text: `✅ ניחנו ${data} ניחושים · האלופה: ${champTeam.trim()}` })
    setChampGrading(false)
  }

  async function handleGradeScorer() {
    if (!scorerPlayer.trim()) return
    setScorerGrading(true); setScorerGradeMsg(null)
    const { data, error } = await supabase.rpc('admin_grade_top_scorer', { p_player: scorerPlayer.trim() })
    if (error) setScorerGradeMsg({ type: 'error', text: `שגיאה: ${error.message}` })
    else       setScorerGradeMsg({ type: 'ok',    text: `✅ ניחנו ${data} ניחושים · מלך שערים: ${scorerPlayer.trim()}` })
    setScorerGrading(false)
  }

  if (loading) return (
    <div className="flex justify-center py-16"><Spinner size="lg" /></div>
  )

  return (
    <div className="space-y-6">

      {/* ── Stats grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon="👥" label="משתמשים"        value={stats.users}    color="emerald" />
        <StatCard icon="🎯" label="ניחושים"         value={stats.bets}     color="blue"    />
        <StatCard icon="✅" label="משחקים שהסתיימו" value={stats.finished} color="violet"  />
        <StatCard icon="🔒" label="משחקים נעולים"  value={stats.locked}   color="amber"   />
      </div>

      {/* ── Quick Actions ───────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h2 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
          <span>⚡</span> פעולות מהירות
        </h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleRecalculate}
            disabled={recalcing}
            className="bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-60 flex items-center gap-2"
          >
            {recalcing
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> מחשב...</>
              : '🔄 חשב מחדש נקודות לכולם'}
          </button>
        </div>
        {recalcMsg && (
          <p className={`text-sm mt-2 font-medium ${recalcMsg.type === 'ok' ? 'text-emerald-600' : 'text-red-500'}`}>
            {recalcMsg.text}
          </p>
        )}
      </div>

      {/* ── Special predictions grading ────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        {/* Grade Champion */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
          <h2 className="font-bold text-slate-700 flex items-center gap-2">
            <span>🥇</span> ניחון אלופה
          </h2>
          <p className="text-xs text-slate-400">הזן שם הקבוצה שזכתה — כל מי שניחש נכון יקבל 25 נק׳</p>
          <input
            type="text"
            value={champTeam}
            onChange={e => setChampTeam(e.target.value)}
            placeholder="שם הקבוצה בעברית..."
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm
                       focus:outline-none focus:border-amber-400"
            dir="rtl"
          />
          <button
            onClick={handleGradeChampion}
            disabled={champGrading || !champTeam.trim()}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50
                       text-white text-sm font-bold py-2 rounded-xl transition-colors"
          >
            {champGrading ? 'מניחן...' : '🏆 ניחן ותן נקודות'}
          </button>
          {champGradeMsg && (
            <p className={`text-xs font-medium ${
              champGradeMsg.type === 'ok' ? 'text-emerald-600' : 'text-red-500'
            }`}>
              {champGradeMsg.text}
            </p>
          )}
        </div>

        {/* Grade Top Scorer */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
          <h2 className="font-bold text-slate-700 flex items-center gap-2">
            <span>⚽</span> ניחון מלך שערים
          </h2>
          <p className="text-xs text-slate-400">הזן שם השחקן — כל מי שניחש נכון יקבל 25 נק׳</p>
          <input
            type="text"
            value={scorerPlayer}
            onChange={e => setScorerPlayer(e.target.value)}
            placeholder="שם השחקן בעברית..."
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm
                       focus:outline-none focus:border-sky-400"
            dir="rtl"
          />
          <button
            onClick={handleGradeScorer}
            disabled={scorerGrading || !scorerPlayer.trim()}
            className="w-full bg-sky-500 hover:bg-sky-600 disabled:opacity-50
                       text-white text-sm font-bold py-2 rounded-xl transition-colors"
          >
            {scorerGrading ? 'מניחן...' : '⚽ ניחן ותן נקודות'}
          </button>
          {scorerGradeMsg && (
            <p className={`text-xs font-medium ${
              scorerGradeMsg.type === 'ok' ? 'text-emerald-600' : 'text-red-500'
            }`}>
              {scorerGradeMsg.text}
            </p>
          )}
        </div>

      </div>

      {/* ── Top matches by bet count ────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h2 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
          <span>🔥</span> המשחקים הכי פופולריים
        </h2>
        {topMatches.length === 0 ? (
          <p className="text-slate-400 text-sm">אין ניחושים עדיין</p>
        ) : (
          <div className="space-y-3">
            {topMatches.map((m) => {
              const pct = (n) => m.total > 0 ? Math.round((n / m.total) * 100) : 0
              return (
                <div key={m.id} className="border border-slate-100 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-slate-700">
                      {getFlag(m.home)} {m.home} — {m.away} {getFlag(m.away)}
                    </span>
                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                      בית {m.group} · {m.total} ניחושים
                    </span>
                  </div>
                  <div className="flex gap-1 text-xs">
                    {[
                      { label: `🏠 ניצחון בית ${pct(m.home_count)}%`, pct: pct(m.home_count), color: 'bg-sky-500' },
                      { label: `🤝 תיקו ${pct(m.draw_count)}%`,        pct: pct(m.draw_count), color: 'bg-amber-400' },
                      { label: `✈️ ניצחון אורח ${pct(m.away_count)}%`, pct: pct(m.away_count), color: 'bg-violet-500' },
                    ].map(({ label, pct, color }) => (
                      <div key={label} className="flex-1">
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                        <div className="text-center text-slate-500 mt-0.5">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Sync Log ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <h2 className="font-bold text-slate-700 mb-3 flex items-center gap-2">
          <span>🔄</span> יומן סנכרון אוטומטי
        </h2>
        {syncLog.length === 0 ? (
          <p className="text-slate-400 text-sm">לא בוצע סנכרון עדיין</p>
        ) : (
          <div className="space-y-2">
            {syncLog.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between text-sm border border-slate-100 rounded-xl px-3 py-2">
                <div className="flex items-center gap-2">
                  <span>{entry.status === 'success' ? '✅' : '❌'}</span>
                  <span className="text-slate-600">
                    {new Date(entry.ran_at).toLocaleString('he-IL')}
                  </span>
                </div>
                <div className="text-slate-500">
                  {entry.status === 'success'
                    ? `${entry.matches_updated} משחקים עודכנו`
                    : entry.message ?? 'שגיאה'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
