import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import FlagImg from '../UI/FlagImg'
import Spinner from '../UI/Spinner'

const ROUNDS = [
  { id: 'round_of_32', label: 'שלב 32',      pts: 1  },
  { id: 'round_of_16', label: 'שמינית גמר',  pts: 2  },
  { id: 'quarter',     label: 'רבע גמר',      pts: 4  },
  { id: 'semi',        label: 'חצי גמר',      pts: 8  },
  { id: 'third_place', label: 'מקום שלישי',   pts: 4  },
  { id: 'final',       label: 'גמר',          pts: 16 },
]

/* ── Add Match form ────────────────────────────────────────── */
function AddMatchForm({ onAdded }) {
  const [round,      setRound]      = useState('round_of_32')
  const [position,   setPosition]   = useState('')
  const [homeTeam,   setHomeTeam]   = useState('')
  const [awayTeam,   setAwayTeam]   = useState('')
  const [homeSource, setHomeSource] = useState('')
  const [awaySource, setAwaySource] = useState('')
  const [matchDate,  setMatchDate]  = useState('')
  const [saving,     setSaving]     = useState(false)
  const [err,        setErr]        = useState(null)

  async function handleAdd() {
    if (!position) { setErr('הזן מיקום'); return }
    setSaving(true); setErr(null)
    const { error } = await supabase.from('knockout_bracket_matches').insert({
      round,
      position:    parseInt(position),
      home_team:   homeTeam  || null,
      away_team:   awayTeam  || null,
      home_source: homeSource || null,
      away_source: awaySource || null,
      match_date:  matchDate  || null,
      status:      homeTeam && awayTeam ? 'upcoming' : 'pending',
    })
    setSaving(false)
    if (error) { setErr(error.message); return }
    setPosition(''); setHomeTeam(''); setAwayTeam('')
    setHomeSource(''); setAwaySource(''); setMatchDate('')
    onAdded()
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
      <h3 className="font-bold text-slate-700 text-sm">➕ הוסף משחק מדרגי</h3>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-slate-500 font-medium">סיבוב *</label>
          <select value={round} onChange={e => setRound(e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-xl px-2 py-1.5 mt-0.5 bg-white focus:outline-none focus:border-green-400">
            {ROUNDS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500 font-medium">מיקום בסיבוב *</label>
          <input type="number" min="1" value={position} onChange={e => setPosition(e.target.value)}
            placeholder="1" className="w-full text-sm border border-slate-200 rounded-xl px-2 py-1.5 mt-0.5 focus:outline-none focus:border-green-400" />
        </div>
        <div>
          <label className="text-xs text-slate-500 font-medium">קבוצת בית (אם ידועה)</label>
          <input value={homeTeam} onChange={e => setHomeTeam(e.target.value)}
            placeholder="מקסיקו" className="w-full text-sm border border-slate-200 rounded-xl px-2 py-1.5 mt-0.5 focus:outline-none focus:border-green-400" />
        </div>
        <div>
          <label className="text-xs text-slate-500 font-medium">קבוצת אורח (אם ידועה)</label>
          <input value={awayTeam} onChange={e => setAwayTeam(e.target.value)}
            placeholder="ברזיל" className="w-full text-sm border border-slate-200 rounded-xl px-2 py-1.5 mt-0.5 focus:outline-none focus:border-green-400" />
        </div>
        <div>
          <label className="text-xs text-slate-500 font-medium">מקור בית (אופציונלי)</label>
          <input value={homeSource} onChange={e => setHomeSource(e.target.value)}
            placeholder='1A / "ניצחן משחק 1"' className="w-full text-sm border border-slate-200 rounded-xl px-2 py-1.5 mt-0.5 focus:outline-none focus:border-green-400" />
        </div>
        <div>
          <label className="text-xs text-slate-500 font-medium">מקור אורח (אופציונלי)</label>
          <input value={awaySource} onChange={e => setAwaySource(e.target.value)}
            placeholder='2B / "ניצחן משחק 2"' className="w-full text-sm border border-slate-200 rounded-xl px-2 py-1.5 mt-0.5 focus:outline-none focus:border-green-400" />
        </div>
        <div className="col-span-2">
          <label className="text-xs text-slate-500 font-medium">תאריך ושעה (UTC)</label>
          <input type="datetime-local" value={matchDate} onChange={e => setMatchDate(e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-xl px-2 py-1.5 mt-0.5 focus:outline-none focus:border-green-400" />
        </div>
      </div>
      {err && <p className="text-xs text-red-500">{err}</p>}
      <button onClick={handleAdd} disabled={saving}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold py-2 rounded-xl disabled:opacity-60">
        {saving ? 'מוסיף...' : '➕ הוסף משחק'}
      </button>
    </div>
  )
}

/* ── Match row ─────────────────────────────────────────────── */
function BracketMatchRow({ match, onRefresh }) {
  const [editing,  setEditing]  = useState(false)
  const [result,   setResult]   = useState(match.result ?? '')
  const [homeScore,setHomeScore]= useState(match.home_score ?? '')
  const [awayScore,setAwayScore]= useState(match.away_score ?? '')
  const [saving,   setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [err,      setErr]      = useState(null)
  const [homeTeam, setHomeTeam] = useState(match.home_team ?? '')
  const [awayTeam, setAwayTeam] = useState(match.away_team ?? '')
  const [updTeams, setUpdTeams] = useState(false)

  async function saveResult() {
    if (!result) { setErr('בחר תוצאה'); return }
    setSaving(true); setErr(null)
    const { error } = await supabase.rpc('admin_set_knockout_result', {
      p_bracket_match_id: match.id,
      p_result: result,
      p_home_score: homeScore !== '' ? parseInt(homeScore) : null,
      p_away_score: awayScore !== '' ? parseInt(awayScore) : null,
    })
    if (error) setErr(error.message)
    else { setEditing(false); onRefresh() }
    setSaving(false)
  }

  async function updateTeams() {
    setUpdTeams(true)
    const { error } = await supabase.from('knockout_bracket_matches').update({
      home_team: homeTeam || null,
      away_team: awayTeam || null,
      status:    homeTeam && awayTeam ? 'upcoming' : 'pending',
    }).eq('id', match.id)
    setUpdTeams(false)
    if (error) setErr(error.message)
    else onRefresh()
  }

  async function deleteMatch() {
    if (!window.confirm('למחוק את המשחק? הניחושים ימחקו.')) return
    setDeleting(true)
    await supabase.from('knockout_bracket_matches').delete().eq('id', match.id)
    setDeleting(false); onRefresh()
  }

  const roundLabel = ROUNDS.find(r => r.id === match.round)?.label ?? match.round

  return (
    <div className="border border-slate-200 rounded-2xl bg-white p-3 space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span className="font-semibold text-slate-600">
          {roundLabel} #{match.position}
          {match.match_number && (
            <span className="ml-1 text-slate-400 font-normal">(M{match.match_number})</span>
          )}
        </span>
        <span className={`px-2 py-0.5 rounded-full font-semibold ${
          match.status === 'finished' ? 'bg-emerald-100 text-emerald-700'
          : match.status === 'live'   ? 'bg-red-100 text-red-600'
          : match.status === 'upcoming' ? 'bg-blue-100 text-blue-600'
          : 'bg-slate-100 text-slate-500'
        }`}>
          {match.status === 'pending' ? 'טרם נקבע' : match.status === 'upcoming' ? 'קרוב'
           : match.status === 'live' ? 'חי' : 'הסתיים'}
        </span>
      </div>

      {/* Team display / edit */}
      <div className="flex items-center gap-2 justify-center text-sm font-bold text-slate-700">
        <FlagImg team={match.home_team ?? ''} size="sm" />
        <input className="flex-1 text-center text-sm border border-slate-200 rounded-lg px-1.5 py-1 focus:outline-none focus:border-green-400"
          value={homeTeam} onChange={e => setHomeTeam(e.target.value)} placeholder={match.home_source ?? 'בית'} />
        {match.status === 'finished' && match.home_score != null
          ? <span className="text-base font-extrabold tabular-nums">{match.home_score}—{match.away_score}</span>
          : <span className="text-slate-300 font-black">vs</span>}
        <input className="flex-1 text-center text-sm border border-slate-200 rounded-lg px-1.5 py-1 focus:outline-none focus:border-green-400"
          value={awayTeam} onChange={e => setAwayTeam(e.target.value)} placeholder={match.away_source ?? 'אורח'} />
        <FlagImg team={match.away_team ?? ''} size="sm" />
      </div>

      {(homeTeam !== (match.home_team ?? '') || awayTeam !== (match.away_team ?? '')) && (
        <button onClick={updateTeams} disabled={updTeams}
          className="w-full text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl py-1.5 font-semibold disabled:opacity-60">
          {updTeams ? '...' : '💾 עדכן שמות קבוצות'}
        </button>
      )}

      {!editing && match.status !== 'finished' && match.home_team && match.away_team && (
        <button onClick={() => setEditing(true)}
          className="w-full text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl py-1.5 font-semibold">
          ✏️ קבע תוצאה
        </button>
      )}

      {editing && (
        <div className="space-y-2 bg-emerald-50 rounded-xl p-3 border border-emerald-200">
          <div className="flex items-center gap-2">
            <input type="number" min="0" value={homeScore} onChange={e => setHomeScore(e.target.value)}
              placeholder="0" className="w-14 text-center text-lg font-bold border-2 border-emerald-300 rounded-lg p-1.5 focus:outline-none" />
            <span className="text-slate-400 font-bold">—</span>
            <input type="number" min="0" value={awayScore} onChange={e => setAwayScore(e.target.value)}
              placeholder="0" className="w-14 text-center text-lg font-bold border-2 border-emerald-300 rounded-lg p-1.5 focus:outline-none" />
            <select value={result} onChange={e => setResult(e.target.value)}
              className="flex-1 text-sm border-2 border-emerald-300 rounded-lg p-1.5 bg-white focus:outline-none">
              <option value="">בחר</option>
              <option value="home">🏠 ניצחון בית</option>
              <option value="away">✈️ ניצחון אורח</option>
            </select>
          </div>
          {err && <p className="text-xs text-red-500">{err}</p>}
          <div className="flex gap-2">
            <button onClick={saveResult} disabled={saving}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-1.5 rounded-xl disabled:opacity-60">
              {saving ? '...' : '💾 שמור תוצאה + נקד'}
            </button>
            <button onClick={() => setEditing(false)}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-xl">
              ✖
            </button>
          </div>
        </div>
      )}

      <button onClick={deleteMatch} disabled={deleting}
        className="w-full text-xs text-slate-300 hover:text-red-500 transition-colors disabled:opacity-60">
        {deleting ? 'מוחק...' : '🗑 מחק משחק'}
      </button>
    </div>
  )
}

/* ── Champion grading panel ─────────────────────────────────── */
function ChampionGrader() {
  const [team,    setTeam]    = useState('')
  const [busy,    setBusy]    = useState(false)
  const [msg,     setMsg]     = useState(null)
  const [confirm, setConfirm] = useState(false)

  async function grade() {
    if (!team) return
    setBusy(true); setMsg(null)
    const { data, error } = await supabase.rpc('admin_grade_champion', { p_winning_team: team })
    setBusy(false); setConfirm(false)
    if (error) setMsg({ type: 'err', text: error.message })
    else       setMsg({ type: 'ok',  text: `✅ ${data} ניחושים נכונים קיבלו 25 נקודות` })
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
      <h3 className="font-extrabold text-amber-800 flex items-center gap-2">
        <span className="text-xl">🏆</span>
        ניחוש האלופה — קביעת אלופה
      </h3>
      <p className="text-xs text-amber-700">
        לאחר שהאלוף ידוע — הזן את שם הקבוצה (בדיוק כפי שהוא מופיע במערכת) וקבע נקודות.
        פעולה זו ניתנת לביצוע פעם אחת בלבד לכל משתמש.
      </p>
      <input
        value={team}
        onChange={e => { setTeam(e.target.value); setConfirm(false); setMsg(null) }}
        placeholder='שם הקבוצה, למשל "ברזיל"'
        className="w-full text-sm border border-amber-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-amber-500"
      />
      {team && !confirm && (
        <button
          onClick={() => setConfirm(true)}
          className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm py-2 rounded-xl transition-colors"
        >
          🏆 קבע {team} כאלופה
        </button>
      )}
      {team && confirm && (
        <div className="space-y-2">
          <p className="text-sm font-bold text-amber-900 text-center">
            אישור: {team} היא אלופת מונדיאל 2026?
          </p>
          <div className="flex gap-2">
            <button
              onClick={grade}
              disabled={busy}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-extrabold py-2 rounded-xl text-sm disabled:opacity-60"
            >
              {busy ? 'שומר...' : '✅ כן, קבע ונקד'}
            </button>
            <button
              onClick={() => setConfirm(false)}
              className="px-4 bg-white border border-amber-300 text-amber-700 font-semibold rounded-xl text-sm hover:bg-amber-50"
            >
              ביטול
            </button>
          </div>
        </div>
      )}
      {msg && (
        <p className={`text-sm font-medium ${msg.type === 'ok' ? 'text-emerald-600' : 'text-red-500'}`}>
          {msg.text}
        </p>
      )}
    </div>
  )
}

/* ── Main ──────────────────────────────────────────────────── */
export default function AdminBracketManager() {
  const [matches,     setMatches]     = useState([])
  const [loading,     setLoading]     = useState(true)
  const [filter,      setFilter]      = useState('all')
  const [showAddForm, setShowAddForm] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('knockout_bracket_matches')
      .select('*')
      .order('round').order('position')
    setMatches(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = filter === 'all' ? matches : matches.filter(m => m.round === filter)

  return (
    <div className="space-y-4">
      <ChampionGrader />

      {/* Add-match form — hidden by default since 32 rows are pre-seeded */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          {matches.length} משחקים ב-DB (צפוי: 32)
        </p>
        <button
          onClick={() => setShowAddForm(o => !o)}
          className="text-xs text-slate-400 hover:text-slate-600 underline"
        >
          {showAddForm ? '▲ הסתר טופס הוספה' : '▼ הוסף משחק ידנית'}
        </button>
      </div>
      {showAddForm && <AddMatchForm onAdded={load} />}

      {/* Round filter */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button onClick={() => setFilter('all')}
          className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
            filter === 'all' ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-200'}`}>
          הכל ({matches.length})
        </button>
        {ROUNDS.map(r => (
          <button key={r.id} onClick={() => setFilter(r.id)}
            className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-all ${
              filter === r.id ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-500 border-slate-200'}`}>
            {r.label} ({matches.filter(m => m.round === r.id).length})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-slate-400 text-sm py-6">אין משחקים — הוסף משחק למעלה</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map(m => <BracketMatchRow key={m.id} match={m} onRefresh={load} />)}
        </div>
      )}
    </div>
  )
}
