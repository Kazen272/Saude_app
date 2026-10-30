// Atividades físicas (catálogo genérico) e regras das atividades recorrentes. Funções puras.

export type Intensidade = 'leve' | 'moderada' | 'intensa';

export type Grupo = 'Lutas' | 'Corrida e caminhada' | 'Ciclismo' | 'Aquáticas' | 'Esportes' | 'Academia e fitness' | 'Corpo e mente' | 'Dança' | 'Outras';

export type TipoAtividade = {
  codigo: string;
  nome: string;
  grupo: Grupo;
  /** Equivalente metabólico (MET) por intensidade, segundo o Compêndio de Atividades Físicas (valores aproximados). */
  met: Record<Intensidade, number>;
};

const t = (codigo: string, nome: string, grupo: Grupo, leve: number, moderada: number, intensa: number): TipoAtividade => ({
  codigo,
  nome,
  grupo,
  met: { leve, moderada, intensa },
});

export const ATIVIDADES: TipoAtividade[] = [
  t('muay_thai', 'Muay Thai', 'Lutas', 5.3, 7.8, 10.3),
  t('boxe', 'Boxe', 'Lutas', 5.5, 7.8, 12),
  t('jiu_jitsu', 'Jiu-jitsu', 'Lutas', 4, 6, 8),
  t('judo', 'Judô', 'Lutas', 5.3, 7.8, 10.3),
  t('karate', 'Karatê', 'Lutas', 5.3, 7.8, 10.3),
  t('taekwondo', 'Taekwondo', 'Lutas', 5.3, 7.8, 10.3),
  t('mma', 'MMA', 'Lutas', 6, 8, 10.3),
  t('capoeira', 'Capoeira', 'Lutas', 5, 7, 9),
  t('caminhada', 'Caminhada', 'Corrida e caminhada', 3, 3.5, 5),
  t('corrida', 'Corrida', 'Corrida e caminhada', 7, 9.8, 11.5),
  t('trilha', 'Trilha', 'Corrida e caminhada', 5.3, 6, 7.8),
  t('bicicleta', 'Bicicleta', 'Ciclismo', 5.8, 7.5, 10),
  t('spinning', 'Spinning / bike indoor', 'Ciclismo', 6.8, 8.5, 10.5),
  t('natacao', 'Natação', 'Aquáticas', 5.8, 8.3, 10),
  t('hidroginastica', 'Hidroginástica', 'Aquáticas', 4, 5.3, 6),
  t('surfe', 'Surfe', 'Aquáticas', 3, 5, 6),
  t('futebol', 'Futebol', 'Esportes', 7, 8, 10),
  t('volei', 'Vôlei', 'Esportes', 3, 4, 6),
  t('basquete', 'Basquete', 'Esportes', 6, 6.5, 8),
  t('tenis', 'Tênis', 'Esportes', 5, 7.3, 8),
  t('beach_tennis', 'Beach tennis', 'Esportes', 5, 6, 7.5),
  t('padel', 'Padel', 'Esportes', 5, 6, 7.3),
  t('futevolei', 'Futevôlei', 'Esportes', 5, 6, 8),
  t('handebol', 'Handebol', 'Esportes', 8, 8, 12),
  t('musculacao', 'Musculação', 'Academia e fitness', 3.5, 5, 6),
  t('funcional', 'Treino funcional', 'Academia e fitness', 4, 6, 8),
  t('crossfit', 'CrossFit', 'Academia e fitness', 5, 8, 10),
  t('hiit', 'HIIT', 'Academia e fitness', 6, 8, 10),
  t('aerobica', 'Aeróbica / jump', 'Academia e fitness', 5, 7, 8.5),
  t('remo', 'Remo ergométrico', 'Academia e fitness', 4.8, 7, 8.5),
  t('yoga', 'Yoga', 'Corpo e mente', 2.5, 3, 4),
  t('pilates', 'Pilates', 'Corpo e mente', 3, 3.5, 4),
  t('alongamento', 'Alongamento', 'Corpo e mente', 2.3, 2.5, 3),
  t('danca', 'Dança', 'Dança', 4, 5, 7),
  t('zumba', 'Zumba', 'Dança', 5.5, 6.5, 7.5),
  t('escalada', 'Escalada', 'Outras', 5.8, 8, 9),
  t('patinacao', 'Patinação', 'Outras', 5, 7, 9.8),
  t('skate', 'Skate', 'Outras', 4, 5, 6),
  t('outra', 'Outra atividade', 'Outras', 3.5, 5, 7),
];

export const GRUPOS: Grupo[] = ['Lutas', 'Corrida e caminhada', 'Ciclismo', 'Aquáticas', 'Esportes', 'Academia e fitness', 'Corpo e mente', 'Dança', 'Outras'];

export const INTENSIDADES: { id: Intensidade; nome: string; descricao: string }[] = [
  { id: 'leve', nome: 'Leve', descricao: 'dá para conversar normalmente' },
  { id: 'moderada', nome: 'Moderada', descricao: 'respiração acelerada, fala curta' },
  { id: 'intensa', nome: 'Intensa', descricao: 'difícil falar, bem ofegante' },
];

export const tipoPorCodigo = (codigo: string): TipoAtividade => ATIVIDADES.find((a) => a.codigo === codigo) ?? ATIVIDADES[ATIVIDADES.length - 1];

/** Nome a mostrar: o personalizado (em "Outra") ou o do catálogo. */
export function nomeDaAtividade(codigo: string, nomeLivre?: string | null): string {
  return nomeLivre?.trim() || tipoPorCodigo(codigo).nome;
}

/** Busca sem acento e sem maiúsculas. */
export function buscarAtividades(texto: string): TipoAtividade[] {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = norm(texto.trim());
  if (!q) return ATIVIDADES;
  return ATIVIDADES.filter((a) => norm(a.nome).includes(q) || norm(a.grupo).includes(q));
}

/**
 * Calorias da atividade além do metabolismo de repouso: (MET − 1) × peso × horas.
 * É estimativa; quando o relógio grava o treino, vale o número dele.
 */
export function kcalEstimadas(codigo: string, intensidade: Intensidade, pesoKg: number, duracaoMin: number): number {
  const met = tipoPorCodigo(codigo).met[intensidade];
  return Math.max(0, Math.round((met - 1) * pesoKg * (duracaoMin / 60)));
}

/** Dia da semana no padrão dos lembretes: 1 = domingo … 7 = sábado. */
export function diaDaSemana(dia: string): number {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(a, m - 1, d).getDay() + 1;
}

/** "ter e qui", "seg a sex", "todo dia". */
export function descreverDias(dias: number[]): string {
  const nomes = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const ord = [...new Set(dias)].sort((a, b) => a - b);
  if (ord.length === 7) return 'todo dia';
  if (ord.join() === '2,3,4,5,6') return 'seg a sex';
  if (ord.join() === '1,7') return 'fim de semana';
  const n = ord.map((d) => nomes[d - 1]);
  return n.length <= 1 ? (n[0] ?? '') : `${n.slice(0, -1).join(', ')} e ${n.at(-1)}`;
}

/** "19:00" no dia local → Date. */
export function inicioNoDia(dia: string, hora: string): Date {
  const [a, m, d] = dia.split('-').map(Number);
  const [h, min] = hora.split(':').map(Number);
  return new Date(a, m - 1, d, h, min);
}

export type TreinoGravado = { id: number; inicio: string; fim: string | null; titulo: string | null; app: string | null; kcal: number | null; manual: boolean };

/**
 * Treino gravado (relógio, Hevy, Strava…) que corresponde a uma atividade: o que
 * mais se sobrepõe à janela planejada, com 60 min de folga antes e depois.
 */
export function treinoCorrespondente(
  dia: string,
  hora: string,
  duracaoMin: number,
  treinos: TreinoGravado[],
  jaUsados: Set<number> = new Set(),
  aceita: (t: TreinoGravado) => boolean = () => true,
): TreinoGravado | null {
  const folga = 60 * 60_000;
  const ini = inicioNoDia(dia, hora).getTime() - folga;
  const fim = inicioNoDia(dia, hora).getTime() + duracaoMin * 60_000 + folga;
  let melhor: TreinoGravado | null = null;
  let melhorSobreposicao = 0;
  for (const tr of treinos) {
    if (tr.manual || jaUsados.has(tr.id) || !aceita(tr)) continue;
    const a = Date.parse(tr.inicio);
    const b = tr.fim ? Date.parse(tr.fim) : a + 30 * 60_000;
    const sobreposicao = Math.min(b, fim) - Math.max(a, ini);
    if (sobreposicao > melhorSobreposicao) {
      melhor = tr;
      melhorSobreposicao = sobreposicao;
    }
  }
  return melhor;
}

/** Treino do Hevy (academia) só vale para atividades de academia; relógio e outros apps valem para qualquer uma. */
export function treinoCombinaCom(codigo: string): (t: TreinoGravado) => boolean {
  const academia = tipoPorCodigo(codigo).grupo === 'Academia e fitness';
  return (t) => !t.app?.includes('hevy') || academia;
}
