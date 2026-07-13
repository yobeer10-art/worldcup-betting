// ── Bracket feed-forward maps (shared between BracketPage and BracketExportCanvas) ──

// For each R16+ match slot, which earlier match's outcome fills home/away?
export const FEED_SOURCE = {
   89: { home: { m:  74 }, away: { m:  77 } },
   90: { home: { m:  73 }, away: { m:  76 } },
   91: { home: { m:  75 }, away: { m:  78 } },
   92: { home: { m:  79 }, away: { m:  80 } },
   93: { home: { m:  83 }, away: { m:  84 } },
   94: { home: { m:  82 }, away: { m:  81 } },
   95: { home: { m:  87 }, away: { m:  86 } },
   96: { home: { m:  85 }, away: { m:  88 } },
   97: { home: { m:  91 }, away: { m:  90 } },
   98: { home: { m:  93 }, away: { m:  94 } },
   99: { home: { m:  89 }, away: { m:  92 } },
  100: { home: { m:  95 }, away: { m:  96 } },
  101: { home: { m:  97 }, away: { m:  98 } },
  102: { home: { m:  99 }, away: { m: 100 } },
  103: { home: { m: 101, loser: true }, away: { m: 102, loser: true } },
  104: { home: { m: 101 }, away: { m: 102 } },
}

// Winner advance path (for cascade-invalidation traversal)
export const ADVANCE = {
   73: { to:  90 },  74: { to:  89 },  75: { to:  91 },  76: { to:  90 },
   77: { to:  89 },  78: { to:  91 },  79: { to:  92 },  80: { to:  92 },
   81: { to:  94 },  82: { to:  94 },  83: { to:  93 },  84: { to:  93 },
   85: { to:  96 },  86: { to:  95 },  87: { to:  95 },  88: { to:  96 },
   89: { to:  99 },  90: { to:  97 },  91: { to:  97 },  92: { to:  99 },
   93: { to:  98 },  94: { to:  98 },  95: { to: 100 },  96: { to: 100 },
   97: { to: 101 },  98: { to: 101 },  99: { to: 102 }, 100: { to: 102 },
  101: { to: 104 }, 102: { to: 104 },
}

// SF losers feed third-place match
export const LOSER_TO = { 101: 103, 102: 103 }

// All downstream match numbers reachable from matchNum (winner + loser paths)
export function getDownstreamOf(mn) {
  const seen  = new Set()
  const queue = [mn]
  while (queue.length) {
    const cur = queue.shift()
    if (ADVANCE[cur] && !seen.has(ADVANCE[cur].to)) {
      seen.add(ADVANCE[cur].to)
      queue.push(ADVANCE[cur].to)
    }
    if (LOSER_TO[cur] && !seen.has(LOSER_TO[cur])) {
      seen.add(LOSER_TO[cur])
    }
  }
  return [...seen]
}

// Pure: resolve the effective team for one slot given current predByNum.
// Returns { team: string, predicted: boolean } or null.
// predicted=true → team comes from user's upstream pick, not confirmed DB data.
export function getEff(mn, slot, matchByNum, predByNum) {
  const match = matchByNum[mn]
  if (!match) return null

  const real = slot === 'home' ? match.home_team : match.away_team
  if (real) return { team: real, predicted: false }

  const src = FEED_SOURCE[mn]?.[slot]
  if (!src) return null

  const feedMatch = matchByNum[src.m]
  if (!feedMatch) return null

  if (src.loser) {
    if (feedMatch.status === 'finished' && feedMatch.result) {
      const lt = feedMatch.result === 'home' ? feedMatch.away_team : feedMatch.home_team
      return lt ? { team: lt, predicted: false } : null
    }
    const pick = predByNum[src.m]
    if (pick) {
      const h = getEff(src.m, 'home', matchByNum, predByNum)
      const a = getEff(src.m, 'away', matchByNum, predByNum)
      if (h && a) {
        const loser = pick === h.team ? a.team : h.team
        return { team: loser, predicted: true }
      }
    }
    return null
  } else {
    if (feedMatch.status === 'finished' && feedMatch.result) {
      const wt = feedMatch.result === 'home' ? feedMatch.home_team : feedMatch.away_team
      return wt ? { team: wt, predicted: false } : null
    }
    const pick = predByNum[src.m]
    return pick ? { team: pick, predicted: true } : null
  }
}
