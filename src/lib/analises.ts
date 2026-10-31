// Análises que cruzam os dados: padrões, constância, prontidão, platô e composição corporal.
// Funções puras; os textos explicam o cálculo para a pessoa entender de onde vem cada número.

import type { Sexo } from './calculos.ts';
import { diaDaSemana } from './atividades.ts';

const media = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

// ---------------------------------------------------------------------------
// Dia consolidado: tudo o que se sabe de um dia, para cruzar.

export type DiaConsolidado = {
  dia: string;
  consumo: number | null;
  gasto: number | null;
  /** Sono da noite que terminou neste dia (min). */
  sonoMin: number | null;
  fome: number | null;
  energia: number | null;
  humor: number | null;
  treinou: boolean;
  aguaMl: number;
  pesou: boolean;
};

// ---------------------------------------------------------------------------
// 1. Padrões

export type Padrao = { id: string; titulo: string; texto: string; comoCalcula: string };

const MIN_DIAS = 3;

/** Compara dois grupos de dias; só fala quando cada grupo tem pelo menos 3 dias. */
function comparar(a: DiaConsolidado[], b: DiaConsolidado[], campo: 'consumo' | 'fome' | 'energia') {
  const va = a.map((d) => d[campo]).filter((v): v is number => v != null);
  const vb = b.map((d) => d[campo]).filter((v): v is number => v != null);
  if (va.length < MIN_DIAS || vb.length < MIN_DIAS) return null;
  return { a: media(va) as number, b: media(vb) as number, na: va.length, nb: vb.length };
}

export function encontrarPadroes(dias: DiaConsolidado[]): Padrao[] {
  const padroes: Padrao[] = [];
  const kcal = (n: number) => `${Math.round(Math.abs(n)).toLocaleString('pt-BR')} kcal`;
  const um = (n: number) => n.toFixed(1).replace('.', ',');

  // Sono curto × dia seguinte
  const curtos = dias.filter((d) => d.sonoMin != null && d.sonoMin < 6 * 60);
  const bons = dias.filter((d) => d.sonoMin != null && d.sonoMin >= 7 * 60);
  const sc = comparar(curtos, bons, 'consumo');
  const sf = comparar(curtos, bons, 'fome');
  if (sc && Math.abs(sc.a - sc.b) >= 150) {
    padroes.push({
      id: 'sono-consumo',
      titulo: sc.a > sc.b ? 'Dormir pouco aumenta o que você come' : 'Dormir pouco não aumentou o que você come',
      texto: `Depois de noites com menos de 6h de sono, você comeu em média ${kcal(sc.a - sc.b)} ${sc.a > sc.b ? 'a mais' : 'a menos'} do que depois de noites com 7h ou mais${
        sf && sf.a - sf.b >= 0.5 ? `, e a fome no check-in foi ${um(sf.a)} contra ${um(sf.b)}` : ''
      }.`,
      comoCalcula: `Compara o consumo do dia seguinte a ${sc.na} noites curtas (< 6h) com ${sc.nb} noites boas (≥ 7h), nos últimos 60 dias.`,
    });
  } else if (sf && sf.a - sf.b >= 0.5) {
    padroes.push({
      id: 'sono-fome',
      titulo: 'Dormir pouco aumenta a fome',
      texto: `Depois de noites com menos de 6h, sua fome no check-in foi ${um(sf.a)} (de 5), contra ${um(sf.b)} depois de noites com 7h ou mais.`,
      comoCalcula: `Compara a fome do check-in em ${sf.na} dias após noites curtas com ${sf.nb} dias após noites boas, nos últimos 60 dias.`,
    });
  }

  // Fim de semana × dias úteis
  const fds = dias.filter((d) => [1, 7].includes(diaDaSemana(d.dia)));
  const uteis = dias.filter((d) => ![1, 7].includes(diaDaSemana(d.dia)));
  const fc = comparar(fds, uteis, 'consumo');
  if (fc && Math.abs(fc.a - fc.b) >= 200) {
    padroes.push({
      id: 'fim-de-semana',
      titulo: fc.a > fc.b ? 'O fim de semana pesa na conta' : 'Você come menos no fim de semana',
      texto: `Sábado e domingo você come em média ${kcal(fc.a)} por dia, contra ${kcal(fc.b)} de segunda a sexta (${kcal(fc.a - fc.b)} ${fc.a > fc.b ? 'a mais' : 'a menos'}).`,
      comoCalcula: `Média do consumo registrado em ${fc.na} dias de fim de semana e ${fc.nb} dias úteis, nos últimos 60 dias.`,
    });
  }

  // Treino × fome e energia no mesmo dia
  const comTreino = dias.filter((d) => d.treinou);
  const semTreino = dias.filter((d) => !d.treinou);
  const tf = comparar(comTreino, semTreino, 'fome');
  const te = comparar(comTreino, semTreino, 'energia');
  if ((tf && Math.abs(tf.a - tf.b) >= 0.5) || (te && Math.abs(te.a - te.b) >= 0.5)) {
    const partes = [
      tf && Math.abs(tf.a - tf.b) >= 0.5 ? `fome ${um(tf.a)} contra ${um(tf.b)}` : null,
      te && Math.abs(te.a - te.b) >= 0.5 ? `energia ${um(te.a)} contra ${um(te.b)}` : null,
    ].filter(Boolean);
    padroes.push({
      id: 'treino',
      titulo: 'Como você fica nos dias de treino',
      texto: `Nos dias com treino, o check-in marca ${partes.join(' e ')} dos dias sem treino (escala de 1 a 5).`,
      comoCalcula: `Compara o check-in de ${(tf ?? te)?.na} dias com treino e ${(tf ?? te)?.nb} dias sem, nos últimos 60 dias. Treino = qualquer treino importado ou atividade marcada como feita.`,
    });
  }
  return padroes;
}

// ---------------------------------------------------------------------------
// 4. Constância

export type Constancia = {
  nota: number;
  itens: { id: string; nome: string; feito: number; meta: number; pontos: number; max: number }[];
};

/**
 * Nota de 0 a 100 de uma semana (7 dias): mede regularidade, não resultado.
 * Dieta registrada 25 · água na meta 15 · treinos 20 (meta 3) · sono 7h+ 20 · pesagens 20 (meta 3).
 */
export function constanciaDaSemana(dias: DiaConsolidado[], metaAguaMl: number): Constancia {
  const n = dias.length || 1;
  const item = (id: string, nome: string, feito: number, meta: number, max: number) => ({
    id,
    nome,
    feito,
    meta,
    max,
    pontos: Math.round(Math.min(1, feito / meta) * max),
  });
  const itens = [
    item('dieta', 'Dias com dieta registrada', dias.filter((d) => d.consumo != null).length, n, 25),
    item('agua', 'Dias na meta de água', dias.filter((d) => d.aguaMl >= metaAguaMl).length, n, 15),
    item('treinos', 'Dias com treino', dias.filter((d) => d.treinou).length, 3, 20),
    item('sono', 'Noites com 7h ou mais', dias.filter((d) => d.sonoMin != null && d.sonoMin >= 7 * 60).length, n, 20),
    item('peso', 'Pesagens', dias.filter((d) => d.pesou).length, 3, 20),
  ];
  return { nota: itens.reduce((s, i) => s + i.pontos, 0), itens };
}

export type Sequencias = { dieta: number; agua: number; deficit: number };

/** Dias seguidos (contando de trás para frente a partir do último dia da lista). */
export function sequencias(dias: DiaConsolidado[], metaAguaMl: number): Sequencias {
  const ord = [...dias].sort((a, b) => b.dia.localeCompare(a.dia));
  const conta = (ok: (d: DiaConsolidado) => boolean) => {
    let n = 0;
    for (const d of ord) {
      if (!ok(d)) break;
      n += 1;
    }
    return n;
  };
  return {
    dieta: conta((d) => d.consumo != null),
    agua: conta((d) => d.aguaMl >= metaAguaMl),
    deficit: conta((d) => d.consumo != null && d.gasto != null && d.gasto - d.consumo > 0),
  };
}

// ---------------------------------------------------------------------------
// 2. Prontidão (recuperação)
//
// Combina vários sinais, porque nenhum sozinho basta:
// • Como você se sente (energia, dor muscular, humor): em atletas, medidas
//   autorrelatadas acompanham a carga de treino melhor que as objetivas
//   (Saw, Main & Gastin, BJSM 2016). Por isso pesam mais.
// • Sono da última noite e das últimas 3.
// • Carga de treino: duração × intensidade (método session-RPE de Foster, 2001;
//   leve ≈ 3, moderada ≈ 5, intensa ≈ 7 na escala de 0 a 10). Treino puxado ontem,
//   dias seguidos de treino e semana muito acima do habitual descontam.
// • Déficit calórico grande nos últimos dias.
// • FC de repouso acima da sua média, quando o relógio envia.

export type FatorProntidao = { id: string; nome: string; texto: string; desconto: number; status: 'ok' | 'atencao' | 'sem_dado' };

export type Prontidao = {
  nivel: 'boa' | 'media' | 'baixa';
  pontos: number;
  fatores: FatorProntidao[];
  /** Tem o check-in de hoje (energia e dor)? Sem ele, a avaliação é parcial. */
  completa: boolean;
  sugestao: string;
};

export type CargaDia = { dia: string; carga: number };

export function prontidao(p: {
  hoje: string;
  energia: number | null;
  dor: number | null;
  humor: number | null;
  sonoMin: number | null;
  sono3Min: number | null;
  /** Carga por dia nos últimos 35 dias (pode incluir hoje). */
  cargas: CargaDia[];
  /** Déficit dos últimos 3 dias completos com dieta. */
  deficits3: number[];
  fcHoje: number | null;
  fcMedia: number | null;
}): Prontidao | null {
  const fatores: FatorProntidao[] = [];
  const add = (id: string, nome: string, texto: string, desconto: number, semDado = false) =>
    fatores.push({ id, nome, texto, desconto, status: semDado ? 'sem_dado' : desconto > 0 ? 'atencao' : 'ok' });

  // Como você se sente
  if (p.energia == null && p.dor == null && p.humor == null) add('sentir', 'Como você se sente', 'sem check-in hoje', 0, true);
  else {
    const dEn = p.energia == null ? 0 : p.energia === 1 ? 25 : p.energia === 2 ? 15 : p.energia === 3 ? 5 : 0;
    const dDor = p.dor == null ? 0 : p.dor === 5 ? 25 : p.dor === 4 ? 15 : p.dor === 3 ? 5 : 0;
    const dHu = p.humor != null && p.humor <= 2 ? 10 : 0;
    const partes = [
      p.energia != null ? `energia ${p.energia}/5` : 'energia sem resposta',
      p.dor != null ? `dor ${p.dor}/5` : 'dor sem resposta',
      p.humor != null ? `humor ${p.humor}/5` : null,
    ].filter(Boolean);
    add('sentir', 'Como você se sente', partes.join(' · '), dEn + dDor + dHu);
  }

  // Sono
  if (p.sonoMin == null) add('sono', 'Sono', 'sem registro da última noite', 0, true);
  else {
    const h = (m: number) => `${Math.floor(m / 60)}h${String(Math.round(m % 60)).padStart(2, '0')}`;
    let d = p.sonoMin < 360 ? 20 : p.sonoMin < 420 ? 10 : 0;
    if (p.sono3Min != null && p.sono3Min < 390) d += 5;
    add('sono', 'Sono', `${h(p.sonoMin)} na última noite${p.sono3Min != null ? ` · média de 3 noites ${h(p.sono3Min)}` : ''}`, d);
  }

  // Carga de treino
  const ontem = new Date(Date.parse(p.hoje) - 86_400_000).toISOString().slice(0, 10);
  const cargaDe = (dia: string) => p.cargas.filter((c) => c.dia === dia).reduce((s, c) => s + c.carga, 0);
  let seguidos = 0;
  for (let i = 1; i <= 7; i++) {
    const d = new Date(Date.parse(p.hoje) - i * 86_400_000).toISOString().slice(0, 10);
    if (cargaDe(d) > 0) seguidos += 1;
    else break;
  }
  const inicio7 = new Date(Date.parse(p.hoje) - 6 * 86_400_000).toISOString().slice(0, 10);
  const inicio35 = new Date(Date.parse(p.hoje) - 34 * 86_400_000).toISOString().slice(0, 10);
  const aguda = p.cargas.filter((c) => c.dia >= inicio7 && c.dia <= p.hoje).reduce((s, c) => s + c.carga, 0);
  const anteriores = p.cargas.filter((c) => c.dia >= inicio35 && c.dia < inicio7);
  const semanasComDado = new Set(anteriores.map((c) => Math.floor((Date.parse(c.dia) - Date.parse(inicio35)) / (7 * 86_400_000)))).size;
  const cronicaSemanal = semanasComDado >= 2 ? anteriores.reduce((s, c) => s + c.carga, 0) / 4 : null;
  if (p.cargas.length === 0) add('carga', 'Treinos', 'nenhum treino nos últimos 35 dias', 0, true);
  else {
    const textos: string[] = [];
    let d = 0;
    const cOntem = cargaDe(ontem);
    if (cOntem >= 400) {
      d += 10;
      textos.push('treino puxado ontem');
    } else if (cOntem > 0) textos.push('treinou ontem');
    if (seguidos >= 3) {
      d += 10;
      textos.push(`${seguidos} dias seguidos de treino`);
    }
    if (cronicaSemanal != null && cronicaSemanal > 0 && aguda > cronicaSemanal * 1.5) {
      d += 10;
      textos.push('semana bem acima do seu habitual');
    }
    add('carga', 'Treinos', textos.length ? textos.join(' · ') : 'carga dentro do habitual', d);
  }

  // Déficit
  if (p.deficits3.length < 2) add('deficit', 'Alimentação', 'poucos dias com dieta registrada', 0, true);
  else {
    const m = p.deficits3.reduce((s, x) => s + x, 0) / p.deficits3.length;
    const d = m > 1000 ? 15 : m > 750 ? 10 : 0;
    add('deficit', 'Alimentação', d ? `déficit médio de ${Math.round(m)} kcal nos últimos dias` : 'déficit moderado', d);
  }

  // FC de repouso
  if (p.fcHoje == null || p.fcMedia == null) add('fc', 'FC de repouso', 'sem dados do relógio', 0, true);
  else {
    const acima = p.fcHoje - p.fcMedia;
    add('fc', 'FC de repouso', acima > 2 ? `${Math.round(acima)} bpm acima da sua média` : 'dentro da sua média', acima > 2 ? Math.round((acima - 2) * 8) : 0);
  }

  const comDado = fatores.filter((f) => f.status !== 'sem_dado');
  if (comDado.length === 0) return null;
  const pontos = Math.max(0, Math.min(100, 100 - fatores.reduce((s, f) => s + f.desconto, 0)));
  const completa = p.energia != null && p.dor != null;
  let nivel: Prontidao['nivel'] = pontos >= 75 ? 'boa' : pontos >= 50 ? 'media' : 'baixa';
  // Sem saber como você se sente, nunca afirma que está tudo bem.
  if (!completa && nivel === 'boa') nivel = 'media';
  const sugestao = !completa
    ? 'Responda energia e dor no check-in de hoje para uma avaliação completa.'
    : nivel === 'boa'
      ? 'Corpo recuperado: bom dia para treinar forte.'
      : nivel === 'media'
        ? 'Dá para treinar, mas sem buscar recorde; priorize técnica e volume menor.'
        : 'Considere descanso, alongamento ou um treino bem leve hoje.';
  return { nivel, pontos, fatores, completa, sugestao };
}

// ---------------------------------------------------------------------------
// 3. Composição: platô e recomposição

export type SinalCorpo = { tipo: 'plato' | 'recomposicao'; titulo: string; texto: string };

/**
 * Platô: a média de 7 dias do peso mudou menos de 0,2 kg em 14 dias, mesmo com déficit
 * médio de 250 kcal ou mais em pelo menos 10 dias com dieta.
 * Recomposição: a cintura caiu 1,5 cm ou mais e a média do peso caiu menos de 0,5 kg
 * entre duas medidas com 21 dias ou mais de distância.
 */
export function sinaisDoCorpo(p: {
  mediaHoje: number | null;
  media14Atras: number | null;
  deficits14: number[];
  cinturaAtual: { dia: string; cm: number } | null;
  cinturaAntes: { dia: string; cm: number } | null;
  mediaNoDiaDaCinturaAntes: number | null;
}): SinalCorpo[] {
  const sinais: SinalCorpo[] = [];
  if (p.mediaHoje != null && p.media14Atras != null && p.deficits14.length >= 10) {
    const def = media(p.deficits14) as number;
    if (Math.abs(p.mediaHoje - p.media14Atras) < 0.2 && def >= 250) {
      sinais.push({
        tipo: 'plato',
        titulo: 'Peso parado há 2 semanas',
        texto: `A média do peso quase não mudou em 14 dias, com déficit médio de ${Math.round(def)} kcal. Causas comuns: dieta registrada a menos (molhos, beliscos, bebidas), gasto superestimado, retenção de líquido (sal, treino novo, estresse) ou ganho de massa. Confira a cintura: se ela caiu, é progresso.`,
      });
    }
  }
  if (p.cinturaAtual && p.cinturaAntes && p.mediaHoje != null && p.mediaNoDiaDaCinturaAntes != null) {
    const dias = (Date.parse(p.cinturaAtual.dia) - Date.parse(p.cinturaAntes.dia)) / 86_400_000;
    const dCintura = p.cinturaAtual.cm - p.cinturaAntes.cm;
    const dPeso = p.mediaHoje - p.mediaNoDiaDaCinturaAntes;
    if (dias >= 21 && dCintura <= -1.5 && dPeso > -0.5) {
      sinais.push({
        tipo: 'recomposicao',
        titulo: 'Recomposição corporal',
        texto: `A cintura caiu ${Math.abs(dCintura).toFixed(1).replace('.', ',')} cm em ${Math.round(dias)} dias, mas o peso quase não mudou: sinal de que você está perdendo gordura e ganhando massa magra.`,
      });
    }
  }
  return sinais;
}

/** Jackson & Pollock 7 dobras + Siri: % de gordura a partir das dobras (mm), idade e sexo. */
export function gorduraPollock7(dobrasMm: number[], idade: number, sexo: Sexo): number | null {
  if (dobrasMm.length !== 7 || dobrasMm.some((d) => !(d > 0))) return null;
  const s = dobrasMm.reduce((a, b) => a + b, 0);
  const densidade =
    sexo === 'masculino'
      ? 1.112 - 0.00043499 * s + 0.00000055 * s * s - 0.00028826 * idade
      : 1.097 - 0.00046971 * s + 0.00000056 * s * s - 0.00012828 * idade;
  return Math.round((495 / densidade - 450) * 10) / 10;
}

// ---------------------------------------------------------------------------
// Meta de calorias × o que aconteceu

export type DiaMeta = { dia: string; consumo: number | null; gasto: number | null };

/** Tolerância para contar um dia "dentro da meta": até 10% acima. */
export const TOLERANCIA_META = 0.1;

export type SemanaAtual = {
  inicio: string;
  orcamento: number;
  usado: number;
  restante: number;
  /** Dias de hoje até domingo, contando hoje. */
  diasRestantes: number;
  porDiaRestante: number;
  diasComDieta: number;
};

/** Orçamento da semana (segunda a domingo): meta × 7, quanto já foi comido e quanto sobra. */
export function semanaAtual(dias: DiaMeta[], metaKcal: number, hoje: string, inicioSemana: string): SemanaAtual {
  const da = dias.filter((d) => d.dia >= inicioSemana && d.dia <= hoje && d.consumo != null);
  const usado = da.reduce((s, d) => s + (d.consumo as number), 0);
  const orcamento = metaKcal * 7;
  const passados = Math.round((Date.parse(hoje) - Date.parse(inicioSemana)) / 86_400_000);
  const diasRestantes = 7 - passados;
  const restante = orcamento - usado;
  return { inicio: inicioSemana, orcamento, usado, restante, diasRestantes, porDiaRestante: Math.round(restante / diasRestantes), diasComDieta: da.length };
}

export type MetaPeriodo = {
  dias: number;
  diasComDieta: number;
  mediaConsumo: number | null;
  diasDentro: number;
  /** Déficit que a meta daria: soma de (gasto − meta) nos dias com dieta. */
  planejado: number | null;
  /** Déficit que aconteceu: soma de (gasto − consumo) nos mesmos dias. */
  conseguido: number | null;
};

export function metaNoPeriodo(dias: DiaMeta[], metaKcal: number): MetaPeriodo {
  const comDieta = dias.filter((d) => d.consumo != null);
  const comTudo = comDieta.filter((d) => d.gasto != null);
  return {
    dias: dias.length,
    diasComDieta: comDieta.length,
    mediaConsumo: comDieta.length ? Math.round(comDieta.reduce((s, d) => s + (d.consumo as number), 0) / comDieta.length) : null,
    diasDentro: comDieta.filter((d) => (d.consumo as number) <= metaKcal * (1 + TOLERANCIA_META)).length,
    planejado: comTudo.length ? Math.round(comTudo.reduce((s, d) => s + ((d.gasto as number) - metaKcal), 0)) : null,
    conseguido: comTudo.length ? Math.round(comTudo.reduce((s, d) => s + ((d.gasto as number) - (d.consumo as number)), 0)) : null,
  };
}

export type DesdeInicio = {
  inicio: string;
  dias: number;
  diasComDieta: number;
  deficitTotal: number;
  /** Gordura equivalente ao déficit (7.700 kcal ≈ 1 kg). */
  kgPelasCalorias: number;
  /** Variação da média de 7 dias do peso. */
  kgNaBalanca: number | null;
  cintura: { de: number; para: number } | null;
  /** Déficit somado por semana (segunda a domingo), da mais antiga à atual. */
  semanas: { semana: string; deficit: number | null }[];
};

export function desdeOInicio(p: {
  inicio: string;
  hoje: string;
  balancos: (DiaMeta & { deficit: number | null })[];
  mediaInicio: number | null;
  mediaHoje: number | null;
  cinturas: { dia: string; cm: number }[];
  segundaAtual: string;
}): DesdeInicio {
  const dias = p.balancos.filter((b) => b.dia >= p.inicio && b.dia < p.hoje);
  const comDeficit = dias.filter((b) => b.deficit != null);
  const total = comDeficit.reduce((s, b) => s + (b.deficit as number), 0);
  const c = p.cinturas.filter((x) => x.dia >= p.inicio);
  const semanas: { semana: string; deficit: number | null }[] = [];
  for (let s = p.segundaAtual; s >= p.inicio || semanas.length === 0; s = new Date(Date.parse(s) - 7 * 86_400_000).toISOString().slice(0, 10)) {
    const fim = new Date(Date.parse(s) + 6 * 86_400_000).toISOString().slice(0, 10);
    const daSemana = comDeficit.filter((b) => b.dia >= s && b.dia <= fim);
    semanas.unshift({ semana: s, deficit: daSemana.length ? daSemana.reduce((a, b) => a + (b.deficit as number), 0) : null });
    if (semanas.length >= 12) break;
    if (Date.parse(s) <= Date.parse(p.inicio)) break;
  }
  return {
    inicio: p.inicio,
    dias: dias.length,
    diasComDieta: comDeficit.length,
    deficitTotal: Math.round(total),
    kgPelasCalorias: Math.round((total / 7700) * 10) / 10,
    kgNaBalanca: p.mediaInicio != null && p.mediaHoje != null ? Math.round((p.mediaHoje - p.mediaInicio) * 10) / 10 : null,
    cintura: c.length >= 2 ? { de: c[0].cm, para: c[c.length - 1].cm } : null,
    semanas,
  };
}
