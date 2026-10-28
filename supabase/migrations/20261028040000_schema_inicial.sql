-- Schema inicial do app de saúde.
-- Cada pessoa da família tem o próprio login; todas as tabelas são
-- isoladas por usuário via RLS (user_id = auth.uid()).

-- ---------------------------------------------------------------
-- Perfil
-- ---------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  sex text check (sex in ('masculino', 'feminino')),
  birth_date date,
  height_cm numeric(5, 1) check (height_cm between 50 and 260),
  activity_factor numeric(4, 3) not null default 1.2
    check (activity_factor between 1.0 and 2.5),
  goal_weight_kg numeric(5, 2) check (goal_weight_kg between 20 and 400),
  water_goal_ml integer not null default 3000 check (water_goal_ml between 500 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cria o perfil automaticamente quando alguém se cadastra.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------
-- Peso e medidas (um registro por dia)
-- ---------------------------------------------------------------
create table public.body_entries (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  measured_on date not null,
  weight_kg numeric(5, 2) check (weight_kg between 20 and 400),
  waist_cm numeric(5, 1) check (waist_cm between 30 and 250),
  hip_cm numeric(5, 1) check (hip_cm between 30 and 250),
  body_fat_pct numeric(4, 1) check (body_fat_pct between 2 and 75),
  source text not null default 'manual' check (source in ('manual', 'health_connect')),
  created_at timestamptz not null default now(),
  unique (user_id, measured_on)
);

-- ---------------------------------------------------------------
-- Água (vários registros por dia)
-- ---------------------------------------------------------------
create table public.water_entries (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  logged_at timestamptz not null default now(),
  amount_ml integer not null check (amount_ml between 1 and 5000)
);
create index water_entries_user_time_idx on public.water_entries (user_id, logged_at);

-- ---------------------------------------------------------------
-- Atividade diária vinda do relógio (Health Connect)
-- ---------------------------------------------------------------
create table public.daily_activity (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  steps integer check (steps >= 0),
  active_kcal integer check (active_kcal >= 0),
  total_kcal integer check (total_kcal >= 0),
  resting_hr integer check (resting_hr between 20 and 250),
  sleep_minutes integer check (sleep_minutes between 0 and 1440),
  source text not null default 'health_connect',
  synced_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- ---------------------------------------------------------------
-- Treinos (Hevy via Health Connect; depois API do Hevy Pro)
-- ---------------------------------------------------------------
create table public.workouts (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source text not null check (source in ('health_connect', 'hevy_api', 'manual')),
  external_id text,
  origin_app text,
  title text,
  started_at timestamptz not null,
  ended_at timestamptz,
  active_kcal integer check (active_kcal >= 0),
  created_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);
create index workouts_user_start_idx on public.workouts (user_id, started_at);

-- ---------------------------------------------------------------
-- Nutrição diária (FatSecret via Health Connect ou API)
-- ---------------------------------------------------------------
create table public.nutrition_days (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  kcal integer check (kcal >= 0),
  protein_g numeric(6, 1) check (protein_g >= 0),
  carbs_g numeric(6, 1) check (carbs_g >= 0),
  fat_g numeric(6, 1) check (fat_g >= 0),
  source text not null default 'health_connect'
    check (source in ('health_connect', 'fatsecret_api', 'manual')),
  synced_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- ---------------------------------------------------------------
-- Fotos de progresso (arquivo no Storage, metadados aqui)
-- ---------------------------------------------------------------
create table public.progress_photos (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  taken_on date not null,
  pose text not null check (pose in ('frente', 'lado', 'costas')),
  storage_path text not null,
  created_at timestamptz not null default now(),
  unique (user_id, taken_on, pose)
);

-- ---------------------------------------------------------------
-- RLS: cada usuário só enxerga e altera o que é dele
-- ---------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.body_entries enable row level security;
alter table public.water_entries enable row level security;
alter table public.daily_activity enable row level security;
alter table public.workouts enable row level security;
alter table public.nutrition_days enable row level security;
alter table public.progress_photos enable row level security;

create policy "perfil: ler o próprio" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "perfil: atualizar o próprio" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $$
declare
  t text;
begin
  foreach t in array array['body_entries', 'water_entries', 'daily_activity', 'workouts', 'nutrition_days', 'progress_photos']
  loop
    execute format(
      'create policy "dono: tudo" on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------
-- Storage: bucket privado, pasta = id do usuário
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 2097152, array['image/jpeg', 'image/webp']);

create policy "fotos: dono lê" on storage.objects
  for select to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "fotos: dono envia" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "fotos: dono apaga" on storage.objects
  for delete to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
