// Cálculos de gasto, déficit e projeção de peso.
// Funções puras: sem acesso a banco ou tela, para poderem ser testadas.

/** kcal de déficit que equivalem, em média, a 1 kg de gordura. */
export const KCAL_POR_KG = 7700;

export type Sexo = 'masculino' | 'feminino';

/** Idade em anos completos numa data de referência (datas em 'YYYY-MM-DD'). */
export function idadeEmAnos(nascimento: string, referencia: string): number {
  const [an, mn, dn] = nascimento.split('-').map(Number);
  const [ar, mr, dr] = referencia.split('-').map(Number);
  let idade = ar - an;
  if (mr < mn || (mr === mn && dr < dn)) idade -= 1;
  return idade;
}

/** Taxa metabólica basal pela fórmula de Mifflin-St Jeor, em kcal/dia. */
export function tmbMifflin(p: { sexo: Sexo; pesoKg: number; alturaCm: number; idade: number }): number {
  const base = 10 * p.pesoKg + 6.25 * p.alturaCm - 5 * p.idade;
  return Math.round(p.sexo === 'masculino' ? base + 5 : base - 161);
}

/**
 * Gasto total do dia.
 * Com relógio: metabolismo basal + calorias ativas medidas.
 * Sem relógio: metabolismo basal × fator de atividade.
 * O ajuste vem da recalibração (previsto × real); negativo reduz o gasto.
 */
export function gastoDiario(p: {
  tmb: number;
  kcalAtivas?: number | null;
  /** Gasto total do dia medido pelo relógio (já inclui o metabolismo basal). */
  kcalTotais?: number | null;
  fatorAtividade: number;
  ajusteKcal?: number;
  /**
   * Parte do dia já decorrida (0 a 1). Hoje, às 12h, é 0,5: o metabolismo basal
   * e o ajuste contam só até agora, igual às calorias do relógio e da dieta.
   */
  fracaoDoDia?: number;
  /**
   * O relógio costuma ser usado (há dias completos com total): o total de hoje
   * vale mesmo abaixo do basal da fórmula, que pode superestimar a pessoa.
   */
  confiarNoTotal?: boolean;
  /** Gasto típico de um dia inteiro pelo relógio: a estimativa nunca passa dele. */
  tetoTipico?: number | null;
  /** Passos do dia: sem calorias do relógio, viram gasto de atividade (≈ 0,04 kcal por passo a cada 70 kg). */
  passos?: number | null;
  pesoKg?: number | null;
  /** Calorias de treinos que os passos não pegam (musculação, luta…), medidas ou estimadas. */
  kcalTreinos?: number | null;
}): { kcal: number; origem: 'relogio' | 'estimativa' } {
  const f = Math.max(0, Math.min(1, p.fracaoDoDia ?? 1));
  const basal = p.tmb * f;
  const ajuste = (p.ajusteKcal ?? 0) * f;
  // Relógio em uso: o total que ele mediu (basal + atividade) vale mais que a fórmula.
  if (p.confiarNoTotal && p.kcalTotais != null && p.kcalTotais > 0) {
    return { kcal: Math.round(p.kcalTotais + ajuste), origem: 'relogio' };
  }
  // Passos + treinos que os passos não pegam (musculação, luta…).
  const pelosPassos = p.passos != null && p.passos > 0 && p.pesoKg ? p.passos * 0.04 * (p.pesoKg / 70) + (p.kcalTreinos ?? 0) : null;
  if (p.kcalAtivas != null && p.kcalAtivas > 0) {
    // Alguns relógios (ex.: Zepp) mandam como "ativas" só as calorias dos exercícios gravados,
    // não as do dia inteiro. Vale o maior dos dois: nunca soma as duas coisas.
    return { kcal: Math.round(basal + Math.max(p.kcalAtivas, pelosPassos ?? 0) + ajuste), origem: 'relogio' };
  }
  // Alguns relógios só informam o total; ele só vale se for maior que o basal.
  if (p.kcalTotais != null && p.kcalTotais > 0 && (p.confiarNoTotal || p.kcalTotais > basal)) {
    return { kcal: Math.round(p.kcalTotais + ajuste), origem: 'relogio' };
  }
  if (pelosPassos != null) {
    return { kcal: Math.round(basal + pelosPassos + ajuste), origem: 'relogio' };
  }
  const estimativa = basal * p.fatorAtividade;
  const teto = p.tetoTipico != null && p.tetoTipico > 0 ? p.tetoTipico * f : Infinity;
  return { kcal: Math.round(Math.min(estimativa, teto) + ajuste), origem: 'estimativa' };
}

/** Fração do dia já decorrida num horário local (minutos desde 0h). */
export function fracaoDoDia(minutosDesdeMeiaNoite: number): number {
  return Math.max(0, Math.min(1, minutosDesdeMeiaNoite / 1440));
}

/**
 * Gasto total típico de um dia completo pelo relógio: mediana dos dias em que
 * ele foi usado (total de pelo menos 60% do basal). Precisa de 2 dias ou mais.
 */
export function gastoTipicoRelogio(totais: (number | null | undefined)[], tmb: number): number | null {
  const v = totais.filter((t): t is number => t != null && t >= tmb * 0.6).sort((a, b) => a - b);
  if (v.length < 2) return null;
  const meio = Math.floor(v.length / 2);
  return Math.round(v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2);
}

export type PlanoDoDia = {
  /** Gasto previsto até a meia-noite, sem contar atividade que ainda não aconteceu. */
  gastoPrevisto: number;
  /** Déficit sugerido para o dia: 500 kcal, ou 20% do gasto se for menor. */
  metaDeficit: number;
  /** Quanto ainda dá para comer e fechar o dia na meta (negativo = já passou). */
  podeComer: number;
  /** Déficit com que o dia fecharia se a pessoa não comesse mais nada. */
  deficitSeParar: number;
  /** Se parar agora, o déficit fica grande demais. */
  deficitExcessivo: boolean;
};

/**
 * Plano do dia de hoje. É conservador: a atividade que o relógio ainda vai medir
 * não entra, então a pessoa nunca é incentivada a comer contando com um treino futuro.
 */
export function planoDoDia(p: {
  tmb: number;
  kcalAtivas?: number | null;
  kcalTotais?: number | null;
  fatorAtividade: number;
  ajusteKcal?: number;
  fracaoDoDia: number;
  consumoKcal: number | null;
  /** Gasto total típico de um dia completo segundo o relógio (mediana recente). */
  gastoTipicoRelogio?: number | null;
  passos?: number | null;
  pesoKg?: number | null;
  kcalTreinos?: number | null;
}): PlanoDoDia {
  const tipico = p.gastoTipicoRelogio != null && p.gastoTipicoRelogio > 0 ? p.gastoTipicoRelogio : null;
  const f = Math.max(0, Math.min(1, p.fracaoDoDia));
  const ajuste = p.ajusteKcal ?? 0;
  let gasto: number;
  if (p.kcalAtivas != null && p.kcalAtivas > 0) gasto = p.tmb + p.kcalAtivas + ajuste;
  else if (p.kcalTotais != null && p.kcalTotais > 0 && (tipico != null || p.kcalTotais > p.tmb * f))
    // Resto do dia no ritmo do próprio relógio, quando há histórico dele.
    gasto = p.kcalTotais + (tipico ?? p.tmb) * (1 - f) + ajuste;
  // Só passos: basal do dia inteiro + atividade já feita (sem contar a que ainda virá).
  else if (p.passos != null && p.passos > 0 && p.pesoKg) gasto = p.tmb + p.passos * 0.04 * (p.pesoKg / 70) + (p.kcalTreinos ?? 0) + ajuste;
  else gasto = p.tmb * p.fatorAtividade + ajuste;
  // Entre a fórmula e o relógio, vale o menor: errar para menos nunca manda comer demais.
  if (tipico != null) gasto = Math.min(gasto, tipico + ajuste);
  const gastoPrevisto = Math.round(gasto);
  const metaDeficit = Math.min(500, Math.round((gastoPrevisto * 0.2) / 50) * 50);
  const consumo = p.consumoKcal ?? 0;
  const deficitSeParar = gastoPrevisto - consumo;
  return {
    gastoPrevisto,
    metaDeficit,
    podeComer: gastoPrevisto - metaDeficit - consumo,
    deficitSeParar,
    deficitExcessivo: deficitSeParar > Math.max(1000, gastoPrevisto * 0.4),
  };
}

/** Déficit do dia: positivo = gastou mais do que comeu. */
export function deficit(gastoKcal: number, consumoKcal: number): number {
  return Math.round(gastoKcal - consumoKcal);
}

/** Converte déficit acumulado em kg de gordura estimados. */
export function kgDeDeficit(deficitKcal: number): number {
  return deficitKcal / KCAL_POR_KG;
}

export type Pesagem = { dia: string; pesoKg: number };

/**
 * Média móvel do peso: para cada pesagem, a média das pesagens dos últimos
 * `janelaDias` dias (incluindo o próprio dia). Suaviza variação de água.
 */
export function mediaMovel(pesagens: Pesagem[], janelaDias = 7): Pesagem[] {
  const ordenadas = [...pesagens].sort((a, b) => a.dia.localeCompare(b.dia));
  const emDias = (dia: string) => Date.parse(dia + 'T00:00:00Z') / 86_400_000;
  return ordenadas.map((atual) => {
    const fim = emDias(atual.dia);
    const janela = ordenadas.filter((p) => {
      const d = emDias(p.dia);
      return d <= fim && d > fim - janelaDias;
    });
    const soma = janela.reduce((s, p) => s + p.pesoKg, 0);
    return { dia: atual.dia, pesoKg: Math.round((soma / janela.length) * 100) / 100 };
  });
}

export type Projecao =
  | { estado: 'atingida' }
  | { estado: 'sem_deficit' }
  | {
      estado: 'no_caminho';
      dias: number;
      kgPorSemana: number;
      /** data no ritmo médio */
      data: string;
      /** faixa: ritmo 20% melhor / 20% pior que a média */
      dataCedo: string;
      dataTarde: string;
    };

/** Margem da faixa da projeção: o déficit real costuma variar ±20% do estimado. */
export const MARGEM_PROJECAO = 0.2;

/** Quando a meta chega, mantendo o déficit médio diário atual. */
export function projetarMeta(p: {
  pesoAtualKg: number;
  metaKg: number;
  deficitMedioDiario: number;
  hoje: string;
}): Projecao {
  const faltaKg = p.pesoAtualKg - p.metaKg;
  if (faltaKg <= 0) return { estado: 'atingida' };
  if (p.deficitMedioDiario <= 0) return { estado: 'sem_deficit' };
  const kgPorDia = p.deficitMedioDiario / KCAL_POR_KG;
  const diasCom = (kgDia: number) => Math.ceil(faltaKg / kgDia);
  const emData = (d: number) => new Date(Date.parse(p.hoje + 'T00:00:00Z') + d * 86_400_000).toISOString().slice(0, 10);
  const dias = diasCom(kgPorDia);
  return {
    estado: 'no_caminho',
    dias,
    kgPorSemana: Math.round(kgPorDia * 7 * 100) / 100,
    data: emData(dias),
    dataCedo: emData(diasCom(kgPorDia * (1 + MARGEM_PROJECAO))),
    dataTarde: emData(diasCom(kgPorDia * (1 - MARGEM_PROJECAO))),
  };
}

/**
 * Compara o peso que as calorias previam com o peso real (média móvel) num
 * período e devolve quanto o gasto diário estimado deve mudar.
 * Ex.: perdeu menos que o previsto → gasto estava superestimado → ajuste negativo.
 * Limitado a ±500 kcal/dia para um dado ruim não distorcer tudo.
 */
export function ajusteDeGasto(p: {
  deficitAcumuladoKcal: number;
  pesoInicialKg: number;
  pesoFinalKg: number;
  dias: number;
}): number {
  if (p.dias < 14) return 0; // pouco tempo: a variação de água domina
  const perdaPrevista = p.deficitAcumuladoKcal / KCAL_POR_KG;
  const perdaReal = p.pesoInicialKg - p.pesoFinalKg;
  const ajuste = ((perdaReal - perdaPrevista) * KCAL_POR_KG) / p.dias;
  return Math.round(Math.max(-500, Math.min(500, ajuste)));
}

/**
 * Ritmo de perda pela média móvel: kg por semana nos últimos `dias` dias
 * (positivo = perdendo). Precisa de pelo menos 10 dias entre a 1ª e a última média.
 */
export function ritmoSemanal(medias: Pesagem[], dias = 14): { kgPorSemana: number; pctPorSemana: number } | null {
  if (medias.length < 2) return null;
  const ordenadas = [...medias].sort((a, b) => a.dia.localeCompare(b.dia));
  const fim = ordenadas[ordenadas.length - 1];
  const emDias = (dia: string) => Date.parse(dia + 'T00:00:00Z') / 86_400_000;
  const inicio = ordenadas.find((m) => emDias(fim.dia) - emDias(m.dia) <= dias) ?? ordenadas[0];
  const intervalo = emDias(fim.dia) - emDias(inicio.dia);
  if (intervalo < 10) return null;
  const kgPorSemana = ((inicio.pesoKg - fim.pesoKg) / intervalo) * 7;
  return { kgPorSemana: Math.round(kgPorSemana * 100) / 100, pctPorSemana: Math.round((kgPorSemana / fim.pesoKg) * 1000) / 10 };
}

/** Acima de 1% do peso por semana a perda tende a incluir massa magra. */
export const LIMITE_RITMO_PCT = 1;

/** Faixa de proteína recomendada em déficit: 1,6 a 2,2 g por kg de peso. */
export function metaProteina(pesoKg: number): { min: number; max: number } {
  return { min: Math.round(pesoKg * 1.6), max: Math.round(pesoKg * 2.2) };
}

/** Sugestão de água: ~35 ml por kg, arredondada a 250 ml, entre 1,5 e 5 L. */
export function aguaSugeridaMl(pesoKg: number): number {
  const ml = Math.round((pesoKg * 35) / 250) * 250;
  return Math.max(1500, Math.min(5000, ml));
}

export type NivelCintura = 'adequado' | 'atencao' | 'alto';

/** Relação cintura/altura: abaixo de 0,5 adequado; 0,5–0,6 atenção; 0,6 ou mais, alto. */
export function relacaoCinturaAltura(cinturaCm: number, alturaCm: number): { valor: number; nivel: NivelCintura } {
  const valor = Math.round((cinturaCm / alturaCm) * 100) / 100;
  return { valor, nivel: valor < 0.5 ? 'adequado' : valor < 0.6 ? 'atencao' : 'alto' };
}

// ---------------------------------------------------------------------------
// Meta de calorias: sugestões com base em referências publicadas.
//
// • Déficits: NHLBI (Clinical Guidelines on Overweight and Obesity, 1998):
//   300–500 kcal/dia → ~0,25–0,5 kg/semana; 500–1.000 kcal/dia → ~0,5–1 kg/semana.
// • Teto de ritmo: ~1% do peso por semana para preservar massa magra
//   (Helms, Aragon & Fitschen, JISSN 2014: perdas de ~0,5–1% do peso por semana).
// • Pisos: NHLBI "Aim for a Healthy Weight" (2009): planos de 1.000–1.200 kcal para
//   a maioria das mulheres e 1.200–1.600 kcal para a maioria dos homens; usamos o
//   topo de cada faixa como mínimo da sugestão.
// • 7.700 kcal ≈ 1 kg: aproximação usada para converter déficit em peso; na prática
//   a perda desacelera com o tempo, por isso o app recalibra pelo previsto × real.

export const PISO_KCAL: Record<Sexo, number> = { feminino: 1200, masculino: 1600 };
const DEFICIT_RITMO = { gradual: 300, moderado: 500, acelerado: 1000 } as const;
export type Ritmo = keyof typeof DEFICIT_RITMO;

export type OpcaoMeta = {
  ritmo: Ritmo;
  kcal: number;
  deficit: number;
  kgSemana: number;
  pctSemana: number;
  /** O déficit foi reduzido para não passar de 1% do peso por semana. */
  limitadoPeloRitmo: boolean;
  /** A meta ficou no piso de segurança. */
  noPiso: boolean;
};

export function sugerirMetas(p: { gastoBase: number; pesoKg: number; sexo: Sexo }): { opcoes: OpcaoMeta[]; piso: number; faixa: { min: number; max: number } } {
  const piso = PISO_KCAL[p.sexo];
  const tetoDeficit = (p.pesoKg * 0.01 * KCAL_POR_KG) / 7; // 1% do peso por semana
  const r50 = (n: number) => Math.round(n / 50) * 50;
  const opcoes = (Object.keys(DEFICIT_RITMO) as Ritmo[]).map((ritmo) => {
    const desejado = Math.min(DEFICIT_RITMO[ritmo], tetoDeficit);
    const bruto = r50(p.gastoBase - desejado);
    const kcal = Math.max(piso, bruto);
    const deficit = Math.max(0, Math.round(p.gastoBase - kcal));
    const kgSemana = Math.round(((deficit * 7) / KCAL_POR_KG) * 100) / 100;
    return {
      ritmo,
      kcal,
      deficit,
      kgSemana,
      pctSemana: Math.round((kgSemana / p.pesoKg) * 1000) / 10,
      limitadoPeloRitmo: DEFICIT_RITMO[ritmo] > tetoDeficit,
      noPiso: bruto < piso,
    };
  });
  const moderado = opcoes.find((o) => o.ritmo === 'moderado') as OpcaoMeta;
  const gradual = opcoes.find((o) => o.ritmo === 'gradual') as OpcaoMeta;
  return { opcoes, piso, faixa: { min: moderado.kcal, max: gradual.kcal } };
}
