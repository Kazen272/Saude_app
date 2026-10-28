// Agregações para os relatórios da aba Progresso. Funções puras.
import { KCAL_POR_KG } from './calculos.ts';

export type DiaBalanco = { dia: string; gasto: number | null; consumo: number | null };

export type ResumoPeriodo = {
  gastoTotal: number | null;
  consumoTotal: number | null;
  deficitTotal: number | null;
  diasComDieta: number;
};

/**
 * Soma gasto, consumo e déficit de um período.
 * O déficit só conta dias com gasto E consumo, para não inflar com dias sem dieta.
 */
export function resumirPeriodo(dias: DiaBalanco[]): ResumoPeriodo {
  const comGasto = dias.filter((d) => d.gasto != null);
  const comDieta = dias.filter((d) => d.consumo != null);
  const completos = dias.filter((d) => d.gasto != null && d.consumo != null);
  const soma = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
  return {
    gastoTotal: comGasto.length ? soma(comGasto.map((d) => d.gasto as number)) : null,
    consumoTotal: comDieta.length ? soma(comDieta.map((d) => d.consumo as number)) : null,
    deficitTotal: completos.length ? soma(completos.map((d) => (d.gasto as number) - (d.consumo as number))) : null,
    diasComDieta: comDieta.length,
  };
}

/**
 * Semana do relatório: de segunda a domingo. No domingo, é a semana que termina
 * hoje; nos outros dias, a última semana completa.
 */
export function semanaDoRelatorio(hoje: string): { inicio: string; fim: string } {
  const [a, m, d] = hoje.split('-').map(Number);
  const data = new Date(Date.UTC(a, m - 1, d));
  const diaSemana = data.getUTCDay(); // 0 = domingo
  const fim = new Date(data.getTime() - diaSemana * 86_400_000);
  const inicio = new Date(fim.getTime() - 6 * 86_400_000);
  return { inicio: inicio.toISOString().slice(0, 10), fim: fim.toISOString().slice(0, 10) };
}

export type MetricasSemana = {
  pesoMedioKg: number | null;
  deficitTotal: number | null;
  treinos: number;
  aguaMediaMl: number | null;
  sonoMedioMin: number | null;
  variacaoDormirMin: number | null;
  energia: number | null;
  fome: number | null;
  humor: number | null;
};

export type Tendencia = 'melhorou' | 'piorou' | 'estavel' | 'sem_dados';
export type ItemComparacao = { chave: keyof MetricasSemana; atual: number | null; anterior: number | null; tendencia: Tendencia };

// Para cada métrica: qual direção é melhor e qual diferença ainda conta como "estável".
const REGRAS: Record<keyof MetricasSemana, { melhor: 'maior' | 'menor'; tolerancia: number }> = {
  pesoMedioKg: { melhor: 'menor', tolerancia: 0.1 },
  deficitTotal: { melhor: 'maior', tolerancia: 300 },
  treinos: { melhor: 'maior', tolerancia: 0 },
  aguaMediaMl: { melhor: 'maior', tolerancia: 150 },
  sonoMedioMin: { melhor: 'maior', tolerancia: 15 },
  variacaoDormirMin: { melhor: 'menor', tolerancia: 10 },
  energia: { melhor: 'maior', tolerancia: 0.3 },
  fome: { melhor: 'menor', tolerancia: 0.3 },
  humor: { melhor: 'maior', tolerancia: 0.3 },
};

/**
 * Compara duas semanas métrica a métrica. O peso é tratado como "menor é melhor"
 * porque o objetivo do app é emagrecer.
 */
export function compararSemanas(atual: MetricasSemana, anterior: MetricasSemana): ItemComparacao[] {
  return (Object.keys(REGRAS) as (keyof MetricasSemana)[]).map((chave) => {
    const a = atual[chave];
    const b = anterior[chave];
    if (a == null || b == null) return { chave, atual: a, anterior: b, tendencia: 'sem_dados' as const };
    const { melhor, tolerancia } = REGRAS[chave];
    const diferenca = a - b;
    if (Math.abs(diferenca) <= tolerancia) return { chave, atual: a, anterior: b, tendencia: 'estavel' as const };
    const subiu = diferenca > 0;
    const tendencia: Tendencia = (melhor === 'maior') === subiu ? 'melhorou' : 'piorou';
    return { chave, atual: a, anterior: b, tendencia };
  });
}

export type PrevistoReal = { previstoKg: number; realKg: number; diferencaKg: number };

/**
 * Quanto o peso deveria ter mudado pelas calorias × quanto mudou de fato.
 * Valores positivos = perda. diferencaKg > 0: perdeu mais que o previsto.
 */
export function previstoVersusReal(p: { deficitAcumuladoKcal: number; pesoInicialKg: number; pesoFinalKg: number }): PrevistoReal {
  const previstoKg = Math.round((p.deficitAcumuladoKcal / KCAL_POR_KG) * 100) / 100;
  const realKg = Math.round((p.pesoInicialKg - p.pesoFinalKg) * 100) / 100;
  return { previstoKg, realKg, diferencaKg: Math.round((realKg - previstoKg) * 100) / 100 };
}
