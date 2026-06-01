// ================================================================
// Supabase Edge Function: sync-results
// Fetches finished World Cup 2026 match results from football-data.org
// and updates our Supabase matches table automatically.
//
// Required env vars (set in Supabase Dashboard → Edge Functions → Secrets):
//   FOOTBALL_DATA_API_KEY  — free key from https://www.football-data.org/
//   SUPABASE_URL           — auto-injected by Supabase
//   SUPABASE_SERVICE_ROLE_KEY — auto-injected by Supabase
// ================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── English API team names → Hebrew ─────────────────────────────
const TEAM_MAP: Record<string, string> = {
  // CONCACAF / Hosts
  'Mexico':                           'מקסיקו',
  'Canada':                           'קנדה',
  'United States':                    'ארצות הברית',
  'USA':                              'ארצות הברית',
  'Panama':                           'פנמה',
  'Haiti':                            'האיטי',
  'Curaçao':                          'קוראסאו',
  'Curacao':                          'קוראסאו',
  // South America
  'Brazil':                           'ברזיל',
  'Argentina':                        'ארגנטינה',
  'Uruguay':                          'אורוגוואי',
  'Colombia':                         'קולומביה',
  'Ecuador':                          'אקוודור',
  'Paraguay':                         'פרגוואי',
  // Europe
  'Germany':                          'גרמניה',
  'France':                           'צרפת',
  'Spain':                            'ספרד',
  'England':                          'אנגליה',
  'Portugal':                         'פורטוגל',
  'Netherlands':                      'הולנד',
  'Belgium':                          'בלגיה',
  'Switzerland':                      'שוויץ',
  'Croatia':                          'קרואטיה',
  'Austria':                          'אוסטריה',
  "Czechia":                          "צ'כיה",
  'Czech Republic':                   "צ'כיה",
  'Scotland':                         'סקוטלנד',
  'Turkey':                           'טורקיה',
  'Türkiye':                          'טורקיה',
  'Norway':                           'נורווגיה',
  'Sweden':                           'שוודיה',
  'Bosnia and Herzegovina':           'בוסניה והרצגובינה',
  'Bosnia & Herzegovina':             'בוסניה והרצגובינה',
  // Africa
  'Morocco':                          'מרוקו',
  'Senegal':                          'סנגל',
  'Ghana':                            'גאנה',
  'Egypt':                            'מצרים',
  'Tunisia':                          'תוניסיה',
  "Algeria":                          "אלג'יריה",
  'South Africa':                     'דרום אפריקה',
  "Côte d'Ivoire":                    'חוף השנהב',
  "Cote d'Ivoire":                    'חוף השנהב',
  'Ivory Coast':                      'חוף השנהב',
  'DR Congo':                         'קונגו הדמוקרטית',
  'Congo DR':                         'קונגו הדמוקרטית',
  'Democratic Republic of Congo':     'קונגו הדמוקרטית',
  'Democratic Republic of the Congo': 'קונגו הדמוקרטית',
  'Cape Verde':                       'כף ורדה',
  'Cabo Verde':                       'כף ורדה',
  // Asia / Oceania
  'Japan':                            'יפן',
  'South Korea':                      'קוריאה הדרומית',
  'Korea Republic':                   'קוריאה הדרומית',
  'Republic of Korea':                'קוריאה הדרומית',
  'Australia':                        'אוסטרליה',
  'Saudi Arabia':                     'סעודיה',
  'Iran':                             'איראן',
  'Qatar':                            'קטר',
  'Iraq':                             'עיראק',
  'Jordan':                           'ירדן',
  'Uzbekistan':                       'אוזבקיסטן',
  'New Zealand':                      'ניו זילנד',
}

function mapTeam(name: string): string | null {
  return TEAM_MAP[name] ?? null
}

// ── football-data.org response types ────────────────────────────
interface ApiMatch {
  id:        number
  utcDate:   string
  status:    string
  homeTeam:  { name: string }
  awayTeam:  { name: string }
  score: {
    winner:   'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null
    fullTime: { home: number | null; away: number | null }
  }
}

interface ApiResponse {
  matches: ApiMatch[]
}

// ── Main handler ─────────────────────────────────────────────────
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
  let errorMsg: string | null = null

  try {
    // Fetch all finished WC matches
    const apiRes = await fetch(
      'https://api.football-data.org/v4/competitions/WC/matches?status=FINISHED',
      { headers: { 'X-Auth-Token': apiKey } },
    )

    if (!apiRes.ok) {
      throw new Error(`football-data.org API error: ${apiRes.status} ${apiRes.statusText}`)
    }

    const { matches }: ApiResponse = await apiRes.json()

    for (const m of matches) {
      // Map team names
      const homeHe = mapTeam(m.homeTeam.name)
      const awayHe = mapTeam(m.awayTeam.name)
      if (!homeHe || !awayHe) continue

      // Determine result
      let result: 'home' | 'draw' | 'away' | null = null
      if (m.score.winner === 'HOME_TEAM') result = 'home'
      else if (m.score.winner === 'AWAY_TEAM') result = 'away'
      else if (m.score.winner === 'DRAW') result = 'draw'
      if (!result) continue

      const homeScore = m.score.fullTime.home
      const awayScore = m.score.fullTime.away

      // Find our DB row: match by teams + date (±12 h window)
      const apiDate = new Date(m.utcDate)
      const dateMin = new Date(apiDate.getTime() - 12 * 60 * 60 * 1000).toISOString()
      const dateMax = new Date(apiDate.getTime() + 12 * 60 * 60 * 1000).toISOString()

      const { data: dbMatch } = await supabase
        .from('matches')
        .select('id, status')
        .eq('home_team', homeHe)
        .eq('away_team', awayHe)
        .gte('match_date', dateMin)
        .lte('match_date', dateMax)
        .maybeSingle()

      if (!dbMatch) continue                    // not in our schedule
      if (dbMatch.status === 'finished') continue // already set (don't overwrite manual)

      // Update match result
      const { error: matchErr } = await supabase
        .from('matches')
        .update({
          result,
          status:          'finished',
          home_score:      homeScore,
          away_score:      awayScore,
          last_synced_at:  new Date().toISOString(),
        })
        .eq('id', dbMatch.id)

      if (matchErr) {
        console.error('match update error', matchErr)
        continue
      }

      // Grade bets — the DB trigger recalculate_user_points fires automatically
      await supabase
        .from('bets')
        .update({ is_correct: true })
        .eq('match_id', dbMatch.id)
        .eq('prediction', result)

      await supabase
        .from('bets')
        .update({ is_correct: false })
        .eq('match_id', dbMatch.id)
        .neq('prediction', result)

      updatedCount++
    }
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err)
    console.error('sync-results error:', errorMsg)
  }

  // Write sync log entry
  await supabase
    .from('sync_log')
    .insert({
      matches_updated: updatedCount,
      status:          errorMsg ? 'error' : 'success',
      message:         errorMsg,
    })
    .throwOnError()
    .catch(() => {}) // don't fail the response if logging fails

  if (errorMsg) {
    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  return new Response(
    JSON.stringify({ success: true, updated: updatedCount }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
