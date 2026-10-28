// Faixas de referência dos exames de sangue mais comuns em adultos.
//
// IMPORTANTE: é só uma indicação para organizar o acompanhamento. Quem interpreta
// é o médico. Cada laboratório tem sua faixa; quando ela é informada, o app usa a
// do laboratório no lugar da tabela abaixo.
//
// Fontes das faixas padrão:
// - Glicose e HbA1c: Diretriz da Sociedade Brasileira de Diabetes / ADA.
// - Colesterol, LDL, HDL, triglicerídeos: Atualização da Diretriz Brasileira de
//   Dislipidemias (SBC 2017) e NCEP ATP III. A meta de LDL depende do risco
//   cardiovascular de cada pessoa e pode ser bem menor que a indicada.
// - Vitamina D: Posicionamento SBPC/ML e SBEM (2017).
// - Hemoglobina e ferritina: Organização Mundial da Saúde (2011 e 2020).
// - PCR ultrassensível: AHA/CDC (2003).
// - Demais: faixas típicas de laboratório; variam entre laboratórios.

import type { Sexo } from './calculos.ts';

export type Nivel = 'adequado' | 'atencao' | 'alterado';
export type Direcao = 'baixo' | 'alto' | null;
export type Contexto = { idade: number | null; sexo: Sexo | null };

/** Faixa: vale para valores abaixo de `abaixoDe` (exclusivo); a última não tem limite. */
type Faixa = { abaixoDe?: number; nivel: Nivel; direcao: Direcao; texto: string };

export type Marcador = {
  codigo: string;
  nome: string;
  unidade: string;
  grupo: 'Glicose' | 'Colesterol' | 'Vitaminas' | 'Tireoide' | 'Rins' | 'Sangue' | 'Fígado' | 'Inflamação';
  /** Faixa varia bastante entre laboratórios: vale registrar a do laudo. */
  variaPorLaboratorio: boolean;
  nota?: string;
  faixas: (ctx: Contexto) => Faixa[];
};

const ok = (abaixoDe: number | undefined, texto = 'dentro do esperado'): Faixa => ({ abaixoDe, nivel: 'adequado', direcao: null, texto });
const baixo = (abaixoDe: number, texto = 'abaixo do esperado', nivel: Nivel = 'atencao'): Faixa => ({ abaixoDe, nivel, direcao: 'baixo', texto });
const alto = (abaixoDe: number | undefined, texto = 'acima do esperado', nivel: Nivel = 'atencao'): Faixa => ({ abaixoDe, nivel, direcao: 'alto', texto });

// Pequena folga para limites inclusivos (ex.: "até 4,5" inclui 4,5).
const ate = (v: number) => v + 0.0001;

export const MARCADORES: Marcador[] = [
  {
    codigo: 'glicose',
    nome: 'Glicose (jejum)',
    unidade: 'mg/dL',
    grupo: 'Glicose',
    variaPorLaboratorio: false,
    faixas: () => [baixo(70), ok(100), alto(126, 'glicemia de jejum alterada'), alto(undefined, 'acima do limite usado para diabetes', 'alterado')],
  },
  {
    codigo: 'hba1c',
    nome: 'Hemoglobina glicada (HbA1c)',
    unidade: '%',
    grupo: 'Glicose',
    variaPorLaboratorio: false,
    faixas: () => [ok(5.7), alto(6.5, 'faixa de pré-diabetes'), alto(undefined, 'acima do limite usado para diabetes', 'alterado')],
  },
  {
    codigo: 'colesterol_total',
    nome: 'Colesterol total',
    unidade: 'mg/dL',
    grupo: 'Colesterol',
    variaPorLaboratorio: false,
    faixas: () => [ok(190, 'desejável'), alto(undefined, 'acima do desejável')],
  },
  {
    codigo: 'ldl',
    nome: 'LDL',
    unidade: 'mg/dL',
    grupo: 'Colesterol',
    variaPorLaboratorio: false,
    nota: 'A meta de LDL depende do risco cardiovascular e pode ser bem menor para quem tem fatores de risco.',
    faixas: () => [ok(130, 'dentro da meta para baixo risco'), alto(160, 'limítrofe'), alto(undefined, 'alto', 'alterado')],
  },
  {
    codigo: 'hdl',
    nome: 'HDL',
    unidade: 'mg/dL',
    grupo: 'Colesterol',
    variaPorLaboratorio: false,
    faixas: ({ sexo }) => [baixo(sexo === 'feminino' ? 50 : 40, 'abaixo do desejável'), ok(undefined, 'desejável')],
  },
  {
    codigo: 'triglicerides',
    nome: 'Triglicerídeos (jejum)',
    unidade: 'mg/dL',
    grupo: 'Colesterol',
    variaPorLaboratorio: false,
    faixas: () => [ok(150, 'desejável'), alto(200, 'limítrofe'), alto(undefined, 'alto', 'alterado')],
  },
  {
    codigo: 'vitamina_d',
    nome: 'Vitamina D (25-OH)',
    unidade: 'ng/mL',
    grupo: 'Vitaminas',
    variaPorLaboratorio: false,
    nota: 'Acima de 60 anos, o alvo recomendado é a partir de 30 ng/mL.',
    faixas: ({ idade }) =>
      idade != null && idade >= 60
        ? [baixo(20), baixo(30, 'abaixo do recomendado a partir dos 60 anos'), ok(ate(100)), alto(undefined, 'risco de excesso', 'alterado')]
        : [baixo(20, 'abaixo do desejável'), ok(ate(100)), alto(undefined, 'risco de excesso', 'alterado')],
  },
  {
    codigo: 'vitamina_b12',
    nome: 'Vitamina B12',
    unidade: 'pg/mL',
    grupo: 'Vitaminas',
    variaPorLaboratorio: true,
    faixas: () => [baixo(200), baixo(300, 'limítrofe'), ok(undefined)],
  },
  {
    codigo: 'tsh',
    nome: 'TSH',
    unidade: 'µUI/mL',
    grupo: 'Tireoide',
    variaPorLaboratorio: true,
    nota: 'Em idosos, valores um pouco acima de 4,5 podem ser normais.',
    faixas: () => [baixo(0.4), ok(ate(4.5)), alto(undefined)],
  },
  {
    codigo: 'creatinina',
    nome: 'Creatinina',
    unidade: 'mg/dL',
    grupo: 'Rins',
    variaPorLaboratorio: true,
    faixas: ({ sexo }) =>
      sexo === 'feminino' ? [baixo(0.6), ok(ate(1.1)), alto(undefined)] : [baixo(0.7), ok(ate(1.3)), alto(undefined)],
  },
  {
    codigo: 'acido_urico',
    nome: 'Ácido úrico',
    unidade: 'mg/dL',
    grupo: 'Rins',
    variaPorLaboratorio: true,
    faixas: ({ sexo }) => [ok(ate(sexo === 'feminino' ? 6 : 7)), alto(undefined)],
  },
  {
    codigo: 'hemoglobina',
    nome: 'Hemoglobina',
    unidade: 'g/dL',
    grupo: 'Sangue',
    variaPorLaboratorio: true,
    faixas: ({ sexo }) =>
      sexo === 'feminino'
        ? [baixo(12, 'abaixo do limite de anemia da OMS'), ok(ate(15.5)), alto(undefined)]
        : [baixo(13, 'abaixo do limite de anemia da OMS'), ok(ate(17.5)), alto(undefined)],
  },
  {
    codigo: 'ferritina',
    nome: 'Ferritina',
    unidade: 'ng/mL',
    grupo: 'Sangue',
    variaPorLaboratorio: true,
    faixas: ({ sexo }) => [baixo(15, 'estoque de ferro baixo'), ok(ate(sexo === 'feminino' ? 150 : 200)), alto(undefined)],
  },
  {
    codigo: 'tgo',
    nome: 'TGO (AST)',
    unidade: 'U/L',
    grupo: 'Fígado',
    variaPorLaboratorio: true,
    faixas: () => [ok(ate(40)), alto(undefined)],
  },
  {
    codigo: 'tgp',
    nome: 'TGP (ALT)',
    unidade: 'U/L',
    grupo: 'Fígado',
    variaPorLaboratorio: true,
    faixas: () => [ok(ate(40)), alto(undefined)],
  },
  {
    codigo: 'pcr_us',
    nome: 'PCR ultrassensível',
    unidade: 'mg/L',
    grupo: 'Inflamação',
    variaPorLaboratorio: false,
    nota: 'Valores acima de 10 costumam indicar inflamação ou infecção recente, não risco cardiovascular.',
    faixas: () => [ok(1, 'baixo risco cardiovascular'), alto(ate(3), 'risco cardiovascular intermediário'), alto(undefined, 'risco cardiovascular aumentado')],
  },
];

export function marcador(codigo: string): Marcador | undefined {
  return MARCADORES.find((m) => m.codigo === codigo);
}

export type Classificacao = { nivel: Nivel; direcao: Direcao; texto: string; fonte: 'laboratorio' | 'padrao'; faixaTexto: string };

const num = (v: number) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100).replace('.', ','));

/** Texto da faixa adequada, ex.: "70 a 99 mg/dL", "abaixo de 190 mg/dL". */
export function faixaAdequadaTexto(m: Marcador, ctx: Contexto): string {
  const faixas = m.faixas(ctx);
  const i = faixas.findIndex((f) => f.nivel === 'adequado');
  const inferior = i > 0 ? faixas[i - 1].abaixoDe : undefined;
  const bruto = faixas[i].abaixoDe;
  if (bruto == null) return inferior != null ? `a partir de ${num(inferior)} ${m.unidade}` : m.unidade;
  const superior = Math.round(bruto * 100) / 100;
  const inclusivo = Math.abs(bruto - superior) > 1e-9; // limites criados com ate()
  // Limite exclusivo inteiro (ex.: glicose < 100) vira "99"; decimais ficam "abaixo de".
  const topoInteiro = !inclusivo && Number.isInteger(superior) && superior >= 10;
  if (inferior != null) {
    const topo = inclusivo ? num(superior) : topoInteiro ? num(superior - 1) : `menos de ${num(superior)}`;
    return `${num(inferior)} a ${topo} ${m.unidade}`;
  }
  if (inclusivo) return `até ${num(superior)} ${m.unidade}`;
  return topoInteiro ? `até ${num(superior - 1)} ${m.unidade}` : `abaixo de ${num(superior)} ${m.unidade}`;
}

/**
 * Classifica um resultado. Se o laudo trouxer a faixa do laboratório, ela tem
 * prioridade: fora dela = "atenção". Senão, usa a tabela padrão por idade e sexo.
 */
export function classificar(
  codigo: string,
  valor: number,
  ctx: Contexto,
  refLab?: { min: number | null; max: number | null },
): Classificacao | null {
  const m = marcador(codigo);
  if (!m) return null;
  if (refLab && (refLab.min != null || refLab.max != null)) {
    const faixaTexto =
      refLab.min != null && refLab.max != null
        ? `${num(refLab.min)} a ${num(refLab.max)} ${m.unidade}`
        : refLab.min != null
          ? `a partir de ${num(refLab.min)} ${m.unidade}`
          : `até ${num(refLab.max as number)} ${m.unidade}`;
    if (refLab.min != null && valor < refLab.min)
      return { nivel: 'atencao', direcao: 'baixo', texto: 'abaixo da faixa do laboratório', fonte: 'laboratorio', faixaTexto };
    if (refLab.max != null && valor > refLab.max)
      return { nivel: 'atencao', direcao: 'alto', texto: 'acima da faixa do laboratório', fonte: 'laboratorio', faixaTexto };
    return { nivel: 'adequado', direcao: null, texto: 'dentro da faixa do laboratório', fonte: 'laboratorio', faixaTexto };
  }
  const faixa = m.faixas(ctx).find((f) => f.abaixoDe == null || valor < f.abaixoDe) as Faixa;
  return { nivel: faixa.nivel, direcao: faixa.direcao, texto: faixa.texto, fonte: 'padrao', faixaTexto: faixaAdequadaTexto(m, ctx) };
}
