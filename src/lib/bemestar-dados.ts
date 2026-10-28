import type { CheckIn, Noite } from './bemestar';
import { diaLocal, somarDias } from './datas';
import { supabase } from './supabase';

const minutosDoDia = (iso: string) => {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
};

/**
 * Noites dos últimos `dias` dias (dia = data em que acordou). Se houver registro
 * manual e do relógio na mesma noite, vale o manual. Noites só com a duração vinda
 * do relógio (sem horário de deitar) também entram.
 */
export async function carregarNoites(dias: number, ate: string = diaLocal()): Promise<Noite[]> {
  const desde = somarDias(ate, -(dias - 1));
  const [sessoes, atividade] = await Promise.all([
    supabase.from('sleep_sessions').select('night, bed_at, wake_at, quality, source').gte('night', desde).lte('night', ate),
    supabase.from('daily_activity').select('day, sleep_minutes').gte('day', desde).lte('day', ate).not('sleep_minutes', 'is', null),
  ]);
  if (sessoes.error) throw sessoes.error;
  if (atividade.error) throw atividade.error;

  const porNoite = new Map<string, Noite>();
  for (const s of sessoes.data ?? []) {
    const atual = porNoite.get(s.night as string);
    if (atual && s.source !== 'manual') continue;
    porNoite.set(s.night as string, {
      dia: s.night as string,
      deitouMin: minutosDoDia(s.bed_at as string),
      duracaoMin: Math.round((Date.parse(s.wake_at as string) - Date.parse(s.bed_at as string)) / 60000),
      qualidade: (s.quality as number | null) ?? null,
    });
  }
  for (const a of atividade.data ?? []) {
    if (!porNoite.has(a.day as string)) {
      porNoite.set(a.day as string, { dia: a.day as string, deitouMin: null, duracaoMin: Number(a.sleep_minutes), qualidade: null });
    }
  }
  return [...porNoite.values()].sort((a, b) => a.dia.localeCompare(b.dia));
}

/** Salva a noite que terminou em `dia` (data em que acordou). Horários em minutos desde 0h. */
export async function registrarSono(p: { dia: string; deitouMin: number; acordouMin: number; qualidade: number | null }): Promise<void> {
  const [a, m, d] = p.dia.split('-').map(Number);
  const acordou = new Date(a, m - 1, d, Math.floor(p.acordouMin / 60), p.acordouMin % 60);
  // Deitou depois do horário de acordar (ex.: 23:30 → 06:30): foi na véspera.
  const diaDeitou = p.deitouMin >= p.acordouMin ? d - 1 : d;
  const deitou = new Date(a, m - 1, diaDeitou, Math.floor(p.deitouMin / 60), p.deitouMin % 60);
  const { data: usuario } = await supabase.auth.getUser();
  const { error } = await supabase.from('sleep_sessions').upsert(
    {
      user_id: usuario.user?.id,
      night: p.dia,
      bed_at: deitou.toISOString(),
      wake_at: acordou.toISOString(),
      quality: p.qualidade,
      source: 'manual',
    },
    { onConflict: 'user_id,night,source' },
  );
  if (error) throw error;
}

export async function carregarCheckins(dias: number, ate: string = diaLocal()): Promise<CheckIn[]> {
  const desde = somarDias(ate, -(dias - 1));
  const { data, error } = await supabase
    .from('daily_checkins')
    .select('day, energy, hunger, mood')
    .gte('day', desde)
    .lte('day', ate)
    .order('day');
  if (error) throw error;
  return (data ?? []).map((c) => ({
    dia: c.day as string,
    energia: (c.energy as number | null) ?? null,
    fome: (c.hunger as number | null) ?? null,
    humor: (c.mood as number | null) ?? null,
  }));
}

/** Grava só os campos informados do check-in do dia (os outros ficam como estão). */
export async function salvarCheckin(dia: string, campos: Partial<Pick<CheckIn, 'energia' | 'fome' | 'humor'>>): Promise<void> {
  const { data: usuario } = await supabase.auth.getUser();
  const linha: Record<string, unknown> = { user_id: usuario.user?.id, day: dia, updated_at: new Date().toISOString() };
  if ('energia' in campos) linha.energy = campos.energia;
  if ('fome' in campos) linha.hunger = campos.fome;
  if ('humor' in campos) linha.mood = campos.humor;
  const { error } = await supabase.from('daily_checkins').upsert(linha, { onConflict: 'user_id,day' });
  if (error) throw error;
}
