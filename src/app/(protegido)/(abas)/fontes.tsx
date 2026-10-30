import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, router, type Href } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CartaoHealthConnect } from '@/components/healthconnect';
import { FormularioPerfil } from '@/components/perfil';
import { Botao, Cabecalho, Cartao, estilos } from '@/components/ui';
import { useAparencia, type Preferencia } from '@/lib/aparencia';
import { supabase } from '@/lib/supabase';
import { cores } from '@/lib/tema';

export default function Fontes() {
  return (
    <SafeAreaView style={estilos.tela} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
          <Cabecalho sobre="Relatórios, exames, lembretes e perfil" titulo="Mais" />

          <Cartao estilo={{ gap: 0, paddingVertical: 4 }}>
            <ItemMenu href="/relatorio" icone="stats-chart-outline" titulo="Relatório da semana" detalhe="o que melhorou e o que piorou" />
            <ItemMenu href="/exames" icone="water-outline" titulo="Exames de sangue" detalhe="resultados, referências e histórico" />
            <ItemMenu href="/sono" icone="moon-outline" titulo="Sono" detalhe="registrar noites e ver a semana" />
            <ItemMenu href="/lembretes" icone="notifications-outline" titulo="Lembretes" detalhe="água, pesagem, check-in e os seus" ultimo />
          </Cartao>

          <CartaoAparencia />

          <Text style={[estilos.rotulo, { marginTop: 6 }]}>Fontes de dados</Text>

          <CartaoHealthConnect />

          <Text style={[estilos.rotulo, { marginTop: 6 }]}>Perfil</Text>
          <FormularioPerfil />

          <Botao titulo="Sair da conta" variante="suave" aoTocar={() => supabase.auth.signOut()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ItemMenu({
  href,
  icone,
  titulo,
  detalhe,
  ultimo = false,
}: {
  href: Href;
  icone: keyof typeof Ionicons.glyphMap;
  titulo: string;
  detalhe: string;
  ultimo?: boolean;
}) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: ultimo ? 0 : 1, borderBottomColor: cores.linhaSuave }}
      >
        <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: cores.verdeClaro, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icone} size={20} color={cores.verdeEscuro} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: cores.tinta }}>{titulo}</Text>
          <Text style={{ fontSize: 12, color: cores.cinza }}>{detalhe}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={cores.cinza} />
      </Pressable>
    </Link>
  );
}

function CartaoAparencia() {
  const { preferencia, esquema, definir } = useAparencia();
  const escolher = (p: Preferencia) => {
    if (p === preferencia) return;
    const novo = p === 'sistema' ? null : p;
    definir(p);
    // Se o esquema mudar, o app remonta: volta para esta aba.
    if (novo !== esquema) setTimeout(() => router.navigate('/fontes'), 50);
  };
  return (
    <Cartao estilo={{ gap: 10 }}>
      <Text style={estilos.rotulo}>Aparência</Text>
      <View style={{ flexDirection: 'row', gap: 4, backgroundColor: cores.segmento, borderRadius: 12, padding: 4 }}>
        {(
          [
            ['sistema', 'Celular', 'phone-portrait-outline'],
            ['claro', 'Claro', 'sunny-outline'],
            ['escuro', 'Escuro', 'moon-outline'],
          ] as const
        ).map(([e, nome, icone]) => {
          const ativo = preferencia === e;
          return (
            <Pressable
              key={e}
              accessibilityRole="radio"
              accessibilityState={{ selected: ativo }}
              onPress={() => escolher(e)}
              style={{ flex: 1, height: 44, borderRadius: 9, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: ativo ? cores.cartao : 'transparent' }}
            >
              <Ionicons name={icone} size={18} color={ativo ? cores.tinta : cores.cinza} />
              <Text style={{ fontSize: 14, fontWeight: '700', color: ativo ? cores.tinta : cores.cinza }}>{nome}</Text>
            </Pressable>
          );
        })}
      </View>
      {preferencia === 'sistema' && <Text style={{ fontSize: 12, color: cores.cinza }}>Segue o modo escuro do Android (agora: {esquema}).</Text>}
    </Cartao>
  );
}
