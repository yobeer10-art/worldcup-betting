-- From the semi-finals onward (semi / third_place / final), match bets are worth more:
--   advance pick correct = 3pts (was 2), exact 90-min score = 5pts (was 3).
-- Earlier KO rounds keep 2/3.
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
  v_adv_pts   integer;
  v_score_pts integer;
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

  -- Stage-based KO point values
  IF v_stage IN ('semi','third_place','final') THEN
    v_adv_pts   := 3;
    v_score_pts := 5;
  ELSE
    v_adv_pts   := 2;
    v_score_pts := 3;
  END IF;

  UPDATE public.matches
  SET  result = p_result, status = 'finished',
       home_score = p_home_score, away_score = p_away_score,
       last_synced_at = now()
  WHERE id = p_match_id;

  IF v_is_ko THEN
    v_winner := CASE WHEN p_result = 'home' THEN v_home_team ELSE v_away_team END;
    UPDATE public.bets
    SET
      is_correct     = (advance_pick = v_winner),
      advance_points = CASE WHEN advance_pick = v_winner THEN v_adv_pts ELSE 0 END,
      points_earned  =
        CASE WHEN advance_pick = v_winner THEN v_adv_pts ELSE 0 END
        + CASE
            WHEN p_home_score IS NOT NULL
             AND predicted_home_score IS NOT NULL
             AND predicted_home_score = p_home_score
             AND predicted_away_score = p_away_score
            THEN v_score_pts ELSE 0
          END
    WHERE match_id = p_match_id;
  ELSE
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
