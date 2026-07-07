// ================================================================
// Supabase Edge Function: sync-knockout  (v3)
//
// Syncs WC 2026 knockout-stage data from football-data.org:
//   • R32 teams/dates: matched by OFFICIAL SCHEDULE (kickoff time → M-number).
//     Each R32 match has a unique UTC kickoff; no positional guessing needed.
//   • R16+ teams: populated by auto-advance once R32 results are graded.
//   • Results: sets result, grades knockout_predictions, advances winner.
//
// Matching strategy per API match:
//   1. Primary — Hebrew team names match an existing DB row (works once DB
//      has teams from a prior run or real results).
//   2. R32 schedule — look up utcDate (±20 min) in the hardcoded R32_SCHEDULE
//      table to get the official match number, then find the DB row directly.
//   3. Secondary — date ±3h within the same round (fallback for R16+).
//
// Deploy:  supabase functions deploy sync-knockout
// ================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Team name map (English API → Hebrew) ─────────────────────────
const TEAM_MAP: Record<string, string> = {
  'Mexico': 'מקסיקו', 'Canada': 'קנדה',
  'United States': 'ארצות הברית', 'USA': 'ארצות הברית',
  'United States of America': 'ארצות הברית',
  'Panama': 'פנמה', 'Haiti': 'האיטי', "Jamaica": "ג'מייקה",
  'Honduras': 'הונדורס', 'Costa Rica': 'קוסטה ריקה',
  'Curaçao': 'קוראסאו', 'Curacao': 'קוראסאו',
  'Brazil': 'ברזיל', 'Argentina': 'ארגנטינה',
  'Uruguay': 'אורוגוואי', 'Colombia': 'קולומביה',
  'Ecuador': 'אקוודור', 'Paraguay': 'פרגוואי',
  'Bolivia': 'בוליביה', 'Peru': 'פרו', "Chile": "צ'ילה",
  'Venezuela': 'ונצואלה',
  'Germany': 'גרמניה', 'France': 'צרפת', 'Spain': 'ספרד',
  'England': 'אנגליה', 'Portugal': 'פורטוגל',
  'Netherlands': 'הולנד', 'Belgium': 'בלגיה',
  'Switzerland': 'שוויץ', 'Croatia': 'קרואטיה',
  'Austria': 'אוסטריה', "Czechia": "צ'כיה",
  "Czech Republic": "צ'כיה", 'Scotland': 'סקוטלנד',
  'Wales': 'ויילס', 'Ireland': 'אירלנד',
  'Republic of Ireland': 'אירלנד', 'Turkey': 'טורקיה',
  'Türkiye': 'טורקיה', 'Norway': 'נורווגיה',
  'Sweden': 'שוודיה', 'Denmark': 'דנמרק',
  'Poland': 'פולין', 'Serbia': 'סרביה',
  'Slovenia': 'סלובניה', 'Slovakia': 'סלובקיה',
  'Hungary': 'הונגריה', 'Romania': 'רומניה',
  'Greece': 'יוון', 'Ukraine': 'אוקראינה',
  "Georgia": "ג'ורג'יה", 'Bosnia and Herzegovina': 'בוסניה והרצגובינה',
  'Bosnia & Herzegovina': 'בוסניה והרצגובינה',
  'Bosnia-Herzegovina': 'בוסניה והרצגובינה',
  'Italy': 'איטליה', 'Israel': 'ישראל',
  'Morocco': 'מרוקו', 'Senegal': 'סנגל',
  'Nigeria': 'ניגריה', 'Cameroon': 'קמרון',
  'Ghana': 'גאנה', 'Egypt': 'מצרים',
  'Tunisia': 'תוניסיה', "Algeria": "אלג'יריה",
  'Mali': 'מאלי', 'South Africa': 'דרום אפריקה',
  "Côte d'Ivoire": 'חוף השנהב', "Cote d'Ivoire": 'חוף השנהב',
  'Ivory Coast': 'חוף השנהב',
  'DR Congo': 'קונגו הדמוקרטית', 'Congo DR': 'קונגו הדמוקרטית',
  'Democratic Republic of Congo': 'קונגו הדמוקרטית',
  'Democratic Republic of the Congo': 'קונגו הדמוקרטית',
  'Cape Verde': 'כף ורדה', 'Cabo Verde': 'כף ורדה', 'Cape Verde Islands': 'כף ורדה',
  'Ethiopia': 'אתיופיה',
  'Japan': 'יפן', 'South Korea': 'קוריאה הדרומית',
  'Korea Republic': 'קוריאה הדרומית',
  'Republic of Korea': 'קוריאה הדרומית',
  'Australia': 'אוסטרליה', 'Saudi Arabia': 'סעודיה',
  'KSA': 'סעודיה', 'Iran': 'איראן', 'IR Iran': 'איראן',
  'Qatar': 'קטר', 'Iraq': 'עיראק', 'Jordan': 'ירדן',
  'Uzbekistan': 'אוזבקיסטן', 'Kuwait': 'כווית',
  'New Zealand': 'ניו זילנד',
}

function mapTeam(name: string): string | null {
  if (!name || name.trim() === '' || name === 'TBD') return null
  return TEAM_MAP[name.trim()] ?? null
}

// ── Official R32 schedule: kickoff UTC (ms) → match number ───────
// FIFA WC 2026: group stage = matches 1-72, R32 = matches 73-88
// Each kickoff time is unique, so this table is unambiguous.
const R32_SCHEDULE: { ms: number; matchNum: number }[] = [
  { ms: Date.UTC(2026, 5, 28, 19,  0), matchNum: 73 }, // Jun28 19:00Z  SA vs Canada
  { ms: Date.UTC(2026, 5, 29, 17,  0), matchNum: 74 }, // Jun29 17:00Z  Brazil vs Japan
  { ms: Date.UTC(2026, 5, 29, 20, 30), matchNum: 75 }, // Jun29 20:30Z  Germany vs Paraguay
  { ms: Date.UTC(2026, 5, 30,  1,  0), matchNum: 76 }, // Jun30 01:00Z  Netherlands vs Morocco
  { ms: Date.UTC(2026, 5, 30, 17,  0), matchNum: 77 }, // Jun30 17:00Z  Ivory Coast vs Norway
  { ms: Date.UTC(2026, 5, 30, 21,  0), matchNum: 78 }, // Jun30 21:00Z  France vs Sweden
  { ms: Date.UTC(2026, 6,  1,  1,  0), matchNum: 79 }, // Jul1  01:00Z  Mexico vs Ecuador
  { ms: Date.UTC(2026, 6,  1, 16,  0), matchNum: 80 }, // Jul1  16:00Z  England vs Congo DR
  { ms: Date.UTC(2026, 6,  1, 20,  0), matchNum: 81 }, // Jul1  20:00Z  Belgium vs Senegal
  { ms: Date.UTC(2026, 6,  2,  0,  0), matchNum: 82 }, // Jul2  00:00Z  USA vs Bosnia
  { ms: Date.UTC(2026, 6,  2, 19,  0), matchNum: 83 }, // Jul2  19:00Z  Spain vs Austria
  { ms: Date.UTC(2026, 6,  2, 23,  0), matchNum: 84 }, // Jul2  23:00Z  Portugal vs Croatia
  { ms: Date.UTC(2026, 6,  3,  3,  0), matchNum: 85 }, // Jul3  03:00Z  Switzerland vs Algeria
  { ms: Date.UTC(2026, 6,  3, 18,  0), matchNum: 86 }, // Jul3  18:00Z  Australia vs Egypt
  { ms: Date.UTC(2026, 6,  3, 22,  0), matchNum: 87 }, // Jul3  22:00Z  Argentina vs Cape Verde
  { ms: Date.UTC(2026, 6,  4,  1, 30), matchNum: 88 }, // Jul4  01:30Z  Colombia vs Ghana
]
const R32_TOLERANCE_MS = 20 * 60_000 // ±20 min — all kickoffs are ≥30 min apart

function r32MatchNum(utcDate: string): number | null {
  const t = new Date(utcDate).getTime()
  if (isNaN(t)) return null
  const found = R32_SCHEDULE.find(s => Math.abs(s.ms - t) < R32_TOLERANCE_MS)
  return found?.matchNum ?? null
}

// ── Winner advance map ────────────────────────────────────────────
const ADVANCE: Record<number, { toMatch: number; slot: 'home' | 'away' }> = {
   73: { toMatch:  90, slot: 'home' }, 74: { toMatch:  89, slot: 'home' },
   75: { toMatch:  91, slot: 'home' }, 76: { toMatch:  90, slot: 'away' },
   77: { toMatch:  89, slot: 'away' }, 78: { toMatch:  91, slot: 'away' },
   79: { toMatch:  92, slot: 'home' }, 80: { toMatch:  92, slot: 'away' },
   81: { toMatch:  94, slot: 'away' }, 82: { toMatch:  94, slot: 'home' },
   83: { toMatch:  93, slot: 'home' }, 84: { toMatch:  93, slot: 'away' },
   85: { toMatch:  96, slot: 'home' }, 86: { toMatch:  95, slot: 'away' },
   87: { toMatch:  95, slot: 'home' }, 88: { toMatch:  96, slot: 'away' },
   89: { toMatch:  97, slot: 'home' }, 90: { toMatch:  97, slot: 'away' },
   91: { toMatch:  99, slot: 'home' }, 92: { toMatch:  99, slot: 'away' },
   93: { toMatch:  98, slot: 'home' }, 94: { toMatch:  98, slot: 'away' },
   95: { toMatch: 100, slot: 'home' }, 96: { toMatch: 100, slot: 'away' },
   97: { toMatch: 101, slot: 'home' }, 98: { toMatch: 101, slot: 'away' },
   99: { toMatch: 102, slot: 'home' },100: { toMatch: 102, slot: 'away' },
  101: { toMatch: 104, slot: 'home' },102: { toMatch: 104, slot: 'away' },
}

// Points per round
const ROUND_PTS: Record<string, number> = {
  round_of_32: 2, round_of_16: 3, quarter: 5,
  semi: 8, third_place: 3, final: 12,
}

// API stage → DB round
const STAGE_MAP: Record<string, string> = {
  'LAST_32':        'round_of_32',
  'LAST_16':        'round_of_16',
  'QUARTER_FINALS': 'quarter',
  'SEMI_FINALS':    'semi',
  'THIRD_PLACE':    'third_place',
  'FINAL':          'final',
}

interface ApiMatch {
  id:        number
  utcDate:   string
  status:    string
  stage:     string
  homeTeam:  { id?: number; name: string }
  awayTeam:  { id?: number; name: string }
  score: {
    winner:      'HOME_TEAM' | 'AWAY_TEAM' | null
    duration:    'REGULAR' | 'EXTRA_TIME' | 'PENALTY_SHOOTOUT' | null
    fullTime:    { home: number | null; away: number | null }
    regularTime: { home: number | null; away: number | null } | null
  }
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const apiKey = Deno.env.get('FOOTBALL_DATA_API_KEY')
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'FOOTBALL_DATA_API_KEY not set' }), { status: 500 })
  }

  const log: string[] = []
  let teamsUpdated = 0, resultsSet = 0, errors = 0

  try {
    // ── Fetch from football-data.org ──────────────────────────────
    const apiRes = await fetch(
      'https://api.football-data.org/v4/competitions/WC/matches',
      { headers: { 'X-Auth-Token': apiKey } },
    )
    if (!apiRes.ok) throw new Error(`API ${apiRes.status}: ${apiRes.statusText}`)

    const { matches: allMatches }: { matches: ApiMatch[] } = await apiRes.json()
    const koMatches = allMatches.filter(m => STAGE_MAP[m.stage])
    log.push(`API: ${allMatches.length} total, ${koMatches.length} knockout`)

    // Dump all R32 matches for verification
    const r32Api = koMatches
      .filter(m => STAGE_MAP[m.stage] === 'round_of_32')
      .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime())
    log.push(`  [R32 from API: ${r32Api.length} matches]`)
    for (const m of r32Api) {
      const mn = r32MatchNum(m.utcDate)
      log.push(
        `    M${mn ?? '??'} | ${m.utcDate} | ` +
        `"${m.homeTeam.name}" vs "${m.awayTeam.name}" | ${m.status}`
      )
    }

    // ── Load all DB knockout rows (keyed by match_number) ─────────
    const { data: dbRows } = await supabase
      .from('knockout_bracket_matches')
      .select('*')
      .order('match_number')

    const dbByNum: Record<number, Record<string, unknown>> = {}
    for (const row of dbRows ?? []) {
      if (row.match_number) dbByNum[row.match_number] = row
    }

    // ── Process each API knockout match ───────────────────────────
    for (const m of koMatches) {
      const homeHe = mapTeam(m.homeTeam.name)
      const awayHe = mapTeam(m.awayTeam.name)
      const dbRound = STAGE_MAP[m.stage]

      // ── Find the matching DB row ──────────────────────────────
      let dbRow: Record<string, unknown> | null = null

      // Strategy 1: Primary — match by Hebrew team names in DB
      if (homeHe && awayHe) {
        for (const row of Object.values(dbByNum)) {
          if (!row.home_team || !row.away_team) continue
          if (
            (row.home_team === homeHe && row.away_team === awayHe) ||
            (row.home_team === awayHe && row.away_team === homeHe)
          ) {
            dbRow = row
            break
          }
        }
      }

      // Strategy 2: R32 schedule lookup — finds the correct row even when
      // DB teams are not yet set, using the official kickoff time table.
      if (!dbRow && dbRound === 'round_of_32') {
        const mn = r32MatchNum(m.utcDate)
        if (mn && dbByNum[mn]) {
          dbRow = dbByNum[mn]
          log.push(`  [SCHED] M${mn} ← "${m.homeTeam.name}" vs "${m.awayTeam.name}" (${m.utcDate})`)
        } else if (!mn) {
          log.push(`  [WARN] R32 match with unknown kickoff time: ${m.utcDate} ("${m.homeTeam.name}" vs "${m.awayTeam.name}")`)
        }
      }

      // Strategy 3: Secondary — date ±3h within same round (fallback for R16+)
      if (!dbRow && m.utcDate) {
        const apiTime = new Date(m.utcDate).getTime()
        for (const row of Object.values(dbByNum)) {
          if (row.round !== dbRound || !row.match_date) continue
          const diff = Math.abs(new Date(row.match_date as string).getTime() - apiTime)
          if (diff < 3 * 3_600_000) { dbRow = row; break }
        }
      }

      if (!dbRow) {
        if (homeHe || awayHe) {
          log.push(`  NO_DB_MATCH: "${m.homeTeam.name}" vs "${m.awayTeam.name}" (${dbRound} ${m.utcDate})`)
        }
        continue
      }

      const dbId = dbRow.id as string
      const mn   = dbRow.match_number as number

      // ── Populate teams if not yet set ────────────────────────
      if (homeHe && awayHe && (!dbRow.home_team || !dbRow.away_team)) {
        const { error } = await supabase
          .from('knockout_bracket_matches')
          .update({ home_team: homeHe, away_team: awayHe, status: 'upcoming' })
          .eq('id', dbId)
        if (error) {
          errors++
          log.push(`  ERR teams M${mn}: ${error.message}`)
        } else {
          dbRow.home_team = homeHe
          dbRow.away_team = awayHe
          dbRow.status    = 'upcoming'
          log.push(`  TEAMS M${mn}: ${homeHe} vs ${awayHe}`)
          teamsUpdated++
        }
      }

      // ── Seed match_date if missing ────────────────────────────
      if (m.utcDate && !dbRow.match_date) {
        await supabase
          .from('knockout_bracket_matches')
          .update({ match_date: m.utcDate })
          .eq('id', dbId)
        dbRow.match_date = m.utcDate
      }

      // ── Grade finished matches (idempotent: always re-grade) ─────
      if (m.status === 'FINISHED') {
        const apiWinner = m.score.winner
        if (!apiWinner) continue

        const result: 'home' | 'away' = apiWinner === 'HOME_TEAM' ? 'home' : 'away'
        // For pen-shootout matches, fullTime holds pen totals; use regularTime for 90-min display
        const isPen = m.score.duration === 'PENALTY_SHOOTOUT'
        const scoreSource = (isPen && m.score.regularTime) ? m.score.regularTime : m.score.fullTime
        const homeScore = scoreSource.home
        const awayScore = scoreSource.away

        const winnerTeam = result === 'home'
          ? (dbRow.home_team as string)
          : (dbRow.away_team as string)
        const loserTeam = result === 'home'
          ? (dbRow.away_team as string)
          : (dbRow.home_team as string)

        if (!winnerTeam) {
          log.push(`  SKIP M${mn}: finished but winner team not set in DB`)
          continue
        }

        await supabase
          .from('knockout_bracket_matches')
          .update({ result, status: 'finished', home_score: homeScore, away_score: awayScore })
          .eq('id', dbId)

        // Grade predictions
        const pts = ROUND_PTS[dbRow.round as string] ?? 2
        await supabase.from('knockout_predictions')
          .update({ is_graded: true, points_earned: 0 })
          .eq('bracket_match_id', dbId)
          .neq('predicted_winner', winnerTeam)
        await supabase.from('knockout_predictions')
          .update({ is_graded: true, points_earned: pts })
          .eq('bracket_match_id', dbId)
          .eq('predicted_winner', winnerTeam)

        // Auto-advance winner to next round
        const adv = ADVANCE[mn]
        if (adv && winnerTeam) {
          const { data: nextMatch } = await supabase
            .from('knockout_bracket_matches')
            .select('id, home_team, away_team, status')
            .eq('match_number', adv.toMatch)
            .maybeSingle()
          if (nextMatch) {
            const patch: Record<string, unknown> = {}
            if (adv.slot === 'home') {
              patch.home_team = winnerTeam
              patch.home_source = `מנצחת משחק ${mn}`
              if (nextMatch.away_team) patch.status = 'upcoming'
            } else {
              patch.away_team = winnerTeam
              patch.away_source = `מנצחת משחק ${mn}`
              if (nextMatch.home_team) patch.status = 'upcoming'
            }
            await supabase.from('knockout_bracket_matches').update(patch).eq('id', nextMatch.id)
            log.push(`  ADVANCE M${mn}→M${adv.toMatch}(${adv.slot}): ${winnerTeam}`)
          }
        }

        // SF losers → M103 third-place
        if ((mn === 101 || mn === 102) && loserTeam) {
          const { data: tp } = await supabase
            .from('knockout_bracket_matches')
            .select('id, home_team, away_team')
            .eq('match_number', 103)
            .maybeSingle()
          if (tp) {
            const tpPatch: Record<string, unknown> = {}
            if (mn === 101) {
              tpPatch.home_team = loserTeam
              if (tp.away_team) tpPatch.status = 'upcoming'
            } else {
              tpPatch.away_team = loserTeam
              if (tp.home_team) tpPatch.status = 'upcoming'
            }
            await supabase.from('knockout_bracket_matches').update(tpPatch).eq('id', tp.id)
            log.push(`  LOSER M${mn}→M103: ${loserTeam}`)
          }
        }

        log.push(`  RESULT M${mn}: ${winnerTeam} wins (${homeScore}–${awayScore})`)
        resultsSet++
      }
    }

    // ── Self-heal: grade any picks on DB-finished matches that slipped through ──
    const { data: finishedBracket } = await supabase
      .from('knockout_bracket_matches')
      .select('id, match_number, round, home_team, away_team, result')
      .eq('status', 'finished')
      .not('result', 'is', null)
    let healed = 0
    for (const fm of finishedBracket ?? []) {
      const winner = fm.result === 'home' ? fm.home_team : fm.away_team
      if (!winner) continue
      const pts = ROUND_PTS[fm.round as string] ?? 2
      const { count: c1 } = await supabase.from('knockout_predictions')
        .update({ is_graded: true, points_earned: 0 }, { count: 'exact' })
        .eq('bracket_match_id', fm.id).eq('is_graded', false).neq('predicted_winner', winner)
      const { count: c2 } = await supabase.from('knockout_predictions')
        .update({ is_graded: true, points_earned: pts }, { count: 'exact' })
        .eq('bracket_match_id', fm.id).eq('is_graded', false).eq('predicted_winner', winner)
      healed += (c1 ?? 0) + (c2 ?? 0)
    }
    if (healed > 0) log.push(`  Self-healed ${healed} ungraded picks`)

    // Always recalculate (idempotent; fixes any stale totals)
    await supabase.rpc('recalculate_all_user_points')
    log.push('Recalculated total_points for all users')

    log.push(`Done: teams=${teamsUpdated} results=${resultsSet} errors=${errors}`)

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.push(`FATAL: ${msg}`)
    return new Response(
      JSON.stringify({ success: false, error: msg, log }, null, 2),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  return new Response(
    JSON.stringify({ success: true, teamsUpdated, resultsSet, errors, log }, null, 2),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
