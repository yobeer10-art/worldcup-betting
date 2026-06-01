-- ================================================================
-- World Cup 2026 — Group Predictions Table
-- Run this in Supabase → SQL Editor AFTER schema.sql
-- ================================================================

create table public.group_predictions (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references auth.users(id) on delete cascade,
  group_name    text        not null,
  first_place   text        not null,
  second_place  text        not null,
  points_earned integer     not null default 0,
  is_graded     boolean     not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, group_name)
);

-- ── RLS ───────────────────────────────────────────────────────────

alter table public.group_predictions enable row level security;

-- Users manage their own predictions
create policy "group_preds_all_own"
  on public.group_predictions
  for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Everyone can READ all predictions (needed for leaderboard)
create policy "group_preds_select_all"
  on public.group_predictions
  for select
  using (true);

-- ── updated_at trigger ────────────────────────────────────────────

create or replace function public.touch_group_prediction_updated_at()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_group_prediction_updated
  before update on public.group_predictions
  for each row execute function public.touch_group_prediction_updated_at();

-- ================================================================
-- ADMIN FUNCTION: grade group predictions once the group is final
--
--   select grade_group_predictions('א', 'מקסיקו', 'קוריאה הדרומית');
--
--   Scoring: +2 if first_place correct, +1 if second_place correct
-- ================================================================

create or replace function public.grade_group_predictions(
  p_group_name   text,
  p_first_place  text,
  p_second_place text
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.group_predictions
  set
    points_earned =
      case when first_place  = p_first_place  then 2 else 0 end +
      case when second_place = p_second_place then 1 else 0 end,
    is_graded = true
  where group_name = p_group_name;

  -- Propagate earned points into users.total_points
  update public.users u
  set total_points = (
    -- match bet points
    select coalesce(count(*) filter (where b.is_correct = true), 0)
    from public.bets b
    where b.user_id = u.id
  ) + (
    -- group prediction points
    select coalesce(sum(gp.points_earned), 0)
    from public.group_predictions gp
    where gp.user_id = u.id
  )
  where u.id in (
    select user_id from public.group_predictions
    where group_name = p_group_name
  );
end;
$$;
