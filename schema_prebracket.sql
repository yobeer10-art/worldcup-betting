-- ================================================================
-- schema_prebracket.sql
-- Run in Supabase Dashboard → SQL Editor
--
-- Creates the pre_bracket_picks table used by the
-- "הימורים מקדימים → ברקט מקדים" section.
-- Each row = one user's pick for one match in the pre-tournament bracket.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.pre_bracket_picks (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  round      text        NOT NULL
                         CHECK (round IN ('r32','r16','qf','semi','final')),
  match_num  smallint    NOT NULL,          -- 1-16 for r32, 1-8 for r16, etc.
  team       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id, round, match_num)        -- one pick per match per user
);

ALTER TABLE public.pre_bracket_picks ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own picks
DROP POLICY IF EXISTS "pre_bracket_own" ON public.pre_bracket_picks;
CREATE POLICY "pre_bracket_own" ON public.pre_bracket_picks
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
