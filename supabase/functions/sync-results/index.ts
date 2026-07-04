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
  'Cape Verde Islands':    'כף ורדה',
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

      // Skip finished GROUP-STAGE matches (idempotent; re-grade KO every run)
      if (dbMatch.status === 'finished' && !KO_STAGES.has(dbMatch.stage)) {
        log.push(`  SKIP ${homeHe} vs ${awayHe}: already finished in DB`)
        skippedCount++
        continue
      }

      // ── Determine 90-min score for grading ────────────────────────
      // For KO: regularTime = 90-min score when ET occurred; null when match ended in
      // normal time (API quirk). fullTime = 90-min for normal-time matches, after-ET
      // for ET matches. So: regularTime ?? fullTime always gives the correct 90-min score.
      // For group stage: fullTime is always the final score.
      const isKnockout = KO_STAGES.has(dbMatch.stage)
      const score90Home = isKnockout
        ? (m.score.regularTime?.home ?? m.score.fullTime.home)
        : m.score.fullTime.home
      const score90Away = isKnockout
        ? (m.score.regularTime?.away ?? m.score.fullTime.away)
        : m.score.fullTime.away

      // Coerce to integer or null — guard against string/float from API
      const s90h = score90Home != null ? Math.round(Number(score90Home)) : null
      const s90a = score90Away != null ? Math.round(Number(score90Away)) : null

      log.push(`  GRADE ${homeHe} vs ${awayHe}: 90min=${s90h ?? '?'}–${s90a ?? '?'} fullTime=${homeScore}–${awayScore} result=${result}`)

      // ── Update match row ────────────────────────────────────────────
      // Store 90-min score (what users bet on) — not after-ET score
      const { error: matchErr } = await supabase
        .from('matches')
        .update({
          result,
          status:         'finished',
          home_score:     s90h ?? homeScore,
          away_score:     s90a ?? awayScore,
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', dbMatch.id)

      if (matchErr) {
        console.error(`[sync] match update error:`, matchErr)
        continue
      }

      // ── Grade all bets via single canonical SQL function ────────────
      // grade_match_bets handles KO two-bet rule and group-stage logic identically
      // to the admin set_match_result path — no divergence possible.
      const { error: gradeErr } = await supabase.rpc('grade_match_bets', {
        p_match_id:   dbMatch.id,
        p_result:     result,
        p_home_score: s90h ?? homeScore,
        p_away_score: s90a ?? awayScore,
      })
      if (gradeErr) {
        console.error(`[sync] grade_match_bets error for ${homeHe} vs ${awayHe}:`, gradeErr)
        continue
      }

      updatedCount++
    }

    // Deduplicate unmapped teams
    unmappedTeams = [...new Set(unmappedTeams)]

    // ── Always recalculate totals (idempotent; fixes any trigger lag) ──
    await supabase.rpc('recalculate_all_user_points')
    log.push('Recalculated total_points for all users')

    // ── Self-check: verify all finished KO bets match stored scores ──
    const { data: mismatches } = await supabase.rpc('check_ko_bet_mismatches')
    if (mismatches && mismatches.length > 0) {
      log.push(`⚠️ Self-check: ${mismatches.length} KO bets still mismatched — running emergency re-grade`)
      console.error('[sync] KO mismatch after grade:', mismatches)
      // Emergency re-grade using stored match data (bypasses API entirely)
      await supabase.rpc('regrade_all_ko_bets')
      await supabase.rpc('recalculate_all_user_points')
      log.push('Emergency re-grade complete')
    } else {
      log.push(`✅ Self-check passed: all KO bets correctly graded`)
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
