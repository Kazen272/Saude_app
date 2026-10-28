import {
  ajusteDeGasto,
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
import { previstoVersusReal, resumirPeriodo, type DiaBalanco, type PrevistoReal, type ResumoPeriodo } from './relatorios';
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

/**
 * Devolve uma função que calcula o gasto de um dia: metabolismo basal (pelo
 * peso de referência) + calorias ativas do relógio, ou × fator de atividade,
 * mais o ajuste da recalibração. Devolve null se o perfil estiver incompleto
 * ou sem peso.
 */
function calculadoraDeGasto(perfil: Perfil, pesoRefKg: number | null, atividades: Atividade[], hoje: string, ajusteKcal = 0) {
  const tmb =
    perfilEstaCompleto(perfil) && pesoRefKg != null
      ? tmbMifflin({
          sexo: perfil.sex as Sexo,
          pesoKg: pesoRefKg,
          alturaCm: perfil.height_cm as number,
          idade: idadeEmAnos(perfil.birth_date as string, hoje),
        })
      : null;
  return (dia: string) => {
    if (tmb == null) return null;
    const a = atividades.find((x) => x.day === dia);
    return gastoDiario({ tmb, kcalAtivas: a?.active_kcal ?? null, fatorAtividade: perfil.activity_factor, ajusteKcal });
  };
}

type BalancoDia = DiaBalanco & { deficit: number | null };

/**
 * Análise comum às telas Hoje e Progresso, sobre os últimos 28 dias:
 * 1. compara a perda prevista pelas calorias com a real (previsto × real);
 * 2. recalibra o gasto estimado com essa diferença;
 * 3. com o gasto recalibrado, calcula o déficit médio e a projeção da meta.
 */
function analisar(p: { perfil: Perfil; pesagens: Pesagem[]; atividades: Atividade[]; nutricoes: Nutricao[]; hoje: string }) {
  const { perfil, atividades, nutricoes, hoje } = p;
  const medias = mediaMovel(p.pesagens);
  const pesoRef = medias.at(-1)?.pesoKg ?? null;
  const consumoDe = (dia: string) => nutricoes.find((n) => n.day === dia)?.kcal ?? null;
  const balancoCom = (gastoDe: ReturnType<typeof calculadoraDeGasto>) => (dia: string): BalancoDia => {
    const gasto = gastoDe(dia)?.kcal ?? null;
    const consumo = consumoDe(dia);
    return { dia, gasto, consumo, deficit: gasto != null && consumo != null ? deficit(gasto, consumo) : null };
  };

  // 1–2. Previsto × real com o gasto sem ajuste.
  const balancoBruto = balancoCom(calculadoraDeGasto(perfil, pesoRef, atividades, hoje));
  let previstoReal: (PrevistoReal & { dias: number }) | null = null;
  let ajusteKcalDia = 0;
  const inicio = medias.find((m) => m.dia >= somarDias(hoje, -27));
  const fim = medias.at(-1);
  if (inicio && fim && inicio.dia < fim.dia) {
    const dias = Math.round((Date.parse(fim.dia) - Date.parse(inicio.dia)) / 86_400_000);
    const janela = Array.from({ length: dias }, (_, i) => balancoBruto(somarDias(inicio.dia, i)).deficit);
    if (janela.some((d) => d != null)) {
      const acumulado = janela.reduce<number>((s, d) => s + (d ?? 0), 0);
      const pesos = { deficitAcumuladoKcal: acumulado, pesoInicialKg: inicio.pesoKg, pesoFinalKg: fim.pesoKg };
      previstoReal = { ...previstoVersusReal(pesos), dias };
      ajusteKcalDia = ajusteDeGasto({ ...pesos, dias });
    }
  }

  // 3. Gasto recalibrado, déficit médio dos últimos 14 dias completos e projeção.
  const gastoDoDia = calculadoraDeGasto(perfil, pesoRef, atividades, hoje, ajusteKcalDia);
  const balancoDe = balancoCom(gastoDoDia);
  const deficits14 = Array.from({ length: 14 }, (_, i) => balancoDe(somarDias(hoje, -14 + i)).deficit).filter(
    (d): d is number => d != null,
  );
  const deficitMedio = deficits14.length ? Math.round(deficits14.reduce((s, d) => s + d, 0) / deficits14.length) : null;
  const projecao =
    perfil.goal_weight_kg != null && pesoRef != null && deficitMedio != null
      ? projetarMeta({ pesoAtualKg: pesoRef, metaKg: perfil.goal_weight_kg, deficitMedioDiario: deficitMedio, hoje })
      : null;

  return { medias, pesoRef, gastoDoDia, balancoDe, deficitMedio, projecao, previstoReal, ajusteKcalDia };
}

/** Lê atividade e nutrição dos últimos 28 dias, base de toda a análise. */
async function carregarHistorico28(hoje: string) {
  const desde = somarDias(hoje, -27);
  const [atividades, nutricoes] = await Promise.all([
    supabase.from('daily_activity').select('day, steps, active_kcal, resting_hr, sleep_minutes').gte('day', desde),
    supabase.from('nutrition_days').select('day, kcal').gte('day', desde),
  ]);
  if (atividades.error) throw atividades.error;
  if (nutricoes.error) throw nutricoes.error;
  return { atividades: (atividades.data ?? []) as Atividade[], nutricoes: (nutricoes.data ?? []) as Nutricao[] };
}

export type Progresso = {
  perfil: Perfil;
  perfilCompleto: boolean;
  pesagens: Pesagem[];
  medias: Pesagem[];
  projecao: Projecao | null;
  deficitMedio: number | null;
  ultimos7: BalancoDia[];
  semana: ResumoPeriodo;
  treinosSemana: { quantidade: number; kcal: number };
  aguaMediaMl: number;
  previstoReal: (PrevistoReal & { dias: number }) | null;
  ajusteKcalDia: number;
};

/** Tudo o que a aba Progresso mostra, para o período escolhido (7, 30 ou 56 dias). */
export async function carregarProgresso(periodoDias: number): Promise<Progresso> {
  const hoje = diaLocal();
  const inicio7 = somarDias(hoje, -6);
  const [a7, m7, d7] = inicio7.split('-').map(Number);
  const limites7 = { inicio: limitesDoDia(new Date(a7, m7 - 1, d7)).inicio, fim: limitesDoDia().fim };

  const [perfil, pesagensTodas, historico, treinos, agua] = await Promise.all([
    carregarPerfil(),
    carregarPesagens(Math.max(periodoDias, 28) + 7),
    carregarHistorico28(hoje),
    supabase.from('workouts').select('active_kcal').gte('started_at', limites7.inicio).lt('started_at', limites7.fim),
    supabase.from('water_entries').select('amount_ml').gte('logged_at', limites7.inicio).lt('logged_at', limites7.fim),
  ]);
  if (treinos.error) throw treinos.error;
  if (agua.error) throw agua.error;

  const analise = analisar({ perfil, pesagens: pesagensTodas, ...historico, hoje });
  const inicioPeriodo = somarDias(hoje, -(periodoDias - 1));
  const ultimos7 = Array.from({ length: 7 }, (_, i) => analise.balancoDe(somarDias(inicio7, i)));
  const listaTreinos = (treinos.data ?? []) as { active_kcal: number | null }[];
  const aguaTotal = (agua.data ?? []).reduce((s, r) => s + Number(r.amount_ml), 0);

  return {
    perfil,
    perfilCompleto: perfilEstaCompleto(perfil),
    pesagens: pesagensTodas.filter((p) => p.dia >= inicioPeriodo),
    medias: analise.medias.filter((p) => p.dia >= inicioPeriodo),
    projecao: analise.projecao,
    deficitMedio: analise.deficitMedio,
    ultimos7,
    semana: resumirPeriodo(ultimos7),
    treinosSemana: { quantidade: listaTreinos.length, kcal: listaTreinos.reduce((s, t) => s + (t.active_kcal ?? 0), 0) },
    aguaMediaMl: Math.round(aguaTotal / 7),
    previstoReal: analise.previstoReal,
    ajusteKcalDia: analise.ajusteKcalDia,
  };
}

/** Junta tudo o que a tela "Hoje" precisa numa leitura só. */
export async function carregarResumoDoDia(): Promise<ResumoDoDia> {
  const hoje = diaLocal();
  const { inicio, fim } = limitesDoDia();

  const [perfil, pesagens, historico, agua, treinos] = await Promise.all([
    carregarPerfil(),
    carregarPesagens(35),
    carregarHistorico28(hoje),
    supabase.from('water_entries').select('amount_ml').gte('logged_at', inicio).lt('logged_at', fim),
    supabase.from('workouts').select('title, started_at, ended_at, active_kcal, origin_app').gte('started_at', inicio).lt('started_at', fim).order('started_at'),
  ]);
  if (agua.error) throw agua.error;
  if (treinos.error) throw treinos.error;

  const analise = analisar({ perfil, pesagens, ...historico, hoje });
  const pesoAtual = pesagens.length ? pesagens[pesagens.length - 1].pesoKg : null;
  const mediaHoje = analise.pesoRef;
  const umaSemanaAtras = somarDias(hoje, -7);
  const mediaSemanaPassada = [...analise.medias].reverse().find((p) => p.dia <= umaSemanaAtras)?.pesoKg ?? null;
  const variacaoSemanaKg =
    mediaHoje != null && mediaSemanaPassada != null ? Math.round((mediaHoje - mediaSemanaPassada) * 10) / 10 : null;

  const balancoHoje = analise.balancoDe(hoje);

  return {
    perfil,
    perfilCompleto: perfilEstaCompleto(perfil),
    pesoAtual,
    variacaoSemanaKg,
    aguaMl: (agua.data ?? []).reduce((s, r) => s + Number(r.amount_ml), 0),
    atividade: historico.atividades.find((a) => a.day === hoje) ?? null,
    treinos: (treinos.data ?? []) as Treino[],
    consumoKcal: balancoHoje.consumo,
    gasto: analise.gastoDoDia(hoje),
    deficitHoje: balancoHoje.deficit,
    deficitMedio: analise.deficitMedio,
    projecao: analise.projecao,
  };
}
