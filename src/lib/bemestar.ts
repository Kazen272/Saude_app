// Sono e check-in diário. Funções puras.

/** deitouMin: horário de deitar em minutos desde 0h; null quando só se sabe a duração (ex.: relógio). */
export type Noite = { dia: string; deitouMin: number | null; duracaoMin: number; qualidade: number | null };

/** "23:40" → 1420 minutos desde a meia-noite. Inválido → null. */
export function lerHora(texto: string): number | null {
  const m = texto.trim().match(/^(\d{1,2})[:h](\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function formatarHora(minutos: number): string {
  const m = ((Math.round(minutos) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function formatarDuracao(minutos: number): string {
  const m = Math.round(minutos);
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
}

/** Duração entre deitar e acordar; se acordou "antes" do horário de deitar, atravessou a meia-noite. */
export function duracaoSono(deitouMin: number, acordouMin: number): number {
  const d = acordouMin - deitouMin;
  return d > 0 ? d : d + 1440;
}

/**
 * Horário médio de dormir. Conta a partir das 18h para que 23:30 e 00:30
 * fiquem perto um do outro (e não a 23 horas de distância).
 */
export function horarioMedioDeDormir(deitouMin: number[]): number | null {
  if (!deitouMin.length) return null;
  const deslocado = deitouMin.map((m) => (m - 18 * 60 + 1440) % 1440);
  const media = deslocado.reduce((s, m) => s + m, 0) / deslocado.length;
  return (media + 18 * 60) % 1440;
}

/** Variação típica (desvio padrão, em minutos) do horário de dormir. Menor = rotina mais regular. */
export function regularidadeDormir(deitouMin: number[]): number | null {
  if (deitouMin.length < 3) return null;
  const deslocado = deitouMin.map((m) => (m - 18 * 60 + 1440) % 1440);
  const media = deslocado.reduce((s, m) => s + m, 0) / deslocado.length;
  const variancia = deslocado.reduce((s, m) => s + (m - media) ** 2, 0) / deslocado.length;
  return Math.round(Math.sqrt(variancia));
}

export type ResumoSono = { mediaMin: number | null; dormirMedio: number | null; variacaoMin: number | null; noites: number; abaixoDe7h: number };

export function resumirSono(noites: Noite[]): ResumoSono {
  const duracoes = noites.map((n) => n.duracaoMin);
  const horarios = noites.map((n) => n.deitouMin).filter((m): m is number => m != null);
  return {
    mediaMin: duracoes.length ? Math.round(duracoes.reduce((s, d) => s + d, 0) / duracoes.length) : null,
    dormirMedio: horarioMedioDeDormir(horarios),
    variacaoMin: regularidadeDormir(horarios),
    noites: noites.length,
    abaixoDe7h: duracoes.filter((d) => d < 7 * 60).length,
  };
}

export type CheckIn = { dia: string; energia: number | null; fome: number | null; humor: number | null };

/**
 * Sinal de déficit agressivo demais: nos últimos 3 check-ins, energia média
 * ≤ 2 e fome média ≥ 4. Precisa de pelo menos 3 dias respondidos.
 */
export function alertaDeficitAgressivo(checkins: CheckIn[]): boolean {
  const respondidos = [...checkins]
    .filter((c) => c.energia != null && c.fome != null)
    .sort((a, b) => a.dia.localeCompare(b.dia))
    .slice(-3);
  if (respondidos.length < 3) return false;
  const media = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  return media(respondidos.map((c) => c.energia as number)) <= 2 && media(respondidos.map((c) => c.fome as number)) >= 4;
}

export function mediaCampo(checkins: CheckIn[], campo: 'energia' | 'fome' | 'humor'): number | null {
  const valores = checkins.map((c) => c[campo]).filter((v): v is number => v != null);
  return valores.length ? Math.round((valores.reduce((s, v) => s + v, 0) / valores.length) * 10) / 10 : null;
}
