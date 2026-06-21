-- ================================================================
-- schema_topscorer.sql  —  Top Scorer / Golden Boot prediction
-- Run in Supabase Dashboard → SQL Editor
--
-- Creates:
--   top_scorer_predictions  table
--   admin_grade_top_scorer() function (marks correct picker +25 pts)
--   Updated recalculate_user_points() to include top-scorer points
-- ================================================================

-- ── 1. Table ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.top_scorer_predictions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  player_name   text        NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  points_earned integer     NOT NULL DEFAULT 0,
  is_graded     boolean     NOT NULL DEFAULT false,
  UNIQUE (user_id)   -- one pick per user
);

ALTER TABLE public.top_scorer_predictions ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read picks (for community stats post-lock)
DROP POLICY IF EXISTS "topscorer_select" ON public.top_scorer_predictions;
CREATE POLICY "topscorer_select" ON public.top_scorer_predictions
  FOR SELECT USING (true);

-- Users can only insert / update / delete their own pick
DROP POLICY IF EXISTS "topscorer_own" ON public.top_scorer_predictions;
CREATE POLICY "topscorer_own" ON public.top_scorer_predictions
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 2. Admin grading function ─────────────────────────────────────
-- Call once the Golden Boot winner is known.
-- Returns the count of correct picks that received +25 pts.
CREATE OR REPLACE FUNCTION public.admin_grade_top_scorer(p_winning_player text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row     RECORD;
  v_correct integer := 0;
BEGIN
  IF NOT is_admin() THEN RAISE EXCEPTION 'אין הרשאות ניהול'; END IF;

  FOR v_row IN
    SELECT id, user_id, player_name
    FROM top_scorer_predictions
    WHERE NOT is_graded
  LOOP
    IF v_row.player_name = p_winning_player THEN
      UPDATE top_scorer_predictions
        SET is_graded = true, points_earned = 25
        WHERE id = v_row.id;
      UPDATE users
        SET total_points = total_points + 25
        WHERE id = v_row.user_id;
      v_correct := v_correct + 1;
    ELSE
      UPDATE top_scorer_predictions
        SET is_graded = true, points_earned = 0
        WHERE id = v_row.id;
    END IF;
  END LOOP;

  RETURN v_correct;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_grade_top_scorer(text) TO authenticated;

-- ── 3. Update recalculate_user_points to include top-scorer ───────
-- This function is called by admin_recalculate_all_points() to
-- recompute a single user's total from all bet sources.
CREATE OR REPLACE FUNCTION public.recalculate_user_points(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_total integer;
BEGIN
  SELECT COALESCE(SUM(pts), 0) INTO v_total FROM (
    SELECT points_earned AS pts FROM bets               WHERE user_id = p_user_id
    UNION ALL
    SELECT points_earned         FROM group_predictions  WHERE user_id = p_user_id
    UNION ALL
    SELECT points_earned         FROM knockout_predictions WHERE user_id = p_user_id
    UNION ALL
    SELECT points_earned         FROM champion_predictions WHERE user_id = p_user_id
    UNION ALL
    SELECT points_earned         FROM top_scorer_predictions WHERE user_id = p_user_id
  ) t;

  UPDATE users SET total_points = v_total WHERE id = p_user_id;
END;
$$;
