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

/** Caminhada ou corrida mais curta que isso é deslocamento ou aquecimento, não um treino à parte. */
export const MIN_DESLOCAMENTO_COMO_TREINO = 30;

export type SessaoDeTreino = { dia: string; inicio: string; fim: string | null; titulos: string[]; minutos: number; ids: number[] };

/**
 * Sessões de treino para contar "quantos treinos": junta registros que se sobrepõem
 * (ex.: Hevy e relógio gravando a mesma academia) e ignora caminhadas e corridas
 * curtas que o relógio detecta sozinho (ida à academia, aquecimento na esteira).
 */
export function sessoesDeTreino(treinos: (Pick<TreinoParaGasto, 'titulo' | 'inicio' | 'fim'> & { id?: number })[]): SessaoDeTreino[] {
  const validos = treinos
    .filter((t) => !(ehDeslocamento(t.titulo) && duracaoMin(t) < MIN_DESLOCAMENTO_COMO_TREINO))
    .sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio));
  const sessoes: (SessaoDeTreino & { fimMs: number })[] = [];
  for (const t of validos) {
    const ini = Date.parse(t.inicio);
    const fimMs = t.fim ? Date.parse(t.fim) : ini;
    const ultima = sessoes.at(-1);
    if (ultima && ini < ultima.fimMs) {
      if (t.titulo && !ultima.titulos.includes(t.titulo)) ultima.titulos.push(t.titulo);
      if (t.id != null) ultima.ids.push(t.id);
      if (fimMs > ultima.fimMs) {
        ultima.fimMs = fimMs;
        ultima.fim = t.fim;
      }
      ultima.minutos = Math.round((ultima.fimMs - Date.parse(ultima.inicio)) / 60_000);
      continue;
    }
    sessoes.push({ dia: diaLocal(new Date(ini)), inicio: t.inicio, fim: t.fim, titulos: t.titulo ? [t.titulo] : [], minutos: duracaoMin(t), ids: t.id != null ? [t.id] : [], fimMs });
  }
  return sessoes.map(({ fimMs: _, ...s }) => s);
}
