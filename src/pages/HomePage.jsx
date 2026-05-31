import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import Header from '../components/Layout/Header'
import MatchCard from '../components/Matches/MatchCard'
import Spinner from '../components/UI/Spinner'

function StatBox({ value, label, highlight, icon }) {
  return (
    <div
      className={`flex-1 rounded-xl px-3 py-2.5 text-center transition-transform hover:scale-105 ${
        highlight
          ? 'bg-white/25 ring-1 ring-white/30'
          : 'bg-white/15'
      }`}
    >
      {icon && <div className="text-lg mb-0.5">{icon}</div>}
      <div
        className={`text-2xl font-extrabold tabular-nums leading-none ${
          highlight ? 'text-yellow-300' : 'text-white'
        }`}
      >
        {value}
      </div>
      <div className="text-xs text-green-100/80 mt-1">{label}</div>
    </div>
  )
}

export default function HomePage() {
  const { user, profile } = useAuth()
  const [upcomingMatches, setUpcomingMatches] = useState([])
  const [userBets, setUserBets] = useState({})
  const [stats, setStats] = useState({ totalUsers: 0, totalBets: 0 })
  const [loading, setLoading] = useState(true)

  async function fetchData() {
    const [matchesRes, usersRes, betsRes] = await Promise.all([
      supabase
        .from('matches')
        .select('*')
        .eq('status', 'upcoming')
        .gte('match_date', new Date().toISOString())
        .order('match_date', { ascending: true })
        .limit(3),
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('bets').select('id', { count: 'exact', head: true }),
    ])

    setUpcomingMatches(matchesRes.data ?? [])
    setStats({ totalUsers: usersRes.count ?? 0, totalBets: betsRes.count ?? 0 })

    if (user) {
      const { data: myBets } = await supabase
        .from('bets')
        .select('*')
        .eq('user_id', user.id)
      const map = {}
      myBets?.forEach((b) => { map[b.match_id] = b })
      setUserBets(map)
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [user]) // eslint-disable-line

  return (
    <>
      <Header />
      <main className="max-w-lg mx-auto px-4 py-5">

        {/* ── Hero banner ───────────────────────────────── */}
        <div className="relative overflow-hidden bg-gradient-to-br from-green-800 via-green-700 to-emerald-600 rounded-3xl p-5 mb-6 shadow-xl">
          {/* Decorative background circles */}
          <div className="absolute -top-8 -start-8 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute -bottom-10 -end-6 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
          <div className="absolute top-3 end-3 text-6xl opacity-20 pointer-events-none select-none">
            🏆
          </div>

          <div className="relative">
            <div className="flex items-start gap-3 mb-4">
              <div>
                <h1 className="text-2xl font-extrabold text-white leading-tight">
                  מונדיאל 2026 ⚽
                </h1>
                <p className="text-green-200 text-sm mt-0.5">
                  נחש תוצאות, צבור נקודות, עלה לראש הטבלה
                </p>
              </div>
            </div>

            <div className="flex gap-2.5">
              <StatBox value={stats.totalUsers} label="משתתפים" icon="👥" />
              <StatBox value={stats.totalBets} label="ניחושים" icon="🎯" />
              <StatBox
                value={user && profile ? profile.total_points : '—'}
                label="הנקודות שלי"
                icon="⭐"
                highlight={!!user}
              />
            </div>
          </div>
        </div>

        {/* ── Guest CTA ─────────────────────────────────── */}
        {!user && (
          <div className="flex items-center justify-between gap-4 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3.5 mb-6 shadow-sm">
            <div>
              <p className="text-amber-900 font-semibold text-sm">הצטרף בחינם 🎉</p>
              <p className="text-amber-700 text-xs mt-0.5">
                הירשם ותתחיל לנחש תוצאות מונדיאל
              </p>
            </div>
            <Link
              to="/auth"
              className="shrink-0 bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-green-700 active:scale-95 transition-all shadow"
            >
              הרשמה
            </Link>
          </div>
        )}

        {/* ── Upcoming matches ──────────────────────────── */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-slate-800">משחקים קרובים</h2>
          <Link
            to="/matches"
            className="text-sm text-emerald-600 font-semibold hover:text-emerald-700 flex items-center gap-1"
          >
            כל המשחקים
            <span className="text-base">←</span>
          </Link>
        </div>

        {loading ? (
          <Spinner />
        ) : upcomingMatches.length === 0 ? (
          <div className="text-center py-14 text-slate-400">
            <div className="text-5xl mb-3">📅</div>
            <p className="font-medium">אין משחקים קרובים</p>
            <Link to="/matches" className="text-emerald-600 text-sm mt-2 block hover:underline">
              צפה בכל המשחקים
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {upcomingMatches.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                userBet={userBets[match.id]}
                onBetPlaced={fetchData}
              />
            ))}
          </div>
        )}
      </main>
    </>
  )
}
