CREATE OR REPLACE FUNCTION public.recalculate_all_user_points()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  UPDATE users u
  SET total_points = (
    SELECT COALESCE(SUM(b.points_earned), 0)
    FROM bets b WHERE b.user_id = u.id
  ) + (
    SELECT COALESCE(SUM(gp.points_earned), 0)
    FROM group_predictions gp WHERE gp.user_id = u.id
  ) + (
    SELECT COALESCE(SUM(kp.points_earned), 0)
    FROM knockout_predictions kp WHERE kp.user_id = u.id
  );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recalculate_all_user_points() TO service_role;
