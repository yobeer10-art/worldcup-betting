-- ================================================================
-- World Cup 2026 Betting App — Supabase SQL Schema
-- Paste into Supabase → SQL Editor and run in order
-- ================================================================

-- ----------------------------------------------------------------
-- 1. TABLES
-- ----------------------------------------------------------------

create table public.users (
  id            uuid        primary key references auth.users(id) on delete cascade,
  email         text        not null,
  display_name  text        not null default '',
  total_points  integer     not null default 0,
  created_at    timestamptz not null default now()
);

create table public.matches (
  id          uuid        primary key default gen_random_uuid(),
  home_team   text        not null,
  away_team   text        not null,
  match_date  timestamptz not null,
  status      text        not null default 'upcoming'
                check (status in ('upcoming', 'live', 'finished')),
  result      text
                check (result in ('home', 'draw', 'away') or result is null),
  home_score  integer,
  away_score  integer,
  group_name  text,
  stage       text        not null default 'group'
                check (stage in ('group','round_of_32','round_of_16','quarter','semi','third_place','final')),
  created_at  timestamptz not null default now()
);

create table public.bets (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references public.users(id)   on delete cascade,
  match_id    uuid        not null references public.matches(id) on delete cascade,
  prediction  text        not null check (prediction in ('home', 'draw', 'away')),
  is_correct  boolean,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, match_id)
);

-- ----------------------------------------------------------------
-- 2. ROW LEVEL SECURITY
-- ----------------------------------------------------------------

alter table public.users   enable row level security;
alter table public.matches enable row level security;
alter table public.bets    enable row level security;

-- users: anyone can read; only own row is writable
create policy "users_select_all"  on public.users for select using (true);
create policy "users_insert_own"  on public.users for insert with check (auth.uid() = id);
create policy "users_update_own"  on public.users for update using (auth.uid() = id);

-- matches: public read, admin-only writes (via service role key)
create policy "matches_select_all" on public.matches for select using (true);

-- bets: all can read; users manage only their own rows
create policy "bets_select_all"  on public.bets for select using (true);
create policy "bets_insert_own"  on public.bets for insert with check (auth.uid() = user_id);
create policy "bets_update_own"  on public.bets for update using (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- 3. TRIGGER: auto-create user profile on sign-up
-- ----------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.users (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------
-- 4. TRIGGER: recalculate total_points when a bet is graded
-- ----------------------------------------------------------------

create or replace function public.recalculate_user_points()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.users
  set total_points = (
    select count(*)
    from   public.bets
    where  user_id    = new.user_id
      and  is_correct = true
  )
  where id = new.user_id;
  return new;
end;
$$;

create trigger on_bet_graded
  after update of is_correct on public.bets
  for each row
  when (old.is_correct is distinct from new.is_correct)
  execute function public.recalculate_user_points();

-- ----------------------------------------------------------------
-- 5. ADMIN FUNCTION: set match result and grade all bets
--
--    Call from Supabase SQL Editor or a trusted server:
--    select set_match_result('<match_uuid>', 'home', 2, 1);
-- ----------------------------------------------------------------

create or replace function public.set_match_result(
  p_match_id   uuid,
  p_result     text,
  p_home_score integer default null,
  p_away_score integer default null
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_result not in ('home', 'draw', 'away') then
    raise exception 'result must be home | draw | away';
  end if;

  update public.matches
  set    result     = p_result,
         status     = 'finished',
         home_score = p_home_score,
         away_score = p_away_score
  where  id = p_match_id;

  -- Grade every bet for this match (triggers recalculate_user_points)
  update public.bets
  set    is_correct = (prediction = p_result)
  where  match_id = p_match_id;
end;
$$;

-- ----------------------------------------------------------------
-- 6. SAMPLE MATCHES  (edit dates/teams as needed)
-- ----------------------------------------------------------------

insert into public.matches (home_team, away_team, match_date, status, group_name, stage) values
  ('מקסיקו',    'קנדה',      '2026-06-11 22:00:00+00', 'upcoming', 'א', 'group'),
  ('ארצות הברית','ספרד',     '2026-06-12 01:00:00+00', 'upcoming', 'א', 'group'),
  ('ברזיל',     'ארגנטינה',  '2026-06-13 21:00:00+00', 'upcoming', 'ב', 'group'),
  ('גרמניה',    'צרפת',      '2026-06-14 18:00:00+00', 'upcoming', 'ג', 'group'),
  ('אנגליה',    'פורטוגל',   '2026-06-15 21:00:00+00', 'upcoming', 'ד', 'group'),
  ('הולנד',     'בלגיה',     '2026-06-16 19:00:00+00', 'upcoming', 'ה', 'group'),
  ('יפן',       'קוריאה הדרומית','2026-06-17 13:00:00+00','upcoming','ו','group'),
  ('מרוקו',     'סנגל',      '2026-06-18 16:00:00+00', 'upcoming', 'ז', 'group');
