import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgTexto } from 'react-native-svg';

import { Cartao, Nota, Rotulo, estilos } from '@/components/ui';
import { formatarDuracao, formatarHora, type CheckIn, type Noite, type ResumoSono } from '@/lib/bemestar';
import { diaLocal, somarDias } from '@/lib/datas';
import { cores } from '@/lib/tema';

const ROTULOS: Record<'energia' | 'fome' | 'humor', [string, string]> = {
  energia: ['sem energia', 'muita energia'],
  fome: ['sem fome', 'muita fome'],
  humor: ['péssimo', 'ótimo'],
};

/** Uma linha de 1 a 5 botões. */
export function Escala({
  campo,
  valor,
  aoEscolher,
}: {
  campo: 'energia' | 'fome' | 'humor';
  valor: number | null;
  aoEscolher: (v: number) => void;
}) {
  const titulo = campo.charAt(0).toUpperCase() + campo.slice(1);
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: cores.tinta }}>{titulo}</Text>
        <Text style={{ fontSize: 12, color: cores.cinza }}>
          1 = {ROTULOS[campo][0]} · 5 = {ROTULOS[campo][1]}
        </Text>
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel={titulo} style={{ flexDirection: 'row', gap: 6 }}>
        {[1, 2, 3, 4, 5].map((n) => {
          const ativo = valor === n;
          return (
            <Pressable
              key={n}
              accessibilityRole="radio"
              accessibilityState={{ checked: ativo }}
              accessibilityLabel={`${titulo} ${n}`}
              onPress={() => aoEscolher(n)}
              style={{
                flex: 1,
                height: 44,
                borderRadius: 10,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: ativo ? cores.verde : cores.linhaSuave,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '800', color: ativo ? '#FFFFFF' : cores.tintaSuave }}>{n}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function CartaoCheckin({
  checkin,
  alerta,
  aoMudar,
}: {
  checkin: CheckIn | null;
  alerta: boolean;
  aoMudar: (campo: 'energia' | 'fome' | 'humor', v: number) => void;
}) {
  const respondido = checkin && checkin.energia != null && checkin.fome != null && checkin.humor != null;
  return (
    <Cartao estilo={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Rotulo>Check-in de hoje</Rotulo>
        <Text style={{ fontSize: 12, color: respondido ? cores.verde : cores.cinza, fontWeight: '700' }}>
          {respondido ? 'respondido' : 'leva 5 segundos'}
        </Text>
      </View>
      <Escala campo="energia" valor={checkin?.energia ?? null} aoEscolher={(v) => aoMudar('energia', v)} />
      <Escala campo="fome" valor={checkin?.fome ?? null} aoEscolher={(v) => aoMudar('fome', v)} />
      <Escala campo="humor" valor={checkin?.humor ?? null} aoEscolher={(v) => aoMudar('humor', v)} />
      {alerta && (
        <View style={{ backgroundColor: cores.laranjaClaro, borderRadius: 12, padding: 12 }}>
          <Text style={{ fontSize: 13, color: '#5C3410' }}>
            <Text style={{ fontWeight: '700' }}>Energia baixa e fome alta há 3 dias. </Text>O déficit pode estar agressivo demais; vale conversar
            com seu nutricionista ou médico sobre o ritmo.
          </Text>
        </View>
      )}
    </Cartao>
  );
}

export function CartaoSono({ ultima, resumo }: { ultima: Noite | null; resumo: ResumoSono }) {
  return (
    <Link href="/sono" asChild>
      <Pressable accessibilityRole="link" style={[estilos.cartao]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Rotulo>Sono</Rotulo>
          <Text style={{ fontSize: 12, fontWeight: '700', color: cores.verde }}>{ultima ? 'ver semana' : 'registrar'}</Text>
        </View>
        {ultima ? (
          <View style={{ flexDirection: 'row' }}>
            <Indicador valor={formatarDuracao(ultima.duracaoMin)} legenda="última noite" />
            <Indicador valor={resumo.mediaMin != null ? formatarDuracao(resumo.mediaMin) : '—'} legenda="média 7 noites" />
            <Indicador valor={resumo.dormirMedio != null ? formatarHora(resumo.dormirMedio) : '—'} legenda="dorme em média" />
          </View>
        ) : (
          <Nota>Registre a hora que deitou e acordou para acompanhar o sono.</Nota>
        )}
      </Pressable>
    </Link>
  );
}

function Indicador({ valor, legenda }: { valor: string; legenda: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={{ fontSize: 20, fontWeight: '800', color: cores.tinta, fontVariant: ['tabular-nums'] }}>{valor}</Text>
      <Text style={{ fontSize: 12, color: cores.cinza }}>{legenda}</Text>
    </View>
  );
}

const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const nomeDia = (dia: string) => DIAS_CURTOS[new Date(dia + 'T12:00:00').getDay()];

/** Barras das horas dormidas nas últimas 7 noites, com a linha de 7 h. */
export function GraficoSono({ noites, ate = diaLocal() }: { noites: Noite[]; ate?: string }) {
  const [largura, setLargura] = useState(0);
  const altura = 140;
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(ate, i - 6));
  if (!noites.length) {
    return (
      <View style={{ height: altura, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: cores.linha, alignItems: 'center', justifyContent: 'center', padding: 16 }}>
        <Text style={{ fontSize: 13, color: cores.cinza, textAlign: 'center' }}>As noites registradas aparecem aqui.</Text>
      </View>
    );
  }
  const w = Math.max(largura, 200);
  const topo = 16;
  const base = 22;
  const maxMin = Math.max(9 * 60, ...noites.map((n) => n.duracaoMin));
  const y = (min: number) => topo + (1 - min / maxMin) * (altura - topo - base);
  const coluna = w / 7;
  const barra = Math.min(28, coluna * 0.55);
  const descricao = dias
    .map((d) => {
      const n = noites.find((x) => x.dia === d);
      return `${nomeDia(d)}: ${n ? formatarDuracao(n.duracaoMin) : 'sem registro'}`;
    })
    .join(', ');
  return (
    <View onLayout={(e: LayoutChangeEvent) => setLargura(Math.round(e.nativeEvent.layout.width))} accessible accessibilityRole="image" accessibilityLabel={`Sono por noite. ${descricao}`}>
      {largura > 0 && (
        <Svg width={w} height={altura}>
          <Line x1={0} x2={w} y1={y(420)} y2={y(420)} stroke={cores.laranja} strokeDasharray="2 4" strokeWidth={1.25} />
          <SvgTexto x={w} y={y(420) - 4} fontSize={10.5} fill={cores.laranja} textAnchor="end" fontWeight="700">
            7 h
          </SvgTexto>
          {dias.map((d, i) => {
            const n = noites.find((x) => x.dia === d);
            const cx = coluna * i + coluna / 2;
            return (
              <G key={d}>
                {n ? (
                  <>
                    <Rect x={cx - barra / 2} y={y(n.duracaoMin)} width={barra} height={y(0) - y(n.duracaoMin)} rx={4} fill={n.duracaoMin < 420 ? cores.azul : cores.verde} />
                    <SvgTexto x={cx} y={y(n.duracaoMin) - 4} fontSize={10.5} fill={cores.tintaSuave} textAnchor="middle">
                      {formatarDuracao(n.duracaoMin)}
                    </SvgTexto>
                  </>
                ) : (
                  <Rect x={cx - barra / 2} y={y(0) - 3} width={barra} height={3} rx={1.5} fill={cores.linha} />
                )}
                <SvgTexto x={cx} y={altura - 4} fontSize={11} fill={cores.cinza} textAnchor="middle">
                  {nomeDia(d)}
                </SvgTexto>
              </G>
            );
          })}
        </Svg>
      )}
    </View>
  );
}

/** Grade de 7 dias × energia, fome, humor: cada célula mostra a nota. */
export function GradeCheckins({ checkins, ate = diaLocal() }: { checkins: CheckIn[]; ate?: string }) {
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(ate, i - 6));
  const linhas: { campo: 'energia' | 'fome' | 'humor'; nome: string; bomAlto: boolean }[] = [
    { campo: 'energia', nome: 'Energia', bomAlto: true },
    { campo: 'fome', nome: 'Fome', bomAlto: false },
    { campo: 'humor', nome: 'Humor', bomAlto: true },
  ];
  if (!checkins.length) return <Nota>Responda o check-in na tela Hoje para ver a semana aqui.</Nota>;
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 64 }} />
        {dias.map((d) => (
          <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: cores.cinza }}>
            {nomeDia(d)}
          </Text>
        ))}
      </View>
      {linhas.map((l) => (
        <View key={l.campo} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ width: 64, fontSize: 12, fontWeight: '700', color: cores.tintaSuave }}>{l.nome}</Text>
          {dias.map((d) => {
            const v = checkins.find((c) => c.dia === d)?.[l.campo] ?? null;
            const bom = v == null ? null : l.bomAlto ? v >= 4 : v <= 2;
            const ruim = v == null ? null : l.bomAlto ? v <= 2 : v >= 4;
            return (
              <View key={d} style={{ flex: 1, alignItems: 'center' }}>
                <View
                  accessibilityLabel={`${l.nome} em ${nomeDia(d)}: ${v ?? 'sem resposta'}`}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: v == null ? cores.linhaSuave : bom ? cores.verdeClaro : ruim ? cores.laranjaClaro : '#EEF0EC',
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '800', color: v == null ? cores.cinza : bom ? cores.verdeEscuro : ruim ? '#8A4A14' : cores.tintaSuave }}>
                    {v ?? '·'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
