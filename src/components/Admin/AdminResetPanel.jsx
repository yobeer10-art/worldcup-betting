import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import Spinner from '../UI/Spinner'

/* ── Confirmation dialog (inline, no native prompt) ────────── */
function ConfirmBox({ message, onConfirm, onCancel, dangerous }) {
  return (
    <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-3">
      <p className="text-sm font-semibold text-rose-800">{message}</p>
      <div className="flex gap-2">
        <button
          onClick={onConfirm}
          className={`flex-1 text-sm font-bold py-2 rounded-xl transition-colors ${
            dangerous
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-rose-500 hover:bg-rose-600 text-white'
          }`}
        >
          כן, המשך
        </button>
        <button
          onClick={onCancel}
          className="flex-1 text-sm font-semibold py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
        >
          ביטול
        </button>
      </div>
    </div>
  )
}

/* ── Section wrapper ────────────────────────────────────────── */
function Section({ title, icon, children }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
      <h3 className="font-extrabold text-slate-700 flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        {title}
      </h3>
      {children}
    </div>
  )
}

/* ════════════════════════════════════════════════════════════ */
export default function AdminResetPanel() {
  // ── User list ───────────────────────────────────────────────
  const [users,   setUsers]   = useState([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [selectedUser, setSelectedUser] = useState('')

  // ── Per-section states ──────────────────────────────────────
  const [userResetStage,  setUserResetStage]  = useState(0) // 0=idle 1=confirm
  const [userResetBusy,   setUserResetBusy]   = useState(false)
  const [userResetMsg,    setUserResetMsg]    = useState(null)

  const [allResetStage,   setAllResetStage]   = useState(0) // 0=idle 1=first 2=final
  const [allResetBusy,    setAllResetBusy]    = useState(false)
  const [allResetMsg,     setAllResetMsg]     = useState(null)

  const [liveResetBusy,   setLiveResetBusy]   = useState(false)
  const [liveResetMsg,    setLiveResetMsg]    = useState(null)

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true)
    const { data } = await supabase
      .from('users')
      .select('id, display_name, email, total_points')
      .order('display_name')
    setUsers(data ?? [])
    setLoadingUsers(false)
  }, [])

  useEffect(() => { loadUsers() }, [loadUsers])

  /* ── Reset single user ───────────────────────────────────── */
  async function doUserReset() {
    if (!selectedUser) return
    setUserResetBusy(true); setUserResetMsg(null)
    const { error } = await supabase.rpc('admin_reset_user_bets', { p_user_id: selectedUser })
    setUserResetBusy(false)
    setUserResetStage(0)
    if (error) {
      setUserResetMsg({ type: 'err', text: `❌ ${error.message}` })
    } else {
      const name = users.find(u => u.id === selectedUser)?.display_name ?? 'המשתמש'
      setUserResetMsg({ type: 'ok', text: `✅ הניחושים של "${name}" אופסו בהצלחה` })
      setSelectedUser('')
      loadUsers()
    }
  }

  /* ── Reset ALL bets ──────────────────────────────────────── */
  async function doAllReset() {
    setAllResetBusy(true); setAllResetMsg(null)
    const { error } = await supabase.rpc('admin_reset_all_bets')
    setAllResetBusy(false)
    setAllResetStage(0)
    if (error) {
      setAllResetMsg({ type: 'err', text: `❌ ${error.message}` })
    } else {
      setAllResetMsg({ type: 'ok', text: '✅ כל ההימורים והנקודות אופסו בהצלחה' })
      loadUsers()
    }
  }

  /* ── Set live → upcoming ─────────────────────────────────── */
  async function doLiveReset() {
    setLiveResetBusy(true); setLiveResetMsg(null)
    const { data, error } = await supabase.rpc('admin_set_all_live_to_upcoming')
    setLiveResetBusy(false)
    if (error) {
      setLiveResetMsg({ type: 'err', text: `❌ ${error.message}` })
    } else {
      setLiveResetMsg({ type: 'ok', text: `✅ ${data ?? 0} משחקים הוחזרו ל-upcoming` })
    }
  }

  /* ─────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-5">

      {/* Warning banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 flex items-start gap-3">
        <span className="text-2xl mt-0.5">⚠️</span>
        <div className="text-sm text-amber-800">
          <p className="font-extrabold mb-0.5">אזור מסוכן — פעולות אלו אינן הפיכות</p>
          <p className="text-amber-700 text-xs">
            איפוס הימורים מוחק נתונים לצמיתות. ודא שאתה רוצה לעשות זאת לפני שתאשר.
          </p>
        </div>
      </div>

      {/* ── Section 1: Reset specific user ─────────────────── */}
      <Section title="איפוס הימורי משתמש ספציפי" icon="👤">
        {loadingUsers ? (
          <Spinner size="sm" />
        ) : (
          <>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500">בחר משתמש</label>
              <select
                value={selectedUser}
                onChange={e => { setSelectedUser(e.target.value); setUserResetStage(0); setUserResetMsg(null) }}
                className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-emerald-400"
              >
                <option value="">— בחר משתמש —</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.display_name || u.email} · {u.total_points} נק׳
                  </option>
                ))}
              </select>
            </div>

            {selectedUser && userResetStage === 0 && (
              <button
                onClick={() => setUserResetStage(1)}
                className="w-full bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-sm py-2.5 rounded-xl transition-colors"
              >
                🗑 אפס הימורים למשתמש זה
              </button>
            )}

            {selectedUser && userResetStage === 1 && (
              <ConfirmBox
                message={`למחוק את כל הניחושים של "${users.find(u => u.id === selectedUser)?.display_name}"?\nהנקודות שלו יתאפסו לאפס.`}
                onConfirm={doUserReset}
                onCancel={() => setUserResetStage(0)}
              />
            )}

            {userResetBusy && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span className="w-4 h-4 border-2 border-rose-400 border-t-transparent rounded-full animate-spin" />
                מאפס...
              </div>
            )}

            {userResetMsg && (
              <p className={`text-sm font-medium ${userResetMsg.type === 'ok' ? 'text-emerald-600' : 'text-red-500'}`}>
                {userResetMsg.text}
              </p>
            )}
          </>
        )}
      </Section>

      {/* ── Section 2: Reset ALL bets ──────────────────────── */}
      <Section title="איפוס כל ההימורים במערכת" icon="🔴">
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 space-y-1">
          <p className="font-bold">פעולה זו תמחק:</p>
          <ul className="list-disc list-inside text-xs space-y-0.5 text-red-600">
            <li>כל ההימורים על משחקי שלב הבתים (bets)</li>
            <li>כל ניחושי הבתים (group_predictions)</li>
            <li>כל ניחושי המדרגי (knockout_predictions)</li>
            <li>כל הנקודות של כל המשתמשים → 0</li>
          </ul>
        </div>

        {allResetStage === 0 && (
          <button
            onClick={() => { setAllResetStage(1); setAllResetMsg(null) }}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-extrabold text-sm py-3 rounded-xl transition-colors shadow-md shadow-red-200"
          >
            🔴 אפס את כל ההימורים במערכת
          </button>
        )}

        {allResetStage === 1 && (
          <ConfirmBox
            message="האם אתה בטוח? פעולה זו תמחק את כל ההימורים של כל המשתמשים ותאפס את כל הנקודות לאפס. אין דרך חזרה!"
            onConfirm={() => setAllResetStage(2)}
            onCancel={() => setAllResetStage(0)}
            dangerous
          />
        )}

        {allResetStage === 2 && (
          <div className="space-y-3">
            <div className="bg-red-100 border-2 border-red-400 rounded-xl p-3 text-center">
              <p className="text-red-800 font-extrabold text-sm">⚠️ אישור אחרון!</p>
              <p className="text-red-700 text-xs mt-1">
                אתה עומד למחוק את כל הנתונים מהמערכת. לא ניתן לשחזר.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={doAllReset}
                disabled={allResetBusy}
                className="flex-1 bg-red-700 hover:bg-red-800 text-white font-extrabold text-sm py-3 rounded-xl transition-colors disabled:opacity-60"
              >
                {allResetBusy
                  ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> מוחק...</span>
                  : '✅ כן, אפס הכל עכשיו'}
              </button>
              <button
                onClick={() => setAllResetStage(0)}
                className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold text-sm rounded-xl transition-colors"
              >
                ביטול
              </button>
            </div>
          </div>
        )}

        {allResetMsg && (
          <p className={`text-sm font-medium ${allResetMsg.type === 'ok' ? 'text-emerald-600' : 'text-red-500'}`}>
            {allResetMsg.text}
          </p>
        )}
      </Section>

      {/* ── Section 3: Match status bulk ────────────────────── */}
      <Section title="ניהול סטטוס משחקים" icon="📋">
        <p className="text-xs text-slate-500">
          אם משחק נשאר במצב "חי" בטעות, ניתן להחזיר את כולם ל-upcoming בלחיצה אחת.
        </p>

        <button
          onClick={doLiveReset}
          disabled={liveResetBusy}
          className="w-full bg-slate-700 hover:bg-slate-800 text-white font-bold text-sm py-2.5 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {liveResetBusy
            ? <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> מעדכן...</>
            : '↩ החזר כל המשחקים החיים ל-upcoming'}
        </button>

        {liveResetMsg && (
          <p className={`text-sm font-medium ${liveResetMsg.type === 'ok' ? 'text-emerald-600' : 'text-red-500'}`}>
            {liveResetMsg.text}
          </p>
        )}
      </Section>

    </div>
  )
}
