// Datas no fuso do celular, no formato que o banco usa ('YYYY-MM-DD').

const doisDigitos = (n: number) => String(n).padStart(2, '0');

export function diaLocal(d: Date = new Date()): string {
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;
}

/** Início e fim (exclusivo) do dia local, em ISO, para filtrar timestamps. */
export function limitesDoDia(d: Date = new Date()): { inicio: string; fim: string } {
  const inicio = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const fim = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return { inicio: inicio.toISOString(), fim: fim.toISOString() };
}

export function somarDias(dia: string, dias: number): string {
  const [a, m, d] = dia.split('-').map(Number);
  return diaLocal(new Date(a, m - 1, d + dias));
}

const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

export function dataPorExtenso(d: Date = new Date()): string {
  const dia = DIAS[d.getDay()];
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

export function diaCurto(dia: string): string {
  const [, m, d] = dia.split('-').map(Number);
  return `${d} ${MESES[m - 1].slice(0, 3)}`;
}

/** Número com vírgula decimal: 88.4 → "88,4". */
export function decimal(n: number, casas = 1): string {
  return n.toFixed(casas).replace('.', ',');
}

/** Inteiro com ponto de milhar: 17480 → "17.480". */
export function milhar(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
