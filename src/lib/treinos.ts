// Calorias de treinos gravados (Hevy, relógio, atividades do app). Funções puras.
import { diaLocal } from './datas.ts';

export type TreinoParaGasto = {
  titulo: string | null;
  inicio: string;
  fim: string | null;
  kcal: number | null;
  app: string | null;
};

/** MET de referência da musculação (séries com descanso), do Compêndio de Atividades Físicas. */
const MET_MUSCULACAO = 3.5;

export function duracaoMin(t: Pick<TreinoParaGasto, 'inicio' | 'fim'>): number {
  if (!t.fim) return 0;
  return Math.max(0, Math.round((Date.parse(t.fim) - Date.parse(t.inicio)) / 60_000));
}

/** Caminhada, corrida e afins: os passos já contam esse gasto. */
export function ehDeslocamento(titulo: string | null): boolean {
  return /caminhad|corrid|trilha|esteira|walk|run|hik/i.test(titulo ?? '');
}

/**
 * Calorias de um treino: as medidas (relógio ou atividade do app) ou, para o Hevy,
 * que não envia calorias, estimativa pela duração e pelo peso: (MET − 1) × kg × horas.
 */
export function kcalDoTreino(t: TreinoParaGasto, pesoKg: number | null): { kcal: number; estimado: boolean } | null {
  if (t.kcal != null && t.kcal > 0) return { kcal: t.kcal, estimado: t.app === 'saude' };
  if (t.app?.includes('hevy') && pesoKg) {
    const min = duracaoMin(t);
    if (min <= 0) return null;
    return { kcal: Math.round((MET_MUSCULACAO - 1) * pesoKg * (min / 60)), estimado: true };
  }
  return null;
}

/** Soma, por dia local, as calorias dos treinos que os passos não cobrem. */
export function kcalTreinosPorDia(treinos: TreinoParaGasto[], pesoKg: number | null): Map<string, number> {
  const porDia = new Map<string, number>();
  for (const t of treinos) {
    if (ehDeslocamento(t.titulo)) continue;
    const k = kcalDoTreino(t, pesoKg);
    if (!k) continue;
    const dia = diaLocal(new Date(t.inicio));
    porDia.set(dia, (porDia.get(dia) ?? 0) + k.kcal);
  }
  return porDia;
}
