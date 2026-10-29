// Cores do app, em modo claro e escuro.
//
// `cores` e tudo criado com `porTema` leem o esquema atual na hora do acesso. Ao
// trocar de esquema, o ProvedorDeAparencia remonta as telas para tudo repintar.

export type Esquema = 'claro' | 'escuro';

const claro = {
  fundo: '#F4F5F1',
  cartao: '#FFFFFF',
  tinta: '#16201B',
  tintaSuave: '#3E4A43',
  cinza: '#5B655F',
  linha: '#E2E5DF',
  linhaSuave: '#EEF0EC',
  /** Preenchimento (botões, barras, linhas de gráfico); texto sobre ele é branco. */
  verde: '#1E6F55',
  /** Verde para texto e links sobre o cartão. */
  verdeTexto: '#1E6F55',
  verdeEscuro: '#15513E',
  verdeClaro: '#E3EFE9',
  verdeVivo: '#5FC79F',
  laranja: '#B8621B',
  laranjaClaro: '#F7E9DC',
  /** Texto sobre laranjaClaro. */
  laranjaTexto: '#8A4A14',
  laranjaVivo: '#F0A35E',
  vermelhoClaro: '#F6DCDC',
  vermelhoTexto: '#8A1F1F',
  azul: '#2F6FA3',
  azulEscuro: '#1F4E75',
  azulClaro: '#E4ECF3',
  /** Cartões escuros de destaque (balanço, relatório): escuros nos dois modos. */
  painel: '#16201B',
  escuroSuave: '#B9C4BD',
  escuroTrilho: '#2C3832',
  /** Fundo de seletores segmentados e avisos neutros. */
  segmento: '#E7EAE4',
  campoFundo: '#FAFBF9',
  campoBorda: '#D5DAD3',
  /** Texto de exemplo (última medida etc.). */
  placeholder: '#8A938D',
};

export type Paleta = typeof claro;

const escuro: Paleta = {
  fundo: '#0E1311',
  cartao: '#18201C',
  tinta: '#E7ECE9',
  tintaSuave: '#C2CBC5',
  cinza: '#97A39C',
  linha: '#2D3733',
  linhaSuave: '#232C28',
  verde: '#2A8062',
  verdeTexto: '#6CCFA8',
  verdeEscuro: '#95DDBF',
  verdeClaro: '#1B3329',
  verdeVivo: '#5FC79F',
  laranja: '#F0A35E',
  laranjaClaro: '#3A2A1C',
  laranjaTexto: '#F4B57A',
  laranjaVivo: '#F0A35E',
  vermelhoClaro: '#3D2121',
  vermelhoTexto: '#F2A7A7',
  azul: '#4A8CC4',
  azulEscuro: '#A3CBEE',
  azulClaro: '#182A38',
  painel: '#1E2A24',
  escuroSuave: '#B9C4BD',
  escuroTrilho: '#33413A',
  segmento: '#232C28',
  campoFundo: '#121916',
  campoBorda: '#36423C',
  placeholder: '#7D8982',
};

const PALETAS: Record<Esquema, Paleta> = { claro, escuro };

let esquemaAtual: Esquema = 'claro';

export function definirEsquema(e: Esquema) {
  esquemaAtual = e;
}

export function esquema(): Esquema {
  return esquemaAtual;
}

/** Objeto que se recalcula para o esquema atual (um cache por esquema). */
export function porTema<T extends object>(criar: (c: Paleta, e: Esquema) => T): T {
  const cache: Partial<Record<Esquema, T>> = {};
  const atual = () => (cache[esquemaAtual] ??= criar(PALETAS[esquemaAtual], esquemaAtual));
  return new Proxy({} as T, {
    get: (_, k) => atual()[k as keyof T],
    has: (_, k) => k in atual(),
    ownKeys: () => Reflect.ownKeys(atual()),
    getOwnPropertyDescriptor: (_, k) => {
      const d = Object.getOwnPropertyDescriptor(atual(), k);
      return d ? { ...d, configurable: true } : undefined;
    },
  });
}

export const cores: Paleta = porTema((c) => c);

export const raio = { cartao: 18, botao: 12, pilula: 999 };
