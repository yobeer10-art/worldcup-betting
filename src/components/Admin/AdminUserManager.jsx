import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import Spinner from '../UI/Spinner'

const AVATAR_COLORS = [
  'bg-emerald-500','bg-blue-500','bg-violet-500','bg-rose-500',
  'bg-amber-500','bg-teal-500','bg-indigo-500','bg-pink-500',
]
function avatarColor(name) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]
}

function UserRow({ u, currentUserId, onRefresh }) {
  const [editingPts, setEditingPts] = useState(false)
  const [pts,        setPts]        = useState(u.total_points)
  const [savingPts,  setSavingPts]  = useState(false)
  const [banning,    setBanning]    = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  const [err,        setErr]        = useState(null)

  async function savePts() {
    if (isNaN(parseInt(pts))) { setErr('מספר לא תקין'); return }
    setSavingPts(true); setErr(null)
    const { error } = await supabase.rpc('admin_update_user_points', {
      p_user_id: u.id,
      p_points:  parseInt(pts),
    })
    if (error) setErr(error.message)
    else { setEditingPts(false); onRefresh() }
    setSavingPts(false)
  }

  async function toggleBan() {
    setBanning(true); setErr(null)
    const { error } = await supabase.rpc('admin_set_user_banned', {
      p_user_id:   u.id,
      p_is_banned: !u.is_banned,
    })
    if (error) setErr(error.message)
    else onRefresh()
    setBanning(false)
  }

  async function deleteUser() {
    if (!window.confirm(`למחוק את המשתמש "${u.display_name}"?\nכל הניחושים שלו יימחקו.`)) return
    setDeleting(true); setErr(null)
    const { error } = await supabase.rpc('admin_delete_user', { p_user_id: u.id })
    if (error) setErr(error.message)
    else onRefresh()
    setDeleting(false)
  }

  const initials = (u.display_name || u.email || '?').slice(0, 2)
  const isMe = u.id === currentUserId

  return (
    <div className={`border rounded-2xl p-4 transition-all ${
      u.is_banned ? 'border-rose-200 bg-rose-50/40' : 'border-slate-200 bg-white'
    }`}>
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className={`w-10 h-10 rounded-xl ${avatarColor(u.display_name || u.email)} flex-shrink-0 flex items-center justify-center text-white text-sm font-bold`}>
          {initials}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-800 truncate">{u.display_name}</span>
            {isMe && (
              <span className="text-xs bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full">אתה</span>
            )}
            {u.is_banned && (
              <span className="text-xs bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded-full">🚫 חסום</span>
            )}
          </div>
          <div className="text-xs text-slate-400 truncate">{u.email}</div>
          <div className="text-xs text-slate-400">
            הצטרף: {new Date(u.created_at).toLocaleDateString('he-IL')}
          </div>
        </div>

        {/* Points */}
        <div className="text-right flex-shrink-0">
          {editingPts ? (
            <div className="flex items-center gap-1">
              <input
                type="number" min="0"
                value={pts}
                onChange={e => setPts(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && savePts()}
                className="w-16 text-center text-sm font-bold border-2 border-emerald-400 rounded-lg p-1 focus:outline-none"
                autoFocus
              />
              <button
                onClick={savePts}
                disabled={savingPts}
                className="text-xs bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-2 py-1 rounded-lg disabled:opacity-60"
              >
                {savingPts ? '...' : '✓'}
              </button>
              <button
                onClick={() => { setEditingPts(false); setPts(u.total_points) }}
                className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-600 font-bold px-2 py-1 rounded-lg"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingPts(true)}
              className="group flex items-center gap-1 hover:bg-slate-50 rounded-lg px-2 py-1 transition-colors"
            >
              <span className="text-xl font-extrabold text-emerald-600 tabular-nums">{u.total_points}</span>
              <span className="text-xs text-slate-400">נק׳</span>
              <span className="text-xs text-slate-300 group-hover:text-slate-500">✏️</span>
            </button>
          )}
        </div>
      </div>

      {err && <p className="text-xs text-red-500 mt-1 text-center">{err}</p>}

      {/* Action buttons */}
      {!isMe && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
          <button
            onClick={toggleBan}
            disabled={banning}
            className={`flex-1 text-xs font-semibold py-1.5 rounded-xl border transition-colors disabled:opacity-60 ${
              u.is_banned
                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200'
            }`}
          >
            {banning ? '...' : u.is_banned ? '✅ הסר חסימה' : '🚫 חסום'}
          </button>
          <button
            onClick={deleteUser}
            disabled={deleting}
            className="text-xs font-semibold py-1.5 px-3 rounded-xl border bg-slate-50 hover:bg-red-50 text-slate-400 hover:text-red-600 border-slate-200 hover:border-red-200 transition-colors disabled:opacity-60"
          >
            {deleting ? '...' : '🗑'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────
export default function AdminUserManager() {
  const { user: currentUser } = useAuth()
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [sort,    setSort]    = useState('points') // 'points' | 'name' | 'date'

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('users')
      .select('*')
      .order('total_points', { ascending: false })
    setUsers(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const query = search.toLowerCase()
  const filtered = users
    .filter(u =>
      !query ||
      u.display_name?.toLowerCase().includes(query) ||
      u.email?.toLowerCase().includes(query)
    )
    .sort((a, b) => {
      if (sort === 'points') return b.total_points - a.total_points
      if (sort === 'name')   return (a.display_name ?? '').localeCompare(b.display_name ?? '')
      return new Date(b.created_at) - new Date(a.created_at)
    })

  const banned = users.filter(u => u.is_banned).length

  return (
    <div className="space-y-4">

      {/* ── Header stats ─────────────────────────────────────── */}
      <div className="flex gap-3 flex-wrap">
        <div className="bg-white rounded-xl border border-slate-200 px-4 py-2 flex items-center gap-2">
          <span className="text-lg">👥</span>
          <span className="font-bold text-slate-700">{users.length} משתמשים</span>
        </div>
        {banned > 0 && (
          <div className="bg-rose-50 rounded-xl border border-rose-200 px-4 py-2 flex items-center gap-2">
            <span className="text-lg">🚫</span>
            <span className="font-bold text-rose-600">{banned} חסומים</span>
          </div>
        )}
      </div>

      {/* ── Search + sort ─────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        <input
          type="text"
          placeholder="🔍 חיפוש לפי שם או מייל..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-green-400"
        />
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          className="text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-green-400"
        >
          <option value="points">מיין לפי נקודות</option>
          <option value="name">מיין לפי שם</option>
          <option value="date">מיין לפי הצטרפות</option>
        </select>
      </div>

      {/* ── Note about auth deletion ──────────────────────────── */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
        <strong>שים לב:</strong> מחיקת משתמש מסירה את הפרופיל והניחושים שלו. כדי למחוק לחלוטין את הכניסה שלהם למערכת, עשה זאת גם ב-Supabase Dashboard → Authentication → Users.
      </div>

      {/* ── User list ─────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-slate-400 py-8">לא נמצאו משתמשים</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(u => (
            <UserRow key={u.id} u={u} currentUserId={currentUser?.id} onRefresh={load} />
          ))}
        </div>
      )}
    </div>
  )
}
