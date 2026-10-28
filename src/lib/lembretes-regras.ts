// Regras de recorrência dos lembretes. Funções puras.

export type TipoLembrete = 'horarios' | 'intervalo';

export type Lembrete = {
  id?: number;
  titulo: string;
  mensagem: string;
  tipo: TipoLembrete;
  /** 1 = domingo ... 7 = sábado */
  dias: number[];
  /** 'HH:MM', usados no tipo 'horarios' */
  horarios: string[];
  /** usados no tipo 'intervalo' */
  intervaloMin: number | null;
  inicio: string | null;
  fim: string | null;
  link: string | null;
  ativo: boolean;
};

export type Disparo = { weekday: number; hour: number; minute: number };

export const NOMES_DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Limite de agendamentos por app no Android (AlarmManager) com folga. */
export const MAX_DISPAROS = 400;

function paraMinutos(hhmm: string): number | null {
  const m = hhmm.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

/** Horários do dia em que o lembrete toca (em minutos), em ordem e sem repetição. */
export function horariosDoDia(l: Lembrete): number[] {
  if (l.tipo === 'horarios') {
    return [...new Set(l.horarios.map(paraMinutos).filter((m): m is number => m != null))].sort((a, b) => a - b);
  }
  const inicio = l.inicio ? paraMinutos(l.inicio) : null;
  const fim = l.fim ? paraMinutos(l.fim) : null;
  if (inicio == null || fim == null || !l.intervaloMin || l.intervaloMin < 15 || fim < inicio) return [];
  const lista: number[] = [];
  for (let m = inicio; m <= fim; m += l.intervaloMin) lista.push(m);
  return lista;
}

/** Todos os disparos semanais (dia da semana + hora) de um lembrete ativo. */
export function disparos(l: Lembrete): Disparo[] {
  if (!l.ativo) return [];
  const dias = [...new Set(l.dias.filter((d) => d >= 1 && d <= 7))].sort();
  const horas = horariosDoDia(l);
  return dias.flatMap((weekday) => horas.map((m) => ({ weekday, hour: Math.floor(m / 60), minute: m % 60 })));
}

/** Problema que impede salvar, ou null se está tudo certo. */
export function validar(l: Lembrete): string | null {
  if (!l.titulo.trim()) return 'Dê um nome ao lembrete.';
  if (!l.dias.length) return 'Escolha pelo menos um dia da semana.';
  if (l.tipo === 'horarios' && !horariosDoDia(l).length) return 'Adicione pelo menos um horário no formato 08:30.';
  if (l.tipo === 'intervalo') {
    if (!l.intervaloMin || l.intervaloMin < 15) return 'O intervalo mínimo é de 15 minutos.';
    if (!horariosDoDia(l).length) return 'Confira o início e o fim (formato 08:00), com o fim depois do início.';
  }
  return null;
}

/** Descrição curta da recorrência, ex.: "Seg a Sex · 07:30" ou "Todo dia · a cada 2 h, 09:00–21:00". */
export function descrever(l: Lembrete): string {
  const dias = [...new Set(l.dias)].sort();
  let quando: string;
  if (dias.length === 7) quando = 'Todo dia';
  else if (dias.join() === '2,3,4,5,6') quando = 'Seg a Sex';
  else if (dias.join() === '1,7') quando = 'Fim de semana';
  else quando = dias.map((d) => NOMES_DIAS[d - 1]).join(', ');
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  if (l.tipo === 'intervalo') {
    const h = (l.intervaloMin ?? 0) / 60;
    const passo = h >= 1 && Number.isInteger(h) ? `${h} h` : `${l.intervaloMin} min`;
    return `${quando} · a cada ${passo}, ${l.inicio}–${l.fim}`;
  }
  return `${quando} · ${horariosDoDia(l).map(fmt).join(', ')}`;
}

const TODOS = [1, 2, 3, 4, 5, 6, 7];

/** Sugestões iniciais. */
export const SUGESTOES: Lembrete[] = [
  { titulo: 'Beber água', mensagem: 'Um copo agora. Toque para registrar.', tipo: 'intervalo', dias: TODOS, horarios: [], intervaloMin: 120, inicio: '09:00', fim: '21:00', link: '/', ativo: true },
  { titulo: 'Pesagem', mensagem: 'Em jejum, depois do banheiro.', tipo: 'horarios', dias: TODOS, horarios: ['07:30'], intervaloMin: null, inicio: null, fim: null, link: '/registrar', ativo: true },
  { titulo: 'Check-in do dia', mensagem: 'Como foram energia, fome e humor hoje?', tipo: 'horarios', dias: TODOS, horarios: ['21:00'], intervaloMin: null, inicio: null, fim: null, link: '/', ativo: true },
  { titulo: 'Foto da semana', mensagem: 'Mesma luz, mesmo lugar.', tipo: 'horarios', dias: [1], horarios: ['09:00'], intervaloMin: null, inicio: null, fim: null, link: '/fotos', ativo: true },
  { titulo: 'Relatório da semana', mensagem: 'Seu resumo da semana está pronto.', tipo: 'horarios', dias: [1], horarios: ['19:00'], intervaloMin: null, inicio: null, fim: null, link: '/relatorio', ativo: true },
];
