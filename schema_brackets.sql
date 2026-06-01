-- ================================================================
-- schema_brackets.sql
-- Run AFTER schema.sql + schema_groups.sql + schema_admin.sql
-- Adds: two-step bet scoring, knockout bracket, predictions
-- ================================================================

-- ----------------------------------------------------------------
-- 1. EXTEND bets TABLE
-- ----------------------------------------------------------------
ALTER TABLE public.bets
  ADD COLUMN IF NOT EXISTS predicted_home_score integer,
  ADD COLUMN IF NOT EXISTS predicted_away_score integer,
  ADD COLUMN IF NOT EXISTS points_earned        integer NOT NULL DEFAULT 0;

-- ----------------------------------------------------------------
-- 2. UPGRADE recalculate_user_points TO SUM points_earned
--    (replaces the old COUNT(*) approach)
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalculate_user_points()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET total_points = (
    -- match-bet points (1 correct result, 3 correct result+score)
    SELECT COALESCE(SUM(points_earned), 0)
    FROM   public.bets
    WHERE  user_id = NEW.user_id
  ) + (
    -- group-stage prediction points
    SELECT COALESCE(SUM(points_earned), 0)
    FROM   public.group_predictions
    WHERE  user_id = NEW.user_id
  ) + (
    -- knockout-bracket prediction points
    SELECT COALESCE(SUM(points_earned), 0)
    FROM   public.knockout_predictions
    WHERE  user_id = NEW.user_id
  )
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------
-- 3. UPGRADE set_match_result — new 3-tier scoring
--    Correct result only      → 1 pt
--    Correct result + score   → 3 pts
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_match_result(
  p_match_id   uuid,
  p_result     text,
  p_home_score integer DEFAULT NULL,
  p_away_score integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;
  IF p_result NOT IN ('home', 'draw', 'away') THEN
    RAISE EXCEPTION 'result must be: home | draw | away';
  END IF;

  UPDATE public.matches
  SET  result         = p_result,
       status         = 'finished',
       home_score     = p_home_score,
       away_score     = p_away_score,
       last_synced_at = now()
  WHERE id = p_match_id;

  -- Grade every bet with points_earned
  UPDATE public.bets
  SET
    is_correct    = (prediction = p_result),
    points_earned = CASE
      -- Wrong prediction
      WHEN prediction != p_result THEN 0
      -- Correct prediction AND exact score matches
      WHEN prediction = p_result
           AND p_home_score IS NOT NULL
           AND predicted_home_score IS NOT NULL
           AND predicted_home_score = p_home_score
           AND predicted_away_score = p_away_score
      THEN 3
      -- Correct prediction, no or wrong exact score
      ELSE 1
    END
  WHERE match_id = p_match_id;
  -- The on_bet_graded trigger fires and calls recalculate_user_points
END;
$$;

-- ----------------------------------------------------------------
-- 4. UPGRADE admin_recalculate_all_points
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_recalculate_all_points()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  UPDATE public.users u
  SET total_points = (
    SELECT COALESCE(SUM(b.points_earned), 0)
    FROM   public.bets b WHERE b.user_id = u.id
  ) + (
    SELECT COALESCE(SUM(gp.points_earned), 0)
    FROM   public.group_predictions gp WHERE gp.user_id = u.id
  ) + (
    SELECT COALESCE(SUM(kp.points_earned), 0)
    FROM   public.knockout_predictions kp WHERE kp.user_id = u.id
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ----------------------------------------------------------------
-- 5. KNOCKOUT BRACKET MATCHES  (admin-populated after group stage)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.knockout_bracket_matches (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  round        text        NOT NULL
                 CHECK (round IN ('round_of_32','round_of_16','quarter','semi','third_place','final')),
  position     integer     NOT NULL,          -- order within the round (1-based)
  home_team    text,                          -- null until team is known
  away_team    text,
  home_source  text,                          -- e.g. "1A", "W1" (winner of match 1)
  away_source  text,
  match_date   timestamptz,
  status       text        NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','upcoming','live','finished')),
  result       text        CHECK (result IN ('home','away') OR result IS NULL),
  home_score   integer,
  away_score   integer,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (round, position)
);

ALTER TABLE public.knockout_bracket_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knockout_matches_select_all" ON public.knockout_bracket_matches
  FOR SELECT USING (true);

CREATE POLICY "knockout_matches_admin_all" ON public.knockout_bracket_matches
  FOR ALL USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ----------------------------------------------------------------
-- 6. KNOCKOUT PREDICTIONS  (user picks per bracket match)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.knockout_predictions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bracket_match_id    uuid        NOT NULL REFERENCES public.knockout_bracket_matches(id) ON DELETE CASCADE,
  predicted_winner    text        NOT NULL,
  points_earned       integer     NOT NULL DEFAULT 0,
  is_graded           boolean     NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, bracket_match_id)
);

ALTER TABLE public.knockout_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knockout_preds_own_all"
  ON public.knockout_predictions
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "knockout_preds_select_all"
  ON public.knockout_predictions
  FOR SELECT USING (true);

-- ----------------------------------------------------------------
-- 7. KNOCKOUT SCORING — points per round
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_grade_knockout_match(p_bracket_match_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_round  text;
  v_winner text;
  v_pts    integer;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  -- Get round and winning team
  SELECT
    round,
    CASE WHEN result = 'home' THEN home_team ELSE away_team END
  INTO v_round, v_winner
  FROM public.knockout_bracket_matches
  WHERE id = p_bracket_match_id;

  -- Points by round
  v_pts := CASE v_round
    WHEN 'round_of_32'  THEN  1
    WHEN 'round_of_16'  THEN  2
    WHEN 'quarter'      THEN  4
    WHEN 'semi'         THEN  8
    WHEN 'third_place'  THEN  4
    WHEN 'final'        THEN 16
    ELSE 1
  END;

  -- Grade predictions
  UPDATE public.knockout_predictions
  SET
    is_graded    = true,
    points_earned = CASE WHEN predicted_winner = v_winner THEN v_pts ELSE 0 END
  WHERE bracket_match_id = p_bracket_match_id;

  -- Recalculate total_points for affected users
  UPDATE public.users u
  SET total_points = (
    SELECT COALESCE(SUM(b.points_earned), 0)  FROM public.bets b  WHERE b.user_id = u.id
  ) + (
    SELECT COALESCE(SUM(gp.points_earned), 0) FROM public.group_predictions gp WHERE gp.user_id = u.id
  ) + (
    SELECT COALESCE(SUM(kp.points_earned), 0) FROM public.knockout_predictions kp WHERE kp.user_id = u.id
  )
  WHERE u.id IN (
    SELECT user_id FROM public.knockout_predictions WHERE bracket_match_id = p_bracket_match_id
  );
END;
$$;

-- ----------------------------------------------------------------
-- 8. ADMIN HELPER: set knockout match result and advance bracket
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_knockout_result(
  p_bracket_match_id uuid,
  p_result           text,      -- 'home' or 'away'
  p_home_score       integer    DEFAULT NULL,
  p_away_score       integer    DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_result NOT IN ('home', 'away') THEN
    RAISE EXCEPTION 'knockout result must be: home | away';
  END IF;

  UPDATE public.knockout_bracket_matches
  SET  result     = p_result,
       status     = 'finished',
       home_score = p_home_score,
       away_score = p_away_score
  WHERE id = p_bracket_match_id;

  -- Automatically grade predictions for this match
  PERFORM public.admin_grade_knockout_match(p_bracket_match_id);
END;
$$;
