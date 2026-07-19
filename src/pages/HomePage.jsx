import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Header from '../components/Layout/Header'
import MatchCard from '../components/Matches/MatchCard'
import CompactMatchCard from '../components/Matches/CompactMatchCard'
import FlagImg from '../components/UI/FlagImg'
import Spinner from '../components/UI/Spinner'
import FinalHypeSplash from '../components/UI/FinalHypeSplash'

const KO_STAGES = new Set(['round_of_32','round_of_16','quarter','semi','third_place','final'])

const STAGE_LABEL = {
  quarter: 'רבע הגמר', semi: 'חצי הגמר', third_place: 'מקום שלישי', final: 'הגמר הגדול',
}

// Championship scenarios — locked picks only (bracket + champion + scorer),
// computed from the KO standings before the 3rd-place match and final.
// Match bets (up to 16 pts) can flip scenarios marked 'צמוד'.
const TITLE_SCENARIOS = [
  {
    id: 'spain-mbappe',
    champ: 'ספרד', scorerName: 'אמבפה',
    podium: [
      { name: 'מוזס', pts: 190 },
      { name: 'ברקו', pts: 172 },
      { name: 'איתי', pts: 146 },
    ],
    tight: false,
  },
  {
    id: 'spain-messi',
    champ: 'ספרד', scorerName: 'מסי',
    podium: [
      { name: 'מוזס', pts: 165 },
      { name: 'דוד',  pts: 153 },
      { name: 'ברקו', pts: 147 },
    ],
    tight: true,
  },
  {
    id: 'arg-mbappe',
    champ: 'ארגנטינה', scorerName: 'אמבפה',
    podium: [
      { name: 'איתי', pts: 183 },
      { name: 'דוד',  pts: 165 },
      { name: 'מוזס', pts: 153 },
    ],
    tight: true,
  },
  {
    id: 'arg-messi',
    champ: 'ארגנטינה', scorerName: 'מסי',
    podium: [
      { name: 'דוד',  pts: 190 },
      { name: 'מאיר', pts: 176 },
      { name: 'איתי', pts: 155 },
    ],
    tight: true,
  },
]

// Golden-boot race note — Mbappé (plays 3rd place) vs Messi (plays final), tied on 8
function scorerNote(name) {
  if (!name) return null
  if (name.includes('מבפה') || name.toLowerCase?.().includes('mbapp')) {
    return '⚔️ תיקו 8–8 מול מסי — יזכה אם יבקיע במשחק 3–4 יותר משמסי יבקיע בגמר'
  }
  if (name.includes('מסי') || name.toLowerCase?.().includes('messi')) {
    return '⚔️ תיקו 8–8 מול אמבפה — יזכה אם יבקיע בגמר יותר משאמבפה יבקיע במשחק 3–4'
  }
  return 'המירוץ לנעל הזהב יוכרע במשחקי הסיום'
}

/* ── Live countdown row ──────────────────────────────────────── */
function Countdown({ target }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const ms = new Date(target).getTime() - now
  if (ms <= 0) return null

  const days  = Math.floor(ms / 86_400_000)
  const hours = Math.floor((ms % 86_400_000) / 3_600_000)
  const mins  = Math.floor((ms % 3_600_000) / 60_000)
  const secs  = Math.floor((ms % 60_000) / 1000)

  return (
    <div className="flex justify-center gap-2" dir="ltr">
      {[
        { v: days,  l: 'ימים'  },
        { v: hours, l: 'שעות'  },
        { v: mins,  l: 'דקות'  },
        { v: secs,  l: 'שניות' },
      ].map(({ v, l }) => (
        <div key={l} className="bg-white/15 backdrop-blur-sm rounded-xl px-2.5 py-1.5 min-w-[52px] text-center">
          <div className="text-xl font-black tabular-nums leading-none">{String(v).padStart(2, '0')}</div>
          <div className="text-[9px] text-white/60 font-semibold mt-0.5">{l}</div>
        </div>
      ))}
    </div>
  )
}

/* ── Tournament finale: festive final standings ───────────────── */
function ChampionsFinale({ standings }) {
  const [first, second, third, ...rest] = standings

  return (
    <div className="relative overflow-hidden rounded-3xl shadow-xl bg-gradient-to-b from-amber-500 via-orange-500 to-rose-600">
      {/* Ambient glows */}
      <div className="absolute -top-12 -left-12 w-48 h-48 bg-yellow-300/25 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-14 -right-10 w-44 h-44 bg-white/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative p-4 pb-4 text-white">
        {/* Header */}
        <div className="text-center mb-4">
          <p className="text-[11px] font-extrabold tracking-[0.3em] uppercase text-white/70">
            🏁 מונדיאל 2026 · הטורניר הסתיים
          </p>
          <h2 className="text-2xl font-black leading-tight mt-1">התוצאות הסופיות</h2>
          <p className="text-[11px] text-white/70 font-semibold mt-1">
            לפי טבלת הנוקאאוט — הימורים + ברקט + אלופה ומלך שערים
          </p>
        </div>

        {/* Tournament winners strip */}
        <div className="flex justify-center gap-2 mb-5 text-center">
          <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 flex-1">
            <p className="text-[10px] text-white/60 font-bold mb-1">אלופת העולם</p>
            <div className="flex items-center justify-center gap-1.5">
              <FlagImg team="ספרד" size="xs" />
              <span className="text-sm font-black">ספרד</span>
            </div>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 flex-1">
            <p className="text-[10px] text-white/60 font-bold mb-1">מלך השערים</p>
            <span className="text-sm font-black">👟 אמבפה</span>
          </div>
          <div className="bg-white/15 backdrop-blur-sm rounded-xl px-3 py-2 flex-1">
            <p className="text-[10px] text-white/60 font-bold mb-1">מקום שלישי</p>
            <div className="flex items-center justify-center gap-1.5">
              <FlagImg team="אנגליה" size="xs" />
              <span className="text-sm font-black">אנגליה</span>
            </div>
          </div>
        </div>

        {/* Champion of the league */}
        {first && (
          <div className="final-frame mb-3">
            <div className="bg-white rounded-2xl px-4 py-4 text-center relative overflow-hidden">
              <span className="final-sparkle" style={{ top: '8px', right: '10%', animationDelay: '0s'   }}>✨</span>
              <span className="final-sparkle" style={{ top: '14px', left: '8%',  animationDelay: '0.8s' }}>⭐</span>
              <p className="text-4xl mb-1">👑</p>
              <p className="text-[11px] font-extrabold text-amber-500 tracking-widest uppercase mb-0.5">
                אלוף מהמרי בראשית 2026
              </p>
              <h3 className="text-3xl font-black text-slate-800">{first.display_name}</h3>
              <p className="text-lg font-black text-amber-600 tabular-nums mt-0.5">
                {first.total_points} נקודות
              </p>
              {second && first.total_points - second.total_points === 1 && (
                <p className="text-[11px] font-bold text-rose-500 mt-1">
                  🔥 הוכרע בנקודה אחת בלבד!
                </p>
              )}
            </div>
          </div>
        )}

        {/* 2nd + 3rd */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {second && (
            <div className="bg-white/95 rounded-2xl px-3 py-3 text-center">
              <p className="text-xl">🥈</p>
              <p className="text-sm font-black text-slate-700 truncate">{second.display_name}</p>
              <p className="text-[13px] font-bold text-slate-400 tabular-nums">{second.total_points} נק׳</p>
            </div>
          )}
          {third && (
            <div className="bg-white/95 rounded-2xl px-3 py-3 text-center">
              <p className="text-xl">🥉</p>
              <p className="text-sm font-black text-slate-700 truncate">{third.display_name}</p>
              <p className="text-[13px] font-bold text-slate-400 tabular-nums">{third.total_points} נק׳</p>
            </div>
          )}
        </div>

        {/* Rest of the table */}
        {rest.length > 0 && (
          <div className="bg-white/95 rounded-2xl overflow-hidden divide-y divide-slate-50">
            {rest.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-2">
                <span className="text-[13px] font-bold text-slate-600">
                  <span className="inline-block w-6 text-slate-300 font-semibold">{i + 4}</span>
                  {p.display_name}
                </span>
                <span className="text-[13px] font-semibold text-slate-400 tabular-nums">{p.total_points} נק׳</span>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-white/80 font-bold mt-4">
          תודה שהימרתם איתנו — נתראה במונדיאל 2030! ⚽❤️
        </p>
      </div>
    </div>
  )
}

/* ── Unified knockout hub: hype + countdown + betting in one ─── */
function KnockoutHub({ bigMatches, userBets, stats, onBetPlaced, champion, scorer, user, allPicks }) {
  // Only unfinished matches are shown as cards (results live in the leaderboard)
  const showMatches = bigMatches.filter(m => m.status !== 'finished')
  const nextUp  = bigMatches.find(m => m.status === 'upcoming' && new Date(m.match_date).getTime() > Date.now())
  const isFinal = bigMatches.some(m => m.stage === 'final')
  const stageLabel = isFinal ? 'הגמר הגדול' : STAGE_LABEL[bigMatches[0]?.stage] ?? 'נוקאאוט'
  const unbetCount = bigMatches.filter(m =>
    m.status === 'upcoming' && !userBets[m.id]?.advance_pick
  ).length

  // Teams still in the title race: SF participants, minus SF losers once decided
  const aliveTeams = new Set()
  bigMatches.filter(m => m.stage === 'semi').forEach(m => {
    if (m.status === 'finished' && m.result) {
      aliveTeams.add(m.result === 'home' ? m.home_team : m.away_team)
    } else {
      aliveTeams.add(m.home_team)
      aliveTeams.add(m.away_team)
    }
  })
  bigMatches.filter(m => m.stage === 'final').forEach(m => {
    if (m.status === 'finished' && m.result) {
      aliveTeams.clear()
      aliveTeams.add(m.result === 'home' ? m.home_team : m.away_team)
    }
  })
  const champAlive = champion != null && aliveTeams.size > 0 && aliveTeams.has(champion)

  // Tournament progress: 104 total matches; remaining = unfinished among SF/3rd/Final
  // (3rd place + final rows may not exist yet — count them as remaining anyway)
  const bigFinished  = bigMatches.filter(m => m.status === 'finished').length
  const playedTotal  = 100 + bigFinished
  const progressPct  = Math.round((playedTotal / 104) * 100)

  return (
    <div className={`relative overflow-hidden rounded-3xl shadow-xl ${
      isFinal
        ? 'bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600'
        : 'bg-gradient-to-br from-indigo-700 via-purple-700 to-fuchsia-700'
    }`}>
      {/* Decorative glows */}
      <div className="absolute -top-12 -left-12 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-14 -right-10 w-44 h-44 bg-white/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative p-4 pb-3 text-white">
        {/* Title */}
        <div className="text-center mb-1">
          <p className="text-[11px] font-extrabold tracking-[0.25em] uppercase text-white/60">
            {isFinal ? '🏆 מונדיאל 2026 🏆' : '⚡ מונדיאל 2026 ⚡'}
          </p>
          <h2 className="text-2xl font-black leading-tight mt-0.5">
            {stageLabel} כאן!
          </h2>
          <p className="text-[12px] text-white/80 font-semibold mt-1">
            {isFinal
              ? 'משחק אחד. גביע אחד. ההימור הכי חשוב שלך.'
              : '4 נבחרות. 2 כרטיסים לגמר. ההימור שלך על הפרק.'}
          </p>
        </div>

        {/* Boosted points banner */}
        <div className="flex items-center justify-center gap-2 my-3">
          <span className="bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 text-[11px] font-extrabold">
            ⚡ עולה לגמר = <span className="text-amber-300">3 נק׳</span>
          </span>
          <span className="bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 text-[11px] font-extrabold">
            🎯 תוצאה מדויקת = <span className="text-amber-300">5 נק׳</span>
          </span>
        </div>

        {/* Final-stretch progress bar */}
        <div className="mb-3">
          <div className="flex justify-between items-center text-[10px] font-bold mb-1">
            <span className="text-amber-300">🏁 הישורת האחרונה של המונדיאל</span>
            <span className="text-white/60 tabular-nums">{playedTotal}/104 משחקים</span>
          </div>
          <div className="h-2 bg-white/15 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-300 rounded-full transition-all duration-1000"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Countdown to next kickoff */}
        {nextUp && (
          <div className="mb-1">
            <p className="text-center text-[10px] text-white/60 font-bold mb-1.5">
              המשחק הקרוב: {nextUp.home_team} נגד {nextUp.away_team}
            </p>
            <Countdown target={nextUp.match_date} />
          </div>
        )}

        {/* Urgency nudge */}
        {unbetCount > 0 && (
          <p className="text-center text-[12px] font-extrabold text-amber-300 mt-3 animate-pulse">
            🔥 {unbetCount === 1 ? 'משחק אחד עוד מחכה להימור שלך' : `${unbetCount} משחקים עוד מחכים להימור שלך`} — אל תפספס!
          </p>
        )}
        {unbetCount === 0 && bigMatches.some(m => m.status === 'upcoming') && (
          <p className="text-center text-[12px] font-extrabold text-emerald-300 mt-3">
            ✅ כל ההימורים שלך בפנים — בהצלחה!
          </p>
        )}
      </div>

      {/* Betting cards embedded — the Final gets a golden shimmering centerpiece */}
      <div className="relative px-3 pb-3 space-y-3">
        {showMatches.map(m => (
          m.stage === 'final' ? (
            <div key={m.id} className="relative pt-4">
              {/* Floating sparkles */}
              <span className="final-sparkle" style={{ top: '2px',  right: '8%',  animationDelay: '0s'   }}>✨</span>
              <span className="final-sparkle" style={{ top: '14px', left:  '6%',  animationDelay: '0.7s' }}>⭐</span>
              <span className="final-sparkle" style={{ bottom: '10px', right: '4%', animationDelay: '1.2s' }}>✨</span>
              <span className="final-sparkle" style={{ bottom: '30px', left: '3%',  animationDelay: '0.4s' }}>💫</span>

              {/* Golden ribbon header */}
              <div className="final-ribbon rounded-t-2xl mx-4 -mb-1 relative z-0 px-3 pt-1.5 pb-3 text-center">
                <span className="text-[11px] font-black text-amber-900 tracking-widest uppercase">
                  🏆 הגמר הגדול · מי לוקחת את הגביע? 🏆
                </span>
              </div>

              {/* Shimmering gold frame around the betting card */}
              <div className="final-frame relative z-[1]">
                <CompactMatchCard
                  match={m}
                  userBet={userBets[m.id] ?? null}
                  communityStats={stats[m.id] ?? null}
                  onBetPlaced={onBetPlaced}
                  isToday
                />
              </div>
            </div>
          ) : (
            <CompactMatchCard
              key={m.id}
              match={m}
              userBet={userBets[m.id] ?? null}
              communityStats={stats[m.id] ?? null}
              onBetPlaced={onBetPlaced}
              isToday
            />
          )
        ))}
      </div>

      {/* Grand bets: champion + top scorer, right here in the party */}
      {user && (
        <div className="relative px-3 pb-4">
          <p className="text-center text-[10px] font-extrabold tracking-widest uppercase text-white/50 mb-2">
            — ההימורים הגדולים שלך · 25 נק׳ כל אחד —
          </p>
          <div className="grid grid-cols-2 gap-2">

            {/* Champion pick */}
            <Link
              to="/special?t=champion"
              className={`rounded-2xl p-3 border-2 backdrop-blur-sm transition-all ${
                champion
                  ? champAlive
                    ? 'bg-gradient-to-br from-amber-400/25 to-yellow-500/15 border-amber-300/60'
                    : 'bg-white/5 border-white/15 opacity-80'
                  : 'bg-white/10 border-dashed border-white/30 hover:bg-white/15'
              }`}
            >
              <p className="text-[9px] font-extrabold text-white/60 uppercase tracking-wide mb-1.5">
                🥇 האלופה שלך
              </p>
              {champion ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <FlagImg team={champion} size="sm" />
                    <span className="text-xs font-black text-white truncate">{champion}</span>
                  </div>
                  <p className={`text-[10px] font-extrabold mt-1.5 ${
                    champAlive ? 'text-amber-300 animate-pulse' : 'text-white/40'
                  }`}>
                    {champAlive ? '🔥 עדיין במירוץ לגביע!' : '💔 הודחה מהמירוץ'}
                  </p>
                </>
              ) : (
                <p className="text-xs font-bold text-amber-300">עוד לא בחרת →</p>
              )}
            </Link>

            {/* Top scorer pick */}
            <Link
              to="/special?t=scorer"
              className={`rounded-2xl p-3 border-2 backdrop-blur-sm transition-all ${
                scorer
                  ? 'bg-gradient-to-br from-sky-400/25 to-cyan-500/15 border-sky-300/50'
                  : 'bg-white/10 border-dashed border-white/30 hover:bg-white/15'
              }`}
            >
              <p className="text-[9px] font-extrabold text-white/60 uppercase tracking-wide mb-1.5">
                ⚽ מלך השערים שלך
              </p>
              {scorer ? (
                <>
                  <span className="text-xs font-black text-white leading-snug line-clamp-2">{scorer}</span>
                  <p className="text-[10px] font-extrabold text-sky-300 mt-1.5 leading-snug">{scorerNote(scorer)}</p>
                </>
              ) : (
                <p className="text-xs font-bold text-sky-300">עוד לא בחרת →</p>
              )}
            </Link>

          </div>
        </div>
      )}

      {/* Everyone's champion + scorer picks */}
      {allPicks?.length > 0 && (
        <div className="relative px-3 pb-4">
          <h3 className="text-center text-sm font-bold text-white/90 mb-2.5">
            מי הימר על מי · 25 נק׳ לכל פגיעה
          </h3>
          <div className="bg-white/95 backdrop-blur-sm rounded-2xl overflow-hidden shadow-sm divide-y divide-slate-50">
            <div className="flex items-center gap-2 px-4 py-2">
              <span className="text-[11px] font-semibold text-slate-400 w-20 shrink-0">שחקן</span>
              <span className="text-[11px] font-semibold text-slate-400 flex-1">אלופה</span>
              <span className="text-[11px] font-semibold text-slate-400 flex-1">מלך שערים</span>
            </div>
            {allPicks.map(p => {
              const alive = p.champion != null && aliveTeams.size > 0 && aliveTeams.has(p.champion)
              return (
                <div key={p.id} className="flex items-center gap-2 px-4 py-2.5">
                  <span className="text-[13px] font-bold text-slate-700 w-20 truncate shrink-0">
                    {p.name}
                  </span>
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    {p.champion ? (
                      <>
                        <FlagImg team={p.champion} size="xs" />
                        <span className={`text-[13px] truncate ${
                          alive ? 'font-bold text-slate-700' : 'font-medium text-slate-300 line-through'
                        }`}>
                          {p.champion}
                        </span>
                      </>
                    ) : (
                      <span className="text-[13px] text-slate-300">—</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <span className={`text-[13px] truncate ${
                      p.scorer ? 'font-semibold text-slate-600' : 'text-slate-300'
                    }`}>
                      {p.scorer ?? '—'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Championship scenarios */}
      <div className="relative px-3 pb-4">
        <h3 className="text-center text-sm font-bold text-white/90 mb-2.5">
          תרחישי האליפות · מי מסיים ראשון?
        </h3>

        <div className="space-y-2.5">
          {TITLE_SCENARIOS.map(sc => (
            <div key={sc.id} className="bg-white/95 backdrop-blur-sm rounded-2xl overflow-hidden shadow-sm">
              {/* Scenario condition header */}
              <div className="px-4 pt-3 pb-2 flex items-center justify-center gap-2 border-b border-slate-100">
                <FlagImg team={sc.champ} size="xs" />
                <span className="text-[13px] font-bold text-slate-700">
                  {sc.champ} אלופה · {sc.scorerName} מלך שערים
                </span>
              </div>

              {/* Podium */}
              <div className="px-4 py-2 divide-y divide-slate-50">
                {sc.podium.map((p, i) => (
                  <div key={p.name} className={`flex items-center justify-between py-2 ${
                    i === 0 ? '-mx-4 px-4 bg-amber-50/70' : ''
                  }`}>
                    <span className={`${
                      i === 0 ? 'text-sm font-extrabold text-amber-700' : 'text-[13px] font-semibold text-slate-500'
                    }`}>
                      <span className="inline-block w-6">{i === 0 ? '👑' : i === 1 ? '🥈' : '🥉'}</span>
                      {p.name}
                    </span>
                    <span className={`tabular-nums ${
                      i === 0 ? 'text-sm font-extrabold text-amber-600' : 'text-[13px] font-semibold text-slate-400'
                    }`}>
                      {p.pts} נק׳
                    </span>
                  </div>
                ))}
              </div>

              {sc.tight && (
                <p className="text-center text-[11px] text-slate-400 pb-2.5 px-4">
                  מרוץ צמוד — הימורי המשחקים האחרונים יכולים להכריע
                </p>
              )}
            </div>
          ))}
        </div>

        <p className="text-center text-[11px] text-white/60 font-medium mt-3 leading-relaxed">
          מרוץ מלך השערים: תיקו 8–8 · אמבפה משחק בשבת, מסי בגמר ביום ראשון
        </p>
      </div>
    </div>
  )
}

/* ── Date helpers (Israel time) ──────────────────────────────── */
function israelToday() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })
}
function israelDayRange(d) {
  return {
    start: new Date(`${d}T00:00:00+03:00`),
    end:   new Date(`${d}T23:59:59+03:00`),
  }
}
function hebrewDateShort(dateStr) {
  return new Date(`${dateStr}T12:00:00+03:00`).toLocaleDateString('he-IL', {
    timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'long', weekday: 'short',
  })
}

/* ════════════════════════════════════════════════════════════════ */
export default function HomePage() {
  const { user, profile } = useAuth()

  const [matches,    setMatches]    = useState([])
  const [bigKoMatches, setBigKoMatches] = useState([])
  const [userBets,   setUserBets]   = useState({})
  const [stats,      setStats]      = useState({})
  const [rank,       setRank]       = useState(null)
  const [koPts,      setKoPts]      = useState(null)
  const [totalUsers, setTotalUsers] = useState(0)
  const [champion,   setChampion]   = useState(null)
  const [scorer,     setScorer]     = useState(null)
  const [allPicks,   setAllPicks]   = useState([])
  const [standings,  setStandings]  = useState([])
  const [dateStr,    setDateStr]    = useState(israelToday)
  const [isNext,     setIsNext]     = useState(false)
  const [loading,    setLoading]    = useState(true)

  const fetchAll = useCallback(async () => {
    const today = israelToday()
    const { start, end } = israelDayRange(today)

    // ── Today's matches ─────────────────────────────────────────
    let { data: dayMatches } = await supabase
      .from('matches').select('*')
      .gte('match_date', start.toISOString())
      .lte('match_date', end.toISOString())
      .order('match_date')

    let usedDate = today
    let next = false

    if (!dayMatches?.length) {
      const { data: up } = await supabase
        .from('matches').select('match_date')
        .gt('match_date', end.toISOString())
        .order('match_date').limit(1)

      if (up?.length) {
        usedDate = new Date(up[0].match_date)
          .toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })
        const { start: ns, end: ne } = israelDayRange(usedDate)
        const { data: nm } = await supabase
          .from('matches').select('*')
          .gte('match_date', ns.toISOString())
          .lte('match_date', ne.toISOString())
          .order('match_date')
        dayMatches = nm ?? []
        next = true
      }
    }

    setMatches(dayMatches ?? [])
    setDateStr(usedDate)
    setIsNext(next)

    // ── Big KO matches (SF / 3rd / Final) — always fetched, all days ──
    const { data: bigData } = await supabase
      .from('matches').select('*')
      .in('stage', ['semi', 'third_place', 'final'])
      .order('match_date')
    setBigKoMatches(bigData ?? [])

    // ── Parallel fetches ─────────────────────────────────────────
    const idSet = new Set([
      ...(dayMatches ?? []).map(m => m.id),
      ...(bigData ?? []).map(m => m.id),
    ])
    const ids = [...idSet]
    const [statsRes, totalRes, betsRes, koLbRes, champRes, scorerRes, usersRes] =
      await Promise.all([
        ids.length
          ? supabase.from('bet_stats').select('*').in('match_id', ids)
          : Promise.resolve({ data: [] }),
        supabase.from('users').select('id', { count: 'exact', head: true }),
        user && ids.length
          ? supabase.from('bets').select('*').eq('user_id', user.id).in('match_id', ids)
          : Promise.resolve({ data: [] }),
        supabase.rpc('knockout_leaderboard'),
        supabase.from('champion_predictions').select('user_id, team'),
        supabase.from('top_scorer_predictions').select('user_id, player_name'),
        supabase.from('users').select('id, display_name, total_points').order('total_points', { ascending: false }),
      ])

    const sm = {}
    statsRes.data?.forEach(s => { sm[s.match_id] = s })
    setStats(sm)

    setTotalUsers(totalRes.count ?? 0)

    const bm = {}
    betsRes.data?.forEach(b => { bm[b.match_id] = b })
    setUserBets(bm)

    // Knockout leaderboard: hero shows KO points + KO rank (not the overall table)
    if (user && koLbRes.data?.length) {
      const koList = koLbRes.data
      const idx = koList.findIndex(r => r.user_id === user.id)
      if (idx >= 0) {
        setKoPts(Number(koList[idx].knockout_points ?? 0))
        setRank(idx + 1)
      }
    }
    // Own picks derived from the all-users lists
    setChampion(champRes.data?.find(c => c.user_id === user?.id)?.team ?? null)
    setScorer(scorerRes.data?.find(s => s.user_id === user?.id)?.player_name ?? null)

    // Everyone's champion + scorer picks (for the hub panel)
    const picksList = (usersRes.data ?? [])
      .map(u => ({
        id:       u.id,
        name:     u.display_name,
        champion: champRes.data?.find(c => c.user_id === u.id)?.team ?? null,
        scorer:   scorerRes.data?.find(s => s.user_id === u.id)?.player_name ?? null,
      }))
      .filter(p => p.champion || p.scorer)
    setAllPicks(picksList)
    // Final standings = the knockout table (KO bets + bracket + awards) — the deciding table
    setStandings((koLbRes.data ?? []).map(r => ({
      id: r.user_id,
      display_name: r.display_name,
      total_points: Number(r.knockout_points ?? 0),
    })))

    setLoading(false)
  }, [user, profile?.total_points])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Big KO matches (SF / 3rd place / Final) get the unified hub treatment.
  // Hub shows upcoming/live plus recently finished (until the next stage starts).
  const bigMatches   = bigKoMatches
  const otherMatches = matches.filter(m => !['semi', 'third_place', 'final'].includes(m.stage))

  /* ── Render ──────────────────────────────────────────────────── */
  const finalMatch = bigMatches.find(m => m.stage === 'final' && m.status === 'upcoming')
  const tournamentOver = bigMatches.some(m => m.stage === 'final' && m.status === 'finished')

  return (
    <>
      {!loading && finalMatch && <FinalHypeSplash match={finalMatch} />}
      <Header />
      <main className="max-w-lg mx-auto px-4 py-5 pb-24 space-y-6">

        {/* ── Hero / stats ───────────────────────────────────── */}
        {user ? (
          <div className="bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600
                          rounded-2xl p-5 text-white shadow-md">
            <p className="text-emerald-100 text-sm mb-1">
              שלום, <span className="font-bold">{profile?.display_name || 'שחקן'}</span> 👋
            </p>
            {bigMatches.length > 0 && (
              <p className="text-[11px] text-amber-200 font-extrabold mb-3">
                🏆 הישורת האחרונה — כל נקודה שווה זהב!
              </p>
            )}
            <div className="flex items-end gap-4">
              <div className="flex-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold tabular-nums leading-none">
                    {koPts ?? profile?.total_points ?? 0}
                  </span>
                  <span className="text-emerald-200 text-base">
                    {koPts != null ? 'נק׳ נוקאאוט' : 'נקודות'}
                  </span>
                </div>
              </div>
              {rank && (
                <div className="text-right">
                  <div className="text-2xl font-extrabold">#{rank}</div>
                  <p className="text-emerald-200 text-xs">
                    {koPts != null ? `בטבלת הנוקאאוט · ${totalUsers} שחקנים` : `מתוך ${totalUsers} שחקנים`}
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600
                          rounded-2xl p-5 text-white shadow-md">
            <div className="text-2xl font-extrabold mb-1">ברוכים הבאים! ⚽</div>
            <p className="text-emerald-100 text-sm mb-4">
              נחש תוצאות, בחר אלופה ומלך שערים — עלה בדירוג
            </p>
            <Link
              to="/auth"
              className="inline-block bg-white text-emerald-700 px-5 py-2.5 rounded-xl
                         font-bold text-sm hover:bg-emerald-50 transition-colors shadow-sm"
            >
              הצטרף בחינם
            </Link>
          </div>
        )}

        {/* ── Tournament over: festive final standings ─────────── */}
        {!loading && tournamentOver && <ChampionsFinale standings={standings} />}

        {/* ── Unified knockout hub (SF / Final: hype + betting) ── */}
        {!loading && !tournamentOver && bigMatches.length > 0 && (
          <KnockoutHub
            bigMatches={bigMatches}
            userBets={userBets}
            stats={stats}
            onBetPlaced={fetchAll}
            champion={champion}
            scorer={scorer}
            user={user}
            allPicks={allPicks}
          />
        )}

        {/* ── Smart next-bet nudge (hidden when hub is showing — it has its own) ── */}
        {user && !loading && bigMatches.length === 0 && (() => {
          const now = Date.now()
          const nextUnbet = matches.find(m =>
            m.status === 'upcoming' &&
            !userBets[m.id] &&
            new Date(m.match_date).getTime() - now > 5 * 60_000 &&
            !m.is_locked
          )
          if (!nextUnbet) {
            const hasBettable = matches.some(m => m.status === 'upcoming')
            if (!hasBettable) return null
            return (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3">
                <span className="text-xl">✅</span>
                <p className="text-sm font-bold text-emerald-700">כל ההימורים לסבב הזה הוגשו!</p>
              </div>
            )
          }
          const minsLeft = Math.floor((new Date(nextUnbet.match_date).getTime() - now) / 60_000)
          const urgent = minsLeft <= 30
          return (
            <Link
              to="/matches"
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 border transition-all shadow-sm ${
                urgent
                  ? 'bg-rose-50 border-rose-200 hover:border-rose-300'
                  : 'bg-amber-50 border-amber-200 hover:border-amber-300'
              }`}
            >
              <span className="text-2xl flex-shrink-0">{urgent ? '🔥' : '⚽'}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-extrabold ${urgent ? 'text-rose-700' : 'text-amber-700'}`}>
                  {urgent ? `נסגר בעוד ${minsLeft} דקות!` : 'עוד לא הימרת'}
                </p>
                <p className="text-sm font-bold text-slate-800 truncate">
                  {nextUnbet.home_team} נגד {nextUnbet.away_team}
                </p>
              </div>
              <span className={`text-xs font-bold flex-shrink-0 ${urgent ? 'text-rose-500' : 'text-amber-500'}`}>
                הימר ←
              </span>
            </Link>
          )
        })()}

        {/* ── Today's / next matches (big KO matches live in the hub above) ── */}
        {(loading || bigMatches.length === 0 || otherMatches.length > 0) && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-extrabold text-slate-800">
                {isNext ? '⚽ משחקים קרובים' : `⚽ משחקי היום · ${hebrewDateShort(dateStr)}`}
              </h2>
              <Link to="/matches" className="text-xs text-emerald-600 font-semibold hover:underline">
                כל המשחקים ←
              </Link>
            </div>

            {loading ? (
              <Spinner size="sm" />
            ) : otherMatches.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-6 text-center">
                <div className="text-3xl mb-2">🏆</div>
                <p className="text-slate-500 text-sm font-medium">אין משחקים בתקופה הקרובה</p>
              </div>
            ) : (
              <div className="space-y-4">
                {otherMatches.map(m => (
                  KO_STAGES.has(m.stage)
                    ? <CompactMatchCard
                        key={m.id}
                        match={m}
                        userBet={userBets[m.id] ?? null}
                        communityStats={stats[m.id] ?? null}
                        onBetPlaced={fetchAll}
                        isToday={!isNext}
                      />
                    : <MatchCard
                        key={m.id}
                        match={m}
                        userBet={userBets[m.id] ?? null}
                        communityStats={stats[m.id] ?? null}
                        onBetPlaced={fetchAll}
                      />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Special bets quick status (hidden when hub shows them) ── */}
        {bigMatches.length === 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-extrabold text-slate-800">🏆 ניחושים מיוחדים</h2>
            <Link to="/special" className="text-xs text-emerald-600 font-semibold hover:underline">
              ערוך ←
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">

            {/* Champion card */}
            <Link
              to="/special?t=champion"
              className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm
                         hover:border-amber-300 hover:shadow-md transition-all group"
            >
              <p className="text-[10px] text-slate-400 font-semibold mb-2 uppercase tracking-wide">
                🥇 אלופה · 25 נק׳
              </p>
              {champion ? (
                <div className="flex items-center gap-2">
                  <FlagImg team={champion} size="sm" className="shrink-0" />
                  <span className="text-sm font-bold text-slate-800 truncate">{champion}</span>
                </div>
              ) : (
                <p className="text-sm text-amber-600 font-bold group-hover:text-amber-700">
                  לחץ לבחור →
                </p>
              )}
            </Link>

            {/* Top scorer card */}
            <Link
              to="/special?t=scorer"
              className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm
                         hover:border-sky-300 hover:shadow-md transition-all group"
            >
              <p className="text-[10px] text-slate-400 font-semibold mb-2 uppercase tracking-wide">
                ⚽ מלך שערים · 25 נק׳
              </p>
              {scorer ? (
                <span className="text-sm font-bold text-slate-800 leading-snug">{scorer}</span>
              ) : (
                <p className="text-sm text-sky-600 font-bold group-hover:text-sky-700">
                  לחץ לבחור →
                </p>
              )}
            </Link>

          </div>
        </section>
        )}

      </main>
    </>
  )
}
