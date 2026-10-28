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

/** Número com até `max` casas e sem zeros no fim: 5.40 → "5,4", 104 → "104". */
export function numeroCurto(n: number, max = 2): string {
  return String(Math.round(n * 10 ** max) / 10 ** max).replace('.', ',');
}

/** Máscara de data enquanto digita: "28101992" → "28/10/1992". */
export function mascaraData(texto: string): string {
  const d = texto.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** Máscara de hora enquanto digita: "2330" → "23:30". */
export function mascaraHora(texto: string): string {
  const d = texto.replace(/\D/g, '').slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}:${d.slice(2)}`;
}

/** "Hoje", "Ontem" ou "qua, 21 out". */
export function nomeDoDia(dia: string, hoje: string = diaLocal()): string {
  if (dia === hoje) return 'Hoje';
  if (dia === somarDias(hoje, -1)) return 'Ontem';
  const [a, m, d] = dia.split('-').map(Number);
  const nome = DIAS[new Date(a, m - 1, d).getDay()].slice(0, 3);
  return `${nome}, ${diaCurto(dia)}`;
}

/** Segunda-feira da semana de um dia (YYYY-MM-DD). */
export function inicioDaSemana(dia: string): string {
  const [a, m, d] = dia.split('-').map(Number);
  const semana = new Date(a, m - 1, d).getDay(); // 0 = domingo
  return somarDias(dia, -((semana + 6) % 7));
}

/** Agrupa valores diários por semana (seg–dom), das `n` semanas até a atual. */
export function porSemana<T>(itens: { dia: string; valor: T }[], n: number, hoje: string = diaLocal()): { semana: string; valores: T[] }[] {
  const atual = inicioDaSemana(hoje);
  const semanas = Array.from({ length: n }, (_, i) => somarDias(atual, -7 * (n - 1 - i)));
  return semanas.map((semana) => ({
    semana,
    valores: itens.filter((x) => x.dia >= semana && x.dia <= somarDias(semana, 6)).map((x) => x.valor),
  }));
}
