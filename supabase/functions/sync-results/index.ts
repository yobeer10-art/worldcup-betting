// ================================================================
// Supabase Edge Function: sync-results
// Fetches finished World Cup 2026 results from football-data.org
// and updates our matches table + grades bets (3-tier scoring).
//
// Required secrets (Dashboard → Edge Functions → Secrets):
//   FOOTBALL_DATA_API_KEY  — free key: https://www.football-data.org/
//   SUPABASE_URL           — auto-injected
//   SUPABASE_SERVICE_ROLE_KEY — auto-injected
// ================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── English API names → Hebrew ────────────────────────────────
const TEAM_MAP: Record<string, string> = {
  'Mexico': 'מקסיקו', 'Canada': 'קנדה',
  'United States': 'ארצות הברית', 'USA': 'ארצות הברית',
  'Panama': 'פנמה', 'Haiti': 'האיטי',
  'Curaçao': 'קוראסאו', 'Curacao': 'קוראסאו',
  'Brazil': 'ברזיל', 'Argentina': 'ארגנטינה',
  'Uruguay': 'אורוגוואי', 'Colombia': 'קולומביה',
  'Ecuador': 'אקוודור', 'Paraguay': 'פרגוואי',
  'Germany': 'גרמניה', 'France': 'צרפת', 'Spain': 'ספרד',
  'England': 'אנגליה', 'Portugal': 'פורטוגל',
  'Netherlands': 'הולנד', 'Belgium': 'בלגיה',
  'Switzerland': 'שוויץ', 'Croatia': 'קרואטיה',
  'Austria': 'אוסטריה', 'Czechia': "צ'כיה",
  'Czech Republic': "צ'כיה", 'Scotland': 'סקוטלנד',
  'Turkey': 'טורקיה', 'Türkiye': 'טורקיה',
  'Norway': 'נורווגיה', 'Sweden': 'שוודיה',
  'Bosnia and Herzegovina': 'בוסניה והרצגובינה',
  'Bosnia & Herzegovina': 'בוסניה והרצגובינה',
  'Morocco': 'מרוקו', 'Senegal': 'סנגל',
  'Ghana': 'גאנה', 'Egypt': 'מצרים',
  'Tunisia': 'תוניסיה', 'Algeria': "אלג'יריה",
  'South Africa': 'דרום אפריקה',
  "Côte d'Ivoire": 'חוף השנהב', "Cote d'Ivoire": 'חוף השנהב',
  'Ivory Coast': 'חוף השנהב',
  'DR Congo': 'קונגו הדמוקרטית',
  'Congo DR': 'קונגו הדמוקרטית',
  'Democratic Republic of Congo': 'קונגו הדמוקרטית',
  'Democratic Republic of the Congo': 'קונגו הדמוקרטית',
  'Cape Verde': 'כף ורדה', 'Cabo Verde': 'כף ורדה',
  'Japan': 'יפן',
  'South Korea': 'קוריאה הדרומית',
  'Korea Republic': 'קוריאה הדרומית',
  'Republic of Korea': 'קוריאה הדרומית',
  'Australia': 'אוסטרליה', 'Saudi Arabia': 'סעודיה',
  'Iran': 'איראן', 'Qatar': 'קטר',
  'Iraq': 'עיראק', 'Jordan': 'ירדן',
  'Uzbekistan': 'אוזבקיסטן', 'New Zealand': 'ניו זילנד',
}

function mapTeam(name: string): string | null {
  return TEAM_MAP[name] ?? null
}

interface ApiMatch {
  id:       number
  utcDate:  string
  status:   string
  homeTeam: { name: string }
  awayTeam: { name: string }
  score: {
    winner:   'HOME_TEAM' | 'AWAY_TEAM' | 'DRAW' | null
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
    return new Response(
      JSON.stringify({ success: false, error: 'FOOTBALL_DATA_API_KEY not set' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  let updatedCount = 0
  let errorMsg: string | null = null

  try {
    const apiRes = await fetch(
      'https://api.football-data.org/v4/competitions/WC/matches?status=FINISHED',
      { headers: { 'X-Auth-Token': apiKey } },
    )
    if (!apiRes.ok) {
      throw new Error(`API error: ${apiRes.status} ${apiRes.statusText}`)
    }

    const { matches }: { matches: ApiMatch[] } = await apiRes.json()

    for (const m of matches) {
      const homeHe = mapTeam(m.homeTeam.name)
      const awayHe = mapTeam(m.awayTeam.name)
      if (!homeHe || !awayHe) continue

      let result: 'home' | 'draw' | 'away' | null = null
      if (m.score.winner === 'HOME_TEAM') result = 'home'
      else if (m.score.winner === 'AWAY_TEAM') result = 'away'
      else if (m.score.winner === 'DRAW')      result = 'draw'
      if (!result) continue

      const homeScore = m.score.fullTime.home
      const awayScore = m.score.fullTime.away

      // Find our match row (±12h window around API timestamp)
      const apiDate = new Date(m.utcDate)
      const dateMin = new Date(apiDate.getTime() - 12 * 3600000).toISOString()
      const dateMax = new Date(apiDate.getTime() + 12 * 3600000).toISOString()

      const { data: dbMatch } = await supabase
        .from('matches')
        .select('id, status')
        .eq('home_team', homeHe)
        .eq('away_team', awayHe)
        .gte('match_date', dateMin)
        .lte('match_date', dateMax)
        .maybeSingle()

      if (!dbMatch || dbMatch.status === 'finished') continue

      // ── Update match ──────────────────────────────────────────
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

      if (matchErr) { console.error('match update:', matchErr); continue }

      // ── Grade bets: 3-tier scoring ─────────────────────────────
      // Correct result AND correct exact score → 3 pts
      // Correct result, wrong/no score         → 1 pt
      // Wrong result                           → 0 pts

      // Wrong predictions
      await supabase
        .from('bets')
        .update({ is_correct: false, points_earned: 0 })
        .eq('match_id', dbMatch.id)
        .neq('prediction', result)

      // Correct predictions — need to check score individually
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

        await supabase
          .from('bets')
          .update({
            is_correct:    true,
            points_earned: exactMatch ? 3 : 1,
          })
          .eq('id', bet.id)
        // on_bet_graded trigger fires and recalculates user total_points
      }

      updatedCount++
    }
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err)
    console.error('sync-results error:', errorMsg)
  }

  // Log to sync_log
  await supabase
    .from('sync_log')
    .insert({ matches_updated: updatedCount, status: errorMsg ? 'error' : 'success', message: errorMsg })
    .catch(() => {})

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
