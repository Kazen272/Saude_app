import { Children, useState, type ReactNode } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions, type TextInputProps, type ViewStyle } from 'react-native';

import { diaLocal, mascaraData, mascaraHora, nomeDoDia, somarDias } from '@/lib/datas';
import { cores, porTema, raio } from '@/lib/tema';

/**
 * Largura útil dentro de um cartão: tela − margens da página (2 × 20) − margens
 * do cartão (2 × 16). Usada pelos gráficos, que precisam de uma largura em pixels.
 */
export function useLarguraDoCartao(): number {
  const { width } = useWindowDimensions();
  return Math.max(220, Math.round(width - 72));
}

export function Cartao({ children, estilo }: { children: ReactNode; estilo?: ViewStyle }) {
  return <View style={[estilos.cartao, estilo]}>{children}</View>;
}

export function Cabecalho({ sobre, titulo }: { sobre: string; titulo: string }) {
  return (
    <View style={{ gap: 2 }}>
      <Text style={estilos.sobre}>{sobre}</Text>
      <Text style={estilos.titulo} accessibilityRole="header">
        {titulo}
      </Text>
    </View>
  );
}

export function Rotulo({ children }: { children: ReactNode }) {
  return <Text style={estilos.rotulo}>{children}</Text>;
}

export function Nota({ children }: { children: ReactNode }) {
  return <Text style={estilos.nota}>{children}</Text>;
}

/** Explicação de um cartão: o que mostra e como é calculado. Parágrafos separados. */
export type TextoInfo = { titulo: string; paragrafos: string[] };

/** Botão ⓘ que abre a explicação num painel por cima da tela. */
export function BotaoInfo({ info }: { info: TextoInfo }) {
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Como funciona: ${info.titulo}`}
        onPress={() => setAberto(true)}
        hitSlop={10}
        style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.linhaSuave }}
      >
        <Text style={{ fontSize: 14, fontWeight: '800', color: cores.tintaSuave }}>?</Text>
      </Pressable>
      <Modal visible={aberto} transparent animationType="fade" onRequestClose={() => setAberto(false)}>
        <Pressable accessibilityLabel="Fechar" onPress={() => setAberto(false)} style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <Pressable
            onPress={() => {}}
            style={{ backgroundColor: cores.cartao, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 32, gap: 12, maxHeight: '80%' }}
          >
            <Text accessibilityRole="header" style={{ fontSize: 18, fontWeight: '800', color: cores.tinta }}>
              {info.titulo}
            </Text>
            <ScrollView contentContainerStyle={{ gap: 10 }}>
              {info.paragrafos.map((p, i) => (
                <Text key={i} style={{ fontSize: 14, lineHeight: 20, color: cores.tintaSuave }}>
                  {p}
                </Text>
              ))}
            </ScrollView>
            <Botao titulo="Entendi" variante="suave" aoTocar={() => setAberto(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/** Cabeçalho de cartão: rótulo, botão ⓘ e algo à direita (ex.: período). */
export function CabecalhoCartao({ titulo, info, direita }: { titulo: string; info?: TextoInfo; direita?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Text style={[estilos.rotulo, { flexShrink: 1 }]}>{titulo}</Text>
      {info && <BotaoInfo info={info} />}
      <View style={{ flex: 1 }} />
      {direita}
    </View>
  );
}

type Variante = 'principal' | 'suave' | 'agua';

export function Botao({
  titulo,
  aoTocar,
  variante = 'principal',
  ocupado = false,
  desativado = false,
  rotuloAcessivel,
}: {
  titulo: string;
  aoTocar: () => void;
  variante?: Variante;
  ocupado?: boolean;
  desativado?: boolean;
  rotuloAcessivel?: string;
}) {
  const cor = {
    principal: { fundo: cores.verde, texto: '#FFFFFF' },
    suave: { fundo: cores.verdeClaro, texto: cores.verdeEscuro },
    agua: { fundo: cores.azulClaro, texto: cores.azulEscuro },
  }[variante];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotuloAcessivel ?? titulo}
      accessibilityState={{ disabled: desativado || ocupado, busy: ocupado }}
      disabled={desativado || ocupado}
      onPress={aoTocar}
      style={({ pressed }) => [
        estilos.botao,
        { backgroundColor: cor.fundo, opacity: desativado ? 0.5 : pressed ? 0.85 : 1 },
        variante === 'principal' && { height: 54, borderRadius: 16 },
      ]}
    >
      {ocupado ? (
        <ActivityIndicator color={cor.texto} />
      ) : (
        <Text style={[estilos.botaoTexto, { color: cor.texto }, variante === 'principal' && { fontSize: 16, fontWeight: '800' }]}>
          {titulo}
        </Text>
      )}
    </Pressable>
  );
}

/**
 * Campo de texto com rótulo. Ocupa a largura disponível; para pôr campos lado a
 * lado, use <LinhaCampos>, que divide a largura sem achatar a altura.
 */
export function Campo({ rotulo, ...props }: TextInputProps & { rotulo: string }) {
  return (
    <View style={{ gap: 4, alignSelf: 'stretch' }}>
      <Text style={estilos.campoRotulo} numberOfLines={2}>
        {rotulo}
      </Text>
      <TextInput
        accessibilityLabel={rotulo}
        placeholderTextColor={cores.cinza}
        style={estilos.campo}
        {...props}
      />
    </View>
  );
}

/** Coloca campos lado a lado, com larguras iguais. */
export function LinhaCampos({ children }: { children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
      {Children.toArray(children).map((filho, i) => (
        <View key={i} style={{ flex: 1, minWidth: 0 }}>
          {filho}
        </View>
      ))}
    </View>
  );
}

export function Pilula({ texto, tom = 'verde' }: { texto: string; tom?: 'verde' | 'laranja' | 'cinza' }) {
  const cor = {
    verde: { fundo: cores.verdeClaro, texto: cores.verdeEscuro },
    laranja: { fundo: cores.laranjaClaro, texto: cores.laranjaTexto },
    cinza: { fundo: cores.linhaSuave, texto: cores.cinza },
  }[tom];
  return (
    <View style={{ backgroundColor: cor.fundo, paddingVertical: 6, paddingHorizontal: 10, borderRadius: raio.pilula }}>
      <Text style={{ color: cor.texto, fontSize: 12, fontWeight: '700' }}>{texto}</Text>
    </View>
  );
}

export const estilos = porTema((c) =>
  StyleSheet.create({
  tela: { flex: 1, backgroundColor: c.fundo },
  conteudo: { padding: 20, paddingTop: 24, gap: 14 },
  cartao: { backgroundColor: c.cartao, borderRadius: raio.cartao, padding: 16, gap: 10 },
  sobre: { fontSize: 13, fontWeight: '600', color: c.cinza },
  titulo: { fontSize: 26, fontWeight: '800', color: c.tinta, letterSpacing: -0.5 },
  rotulo: { fontSize: 13, fontWeight: '700', color: c.tinta },
  nota: { fontSize: 13, color: c.cinza },
  numero: { fontSize: 24, fontWeight: '800', color: c.tinta, fontVariant: ['tabular-nums'] },
  unidade: { fontSize: 14, fontWeight: '600', color: c.cinza },
  botao: { height: 48, borderRadius: raio.botao, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  botaoTexto: { fontSize: 14, fontWeight: '700' },
  campoRotulo: { fontSize: 12, fontWeight: '600', color: c.tintaSuave },
  campo: {
    height: 48,
    borderWidth: 1,
    borderColor: c.campoBorda,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    color: c.tinta,
    backgroundColor: c.campoFundo,
  },
}),
);

/** Escolhe um dia: ‹ Hoje ›. Não deixa ir para o futuro nem mais de `maxDias` para trás. */
export function SeletorDia({ dia, aoMudar, maxDias = 60 }: { dia: string; aoMudar: (d: string) => void; maxDias?: number }) {
  const hoje = diaLocal();
  const podeVoltar = dia > somarDias(hoje, -maxDias);
  const podeAvancar = dia < hoje;
  const Seta = ({ texto, rotulo, ativo, aoTocar }: { texto: string; rotulo: string; ativo: boolean; aoTocar: () => void }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      accessibilityState={{ disabled: !ativo }}
      disabled={!ativo}
      onPress={aoTocar}
      style={{ width: 48, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: ativo ? cores.linhaSuave : 'transparent' }}
    >
      <Text style={{ fontSize: 22, fontWeight: '700', color: ativo ? cores.tinta : cores.linha }}>{texto}</Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Seta texto="‹" rotulo="Dia anterior" ativo={podeVoltar} aoTocar={() => aoMudar(somarDias(dia, -1))} />
      <Text accessibilityLiveRegion="polite" style={{ flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', color: cores.tinta }}>
        {nomeDoDia(dia, hoje)}
      </Text>
      <Seta texto="›" rotulo="Dia seguinte" ativo={podeAvancar} aoTocar={() => aoMudar(somarDias(dia, 1))} />
    </View>
  );
}

/** Hora com máscara (digite 2330 → 23:30) e botões de −15 / +15 minutos. */
export function SeletorHora({ rotulo, valor, aoMudar }: { rotulo: string; valor: string; aoMudar: (v: string) => void }) {
  const mover = (delta: number) => {
    const m = valor.match(/^(\d{2}):(\d{2})$/);
    const atual = m ? Number(m[1]) * 60 + Number(m[2]) : 0;
    const novo = (((atual + delta) % 1440) + 1440) % 1440;
    aoMudar(`${String(Math.floor(novo / 60)).padStart(2, '0')}:${String(novo % 60).padStart(2, '0')}`);
  };
  const botao = (texto: string, delta: number) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${rotulo}: ${delta > 0 ? 'mais' : 'menos'} 15 minutos`}
      onPress={() => mover(delta)}
      style={{ width: 44, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.linhaSuave }}
    >
      <Text style={{ fontSize: 13, fontWeight: '800', color: cores.tintaSuave }}>{texto}</Text>
    </Pressable>
  );
  return (
    <View style={{ gap: 4 }}>
      <Text style={estilos.campoRotulo}>{rotulo}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {botao('−15', -15)}
        <TextInput
          accessibilityLabel={rotulo}
          value={valor}
          onChangeText={(t) => aoMudar(mascaraHora(t))}
          keyboardType="number-pad"
          maxLength={5}
          placeholder="23:00"
          placeholderTextColor={cores.cinza}
          style={[estilos.campo, { flex: 1, minWidth: 0, textAlign: 'center', fontWeight: '700', paddingHorizontal: 4 }]}
        />
        {botao('+15', 15)}
      </View>
    </View>
  );
}

/** Campo de data com máscara: digite só os números (28101992 → 28/10/1992). */
export function CampoData({ rotulo, valor, aoMudar }: { rotulo: string; valor: string; aoMudar: (v: string) => void }) {
  return <Campo rotulo={rotulo} value={valor} onChangeText={(t) => aoMudar(mascaraData(t))} placeholder="dd/mm/aaaa" keyboardType="number-pad" maxLength={10} />;
}
