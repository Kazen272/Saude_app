import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgTexto } from 'react-native-svg';

import { Cartao, Nota, Rotulo, useLarguraDoCartao } from '@/components/ui';
import type { NivelCintura } from '@/lib/calculos';
import { decimal, diaCurto } from '@/lib/datas';
import { tom, type Ponto, type ResumoMedida } from '@/lib/medidas';
import { cores, porTema } from '@/lib/tema';

const cm = (n: number) => decimal(n, Number.isInteger(n) ? 0 : 1);

/** "102,5" ou, com dois lados, "40 · 40" (traço no lado não medido). */
export function textoValores(p: Ponto): string {
  return p.valores.map((v) => (v == null ? '–' : cm(v))).join(' · ');
}

export function textoDelta(d: number | null): string {
  if (d == null) return '';
  if (d === 0) return 'igual';
  return `${d < 0 ? '−' : '+'}${decimal(Math.abs(d), 1)}`;
}

const TONS = porTema(() => ({
  bom: { fundo: cores.verdeClaro, cor: cores.verdeEscuro },
  ruim: { fundo: cores.laranjaClaro, cor: cores.laranjaTexto },
  neutro: { fundo: cores.linhaSuave, cor: cores.tintaSuave },
}));

export function PilulaDelta({ resumo, delta }: { resumo: ResumoMedida; delta: number | null }) {
  if (delta == null) return <View style={{ width: 64 }} />;
  const t = TONS[tom(resumo.medida, delta)];
  return (
    <View style={{ width: 64, paddingVertical: 4, borderRadius: 999, backgroundColor: t.fundo, alignItems: 'center' }}>
      <Text style={{ fontSize: 13, fontWeight: '800', color: t.cor, fontVariant: ['tabular-nums'] }}>{textoDelta(delta)}</Text>
    </View>
  );
}

const NIVEL_CINTURA: Record<NivelCintura, { texto: string; cor: string; fundo: string }> = porTema(() => ({
  adequado: { texto: 'adequada', cor: cores.verdeEscuro, fundo: cores.verdeClaro },
  atencao: { texto: 'atenção', cor: cores.laranjaTexto, fundo: cores.laranjaClaro },
  alto: { texto: 'alta', cor: cores.vermelhoTexto, fundo: cores.vermelhoClaro },
}));

/** Cartão do Progresso: cada medida com a diferença para a anterior ou para a primeira. */
export function CartaoMedidas({
  medidas,
  relacaoCintura,
  temAltura,
}: {
  medidas: ResumoMedida[] | null;
  relacaoCintura: { valor: number; nivel: NivelCintura } | null;
  temAltura: boolean;
}) {
  const [modo, setModo] = useState<'anterior' | 'primeira'>('anterior');
  if (!medidas?.length) {
    return (
      <Cartao estilo={{ gap: 4 }}>
        <Rotulo>Medidas (cm)</Rotulo>
        <Nota>Registre cintura e quadril 1 vez por semana na aba Registrar (e as outras medidas quando fizer avaliação). Elas mostram a perda de gordura melhor que o peso.</Nota>
      </Cartao>
    );
  }
  const ultimoDia = medidas.reduce((d, r) => (r.atual.dia > d ? r.atual.dia : d), '');
  const primeiroDia = medidas.reduce((d, r) => (r.diaPrimeira < d ? r.diaPrimeira : d), ultimoDia);
  const nivel = relacaoCintura ? NIVEL_CINTURA[relacaoCintura.nivel] : null;
  const temCintura = medidas.some((r) => r.medida.codigo === 'cintura');

  return (
    <Cartao estilo={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <Rotulo>Medidas (cm)</Rotulo>
        <Text style={{ fontSize: 12, color: cores.cinza }}>última: {diaCurto(ultimoDia)}</Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 4, backgroundColor: cores.segmento, borderRadius: 12, padding: 4 }}>
        {(
          [
            ['anterior', 'vs. anterior'],
            ['primeira', `vs. 1ª (${diaCurto(primeiroDia)})`],
          ] as const
        ).map(([m, nome]) => (
          <Pressable
            key={m}
            accessibilityRole="tab"
            accessibilityState={{ selected: modo === m }}
            onPress={() => setModo(m)}
            style={{ flex: 1, height: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: modo === m ? cores.cartao : 'transparent' }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: modo === m ? cores.tinta : cores.cinza }}>{nome}</Text>
          </Pressable>
        ))}
      </View>

      <View>
        {medidas.map((r, i) => (
          <Link key={r.medida.codigo} href={{ pathname: '/medida/[codigo]', params: { codigo: r.medida.codigo } }} asChild>
            <Pressable
              accessibilityRole="link"
              accessibilityHint="Abre o gráfico desta medida"
              style={StyleSheet.flatten({
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                minHeight: 52,
                paddingVertical: 6,
                borderBottomWidth: i === medidas.length - 1 ? 0 : 1,
                borderBottomColor: cores.linhaSuave,
              })}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: cores.tinta }} numberOfLines={1}>
                  {r.medida.nome}
                </Text>
                {r.medida.colunas.length === 2 && <Text style={{ fontSize: 12, color: cores.cinza }}>esq. · dir.</Text>}
              </View>
              <Text style={{ fontSize: 16, fontWeight: '800', color: cores.tinta, fontVariant: ['tabular-nums'] }}>{textoValores(r.atual)}</Text>
              <PilulaDelta resumo={r} delta={modo === 'anterior' ? r.vsAnterior : r.vsPrimeira} />
            </Pressable>
          </Link>
        ))}
      </View>

      {temCintura &&
        (relacaoCintura && nivel ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Text style={{ fontSize: 14, color: cores.tintaSuave }}>Cintura ÷ altura: {decimal(relacaoCintura.valor, 2)}</Text>
            <View style={{ backgroundColor: nivel.fundo, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: nivel.cor }}>{nivel.texto}</Text>
            </View>
          </View>
        ) : (
          !temAltura && <Nota>Preencha a altura no perfil para ver a relação cintura ÷ altura.</Nota>
        ))}
      <Nota>
        Verde quando cintura, abdômen ou quadril diminuem. Nas outras medidas, subir ou descer depende do objetivo. Cintura ÷ altura: abaixo de 0,5 é adequado, de 0,5 a 0,6 pede atenção (referência geral, não diagnóstico).
      </Nota>
    </Cartao>
  );
}

/** Evolução de uma medida: uma linha, ou duas (esquerdo cheio, direito tracejado). */
export function GraficoMedida({ resumo }: { resumo: ResumoMedida }) {
  const largura = useLarguraDoCartao();
  const pontos = resumo.pontos;
  const altura = 190;
  if (pontos.length < 2) {
    return (
      <View style={{ height: 120, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: cores.linha, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Text style={{ fontSize: 13, color: cores.cinza, textAlign: 'center' }}>Com duas ou mais medições, a evolução aparece aqui.</Text>
      </View>
    );
  }
  const w = Math.max(largura, 200);
  const m = { esq: 36, dir: 20, topo: 22, base: 26 };
  const todos = pontos.flatMap((p) => p.valores).filter((v): v is number => v != null);
  const folga = (Math.max(...todos) - Math.min(...todos)) * 0.2 || 1;
  const minY = Math.min(...todos) - folga;
  const maxY = Math.max(...todos) + folga;
  const t0 = Date.parse(pontos[0].dia);
  const t1 = Date.parse(pontos[pontos.length - 1].dia);
  const x = (dia: string) => m.esq + ((Date.parse(dia) - t0) / Math.max(1, t1 - t0)) * (w - m.esq - m.dir);
  const y = (v: number) => m.topo + ((maxY - v) / (maxY - minY)) * (altura - m.topo - m.base);
  const lados = resumo.medida.colunas.map((_, i) => ({
    cor: i === 0 ? cores.verde : cores.azul,
    tracejado: i === 1,
    pts: pontos.filter((p) => p.valores[i] != null).map((p) => ({ dia: p.dia, v: p.valores[i] as number })),
  }));
  const descricao = pontos.map((p) => `${diaCurto(p.dia)}: ${textoValores(p)} cm`).join(', ');

  return (
    <View style={{ gap: 8 }} accessible accessibilityRole="image" accessibilityLabel={`Evolução de ${resumo.medida.nome}. ${descricao}`}>
      <Svg width={w} height={altura}>
        {[maxY, (maxY + minY) / 2, minY].map((v, i) => (
          <SvgTexto key={i} x={0} y={y(v) + 4} fontSize={10.5} fill={cores.cinza}>
            {decimal(v, maxY - minY < 6 ? 1 : 0)}
          </SvgTexto>
        ))}
        <Line x1={m.esq} x2={w - m.dir} y1={altura - m.base} y2={altura - m.base} stroke={cores.linha} />
        {lados.map((l, i) => (
          <Polyline
            key={`l${i}`}
            points={l.pts.map((p) => `${x(p.dia)},${y(p.v)}`).join(' ')}
            fill="none"
            stroke={l.cor}
            strokeWidth={2.5}
            strokeDasharray={l.tracejado ? '6 4' : undefined}
          />
        ))}
        {lados.map((l, i) =>
          l.pts.map((p) => <Circle key={`c${i}${p.dia}`} cx={x(p.dia)} cy={y(p.v)} r={4.5} fill={cores.cartao} stroke={l.cor} strokeWidth={2.5} />),
        )}
        <SvgTexto x={m.esq} y={altura - 8} fontSize={11} fill={cores.cinza}>
          {diaCurto(pontos[0].dia)}
        </SvgTexto>
        <SvgTexto x={w - m.dir} y={altura - 8} fontSize={11} fill={cores.cinza} textAnchor="end">
          {diaCurto(pontos[pontos.length - 1].dia)}
        </SvgTexto>
      </Svg>
      {lados.length === 2 && (
        <View style={{ flexDirection: 'row', gap: 16 }}>
          <Legenda cor={cores.verde} texto="esquerdo" />
          <Legenda cor={cores.azul} texto="direito (tracejado)" tracejado />
        </View>
      )}
    </View>
  );
}

function Legenda({ cor, texto, tracejado = false }: { cor: string; texto: string; tracejado?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 18, height: 0, borderTopWidth: 2.5, borderColor: cor, borderStyle: tracejado ? 'dashed' : 'solid' }} />
      <Text style={{ fontSize: 12, color: cores.tintaSuave }}>{texto}</Text>
    </View>
  );
}

