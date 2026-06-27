-- ================================================================
-- schema_knockout_v2.sql
-- Full 32-match knockout skeleton + auto-advance + corrected scoring
-- Run in Supabase SQL Editor AFTER schema_brackets.sql
-- All statements are idempotent (safe to run multiple times).
-- ================================================================

-- ── 1. Add match_number column ──────────────────────────────────
ALTER TABLE public.knockout_bracket_matches
  ADD COLUMN IF NOT EXISTS match_number integer;

CREATE UNIQUE INDEX IF NOT EXISTS kbm_match_number_uidx
  ON public.knockout_bracket_matches (match_number)
  WHERE match_number IS NOT NULL;

-- ── 2. Seed 32-match skeleton ───────────────────────────────────
-- FIFA WC 2026 bracket structure (M73-M104).
-- R32 group sources are approximate per the December 2025 draw;
-- admin can update home_source / away_source in AdminBracketManager.
-- Third-place team slot eligibility (שלישיות) follows FIFA rules.
--
-- Cross-over (winner flows to):
--   M73→M90h, M74→M89h, M75→M90a, M76→M91h, M77→M89a, M78→M91a
--   M79→M92h, M80→M92a, M81→M94h, M82→M94a, M83→M93h, M84→M93a
--   M85→M96h, M86→M95h, M87→M96a, M88→M95a
--   M89→M97h, M90→M97a, M91→M99h, M92→M99a
--   M93→M98h, M94→M98a, M95→M100h, M96→M100a
--   M97→M101h, M98→M101a, M99→M102h, M100→M102a
--   M101→M104h + loser→M103h
--   M102→M104a + loser→M103a
-- ─────────────────────────────────────────────────────────────────

INSERT INTO public.knockout_bracket_matches
  (round, position, match_number, home_source, away_source, status)
VALUES
  -- ── ROUND OF 32 ─────────────────────────────────────────────
  ('round_of_32',  1,  73, 'מנצחת בית A',      'סגנית בית B',          'pending'),
  ('round_of_32',  2,  74, 'מנצחת בית C',      'שלישית E/F/G/H',       'pending'),
  ('round_of_32',  3,  75, 'מנצחת בית B',      'סגנית בית A',          'pending'),
  ('round_of_32',  4,  76, 'מנצחת בית D',      'סגנית בית C',          'pending'),
  ('round_of_32',  5,  77, 'מנצחת בית E',      'סגנית בית F',          'pending'),
  ('round_of_32',  6,  78, 'מנצחת בית G',      'שלישית I/J/K/L',       'pending'),
  ('round_of_32',  7,  79, 'מנצחת בית F',      'סגנית בית H',          'pending'),
  ('round_of_32',  8,  80, 'מנצחת בית H',      'שלישית A/B/C/D',       'pending'),
  ('round_of_32',  9,  81, 'מנצחת בית I',      'סגנית בית J',          'pending'),
  ('round_of_32', 10,  82, 'מנצחת בית K',      'שלישית B/C/E/F',       'pending'),
  ('round_of_32', 11,  83, 'מנצחת בית J',      'סגנית בית K',          'pending'),
  ('round_of_32', 12,  84, 'מנצחת בית L',      'סגנית בית I',          'pending'),
  ('round_of_32', 13,  85, 'סגנית בית D',      'שלישית G/H/I',         'pending'),
  ('round_of_32', 14,  86, 'סגנית בית G',      'שלישית A/D/K/L',       'pending'),
  ('round_of_32', 15,  87, 'סגנית בית L',      'שלישית A/E/J',         'pending'),
  ('round_of_32', 16,  88, 'סגנית בית E',      'שלישית C/F/J',         'pending'),
  -- ── ROUND OF 16 ──────────────────────────────────────────────
  ('round_of_16',  1,  89, 'מנצחת משחק 74',   'מנצחת משחק 77',        'pending'),
  ('round_of_16',  2,  90, 'מנצחת משחק 73',   'מנצחת משחק 75',        'pending'),
  ('round_of_16',  3,  91, 'מנצחת משחק 76',   'מנצחת משחק 78',        'pending'),
  ('round_of_16',  4,  92, 'מנצחת משחק 79',   'מנצחת משחק 80',        'pending'),
  ('round_of_16',  5,  93, 'מנצחת משחק 83',   'מנצחת משחק 84',        'pending'),
  ('round_of_16',  6,  94, 'מנצחת משחק 81',   'מנצחת משחק 82',        'pending'),
  ('round_of_16',  7,  95, 'מנצחת משחק 86',   'מנצחת משחק 88',        'pending'),
  ('round_of_16',  8,  96, 'מנצחת משחק 85',   'מנצחת משחק 87',        'pending'),
  -- ── QUARTER-FINALS ───────────────────────────────────────────
  ('quarter',      1,  97, 'מנצחת משחק 89',   'מנצחת משחק 90',        'pending'),
  ('quarter',      2,  98, 'מנצחת משחק 93',   'מנצחת משחק 94',        'pending'),
  ('quarter',      3,  99, 'מנצחת משחק 91',   'מנצחת משחק 92',        'pending'),
  ('quarter',      4, 100, 'מנצחת משחק 95',   'מנצחת משחק 96',        'pending'),
  -- ── SEMI-FINALS ──────────────────────────────────────────────
  ('semi',         1, 101, 'מנצחת משחק 97',   'מנצחת משחק 98',        'pending'),
  ('semi',         2, 102, 'מנצחת משחק 99',   'מנצחת משחק 100',       'pending'),
  -- ── THIRD PLACE ──────────────────────────────────────────────
  ('third_place',  1, 103, 'מפסידת משחק 101', 'מפסידת משחק 102',      'pending'),
  -- ── FINAL ────────────────────────────────────────────────────
  ('final',        1, 104, 'מנצחת משחק 101',  'מנצחת משחק 102',       'pending')
ON CONFLICT (round, position) DO NOTHING;

-- Backfill match_number for rows inserted before this migration
-- (safe to run even if no prior rows existed)
UPDATE public.knockout_bracket_matches SET match_number =  73 WHERE round='round_of_32'  AND position= 1 AND match_number IS NULL;
UPDATE public.knockout_bracket_matches SET match_number =  74 WHERE round='round_of_32'  AND position= 2 AND match_number IS NULL;
UPDATE public.knockout_bracket_matches SET match_number =  75 WHERE round='round_of_32'  AND position= 3 AND match_number IS NULL;
UPDATE public.knockout_bracket_matches SET match_number =  76 WHERE round='round_of_32'  AND position= 4 AND match_number IS NULL;
UPDATE public.knockout_bracket_matches SET match_number =  77 WHERE round='round_of_32'  AND position= 5 AND match_number IS NULL;
UPDATE public.knockout_bracket_matches SET match_number =  78 WHERE round='round_of_32'  AND position= 6 AND match_number IS NULL;
UPDATE public.knockout_bracket_matches SET match_number =  79 WHERE round='round_of_32'  AND position= 7 AND match_number IS NULL;
UPDATE public.knockout_bracket_matches SET match_number =  80 WHERE round='round_of_32'  AND position= 8 AND match_number IS NULL;
UPDATE public.knockout_bracket_matches SET match_number =  81 WHERE round='round_of_32'  AND position= 9 AND match_number IS NULL;
UPDATE public.knockout_bracket_matches SET match_number =  82 WHERE round='round_of_32'  AND position=10 AND match_number IS NULL;
UPDATE public.knockout_bracket_matches SET match_number =  83 WHERE round='round_of_32'  AND position=11 AND match_number IS NULL;
UPDATE public.knockout_bracket_matches SET match_number =  84 WHERE round='round_of_32'  AND position=12 AND match_number IS NULL;
UPDATE public.knockout_bracket_matches SET match_number =  85 WHERE round='round_of_32'  AND position=13 AND match_number IS NULL;
UPDATE public.knockout_bracket_matches SET match_number =  86 WHERE round='round_of_32'  AND position=14 AND match_number IS NULL;
UPDATE public.knockout_bracket_matches SET match_number =  87 WHERE round='round_of_32'  AND position=15 AND match_number IS NULL;
UPDATE public.knockout_bracket_matches SET match_number =  88 WHERE round='round_of_32'  AND position=16 AND match_number IS NULL;
UPDATE public.knockout_bracket_matches SET match_number =  89 WHERE round='round_of_16'  AND position= 1 AND match_number IS NULL;
UPDATE public.knockout_bracket_matches SET match_number =  90 WHERE round='round_of_16'  AND position= 2 AND match_number IS NULL;
UPDATE public.knockout_bracket_matches SET match_number =  91 WHERE round='round_of_16'  AND position= 3 AND match_number IS NULL;
UPDATE public.knockout_bracket_matches SET match_number =  92 WHERE round='round_of_16'  AND position= 4 AND match_number IS NULL;
UPDATE public.knockout_bracket_matches SET match_number =  93 WHERE round='round_of_16'  AND position= 5 AND match_number IS NULL;
UPDATE public.knockout_bracket_matches SET match_number =  94 WHERE round='round_of_16'  AND position= 6 AND match_number IS NULL;
UPDATE public.knockout_bracket_matches SET match_number =  95 WHERE round='round_of_16'  AND position= 7 AND match_number IS NULL;
UPDATE public.knockout_bracket_matches SET match_number =  96 WHERE round='round_of_16'  AND position= 8 AND match_number IS NULL;
UPDATE public.knockout_bracket_matches SET match_number =  97 WHERE round='quarter'      AND position= 1 AND match_number IS NULL;
UPDATE public.knockout_bracket_matches SET match_number =  98 WHERE round='quarter'      AND position= 2 AND match_number IS NULL;
UPDATE public.knockout_bracket_matches SET match_number =  99 WHERE round='quarter'      AND position= 3 AND match_number IS NULL;
UPDATE public.knockout_bracket_matches SET match_number = 100 WHERE round='quarter'      AND position= 4 AND match_number IS NULL;
UPDATE public.knockout_bracket_matches SET match_number = 101 WHERE round='semi'         AND position= 1 AND match_number IS NULL;
UPDATE public.knockout_bracket_matches SET match_number = 102 WHERE round='semi'         AND position= 2 AND match_number IS NULL;
UPDATE public.knockout_bracket_matches SET match_number = 103 WHERE round='third_place'  AND position= 1 AND match_number IS NULL;
UPDATE public.knockout_bracket_matches SET match_number = 104 WHERE round='final'        AND position= 1 AND match_number IS NULL;

-- ── 3. Fix scoring (correct points per round) ───────────────────
-- Old: R32=1, R16=2, QF=4, SF=8, Third=4, Final=16
-- New: R32=2, R16=3, QF=5, SF=8, Third=3, Final=12
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

  SELECT
    round,
    CASE WHEN result = 'home' THEN home_team ELSE away_team END
  INTO v_round, v_winner
  FROM public.knockout_bracket_matches
  WHERE id = p_bracket_match_id;

  v_pts := CASE v_round
    WHEN 'round_of_32' THEN  2
    WHEN 'round_of_16' THEN  3
    WHEN 'quarter'     THEN  5
    WHEN 'semi'        THEN  8
    WHEN 'third_place' THEN  3
    WHEN 'final'       THEN 12
    ELSE 2
  END;

  UPDATE public.knockout_predictions
  SET
    is_graded     = true,
    points_earned = CASE WHEN predicted_winner = v_winner THEN v_pts ELSE 0 END
  WHERE bracket_match_id = p_bracket_match_id;

  -- Recalculate total_points for all affected users
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
  )
  WHERE u.id IN (
    SELECT user_id FROM public.knockout_predictions
    WHERE bracket_match_id = p_bracket_match_id
  );
END;
$$;

-- ── 4. Updated admin_set_knockout_result: set result + auto-advance ──
-- Winner is automatically forwarded to the correct slot in the next match.
-- SF losers are forwarded to the third-place match (M103).
CREATE OR REPLACE FUNCTION public.admin_set_knockout_result(
  p_bracket_match_id uuid,
  p_result           text,       -- 'home' or 'away'
  p_home_score       integer     DEFAULT NULL,
  p_away_score       integer     DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match          record;
  v_winner         text;
  v_loser          text;
  v_next_win_mn    integer;
  v_next_win_slot  text;
  v_next_id        uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_result NOT IN ('home', 'away') THEN
    RAISE EXCEPTION 'knockout result must be: home | away';
  END IF;

  SELECT * INTO v_match
  FROM public.knockout_bracket_matches
  WHERE id = p_bracket_match_id;

  -- Persist result
  UPDATE public.knockout_bracket_matches
  SET  result     = p_result,
       status     = 'finished',
       home_score = p_home_score,
       away_score = p_away_score
  WHERE id = p_bracket_match_id;

  v_winner := CASE WHEN p_result = 'home' THEN v_match.home_team ELSE v_match.away_team END;
  v_loser  := CASE WHEN p_result = 'home' THEN v_match.away_team ELSE v_match.home_team END;

  -- Grade user predictions for this match
  PERFORM public.admin_grade_knockout_match(p_bracket_match_id);

  -- ── Winner auto-advance map ───────────────────────────────────
  -- Each entry: (current match_number) → (next match_number, home|away slot)
  v_next_win_mn := CASE v_match.match_number
    WHEN  73 THEN  90  WHEN  74 THEN  89  WHEN  75 THEN  90  WHEN  76 THEN  91
    WHEN  77 THEN  89  WHEN  78 THEN  91  WHEN  79 THEN  92  WHEN  80 THEN  92
    WHEN  81 THEN  94  WHEN  82 THEN  94  WHEN  83 THEN  93  WHEN  84 THEN  93
    WHEN  85 THEN  96  WHEN  86 THEN  95  WHEN  87 THEN  96  WHEN  88 THEN  95
    WHEN  89 THEN  97  WHEN  90 THEN  97  WHEN  91 THEN  99  WHEN  92 THEN  99
    WHEN  93 THEN  98  WHEN  94 THEN  98  WHEN  95 THEN 100  WHEN  96 THEN 100
    WHEN  97 THEN 101  WHEN  98 THEN 101  WHEN  99 THEN 102  WHEN 100 THEN 102
    WHEN 101 THEN 104  WHEN 102 THEN 104
    ELSE NULL
  END;

  v_next_win_slot := CASE v_match.match_number
    WHEN  73 THEN 'home'  WHEN  74 THEN 'home'  WHEN  75 THEN 'away'  WHEN  76 THEN 'home'
    WHEN  77 THEN 'away'  WHEN  78 THEN 'away'  WHEN  79 THEN 'home'  WHEN  80 THEN 'away'
    WHEN  81 THEN 'home'  WHEN  82 THEN 'away'  WHEN  83 THEN 'home'  WHEN  84 THEN 'away'
    WHEN  85 THEN 'home'  WHEN  86 THEN 'home'  WHEN  87 THEN 'away'  WHEN  88 THEN 'away'
    WHEN  89 THEN 'home'  WHEN  90 THEN 'away'  WHEN  91 THEN 'home'  WHEN  92 THEN 'away'
    WHEN  93 THEN 'home'  WHEN  94 THEN 'away'  WHEN  95 THEN 'home'  WHEN  96 THEN 'away'
    WHEN  97 THEN 'home'  WHEN  98 THEN 'away'  WHEN  99 THEN 'home'  WHEN 100 THEN 'away'
    WHEN 101 THEN 'home'  WHEN 102 THEN 'away'
    ELSE NULL
  END;

  -- Populate winner into next match
  IF v_next_win_mn IS NOT NULL AND v_winner IS NOT NULL THEN
    SELECT id INTO v_next_id
    FROM public.knockout_bracket_matches
    WHERE match_number = v_next_win_mn;

    IF v_next_id IS NOT NULL THEN
      IF v_next_win_slot = 'home' THEN
        UPDATE public.knockout_bracket_matches
        SET home_team = v_winner,
            status    = CASE WHEN away_team IS NOT NULL THEN 'upcoming' ELSE 'pending' END
        WHERE id = v_next_id;
      ELSE
        UPDATE public.knockout_bracket_matches
        SET away_team = v_winner,
            status    = CASE WHEN home_team IS NOT NULL THEN 'upcoming' ELSE 'pending' END
        WHERE id = v_next_id;
      END IF;
    END IF;
  END IF;

  -- SF losers → third-place match (M103)
  IF v_match.match_number IN (101, 102) AND v_loser IS NOT NULL THEN
    SELECT id INTO v_next_id
    FROM public.knockout_bracket_matches
    WHERE match_number = 103;

    IF v_next_id IS NOT NULL THEN
      IF v_match.match_number = 101 THEN
        UPDATE public.knockout_bracket_matches
        SET home_team = v_loser,
            status    = CASE WHEN away_team IS NOT NULL THEN 'upcoming' ELSE 'pending' END
        WHERE id = v_next_id;
      ELSE
        UPDATE public.knockout_bracket_matches
        SET away_team = v_loser,
            status    = CASE WHEN home_team IS NOT NULL THEN 'upcoming' ELSE 'pending' END
        WHERE id = v_next_id;
      END IF;
    END IF;
  END IF;
END;
$$;
