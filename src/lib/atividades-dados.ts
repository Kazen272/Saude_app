// Leitura e gravação das atividades recorrentes e do registro de cada dia.
import { inicioNoDia, treinoCombinaCom, kcalEstimadas, nomeDaAtividade, treinoCorrespondente, diaDaSemana, type Intensidade, type TreinoGravado } from './atividades';
import { limitesDoDia } from './datas';
import { supabase } from './supabase';

export type AtividadeRecorrente = {
  id?: number;
  atividade: string;
  nomeLivre: string;
  dias: number[];
  hora: string;
  duracaoMin: number;
  intensidade: Intensidade;
  ativa: boolean;
};

const doBanco = (r: Record<string, unknown>): AtividadeRecorrente => ({
  id: r.id as number,
  atividade: r.activity as string,
  nomeLivre: (r.custom_name as string | null) ?? '',
  dias: (r.weekdays as number[]) ?? [],
  hora: r.start_time as string,
  duracaoMin: r.duration_min as number,
  intensidade: r.intensity as Intensidade,
  ativa: r.enabled as boolean,
});

export async function listarRecorrentes(): Promise<AtividadeRecorrente[]> {
  const { data, error } = await supabase.from('recurring_activities').select('*').order('start_time');
  if (error) throw error;
  return (data ?? []).map(doBanco);
}

export async function salvarRecorrente(a: AtividadeRecorrente): Promise<void> {
  const linha = {
    activity: a.atividade,
    custom_name: a.nomeLivre.trim() || null,
    weekdays: [...new Set(a.dias)].sort(),
    start_time: a.hora,
    duration_min: a.duracaoMin,
    intensity: a.intensidade,
    enabled: a.ativa,
  };
  const { error } = a.id
    ? await supabase.from('recurring_activities').update(linha).eq('id', a.id)
    : await supabase.from('recurring_activities').insert(linha);
  if (error) throw error;
}

export async function apagarRecorrente(id: number): Promise<void> {
  const { error } = await supabase.from('recurring_activities').delete().eq('id', id);
  if (error) throw error;
}

/** Uma atividade num dia: planejada (recorrente) e/ou registrada. */
export type AtividadeDoDia = {
  chave: string;
  recorrenteId: number | null;
  logId: number | null;
  atividade: string;
  nome: string;
  hora: string;
  duracaoMin: number;
  intensidade: Intensidade;
  /** pendente: ainda não respondida; relogio: um treino gravado coincide com o horário. */
  estado: 'pendente' | 'feito' | 'nao_feito' | 'relogio';
  kcalEstimadas: number;
  treino: TreinoGravado | null;
};

async function pesoAtual(): Promise<number> {
  const { data } = await supabase
    .from('body_entries')
    .select('weight_kg')
    .not('weight_kg', 'is', null)
    .order('measured_on', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.weight_kg != null ? Number(data.weight_kg) : 70;
}

/**
 * Atividades de um dia: as recorrentes daquele dia da semana mais as avulsas.
 * Se um treino gravado (relógio, Hevy, Strava…) cai no horário, ele conta como a
 * atividade; um "Fiz" manual do mesmo horário é desfeito para não contar duas vezes.
 */
export async function carregarAtividadesDoDia(dia: string): Promise<AtividadeDoDia[]> {
  const [a, m, d] = dia.split('-').map(Number);
  const { inicio, fim } = limitesDoDia(new Date(a, m - 1, d));
  const [rec, logs, treinos, kg] = await Promise.all([
    supabase.from('recurring_activities').select('*').eq('enabled', true),
    supabase.from('activity_logs').select('*').eq('day', dia),
    supabase.from('workouts').select('id, source, origin_app, title, started_at, ended_at, active_kcal').gte('started_at', inicio).lt('started_at', fim),
    pesoAtual(),
  ]);
  for (const r of [rec, logs, treinos]) if (r.error) throw r.error;

  const gravados: TreinoGravado[] = (treinos.data ?? []).map((t) => ({
    id: t.id as number,
    inicio: t.started_at as string,
    fim: (t.ended_at as string | null) ?? null,
    titulo: (t.title as string | null) ?? null,
    app: (t.origin_app as string | null) ?? null,
    kcal: (t.active_kcal as number | null) ?? null,
    manual: t.source === 'manual',
  }));
  const listaLogs = (logs.data ?? []) as Record<string, unknown>[];
  const semana = diaDaSemana(dia);

  type Base = Omit<AtividadeDoDia, 'estado' | 'kcalEstimadas' | 'treino' | 'chave'> & { status: string | null; workoutId: number | null };
  const itens: Base[] = [];
  for (const r of (rec.data ?? []).map(doBanco)) {
    if (!r.dias.includes(semana)) continue;
    const log = listaLogs.find((l) => l.recurring_id === r.id);
    itens.push({
      recorrenteId: r.id as number,
      logId: (log?.id as number | undefined) ?? null,
      atividade: r.atividade,
      nome: nomeDaAtividade(r.atividade, r.nomeLivre),
      hora: (log?.start_time as string | undefined) ?? r.hora,
      duracaoMin: (log?.duration_min as number | undefined) ?? r.duracaoMin,
      intensidade: ((log?.intensity as Intensidade | undefined) ?? r.intensidade) as Intensidade,
      status: (log?.status as string | undefined) ?? null,
      workoutId: (log?.workout_id as number | null | undefined) ?? null,
    });
  }
  // Avulsas e registros de recorrentes que já não estão ativas.
  for (const l of listaLogs) {
    if (itens.some((i) => i.logId === l.id)) continue;
    itens.push({
      recorrenteId: (l.recurring_id as number | null) ?? null,
      logId: l.id as number,
      atividade: l.activity as string,
      nome: nomeDaAtividade(l.activity as string, l.custom_name as string | null),
      hora: l.start_time as string,
      duracaoMin: l.duration_min as number,
      intensidade: l.intensity as Intensidade,
      status: l.status as string,
      workoutId: (l.workout_id as number | null) ?? null,
    });
  }
  itens.sort((x, y) => x.hora.localeCompare(y.hora));

  const usados = new Set<number>();
  const resultado: AtividadeDoDia[] = [];
  for (const i of itens) {
    const treino = i.status === 'nao_feito' ? null : treinoCorrespondente(dia, i.hora, i.duracaoMin, gravados, usados, treinoCombinaCom(i.atividade));
    if (treino) {
      usados.add(treino.id);
      // Havia um "Fiz" manual: o treino gravado passa a valer no lugar dele.
      if (i.workoutId != null) {
        await supabase.from('workouts').delete().eq('id', i.workoutId).eq('source', 'manual');
        if (i.logId != null) await supabase.from('activity_logs').update({ workout_id: null }).eq('id', i.logId);
      }
    }
    resultado.push({
      chave: i.logId != null ? `log-${i.logId}` : `rec-${i.recorrenteId}`,
      recorrenteId: i.recorrenteId,
      logId: i.logId,
      atividade: i.atividade,
      nome: i.nome,
      hora: i.hora,
      duracaoMin: i.duracaoMin,
      intensidade: i.intensidade,
      estado: treino ? 'relogio' : i.status === 'feito' ? 'feito' : i.status === 'nao_feito' ? 'nao_feito' : 'pendente',
      kcalEstimadas: kcalEstimadas(i.atividade, i.intensidade, kg, i.duracaoMin),
      treino,
    });
  }
  return resultado;
}

/** "Fiz": grava o treino (manual, com calorias estimadas) e o registro do dia. */
export async function marcarFeita(dia: string, a: Pick<AtividadeDoDia, 'recorrenteId' | 'logId' | 'atividade' | 'nome' | 'hora' | 'duracaoMin' | 'intensidade' | 'kcalEstimadas'>): Promise<void> {
  await desfazer(a.logId);
  const inicio = inicioNoDia(dia, a.hora);
  const { data: treino, error: e1 } = await supabase
    .from('workouts')
    .insert({
      source: 'manual',
      origin_app: 'saude',
      title: a.nome,
      started_at: inicio.toISOString(),
      ended_at: new Date(inicio.getTime() + a.duracaoMin * 60_000).toISOString(),
      active_kcal: a.kcalEstimadas,
    })
    .select('id')
    .single();
  if (e1) throw e1;
  await gravarLog(dia, a, 'feito', treino.id as number);
}

/** "Não fiz": guarda a resposta para não perguntar de novo. */
export async function marcarNaoFeita(dia: string, a: Pick<AtividadeDoDia, 'recorrenteId' | 'logId' | 'atividade' | 'nome' | 'hora' | 'duracaoMin' | 'intensidade'>): Promise<void> {
  await desfazer(a.logId);
  await gravarLog(dia, a, 'nao_feito', null);
}

/** Apaga o registro (e o treino manual ligado a ele): volta a ser pendente. */
export async function desfazer(logId: number | null): Promise<void> {
  if (logId == null) return;
  const { data } = await supabase.from('activity_logs').select('workout_id').eq('id', logId).maybeSingle();
  if (data?.workout_id != null) await supabase.from('workouts').delete().eq('id', data.workout_id).eq('source', 'manual');
  const { error } = await supabase.from('activity_logs').delete().eq('id', logId);
  if (error) throw error;
}

async function gravarLog(
  dia: string,
  a: Pick<AtividadeDoDia, 'recorrenteId' | 'atividade' | 'nome' | 'hora' | 'duracaoMin' | 'intensidade'>,
  status: 'feito' | 'nao_feito',
  workoutId: number | null,
) {
  const { error } = await supabase.from('activity_logs').insert({
    day: dia,
    recurring_id: a.recorrenteId,
    activity: a.atividade,
    custom_name: a.atividade === 'outra' ? a.nome : null,
    start_time: a.hora,
    duration_min: a.duracaoMin,
    intensity: a.intensidade,
    status,
    workout_id: workoutId,
  });
  if (error) throw error;
}

/** Peso de referência para mostrar a estimativa no cadastro. */
export { pesoAtual };
