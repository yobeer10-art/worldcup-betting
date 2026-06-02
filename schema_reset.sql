-- ================================================================
-- schema_reset.sql
-- Run this in Supabase Dashboard → SQL Editor
--
-- Adds:
--   1. Missing bets columns (predicted_home_score, predicted_away_score,
--      points_earned) — safe to run even if they already exist
--   2. admin_reset_user_bets()     — wipe one user's bets + points
--   3. admin_reset_all_bets()      — wipe ALL bets + ALL points
--   4. admin_set_all_live_to_upcoming() — recover stuck "live" matches
--   5. reset_my_bets()             — user self-service reset (pre-tournament)
-- ================================================================

-- ── 1. Ensure exact-score columns exist on bets ──────────────
ALTER TABLE public.bets
  ADD COLUMN IF NOT EXISTS predicted_home_score integer,
  ADD COLUMN IF NOT EXISTS predicted_away_score integer,
  ADD COLUMN IF NOT EXISTS points_earned        integer NOT NULL DEFAULT 0;

-- ── 2. admin_reset_user_bets ─────────────────────────────────
-- Deletes all bets + predictions for one user and zeros their points.
CREATE OR REPLACE FUNCTION public.admin_reset_user_bets(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'אין הרשאות ניהול';
  END IF;

  DELETE FROM bets               WHERE user_id = p_user_id;
  DELETE FROM group_predictions  WHERE user_id = p_user_id;
  DELETE FROM knockout_predictions WHERE user_id = p_user_id;
  UPDATE users SET total_points = 0 WHERE id = p_user_id;
END;
$$;

-- ── 3. admin_reset_all_bets ──────────────────────────────────
-- Wipes every bet / prediction in the entire system and zeros all points.
CREATE OR REPLACE FUNCTION public.admin_reset_all_bets()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'אין הרשאות ניהול';
  END IF;

  DELETE FROM bets;
  DELETE FROM group_predictions;
  DELETE FROM knockout_predictions;
  UPDATE users SET total_points = 0;
END;
$$;

-- ── 4. admin_set_all_live_to_upcoming ───────────────────────
-- Moves every match whose status = 'live' back to 'upcoming'.
-- Returns the number of matches that were changed.
CREATE OR REPLACE FUNCTION public.admin_set_all_live_to_upcoming()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'אין הרשאות ניהול';
  END IF;

  UPDATE matches SET status = 'upcoming' WHERE status = 'live';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ── 5. reset_my_bets (user self-service) ─────────────────────
-- Users can wipe their own bets before the tournament starts.
-- Enforced server-side: only works before 2026-06-11 00:00 UTC.
CREATE OR REPLACE FUNCTION public.reset_my_bets()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'לא מחובר';
  END IF;

  -- Hard deadline enforced in DB — cannot be bypassed from the client
  IF now() >= TIMESTAMPTZ '2026-06-11T00:00:00Z' THEN
    RAISE EXCEPTION 'לא ניתן לאפס לאחר תחילת הטורניר';
  END IF;

  DELETE FROM bets               WHERE user_id = v_uid;
  DELETE FROM group_predictions  WHERE user_id = v_uid;
  DELETE FROM knockout_predictions WHERE user_id = v_uid;
  UPDATE users SET total_points = 0 WHERE id = v_uid;
END;
$$;

-- ── Grant execute permissions ─────────────────────────────────
GRANT EXECUTE ON FUNCTION public.admin_reset_user_bets(uuid)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_all_bets()          TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_all_live_to_upcoming() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_my_bets()                 TO authenticated;
