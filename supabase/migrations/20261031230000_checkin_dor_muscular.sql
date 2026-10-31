-- Check-in: dor muscular / cansaço físico (1 = nenhum, 5 = muito), usado na recuperação do dia.
alter table public.daily_checkins add column soreness smallint check (soreness between 1 and 5);
comment on column public.daily_checkins.soreness is 'Dor muscular / cansaço físico de 1 (nenhum) a 5 (muito).';
