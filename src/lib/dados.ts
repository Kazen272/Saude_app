import {
  ajusteDeGasto,
  deficit,
  fracaoDoDia,
  gastoDiario,
  metaProteina,
  planoDoDia,
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
} from './calculos';
import { diaLocal, limitesDoDia, porSemana, somarDias } from './datas';
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
import { COLUNAS, MEDIDAS, resumir, type RegistroMedidas, type ResumoMedida, type Valores } from './medidas';
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

type Atividade = { day: string; steps: number | null; active_kcal: number | null; total_kcal: number | null; resting_hr: number | null; sleep_minutes: number | null };
type Nutricao = { day: string; kcal: number | null; protein_g: number | null; carbs_g: number | null; fat_g: number | null };
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
  checkin: { energia: number | null; fome: number | null; humor: number | null } | null;
};

const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Tudo o que foi registrado num dia, para revisar, corrigir ou apagar. */
export async function carregarRegistrosDoDia(dia: string): Promise<RegistrosDoDia> {
  const [a, m, d] = dia.split('-').map(Number);
  const { inicio, fim } = limitesDoDia(new Date(a, m - 1, d));
  const [corpo, agua, sono, checkin] = await Promise.all([
    supabase.from('body_entries').select(`weight_kg, source, ${COLUNAS.join(', ')}`).eq('measured_on', dia).maybeSingle(),
    supabase.from('water_entries').select('id, amount_ml, logged_at').gte('logged_at', inicio).lt('logged_at', fim).order('logged_at'),
    supabase.from('sleep_sessions').select('bed_at, wake_at, quality, source').eq('night', dia),
    supabase.from('daily_checkins').select('energy, hunger, mood').eq('day', dia).maybeSingle(),
  ]);
  for (const r of [corpo, agua, sono, checkin]) if (r.error) throw r.error;
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
    checkin: checkin.data ? { energia: checkin.data.energy as number | null, fome: checkin.data.hunger as number | null, humor: checkin.data.mood as number | null } : null,
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

function calculadoraDeGasto(perfil: Perfil, pesoRefKg: number | null, atividades: Atividade[], hoje: string, ajusteKcal = 0) {
  const tmb = tmbDoPerfil(perfil, pesoRefKg, hoje);
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
    });
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
    supabase.from('daily_activity').select('day, steps, active_kcal, total_kcal, resting_hr, sleep_minutes').gte('day', desde),
    supabase.from('nutrition_days').select('day, kcal, protein_g, carbs_g, fat_g').gte('day', desde),
  ]);
  if (atividades.error) throw atividades.error;
  if (nutricoes.error) throw nutricoes.error;
  const nutricoesNum = (nutricoes.data ?? []).map((n) => ({
    day: n.day as string,
    kcal: num(n.kcal),
    protein_g: num(n.protein_g),
    carbs_g: num(n.carbs_g),
    fat_g: num(n.fat_g),
  }));
  return { atividades: (atividades.data ?? []) as Atividade[], nutricoes: nutricoesNum as Nutricao[] };
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
  const [perfil, pesagensTodas, historico, treinos, agua, atividade56, treinos56, registrosMedidas] = await Promise.all([
    carregarPerfil(),
    carregarPesagens(Math.max(periodoDias, 28) + 7),
    carregarHistorico28(hoje),
    supabase.from('workouts').select('active_kcal').gte('started_at', limites7.inicio).lt('started_at', limites7.fim),
    supabase.from('water_entries').select('amount_ml').gte('logged_at', limites7.inicio).lt('logged_at', limites7.fim),
    supabase.from('daily_activity').select('day, steps, resting_hr').gte('day', inicio56),
    supabase.from('workouts').select('started_at').gte('started_at', new Date(a56, m56 - 1, d56).toISOString()),
    carregarMedidas(),
  ]);
  for (const r of [treinos, agua, atividade56, treinos56]) if (r.error) throw r.error;

  // Tendências semanais do relógio e dos treinos
  const ativ = (atividade56.data ?? []) as { day: string; steps: number | null; resting_hr: number | null }[];
  const media = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
  const semanasPassos = porSemana(ativ.filter((a) => a.steps != null).map((a) => ({ dia: a.day, valor: Number(a.steps) })), 8, hoje);
  const semanasFc = porSemana(ativ.filter((a) => a.resting_hr != null).map((a) => ({ dia: a.day, valor: Number(a.resting_hr) })), 8, hoje);
  const semanasTreinos = porSemana(((treinos56.data ?? []) as { started_at: string }[]).map((t) => ({ dia: diaLocal(new Date(t.started_at)), valor: 1 })), 8, hoje);
  const tendencias = semanasPassos.map((s, i) => ({
    semana: s.semana,
    passos: media(s.valores),
    fcRepouso: media(semanasFc[i].valores),
    treinos: semanasTreinos[i].valores.length,
  }));

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
        });

  return {
    plano,
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
    treinos: (treinos.data ?? []) as Treino[],
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
    supabase.from('workouts').select('started_at').gte('started_at', janela.inicio).lt('started_at', janela.fim),
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
      treinos: (treinos.data ?? []).filter((t) => dentro(diaDe(t.started_at as string))).length,
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
