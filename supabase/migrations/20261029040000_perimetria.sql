-- Perimetria: medidas da avaliação física, uma linha por dia junto com o peso.
alter table public.body_entries
  add column abdomen_cm numeric(5, 1) check (abdomen_cm between 30 and 250),
  add column chest_cm numeric(5, 1) check (chest_cm between 30 and 250),
  add column shoulder_cm numeric(5, 1) check (shoulder_cm between 30 and 250),
  add column arm_relaxed_l_cm numeric(5, 1) check (arm_relaxed_l_cm between 10 and 100),
  add column arm_relaxed_r_cm numeric(5, 1) check (arm_relaxed_r_cm between 10 and 100),
  add column arm_flexed_l_cm numeric(5, 1) check (arm_flexed_l_cm between 10 and 100),
  add column arm_flexed_r_cm numeric(5, 1) check (arm_flexed_r_cm between 10 and 100),
  add column forearm_l_cm numeric(5, 1) check (forearm_l_cm between 10 and 100),
  add column forearm_r_cm numeric(5, 1) check (forearm_r_cm between 10 and 100),
  add column thigh_l_cm numeric(5, 1) check (thigh_l_cm between 20 and 150),
  add column thigh_r_cm numeric(5, 1) check (thigh_r_cm between 20 and 150),
  add column calf_l_cm numeric(5, 1) check (calf_l_cm between 15 and 100),
  add column calf_r_cm numeric(5, 1) check (calf_r_cm between 15 and 100);
