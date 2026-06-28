// ================================================================
// Supabase Edge Function: sync-knockout  (v2)
// Syncs WC 2026 knockout-stage match data from football-data.org:
//   • Populates R32 home_team / away_team as FIFA confirms them
//   • Updates match_date for all knockout matches
//   • For FINISHED knockout matches: sets result, grades predictions,
//     and auto-advances winner to the correct next-round slot
//
// Matching strategy (in order):
//   1. By Hebrew team names (when DB rows already have teams)
//   2. By date ±3h within same round (when DB rows have match_date)
//   3. By date-sorted position within round (initial seeding – no DB dates yet)
//      Sorts API matches and DB rows for the same round both by date,
//      then pairs them 1-to-1 so we assign dates + teams in schedule order.
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
  'Cape Verde': 'כף ורדה', 'Cabo Verde': 'כף ורדה',
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

// ── Winner-advance map ────────────────────────────────────────────
const ADVANCE: Record<number, { toMatch: number; slot: 'home' | 'away' }> = {
   73: { toMatch:  90, slot: 'home' }, 74: { toMatch:  89, slot: 'home' },
   75: { toMatch:  90, slot: 'away' }, 76: { toMatch:  91, slot: 'home' },
   77: { toMatch:  89, slot: 'away' }, 78: { toMatch:  91, slot: 'away' },
   79: { toMatch:  92, slot: 'home' }, 80: { toMatch:  92, slot: 'away' },
   81: { toMatch:  94, slot: 'home' }, 82: { toMatch:  94, slot: 'away' },
   83: { toMatch:  93, slot: 'home' }, 84: { toMatch:  93, slot: 'away' },
   85: { toMatch:  96, slot: 'home' }, 86: { toMatch:  95, slot: 'home' },
   87: { toMatch:  96, slot: 'away' }, 88: { toMatch:  95, slot: 'away' },
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
  homeTeam:  { id?: number; name: string; shortName?: string }
  awayTeam:  { id?: number; name: string; shortName?: string }
  score: {
    winner:   'HOME_TEAM' | 'AWAY_TEAM' | null
    fullTime: { home: number | null; away: number | null }
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
    const apiRes = await fetch(
      'https://api.football-data.org/v4/competitions/WC/matches',
      { headers: { 'X-Auth-Token': apiKey } },
    )
    if (!apiRes.ok) throw new Error(`API ${apiRes.status}: ${apiRes.statusText}`)

    const { matches: allMatches }: { matches: ApiMatch[] } = await apiRes.json()
    const koMatches = allMatches.filter(m => STAGE_MAP[m.stage])
    log.push(`API: ${allMatches.length} total, ${koMatches.length} knockout`)

    // ── Dump ALL R32 matches from API ────────────────────────────
    const r32Api = koMatches.filter(m => STAGE_MAP[m.stage] === 'round_of_32')
    log.push(`  [R32 API] ${r32Api.length} matches:`)
    for (const m of r32Api.sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime())) {
      log.push(
        `    id=${m.id} | ${m.utcDate} | ` +
        `"${m.homeTeam.name}" vs "${m.awayTeam.name}" | ${m.status}`
      )
    }

    // Load all DB knockout rows
    const { data: dbRows } = await supabase
      .from('knockout_bracket_matches')
      .select('*')
      .order('match_number')

    const dbByNum: Record<number, Record<string, unknown>> = {}
    for (const row of dbRows ?? []) {
      if (row.match_number) dbByNum[row.match_number] = row
    }

    // ── Strategy 3: date-sorted bulk assignment per round ─────────
    // For each round, gather API matches AND DB rows that still have no teams.
    // Sort both by date. Pair them 1-to-1 to seed dates and teams together.
    // Only runs for rounds where at least one DB row still has no home_team.
    const roundsNeedingSeeding = new Set<string>()
    for (const row of Object.values(dbByNum)) {
      if (!row.home_team) roundsNeedingSeeding.add(row.round as string)
    }

    if (roundsNeedingSeeding.size > 0) {
      // Group API matches by round
      const apiByRound: Record<string, ApiMatch[]> = {}
      for (const m of koMatches) {
        const dbRound = STAGE_MAP[m.stage]
        if (!apiByRound[dbRound]) apiByRound[dbRound] = []
        apiByRound[dbRound].push(m)
      }

      for (const dbRound of roundsNeedingSeeding) {
        const apiForRound = (apiByRound[dbRound] ?? [])
          .filter(m => {
            // Only consider API matches that have at least a real date and real teams OR just a date
            return m.utcDate && m.utcDate !== ''
          })
          .sort((a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime())

        const dbForRound = Object.values(dbByNum)
          .filter(r => r.round === dbRound && !r.home_team)
          .sort((a, b) => (a.position as number) - (b.position as number))

        log.push(
          `  [SEED] round=${dbRound}: ${apiForRound.length} API matches, ` +
          `${dbForRound.length} DB rows need seeding`
        )

        // Check if any API match in this round has real team names
        const anyTeamsKnown = apiForRound.some(m => mapTeam(m.homeTeam.name) && mapTeam(m.awayTeam.name))
        if (!anyTeamsKnown) {
          // Only dates available (teams TBD) — just seed dates/positions by order
          const limit = Math.min(apiForRound.length, dbForRound.length)
          for (let i = 0; i < limit; i++) {
            const apiM  = apiForRound[i]
            const dbRow = dbForRound[i]
            if (dbRow.match_date) continue // already has a date
            const { error } = await supabase
              .from('knockout_bracket_matches')
              .update({ match_date: apiM.utcDate })
              .eq('id', dbRow.id as string)
            if (error) { errors++; log.push(`  ERR seed date M${dbRow.match_number}: ${error.message}`) }
            else {
              dbRow.match_date = apiM.utcDate // update local cache
              log.push(`  DATE M${dbRow.match_number}: ${apiM.utcDate} (teams TBD: "${apiM.homeTeam.name}" vs "${apiM.awayTeam.name}")`)
              teamsUpdated++ // count date seedings
            }
          }
          continue
        }

        // Teams ARE known in API for this round — pair NEW (unplaced) matches only.
        // Build a set of team-pairs already present in the DB for this round,
        // so we never re-seed a match that's already correctly placed.
        const alreadyPlaced = new Set<string>()
        for (const row of Object.values(dbByNum)) {
          if (row.round !== dbRound || !row.home_team || !row.away_team) continue
          alreadyPlaced.add(`${row.home_team}|${row.away_team}`)
          alreadyPlaced.add(`${row.away_team}|${row.home_team}`)
        }

        const apiWithTeams = apiForRound.filter(m => {
          const h = mapTeam(m.homeTeam.name)
          const a = mapTeam(m.awayTeam.name)
          if (!h || !a) return false
          // Skip if this team-pair is already correctly placed in another DB row
          if (alreadyPlaced.has(`${h}|${a}`)) {
            log.push(`  [SKIP already placed] "${m.homeTeam.name}" vs "${m.awayTeam.name}"`)
            return false
          }
          return true
        })

        const dbNeedingTeams = dbForRound.filter(r => !r.home_team)

        log.push(
          `  [SEED] ${apiWithTeams.length} unplaced API matches, ` +
          `${dbNeedingTeams.length} DB rows need teams`
        )

        // Pair unplaced API matches (sorted by date) with empty DB rows (sorted by position).
        const limit = Math.min(apiWithTeams.length, dbNeedingTeams.length)
        for (let i = 0; i < limit; i++) {
          const apiM   = apiWithTeams[i]
          const dbRow  = dbNeedingTeams[i]
          const homeHe = mapTeam(apiM.homeTeam.name)!
          const awayHe = mapTeam(apiM.awayTeam.name)!

          const patch: Record<string, unknown> = {
            home_team:  homeHe,
            away_team:  awayHe,
            match_date: apiM.utcDate,
            status:     'upcoming',
          }
          const { error } = await supabase
            .from('knockout_bracket_matches')
            .update(patch)
            .eq('id', dbRow.id as string)
          if (error) {
            errors++
            log.push(`  ERR seed M${dbRow.match_number}: ${error.message}`)
          } else {
            dbRow.home_team  = homeHe
            dbRow.away_team  = awayHe
            dbRow.match_date = apiM.utcDate
            dbRow.status     = 'upcoming'
            log.push(`  SEEDED M${dbRow.match_number} (pos ${dbRow.position}): ${homeHe} vs ${awayHe}`)
            teamsUpdated++
          }
        }
      }
    }

    // ── Per-match processing: update dates, handle results ────────
    for (const m of koMatches) {
      const homeRaw = m.homeTeam.name
      const awayRaw = m.awayTeam.name
      const homeHe  = mapTeam(homeRaw)
      const awayHe  = mapTeam(awayRaw)

      // Find DB row — only match on real (non-null) values
      let dbRow: Record<string, unknown> | null = null

      // Strategy 1: match by Hebrew team names (both are non-null and match DB)
      if (homeHe && awayHe) {
        for (const row of Object.values(dbByNum)) {
          if (!row.home_team || !row.away_team) continue // skip rows with no teams yet
          if (
            (row.home_team === homeHe && row.away_team === awayHe) ||
            (row.home_team === awayHe && row.away_team === homeHe)
          ) {
            dbRow = row
            break
          }
        }
      }

      // Strategy 2: by date ±3h within same round (DB already has match_date)
      if (!dbRow && m.utcDate) {
        const dbRound = STAGE_MAP[m.stage]
        const apiTime = new Date(m.utcDate).getTime()
        for (const row of Object.values(dbByNum)) {
          if (row.round !== dbRound) continue
          if (!row.match_date) continue
          const diff = Math.abs(new Date(row.match_date as string).getTime() - apiTime)
          if (diff < 3 * 3_600_000) { dbRow = row; break }
        }
      }

      if (!dbRow) {
        // Only log if teams are real (don't flood log with TBD entries)
        if (homeHe || awayHe) {
          log.push(`  NO_DB_MATCH: "${homeRaw}" vs "${awayRaw}" (${m.stage} ${m.utcDate})`)
        }
        continue
      }

      const dbId = dbRow.id as string
      const mn   = dbRow.match_number as number

      // Update date if API has it and DB doesn't
      if (m.utcDate && !dbRow.match_date) {
        await supabase
          .from('knockout_bracket_matches')
          .update({ match_date: m.utcDate })
          .eq('id', dbId)
        dbRow.match_date = m.utcDate
      }

      // ── Result grading for finished matches ────────────────────
      if (m.status === 'FINISHED' && dbRow.status !== 'finished') {
        const apiWinner = m.score.winner
        if (!apiWinner) continue

        const result: 'home' | 'away' = apiWinner === 'HOME_TEAM' ? 'home' : 'away'
        const homeScore = m.score.fullTime.home
        const awayScore = m.score.fullTime.away

        const winnerTeam = result === 'home'
          ? (dbRow.home_team as string)
          : (dbRow.away_team as string)
        const loserTeam = result === 'home'
          ? (dbRow.away_team as string)
          : (dbRow.home_team as string)

        if (!winnerTeam) {
          log.push(`  SKIP M${mn}: finished but winner team name missing in DB`)
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

        // Recalculate total_points for affected users
        const { data: affected } = await supabase
          .from('knockout_predictions')
          .select('user_id')
          .eq('bracket_match_id', dbId)
        for (const { user_id } of affected ?? []) {
          const [b, gp, kp] = await Promise.all([
            supabase.from('bets').select('points_earned').eq('user_id', user_id),
            supabase.from('group_predictions').select('points_earned').eq('user_id', user_id),
            supabase.from('knockout_predictions').select('points_earned').eq('user_id', user_id),
          ])
          const total =
            (b.data  ?? []).reduce((s, r) => s + (r.points_earned ?? 0), 0) +
            (gp.data ?? []).reduce((s, r) => s + (r.points_earned ?? 0), 0) +
            (kp.data ?? []).reduce((s, r) => s + (r.points_earned ?? 0), 0)
          await supabase.from('users').update({ total_points: total }).eq('id', user_id)
        }

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
            if (adv.slot === 'home') { patch.home_team = winnerTeam; if (nextMatch.away_team) patch.status = 'upcoming' }
            else                     { patch.away_team = winnerTeam; if (nextMatch.home_team) patch.status = 'upcoming' }
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
            if (mn === 101) { tpPatch.home_team = loserTeam; if (tp.away_team) tpPatch.status = 'upcoming' }
            else            { tpPatch.away_team = loserTeam; if (tp.home_team) tpPatch.status = 'upcoming' }
            await supabase.from('knockout_bracket_matches').update(tpPatch).eq('id', tp.id)
            log.push(`  LOSER M${mn}→M103: ${loserTeam}`)
          }
        }

        log.push(`  RESULT M${mn}: ${winnerTeam} wins (${homeScore}–${awayScore})`)
        resultsSet++
      }
    }

    log.push(`Done: teams/dates=${teamsUpdated} results=${resultsSet} errors=${errors}`)

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
