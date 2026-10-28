import { Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Rect, Text as SvgTexto } from 'react-native-svg';

import { decimal, diaCurto, numeroCurto } from '@/lib/datas';
import { carregarPerfil } from '@/lib/dados';
import { idadeEmAnos } from '@/lib/calculos';
import { diaLocal } from '@/lib/datas';
import type { Classificacao, Contexto, Nivel } from '@/lib/referencias';
import { useLarguraDoCartao } from '@/components/ui';
import { cores } from '@/lib/tema';

export const COR_NIVEL: Record<Nivel, { fundo: string; texto: string; nome: string }> = {
  adequado: { fundo: cores.verdeClaro, texto: cores.verdeEscuro, nome: 'Dentro do esperado' },
  atencao: { fundo: cores.laranjaClaro, texto: '#8A4A14', nome: 'Atenção' },
  alterado: { fundo: '#F6DCDC', texto: '#8A1F1F', nome: 'Alterado' },
};

export function SeloNivel({ c }: { c: Classificacao }) {
  const cor = COR_NIVEL[c.nivel];
  const seta = c.direcao === 'alto' ? ' ↑' : c.direcao === 'baixo' ? ' ↓' : '';
  return (
    <View style={{ backgroundColor: cor.fundo, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
      <Text style={{ fontSize: 12, fontWeight: '800', color: cor.texto }}>
        {cor.nome}
        {seta}
      </Text>
    </View>
  );
}

export function AvisoMedico() {
  return (
    <View style={{ backgroundColor: '#E7EAE4', borderRadius: 14, padding: 14 }}>
      <Text style={{ fontSize: 13, color: cores.tintaSuave }}>
        <Text style={{ fontWeight: '700' }}>Só uma indicação. </Text>
        As faixas usam referências gerais por idade e sexo, ou a do seu laboratório quando informada. Quem interpreta os resultados é o seu
        médico.
      </Text>
    </View>
  );
}

/** Idade e sexo do perfil, usados nas faixas de referência. */
export async function carregarContexto(): Promise<Contexto> {
  const p = await carregarPerfil();
  return { idade: p.birth_date ? idadeEmAnos(p.birth_date, diaLocal()) : null, sexo: p.sex };
}

/** Evolução de um marcador: pontos coloridos pelo nível, faixa adequada em verde claro. */
export function GraficoMarcador({
  pontos,
  faixa,
  unidade,
}: {
  pontos: { dia: string; valor: number; nivel: Nivel }[];
  faixa: { min: number | null; max: number | null };
  unidade: string;
}) {
  const largura = useLarguraDoCartao();
  const altura = 180;
  if (pontos.length < 2) {
    return (
      <View style={{ height: 120, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: cores.linha, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Text style={{ fontSize: 13, color: cores.cinza, textAlign: 'center' }}>Com dois ou mais exames, a evolução aparece aqui.</Text>
      </View>
    );
  }
  const w = Math.max(largura, 200);
  const m = { esq: 40, dir: 16, topo: 16, base: 24 };
  const valores = [...pontos.map((p) => p.valor), ...(faixa.min != null ? [faixa.min] : []), ...(faixa.max != null ? [faixa.max] : [])];
  const folga = (Math.max(...valores) - Math.min(...valores)) * 0.15 || 1;
  const minY = Math.max(0, Math.min(...valores) - folga);
  const maxY = Math.max(...valores) + folga;
  const t0 = Date.parse(pontos[0].dia);
  const t1 = Date.parse(pontos[pontos.length - 1].dia);
  const x = (dia: string) => m.esq + ((Date.parse(dia) - t0) / Math.max(1, t1 - t0)) * (w - m.esq - m.dir);
  const y = (v: number) => m.topo + ((maxY - v) / (maxY - minY)) * (altura - m.topo - m.base);
  const corPonto: Record<Nivel, string> = { adequado: cores.verde, atencao: cores.laranja, alterado: '#B42318' };
  const yFaixaTopo = y(faixa.max ?? maxY);
  const yFaixaBase = y(faixa.min ?? minY);
  const descricao = pontos.map((p) => `${diaCurto(p.dia)}: ${numeroCurto(p.valor)} ${unidade}`).join(', ');

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`Evolução. ${descricao}`}>
      {largura > 0 && (
        <Svg width={w} height={altura}>
          {(faixa.min != null || faixa.max != null) && (
            <Rect x={m.esq} y={yFaixaTopo} width={w - m.esq - m.dir} height={Math.max(0, yFaixaBase - yFaixaTopo)} fill={cores.verdeClaro} />
          )}
          {[maxY, (maxY + minY) / 2, minY].map((v) => (
            <SvgTexto key={v} x={0} y={y(v) + 4} fontSize={10.5} fill={cores.cinza}>
              {decimal(v, v >= 10 ? 0 : 1)}
            </SvgTexto>
          ))}
          <Line x1={m.esq} x2={w - m.dir} y1={altura - m.base} y2={altura - m.base} stroke={cores.linha} />
          <Polyline points={pontos.map((p) => `${x(p.dia)},${y(p.valor)}`).join(' ')} fill="none" stroke={cores.tintaSuave} strokeWidth={2} />
          {pontos.map((p) => (
            <Circle key={p.dia} cx={x(p.dia)} cy={y(p.valor)} r={5} fill={corPonto[p.nivel]} stroke="#FFFFFF" strokeWidth={1.5} />
          ))}
          <SvgTexto x={m.esq} y={altura - 6} fontSize={11} fill={cores.cinza}>
            {diaCurto(pontos[0].dia)}
          </SvgTexto>
          <SvgTexto x={w - m.dir} y={altura - 6} fontSize={11} fill={cores.cinza} textAnchor="end">
            {diaCurto(pontos[pontos.length - 1].dia)}
          </SvgTexto>
        </Svg>
      )}
    </View>
  );
}
