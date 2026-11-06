import {
  ajusteDeGasto,
  deficit,
  fracaoDoDia,
  gastoDiario,
  metaProteina,
  planoDoDia,
  sugerirMetas,
  gastoTipicoRelogio,
  relacaoCinturaAltura,
  ritmoSemanal,
  idadeEmAnos,
  mediaMovel,
  projetarMeta,
  tmbMifflin,
  type Pesagem,
  type Projecao,
  type Sexo,
  type NivelCintura,
  type PlanoDoDia,
  type OpcaoMeta,
} from './calculos';
import { diaLocal, inicioDaSemana, limitesDoDia, porSemana, somarDias } from './datas';
import { alertaDeficitAgressivo, mediaCampo, resumirSono } from './bemestar';
import { carregarCheckins, carregarNoites } from './bemestar-dados';
import {
  compararSemanas,
  previstoVersusReal,
  resumirPeriodo,
  semanaDoRelatorio,
  type DiaBalanco,
  type ItemComparacao,
  type MetricasSemana,
  type PrevistoReal,
  type ResumoPeriodo,
} from './relatorios';
import { COLUNAS, DOBRAS, MEDIDAS, resumir, type RegistroMedidas, type ResumoMedida, type Valores } from './medidas';
import { supabase } from './supabase';
import { kcalDoTreino, kcalTreinosPorDia, sessoesDeTreino, type SessaoDeTreino, type TreinoParaGasto } from './treinos';
import { diaDaSemana, nomeDaAtividade, treinoCombinaCom, treinoCorrespondente, type TreinoGravado } from './atividades';
import {
  constanciaDaSemana,
  encontrarPadroes,
  resumirSemana,
  type PrevistaDoDia,
  type SemanaDiaADia,
  gorduraPollock7,
  prontidao,
  sequencias,
  sinaisDoCorpo,
  type Constancia,
  type DiaConsolidado,
  type Padrao,
  type Prontidao,
  type Sequencias,
  type SinalCorpo,
  desdeOInicio,
  metaNoPeriodo,
  semanaAtual,
  type DesdeInicio,
  type MetaPeriodo,
  type SemanaAtual,
} from './analises';

export type Perfil = {
  id: string;
  display_name: string | null;
  sex: Sexo | null;
  birth_date: string | null;
  height_cm: number | null;
  activity_factor: number;
  goal_weight_kg: number | null;
  /** Meta de kcal por dia escolhida (null = usar a sugestão moderada). */
  calorie_goal: number | null;
  water_goal_ml: number;
};

type Atividade = { day: string; steps: number | null; active_kcal: number | null; total_kcal: number | null; resting_hr: number | null; sleep_minutes: number | null };
type Nutricao = { day: string; kcal: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null };
type Treino = { title: string | null; started_at: string; ended_at: string | null; active_kcal: number | null; origin_app: string | null; kcal?: { kcal: number; estimado: boolean } | null };

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
  /** O balanço de hoje conta o dia só até agora. */
  horaParcial: string;
  /** Ontem: dia completo, o número mais confiável. */
  ontem: { gasto: number | null; consumo: number | null; deficit: number | null };
  macros: { proteina: number | null; carbo: number | null; gordura: number | null } | null;
  metaProteina: { min: number; max: number } | null;
  ritmo: { kgPorSemana: number; pctPorSemana: number } | null;
  /** Quanto ainda dá para comer hoje (null sem perfil completo ou sem peso). */
  plano: PlanoDoDia | null;
  /** Já são 15h ou mais: hora de avisar se o dia vai fechar com déficit grande demais. */
  tarde: boolean;
  /** Meta de kcal do dia: a escolhida no perfil ou a sugestão moderada. */
  meta: { kcal: number; sugerida: boolean } | null;
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
    activity_factor: num(p.activity_factor) ?? 1.4,
    goal_weight_kg: num(p.goal_weight_kg),
    calorie_goal: num(p.calorie_goal),
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

/** Registra água; num dia passado, fica às 12h daquele dia. Devolve o id para poder desfazer. */
export async function registrarAgua(ml: number, dia: string = diaLocal()): Promise<number | null> {
  const linha: Record<string, unknown> = { amount_ml: ml };
  if (dia !== diaLocal()) {
    const [a, m, d] = dia.split('-').map(Number);
    linha.logged_at = new Date(a, m - 1, d, 12).toISOString();
  }
  const { data, error } = await supabase.from('water_entries').insert(linha).select('id').single();
  if (error) throw error;
  return (data?.id as number) ?? null;
}

export async function apagarAgua(id: number): Promise<void> {
  const { error } = await supabase.from('water_entries').delete().eq('id', id);
  if (error) throw error;
}

export type RegistrosDoDia = {
  corpo: { pesoKg: number | null; medidas: Valores; origem: string } | null;
  agua: { id: number; ml: number; hora: string }[];
  sono: { origem: string; deitou: string; acordou: string; qualidade: number | null }[];
  checkin: { energia: number | null; fome: number | null; humor: number | null; dor: number | null } | null;
  /** Dieta do dia como chegou do Health Connect (FatSecret), com a hora da última leitura. */
  dieta: { kcal: number; proteina: number | null; carbo: number | null; gordura: number | null; lidaEm: string; corrigida: boolean } | null;
};

const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Tudo o que foi registrado num dia, para revisar, corrigir ou apagar. */
export async function carregarRegistrosDoDia(dia: string): Promise<RegistrosDoDia> {
  const [a, m, d] = dia.split('-').map(Number);
  const { inicio, fim } = limitesDoDia(new Date(a, m - 1, d));
  const [corpo, agua, sono, checkin, dieta] = await Promise.all([
    supabase.from('body_entries').select(`weight_kg, source, ${COLUNAS.join(', ')}`).eq('measured_on', dia).maybeSingle(),
    supabase.from('water_entries').select('id, amount_ml, logged_at').gte('logged_at', inicio).lt('logged_at', fim).order('logged_at'),
    supabase.from('sleep_sessions').select('bed_at, wake_at, quality, source').eq('night', dia),
    supabase.from('daily_checkins').select('energy, hunger, mood, soreness').eq('day', dia).maybeSingle(),
    supabase.from('nutrition_days').select('kcal, protein_g, carbs_g, fat_g, synced_at, source').eq('day', dia).maybeSingle(),
  ]);
  for (const r of [corpo, agua, sono, checkin, dieta]) if (r.error) throw r.error;
  const corpoLinha = corpo.data as unknown as Record<string, unknown> | null;
  return {
    corpo: corpoLinha
      ? {
          pesoKg: num(corpoLinha.weight_kg as number | null),
          medidas: lerValores(corpoLinha),
          origem: corpoLinha.source as string,
        }
      : null,
    agua: (agua.data ?? []).map((x) => ({ id: x.id as number, ml: Number(x.amount_ml), hora: hhmm(x.logged_at as string) })),
    sono: (sono.data ?? []).map((x) => ({
      origem: x.source as string,
      deitou: hhmm(x.bed_at as string),
      acordou: hhmm(x.wake_at as string),
      qualidade: (x.quality as number | null) ?? null,
    })),
    dieta:
      dieta.data && (Number(dieta.data.kcal) > 0 || dieta.data.source === 'manual')
        ? {
            kcal: Number(dieta.data.kcal),
            proteina: num(dieta.data.protein_g),
            carbo: num(dieta.data.carbs_g),
            gordura: num(dieta.data.fat_g),
            lidaEm: dieta.data.synced_at ? hhmm(dieta.data.synced_at as string) : '',
            corrigida: dieta.data.source === 'manual',
          }
        : null,
    checkin: checkin.data ? { energia: checkin.data.energy as number | null, fome: checkin.data.hunger as number | null, humor: checkin.data.mood as number | null, dor: (checkin.data.soreness as number | null) ?? null } : null,
  };
}

export async function apagarCorpo(dia: string): Promise<void> {
  const { error } = await supabase.from('body_entries').delete().eq('measured_on', dia);
  if (error) throw error;
}

/** Apaga o sono digitado à mão num dia (o do relógio volta a valer). */
export async function apagarSonoManual(dia: string): Promise<void> {
  const { error } = await supabase.from('sleep_sessions').delete().eq('night', dia).eq('source', 'manual');
  if (error) throw error;
}

export async function registrarCorpo(entrada: {
  dia: string;
  pesoKg: number | null;
  /** Ausente = não mexe nas medidas do dia (ex.: só o peso, no primeiro acesso). */
  medidas?: Valores;
}): Promise<void> {
  // O formulário já vem preenchido com o que existe no dia: campo apagado = valor apagado.
  const linha: Record<string, unknown> = {
    measured_on: entrada.dia,
    weight_kg: entrada.pesoKg,
    ...(entrada.medidas ? Object.fromEntries(COLUNAS.map((c) => [c, entrada.medidas?.[c] ?? null])) : {}),
    source: 'manual',
  };
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
function tmbDoPerfil(perfil: Perfil, pesoRefKg: number | null, hoje: string): number | null {
  return perfilEstaCompleto(perfil) && pesoRefKg != null
    ? tmbMifflin({
        sexo: perfil.sex as Sexo,
        pesoKg: pesoRefKg,
        alturaCm: perfil.height_cm as number,
        idade: idadeEmAnos(perfil.birth_date as string, hoje),
      })
    : null;
}

/** Gasto total típico do relógio nos últimos 14 dias completos (null se não usa ou não há dados). */
function tipicoDoRelogio(atividades: Atividade[], tmb: number | null, hoje: string): number | null {
  if (tmb == null) return null;
  const desde = somarDias(hoje, -14);
  return gastoTipicoRelogio(atividades.filter((a) => a.day >= desde && a.day < hoje).map((a) => a.total_kcal), tmb);
}

function calculadoraDeGasto(perfil: Perfil, pesoRefKg: number | null, atividades: Atividade[], hoje: string, ajusteKcal = 0, treinos: TreinoParaGasto[] = []) {
  const tmb = tmbDoPerfil(perfil, pesoRefKg, hoje);
  const treinosPorDia = kcalTreinosPorDia(treinos, pesoRefKg);
  const tipico = tipicoDoRelogio(atividades, tmb, hoje);
  const agora = new Date();
  const fracaoHoje = fracaoDoDia(agora.getHours() * 60 + agora.getMinutes());
  return (dia: string) => {
    if (tmb == null) return null;
    const a = atividades.find((x) => x.day === dia);
    return gastoDiario({
      tmb,
      kcalAtivas: a?.active_kcal ?? null,
      kcalTotais: a?.total_kcal ?? null,
      fatorAtividade: perfil.activity_factor,
      ajusteKcal,
      fracaoDoDia: dia === hoje ? fracaoHoje : 1,
      // Dia completo com total baixo demais = relógio fora do pulso parte do dia.
      confiarNoTotal: tipico != null && (dia === hoje || (a?.total_kcal ?? 0) >= tmb * 0.6),
      tetoTipico: tipico,
      passos: a?.steps ?? null,
      pesoKg: pesoRefKg,
      kcalTreinos: treinosPorDia.get(dia) ?? null,
    });
  };
}

export type BalancoDia = DiaBalanco & { deficit: number | null; gastoEstimado: boolean };

/**
 * Análise comum às telas Hoje e Progresso, sobre os últimos 28 dias:
 * 1. compara a perda prevista pelas calorias com a real (previsto × real);
 * 2. recalibra o gasto estimado com essa diferença;
 * 3. com o gasto recalibrado, calcula o déficit médio e a projeção da meta.
 */
function analisar(p: { perfil: Perfil; pesagens: Pesagem[]; atividades: Atividade[]; nutricoes: Nutricao[]; treinos?: TreinoParaGasto[]; hoje: string }) {
  const { perfil, atividades, nutricoes, hoje } = p;
  const treinos = p.treinos ?? [];
  const medias = mediaMovel(p.pesagens);
  const pesoRef = medias.at(-1)?.pesoKg ?? null;
  const consumoDe = (dia: string) => nutricoes.find((n) => n.day === dia)?.kcal ?? null;
  const balancoCom = (gastoDe: ReturnType<typeof calculadoraDeGasto>) => (dia: string): BalancoDia => {
    const g = gastoDe(dia);
    const gasto = g?.kcal ?? null;
    const consumo = consumoDe(dia);
    return { dia, gasto, consumo, deficit: gasto != null && consumo != null ? deficit(gasto, consumo) : null, gastoEstimado: g?.origem === 'estimativa' };
  };

  // 1–2. Previsto × real com o gasto sem ajuste.
  const balancoBruto = balancoCom(calculadoraDeGasto(perfil, pesoRef, atividades, hoje, 0, treinos));
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
  const gastoDoDia = calculadoraDeGasto(perfil, pesoRef, atividades, hoje, ajusteKcalDia, treinos);
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

type LinhaTreino = { id?: number; title?: unknown; started_at: unknown; ended_at?: unknown };
/** Linhas da tabela workouts → sessões de treino (sem deslocamentos curtos, sem duplicatas). */
function sessoesDasLinhas(linhas: LinhaTreino[] | null): SessaoDeTreino[] {
  return sessoesDeTreino(
    (linhas ?? []).map((t) => ({
      id: t.id,
      titulo: (t.title as string | null) ?? null,
      inicio: t.started_at as string,
      fim: (t.ended_at as string | null) ?? null,
    })),
  );
}

/** Lê atividade e nutrição dos últimos 28 dias, base de toda a análise. */
async function carregarHistorico28(hoje: string, dias = 28) {
  const desde = somarDias(hoje, -(dias - 1));
  const [a, m, d] = desde.split('-').map(Number);
  const [atividades, nutricoes, treinos] = await Promise.all([
    supabase.from('daily_activity').select('day, steps, active_kcal, total_kcal, resting_hr, sleep_minutes').gte('day', desde),
    supabase.from('nutrition_days').select('day, kcal, protein_g, carbs_g, fat_g').gte('day', desde),
    supabase.from('workouts').select('title, started_at, ended_at, active_kcal, origin_app').gte('started_at', new Date(a, m - 1, d).toISOString()),
  ]);
  if (atividades.error) throw atividades.error;
  if (nutricoes.error) throw nutricoes.error;
  if (treinos.error) throw treinos.error;
  const nutricoesNum = (nutricoes.data ?? []).map((n) => ({
    day: n.day as string,
    kcal: num(n.kcal),
    protein_g: num(n.protein_g),
    carbs_g: num(n.carbs_g),
    fat_g: num(n.fat_g),
  }));
  const treinosGasto: TreinoParaGasto[] = (treinos.data ?? []).map((t) => ({
    titulo: (t.title as string | null) ?? null,
    inicio: t.started_at as string,
    fim: (t.ended_at as string | null) ?? null,
    kcal: (t.active_kcal as number | null) ?? null,
    app: (t.origin_app as string | null) ?? null,
  }));
  return { atividades: (atividades.data ?? []) as Atividade[], nutricoes: nutricoesNum as Nutricao[], treinos: treinosGasto };
}

export type SugestaoMeta = {
  gastoBase: number;
  /** medido: média do gasto dos dias com relógio/passos; formula: metabolismo × nível de atividade. */
  origem: 'medido' | 'formula';
  diasMedidos: number;
  tmb: number;
  pal: number;
  pesoKg: number;
  opcoes: OpcaoMeta[];
  piso: number;
  faixa: { min: number; max: number };
};

/** Base para a sugestão de meta: gasto médio medido (14 dias completos, 7+ com dados) ou fórmula. */
function sugestaoDeMeta(perfil: Perfil, analise: ReturnType<typeof analisar>, hoje: string): SugestaoMeta | null {
  const tmb = tmbDoPerfil(perfil, analise.pesoRef, hoje);
  if (tmb == null || analise.pesoRef == null || !perfil.sex) return null;
  const medidos = Array.from({ length: 14 }, (_, i) => analise.balancoDe(somarDias(hoje, -14 + i)))
    .filter((b) => b.gasto != null && !b.gastoEstimado)
    .map((b) => b.gasto as number);
  const medido = medidos.length >= 7;
  const gastoBase = Math.round(medido ? medidos.reduce((s, g) => s + g, 0) / medidos.length : tmb * perfil.activity_factor);
  return {
    gastoBase,
    origem: medido ? 'medido' : 'formula',
    diasMedidos: medidos.length,
    tmb: Math.round(tmb),
    pal: perfil.activity_factor,
    pesoKg: analise.pesoRef,
    ...sugerirMetas({ gastoBase, pesoKg: analise.pesoRef, sexo: perfil.sex }),
  };
}

/** Sugestões de meta calórica para a tela do perfil. */
export async function carregarSugestaoMeta(): Promise<SugestaoMeta | null> {
  const hoje = diaLocal();
  const [perfil, pesagens, historico] = await Promise.all([carregarPerfil(), carregarPesagens(35), carregarHistorico28(hoje)]);
  return sugestaoDeMeta(perfil, analisar({ perfil, pesagens, ...historico, hoje }), hoje);
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
  ritmo: { kgPorSemana: number; pctPorSemana: number } | null;
  proteinaMediaSemana: number | null;
  metaProteina: { min: number; max: number } | null;
  /** Só as medidas que já foram registradas alguma vez. */
  medidas: ResumoMedida[];
  relacaoCintura: { valor: number; nivel: NivelCintura } | null;
  /** 8 semanas (seg–dom), da mais antiga para a atual. */
  tendencias: { semana: string; passos: number | null; fcRepouso: number | null; treinos: number }[];
};

/** Tudo o que a aba Progresso mostra, para o período escolhido (7, 30 ou 56 dias). */
export async function carregarProgresso(periodoDias: number): Promise<Progresso> {
  const hoje = diaLocal();
  const inicio7 = somarDias(hoje, -6);
  const [a7, m7, d7] = inicio7.split('-').map(Number);
  const limites7 = { inicio: limitesDoDia(new Date(a7, m7 - 1, d7)).inicio, fim: limitesDoDia().fim };

  const inicio56 = somarDias(hoje, -62);
  const [a56, m56, d56] = inicio56.split('-').map(Number);
  const [perfil, pesagensTodas, historico, treinos, agua, atividade56, treinos56, registrosMedidas, inicioApp] = await Promise.all([
    carregarPerfil(),
    carregarPesagens(Math.max(periodoDias, 28) + 7),
    carregarHistorico28(hoje),
    supabase.from('workouts').select('title, started_at, ended_at, active_kcal').gte('started_at', limites7.inicio).lt('started_at', limites7.fim),
    supabase.from('water_entries').select('amount_ml').gte('logged_at', limites7.inicio).lt('logged_at', limites7.fim),
    supabase.from('daily_activity').select('day, steps, resting_hr').gte('day', inicio56),
    supabase.from('workouts').select('title, started_at, ended_at').gte('started_at', new Date(a56, m56 - 1, d56).toISOString()),
    carregarMedidas(),
    inicioDoAcompanhamento(),
  ]);
  for (const r of [treinos, agua, atividade56, treinos56]) if (r.error) throw r.error;

  // Tendências semanais do relógio e dos treinos
  const ativ = (atividade56.data ?? []) as { day: string; steps: number | null; resting_hr: number | null }[];
  const media = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
  const semanasPassos = porSemana(ativ.filter((a) => a.steps != null).map((a) => ({ dia: a.day, valor: Number(a.steps) })), 8, hoje);
  const semanasFc = porSemana(ativ.filter((a) => a.resting_hr != null).map((a) => ({ dia: a.day, valor: Number(a.resting_hr) })), 8, hoje);
  const semanasTreinos = porSemana(sessoesDasLinhas(treinos56.data).map((t) => ({ dia: t.dia, valor: 1 })), 8, hoje);
  // Primeiro dia com qualquer dado (passos do relógio inclusive): semanas antes disso ficam de fora.
  const primeiroPasso = ativ.filter((a) => a.steps != null).map((a) => a.day).sort()[0] ?? null;
  const inicioTendencias = [inicioApp.qualquer, primeiroPasso].filter((x): x is string => !!x).sort()[0] ?? null;
  const tendencias = desdeOPrimeiroDado(
    semanasPassos.map((s, i) => ({
      semana: s.semana,
      passos: media(s.valores),
      fcRepouso: media(semanasFc[i].valores),
      treinos: semanasTreinos[i].valores.length,
    })),
    inicioTendencias,
  );

  // Perimetria: evolução de cada medida e relação cintura ÷ altura
  const medidas = MEDIDAS.map((m) => resumir(registrosMedidas, m)).filter((r): r is ResumoMedida => r != null);
  const cinturaAtual = medidas.find((r) => r.medida.codigo === 'cintura')?.atual.valores[0] ?? null;
  const relacaoCintura = cinturaAtual != null && perfil.height_cm ? relacaoCinturaAltura(cinturaAtual, perfil.height_cm) : null;

  const analise = analisar({ perfil, pesagens: pesagensTodas, ...historico, hoje });
  const inicioPeriodo = somarDias(hoje, -(periodoDias - 1));
  // 7 dias completos (até ontem): o dia de hoje ainda está pela metade.
  const ultimos7 = Array.from({ length: 7 }, (_, i) => analise.balancoDe(somarDias(inicio7, i - 1)));
  const listaTreinos = (treinos.data ?? []) as { active_kcal: number | null }[];
  const aguaTotal = (agua.data ?? []).reduce((s, r) => s + Number(r.amount_ml), 0);
  const proteinas = historico.nutricoes
    .filter((n) => n.day >= inicio7 && n.day < hoje && n.protein_g != null)
    .map((n) => n.protein_g as number);

  return {
    ritmo: ritmoSemanal(analise.medias),
    proteinaMediaSemana: proteinas.length ? Math.round(proteinas.reduce((s, x) => s + x, 0) / proteinas.length) : null,
    metaProteina: analise.pesoRef != null ? metaProteina(analise.pesoRef) : null,
    medidas,
    relacaoCintura,
    tendencias,
    perfil,
    perfilCompleto: perfilEstaCompleto(perfil),
    pesagens: pesagensTodas.filter((p) => p.dia >= inicioPeriodo),
    medias: analise.medias.filter((p) => p.dia >= inicioPeriodo),
    projecao: analise.projecao,
    deficitMedio: analise.deficitMedio,
    ultimos7,
    semana: resumirPeriodo(ultimos7),
    treinosSemana: { quantidade: sessoesDasLinhas(treinos.data).length, kcal: listaTreinos.reduce((s, t) => s + (t.active_kcal ?? 0), 0) },
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
  const balancoOntem = analise.balancoDe(somarDias(hoje, -1));
  const nutriHoje = historico.nutricoes.find((n) => n.day === hoje);
  const agora = new Date();
  const tmb = tmbDoPerfil(perfil, analise.pesoRef, hoje);
  const atividadeHoje = historico.atividades.find((a) => a.day === hoje);
  const plano =
    tmb == null
      ? null
      : planoDoDia({
          tmb,
          kcalAtivas: atividadeHoje?.active_kcal ?? null,
          kcalTotais: atividadeHoje?.total_kcal ?? null,
          fatorAtividade: perfil.activity_factor,
          ajusteKcal: analise.ajusteKcalDia,
          fracaoDoDia: fracaoDoDia(agora.getHours() * 60 + agora.getMinutes()),
          consumoKcal: balancoHoje.consumo,
          gastoTipicoRelogio: tipicoDoRelogio(historico.atividades, tmb, hoje),
          passos: atividadeHoje?.steps ?? null,
          pesoKg: analise.pesoRef,
          kcalTreinos: kcalTreinosPorDia(historico.treinos, analise.pesoRef).get(hoje) ?? null,
        });

  const sugestao = sugestaoDeMeta(perfil, analise, hoje);
  const meta =
    perfil.calorie_goal != null
      ? { kcal: perfil.calorie_goal, sugerida: false }
      : sugestao
        ? { kcal: (sugestao.opcoes.find((o) => o.ritmo === 'moderado') as OpcaoMeta).kcal, sugerida: true }
        : null;

  return {
    plano,
    meta,
    tarde: agora.getHours() >= 15,
    horaParcial: `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`,
    ontem: { gasto: balancoOntem.gasto, consumo: balancoOntem.consumo, deficit: balancoOntem.deficit },
    macros: nutriHoje ? { proteina: nutriHoje.protein_g, carbo: nutriHoje.carbs_g, gordura: nutriHoje.fat_g } : null,
    metaProteina: mediaHoje != null ? metaProteina(mediaHoje) : null,
    ritmo: ritmoSemanal(analise.medias),
    perfil,
    perfilCompleto: perfilEstaCompleto(perfil),
    pesoAtual,
    variacaoSemanaKg,
    aguaMl: (agua.data ?? []).reduce((s, r) => s + Number(r.amount_ml), 0),
    atividade: historico.atividades.find((a) => a.day === hoje) ?? null,
    treinos: ((treinos.data ?? []) as Treino[]).map((t) => ({
      ...t,
      kcal: kcalDoTreino({ titulo: t.title, inicio: t.started_at, fim: t.ended_at, kcal: t.active_kcal, app: t.origin_app }, analise.pesoRef),
    })),
    consumoKcal: balancoHoje.consumo,
    gasto: analise.gastoDoDia(hoje),
    deficitHoje: balancoHoje.deficit,
    deficitMedio: analise.deficitMedio,
    projecao: analise.projecao,
  };
}

export type RelatorioSemanal = {
  semana: { inicio: string; fim: string };
  atual: MetricasSemana;
  anterior: MetricasSemana;
  itens: ItemComparacao[];
  alertaDeficit: boolean;
  noitesAbaixoDe7h: number;
  diasComCheckin: number;
};

/** Métricas da semana do relatório (seg–dom) comparadas com a semana anterior. */
export async function carregarRelatorioSemanal(): Promise<RelatorioSemanal> {
  const hoje = diaLocal();
  const semana = semanaDoRelatorio(hoje);
  const inicioAnterior = somarDias(semana.inicio, -7);
  const [a, m, d] = inicioAnterior.split('-').map(Number);
  const [af, mf, df] = semana.fim.split('-').map(Number);
  const janela = { inicio: new Date(a, m - 1, d).toISOString(), fim: new Date(af, mf - 1, df + 1).toISOString() };

  const [perfil, pesagens, historico, noites, checkins, agua, treinos] = await Promise.all([
    carregarPerfil(),
    carregarPesagens(42),
    carregarHistorico28(hoje),
    carregarNoites(14, semana.fim),
    carregarCheckins(14, semana.fim),
    supabase.from('water_entries').select('amount_ml, logged_at').gte('logged_at', janela.inicio).lt('logged_at', janela.fim),
    supabase.from('workouts').select('title, started_at, ended_at').gte('started_at', janela.inicio).lt('started_at', janela.fim),
  ]);
  if (agua.error) throw agua.error;
  if (treinos.error) throw treinos.error;

  const analise = analisar({ perfil, pesagens, ...historico, hoje });

  const metricas = (inicio: string): MetricasSemana => {
    const fim = somarDias(inicio, 6);
    const dentro = (dia: string) => dia >= inicio && dia <= fim;
    const diaDe = (iso: string) => diaLocal(new Date(iso));
    const pesos = pesagens.filter((p) => dentro(p.dia)).map((p) => p.pesoKg);
    const deficits = Array.from({ length: 7 }, (_, i) => analise.balancoDe(somarDias(inicio, i)).deficit).filter(
      (x): x is number => x != null,
    );
    const aguaSemana = (agua.data ?? []).filter((r) => dentro(diaDe(r.logged_at as string)));
    const sono = resumirSono(noites.filter((n) => dentro(n.dia)));
    const chk = checkins.filter((c) => dentro(c.dia));
    return {
      pesoMedioKg: pesos.length ? Math.round((pesos.reduce((s, p) => s + p, 0) / pesos.length) * 10) / 10 : null,
      deficitTotal: deficits.length ? deficits.reduce((s, x) => s + x, 0) : null,
      treinos: sessoesDasLinhas(treinos.data).filter((t) => dentro(t.dia)).length,
      aguaMediaMl: aguaSemana.length ? Math.round(aguaSemana.reduce((s, r) => s + Number(r.amount_ml), 0) / 7) : null,
      sonoMedioMin: sono.mediaMin,
      variacaoDormirMin: sono.variacaoMin,
      energia: mediaCampo(chk, 'energia'),
      fome: mediaCampo(chk, 'fome'),
      humor: mediaCampo(chk, 'humor'),
    };
  };

  const atual = metricas(semana.inicio);
  const anterior = metricas(inicioAnterior);
  const checkinsSemana = checkins.filter((c) => c.dia >= semana.inicio && c.dia <= semana.fim);
  return {
    semana,
    atual,
    anterior,
    itens: compararSemanas(atual, anterior),
    alertaDeficit: alertaDeficitAgressivo(checkinsSemana),
    noitesAbaixoDe7h: resumirSono(noites.filter((n) => n.dia >= semana.inicio && n.dia <= semana.fim)).abaixoDe7h,
    diasComCheckin: checkinsSemana.length,
  };
}

function lerValores(linha: Record<string, unknown>): Valores {
  const out: Valores = {};
  for (const c of COLUNAS) out[c] = linha[c] == null ? null : Number(linha[c]);
  return out;
}

/** Todos os dias com alguma medida de fita (cintura, braço…), do mais antigo ao mais novo. */
export async function carregarMedidas(): Promise<RegistroMedidas[]> {
  const { data, error } = await supabase.from('body_entries').select(`measured_on, ${COLUNAS.join(', ')}`).order('measured_on');
  if (error) throw error;
  return ((data ?? []) as unknown as Record<string, unknown>[])
    .map((r) => ({ dia: r.measured_on as string, valores: lerValores(r) }))
    .filter((r) => Object.values(r.valores).some((v) => v != null));
}

/**
 * Corrige o total de um dia à mão (ex.: refeição lançada depois no FatSecret, que
 * não chega ao Health Connect). A sincronização não sobrescreve um dia corrigido.
 */
export async function corrigirDieta(
  dia: string,
  v: { kcal: number; proteina: number | null; carbo: number | null; gordura: number | null },
): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await supabase.from('nutrition_days').upsert(
    {
      user_id: u.user?.id,
      day: dia,
      kcal: Math.round(v.kcal),
      protein_g: v.proteina,
      carbs_g: v.carbo,
      fat_g: v.gordura,
      source: 'manual',
      synced_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,day' },
  );
  if (error) throw error;
}

/** Desfaz a correção: o dia volta a usar o que vier do FatSecret na próxima sincronização. */
export async function removerCorrecaoDieta(dia: string): Promise<void> {
  const { error } = await supabase.from('nutrition_days').delete().eq('day', dia).eq('source', 'manual');
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Análises (Progresso › Resumo e Hoje › Recuperação)

export type Analises = {
  padroes: Padrao[];
  constancia: Constancia;
  /** Nota das últimas 8 semanas (seg–dom); a última é a atual, ainda incompleta. */
  constanciaSemanas: { semana: string; nota: number }[];
  sequencias: Sequencias;
  sinais: SinalCorpo[];
  gordura: { dia: string; pct: number; massaGordaKg: number | null; massaMagraKg: number | null }[];
  dieta7: { proteinaGkg: number | null; fibra: number | null; sodioMg: number | null; acucar: number | null; dias: number };
  metaAguaMl: number;
  /** As últimas 8 semanas (seg–dom), dia a dia; a última é a atual. */
  semanasDiaADia: SemanaDiaADia[];
  meta: {
    kcal: number;
    sugerida: boolean;
    semana: SemanaAtual;
    ultimos7: MetaPeriodo;
    /** Os 7 dias completos, para a coluna da tabela. */
    dias7: { dia: string; consumo: number | null }[];
    desdeInicio: DesdeInicio | null;
    /** Seguindo a meta todo dia: déficit planejado e quando a meta de peso chega. */
    projecao: { deficitPlanejado: number; projecao: Projecao | null } | null;
  } | null;
};

/**
 * Primeiro dia com dados no app. pesoOuDieta: primeira pesagem ou dieta (base do "desde o começo");
 * qualquer: inclui o primeiro treino, para não mostrar semanas vazias antes de você começar a usar o app.
 */
async function inicioDoAcompanhamento(): Promise<{ pesoOuDieta: string | null; qualquer: string | null }> {
  const [peso, dieta, treino] = await Promise.all([
    supabase.from('body_entries').select('measured_on').not('weight_kg', 'is', null).order('measured_on').limit(1).maybeSingle(),
    supabase.from('nutrition_days').select('day').gt('kcal', 0).order('day').limit(1).maybeSingle(),
    supabase.from('workouts').select('started_at').order('started_at').limit(1).maybeSingle(),
  ]);
  const pd = [peso.data?.measured_on as string | undefined, dieta.data?.day as string | undefined].filter((x): x is string => !!x).sort();
  const tr = treino.data?.started_at ? diaLocal(new Date(treino.data.started_at as string)) : null;
  const todos = [...pd, ...(tr ? [tr] : [])].sort();
  return { pesoOuDieta: pd[0] ?? null, qualquer: todos[0] ?? null };
}

/** Tira as semanas (seg–dom) que terminaram antes do primeiro dado. */
function desdeOPrimeiroDado<T extends { semana: string }>(semanas: T[], inicio: string | null): T[] {
  if (!inicio) return semanas.slice(-1);
  return semanas.filter((s) => somarDias(s.semana, 6) >= inicio);
}

/** Junta 63 dias de tudo num dia consolidado por data. */
async function diasConsolidados(hoje: string, n: number, gastoDe?: (dia: string) => number | null): Promise<DiaConsolidado[]> {
  const desde = somarDias(hoje, -(n - 1));
  const [a, m, d] = desde.split('-').map(Number);
  const inicioIso = new Date(a, m - 1, d).toISOString();
  const [nutri, agua, treinos, logs, pesos, noites, checkins, recorrentes] = await Promise.all([
    supabase.from('nutrition_days').select('day, kcal').gte('day', desde),
    supabase.from('water_entries').select('amount_ml, logged_at').gte('logged_at', inicioIso),
    supabase.from('workouts').select('id, source, origin_app, title, started_at, ended_at').gte('started_at', inicioIso),
    supabase.from('activity_logs').select('day, status, recurring_id').gte('day', desde),
    supabase.from('body_entries').select('measured_on').not('weight_kg', 'is', null).gte('measured_on', desde),
    carregarNoites(n, hoje),
    carregarCheckins(n, hoje),
    supabase.from('recurring_activities').select('id, activity, custom_name, weekdays, start_time, duration_min, enabled, created_at'),
  ]);
  for (const r of [nutri, agua, treinos, logs, pesos, recorrentes]) if (r.error) throw r.error;
  const sessoes = sessoesDasLinhas(treinos.data);
  const gravados: TreinoGravado[] = (treinos.data ?? []).map((t) => ({
    id: t.id as number,
    inicio: t.started_at as string,
    fim: (t.ended_at as string | null) ?? null,
    titulo: (t.title as string | null) ?? null,
    app: (t.origin_app as string | null) ?? null,
    kcal: null,
    manual: t.source === 'manual',
  }));
  const listaLogs = (logs.data ?? []) as { day: string; status: string; recurring_id: number | null }[];
  /** Recorrentes previstas para o dia: feito (marcado ou o relógio/Hevy gravou no horário), não feito ou sem registro. */
  const previstasDe = (dia: string): PrevistaDoDia[] =>
    ((recorrentes.data ?? []) as Record<string, unknown>[])
      .filter((r) => (r.weekdays as number[]).includes(diaDaSemana(dia)) && diaLocal(new Date(r.created_at as string)) <= dia)
      .flatMap((r): PrevistaDoDia[] => {
        const log = listaLogs.find((l) => l.day === dia && l.recurring_id === r.id);
        if (!log && !r.enabled) return [];
        const nome = nomeDaAtividade(r.activity as string, r.custom_name as string | null);
        if (log) return [{ nome, estado: log.status === 'feito' ? ('feito' as const) : ('nao_feito' as const) }];
        const mesmoNome = sessoes.some((t) => t.dia === dia && t.titulos.some((x) => x.toLowerCase() === nome.toLowerCase()));
        const gravado = mesmoNome || treinoCorrespondente(dia, r.start_time as string, r.duration_min as number, gravados, new Set(), treinoCombinaCom(r.activity as string));
        return [{ nome, estado: gravado ? ('feito' as const) : ('sem_registro' as const) }];
      });
  const aguaDia = new Map<string, number>();
  for (const w of agua.data ?? []) {
    const k = diaLocal(new Date(w.logged_at as string));
    aguaDia.set(k, (aguaDia.get(k) ?? 0) + Number(w.amount_ml));
  }
  const treinou = new Set([
    ...sessoesDasLinhas(treinos.data).map((t) => t.dia),
    ...listaLogs.filter((l) => l.status === 'feito').map((l) => l.day),
  ]);
  const pesou = new Set((pesos.data ?? []).map((p) => p.measured_on as string));
  return Array.from({ length: n }, (_, i) => {
    const dia = somarDias(desde, i);
    const nu = (nutri.data ?? []).find((x) => x.day === dia);
    const c = checkins.find((x) => x.dia === dia);
    return {
      dia,
      consumo: nu && Number(nu.kcal) > 0 ? Number(nu.kcal) : null,
      gasto: gastoDe ? gastoDe(dia) : null,
      sonoMin: noites.find((x) => x.dia === dia)?.duracaoMin ?? null,
      fome: c?.fome ?? null,
      energia: c?.energia ?? null,
      humor: c?.humor ?? null,
      treinou: treinou.has(dia),
      aguaMl: aguaDia.get(dia) ?? 0,
      pesou: pesou.has(dia),
      sessoes: sessoes.filter((t) => t.dia === dia).map((t) => t.titulos.join(' + ') || 'Treino'),
      previstas: dia <= hoje ? previstasDe(dia) : [],
    };
  });
}

export async function carregarAnalises(): Promise<Analises> {
  const hoje = diaLocal();
  // Início do acompanhamento: primeira pesagem ou primeiro dia de dieta (até 1 ano atrás).
  const { pesoOuDieta: inicioAcomp, qualquer: inicioDados } = await inicioDoAcompanhamento();
  const diasHistorico = inicioAcomp ? Math.min(365, Math.max(63, Math.round((Date.parse(hoje) - Date.parse(inicioAcomp)) / 86_400_000) + 1)) : 63;
  const [perfil, pesagens, historico, medidas, dobras] = await Promise.all([
    carregarPerfil(),
    carregarPesagens(Math.max(70, diasHistorico + 7)),
    carregarHistorico28(hoje, diasHistorico),
    carregarMedidas(),
    supabase
      .from('body_entries')
      .select('measured_on, weight_kg, sf_chest_mm, sf_axillary_mm, sf_triceps_mm, sf_subscapular_mm, sf_abdominal_mm, sf_suprailiac_mm, sf_thigh_mm')
      .not('sf_thigh_mm', 'is', null)
      .order('measured_on'),
  ]);
  if (dobras.error) throw dobras.error;
  const analise = analisar({ perfil, pesagens, ...historico, hoje });
  const dias = await diasConsolidados(hoje, 63, (d) => (d < hoje ? analise.balancoDe(d).gasto : null));
  const ateOntem = dias.filter((d) => d.dia < hoje);
  const metaAguaMl = perfil.water_goal_ml;

  // Constância: últimas 8 semanas seg–dom (a atual vai até hoje)
  const segunda = inicioDaSemana(hoje);
  const constanciaSemanas = Array.from({ length: 8 }, (_, i) => {
    const ini = somarDias(segunda, -7 * (7 - i));
    const semana = dias.filter((d) => d.dia >= ini && d.dia <= somarDias(ini, 6));
    return { semana: ini, nota: constanciaDaSemana(semana, metaAguaMl).nota };
  }).filter((s) => !inicioDados || somarDias(s.semana, 6) >= inicioDados);

  // Platô e recomposição
  const mediaEm = (dia: string) => [...analise.medias].reverse().find((p) => p.dia <= dia)?.pesoKg ?? null;
  const cinturas = medidas.filter((r) => r.valores.waist_cm != null).map((r) => ({ dia: r.dia, cm: r.valores.waist_cm as number }));
  const cinturaAtual = cinturas.at(-1) ?? null;
  const cinturaAntes = cinturaAtual ? ([...cinturas].reverse().find((c) => Date.parse(cinturaAtual.dia) - Date.parse(c.dia) >= 21 * 86_400_000) ?? null) : null;
  const deficits14 = Array.from({ length: 14 }, (_, i) => analise.balancoDe(somarDias(hoje, -14 + i)).deficit).filter((x): x is number => x != null);

  // % de gordura pelas dobras
  const idade = perfil.birth_date ? idadeEmAnos(perfil.birth_date, hoje) : null;
  const gordura = (dobras.data ?? []).flatMap((r) => {
    const mm = DOBRAS.map((x) => (r as Record<string, unknown>)[x.coluna]).map((v) => (v == null ? NaN : Number(v)));
    const pct = idade != null && perfil.sex ? gorduraPollock7(mm, idade, perfil.sex) : null;
    if (pct == null) return [];
    const peso = r.weight_kg != null ? Number(r.weight_kg) : (pesagens.filter((p) => p.dia <= (r.measured_on as string)).at(-1)?.pesoKg ?? null);
    return [
      {
        dia: r.measured_on as string,
        pct,
        massaGordaKg: peso != null ? Math.round(peso * pct) / 100 : null,
        massaMagraKg: peso != null ? Math.round(peso * (100 - pct)) / 100 : null,
      },
    ];
  });

  // Dieta dos 7 dias completos
  const ini7 = somarDias(hoje, -7);
  const { data: n7, error: e7 } = await supabase.from('nutrition_days').select('protein_g, fiber_g, sodium_mg, sugar_g, kcal').gte('day', ini7).lt('day', hoje);
  if (e7) throw e7;
  const comDieta = (n7 ?? []).filter((x) => Number(x.kcal) > 0);
  const med = (campo: 'protein_g' | 'fiber_g' | 'sodium_mg' | 'sugar_g') => {
    const v = comDieta.map((x) => x[campo]).filter((x) => x != null).map(Number);
    return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
  };
  const prot = med('protein_g');

  // Meta de calorias × o que aconteceu
  const sugestao = sugestaoDeMeta(perfil, analise, hoje);
  const metaKcal = perfil.calorie_goal ?? (sugestao?.opcoes.find((o) => o.ritmo === 'moderado')?.kcal ?? null);
  let meta: Analises['meta'] = null;
  if (metaKcal != null) {
    const balanco = (d: string) => analise.balancoDe(d);
    const segunda = inicioDaSemana(hoje);
    const diasSemana = Array.from({ length: 7 }, (_, i) => somarDias(segunda, i)).filter((d) => d <= hoje).map(balanco);
    const dias7 = Array.from({ length: 7 }, (_, i) => balanco(somarDias(hoje, -7 + i)));
    const balancosTodos = inicioAcomp
      ? Array.from({ length: Math.round((Date.parse(hoje) - Date.parse(inicioAcomp)) / 86_400_000) }, (_, i) => balanco(somarDias(inicioAcomp, i)))
      : [];
    const mediaNoInicio = inicioAcomp ? (analise.medias.find((m) => m.dia >= inicioAcomp)?.pesoKg ?? null) : null;
    const deficitPlanejado = sugestao ? sugestao.gastoBase - metaKcal : null;
    meta = {
      kcal: metaKcal,
      sugerida: perfil.calorie_goal == null,
      semana: semanaAtual(diasSemana, metaKcal, hoje, segunda),
      ultimos7: metaNoPeriodo(dias7, metaKcal),
      dias7: dias7.map((d) => ({ dia: d.dia, consumo: d.consumo })),
      desdeInicio: inicioAcomp
        ? desdeOInicio({
            inicio: inicioAcomp,
            hoje,
            balancos: balancosTodos,
            mediaInicio: mediaNoInicio,
            mediaHoje: analise.pesoRef,
            cinturas: medidas.filter((r) => r.valores.waist_cm != null).map((r) => ({ dia: r.dia, cm: r.valores.waist_cm as number })),
            segundaAtual: segunda,
          })
        : null,
      projecao:
        deficitPlanejado != null
          ? {
              deficitPlanejado,
              projecao:
                perfil.goal_weight_kg != null && analise.pesoRef != null
                  ? projetarMeta({ pesoAtualKg: analise.pesoRef, metaKg: perfil.goal_weight_kg, deficitMedioDiario: deficitPlanejado, hoje })
                  : null,
            }
          : null,
    };
  }

  // Semana dia a dia: 8 semanas seg–dom, a atual inclusive (dias futuros ficam vazios)
  const semanasDiaADia = Array.from({ length: 8 }, (_, i) => {
    const ini = somarDias(segunda, -7 * (7 - i));
    const linhas = Array.from({ length: 7 }, (_, j) => {
      const dia = somarDias(ini, j);
      const c = dias.find((x) => x.dia === dia);
      const b = dia <= hoje ? analise.balancoDe(dia) : null;
      return {
        dia,
        futuro: dia > hoje,
        hoje: dia === hoje,
        consumo: c?.consumo ?? null,
        deficit: dia < hoje ? (b?.deficit ?? null) : null,
        gastoEstimado: b?.gastoEstimado ?? false,
        treinos: c?.sessoes ?? [],
        previstas: c?.previstas ?? [],
        sonoMin: c?.sonoMin ?? null,
        aguaMl: c?.aguaMl ?? 0,
        pesoKg: pesagens.filter((p) => p.dia === dia).at(-1)?.pesoKg ?? null,
      };
    });
    return resumirSemana(ini, linhas, metaKcal);
  }).filter((s) => !inicioDados || somarDias(s.segunda, 6) >= inicioDados);

  return {
    meta,
    semanasDiaADia,
    padroes: encontrarPadroes(dias),
    constancia: constanciaDaSemana(ateOntem.slice(-7), metaAguaMl),
    constanciaSemanas,
    sequencias: sequencias(ateOntem, metaAguaMl),
    sinais: sinaisDoCorpo({
      mediaHoje: analise.pesoRef,
      media14Atras: mediaEm(somarDias(hoje, -14)),
      deficits14,
      cinturaAtual,
      cinturaAntes,
      mediaNoDiaDaCinturaAntes: cinturaAntes ? mediaEm(cinturaAntes.dia) : null,
    }),
    gordura,
    dieta7: {
      proteinaGkg: prot != null && analise.pesoRef ? Math.round((prot / analise.pesoRef) * 10) / 10 : null,
      fibra: med('fiber_g'),
      sodioMg: med('sodium_mg'),
      acucar: med('sugar_g'),
      dias: comDieta.length,
    },
    metaAguaMl,
  };
}

/** Recuperação de hoje (tela Hoje): check-in, sono, carga de treino, déficit e FC de repouso. */
export async function carregarProntidao(): Promise<Prontidao | null> {
  const hoje = diaLocal();
  const desde14 = somarDias(hoje, -14);
  const desde35 = somarDias(hoje, -34);
  const [a, m, d] = desde35.split('-').map(Number);
  const [fc, noites, checkins, treinos, logs, perfil, pesagens, historico] = await Promise.all([
    supabase.from('daily_activity').select('day, resting_hr').gte('day', desde14).not('resting_hr', 'is', null),
    carregarNoites(3, hoje),
    carregarCheckins(1, hoje),
    supabase.from('workouts').select('id, title, started_at, ended_at').gte('started_at', new Date(a, m - 1, d).toISOString()),
    supabase.from('activity_logs').select('workout_id, intensity').eq('status', 'feito').gte('day', desde35),
    carregarPerfil(),
    carregarPesagens(35),
    carregarHistorico28(hoje),
  ]);
  for (const r of [fc, treinos, logs]) if (r.error) throw r.error;

  // Carga de cada treino = minutos × intensidade (0–10): leve 3, moderada 5, intensa 7; sem informação, 5.
  const INTENSIDADE: Record<string, number> = { leve: 3, moderada: 5, intensa: 7 };
  const intensidadeDe = new Map((logs.data ?? []).filter((l) => l.workout_id != null).map((l) => [l.workout_id as number, INTENSIDADE[l.intensity as string] ?? 5]));
  const cargas = sessoesDasLinhas(treinos.data).flatMap((t) => {
    if (t.minutos < 2) return [];
    const intensidade = t.ids.length ? Math.max(...t.ids.map((id) => intensidadeDe.get(id) ?? 5)) : 5;
    return [{ dia: t.dia, carga: Math.round(t.minutos * intensidade) }];
  });

  const analise = analisar({ perfil, pesagens, ...historico, hoje });
  const deficits3 = Array.from({ length: 3 }, (_, i) => analise.balancoDe(somarDias(hoje, -3 + i)).deficit).filter((x): x is number => x != null);

  const lista = (fc.data ?? []) as { day: string; resting_hr: number }[];
  const fcHoje = lista.find((x) => x.day === hoje)?.resting_hr ?? null;
  const anteriores = lista.filter((x) => x.day < hoje).map((x) => Number(x.resting_hr));
  const ultimaNoite = noites.find((n) => n.dia === hoje)?.duracaoMin ?? null;
  const c = checkins.find((x) => x.dia === hoje);
  return prontidao({
    hoje,
    energia: c?.energia ?? null,
    dor: c?.dor ?? null,
    humor: c?.humor ?? null,
    sonoMin: ultimaNoite,
    sono3Min: noites.length >= 2 ? Math.round(noites.reduce((s, n) => s + n.duracaoMin, 0) / noites.length) : null,
    cargas,
    deficits3,
    fcHoje: fcHoje != null ? Number(fcHoje) : null,
    fcMedia: anteriores.length >= 5 ? anteriores.reduce((s, x) => s + x, 0) / anteriores.length : null,
  });
}
