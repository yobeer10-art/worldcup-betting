import { useCallback, useEffect, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import { supabase } from '../../lib/supabase'

/* ── Israel timezone helpers ──────────────────────────────────── */
function israelToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })
}
function israelDate(iso) {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })
}
function israelTime(iso) {
  return new Date(iso).toLocaleTimeString('he-IL', {
    timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit', hour12: false,
  })
}
function israelFullDate() {
  return new Date().toLocaleDateString('he-IL', {
    timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function broadcastChannels(broadcast) {
  return broadcast === 'כאן 11' ? ['כאן 11', 'BOX'] : ['BOX', 'ספורט 1']
}

/* Team-name → flag emoji lookup (best-effort subset) */
const FLAG_MAP = {
  'ברזיל': '🇧🇷', 'ארגנטינה': '🇦🇷', 'צרפת': '🇫🇷', 'גרמניה': '🇩🇪',
  'ספרד': '🇪🇸', 'אנגליה': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'פורטוגל': '🇵🇹', 'הולנד': '🇳🇱',
  'ארה"ב': '🇺🇸', 'ארצות הברית': '🇺🇸', 'מקסיקו': '🇲🇽', 'קנדה': '🇨🇦',
  'יפן': '🇯🇵', 'קוריאה הדרומית': '🇰🇷', 'אוסטרליה': '🇦🇺', 'מרוקו': '🇲🇦',
  'סנגל': '🇸🇳', 'גאנה': '🇬🇭', 'ניגריה': '🇳🇬', 'קמרון': '🇨🇲',
  'קוסטה ריקה': '🇨🇷', 'פנמה': '🇵🇦', 'אורוגוואי': '🇺🇾', 'קולומביה': '🇨🇴',
  'צ׳ילה': '🇨🇱', 'פרגוואי': '🇵🇾', 'אקוודור': '🇪🇨', 'פרו': '🇵🇪',
  'בלגיה': '🇧🇪', 'שוויץ': '🇨🇭', 'קרואטיה': '🇭🇷', 'דנמרק': '🇩🇰',
  'פולין': '🇵🇱', 'סרביה': '🇷🇸', 'אוקראינה': '🇺🇦', 'צ׳כיה': '🇨🇿',
  'שוודיה': '🇸🇪', 'נורווגיה': '🇳🇴', 'טורקיה': '🇹🇷', 'אוסטריה': '🇦🇹',
  'סקוטלנד': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'וויילס': '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'אירלנד': '🇮🇪', 'הונגריה': '🇭🇺',
  'סלובניה': '🇸🇮', 'אלבניה': '🇦🇱', 'רומניה': '🇷🇴', 'סלובקיה': '🇸🇰',
  'איטליה': '🇮🇹', 'יוון': '🇬🇷', 'ירדן': '🇯🇴', 'ערב הסעודית': '🇸🇦',
  'איראן': '🇮🇷', 'עיראק': '🇮🇶', 'קטאר': '🇶🇦', 'אמירויות': '🇦🇪',
  'אינדונזיה': '🇮🇩', 'תאילנד': '🇹🇭', 'ניו זילנד': '🇳🇿', 'פיג׳י': '🇫🇯',
  'תוניסיה': '🇹🇳', 'אלג׳יריה': '🇩🇿', 'מצרים': '🇪🇬', 'קניה': '🇰🇪',
}
function flagOf(name) {
  return FLAG_MAP[name] ?? '🏳️'
}

const APP_LINK = 'worldcup-betting-rfhu.vercel.app'

/* ═══════════════════════════════════════════════════════════════ */
/*  SECTION 1 – Today's matches reminder                          */
/* ═══════════════════════════════════════════════════════════════ */
function TodayMatchesReminder() {
  const [matches,  setMatches]  = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [text,     setText]     = useState('')
  const [copied,   setCopied]   = useState(false)

  const buildText = useCallback((matches) => {
    if (matches.length === 0) {
      return '🌍 מונדיאל 2026\n\nאין עוד משחקים היום 🌙\nנתראה מחר! ⚽'
    }

    const lines = [
      '⚽ *מונדיאל 2026 – המשחקים הקרובים להימור!* ⚽',
      '',
    ]

    for (const m of matches) {
      const time  = israelTime(m.match_date)
      const chans = broadcastChannels(m.broadcast).join(' / ')
      lines.push(
        `${flagOf(m.home_team)} *${m.home_team}* נגד *${m.away_team}* ${flagOf(m.away_team)}`,
        `🕐 ${time}  📺 ${chans}`,
        '',
      )
    }

    lines.push(
      '🎯 הכנסו להמר לפני שהמשחקים ננעלים!',
      `🔗 ${APP_LINK}`,
    )

    return lines.join('\n')
  }, [])

  async function generate() {
    setLoading(true)
    const now    = new Date()
    const nowUTC = now.toISOString()                                  // current moment — excludes already-started matches
    const endUTC = new Date(now.getTime() + 18 * 60 * 60 * 1000).toISOString() // next 18 hours

    const { data } = await supabase
      .from('matches')
      .select('home_team, away_team, match_date, broadcast')
      .gt('match_date', nowUTC)   // strictly after now → upcoming only
      .lte('match_date', endUTC)  // within the next 18 hours (captures post-midnight games)
      .order('match_date')

    const result = buildText(data ?? [])
    setText(result)
    setMatches(data ?? [])
    setLoading(false)
  }

  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function shareWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={generate}
          disabled={loading}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-4 py-2
                     rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? '⏳ טוען...' : '⚡ צור הודעה'}
        </button>
        {matches !== null && (
          <span className="text-xs text-slate-500">
            {matches.length > 0 ? `${matches.length} משחקים היום` : 'אין משחקים היום'}
          </span>
        )}
      </div>

      {text && (
        <>
          <textarea
            readOnly
            value={text}
            dir="rtl"
            rows={Math.max(8, text.split('\n').length + 1)}
            className="w-full text-sm font-mono bg-slate-50 border border-slate-200 rounded-xl p-3
                       text-slate-700 resize-none focus:outline-none leading-relaxed"
          />
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={copy}
              className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-800 text-white
                         text-sm font-bold px-4 py-2 rounded-xl transition-colors"
            >
              {copied ? '✅ הועתק!' : '📋 העתק'}
            </button>
            <button
              onClick={shareWhatsApp}
              className="flex items-center gap-1.5 bg-green-500 hover:bg-green-600 text-white
                         text-sm font-bold px-4 py-2 rounded-xl transition-colors"
            >
              📲 שתף לוואטסאפ
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════ */
/*  SECTION 2 – Leaderboard image                                 */
/* ═══════════════════════════════════════════════════════════════ */
const RANK_ICON = ['🥇', '🥈', '🥉']

function LeaderboardImage() {
  const [users,     setUsers]     = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [rendering, setRendering] = useState(false)
  const tableRef = useRef(null)

  async function generate() {
    setLoading(true)
    const { data } = await supabase
      .from('users')
      .select('display_name, total_points')
      .order('total_points', { ascending: false })
      .order('display_name', { ascending: true })
    setUsers(data ?? [])
    setLoading(false)
  }

  async function downloadImage() {
    if (!tableRef.current) return
    setRendering(true)
    try {
      const canvas = await html2canvas(tableRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: null,
      })
      const url = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = url
      a.download = `leaderboard-${israelToday()}.png`
      a.click()
    } finally {
      setRendering(false)
    }
  }

  const dateStr = israelFullDate()

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button
          onClick={generate}
          disabled={loading}
          className="bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold px-4 py-2
                     rounded-xl transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? '⏳ טוען...' : '🏆 טען דירוג'}
        </button>
        {users !== null && (
          <span className="text-xs text-slate-500">{users.length} משתתפים</span>
        )}
      </div>

      {users !== null && (
        <>
          {/* Rendered leaderboard card (captured by html2canvas) */}
          <div
            ref={tableRef}
            style={{ fontFamily: 'Arial, sans-serif', direction: 'rtl' }}
            className="rounded-2xl overflow-hidden shadow-lg"
          >
            {/* Header */}
            <div style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%)', padding: '20px 24px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 32 }}>🏆</span>
                <div>
                  <div style={{ color: '#fbbf24', fontWeight: 900, fontSize: 20, lineHeight: 1 }}>טבלת הדירוג</div>
                  <div style={{ color: '#6ee7b7', fontSize: 12, marginTop: 3 }}>מונדיאל 2026 · {dateStr}</div>
                </div>
              </div>
            </div>

            {/* Table */}
            <div style={{ background: 'white' }}>
              {/* Column headers */}
              <div style={{ display: 'flex', alignItems: 'center', padding: '8px 20px', background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                <div style={{ width: 36, fontSize: 11, fontWeight: 700, color: '#64748b' }}>#</div>
                <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: '#64748b' }}>שחקן</div>
                <div style={{ width: 60, textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#64748b' }}>נקודות</div>
              </div>

              {users.map((u, i) => {
                const isTop3 = i < 3
                const bg = i === 0 ? '#fffbeb' : i === 1 ? '#f8fafc' : i === 2 ? '#fff7ed' : 'white'
                const borderColor = i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#fb923c' : '#f1f5f9'
                return (
                  <div
                    key={u.display_name}
                    style={{
                      display: 'flex', alignItems: 'center',
                      padding: '11px 20px',
                      background: bg,
                      borderBottom: `1px solid ${borderColor}`,
                    }}
                  >
                    <div style={{ width: 36, fontSize: isTop3 ? 20 : 13, fontWeight: 700, color: '#475569' }}>
                      {isTop3 ? RANK_ICON[i] : `${i + 1}.`}
                    </div>
                    <div style={{ flex: 1, fontSize: 14, fontWeight: isTop3 ? 800 : 600, color: '#1e293b' }}>
                      {u.display_name}
                    </div>
                    <div style={{
                      width: 60, textAlign: 'center', fontSize: 15,
                      fontWeight: 900,
                      color: i === 0 ? '#d97706' : i === 1 ? '#475569' : i === 2 ? '#c2410c' : '#334155',
                    }}>
                      {u.total_points}
                    </div>
                  </div>
                )
              })}

              {/* Footer */}
              <div style={{ padding: '10px 20px', background: '#f8fafc', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: '#94a3b8' }}>🔗 {APP_LINK}</div>
              </div>
            </div>
          </div>

          <button
            onClick={downloadImage}
            disabled={rendering}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white
                       text-sm font-bold px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
          >
            {rendering ? '⏳ מכין...' : '⬇️ הורד תמונה'}
          </button>
          <p className="text-xs text-slate-400">לאחר ההורדה, שלח את הקובץ לקבוצת הוואטסאפ ידנית.</p>
        </>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════ */
/*  Main export                                                    */
/* ═══════════════════════════════════════════════════════════════ */
export default function AdminWhatsAppTools() {
  return (
    <div className="space-y-8" dir="rtl">

      {/* Section 1 */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-4">
          <h2 className="text-white font-extrabold text-base flex items-center gap-2">
            ⚽ תזכורת משחקי היום
          </h2>
          <p className="text-emerald-100 text-xs mt-0.5">
            צור הודעת טקסט מוכנה לשיתוף עם משחקי היום
          </p>
        </div>
        <div className="p-5">
          <TodayMatchesReminder />
        </div>
      </div>

      {/* Section 2 */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4">
          <h2 className="text-white font-extrabold text-base flex items-center gap-2">
            🏆 טבלת דירוג כתמונה
          </h2>
          <p className="text-amber-100 text-xs mt-0.5">
            צור תמונה מעוצבת של הדירוג להורדה ושיתוף
          </p>
        </div>
        <div className="p-5">
          <LeaderboardImage />
        </div>
      </div>

    </div>
  )
}
