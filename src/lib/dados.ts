import {
  deficit,
  gastoDiario,
  idadeEmAnos,
  mediaMovel,
  projetarMeta,
  tmbMifflin,
  type Pesagem,
  type Projecao,
  type Sexo,
} from './calculos';
import { diaLocal, limitesDoDia, somarDias } from './datas';
import { supabase } from './supabase';

export type Perfil = {
  id: string;
  display_name: string | null;
  sex: Sexo | null;
  birth_date: string | null;
  height_cm: number | null;
  activity_factor: number;
  goal_weight_kg: number | null;
  water_goal_ml: number;
};

type Atividade = { day: string; steps: number | null; active_kcal: number | null; resting_hr: number | null; sleep_minutes: number | null };
type Nutricao = { day: string; kcal: number | null };
type Treino = { title: string | null; started_at: string; ended_at: string | null; active_kcal: number | null; origin_app: string | null };

export type ResumoDoDia = {
  perfil: Perfil;
  perfilCompleto: boolean;
  pesoAtual: number | null;
  variacaoSemanaKg: number | null;
  aguaMl: number;
  atividade: Atividade | null;
  treinos: Treino[];
  consumoKcal: number | null;
  gasto: { kcal: number; origem: 'relogio' | 'estimativa' } | null;
  deficitHoje: number | null;
  deficitMedio: number | null;
  projecao: Projecao | null;
};

// Postgres devolve numeric como string; converte para número.
const num = (v: unknown): number | null => (v == null ? null : Number(v));

function normalizarPerfil(p: Record<string, unknown>): Perfil {
  return {
    id: p.id as string,
    display_name: (p.display_name as string | null) ?? null,
    sex: (p.sex as Sexo | null) ?? null,
    birth_date: (p.birth_date as string | null) ?? null,
    height_cm: num(p.height_cm),
    activity_factor: num(p.activity_factor) ?? 1.2,
    goal_weight_kg: num(p.goal_weight_kg),
    water_goal_ml: num(p.water_goal_ml) ?? 3000,
  };
}

export async function carregarPerfil(): Promise<Perfil> {
  const { data, error } = await supabase.from('profiles').select('*').single();
  if (error) throw error;
  return normalizarPerfil(data);
}

export async function salvarPerfil(mudancas: Partial<Omit<Perfil, 'id'>>, id: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ ...mudancas, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function registrarAgua(ml: number): Promise<void> {
  const { error } = await supabase.from('water_entries').insert({ amount_ml: ml });
  if (error) throw error;
}

export async function registrarCorpo(entrada: {
  dia: string;
  pesoKg: number | null;
  cinturaCm?: number | null;
  quadrilCm?: number | null;
  gorduraPct?: number | null;
}): Promise<void> {
  const linha: Record<string, unknown> = { measured_on: entrada.dia, weight_kg: entrada.pesoKg, source: 'manual' };
  if (entrada.cinturaCm != null) linha.waist_cm = entrada.cinturaCm;
  if (entrada.quadrilCm != null) linha.hip_cm = entrada.quadrilCm;
  if (entrada.gorduraPct != null) linha.body_fat_pct = entrada.gorduraPct;
  const { data: sessao } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('body_entries')
    .upsert({ ...linha, user_id: sessao.user?.id }, { onConflict: 'user_id,measured_on' });
  if (error) throw error;
}

export async function carregarPesagens(dias: number): Promise<Pesagem[]> {
  const desde = somarDias(diaLocal(), -dias);
  const { data, error } = await supabase
    .from('body_entries')
    .select('measured_on, weight_kg')
    .gte('measured_on', desde)
    .not('weight_kg', 'is', null)
    .order('measured_on');
  if (error) throw error;
  return (data ?? []).map((r) => ({ dia: r.measured_on as string, pesoKg: Number(r.weight_kg) }));
}

export function perfilEstaCompleto(p: Perfil): boolean {
  return p.sex != null && p.birth_date != null && p.height_cm != null;
}

/** Junta tudo o que a tela "Hoje" precisa numa leitura só. */
export async function carregarResumoDoDia(): Promise<ResumoDoDia> {
  const hoje = diaLocal();
  const desde14 = somarDias(hoje, -13);
  const { inicio, fim } = limitesDoDia();

  const [perfil, pesagens, agua, atividades, nutricoes, treinos] = await Promise.all([
    carregarPerfil(),
    carregarPesagens(30),
    supabase.from('water_entries').select('amount_ml').gte('logged_at', inicio).lt('logged_at', fim),
    supabase.from('daily_activity').select('day, steps, active_kcal, resting_hr, sleep_minutes').gte('day', desde14),
    supabase.from('nutrition_days').select('day, kcal').gte('day', desde14),
    supabase.from('workouts').select('title, started_at, ended_at, active_kcal, origin_app').gte('started_at', inicio).lt('started_at', fim).order('started_at'),
  ]);
  for (const r of [agua, atividades, nutricoes, treinos]) if (r.error) throw r.error;

  const suavizado = mediaMovel(pesagens);
  const pesoAtual = pesagens.length ? pesagens[pesagens.length - 1].pesoKg : null;
  const mediaHoje = suavizado.at(-1)?.pesoKg ?? null;
  const umaSemanaAtras = somarDias(hoje, -7);
  const mediaSemanaPassada = [...suavizado].reverse().find((p) => p.dia <= umaSemanaAtras)?.pesoKg ?? null;
  const variacaoSemanaKg =
    mediaHoje != null && mediaSemanaPassada != null ? Math.round((mediaHoje - mediaSemanaPassada) * 10) / 10 : null;

  const aguaMl = (agua.data ?? []).reduce((s, r) => s + Number(r.amount_ml), 0);
  const listaAtividade = (atividades.data ?? []) as Atividade[];
  const listaNutricao = (nutricoes.data ?? []) as Nutricao[];
  const atividadeHoje = listaAtividade.find((a) => a.day === hoje) ?? null;
  const consumoHoje = listaNutricao.find((n) => n.day === hoje)?.kcal ?? null;

  const completo = perfilEstaCompleto(perfil);
  let tmb: number | null = null;
  if (completo && pesoAtual != null) {
    tmb = tmbMifflin({
      sexo: perfil.sex as Sexo,
      pesoKg: mediaHoje ?? pesoAtual,
      alturaCm: perfil.height_cm as number,
      idade: idadeEmAnos(perfil.birth_date as string, hoje),
    });
  }

  const gastoDoDia = (dia: string) => {
    if (tmb == null) return null;
    const a = listaAtividade.find((x) => x.day === dia);
    return gastoDiario({ tmb, kcalAtivas: a?.active_kcal ?? null, fatorAtividade: perfil.activity_factor });
  };

  const gasto = gastoDoDia(hoje);
  const deficitHoje = gasto && consumoHoje != null ? deficit(gasto.kcal, consumoHoje) : null;

  // Déficit médio dos últimos 14 dias completos (sem hoje, que ainda não acabou).
  const deficitsCompletos = listaNutricao
    .filter((n) => n.day !== hoje && n.kcal != null)
    .map((n) => {
      const g = gastoDoDia(n.day);
      return g ? deficit(g.kcal, n.kcal as number) : null;
    })
    .filter((d): d is number => d != null);
  const deficitMedio = deficitsCompletos.length
    ? Math.round(deficitsCompletos.reduce((s, d) => s + d, 0) / deficitsCompletos.length)
    : null;

  const projecao =
    perfil.goal_weight_kg != null && mediaHoje != null && deficitMedio != null
      ? projetarMeta({ pesoAtualKg: mediaHoje, metaKg: perfil.goal_weight_kg, deficitMedioDiario: deficitMedio, hoje })
      : null;

  return {
    perfil,
    perfilCompleto: completo,
    pesoAtual,
    variacaoSemanaKg,
    aguaMl,
    atividade: atividadeHoje,
    treinos: (treinos.data ?? []) as Treino[],
    consumoKcal: consumoHoje,
    gasto,
    deficitHoje,
    deficitMedio,
    projecao,
  };
}
