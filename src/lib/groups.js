// ── World Cup 2026 group data ──────────────────────────────────────
export const GROUPS = [
  { name: 'א',  teams: ['מקסיקו', 'קוריאה הדרומית', 'דרום אפריקה', 'דנמרק'] },
  { name: 'ב',  teams: ['קנדה', 'שוויץ', 'קטר', 'איטליה'] },
  { name: 'ג',  teams: ['ברזיל', 'מרוקו', 'סקוטלנד', 'האיטי'] },
  { name: 'ד',  teams: ['ארצות הברית', 'אוסטרליה', 'פרגוואי', 'טורקיה'] },
  { name: 'ה',  teams: ['גרמניה', 'אקוודור', 'חוף השנהב', 'קוראסאו'] },
  { name: 'ו',  teams: ['הולנד', 'יפן', 'תוניסיה', 'אוקראינה'] },
  { name: 'ז',  teams: ['בלגיה', 'איראן', 'מצרים', 'ניו זילנד'] },
  { name: 'ח',  teams: ['ספרד', 'כף ורדה', 'סעודיה', 'אורוגוואי'] },
  { name: 'ט',  teams: ['צרפת', 'סנגל', 'נורווגיה', 'עיראק'] },
  { name: 'י',  teams: ["ארגנטינה", "אלג'יריה", 'אוסטריה', 'ירדן'] },
  { name: 'יא', teams: ['פורטוגל', 'אנגליה', 'אוזבקיסטן', 'כווית'] },
  { name: 'יב', teams: ['קולומביה', 'ניגריה', 'אתיופיה', 'מקסיקו'] },
]

// Predictions lock when the tournament kicks off
export const PREDICTION_DEADLINE = new Date('2026-06-11T00:00:00Z')

export function isPredictionLocked() {
  return new Date() >= PREDICTION_DEADLINE
}

// ── Stats columns config (used by both header + body) ─────────────
export const STAT_COLS = [
  { key: 'mp',  label: 'מ',  mobileHidden: true  },   // Played
  { key: 'w',   label: 'נ',  mobileHidden: false },   // Wins
  { key: 'd',   label: 'ת',  mobileHidden: false },   // Draws
  { key: 'l',   label: 'ה',  mobileHidden: false },   // Losses
  { key: 'gd',  label: 'הפ', mobileHidden: true  },   // Goal difference
  { key: 'pts', label: 'נק', mobileHidden: false },   // Points
]

// ── Live standings from finished match results ─────────────────────
export function computeStandings(groupName, teams, allMatches) {
  const stats = Object.fromEntries(
    teams.map((t) => [
      t,
      { mp: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, gd: 0, pts: 0 },
    ]),
  )

  allMatches
    .filter(
      (m) =>
        m.group_name === groupName &&
        m.status === 'finished' &&
        m.result != null,
    )
    .forEach((m) => {
      const home = stats[m.home_team]
      const away = stats[m.away_team]
      if (!home || !away) return

      home.mp++; away.mp++
      home.gf += m.home_score ?? 0
      home.ga += m.away_score ?? 0
      away.gf += m.away_score ?? 0
      away.ga += m.home_score ?? 0

      if (m.result === 'home') {
        home.w++; home.pts += 3; away.l++
      } else if (m.result === 'away') {
        away.w++; away.pts += 3; home.l++
      } else {
        home.d++; home.pts++; away.d++; away.pts++
      }

      home.gd = home.gf - home.ga
      away.gd = away.gf - away.ga
    })

  return teams
    .map((name) => ({ name, ...stats[name] }))
    .sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf)
}
