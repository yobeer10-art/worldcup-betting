-- ================================================================
-- schema_admin.sql — Admin Panel + Auto-Results Schema
-- Run AFTER schema.sql and schema_groups.sql
-- ================================================================

-- ----------------------------------------------------------------
-- 1. ADMINS TABLE
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admins (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text        UNIQUE NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Seed the initial admin
INSERT INTO public.admins (email) VALUES ('yobeer10@gmail.com')
  ON CONFLICT (email) DO NOTHING;

-- ----------------------------------------------------------------
-- 2. is_admin() — safe callable from any authenticated session
-- ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admins WHERE email = auth.email()
  );
$$;

-- RLS: only admins can see the admins table
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_select_admin_only" ON public.admins
  FOR SELECT USING (public.is_admin());

-- ----------------------------------------------------------------
-- 3. NEW COLUMNS
-- ----------------------------------------------------------------

-- matches: manual lock + auto-sync timestamp
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS is_locked      boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz;

-- users: soft ban
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;

-- ----------------------------------------------------------------
-- 4. REPLACE set_match_result WITH ADMIN-GUARDED VERSION
--    (also handles grade_group_predictions compatibility)
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

  -- Grade every bet → triggers recalculate_user_points per row
  UPDATE public.bets
  SET  is_correct = (prediction = p_result)
  WHERE match_id = p_match_id;
END;
$$;

-- ----------------------------------------------------------------
-- 5. ADMIN FUNCTIONS  (all check is_admin() before acting)
-- ----------------------------------------------------------------

-- Set a match to "live"
CREATE OR REPLACE FUNCTION public.admin_set_match_live(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.matches SET status = 'live' WHERE id = p_match_id;
END; $$;

-- Reset a match back to upcoming (undo result)
CREATE OR REPLACE FUNCTION public.admin_reset_match(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  UPDATE public.matches
  SET  result = NULL, status = 'upcoming',
       home_score = NULL, away_score = NULL, last_synced_at = NULL
  WHERE id = p_match_id;

  -- Undo bet grading
  UPDATE public.bets SET is_correct = NULL WHERE match_id = p_match_id;
END; $$;

-- Lock / unlock a single match
CREATE OR REPLACE FUNCTION public.admin_toggle_match_lock(
  p_match_id  uuid,
  p_is_locked boolean
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.matches SET is_locked = p_is_locked WHERE id = p_match_id;
END; $$;

-- Lock / unlock all upcoming matches at once; returns count affected
CREATE OR REPLACE FUNCTION public.admin_lock_all_matches(p_is_locked boolean)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.matches SET is_locked = p_is_locked WHERE status = 'upcoming';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

-- Manually adjust a user's total_points
CREATE OR REPLACE FUNCTION public.admin_update_user_points(
  p_user_id uuid,
  p_points  integer
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_points < 0 THEN RAISE EXCEPTION 'points cannot be negative'; END IF;
  UPDATE public.users SET total_points = p_points WHERE id = p_user_id;
END; $$;

-- Recalculate total_points for EVERY user from raw bet + group data
CREATE OR REPLACE FUNCTION public.admin_recalculate_all_points()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  UPDATE public.users u
  SET total_points = (
    SELECT COALESCE(COUNT(*) FILTER (WHERE b.is_correct = true), 0)
    FROM public.bets b WHERE b.user_id = u.id
  ) + (
    SELECT COALESCE(SUM(gp.points_earned), 0)
    FROM public.group_predictions gp WHERE gp.user_id = u.id
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

-- Ban / unban a user
CREATE OR REPLACE FUNCTION public.admin_set_user_banned(
  p_user_id   uuid,
  p_is_banned boolean
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  UPDATE public.users SET is_banned = p_is_banned WHERE id = p_user_id;
END; $$;

-- Delete a user's public profile + all their bets/predictions (cascade)
-- Note: the auth.users row stays — delete it manually in the Supabase dashboard
--       if you want to fully remove their login access.
CREATE OR REPLACE FUNCTION public.admin_delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  DELETE FROM public.users WHERE id = p_user_id;
END; $$;

-- grade_group_predictions: add admin guard (replace existing)
CREATE OR REPLACE FUNCTION public.grade_group_predictions(
  p_group_name   text,
  p_first_place  text,
  p_second_place text
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  UPDATE public.group_predictions
  SET
    points_earned =
      CASE WHEN first_place  = p_first_place  THEN 2 ELSE 0 END +
      CASE WHEN second_place = p_second_place THEN 1 ELSE 0 END,
    is_graded = true
  WHERE group_name = p_group_name;

  -- Propagate to users.total_points
  UPDATE public.users u
  SET total_points = (
    SELECT COALESCE(COUNT(*) FILTER (WHERE b.is_correct = true), 0)
    FROM public.bets b WHERE b.user_id = u.id
  ) + (
    SELECT COALESCE(SUM(gp.points_earned), 0)
    FROM public.group_predictions gp WHERE gp.user_id = u.id
  )
  WHERE u.id IN (
    SELECT user_id FROM public.group_predictions WHERE group_name = p_group_name
  );
END; $$;

-- ----------------------------------------------------------------
-- 6. SYNC LOG  (written by the Edge Function after each run)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sync_log (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at           timestamptz NOT NULL DEFAULT now(),
  matches_updated  integer     NOT NULL DEFAULT 0,
  status           text        NOT NULL DEFAULT 'success'
                     CHECK (status IN ('success', 'error')),
  message          text
);

ALTER TABLE public.sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_log_admin_only" ON public.sync_log
  FOR ALL USING (public.is_admin());

-- ----------------------------------------------------------------
-- 7. HOW TO SCHEDULE THE EDGE FUNCTION (pg_cron)
--
--  Step 1 — Enable pg_cron in the Supabase Dashboard:
--            Database → Extensions → search "pg_cron" → Enable
--
--  Step 2 — Enable pg_net (for HTTP calls from cron):
--            Database → Extensions → search "pg_net" → Enable
--
--  Step 3 — Store secrets in Supabase Vault (Dashboard → Vault):
--            edge_fn_url   = https://<project-ref>.supabase.co/functions/v1
--            edge_fn_token = <your service_role or anon JWT>
--
--  Step 4 — Run the schedule query below:
--
-- SELECT cron.schedule(
--   'sync-match-results',   -- job name
--   '0 * * * *',            -- every hour (use '*/30 * * * *' for every 30 min)
--   $$
--     SELECT net.http_post(
--       url     := (SELECT decrypted_secret FROM vault.decrypted_secrets
--                   WHERE name = 'edge_fn_url') || '/sync-results',
--       headers := jsonb_build_object(
--                    'Content-Type',  'application/json',
--                    'Authorization', 'Bearer ' ||
--                      (SELECT decrypted_secret FROM vault.decrypted_secrets
--                       WHERE name = 'edge_fn_token')
--                  ),
--       body    := '{"source":"cron"}'::jsonb
--     );
--   $$
-- );
--
--  To list scheduled jobs:  SELECT * FROM cron.job;
--  To remove the job:        SELECT cron.unschedule('sync-match-results');
-- ----------------------------------------------------------------
