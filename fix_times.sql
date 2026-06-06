-- ================================================================
-- fix_times.sql  —  World Cup 2026 group-stage exact Israel times
--                   + per-match broadcast channel
--
-- Run in Supabase Dashboard → SQL Editor
--
-- RULES:
--   • All times are Israel LOCAL TIME stored with +03 offset.
--     PostgreSQL converts to UTC internally; the React frontend
--     reads back with timeZone:'Asia/Jerusalem' → shows same time.
--   • broadcast = 'כאן 11'  means   כאן 11 + כאן BOX
--   • broadcast = 'BOX'     means   כאן BOX + ספורט 1
--   • Each UPDATE sets home_team/away_team as well so it also fixes
--     any home/away swap from the previous fix_matches.sql.
-- ================================================================

-- Step 1: add broadcast column (safe to re-run)
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS broadcast text;

-- ─────────────────────────────────────────────────────────────────
-- בית א
-- ─────────────────────────────────────────────────────────────────
UPDATE public.matches SET home_team='מקסיקו',         away_team='דרום אפריקה',      match_date=TIMESTAMPTZ '2026-06-11 22:00:00+03', broadcast='כאן 11'
 WHERE (home_team='מקסיקו'         AND away_team='דרום אפריקה')     OR (home_team='דרום אפריקה'     AND away_team='מקסיקו');

UPDATE public.matches SET home_team='קוריאה הדרומית', away_team='צ''כיה',           match_date=TIMESTAMPTZ '2026-06-12 05:00:00+03', broadcast='כאן 11'
 WHERE (home_team='קוריאה הדרומית' AND away_team='צ''כיה')          OR (home_team='צ''כיה'          AND away_team='קוריאה הדרומית');

UPDATE public.matches SET home_team='צ''כיה',          away_team='דרום אפריקה',      match_date=TIMESTAMPTZ '2026-06-18 19:00:00+03', broadcast='כאן 11'
 WHERE (home_team='צ''כיה'          AND away_team='דרום אפריקה')     OR (home_team='דרום אפריקה'     AND away_team='צ''כיה');

UPDATE public.matches SET home_team='מקסיקו',         away_team='קוריאה הדרומית',   match_date=TIMESTAMPTZ '2026-06-19 04:00:00+03', broadcast='BOX'
 WHERE (home_team='מקסיקו'         AND away_team='קוריאה הדרומית')  OR (home_team='קוריאה הדרומית'  AND away_team='מקסיקו');

UPDATE public.matches SET home_team='צ''כיה',          away_team='מקסיקו',           match_date=TIMESTAMPTZ '2026-06-25 04:00:00+03', broadcast='BOX'
 WHERE (home_team='צ''כיה'          AND away_team='מקסיקו')          OR (home_team='מקסיקו'          AND away_team='צ''כיה');

UPDATE public.matches SET home_team='דרום אפריקה',    away_team='קוריאה הדרומית',   match_date=TIMESTAMPTZ '2026-06-25 04:00:00+03', broadcast='BOX'
 WHERE (home_team='דרום אפריקה'    AND away_team='קוריאה הדרומית')  OR (home_team='קוריאה הדרומית'  AND away_team='דרום אפריקה');

-- ─────────────────────────────────────────────────────────────────
-- בית ב
-- ─────────────────────────────────────────────────────────────────
UPDATE public.matches SET home_team='קנדה',            away_team='בוסניה והרצגובינה', match_date=TIMESTAMPTZ '2026-06-12 22:00:00+03', broadcast='כאן 11'
 WHERE (home_team='קנדה'            AND away_team='בוסניה והרצגובינה') OR (home_team='בוסניה והרצגובינה' AND away_team='קנדה');

UPDATE public.matches SET home_team='קטר',             away_team='שוויץ',             match_date=TIMESTAMPTZ '2026-06-13 22:00:00+03', broadcast='כאן 11'
 WHERE (home_team='קטר'             AND away_team='שוויץ')             OR (home_team='שוויץ'             AND away_team='קטר');

UPDATE public.matches SET home_team='שוויץ',           away_team='בוסניה והרצגובינה', match_date=TIMESTAMPTZ '2026-06-18 22:00:00+03', broadcast='כאן 11'
 WHERE (home_team='שוויץ'           AND away_team='בוסניה והרצגובינה') OR (home_team='בוסניה והרצגובינה' AND away_team='שוויץ');

UPDATE public.matches SET home_team='קנדה',            away_team='קטר',               match_date=TIMESTAMPTZ '2026-06-19 01:00:00+03', broadcast='BOX'
 WHERE (home_team='קנדה'            AND away_team='קטר')               OR (home_team='קטר'               AND away_team='קנדה');

UPDATE public.matches SET home_team='שוויץ',           away_team='קנדה',              match_date=TIMESTAMPTZ '2026-06-24 22:00:00+03', broadcast='כאן 11'
 WHERE (home_team='שוויץ'           AND away_team='קנדה')              OR (home_team='קנדה'              AND away_team='שוויץ');

UPDATE public.matches SET home_team='בוסניה והרצגובינה', away_team='קטר',             match_date=TIMESTAMPTZ '2026-06-24 22:00:00+03', broadcast='BOX'
 WHERE (home_team='בוסניה והרצגובינה' AND away_team='קטר')             OR (home_team='קטר'               AND away_team='בוסניה והרצגובינה');

-- ─────────────────────────────────────────────────────────────────
-- בית ג
-- ─────────────────────────────────────────────────────────────────
UPDATE public.matches SET home_team='ברזיל',           away_team='מרוקו',             match_date=TIMESTAMPTZ '2026-06-14 01:00:00+03', broadcast='כאן 11'
 WHERE (home_team='ברזיל'           AND away_team='מרוקו')             OR (home_team='מרוקו'             AND away_team='ברזיל');

UPDATE public.matches SET home_team='האיטי',           away_team='סקוטלנד',           match_date=TIMESTAMPTZ '2026-06-14 04:00:00+03', broadcast='BOX'
 WHERE (home_team='האיטי'           AND away_team='סקוטלנד')           OR (home_team='סקוטלנד'           AND away_team='האיטי');

UPDATE public.matches SET home_team='סקוטלנד',         away_team='מרוקו',             match_date=TIMESTAMPTZ '2026-06-20 01:00:00+03', broadcast='BOX'
 WHERE (home_team='סקוטלנד'         AND away_team='מרוקו')             OR (home_team='מרוקו'             AND away_team='סקוטלנד');

UPDATE public.matches SET home_team='ברזיל',           away_team='האיטי',             match_date=TIMESTAMPTZ '2026-06-20 03:00:00+03', broadcast='BOX'
 WHERE (home_team='ברזיל'           AND away_team='האיטי')             OR (home_team='האיטי'             AND away_team='ברזיל');

UPDATE public.matches SET home_team='סקוטלנד',         away_team='ברזיל',             match_date=TIMESTAMPTZ '2026-06-25 01:00:00+03', broadcast='כאן 11'
 WHERE (home_team='סקוטלנד'         AND away_team='ברזיל')             OR (home_team='ברזיל'             AND away_team='סקוטלנד');

UPDATE public.matches SET home_team='מרוקו',           away_team='האיטי',             match_date=TIMESTAMPTZ '2026-06-25 01:00:00+03', broadcast='BOX'
 WHERE (home_team='מרוקו'           AND away_team='האיטי')             OR (home_team='האיטי'             AND away_team='מרוקו');

-- ─────────────────────────────────────────────────────────────────
-- בית ד
-- ─────────────────────────────────────────────────────────────────
UPDATE public.matches SET home_team='ארצות הברית',    away_team='פרגוואי',           match_date=TIMESTAMPTZ '2026-06-13 04:00:00+03', broadcast='BOX'
 WHERE (home_team='ארצות הברית'    AND away_team='פרגוואי')           OR (home_team='פרגוואי'           AND away_team='ארצות הברית');

UPDATE public.matches SET home_team='אוסטרליה',        away_team='טורקיה',            match_date=TIMESTAMPTZ '2026-06-13 07:00:00+03', broadcast='BOX'
 WHERE (home_team='אוסטרליה'        AND away_team='טורקיה')            OR (home_team='טורקיה'            AND away_team='אוסטרליה');

UPDATE public.matches SET home_team='טורקיה',          away_team='פרגוואי',           match_date=TIMESTAMPTZ '2026-06-19 07:00:00+03', broadcast='BOX'
 WHERE (home_team='טורקיה'          AND away_team='פרגוואי')           OR (home_team='פרגוואי'           AND away_team='טורקיה');

UPDATE public.matches SET home_team='ארצות הברית',    away_team='אוסטרליה',          match_date=TIMESTAMPTZ '2026-06-19 22:00:00+03', broadcast='כאן 11'
 WHERE (home_team='ארצות הברית'    AND away_team='אוסטרליה')          OR (home_team='אוסטרליה'          AND away_team='ארצות הברית');

UPDATE public.matches SET home_team='טורקיה',          away_team='ארצות הברית',       match_date=TIMESTAMPTZ '2026-06-26 05:00:00+03', broadcast='BOX'
 WHERE (home_team='טורקיה'          AND away_team='ארצות הברית')       OR (home_team='ארצות הברית'       AND away_team='טורקיה');

UPDATE public.matches SET home_team='פרגוואי',         away_team='אוסטרליה',          match_date=TIMESTAMPTZ '2026-06-26 05:00:00+03', broadcast='BOX'
 WHERE (home_team='פרגוואי'         AND away_team='אוסטרליה')          OR (home_team='אוסטרליה'          AND away_team='פרגוואי');

-- ─────────────────────────────────────────────────────────────────
-- בית ה
-- ─────────────────────────────────────────────────────────────────
UPDATE public.matches SET home_team='גרמניה',          away_team='קוראסאו',           match_date=TIMESTAMPTZ '2026-06-14 20:00:00+03', broadcast='כאן 11'
 WHERE (home_team='גרמניה'          AND away_team='קוראסאו')           OR (home_team='קוראסאו'           AND away_team='גרמניה');

UPDATE public.matches SET home_team='חוף השנהב',       away_team='אקוודור',           match_date=TIMESTAMPTZ '2026-06-15 02:00:00+03', broadcast='BOX'
 WHERE (home_team='חוף השנהב'       AND away_team='אקוודור')           OR (home_team='אקוודור'           AND away_team='חוף השנהב');

UPDATE public.matches SET home_team='גרמניה',          away_team='חוף השנהב',         match_date=TIMESTAMPTZ '2026-06-20 23:00:00+03', broadcast='כאן 11'
 WHERE (home_team='גרמניה'          AND away_team='חוף השנהב')         OR (home_team='חוף השנהב'         AND away_team='גרמניה');

UPDATE public.matches SET home_team='אקוודור',         away_team='קוראסאו',           match_date=TIMESTAMPTZ '2026-06-21 03:00:00+03', broadcast='BOX'
 WHERE (home_team='אקוודור'         AND away_team='קוראסאו')           OR (home_team='קוראסאו'           AND away_team='אקוודור');

UPDATE public.matches SET home_team='אקוודור',         away_team='גרמניה',            match_date=TIMESTAMPTZ '2026-06-25 23:00:00+03', broadcast='כאן 11'
 WHERE (home_team='אקוודור'         AND away_team='גרמניה')            OR (home_team='גרמניה'            AND away_team='אקוודור');

UPDATE public.matches SET home_team='קוראסאו',         away_team='חוף השנהב',         match_date=TIMESTAMPTZ '2026-06-25 23:00:00+03', broadcast='BOX'
 WHERE (home_team='קוראסאו'         AND away_team='חוף השנהב')         OR (home_team='חוף השנהב'         AND away_team='קוראסאו');

-- ─────────────────────────────────────────────────────────────────
-- בית ו
-- ─────────────────────────────────────────────────────────────────
UPDATE public.matches SET home_team='הולנד',           away_team='יפן',               match_date=TIMESTAMPTZ '2026-06-14 23:00:00+03', broadcast='כאן 11'
 WHERE (home_team='הולנד'           AND away_team='יפן')               OR (home_team='יפן'               AND away_team='הולנד');

UPDATE public.matches SET home_team='שוודיה',          away_team='תוניסיה',           match_date=TIMESTAMPTZ '2026-06-15 05:00:00+03', broadcast='BOX'
 WHERE (home_team='שוודיה'          AND away_team='תוניסיה')           OR (home_team='תוניסיה'           AND away_team='שוודיה');

UPDATE public.matches SET home_team='תוניסיה',         away_team='יפן',               match_date=TIMESTAMPTZ '2026-06-20 07:00:00+03', broadcast='BOX'
 WHERE (home_team='תוניסיה'         AND away_team='יפן')               OR (home_team='יפן'               AND away_team='תוניסיה');

UPDATE public.matches SET home_team='הולנד',           away_team='שוודיה',            match_date=TIMESTAMPTZ '2026-06-20 20:00:00+03', broadcast='כאן 11'
 WHERE (home_team='הולנד'           AND away_team='שוודיה')            OR (home_team='שוודיה'            AND away_team='הולנד');

UPDATE public.matches SET home_team='תוניסיה',         away_team='הולנד',             match_date=TIMESTAMPTZ '2026-06-26 02:00:00+03', broadcast='BOX'
 WHERE (home_team='תוניסיה'         AND away_team='הולנד')             OR (home_team='הולנד'             AND away_team='תוניסיה');

UPDATE public.matches SET home_team='יפן',             away_team='שוודיה',            match_date=TIMESTAMPTZ '2026-06-26 02:00:00+03', broadcast='BOX'
 WHERE (home_team='יפן'             AND away_team='שוודיה')            OR (home_team='שוודיה'            AND away_team='יפן');

-- ─────────────────────────────────────────────────────────────────
-- בית ז
-- ─────────────────────────────────────────────────────────────────
UPDATE public.matches SET home_team='בלגיה',           away_team='מצרים',             match_date=TIMESTAMPTZ '2026-06-15 22:00:00+03', broadcast='כאן 11'
 WHERE (home_team='בלגיה'           AND away_team='מצרים')             OR (home_team='מצרים'             AND away_team='בלגיה');

UPDATE public.matches SET home_team='איראן',           away_team='ניו זילנד',         match_date=TIMESTAMPTZ '2026-06-16 04:00:00+03', broadcast='BOX'
 WHERE (home_team='איראן'           AND away_team='ניו זילנד')         OR (home_team='ניו זילנד'         AND away_team='איראן');

UPDATE public.matches SET home_team='בלגיה',           away_team='איראן',             match_date=TIMESTAMPTZ '2026-06-21 22:00:00+03', broadcast='כאן 11'
 WHERE (home_team='בלגיה'           AND away_team='איראן')             OR (home_team='איראן'             AND away_team='בלגיה');

UPDATE public.matches SET home_team='ניו זילנד',       away_team='מצרים',             match_date=TIMESTAMPTZ '2026-06-22 04:00:00+03', broadcast='BOX'
 WHERE (home_team='ניו זילנד'       AND away_team='מצרים')             OR (home_team='מצרים'             AND away_team='ניו זילנד');

UPDATE public.matches SET home_team='ניו זילנד',       away_team='בלגיה',             match_date=TIMESTAMPTZ '2026-06-27 06:00:00+03', broadcast='BOX'
 WHERE (home_team='ניו זילנד'       AND away_team='בלגיה')             OR (home_team='בלגיה'             AND away_team='ניו זילנד');

UPDATE public.matches SET home_team='מצרים',           away_team='איראן',             match_date=TIMESTAMPTZ '2026-06-27 06:00:00+03', broadcast='BOX'
 WHERE (home_team='מצרים'           AND away_team='איראן')             OR (home_team='איראן'             AND away_team='מצרים');

-- ─────────────────────────────────────────────────────────────────
-- בית ח
-- ─────────────────────────────────────────────────────────────────
UPDATE public.matches SET home_team='ספרד',            away_team='כף ורדה',           match_date=TIMESTAMPTZ '2026-06-15 19:00:00+03', broadcast='כאן 11'
 WHERE (home_team='ספרד'            AND away_team='כף ורדה')           OR (home_team='כף ורדה'           AND away_team='ספרד');

UPDATE public.matches SET home_team='סעודיה',          away_team='אורוגוואי',         match_date=TIMESTAMPTZ '2026-06-16 01:00:00+03', broadcast='BOX'
 WHERE (home_team='סעודיה'          AND away_team='אורוגוואי')         OR (home_team='אורוגוואי'         AND away_team='סעודיה');

UPDATE public.matches SET home_team='ספרד',            away_team='סעודיה',            match_date=TIMESTAMPTZ '2026-06-21 19:00:00+03', broadcast='כאן 11'
 WHERE (home_team='ספרד'            AND away_team='סעודיה')            OR (home_team='סעודיה'            AND away_team='ספרד');

UPDATE public.matches SET home_team='אורוגוואי',       away_team='כף ורדה',           match_date=TIMESTAMPTZ '2026-06-22 01:00:00+03', broadcast='BOX'
 WHERE (home_team='אורוגוואי'       AND away_team='כף ורדה')           OR (home_team='כף ורדה'           AND away_team='אורוגוואי');

UPDATE public.matches SET home_team='אורוגוואי',       away_team='ספרד',              match_date=TIMESTAMPTZ '2026-06-27 03:00:00+03', broadcast='כאן 11'
 WHERE (home_team='אורוגוואי'       AND away_team='ספרד')              OR (home_team='ספרד'              AND away_team='אורוגוואי');

UPDATE public.matches SET home_team='כף ורדה',         away_team='סעודיה',            match_date=TIMESTAMPTZ '2026-06-27 03:00:00+03', broadcast='BOX'
 WHERE (home_team='כף ורדה'         AND away_team='סעודיה')            OR (home_team='סעודיה'            AND away_team='כף ורדה');

-- ─────────────────────────────────────────────────────────────────
-- בית ט
-- ─────────────────────────────────────────────────────────────────
UPDATE public.matches SET home_team='צרפת',            away_team='סנגל',              match_date=TIMESTAMPTZ '2026-06-16 22:00:00+03', broadcast='כאן 11'
 WHERE (home_team='צרפת'            AND away_team='סנגל')              OR (home_team='סנגל'              AND away_team='צרפת');

UPDATE public.matches SET home_team='עיראק',           away_team='נורווגיה',          match_date=TIMESTAMPTZ '2026-06-17 01:00:00+03', broadcast='BOX'
 WHERE (home_team='עיראק'           AND away_team='נורווגיה')          OR (home_team='נורווגיה'          AND away_team='עיראק');

UPDATE public.matches SET home_team='צרפת',            away_team='עיראק',             match_date=TIMESTAMPTZ '2026-06-23 00:00:00+03', broadcast='כאן 11'
 WHERE (home_team='צרפת'            AND away_team='עיראק')             OR (home_team='עיראק'             AND away_team='צרפת');

UPDATE public.matches SET home_team='נורווגיה',        away_team='סנגל',              match_date=TIMESTAMPTZ '2026-06-23 03:00:00+03', broadcast='BOX'
 WHERE (home_team='נורווגיה'        AND away_team='סנגל')              OR (home_team='סנגל'              AND away_team='נורווגיה');

UPDATE public.matches SET home_team='נורווגיה',        away_team='צרפת',              match_date=TIMESTAMPTZ '2026-06-26 22:00:00+03', broadcast='כאן 11'
 WHERE (home_team='נורווגיה'        AND away_team='צרפת')              OR (home_team='צרפת'              AND away_team='נורווגיה');

UPDATE public.matches SET home_team='סנגל',            away_team='עיראק',             match_date=TIMESTAMPTZ '2026-06-26 22:00:00+03', broadcast='BOX'
 WHERE (home_team='סנגל'            AND away_team='עיראק')             OR (home_team='עיראק'             AND away_team='סנגל');

-- ─────────────────────────────────────────────────────────────────
-- בית י
-- ─────────────────────────────────────────────────────────────────
UPDATE public.matches SET home_team='אוסטריה',         away_team='ירדן',              match_date=TIMESTAMPTZ '2026-06-16 19:00:00+03', broadcast='BOX'
 WHERE (home_team='אוסטריה'         AND away_team='ירדן')              OR (home_team='ירדן'              AND away_team='אוסטריה');

UPDATE public.matches SET home_team='ארגנטינה',        away_team='אלג''יריה',          match_date=TIMESTAMPTZ '2026-06-17 04:00:00+03', broadcast='כאן 11'
 WHERE (home_team='ארגנטינה'        AND away_team='אלג''יריה')          OR (home_team='אלג''יריה'          AND away_team='ארגנטינה');

UPDATE public.matches SET home_team='ארגנטינה',        away_team='אוסטריה',           match_date=TIMESTAMPTZ '2026-06-22 20:00:00+03', broadcast='כאן 11'
 WHERE (home_team='ארגנטינה'        AND away_team='אוסטריה')           OR (home_team='אוסטריה'           AND away_team='ארגנטינה');

UPDATE public.matches SET home_team='ירדן',            away_team='אלג''יריה',          match_date=TIMESTAMPTZ '2026-06-23 06:00:00+03', broadcast='BOX'
 WHERE (home_team='ירדן'            AND away_team='אלג''יריה')          OR (home_team='אלג''יריה'          AND away_team='ירדן');

UPDATE public.matches SET home_team='ירדן',            away_team='ארגנטינה',          match_date=TIMESTAMPTZ '2026-06-28 05:00:00+03', broadcast='כאן 11'
 WHERE (home_team='ירדן'            AND away_team='ארגנטינה')          OR (home_team='ארגנטינה'          AND away_team='ירדן');

UPDATE public.matches SET home_team='אלג''יריה',        away_team='אוסטריה',           match_date=TIMESTAMPTZ '2026-06-28 05:00:00+03', broadcast='BOX'
 WHERE (home_team='אלג''יריה'        AND away_team='אוסטריה')           OR (home_team='אוסטריה'           AND away_team='אלג''יריה');

-- ─────────────────────────────────────────────────────────────────
-- בית יא
-- ─────────────────────────────────────────────────────────────────
UPDATE public.matches SET home_team='פורטוגל',         away_team='קונגו הדמוקרטית',  match_date=TIMESTAMPTZ '2026-06-17 20:00:00+03', broadcast='כאן 11'
 WHERE (home_team='פורטוגל'         AND away_team='קונגו הדמוקרטית')  OR (home_team='קונגו הדמוקרטית'  AND away_team='פורטוגל');

UPDATE public.matches SET home_team='אוזבקיסטן',      away_team='קולומביה',          match_date=TIMESTAMPTZ '2026-06-18 05:00:00+03', broadcast='BOX'
 WHERE (home_team='אוזבקיסטן'      AND away_team='קולומביה')          OR (home_team='קולומביה'          AND away_team='אוזבקיסטן');

UPDATE public.matches SET home_team='פורטוגל',         away_team='אוזבקיסטן',        match_date=TIMESTAMPTZ '2026-06-23 20:00:00+03', broadcast='כאן 11'
 WHERE (home_team='פורטוגל'         AND away_team='אוזבקיסטן')        OR (home_team='אוזבקיסטן'        AND away_team='פורטוגל');

UPDATE public.matches SET home_team='קולומביה',        away_team='קונגו הדמוקרטית',  match_date=TIMESTAMPTZ '2026-06-24 05:00:00+03', broadcast='BOX'
 WHERE (home_team='קולומביה'        AND away_team='קונגו הדמוקרטית')  OR (home_team='קונגו הדמוקרטית'  AND away_team='קולומביה');

UPDATE public.matches SET home_team='קולומביה',        away_team='פורטוגל',           match_date=TIMESTAMPTZ '2026-06-28 02:30:00+03', broadcast='כאן 11'
 WHERE (home_team='קולומביה'        AND away_team='פורטוגל')           OR (home_team='פורטוגל'           AND away_team='קולומביה');

UPDATE public.matches SET home_team='קונגו הדמוקרטית', away_team='אוזבקיסטן',        match_date=TIMESTAMPTZ '2026-06-28 02:30:00+03', broadcast='BOX'
 WHERE (home_team='קונגו הדמוקרטית' AND away_team='אוזבקיסטן')        OR (home_team='אוזבקיסטן'        AND away_team='קונגו הדמוקרטית');

-- ─────────────────────────────────────────────────────────────────
-- בית יב
-- ─────────────────────────────────────────────────────────────────
UPDATE public.matches SET home_team='אנגליה',          away_team='קרואטיה',           match_date=TIMESTAMPTZ '2026-06-17 23:00:00+03', broadcast='כאן 11'
 WHERE (home_team='אנגליה'          AND away_team='קרואטיה')           OR (home_team='קרואטיה'           AND away_team='אנגליה');

UPDATE public.matches SET home_team='גאנה',            away_team='פנמה',              match_date=TIMESTAMPTZ '2026-06-18 02:00:00+03', broadcast='BOX'
 WHERE (home_team='גאנה'            AND away_team='פנמה')              OR (home_team='פנמה'              AND away_team='גאנה');

UPDATE public.matches SET home_team='אנגליה',          away_team='גאנה',              match_date=TIMESTAMPTZ '2026-06-23 23:00:00+03', broadcast='כאן 11'
 WHERE (home_team='אנגליה'          AND away_team='גאנה')              OR (home_team='גאנה'              AND away_team='אנגליה');

UPDATE public.matches SET home_team='פנמה',            away_team='קרואטיה',           match_date=TIMESTAMPTZ '2026-06-24 02:00:00+03', broadcast='BOX'
 WHERE (home_team='פנמה'            AND away_team='קרואטיה')           OR (home_team='קרואטיה'           AND away_team='פנמה');

UPDATE public.matches SET home_team='פנמה',            away_team='אנגליה',            match_date=TIMESTAMPTZ '2026-06-28 00:00:00+03', broadcast='כאן 11'
 WHERE (home_team='פנמה'            AND away_team='אנגליה')            OR (home_team='אנגליה'            AND away_team='פנמה');

UPDATE public.matches SET home_team='קרואטיה',         away_team='גאנה',              match_date=TIMESTAMPTZ '2026-06-28 00:00:00+03', broadcast='BOX'
 WHERE (home_team='קרואטיה'         AND away_team='גאנה')              OR (home_team='גאנה'             AND away_team='קרואטיה');

-- ── Verify count (should return 72) ──────────────────────────────
SELECT COUNT(*) AS total_group_matches_updated
FROM public.matches
WHERE group_name IS NOT NULL AND broadcast IS NOT NULL;
