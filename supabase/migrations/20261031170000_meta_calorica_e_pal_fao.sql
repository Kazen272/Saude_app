-- Meta de calorias escolhida pela pessoa e níveis de atividade com PAL da FAO/OMS/UNU (2004).
alter table public.profiles add column calorie_goal integer check (calorie_goal between 800 and 6000);
comment on column public.profiles.calorie_goal is 'Meta de calorias por dia escolhida pela pessoa (null = usar a sugestão moderada do app).';

update public.profiles set activity_factor = case
  when activity_factor < 1.3 then 1.40
  when activity_factor < 1.45 then 1.55
  when activity_factor < 1.65 then 1.70
  else 2.00 end;
alter table public.profiles alter column activity_factor set default 1.40;
