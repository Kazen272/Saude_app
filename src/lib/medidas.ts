// Perimetria (fita métrica): definição das medidas e cálculos de evolução. Funções puras.

export type Coluna =
  | 'waist_cm'
  | 'hip_cm'
  | 'abdomen_cm'
  | 'chest_cm'
  | 'shoulder_cm'
  | 'arm_relaxed_l_cm'
  | 'arm_relaxed_r_cm'
  | 'arm_flexed_l_cm'
  | 'arm_flexed_r_cm'
  | 'forearm_l_cm'
  | 'forearm_r_cm'
  | 'thigh_l_cm'
  | 'thigh_r_cm'
  | 'calf_l_cm'
  | 'calf_r_cm'
  | 'sf_chest_mm'
  | 'sf_axillary_mm'
  | 'sf_triceps_mm'
  | 'sf_subscapular_mm'
  | 'sf_abdominal_mm'
  | 'sf_suprailiac_mm'
  | 'sf_thigh_mm';

export type Grupo = 'principal' | 'tronco' | 'bracos' | 'pernas';

export type Medida = {
  codigo: string;
  nome: string;
  grupo: Grupo;
  /** Uma coluna, ou [esquerdo, direito]. */
  colunas: Coluna[];
  /** Diminuir é o esperado (cintura, abdômen, quadril). Nas outras, depende do objetivo. */
  menorEhMelhor: boolean;
};

export const MEDIDAS: Medida[] = [
  { codigo: 'cintura', nome: 'Cintura', grupo: 'principal', colunas: ['waist_cm'], menorEhMelhor: true },
  { codigo: 'quadril', nome: 'Quadril', grupo: 'principal', colunas: ['hip_cm'], menorEhMelhor: true },
  { codigo: 'ombro', nome: 'Ombro', grupo: 'tronco', colunas: ['shoulder_cm'], menorEhMelhor: false },
  { codigo: 'torax', nome: 'Tórax', grupo: 'tronco', colunas: ['chest_cm'], menorEhMelhor: false },
  { codigo: 'abdomen', nome: 'Abdômen', grupo: 'tronco', colunas: ['abdomen_cm'], menorEhMelhor: true },
  { codigo: 'braco-relaxado', nome: 'Braço relaxado', grupo: 'bracos', colunas: ['arm_relaxed_l_cm', 'arm_relaxed_r_cm'], menorEhMelhor: false },
  { codigo: 'braco-contraido', nome: 'Braço contraído', grupo: 'bracos', colunas: ['arm_flexed_l_cm', 'arm_flexed_r_cm'], menorEhMelhor: false },
  { codigo: 'antebraco', nome: 'Antebraço', grupo: 'bracos', colunas: ['forearm_l_cm', 'forearm_r_cm'], menorEhMelhor: false },
  { codigo: 'coxa', nome: 'Coxa média', grupo: 'pernas', colunas: ['thigh_l_cm', 'thigh_r_cm'], menorEhMelhor: false },
  { codigo: 'panturrilha', nome: 'Panturrilha', grupo: 'pernas', colunas: ['calf_l_cm', 'calf_r_cm'], menorEhMelhor: false },
];

/** Dobras cutâneas do protocolo de 7 dobras (em mm), na ordem da avaliação. */
export const DOBRAS: { coluna: Coluna; nome: string }[] = [
  { coluna: 'sf_chest_mm', nome: 'Peitoral' },
  { coluna: 'sf_axillary_mm', nome: 'Axilar média' },
  { coluna: 'sf_triceps_mm', nome: 'Tríceps' },
  { coluna: 'sf_subscapular_mm', nome: 'Subescapular' },
  { coluna: 'sf_abdominal_mm', nome: 'Abdominal' },
  { coluna: 'sf_suprailiac_mm', nome: 'Supra-ilíaca' },
  { coluna: 'sf_thigh_mm', nome: 'Coxa' },
];

/** Tudo o que o formulário do Registrar salva: perimetria (cm) e dobras (mm). */
export const COLUNAS: Coluna[] = [...MEDIDAS.flatMap((m) => m.colunas), ...DOBRAS.map((d) => d.coluna)];
/** As que ficam em "Mais medidas" (cintura e quadril aparecem sempre). */
export const COLUNAS_EXTRAS: Coluna[] = COLUNAS.filter((c) => c !== 'waist_cm' && c !== 'hip_cm');

export const medidaPorCodigo = (codigo: string) => MEDIDAS.find((m) => m.codigo === codigo);

export type Valores = Partial<Record<Coluna, number | null>>;
export type RegistroMedidas = { dia: string; valores: Valores };
/** Uma medição de uma medida: um valor por coluna (null = lado não medido). */
export type Ponto = { dia: string; valores: (number | null)[] };

const arred = (n: number) => Math.round(n * 10) / 10;

/** Medições de uma medida, em ordem de data, só dos dias em que ela foi medida. */
export function serie(registros: RegistroMedidas[], medida: Medida): Ponto[] {
  return [...registros]
    .sort((a, b) => a.dia.localeCompare(b.dia))
    .map((r) => ({ dia: r.dia, valores: medida.colunas.map((c) => r.valores[c] ?? null) }))
    .filter((p) => p.valores.some((v) => v != null));
}

/** Diferença de `de` até `ate` (cm), média dos lados medidos nas duas datas. */
export function variacao(de: Ponto, ate: Ponto): number | null {
  const difs = de.valores
    .map((v, i) => (v != null && ate.valores[i] != null ? (ate.valores[i] as number) - v : null))
    .filter((d): d is number => d != null);
  if (!difs.length) return null;
  return arred(difs.reduce((s, d) => s + d, 0) / difs.length) || 0;
}

export type ResumoMedida = {
  medida: Medida;
  pontos: Ponto[];
  atual: Ponto;
  vsAnterior: number | null;
  vsPrimeira: number | null;
  diaPrimeira: string;
};

export function resumir(registros: RegistroMedidas[], medida: Medida): ResumoMedida | null {
  const pontos = serie(registros, medida);
  const atual = pontos.at(-1);
  if (!atual) return null;
  const anterior = pontos.at(-2);
  return {
    medida,
    pontos,
    atual,
    vsAnterior: anterior ? variacao(anterior, atual) : null,
    vsPrimeira: pontos.length > 1 ? variacao(pontos[0], atual) : null,
    diaPrimeira: pontos[0].dia,
  };
}

/** bom = verde, ruim = laranja, neutro = cinza. */
export function tom(medida: Medida, delta: number | null): 'bom' | 'ruim' | 'neutro' {
  if (delta == null || delta === 0 || !medida.menorEhMelhor) return 'neutro';
  return delta < 0 ? 'bom' : 'ruim';
}

/** Último valor de cada coluna antes de um dia (para mostrar em cinza no formulário). */
export function ultimosValores(registros: RegistroMedidas[], antesDe: string): Valores {
  const out: Valores = {};
  for (const r of [...registros].sort((a, b) => a.dia.localeCompare(b.dia))) {
    if (r.dia >= antesDe) break;
    for (const c of COLUNAS) if (r.valores[c] != null) out[c] = r.valores[c];
  }
  return out;
}
