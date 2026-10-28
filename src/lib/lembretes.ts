import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { MAX_DISPAROS, disparos, type Lembrete } from './lembretes-regras';
import { supabase } from './supabase';

const CANAL = 'lembretes';

type Linha = {
  id: number;
  title: string;
  body: string | null;
  kind: 'horarios' | 'intervalo';
  weekdays: number[];
  times: string[];
  interval_minutes: number | null;
  window_start: string | null;
  window_end: string | null;
  link: string | null;
  enabled: boolean;
};

const deLinha = (l: Linha): Lembrete => ({
  id: l.id,
  titulo: l.title,
  mensagem: l.body ?? '',
  tipo: l.kind,
  dias: l.weekdays,
  horarios: l.times,
  intervaloMin: l.interval_minutes,
  inicio: l.window_start,
  fim: l.window_end,
  link: l.link,
  ativo: l.enabled,
});

const paraLinha = (l: Lembrete) => ({
  title: l.titulo.trim(),
  body: l.mensagem.trim() || null,
  kind: l.tipo,
  weekdays: l.dias,
  times: l.tipo === 'horarios' ? l.horarios : [],
  interval_minutes: l.tipo === 'intervalo' ? l.intervaloMin : null,
  window_start: l.tipo === 'intervalo' ? l.inicio : null,
  window_end: l.tipo === 'intervalo' ? l.fim : null,
  link: l.link,
  enabled: l.ativo,
});

export async function listarLembretes(): Promise<Lembrete[]> {
  const { data, error } = await supabase.from('reminders').select('*').order('created_at');
  if (error) throw error;
  return ((data ?? []) as Linha[]).map(deLinha);
}

export async function salvarLembrete(l: Lembrete): Promise<void> {
  const { error } = l.id
    ? await supabase.from('reminders').update(paraLinha(l)).eq('id', l.id)
    : await supabase.from('reminders').insert(paraLinha(l));
  if (error) throw error;
}

export async function apagarLembrete(id: number): Promise<void> {
  const { error } = await supabase.from('reminders').delete().eq('id', id);
  if (error) throw error;
}

export async function inserirLembretes(lista: Lembrete[]): Promise<void> {
  const { error } = await supabase.from('reminders').insert(lista.map(paraLinha));
  if (error) throw error;
}

/** Pede permissão para notificar; devolve se foi concedida. */
export async function pedirPermissao(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CANAL, {
      name: 'Lembretes',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const atual = await Notifications.getPermissionsAsync();
  if (atual.granted) return true;
  const pedido = await Notifications.requestPermissionsAsync();
  return pedido.granted;
}

/**
 * Refaz todos os agendamentos do celular a partir dos lembretes salvos.
 * Chamado ao entrar no app e sempre que um lembrete muda, para o celular ficar
 * igual ao que está no banco (inclusive num celular novo).
 */
export async function sincronizarAgendamentos(lista?: Lembrete[]): Promise<{ agendados: number; semPermissao: boolean }> {
  if (Platform.OS === 'web') return { agendados: 0, semPermissao: false };
  const lembretes = lista ?? (await listarLembretes());
  const ativos = lembretes.filter((l) => l.ativo);
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!ativos.length) return { agendados: 0, semPermissao: false };
  if (!(await pedirPermissao())) return { agendados: 0, semPermissao: true };

  let agendados = 0;
  for (const l of ativos) {
    for (const d of disparos(l)) {
      if (agendados >= MAX_DISPAROS) break;
      await Notifications.scheduleNotificationAsync({
        content: { title: l.titulo, body: l.mensagem || undefined, data: { url: l.link ?? '/' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, channelId: CANAL, ...d },
      });
      agendados++;
    }
  }
  return { agendados, semPermissao: false };
}
