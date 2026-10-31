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

export type Prontidao = {
  nivel: 'boa' | 'media' | 'baixa';
  pontos: number;
  motivos: string[];
  sugestao: string;
};

/**
 * Começa em 100 e desconta: FC de repouso acima da sua média (−8 por bpm além de 2),
 * sono curto (< 6h −25, < 7h −10) e energia baixa no check-in (1–2 −20, 3 −5).
 * Precisa de pelo menos um dos três dados.
 */
export function prontidao(p: { fcHoje: number | null; fcMedia: number | null; sonoMin: number | null; energia: number | null }): Prontidao | null {
  if (p.sonoMin == null && p.energia == null && (p.fcHoje == null || p.fcMedia == null)) return null;
  let pontos = 100;
  const motivos: string[] = [];
  if (p.fcHoje != null && p.fcMedia != null) {
    const acima = p.fcHoje - p.fcMedia;
    if (acima > 2) {
      pontos -= Math.round((acima - 2) * 8);
      motivos.push(`FC de repouso ${Math.round(acima)} bpm acima da sua média`);
    } else motivos.push('FC de repouso normal');
  }
  if (p.sonoMin != null) {
    const h = `${Math.floor(p.sonoMin / 60)}h${String(p.sonoMin % 60).padStart(2, '0')}`;
    if (p.sonoMin < 6 * 60) {
      pontos -= 25;
      motivos.push(`dormiu ${h}`);
    } else if (p.sonoMin < 7 * 60) {
      pontos -= 10;
      motivos.push(`dormiu ${h}`);
    } else motivos.push(`dormiu bem (${h})`);
  }
  if (p.energia != null) {
    if (p.energia <= 2) {
      pontos -= 20;
      motivos.push('energia baixa no check-in');
    } else if (p.energia === 3) pontos -= 5;
  }
  pontos = Math.max(0, Math.min(100, pontos));
  const nivel = pontos >= 75 ? 'boa' : pontos >= 50 ? 'media' : 'baixa';
  return {
    nivel,
    pontos,
    motivos,
    sugestao:
      nivel === 'boa'
        ? 'Bom dia para treinar forte.'
        : nivel === 'media'
          ? 'Dá para treinar, mas sem buscar recorde.'
          : 'Considere um treino leve, alongamento ou descanso hoje.',
  };
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
