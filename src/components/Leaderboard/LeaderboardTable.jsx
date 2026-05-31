const MEDALS = ['🥇', '🥈', '🥉']

function Avatar({ name }) {
  const letter = name?.charAt(0)?.toUpperCase() ?? '?'
  return (
    <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-sm flex-shrink-0">
      {letter}
    </div>
  )
}

export default function LeaderboardTable({ users, currentUserId }) {
  if (!users || users.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <div className="text-5xl mb-3">🏆</div>
        <p className="text-sm">עדיין אין משתתפים בדירוג</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200 text-right">
            <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase w-12">#</th>
            <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">שחקן</th>
            <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase text-center w-24">
              נקודות
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {users.map((u, i) => {
            const rank = i + 1
            const isMe = u.id === currentUserId
            return (
              <tr
                key={u.id}
                className={`transition-colors ${isMe ? 'bg-green-50' : 'hover:bg-gray-50'}`}
              >
                <td className="px-4 py-3 text-center">
                  {rank <= 3 ? (
                    <span className="text-xl">{MEDALS[rank - 1]}</span>
                  ) : (
                    <span className="text-sm font-medium text-gray-400">{rank}</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={u.display_name} />
                    <div className="min-w-0">
                      <span className="font-semibold text-gray-800 block truncate">
                        {u.display_name}
                      </span>
                      {isMe && (
                        <span className="text-xs text-green-600 font-medium">אתה</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`text-xl font-extrabold tabular-nums ${
                      u.total_points > 0 ? 'text-green-600' : 'text-gray-300'
                    }`}
                  >
                    {u.total_points}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
