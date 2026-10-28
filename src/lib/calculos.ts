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
}): { kcal: number; origem: 'relogio' | 'estimativa' } {
  const f = Math.max(0, Math.min(1, p.fracaoDoDia ?? 1));
  const basal = p.tmb * f;
  const ajuste = (p.ajusteKcal ?? 0) * f;
  if (p.kcalAtivas != null && p.kcalAtivas > 0) {
    return { kcal: Math.round(basal + p.kcalAtivas + ajuste), origem: 'relogio' };
  }
  // Alguns relógios só informam o total; ele só vale se for maior que o basal.
  if (p.kcalTotais != null && p.kcalTotais > basal) {
    return { kcal: Math.round(p.kcalTotais + ajuste), origem: 'relogio' };
  }
  return { kcal: Math.round(basal * p.fatorAtividade + ajuste), origem: 'estimativa' };
}

/** Fração do dia já decorrida num horário local (minutos desde 0h). */
export function fracaoDoDia(minutosDesdeMeiaNoite: number): number {
  return Math.max(0, Math.min(1, minutosDesdeMeiaNoite / 1440));
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
