// Regras de importação do Health Connect. Funções puras (sem acesso ao celular).
import { diaLocal } from './datas.ts';

/** Apps que costumam escrever no Health Connect, pelo nome do pacote Android. */
const APPS: Record<string, string> = {
  'com.huami.watch.hmwatchmanager': 'Zepp',
  'com.xiaomi.wearable': 'Mi Fitness',
  'com.xiaomi.hm.health': 'Zepp Life',
  'com.mi.health': 'Mi Fitness',
  'com.hevy': 'Hevy',
  'com.fatsecret.android': 'FatSecret',
  'com.sec.android.app.shealth': 'Samsung Health',
  'com.google.android.apps.fitness': 'Google Fit',
  'com.fitbit.FitbitMobile': 'Fitbit',
  'com.garmin.android.apps.connectmobile': 'Garmin Connect',
  'com.myfitnesspal.android': 'MyFitnessPal',
  'com.strava': 'Strava',
  android: 'Celular (Android)',
  'com.google.android.apps.healthdata': 'Health Connect',
};

export function nomeDoApp(pacote: string | null | undefined): string {
  if (!pacote) return 'outro app';
  return APPS[pacote] ?? pacote.split('.').slice(-1)[0];
}

/** Nome em português dos tipos de exercício mais comuns (código do Health Connect). */
const TIPOS: Record<number, string> = {
  0: 'Treino',
  5: 'Basquete',
  8: 'Bicicleta',
  9: 'Bicicleta ergométrica',
  10: 'Treino funcional',
  11: 'Boxe',
  13: 'Calistenia',
  16: 'Dança',
  25: 'Elíptico',
  36: 'HIIT',
  37: 'Trilha',
  44: 'Artes marciais',
  48: 'Pilates',
  54: 'Remo',
  56: 'Corrida',
  57: 'Esteira',
  64: 'Futebol',
  68: 'Escada',
  69: 'Escada (aparelho)',
  70: 'Musculação',
  71: 'Alongamento',
  72: 'Surfe',
  73: 'Natação',
  74: 'Natação',
  75: 'Tênis de mesa',
  76: 'Tênis',
  78: 'Vôlei',
  79: 'Caminhada',
  81: 'Musculação',
  83: 'Ioga',
};

export function nomeDoTreino(tipo: number, titulo?: string | null): string {
  const t = titulo?.trim();
  if (t) return t;
  return TIPOS[tipo] ?? 'Treino';
}

/** Dia (YYYY-MM-DD) de um resultado agrupado por dia: o Health Connect devolve hora local. */
export function diaDoGrupo(inicio: string): string {
  return inicio.slice(0, 10);
}

/** Estágios do sono em que a pessoa não está dormindo (acordada / fora da cama). */
const ESTAGIOS_ACORDADO = new Set([1, 3]);

export type SonoBruto = {
  id: string;
  inicio: string;
  fim: string;
  origem: string | null;
  estagios?: { startTime: string; endTime: string; stage: number }[];
};

export type NoiteImportada = { dia: string; deitou: string; acordou: string; minutosDormindo: number; origem: string | null };

const minutosEntre = (a: string, b: string) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 60000));

/** Minutos efetivamente dormindo: tempo na cama menos estágios acordado, quando o app informa estágios. */
export function minutosDormindo(s: SonoBruto): number {
  const total = minutosEntre(s.inicio, s.fim);
  if (!s.estagios?.length) return total;
  const acordado = s.estagios.filter((e) => ESTAGIOS_ACORDADO.has(e.stage)).reduce((soma, e) => soma + minutosEntre(e.startTime, e.endTime), 0);
  return Math.max(0, total - acordado);
}

/**
 * Uma noite por dia (o dia em que acordou). Sessões de apps diferentes podem
 * registrar a mesma noite; fica a mais longa. Cochilos curtos (< 3 h) só contam
 * se forem a única sessão do dia.
 */
export function noitesPorDia(sessoes: SonoBruto[]): NoiteImportada[] {
  const porDia = new Map<string, SonoBruto>();
  for (const s of sessoes) {
    const dia = diaLocal(new Date(s.fim));
    const atual = porDia.get(dia);
    if (!atual || minutosEntre(s.inicio, s.fim) > minutosEntre(atual.inicio, atual.fim)) porDia.set(dia, s);
  }
  return [...porDia.entries()]
    .map(([dia, s]) => ({ dia, deitou: s.inicio, acordou: s.fim, minutosDormindo: minutosDormindo(s), origem: s.origem }))
    .filter((n) => n.minutosDormindo > 0 && minutosEntre(n.deitou, n.acordou) < 20 * 60)
    .sort((a, b) => a.dia.localeCompare(b.dia));
}

export type MedidaInstantanea = { quando: string; valor: number };

/** Último valor de cada dia (ex.: FC de repouso, peso). */
export function ultimoPorDia(medidas: MedidaInstantanea[]): Map<string, number> {
  const ordenadas = [...medidas].sort((a, b) => a.quando.localeCompare(b.quando));
  const porDia = new Map<string, number>();
  for (const m of ordenadas) porDia.set(diaLocal(new Date(m.quando)), m.valor);
  return porDia;
}

/** Duas sessões de treino iguais vindas de apps diferentes (mesmo horário ± 10 min). */
export function treinosDuplicados(a: { inicio: string; fim: string }, b: { inicio: string; fim: string }): boolean {
  const dez = 10 * 60_000;
  return Math.abs(Date.parse(a.inicio) - Date.parse(b.inicio)) <= dez && Math.abs(Date.parse(a.fim) - Date.parse(b.fim)) <= dez;
}

/** Origens que contam como "dieta": se só aparecerem outras, a nutrição é ignorada. */
export function temDadoDeDieta(origens: string[]): boolean {
  return origens.length > 0;
}

/**
 * FC de repouso estimada a partir das amostras contínuas do relógio (para apps
 * que gravam "Frequência cardíaca" mas não "FC de repouso", como o Zepp):
 * média de cada janela de 30 min com 3+ amostras; o repouso do dia é a menor delas.
 */
export function fcRepousoDasAmostras(amostras: MedidaInstantanea[]): Map<string, number> {
  const janelas = new Map<string, { dia: string; soma: number; n: number }>();
  for (const a of amostras) {
    if (!(a.valor >= 30 && a.valor <= 220)) continue;
    const t = new Date(a.quando);
    const dia = diaLocal(t);
    const chave = `${dia}|${t.getHours()}|${t.getMinutes() < 30 ? 0 : 1}`;
    const j = janelas.get(chave) ?? { dia, soma: 0, n: 0 };
    j.soma += a.valor;
    j.n += 1;
    janelas.set(chave, j);
  }
  const porDia = new Map<string, number>();
  for (const j of janelas.values()) {
    if (j.n < 3) continue;
    const media = Math.round(j.soma / j.n);
    const atual = porDia.get(j.dia);
    if (atual == null || media < atual) porDia.set(j.dia, media);
  }
  // Relógio que mede de tempos em tempos (ex.: a cada 30 min) não enche janelas:
  // nesses dias, usa a média das 10% menores medições (mínimo 3), com 6+ medições no dia.
  const amostrasPorDia = new Map<string, number[]>();
  for (const a of amostras) {
    if (!(a.valor >= 30 && a.valor <= 220)) continue;
    const dia = diaLocal(new Date(a.quando));
    if (!amostrasPorDia.has(dia)) amostrasPorDia.set(dia, []);
    amostrasPorDia.get(dia)?.push(a.valor);
  }
  for (const [dia, valores] of amostrasPorDia) {
    if (porDia.has(dia) || valores.length < 6) continue;
    const menores = [...valores].sort((x, y) => x - y).slice(0, Math.max(3, Math.round(valores.length * 0.1)));
    porDia.set(dia, Math.round(menores.reduce((s, v) => s + v, 0) / menores.length));
  }
  return porDia;
}

/**
 * Calorias totais por dia somando os registros gravados pelos apps (não a agregação
 * do Health Connect, que preenche dias sem dado com um basal padrão, ex.: 1.565).
 * Se mais de um app grava, vale o maior total do dia.
 */
export function totaisPorDia(registros: { inicio: string; kcal: number; origem: string | null }[]): Map<string, number> {
  const porDiaEOrigem = new Map<string, number>();
  for (const r of registros) {
    if (!(r.kcal > 0)) continue;
    const chave = `${diaLocal(new Date(r.inicio))}|${r.origem ?? ''}`;
    porDiaEOrigem.set(chave, (porDiaEOrigem.get(chave) ?? 0) + r.kcal);
  }
  const porDia = new Map<string, number>();
  for (const [chave, kcal] of porDiaEOrigem) {
    const dia = chave.split('|')[0];
    porDia.set(dia, Math.max(porDia.get(dia) ?? 0, Math.round(kcal)));
  }
  return porDia;
}

/** Como cada tipo de dado aparece na tela. */
const NOMES_TIPO: Record<string, string> = {
  Steps: 'passos',
  ActiveCaloriesBurned: 'calorias',
  TotalCaloriesBurned: 'calorias',
  HeartRate: 'frequência cardíaca',
  RestingHeartRate: 'frequência cardíaca',
  SleepSession: 'sono',
  ExerciseSession: 'treinos',
  Nutrition: 'dieta',
  Weight: 'peso',
};

/** "passos, calorias e sono" a partir dos tipos de dado do Health Connect. */
export function descreverTipos(tipos: string[]): string {
  const nomes = [...new Set(tipos.map((t) => NOMES_TIPO[t]).filter(Boolean))];
  if (nomes.length <= 1) return nomes[0] ?? '';
  return `${nomes.slice(0, -1).join(', ')} e ${nomes.at(-1)}`;
}
