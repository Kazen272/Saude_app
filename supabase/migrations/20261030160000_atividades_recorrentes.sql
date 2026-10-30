-- Atividades físicas recorrentes (ex.: Muay Thai ter e qui 19h) e o registro de cada dia.
create table public.recurring_activities (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  activity text not null check (char_length(activity) between 1 and 40),
  custom_name text check (char_length(custom_name) <= 60),
  weekdays smallint[] not null check (cardinality(weekdays) between 1 and 7),
  start_time text not null check (start_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  duration_min integer not null check (duration_min between 5 and 600),
  intensity text not null default 'moderada' check (intensity in ('leve', 'moderada', 'intensa')),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create index recurring_activities_user_idx on public.recurring_activities (user_id);

create table public.activity_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  recurring_id bigint references public.recurring_activities (id) on delete set null,
  activity text not null check (char_length(activity) between 1 and 40),
  custom_name text check (char_length(custom_name) <= 60),
  start_time text not null check (start_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  duration_min integer not null check (duration_min between 5 and 600),
  intensity text not null check (intensity in ('leve', 'moderada', 'intensa')),
  status text not null check (status in ('feito', 'nao_feito')),
  workout_id bigint references public.workouts (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (user_id, recurring_id, day)
);
create index activity_logs_user_day_idx on public.activity_logs (user_id, day);
create index activity_logs_recurring_idx on public.activity_logs (recurring_id);
create index activity_logs_workout_idx on public.activity_logs (workout_id);

alter table public.recurring_activities enable row level security;
alter table public.activity_logs enable row level security;
create policy "dono: tudo" on public.recurring_activities for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "dono: tudo" on public.activity_logs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
