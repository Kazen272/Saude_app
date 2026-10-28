// Leitura do Health Connect (Android) e gravação no banco.
// Relógio (Zepp / Mi Fitness), Hevy e FatSecret escrevem no Health Connect;
// o app lê de lá e guarda um resumo por dia na conta da pessoa.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import {
  SdkAvailabilityStatus,
  aggregateGroupByPeriod,
  aggregateRecord,
  getGrantedPermissions,
  getSdkStatus,
  initialize,
  openHealthConnectSettings,
  readRecords,
  requestPermission,
  type Permission,
  type RecordType,
} from 'react-native-health-connect';

import { diaLocal, somarDias } from './datas';
import { diaDoGrupo, nomeDoApp, nomeDoTreino, noitesPorDia, treinosDuplicados, ultimoPorDia, type SonoBruto } from './healthconnect-regras';
import { supabase } from './supabase';

const DIAS = 28;
const CHAVE_ESTADO = 'healthconnect:estado';

const TIPOS: RecordType[] = [
  'Steps',
  'ActiveCaloriesBurned',
  'TotalCaloriesBurned',
  'RestingHeartRate',
  'SleepSession',
  'ExerciseSession',
  'Nutrition',
  'Weight',
];
export const PERMISSOES: Permission[] = TIPOS.map((recordType) => ({ accessType: 'read', recordType }));

export type Disponibilidade = 'disponivel' | 'precisa_atualizar' | 'indisponivel';

export type EstadoSync = {
  ultimaSync: string | null;
  /** Apps que escreveram cada tipo de dado na última leitura. */
  origens: { atividade: string[]; sono: string[]; treinos: string[]; dieta: string[]; peso: string[] };
  contagem: { dias: number; noites: number; treinos: number; diasDieta: number; pesagens: number };
  /** Horário do dado mais recente do relógio que chegou ao Health Connect. */
  ultimoDadoRelogio: string | null;
  erro: string | null;
};

const ESTADO_VAZIO: EstadoSync = {
  ultimaSync: null,
  origens: { atividade: [], sono: [], treinos: [], dieta: [], peso: [] },
  contagem: { dias: 0, noites: 0, treinos: 0, diasDieta: 0, pesagens: 0 },
  ultimoDadoRelogio: null,
  erro: null,
};

export async function lerEstado(): Promise<EstadoSync> {
  try {
    const bruto = await AsyncStorage.getItem(CHAVE_ESTADO);
    return bruto ? { ...ESTADO_VAZIO, ...JSON.parse(bruto) } : ESTADO_VAZIO;
  } catch {
    return ESTADO_VAZIO;
  }
}

async function salvarEstado(e: EstadoSync) {
  try {
    await AsyncStorage.setItem(CHAVE_ESTADO, JSON.stringify(e));
  } catch {
    // estado é só informativo; falhar aqui não impede a sincronização
  }
}

let iniciado = false;

export async function disponibilidade(): Promise<Disponibilidade> {
  if (Platform.OS !== 'android') return 'indisponivel';
  try {
    const status = await getSdkStatus();
    if (status === SdkAvailabilityStatus.SDK_AVAILABLE) return 'disponivel';
    if (status === SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'precisa_atualizar';
    return 'indisponivel';
  } catch {
    return 'indisponivel';
  }
}

async function garantirIniciado(): Promise<boolean> {
  if (iniciado) return true;
  if ((await disponibilidade()) !== 'disponivel') return false;
  iniciado = await initialize();
  return iniciado;
}

/** Quais tipos de dado a pessoa já liberou. */
export async function permissoesConcedidas(): Promise<RecordType[]> {
  if (!(await garantirIniciado())) return [];
  const lista = await getGrantedPermissions();
  return lista.filter((p) => p.accessType === 'read').map((p) => p.recordType as RecordType);
}

/** Abre a tela do Health Connect para liberar a leitura. Devolve os tipos liberados. */
export async function pedirPermissoes(): Promise<RecordType[]> {
  if (!(await garantirIniciado())) return [];
  const concedidas = await requestPermission(PERMISSOES);
  return concedidas.filter((p) => p.accessType === 'read').map((p) => p.recordType as RecordType);
}

export function abrirConfiguracoes() {
  try {
    openHealthConnectSettings();
  } catch {
    Linking.openSettings();
  }
}

export function abrirLojaHealthConnect() {
  Linking.openURL('market://details?id=com.google.android.apps.healthdata').catch(() =>
    Linking.openURL('https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata'),
  );
}

// ---------------------------------------------------------------------------

/** Meia-noite local de `dias` dias atrás, em ISO, para o filtro de tempo. */
function inicioDaJanela(dias: number): string {
  const [a, m, d] = somarDias(diaLocal(), -(dias - 1)).split('-').map(Number);
  return new Date(a, m - 1, d).toISOString();
}

async function lerTodos<T extends RecordType>(tipo: T, inicio: string) {
  const fim = new Date().toISOString();
  const registros = [];
  let pageToken: string | undefined;
  do {
    const r = await readRecords(tipo, { timeRangeFilter: { operator: 'between', startTime: inicio, endTime: fim }, pageSize: 1000, pageToken });
    registros.push(...r.records);
    pageToken = r.pageToken || undefined;
  } while (pageToken);
  return registros;
}

/** Soma por dia local, já sem duplicar fontes (o Health Connect resolve a prioridade). */
async function somaPorDia(tipo: 'Steps' | 'ActiveCaloriesBurned' | 'TotalCaloriesBurned', inicio: string) {
  const grupos = await aggregateGroupByPeriod({
    recordType: tipo,
    timeRangeFilter: { operator: 'between', startTime: inicio, endTime: new Date().toISOString() },
    timeRangeSlicer: { period: 'DAYS', length: 1 },
  });
  const porDia = new Map<string, number>();
  const origens = new Set<string>();
  for (const g of grupos) {
    const r = g.result as Record<string, unknown> & { dataOrigins?: string[] };
    const valor =
      tipo === 'Steps'
        ? Number(r.COUNT_TOTAL ?? 0)
        : Number((r[tipo === 'ActiveCaloriesBurned' ? 'ACTIVE_CALORIES_TOTAL' : 'ENERGY_TOTAL'] as { inKilocalories?: number } | undefined)?.inKilocalories ?? 0);
    if (valor > 0) porDia.set(diaDoGrupo(g.startTime), Math.round(valor));
    r.dataOrigins?.forEach((o) => origens.add(o));
  }
  return { porDia, origens };
}

const tem = (concedidas: Set<RecordType>, t: RecordType) => concedidas.has(t);

/**
 * Lê os últimos 28 dias do Health Connect e grava no banco.
 * Registros manuais têm prioridade: peso e sono digitados no app não são sobrescritos.
 */
let emAndamento: Promise<EstadoSync> | null = null;

/** Evita duas leituras ao mesmo tempo (ex.: ao abrir o app e a tela Hoje juntas). */
export function sincronizar(): Promise<EstadoSync> {
  if (!emAndamento) emAndamento = executarSincronizacao().finally(() => (emAndamento = null));
  return emAndamento;
}

async function executarSincronizacao(): Promise<EstadoSync> {
  const anterior = await lerEstado();
  try {
    if (!(await garantirIniciado())) throw new Error('Health Connect indisponível neste celular.');
    const concedidas = new Set(await permissoesConcedidas());
    if (!concedidas.size) throw new Error('A leitura ainda não foi liberada no Health Connect.');

    const { data: usuario } = await supabase.auth.getUser();
    const uid = usuario.user?.id;
    if (!uid) throw new Error('Sessão expirada. Entre de novo.');

    const inicio = inicioDaJanela(DIAS);
    const estado: EstadoSync = { ...ESTADO_VAZIO, origens: { ...ESTADO_VAZIO.origens }, contagem: { ...ESTADO_VAZIO.contagem } };

    // --- Atividade do dia: passos, calorias, FC de repouso, minutos de sono ---
    const vazio = { porDia: new Map<string, number>(), origens: new Set<string>() };
    const [passos, ativas, totais] = await Promise.all([
      tem(concedidas, 'Steps') ? somaPorDia('Steps', inicio) : vazio,
      tem(concedidas, 'ActiveCaloriesBurned') ? somaPorDia('ActiveCaloriesBurned', inicio) : vazio,
      tem(concedidas, 'TotalCaloriesBurned') ? somaPorDia('TotalCaloriesBurned', inicio) : vazio,
    ]);
    const fcRepouso = tem(concedidas, 'RestingHeartRate')
      ? ultimoPorDia((await lerTodos('RestingHeartRate', inicio)).map((r) => ({ quando: r.time, valor: r.beatsPerMinute })))
      : new Map<string, number>();

    const sonoBruto: SonoBruto[] = tem(concedidas, 'SleepSession')
      ? (await lerTodos('SleepSession', inicioDaJanela(DIAS + 1))).map((r) => ({
          id: r.metadata?.id ?? r.startTime,
          inicio: r.startTime,
          fim: r.endTime,
          origem: r.metadata?.dataOrigin ?? null,
          estagios: r.stages,
        }))
      : [];
    const noites = noitesPorDia(sonoBruto).filter((n) => n.dia >= somarDias(diaLocal(), -(DIAS - 1)));

    // O Health Connect só recebe dados quando o app do relógio sincroniza:
    // guarda o horário do dado mais recente para mostrar na tela.
    const marcas: string[] = noites.map((n) => n.acordou);
    if (tem(concedidas, 'Steps')) {
      try {
        const r = await readRecords('Steps', {
          timeRangeFilter: { operator: 'between', startTime: inicioDaJanela(2), endTime: new Date().toISOString() },
          ascendingOrder: false,
          pageSize: 20,
        });
        marcas.push(...r.records.map((x) => x.endTime));
      } catch {
        // sem passos recentes: segue com as outras marcas
      }
    }
    estado.ultimoDadoRelogio = marcas.length ? marcas.sort().at(-1) ?? null : anterior.ultimoDadoRelogio;

    const dias = new Set([...passos.porDia.keys(), ...ativas.porDia.keys(), ...totais.porDia.keys(), ...fcRepouso.keys(), ...noites.map((n) => n.dia)]);
    const linhasAtividade = [...dias].map((dia) => ({
      user_id: uid,
      day: dia,
      steps: passos.porDia.get(dia) ?? null,
      active_kcal: ativas.porDia.get(dia) ?? null,
      total_kcal: totais.porDia.get(dia) ?? null,
      resting_hr: fcRepouso.get(dia) ?? null,
      sleep_minutes: noites.find((n) => n.dia === dia)?.minutosDormindo ?? null,
      source: 'health_connect',
      synced_at: new Date().toISOString(),
    }));
    if (linhasAtividade.length) {
      const { error } = await supabase.from('daily_activity').upsert(linhasAtividade, { onConflict: 'user_id,day' });
      if (error) throw error;
    }
    estado.origens.atividade = [...new Set([...passos.origens, ...ativas.origens, ...totais.origens])];
    estado.contagem.dias = linhasAtividade.length;

    // --- Sono: uma sessão por noite (o manual continua valendo por cima) ---
    if (noites.length) {
      const { error } = await supabase.from('sleep_sessions').upsert(
        noites.map((n) => ({ user_id: uid, night: n.dia, bed_at: n.deitou, wake_at: n.acordou, quality: null, source: 'health_connect' })),
        { onConflict: 'user_id,night,source' },
      );
      if (error) throw error;
    }
    estado.origens.sono = [...new Set(noites.map((n) => n.origem).filter((o): o is string => !!o))];
    estado.contagem.noites = noites.length;

    // --- Treinos (Hevy, relógio...) ---
    if (tem(concedidas, 'ExerciseSession')) {
      const sessoes = (await lerTodos('ExerciseSession', inicio)).sort((a, b) => a.startTime.localeCompare(b.startTime));
      // Mesmo treino registrado por dois apps: fica o primeiro (Hevy tem prioridade).
      const prioridade = (o?: string) => (o === 'com.hevy' ? 0 : 1);
      const ordenadas = [...sessoes].sort((a, b) => prioridade(a.metadata?.dataOrigin) - prioridade(b.metadata?.dataOrigin));
      const escolhidas: typeof sessoes = [];
      for (const s of ordenadas) {
        if (!escolhidas.some((e) => treinosDuplicados({ inicio: e.startTime, fim: e.endTime }, { inicio: s.startTime, fim: s.endTime }))) escolhidas.push(s);
      }
      const linhas = [];
      for (const s of escolhidas) {
        let kcal: number | null = null;
        if (tem(concedidas, 'ActiveCaloriesBurned')) {
          try {
            const r = await aggregateRecord({
              recordType: 'ActiveCaloriesBurned',
              timeRangeFilter: { operator: 'between', startTime: s.startTime, endTime: s.endTime },
              dataOriginFilter: s.metadata?.dataOrigin ? [s.metadata.dataOrigin] : undefined,
            });
            const v = r.ACTIVE_CALORIES_TOTAL?.inKilocalories;
            kcal = v && v > 0 ? Math.round(v) : null;
          } catch {
            kcal = null;
          }
        }
        linhas.push({
          user_id: uid,
          source: 'health_connect',
          external_id: s.metadata?.id ?? `${s.startTime}-${s.metadata?.dataOrigin ?? ''}`,
          origin_app: s.metadata?.dataOrigin ?? null,
          title: nomeDoTreino(s.exerciseType, s.title),
          started_at: s.startTime,
          ended_at: s.endTime,
          active_kcal: kcal,
        });
      }
      if (linhas.length) {
        const { error } = await supabase.from('workouts').upsert(linhas, { onConflict: 'user_id,source,external_id' });
        if (error) throw error;
      }
      estado.origens.treinos = [...new Set(escolhidas.map((s) => s.metadata?.dataOrigin).filter((o): o is string => !!o))];
      estado.contagem.treinos = linhas.length;
    }

    // --- Dieta (FatSecret ou outro app de nutrição) ---
    if (tem(concedidas, 'Nutrition')) {
      const grupos = await aggregateGroupByPeriod({
        recordType: 'Nutrition',
        timeRangeFilter: { operator: 'between', startTime: inicio, endTime: new Date().toISOString() },
        timeRangeSlicer: { period: 'DAYS', length: 1 },
      });
      const g = (m?: { inGrams?: number }) => (m?.inGrams != null ? Math.round(m.inGrams * 10) / 10 : null);
      const linhas = grupos
        .filter((x) => (x.result.ENERGY_TOTAL?.inKilocalories ?? 0) > 0)
        .map((x) => ({
          user_id: uid,
          day: diaDoGrupo(x.startTime),
          kcal: Math.round(x.result.ENERGY_TOTAL.inKilocalories),
          protein_g: g(x.result.PROTEIN_TOTAL),
          carbs_g: g(x.result.TOTAL_CARBOHYDRATE_TOTAL),
          fat_g: g(x.result.TOTAL_FAT_TOTAL),
          source: 'health_connect',
          synced_at: new Date().toISOString(),
        }));
      if (linhas.length) {
        const { error } = await supabase.from('nutrition_days').upsert(linhas, { onConflict: 'user_id,day' });
        if (error) throw error;
      }
      estado.origens.dieta = [...new Set(grupos.flatMap((x) => x.result.dataOrigins ?? []))];
      estado.contagem.diasDieta = linhas.length;
    }

    // --- Peso de balança conectada (não substitui o que foi digitado no app) ---
    if (tem(concedidas, 'Weight')) {
      const registros = await lerTodos('Weight', inicio);
      const porDia = ultimoPorDia(registros.map((r) => ({ quando: r.time, valor: r.weight.inKilograms })));
      const linhas = [...porDia.entries()]
        .filter(([, kg]) => kg >= 20 && kg <= 400)
        .map(([dia, kg]) => ({ user_id: uid, measured_on: dia, weight_kg: Math.round(kg * 100) / 100, source: 'health_connect' }));
      if (linhas.length) {
        const { error } = await supabase.from('body_entries').upsert(linhas, { onConflict: 'user_id,measured_on', ignoreDuplicates: true });
        if (error) throw error;
      }
      estado.origens.peso = [...new Set(registros.map((r) => r.metadata?.dataOrigin).filter((o): o is string => !!o))];
      estado.contagem.pesagens = linhas.length;
    }

    estado.ultimaSync = new Date().toISOString();
    await salvarEstado(estado);
    return estado;
  } catch (e) {
    const comErro = { ...anterior, erro: e instanceof Error ? e.message : 'Erro ao ler o Health Connect.' };
    await salvarEstado(comErro);
    return comErro;
  }
}

/** Sincroniza sem atrapalhar: só se já houver permissão e a última leitura tiver mais de 10 min. */
export async function sincronizarSeLiberado(): Promise<EstadoSync | null> {
  if (Platform.OS !== 'android') return null;
  const estado = await lerEstado();
  if (emAndamento) return emAndamento;
  if (estado.ultimaSync && Date.now() - Date.parse(estado.ultimaSync) < 10 * 60_000) return null;
  if (!(await permissoesConcedidas().catch(() => [])).length) return null;
  return sincronizar();
}

export { nomeDoApp };
