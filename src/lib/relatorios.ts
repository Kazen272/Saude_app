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
