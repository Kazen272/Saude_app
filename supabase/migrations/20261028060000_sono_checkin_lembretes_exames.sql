-- Sono, check-in diário, lembretes e exames de sangue.

-- Sono: uma sessão por noite (dia = data em que acordou).
create table public.sleep_sessions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  night date not null,
  bed_at timestamptz not null,
  wake_at timestamptz not null,
  quality smallint check (quality between 1 and 5),
  source text not null default 'manual' check (source in ('manual', 'health_connect')),
  created_at timestamptz not null default now(),
  check (wake_at > bed_at and wake_at - bed_at < interval '20 hours'),
  unique (user_id, night, source)
);

-- Check-in diário: energia, fome e humor de 1 a 5.
create table public.daily_checkins (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day date not null,
  energy smallint check (energy between 1 and 5),
  hunger smallint check (hunger between 1 and 5),
  mood smallint check (mood between 1 and 5),
  note text check (char_length(note) <= 500),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- Lembretes com recorrência. weekdays: 1 = domingo ... 7 = sábado.
-- kind 'horarios': dispara nos horários de times; 'intervalo': a cada interval_minutes entre window_start e window_end.
create table public.reminders (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  body text check (char_length(body) <= 200),
  kind text not null default 'horarios' check (kind in ('horarios', 'intervalo')),
  weekdays smallint[] not null default '{1,2,3,4,5,6,7}',
  times text[] not null default '{}',
  interval_minutes integer check (interval_minutes between 15 and 720),
  window_start text check (window_start ~ '^[0-2][0-9]:[0-5][0-9]$'),
  window_end text check (window_end ~ '^[0-2][0-9]:[0-5][0-9]$'),
  link text,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

-- Exames de sangue: um registro por coleta, resultados por marcador.
create table public.lab_exams (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  collected_on date not null,
  lab_name text check (char_length(lab_name) <= 120),
  file_path text,
  notes text check (char_length(notes) <= 1000),
  created_at timestamptz not null default now()
);
create index lab_exams_user_date_idx on public.lab_exams (user_id, collected_on);

create table public.lab_results (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exam_id bigint not null references public.lab_exams (id) on delete cascade,
  marker text not null,
  value numeric(10, 3) not null,
  unit text not null,
  ref_low numeric(10, 3),
  ref_high numeric(10, 3),
  unique (exam_id, marker)
);
create index lab_results_exam_idx on public.lab_results (exam_id);
create index lab_results_user_marker_idx on public.lab_results (user_id, marker);

alter table public.sleep_sessions enable row level security;
alter table public.daily_checkins enable row level security;
alter table public.reminders enable row level security;
alter table public.lab_exams enable row level security;
alter table public.lab_results enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['sleep_sessions', 'daily_checkins', 'reminders', 'lab_exams', 'lab_results']
  loop
    execute format(
      'create policy "dono: tudo" on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- Resultado só pode apontar para um exame do próprio usuário.
create policy "resultado: exame do dono" on public.lab_results
  as restrictive for all to authenticated
  using (exists (select 1 from public.lab_exams e where e.id = exam_id and e.user_id = (select auth.uid())))
  with check (exists (select 1 from public.lab_exams e where e.id = exam_id and e.user_id = (select auth.uid())));

-- Laudos: bucket privado, pasta = id do usuário.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lab-reports', 'lab-reports', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);

create policy "laudos: dono lê" on storage.objects
  for select to authenticated
  using (bucket_id = 'lab-reports' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "laudos: dono envia" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'lab-reports' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "laudos: dono substitui" on storage.objects
  for update to authenticated
  using (bucket_id = 'lab-reports' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'lab-reports' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "laudos: dono apaga" on storage.objects
  for delete to authenticated
  using (bucket_id = 'lab-reports' and (storage.foldername(name))[1] = (select auth.uid())::text);
