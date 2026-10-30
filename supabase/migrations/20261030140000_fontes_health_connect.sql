-- Apps escolhidos pela pessoa: o Saúde só lê do Health Connect o que veio deles.
alter table public.profiles add column health_sources text[];
comment on column public.profiles.health_sources is 'Pacotes dos apps cujo dado o Saúde lê do Health Connect (null = ainda não escolheu = nenhum).';
