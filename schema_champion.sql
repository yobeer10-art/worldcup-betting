-- ================================================================
-- schema_champion.sql
-- Run in Supabase Dashboard → SQL Editor
--
-- Adds:
--   1. champion_predictions  table — one pick per user
--   2. bet_stats             view  — aggregate community odds
--   3. admin_grade_champion()       — score champion picks when winner known
-- ================================================================

-- ── 1. champion_predictions ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.champion_predictions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  team         text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  points_earned integer    NOT NULL DEFAULT 0,
  is_graded    boolean     NOT NULL DEFAULT false,
  UNIQUE (user_id)   -- one champion pick per user
);

ALTER TABLE public.champion_predictions ENABLE ROW LEVEL SECURITY;

-- Anyone can read champion picks (for community display after lock)
DROP POLICY IF EXISTS "champion_select" ON public.champion_predictions;
CREATE POLICY "champion_select" ON public.champion_predictions
  FOR SELECT USING (true);

-- Users can only insert/update/delete their own pick
DROP POLICY IF EXISTS "champion_own" ON public.champion_predictions;
CREATE POLICY "champion_own" ON public.champion_predictions
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 2. bet_stats view ─────────────────────────────────────────
-- Aggregate community predictions per match — safe to expose publicly.
-- Used by the MatchCard community-odds bar.
CREATE OR REPLACE VIEW public.bet_stats AS
SELECT
  match_id,
  COUNT(*)                                          AS total,
  COUNT(*) FILTER (WHERE prediction = 'home')       AS home_count,
  COUNT(*) FILTER (WHERE prediction = 'draw')       AS draw_count,
  COUNT(*) FILTER (WHERE prediction = 'away')       AS away_count
FROM public.bets
GROUP BY match_id;

-- Allow authenticated users to query the view
GRANT SELECT ON public.bet_stats TO authenticated, anon;

-- ── 3. admin_grade_champion ───────────────────────────────────
-- Call once the tournament winner is known.
-- Marks all predictions, adds 25 pts to correct pickers' totals.
-- Safe to call only once (is_graded guard prevents double-scoring).
CREATE OR REPLACE FUNCTION public.admin_grade_champion(p_winning_team text)
RETURNS integer          -- number of correct picks
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row       RECORD;
  v_correct   integer := 0;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'אין הרשאות ניהול';
  END IF;

  -- Loop over un-graded predictions
  FOR v_row IN
    SELECT id, user_id, team FROM champion_predictions WHERE NOT is_graded
  LOOP
    IF v_row.team = p_winning_team THEN
      UPDATE champion_predictions
        SET is_graded = true, points_earned = 25
        WHERE id = v_row.id;

      UPDATE users
        SET total_points = total_points + 25
        WHERE id = v_row.user_id;

      v_correct := v_correct + 1;
    ELSE
      UPDATE champion_predictions
        SET is_graded = true, points_earned = 0
        WHERE id = v_row.id;
    END IF;
  END LOOP;

  RETURN v_correct;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_grade_champion(text) TO authenticated;
