create table if not exists public.moodtok_users (
  id text primary key,
  username text not null unique,
  data jsonb not null
);

create table if not exists public.moodtok_checkins (
  id text primary key,
  student_id text not null references public.moodtok_users (id) on delete cascade,
  date timestamptz not null,
  data jsonb not null
);

create table if not exists public.moodtok_surveys (
  id text primary key,
  student_id text not null references public.moodtok_users (id) on delete cascade,
  date timestamptz not null,
  data jsonb not null
);

create index if not exists moodtok_checkins_student_date_idx
  on public.moodtok_checkins (student_id, date desc);

create index if not exists moodtok_surveys_student_date_idx
  on public.moodtok_surveys (student_id, date desc);

alter table public.moodtok_users enable row level security;
alter table public.moodtok_checkins enable row level security;
alter table public.moodtok_surveys enable row level security;

revoke all on public.moodtok_users, public.moodtok_checkins, public.moodtok_surveys
  from anon, authenticated;
grant all on public.moodtok_users, public.moodtok_checkins, public.moodtok_surveys
  to service_role;
