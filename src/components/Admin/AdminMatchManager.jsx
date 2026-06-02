import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import FlagImg from '../UI/FlagImg'
import Spinner from '../UI/Spinner'

// ── Helpers ───────────────────────────────────────────────────────
const STATUS_CFG = {
  upcoming: { label: 'קרוב',      bg: 'bg-slate-100',  text: 'text-slate-600' },
  live:     { label: '🔴 חי',     bg: 'bg-red-100',    text: 'text-red-600'   },
  finished: { label: '✅ הסתיים', bg: 'bg-emerald-100', text: 'text-emerald-700' },
}

const RESULT_CFG = {
  home: { label: 'ניצחון בית', icon: '🏠', color: 'text-sky-600'    },
  draw: { label: 'תיקו',       icon: '🤝', color: 'text-amber-600'  },
  away: { label: 'ניצחון אורח',icon: '✈️', color: 'text-violet-600' },
}

function inferResult(h, a) {
  const home = parseInt(h), away = parseInt(a)
  if (isNaN(home) || isNaN(away)) return ''
  if (home > away) return 'home'
  if (away > home) return 'away'
  return 'draw'
}

function fmtDate(iso) {
  return new Date(iso).toLocaleString('he-IL', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function getMatchday(iso) {
  const d = new Date(iso), day = d.getUTCDate(), month = d.getUTCMonth()
  if (month !== 5) return 'אחר'
  if (day >= 11 && day <= 16) return 'MD1'
  if (day >= 18 && day <= 23) return 'MD2'
  if (day >= 25 && day <= 27) return 'MD3'
  return 'אחר'
}

const FILTERS = ['הכל', 'קרוב', 'חי', 'הסתיים', 'MD1', 'MD2', 'MD3']
const GROUP_NAMES = ['א','ב','ג','ד','ה','ו','ז','ח','ט','י','יא','יב']

// ── EditRow — inline result form ──────────────────────────────────
function EditRow({ match, onSave, onCancel }) {
  const [homeScore, setHomeScore] = useState(match.home_score ?? '')
  const [awayScore, setAwayScore] = useState(match.away_score ?? '')
  const [result,    setResult]    = useState(match.result ?? '')
  const [saving,    setSaving]    = useState(false)
  const [err,       setErr]       = useState(null)

  // Auto-infer result from scores
  useEffect(() => {
    const inferred = inferResult(homeScore, awayScore)
    if (inferred) setResult(inferred)
  }, [homeScore, awayScore])

  async function handleSave() {
    if (!result) { setErr('בחר תוצאה'); return }
    setSaving(true); setErr(null)
    const { error } = await supabase.rpc('set_match_result', {
      p_match_id:   match.id,
      p_result:     result,
      p_home_score: homeScore === '' ? null : parseInt(homeScore),
      p_away_score: awayScore === '' ? null : parseInt(awayScore),
    })
    if (error) { setErr(error.message); setSaving(false) }
    else onSave()
  }

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mt-1 space-y-3">
      <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
        ✏️ קביעת תוצאה
      </p>

      {/* Score inputs */}
      <div className="flex items-center gap-3 justify-center">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-xs text-slate-500 mb-1"><FlagImg team={match.home_team} size="xs" /> {match.home_team}</div>
          <input
            type="number" min="0" max="99"
            value={homeScore}
            onChange={e => setHomeScore(e.target.value)}
            className="w-16 text-center text-2xl font-bold border-2 border-emerald-300 rounded-xl p-2 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <span className="text-2xl text-slate-400 font-bold mt-5">—</span>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 text-xs text-slate-500 mb-1"><FlagImg team={match.away_team} size="xs" /> {match.away_team}</div>
          <input
            type="number" min="0" max="99"
            value={awayScore}
            onChange={e => setAwayScore(e.target.value)}
            className="w-16 text-center text-2xl font-bold border-2 border-emerald-300 rounded-xl p-2 focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Result radio */}
      <div className="flex gap-2 justify-center">
        {Object.entries(RESULT_CFG).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setResult(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold border-2 transition-all ${
              result === key
                ? 'border-emerald-500 bg-white shadow-sm text-slate-800'
                : 'border-transparent bg-white/60 text-slate-500 hover:border-slate-300'
            }`}
          >
            {cfg.icon} {cfg.label}
          </button>
        ))}
      </div>

      {err && <p className="text-red-500 text-xs text-center">{err}</p>}

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-bold py-2 rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          {saving
            ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> שומר...</>
            : '💾 שמור תוצאה'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-semibold rounded-xl transition-colors"
        >
          ✖ ביטול
        </button>
      </div>
    </div>
  )
}

// ── MatchRow ──────────────────────────────────────────────────────
function MatchRow({ match, onRefresh }) {
  const [editing,     setEditing]     = useState(false)
  const [togglingLock,setTogglingLock] = useState(false)
  const [togglingLive,setTogglingLive] = useState(false)
  const [resetting,   setResetting]   = useState(false)

  const statusCfg = STATUS_CFG[match.status] ?? STATUS_CFG.upcoming
  const resultCfg = match.result ? RESULT_CFG[match.result] : null

  async function toggleLock() {
    setTogglingLock(true)
    await supabase.rpc('admin_toggle_match_lock', {
      p_match_id: match.id,
      p_is_locked: !match.is_locked,
    })
    setTogglingLock(false); onRefresh()
  }

  async function setLive() {
    setTogglingLive(true)
    await supabase.rpc('admin_set_match_live', { p_match_id: match.id })
    setTogglingLive(false); onRefresh()
  }

  async function resetMatch() {
    if (!window.confirm('לאפס את תוצאת המשחק? כל הניחושים יתאפסו.')) return
    setResetting(true)
    await supabase.rpc('admin_reset_match', { p_match_id: match.id })
    setResetting(false); onRefresh()
  }

  const md = getMatchday(match.match_date)

  return (
    <div className={`border rounded-2xl overflow-hidden transition-all ${
      match.is_locked ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200 bg-white'
    }`}>
      {/* Status strip */}
      <div className={`h-1 w-full ${
        match.status === 'finished' ? 'bg-emerald-400'
        : match.status === 'live'  ? 'bg-red-400'
        : 'bg-slate-200'
      }`} />

      <div className="p-4">
        {/* Top row: meta */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusCfg.bg} ${statusCfg.text}`}>
            {statusCfg.label}
          </span>
          {match.group_name && (
            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">
              בית {match.group_name}
            </span>
          )}
          <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
            {md}
          </span>
          <span className="text-xs text-slate-400 mr-auto">{fmtDate(match.match_date)}</span>
          {match.is_locked && (
            <span className="text-xs text-amber-600 font-bold">🔒 נעול</span>
          )}
        </div>

        {/* Teams + score */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex-1 text-right">
            <span className="inline-flex items-center gap-1.5 font-bold text-slate-800">
              <FlagImg team={match.home_team} size="xs" /> {match.home_team}
            </span>
          </div>

          {match.status === 'finished' && match.home_score != null ? (
            <div className="text-center">
              <div className="text-2xl font-extrabold text-slate-800 tabular-nums">
                {match.home_score} — {match.away_score}
              </div>
              {resultCfg && (
                <div className={`text-xs font-semibold ${resultCfg.color}`}>
                  {resultCfg.icon} {resultCfg.label}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center">
              <div className="text-lg font-bold text-slate-300">vs</div>
            </div>
          )}

          <div className="flex-1 text-left">
            <span className="inline-flex items-center gap-1.5 font-bold text-slate-800">
              {match.away_team} <FlagImg team={match.away_team} size="xs" />
            </span>
          </div>
        </div>

        {match.last_synced_at && (
          <p className="text-xs text-slate-400 text-center mb-2">
            🔄 עודכן אוטומטית: {fmtDate(match.last_synced_at)}
          </p>
        )}

        {/* Action buttons */}
        {!editing && (
          <div className="flex flex-wrap gap-2">
            {match.status === 'upcoming' && (
              <button
                onClick={setLive}
                disabled={togglingLive}
                className="text-xs bg-red-50 hover:bg-red-100 text-red-600 font-semibold px-3 py-1.5 rounded-lg border border-red-200 transition-colors disabled:opacity-60"
              >
                {togglingLive ? '...' : '▶ הפוך לחי'}
              </button>
            )}
            <button
              onClick={() => setEditing(true)}
              className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold px-3 py-1.5 rounded-lg border border-emerald-200 transition-colors"
            >
              {match.result ? '✏️ עדכן תוצאה' : '✏️ קבע תוצאה'}
            </button>
            <button
              onClick={toggleLock}
              disabled={togglingLock}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-60 ${
                match.is_locked
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              {togglingLock ? '...' : match.is_locked ? '🔓 בטל נעילה' : '🔒 נעל'}
            </button>
            {match.status === 'finished' && (
              <button
                onClick={resetMatch}
                disabled={resetting}
                className="text-xs bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold px-3 py-1.5 rounded-lg border border-rose-200 transition-colors disabled:opacity-60 mr-auto"
              >
                {resetting ? '...' : '↩ אפס'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Inline edit form */}
      {editing && (
        <div className="px-4 pb-4">
          <EditRow
            match={match}
            onSave={() => { setEditing(false); onRefresh() }}
            onCancel={() => setEditing(false)}
          />
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────
export default function AdminMatchManager() {
  const [matches,  setMatches]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState('הכל')
  const [group,    setGroup]    = useState('כל הבתים')
  const [syncing,  setSyncing]  = useState(false)
  const [syncMsg,  setSyncMsg]  = useState(null)
  const [lockingAll, setLockingAll] = useState(false)
  const [lockAllMsg, setLockAllMsg] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('matches')
      .select('*')
      .order('match_date', { ascending: true })
    setMatches(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = matches.filter(m => {
    const groupOk = group === 'כל הבתים' || m.group_name === group
    if (!groupOk) return false
    if (filter === 'הכל') return true
    if (filter === 'קרוב')    return m.status === 'upcoming'
    if (filter === 'חי')      return m.status === 'live'
    if (filter === 'הסתיים')  return m.status === 'finished'
    return getMatchday(m.match_date) === filter
  })

  // Counts for filter badges
  const counts = {
    'הכל':    matches.length,
    'קרוב':   matches.filter(m => m.status === 'upcoming').length,
    'חי':     matches.filter(m => m.status === 'live').length,
    'הסתיים': matches.filter(m => m.status === 'finished').length,
    'MD1':    matches.filter(m => getMatchday(m.match_date) === 'MD1').length,
    'MD2':    matches.filter(m => getMatchday(m.match_date) === 'MD2').length,
    'MD3':    matches.filter(m => getMatchday(m.match_date) === 'MD3').length,
  }

  async function triggerSync() {
    setSyncing(true); setSyncMsg(null)
    const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-results`
    try {
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ source: 'admin' }),
      })
      const json = await res.json()
      if (json.success) setSyncMsg({ type: 'ok', text: `✅ סנכרון הצליח — ${json.updated} משחקים עודכנו` })
      else              setSyncMsg({ type: 'err', text: `❌ ${json.error ?? 'שגיאה'}` })
    } catch (e) {
      setSyncMsg({ type: 'err', text: `❌ שגיאת חיבור: ${e.message}` })
    }
    setSyncing(false); load()
  }

  async function lockAll(locked) {
    setLockingAll(true); setLockAllMsg(null)
    const { data, error } = await supabase.rpc('admin_lock_all_matches', { p_is_locked: locked })
    if (error) setLockAllMsg({ type: 'err', text: error.message })
    else       setLockAllMsg({ type: 'ok',  text: `${locked ? '🔒 ננעלו' : '🔓 שוחררו'} ${data} משחקים` })
    setLockingAll(false); load()
  }

  return (
    <div className="space-y-4">

      {/* ── Top controls ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={triggerSync}
            disabled={syncing}
            className="text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-bold px-4 py-2 rounded-xl transition-colors flex items-center gap-2"
          >
            {syncing
              ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> מסנכרן...</>
              : '🌐 סנכרן מהאינטרנט'}
          </button>
          <button
            onClick={() => lockAll(true)}
            disabled={lockingAll}
            className="text-sm bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white font-bold px-4 py-2 rounded-xl transition-colors"
          >
            🔒 נעל הכל
          </button>
          <button
            onClick={() => lockAll(false)}
            disabled={lockingAll}
            className="text-sm bg-slate-200 hover:bg-slate-300 disabled:opacity-60 text-slate-700 font-bold px-4 py-2 rounded-xl transition-colors"
          >
            🔓 שחרר הכל
          </button>
        </div>
        {syncMsg && (
          <p className={`text-sm font-medium ${syncMsg.type === 'ok' ? 'text-emerald-600' : 'text-red-500'}`}>
            {syncMsg.text}
          </p>
        )}
        {lockAllMsg && (
          <p className={`text-sm font-medium ${lockAllMsg.type === 'ok' ? 'text-amber-600' : 'text-red-500'}`}>
            {lockAllMsg.text}
          </p>
        )}
      </div>

      {/* ── Filters ──────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
                filter === f
                  ? 'bg-green-700 text-white border-green-700'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-green-400'
              }`}
            >
              {f} <span className="opacity-70">({counts[f] ?? 0})</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setGroup('כל הבתים')}
            className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
              group === 'כל הבתים'
                ? 'bg-slate-700 text-white border-slate-700'
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
            }`}
          >
            כל הבתים
          </button>
          {GROUP_NAMES.map(g => (
            <button
              key={g}
              onClick={() => setGroup(g)}
              className={`shrink-0 text-xs font-semibold px-2.5 py-1.5 rounded-full border transition-all ${
                group === g
                  ? 'bg-slate-700 text-white border-slate-700'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
      </div>

      {/* ── Match list ───────────────────────────────────────── */}
      <p className="text-xs text-slate-400">{filtered.length} משחקים</p>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-slate-400 py-8">אין משחקים בסינון הנוכחי</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(m => (
            <MatchRow key={m.id} match={m} onRefresh={load} />
          ))}
        </div>
      )}
    </div>
  )
}
