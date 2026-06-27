// ================================================================
// Supabase Edge Function: sync-knockout
// Syncs WC 2026 knockout-stage match data from football-data.org:
//   • Populates R32 home_team / away_team as FIFA confirms them
//   • Updates match_date for all knockout matches
//   • For FINISHED knockout matches: sets result, grades predictions,
//     and auto-advances winner to the correct next-round slot
//
// Deploy:
//   supabase functions deploy sync-knockout
// Trigger (e.g. daily cron, or call manually from admin panel):
//   curl -X POST https://<ref>.supabase.co/functions/v1/sync-knockout \
//     -H "Authorization: Bearer <anon_key>"
// ================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Same team map as sync-results ────────────────────────────────
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
  return TEAM_MAP[name] ?? null
}

// ── Winner-advance map (match_number → { toMatch, slot }) ────────
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

// API stage values → DB round values
const STAGE_MAP: Record<string, string> = {
  'LAST_32':       'round_of_32',
  'LAST_16':       'round_of_16',
  'QUARTER_FINALS':'quarter',
  'SEMI_FINALS':   'semi',
  'THIRD_PLACE':   'third_place',
  'FINAL':         'final',
}

interface ApiMatch {
  id:        number
  utcDate:   string
  status:    string   // 'SCHEDULED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | ...
  stage:     string
  matchday?: number
  homeTeam:  { name: string }
  awayTeam:  { name: string }
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
    // Fetch all WC 2026 matches (knockout stages only)
    const apiRes = await fetch(
      'https://api.football-data.org/v4/competitions/WC/matches',
      { headers: { 'X-Auth-Token': apiKey } },
    )
    if (!apiRes.ok) throw new Error(`API ${apiRes.status}: ${apiRes.statusText}`)

    const { matches: allMatches }: { matches: ApiMatch[] } = await apiRes.json()
    const koMatches = allMatches.filter(m => STAGE_MAP[m.stage])
    log.push(`API: ${allMatches.length} total matches, ${koMatches.length} knockout`)

    // Load all DB knockout rows (indexed by match_number)
    const { data: dbRows } = await supabase
      .from('knockout_bracket_matches')
      .select('*')
      .order('match_number')

    const dbByNum: Record<number, Record<string, unknown>> = {}
    for (const row of dbRows ?? []) {
      if (row.match_number) dbByNum[row.match_number] = row
    }

    for (const m of koMatches) {
      const homeRaw = m.homeTeam.name
      const awayRaw = m.awayTeam.name
      const homeHe  = mapTeam(homeRaw)
      const awayHe  = mapTeam(awayRaw)

      // Try to find the DB row by team names (both orders) or by date proximity
      let dbRow: Record<string, unknown> | null = null

      // Primary: match by Hebrew team names across all DB rows
      for (const row of Object.values(dbByNum)) {
        if (
          (row.home_team === homeHe && row.away_team === awayHe) ||
          (row.home_team === awayHe && row.away_team === homeHe)
        ) {
          dbRow = row
          break
        }
      }

      // Secondary: if teams not yet in DB (null), match by date ±3h within same round
      if (!dbRow && homeHe && awayHe) {
        const dbRound = STAGE_MAP[m.stage]
        const apiTime = new Date(m.utcDate).getTime()
        for (const row of Object.values(dbByNum)) {
          if (row.round !== dbRound) continue
          if (row.home_team || row.away_team) continue // already has teams
          if (!row.match_date) continue
          const diff = Math.abs(new Date(row.match_date as string).getTime() - apiTime)
          if (diff < 3 * 3_600_000) { dbRow = row; break }
        }
      }

      if (!dbRow) {
        log.push(`  NO_DB_MATCH: ${homeRaw} vs ${awayRaw} (${m.stage} ${m.utcDate})`)
        continue
      }

      const dbId = dbRow.id as string
      const mn   = dbRow.match_number as number

      // ── Populate team names + date if missing ─────────────────
      if (homeHe && awayHe) {
        const needsTeams = !dbRow.home_team || !dbRow.away_team
        const needsDate  = !dbRow.match_date

        if (needsTeams || needsDate) {
          const patch: Record<string, unknown> = {}
          if (needsTeams) {
            // Respect home/away ordering from API if DB has no teams
            if (!dbRow.home_team && !dbRow.away_team) {
              patch.home_team = homeHe
              patch.away_team = awayHe
            } else if (!dbRow.home_team) {
              patch.home_team = homeHe
            } else if (!dbRow.away_team) {
              patch.away_team = awayHe
            }
            // Status: upcoming if both teams known
            const newHome = (patch.home_team ?? dbRow.home_team) as string | null
            const newAway = (patch.away_team ?? dbRow.away_team) as string | null
            if (newHome && newAway && dbRow.status === 'pending') {
              patch.status = 'upcoming'
            }
          }
          if (needsDate) {
            patch.match_date = m.utcDate
          }
          if (Object.keys(patch).length > 0) {
            const { error } = await supabase
              .from('knockout_bracket_matches')
              .update(patch)
              .eq('id', dbId)
            if (error) { log.push(`  ERR update teams M${mn}: ${error.message}`); errors++; continue }
            log.push(`  TEAMS M${mn}: ${homeHe} vs ${awayHe}`)
            teamsUpdated++
            // Refresh local row for result processing below
            dbRow = { ...dbRow, ...patch }
          }
        }
      }

      // ── Set result for finished matches ────────────────────────
      if (m.status === 'FINISHED' && dbRow.status !== 'finished') {
        const apiWinner = m.score.winner
        if (!apiWinner || apiWinner === null) continue

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
          log.push(`  SKIP M${mn}: result known but winner team name missing`)
          continue
        }

        // Mark match finished
        await supabase
          .from('knockout_bracket_matches')
          .update({ result, status: 'finished', home_score: homeScore, away_score: awayScore })
          .eq('id', dbId)

        // Grade predictions
        const pts = ROUND_PTS[dbRow.round as string] ?? 2
        await supabase
          .from('knockout_predictions')
          .update({ is_graded: true, points_earned: 0 })
          .eq('bracket_match_id', dbId)
          .neq('predicted_winner', winnerTeam)

        await supabase
          .from('knockout_predictions')
          .update({ is_graded: true, points_earned: pts })
          .eq('bracket_match_id', dbId)
          .eq('predicted_winner', winnerTeam)

        // Recalculate total_points for affected users (using RPC)
        const { data: affectedUsers } = await supabase
          .from('knockout_predictions')
          .select('user_id')
          .eq('bracket_match_id', dbId)

        for (const { user_id } of affectedUsers ?? []) {
          const [betsRes, gpRes, kpRes] = await Promise.all([
            supabase.from('bets').select('points_earned').eq('user_id', user_id),
            supabase.from('group_predictions').select('points_earned').eq('user_id', user_id),
            supabase.from('knockout_predictions').select('points_earned').eq('user_id', user_id),
          ])
          const total =
            (betsRes.data ?? []).reduce((s, r) => s + (r.points_earned ?? 0), 0) +
            (gpRes.data  ?? []).reduce((s, r) => s + (r.points_earned ?? 0), 0) +
            (kpRes.data  ?? []).reduce((s, r) => s + (r.points_earned ?? 0), 0)
          await supabase.from('users').update({ total_points: total }).eq('id', user_id)
        }

        // Auto-advance winner to next match slot
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
              if (nextMatch.away_team) patch.status = 'upcoming'
            } else {
              patch.away_team = winnerTeam
              if (nextMatch.home_team) patch.status = 'upcoming'
            }
            await supabase.from('knockout_bracket_matches').update(patch).eq('id', nextMatch.id)
            log.push(`  ADVANCE M${mn}→M${adv.toMatch}(${adv.slot}): ${winnerTeam}`)
          }
        }

        // SF losers → M103 third-place
        if ((mn === 101 || mn === 102) && loserTeam) {
          const { data: tpMatch } = await supabase
            .from('knockout_bracket_matches')
            .select('id, home_team, away_team')
            .eq('match_number', 103)
            .maybeSingle()

          if (tpMatch) {
            const tpPatch: Record<string, unknown> = {}
            if (mn === 101) {
              tpPatch.home_team = loserTeam
              if (tpMatch.away_team) tpPatch.status = 'upcoming'
            } else {
              tpPatch.away_team = loserTeam
              if (tpMatch.home_team) tpPatch.status = 'upcoming'
            }
            await supabase.from('knockout_bracket_matches').update(tpPatch).eq('id', tpMatch.id)
            log.push(`  LOSER M${mn}→M103: ${loserTeam}`)
          }
        }

        log.push(`  RESULT M${mn}: ${winnerTeam} wins (${homeScore}–${awayScore})`)
        resultsSet++
      }
    }

    log.push(`Done — teams:${teamsUpdated} results:${resultsSet} errors:${errors}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.push(`FATAL: ${msg}`)
    return new Response(JSON.stringify({ success: false, error: msg, log }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(
    JSON.stringify({ success: true, teamsUpdated, resultsSet, errors, log }, null, 2),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
