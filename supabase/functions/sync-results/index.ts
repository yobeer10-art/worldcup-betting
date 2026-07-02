// ================================================================
// Supabase Edge Function: sync-results
// Fetches finished World Cup 2026 results from football-data.org
// and updates our matches table + grades bets (3-tier scoring).
//
// Required secrets (Dashboard → Edge Functions → Secrets):
//   FOOTBALL_DATA_API_KEY  — free key: https://www.football-data.org/
//   SUPABASE_URL           — auto-injected
//   SUPABASE_SERVICE_ROLE_KEY — auto-injected
//
// Deploy:  supabase functions deploy sync-results
// Trigger: curl -X POST https://<ref>.supabase.co/functions/v1/sync-results \
//            -H "Authorization: Bearer <anon_key>"
// ================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── English API names → Hebrew ────────────────────────────────────
// Covers all 48 WC 2026 teams + common API spelling variants.
const TEAM_MAP: Record<string, string> = {
  // CONCACAF
  'Mexico':                'מקסיקו',
  'Canada':                'קנדה',
  'United States':         'ארצות הברית',
  'USA':                   'ארצות הברית',
  'US':                    'ארצות הברית',
  'United States of America': 'ארצות הברית',
  'Panama':                'פנמה',
  'Haiti':                 'האיטי',
  'Jamaica':               "ג'מייקה",
  'Honduras':              'הונדורס',
  'Costa Rica':            'קוסטה ריקה',
  'Curaçao':               'קוראסאו',
  'Curacao':               'קוראסאו',
  // CONMEBOL
  'Brazil':                'ברזיל',
  'Argentina':             'ארגנטינה',
  'Uruguay':               'אורוגוואי',
  'Colombia':              'קולומביה',
  'Ecuador':               'אקוודור',
  'Paraguay':              'פרגוואי',
  'Bolivia':               'בוליביה',
  'Peru':                  'פרו',
  'Chile':                 "צ'ילה",
  'Venezuela':             'ונצואלה',
  // UEFA
  'Germany':               'גרמניה',
  'France':                'צרפת',
  'Spain':                 'ספרד',
  'England':               'אנגליה',
  'Portugal':              'פורטוגל',
  'Netherlands':           'הולנד',
  'Belgium':               'בלגיה',
  'Switzerland':           'שוויץ',
  'Croatia':               'קרואטיה',
  'Austria':               'אוסטריה',
  'Czechia':               "צ'כיה",
  'Czech Republic':        "צ'כיה",
  'Scotland':              'סקוטלנד',
  'Wales':                 'ויילס',
  'Ireland':               'אירלנד',
  'Republic of Ireland':   'אירלנד',
  'Turkey':                'טורקיה',
  'Türkiye':               'טורקיה',
  'Norway':                'נורווגיה',
  'Sweden':                'שוודיה',
  'Denmark':               'דנמרק',
  'Poland':                'פולין',
  'Serbia':                'סרביה',
  'Slovenia':              'סלובניה',
  'Slovakia':              'סלובקיה',
  'Hungary':               'הונגריה',
  'Romania':               'רומניה',
  'Greece':                'יוון',
  'Ukraine':               'אוקראינה',
  'Georgia':               "ג'ורג'יה",
  'Bosnia and Herzegovina': 'בוסניה והרצגובינה',
  'Bosnia & Herzegovina':  'בוסניה והרצגובינה',
  'Bosnia-Herzegovina':    'בוסניה והרצגובינה',
  'Italy':                 'איטליה',
  'Israel':                'ישראל',
  // CAF
  'Morocco':               'מרוקו',
  'Senegal':               'סנגל',
  'Nigeria':               'ניגריה',
  'Cameroon':              'קמרון',
  'Ghana':                 'גאנה',
  'Egypt':                 'מצרים',
  'Tunisia':               'תוניסיה',
  'Algeria':               "אלג'יריה",
  'Mali':                  'מאלי',
  'South Africa':          'דרום אפריקה',
  "Côte d'Ivoire":         'חוף השנהב',
  "Cote d'Ivoire":         'חוף השנהב',
  'Ivory Coast':           'חוף השנהב',
  'DR Congo':              'קונגו הדמוקרטית',
  'Congo DR':              'קונגו הדמוקרטית',
  'Democratic Republic of Congo': 'קונגו הדמוקרטית',
  'Democratic Republic of the Congo': 'קונגו הדמוקרטית',
  'Cape Verde':            'כף ורדה',
  'Cabo Verde':            'כף ורדה',
  'Ethiopia':              'אתיופיה',
  // AFC
  'Japan':                 'יפן',
  'South Korea':           'קוריאה הדרומית',
  'Korea Republic':        'קוריאה הדרומית',
  'Republic of Korea':     'קוריאה הדרומית',
  'Korea DPR':             'קוריאה הדרומית',  // fallback
  'Australia':             'אוסטרליה',
  'Saudi Arabia':          'סעודיה',
  'KSA':                   'סעודיה',
  'Iran':                  'איראן',
  'IR Iran':               'איראן',
  'Qatar':                 'קטר',
  'Iraq':                  'עיראק',
  'Jordan':                'ירדן',
  'Uzbekistan':            'אוזבקיסטן',
  'Kuwait':                'כווית',
  // OFC
  'New Zealand':           'ניו זילנד',
}

function mapTeam(name: string): string | null {
  return TEAM_MAP[name] ?? null
}

const KO_STAGES = new Set(['round_of_32','round_of_16','quarter','semi','third_place','final'])

interface ApiMatch {
  id:       number
  utcDate:  string
  status:   string
  homeTeam: { name: string; shortName?: string }
  awayTeam: { name: string; shortName?: string }
  score: {
    winner:      'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null
    fullTime:    { home: number | null; away: number | null }
    regularTime: { home: number | null; away: number | null }
  }
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const apiKey = Deno.env.get('FOOTBALL_DATA_API_KEY')
  if (!apiKey) {
    return new Response(
      JSON.stringify({ success: false, error: 'FOOTBALL_DATA_API_KEY not set' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  let updatedCount = 0
  let skippedCount = 0
  let unmappedTeams: string[] = []
  let notFoundMatches: string[] = []
  let errorMsg: string | null = null
  const log: string[] = []

  try {
    const apiRes = await fetch(
      'https://api.football-data.org/v4/competitions/WC/matches?status=FINISHED',
      { headers: { 'X-Auth-Token': apiKey } },
    )
    if (!apiRes.ok) {
      throw new Error(`API error: ${apiRes.status} ${apiRes.statusText}`)
    }

    const { matches }: { matches: ApiMatch[] } = await apiRes.json()
    log.push(`API returned ${matches.length} finished matches`)

    for (const m of matches) {
      const homeRaw = m.homeTeam.name
      const awayRaw = m.awayTeam.name
      const homeHe  = mapTeam(homeRaw)
      const awayHe  = mapTeam(awayRaw)

      if (!homeHe) {
        unmappedTeams.push(homeRaw)
        console.warn(`[sync] unmapped home team: "${homeRaw}"`)
      }
      if (!awayHe) {
        unmappedTeams.push(awayRaw)
        console.warn(`[sync] unmapped away team: "${awayRaw}"`)
      }
      if (!homeHe || !awayHe) continue

      let result: 'home' | 'draw' | 'away' | null = null
      if (m.score.winner === 'HOME_TEAM') result = 'home'
      else if (m.score.winner === 'AWAY_TEAM') result = 'away'
      else if (m.score.winner === 'DRAW')      result = 'draw'
      if (!result) {
        log.push(`  SKIP ${homeHe} vs ${awayHe}: no winner yet`)
        continue
      }

      const homeScore = m.score.fullTime.home
      const awayScore = m.score.fullTime.away

      // ── Find DB match: primary = team names, secondary = ±24h date window ──
      const apiDate = new Date(m.utcDate)
      const dateMin = new Date(apiDate.getTime() - 24 * 3600000).toISOString()
      const dateMax = new Date(apiDate.getTime() + 24 * 3600000).toISOString()

      const { data: dbMatch, error: findErr } = await supabase
        .from('matches')
        .select('id, status, stage, home_team, away_team')
        .eq('home_team', homeHe)
        .eq('away_team', awayHe)
        .gte('match_date', dateMin)
        .lte('match_date', dateMax)
        .maybeSingle()

      if (findErr) {
        console.error(`[sync] DB lookup error for ${homeHe} vs ${awayHe}:`, findErr)
        continue
      }

      if (!dbMatch) {
        notFoundMatches.push(`${homeHe} vs ${awayHe} (${m.utcDate})`)
        console.warn(`[sync] DB match NOT FOUND: ${homeHe} vs ${awayHe} around ${m.utcDate}`)
        continue
      }

      if (dbMatch.status === 'finished') {
        log.push(`  SKIP ${homeHe} vs ${awayHe}: already finished in DB`)
        skippedCount++
        continue
      }

      log.push(`  UPDATE ${homeHe} vs ${awayHe}: ${homeScore}–${awayScore} (${result})`)

      // ── Update match ───────────────────────────────────────────────
      const { error: matchErr } = await supabase
        .from('matches')
        .update({
          result,
          status:         'finished',
          home_score:     homeScore,
          away_score:     awayScore,
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', dbMatch.id)

      if (matchErr) {
        console.error(`[sync] match update error:`, matchErr)
        continue
      }

      // ── Grade bets ─────────────────────────────────────────────────
      const isKnockout = KO_STAGES.has(dbMatch.stage)

      if (isKnockout) {
        // ── Knockout: Bet1=advance pick (2pts), Bet2=exact 90-min score (3pts) ──
        // Bet1 winner = final winner including ET + penalties (score.winner from API)
        const winnerTeam = result === 'home' ? dbMatch.home_team : dbMatch.away_team

        // Bet2 score = regularTime (90-min score) ONLY.
        // Never fall back to fullTime: for ET/penalty matches fullTime is the after-ET
        // score (or penalty counts), not the 90-min result.  If regularTime is null
        // we simply can't grade the score bet — scoreCorrect stays false.
        const rtHome = m.score.regularTime?.home ?? null
        const rtAway = m.score.regularTime?.away ?? null

        const { data: allBets } = await supabase
          .from('bets')
          .select('id, advance_pick, predicted_home_score, predicted_away_score')
          .eq('match_id', dbMatch.id)

        for (const bet of allBets ?? []) {
          const advanceCorrect = !!bet.advance_pick && bet.advance_pick === winnerTeam
          const advPts = advanceCorrect ? 2 : 0

          const scoreCorrect =
            rtHome !== null && rtAway !== null &&
            bet.predicted_home_score !== null && bet.predicted_away_score !== null &&
            bet.predicted_home_score === rtHome && bet.predicted_away_score === rtAway
          const scorePts = scoreCorrect ? 3 : 0

          await supabase.from('bets').update({
            is_correct:     advanceCorrect,
            advance_points: advPts,
            points_earned:  advPts + scorePts,
          }).eq('id', bet.id)
        }
      } else {
        // ── Group stage: correct result = 1pt, exact fullTime score = 3pts ──
        await supabase
          .from('bets')
          .update({ is_correct: false, points_earned: 0 })
          .eq('match_id', dbMatch.id)
          .neq('prediction', result)

        const { data: correctBets } = await supabase
          .from('bets')
          .select('id, predicted_home_score, predicted_away_score')
          .eq('match_id', dbMatch.id)
          .eq('prediction', result)

        for (const bet of correctBets ?? []) {
          const exactMatch =
            homeScore !== null &&
            bet.predicted_home_score !== null &&
            bet.predicted_home_score === homeScore &&
            bet.predicted_away_score === awayScore

          await supabase.from('bets').update({
            is_correct:    true,
            points_earned: exactMatch ? 3 : 1,
          }).eq('id', bet.id)
        }
      }

      updatedCount++
    }

    // Deduplicate unmapped teams
    unmappedTeams = [...new Set(unmappedTeams)]

    // Recalculate total_points for all users after grading
    if (updatedCount > 0) {
      await supabase.rpc('recalculate_all_user_points')
      log.push('Recalculated total_points for all users')
    }

    log.push(`Done: ${updatedCount} updated, ${skippedCount} already finished`)
    if (unmappedTeams.length)   log.push(`Unmapped teams: ${unmappedTeams.join(', ')}`)
    if (notFoundMatches.length) log.push(`Not found in DB: ${notFoundMatches.join(' | ')}`)

    console.log('[sync]', log.join('\n'))

  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err)
    console.error('[sync] fatal error:', errorMsg)
  }

  // Log to sync_log (fire-and-forget)
  try {
    await supabase.from('sync_log').insert({
      matches_updated: updatedCount,
      status:  errorMsg ? 'error' : 'success',
      message: errorMsg
        ?? (notFoundMatches.length
          ? `Not found in DB: ${notFoundMatches.join(' | ')}`
          : log.at(-1) ?? null),
    })
  } catch (_) { /* ignore logging failures */ }

  const body = errorMsg
    ? { success: false, error: errorMsg }
    : {
        success: true,
        updated: updatedCount,
        skipped: skippedCount,
        unmappedTeams,
        notFoundMatches,
        log,
      }

  return new Response(JSON.stringify(body, null, 2), {
    status: errorMsg ? 500 : 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
