const MEDALS = ['🥇', '🥈', '🥉']

function Avatar({ name }) {
  const letter = name?.charAt(0)?.toUpperCase() ?? '?'
  // Cycle through a few accent colours based on the first char code
  const hues = ['bg-emerald-100 text-emerald-700', 'bg-sky-100 text-sky-700',
                 'bg-violet-100 text-violet-700', 'bg-amber-100 text-amber-700',
                 'bg-rose-100 text-rose-700']
  const cls = hues[(name?.charCodeAt(0) ?? 0) % hues.length]
  return (
    <div className={`w-9 h-9 rounded-full ${cls} flex items-center justify-center font-extrabold text-sm flex-shrink-0 shadow-sm`}>
      {letter}
    </div>
  )
}

function PointsBar({ points, max }) {
  if (max === 0) return null
  const pct = Math.round((points / max) * 100)
  return (
    <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden hidden sm:block">
      <div
        className="h-full bg-gradient-to-r from-emerald-400 to-green-500 rounded-full transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export default function LeaderboardTable({ users, currentUserId }) {
  if (!users || users.length === 0) {
    return (
      <div className="text-center py-16 text-slate-400">
        <div className="text-5xl mb-3">🏆</div>
        <p className="text-sm font-medium">עדיין אין משתתפים בדירוג</p>
        <p className="text-xs mt-1 text-slate-300">היה הראשון לנחש!</p>
      </div>
    )
  }

  const maxPoints = users[0]?.total_points ?? 0

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Table header */}
      <div className="flex items-center px-4 py-2.5 bg-slate-50 border-b border-slate-100">
        <span className="w-10 text-xs font-semibold text-slate-400 text-center">#</span>
        <span className="flex-1 text-xs font-semibold text-slate-400 mr-3">שחקן</span>
        <span className="text-xs font-semibold text-slate-400 text-center w-16">נקודות</span>
      </div>

      {/* Rows */}
      <ul className="divide-y divide-slate-100">
        {users.map((u, i) => {
          const rank = i + 1
          const isMe = u.id === currentUserId
          const isTop = rank <= 3

          return (
            <li
              key={u.id}
              className={`flex items-center px-4 py-3 transition-colors ${
                isMe
                  ? 'bg-emerald-50 hover:bg-emerald-50/80'
                  : isTop
                  ? 'hover:bg-slate-50/80'
                  : 'hover:bg-slate-50/50'
              }`}
            >
              {/* Rank */}
              <div className="w-10 flex justify-center flex-shrink-0">
                {rank <= 3 ? (
                  <span className="text-2xl leading-none">{MEDALS[rank - 1]}</span>
                ) : (
                  <span
                    className={`text-sm font-bold tabular-nums ${
                      isMe ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  >
                    {rank}
                  </span>
                )}
              </div>

              {/* Avatar + name */}
              <div className="flex items-center gap-2.5 flex-1 min-w-0 mr-2">
                <Avatar name={u.display_name} />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span
                      className={`font-semibold text-sm truncate ${
                        isMe ? 'text-emerald-700' : 'text-slate-800'
                      }`}
                    >
                      {u.display_name}
                    </span>
                    {isMe && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-600 font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">
                        אתה
                      </span>
                    )}
                    {rank === 1 && !isMe && (
                      <span className="text-[10px] bg-amber-100 text-amber-600 font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">
                        מוביל
                      </span>
                    )}
                  </div>
                  <PointsBar points={u.total_points} max={maxPoints} />
                </div>
              </div>

              {/* Points */}
              <div className="w-16 text-center flex-shrink-0">
                <span
                  className={`text-xl font-extrabold tabular-nums ${
                    u.total_points > 0
                      ? isMe
                        ? 'text-emerald-600'
                        : 'text-slate-700'
                      : 'text-slate-300'
                  }`}
                >
                  {u.total_points}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
