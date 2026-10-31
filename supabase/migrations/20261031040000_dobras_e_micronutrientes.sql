-- Dobras cutâneas (protocolo de 7 dobras) e fibra/açúcar/sódio da dieta.
alter table public.body_entries
  add column sf_chest_mm numeric(4, 1) check (sf_chest_mm between 2 and 80),
  add column sf_axillary_mm numeric(4, 1) check (sf_axillary_mm between 2 and 80),
  add column sf_triceps_mm numeric(4, 1) check (sf_triceps_mm between 2 and 80),
  add column sf_subscapular_mm numeric(4, 1) check (sf_subscapular_mm between 2 and 80),
  add column sf_abdominal_mm numeric(4, 1) check (sf_abdominal_mm between 2 and 80),
  add column sf_suprailiac_mm numeric(4, 1) check (sf_suprailiac_mm between 2 and 80),
  add column sf_thigh_mm numeric(4, 1) check (sf_thigh_mm between 2 and 80);

alter table public.nutrition_days
  add column fiber_g numeric(6, 1) check (fiber_g >= 0),
  add column sugar_g numeric(6, 1) check (sugar_g >= 0),
  add column sodium_mg integer check (sodium_mg >= 0);
