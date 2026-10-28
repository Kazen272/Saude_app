import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';

import { cores, raio } from '@/lib/tema';

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

export function Campo({ rotulo, ...props }: TextInputProps & { rotulo: string }) {
  return (
    <View style={{ gap: 4, flex: 1 }}>
      <Text style={estilos.campoRotulo}>{rotulo}</Text>
      <TextInput
        accessibilityLabel={rotulo}
        placeholderTextColor={cores.cinza}
        style={estilos.campo}
        {...props}
      />
    </View>
  );
}

export function Pilula({ texto, tom = 'verde' }: { texto: string; tom?: 'verde' | 'laranja' | 'cinza' }) {
  const cor = {
    verde: { fundo: cores.verdeClaro, texto: cores.verdeEscuro },
    laranja: { fundo: cores.laranjaClaro, texto: '#8A4A14' },
    cinza: { fundo: cores.linhaSuave, texto: cores.cinza },
  }[tom];
  return (
    <View style={{ backgroundColor: cor.fundo, paddingVertical: 6, paddingHorizontal: 10, borderRadius: raio.pilula }}>
      <Text style={{ color: cor.texto, fontSize: 12, fontWeight: '700' }}>{texto}</Text>
    </View>
  );
}

export const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { padding: 20, paddingTop: 24, gap: 14 },
  cartao: { backgroundColor: cores.cartao, borderRadius: raio.cartao, padding: 16, gap: 10 },
  sobre: { fontSize: 13, fontWeight: '600', color: cores.cinza },
  titulo: { fontSize: 26, fontWeight: '800', color: cores.tinta, letterSpacing: -0.5 },
  rotulo: { fontSize: 13, fontWeight: '700', color: cores.tinta },
  nota: { fontSize: 13, color: cores.cinza },
  numero: { fontSize: 24, fontWeight: '800', color: cores.tinta, fontVariant: ['tabular-nums'] },
  unidade: { fontSize: 14, fontWeight: '600', color: cores.cinza },
  botao: { height: 48, borderRadius: raio.botao, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  botaoTexto: { fontSize: 14, fontWeight: '700' },
  campoRotulo: { fontSize: 12, fontWeight: '600', color: cores.tintaSuave },
  campo: {
    height: 48,
    borderWidth: 1,
    borderColor: '#D5DAD3',
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    color: cores.tinta,
    backgroundColor: '#FAFBF9',
  },
});
