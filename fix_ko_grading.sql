-- Fix 1: set_match_result — add KO two-bet branch
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
DECLARE
  v_stage     text;
  v_home_team text;
  v_away_team text;
  v_winner    text;
  v_is_ko     boolean;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;
  IF p_result NOT IN ('home', 'draw', 'away') THEN
    RAISE EXCEPTION 'result must be: home | draw | away';
  END IF;

  SELECT stage, home_team, away_team
  INTO v_stage, v_home_team, v_away_team
  FROM public.matches WHERE id = p_match_id;

  v_is_ko := v_stage IN ('round_of_32','round_of_16','quarter','semi','third_place','final');

  UPDATE public.matches
  SET  result = p_result, status = 'finished',
       home_score = p_home_score, away_score = p_away_score,
       last_synced_at = now()
  WHERE id = p_match_id;

  IF v_is_ko THEN
    -- KO two-bet rule: advance_pick correct = 2pts, exact 90-min score = 3pts.
    -- p_result is the final winner (home/away, no draw in KO).
    -- p_home_score/p_away_score are the 90-min scores entered by the admin.
    v_winner := CASE WHEN p_result = 'home' THEN v_home_team ELSE v_away_team END;
    UPDATE public.bets
    SET
      is_correct     = (advance_pick = v_winner),
      advance_points = CASE WHEN advance_pick = v_winner THEN 2 ELSE 0 END,
      points_earned  =
        CASE WHEN advance_pick = v_winner THEN 2 ELSE 0 END
        + CASE
            WHEN p_home_score IS NOT NULL
             AND predicted_home_score IS NOT NULL
             AND predicted_home_score = p_home_score
             AND predicted_away_score = p_away_score
            THEN 3 ELSE 0
          END
    WHERE match_id = p_match_id;
  ELSE
    -- Group stage: correct result = 1pt, exact fullTime score = 3pts.
    UPDATE public.bets
    SET
      is_correct     = (prediction = p_result),
      advance_points = 0,
      points_earned  = CASE
        WHEN prediction != p_result THEN 0
        WHEN p_home_score IS NOT NULL
             AND predicted_home_score IS NOT NULL
             AND predicted_home_score = p_home_score
             AND predicted_away_score = p_away_score
        THEN 3 ELSE 1
      END
    WHERE match_id = p_match_id;
  END IF;
END;
$$;

-- Fix 2: admin_reset_match — also zero points_earned and advance_points
CREATE OR REPLACE FUNCTION public.admin_reset_match(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.matches
  SET result = NULL, status = 'upcoming',
      home_score = NULL, away_score = NULL, last_synced_at = NULL
  WHERE id = p_match_id;
  UPDATE public.bets
  SET is_correct = NULL, points_earned = 0, advance_points = 0
  WHERE match_id = p_match_id;
END; $$;
