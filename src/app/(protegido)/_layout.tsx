import { Redirect, Stack } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { sincronizarSeLiberado } from '@/lib/healthconnect';
import { sincronizarAgendamentos } from '@/lib/lembretes';
import { useSessao } from '@/lib/sessao';
import { cores } from '@/lib/tema';

// Tudo dentro deste grupo exige login.
export default function LayoutProtegido() {
  const { sessao, carregando } = useSessao();

  // Ao entrar, alinha os lembretes agendados no celular com os salvos na conta.
  useEffect(() => {
    if (!sessao) return;
    sincronizarAgendamentos().catch(() => {});
    sincronizarSeLiberado().catch(() => {});
  }, [sessao?.user.id]);

  if (carregando) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: cores.fundo }}>
        <ActivityIndicator color={cores.verde} />
      </View>
    );
  }
  if (!sessao) return <Redirect href="/login" />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: cores.fundo },
        headerTintColor: cores.tinta,
        headerTitleStyle: { fontWeight: '800' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: cores.fundo },
        headerBackButtonDisplayMode: 'minimal',
      }}
    >
      <Stack.Screen name="(abas)" options={{ headerShown: false }} />
      <Stack.Screen name="relatorio" options={{ title: 'Relatório da semana' }} />
      <Stack.Screen name="lembretes/index" options={{ title: 'Lembretes' }} />
      <Stack.Screen name="lembretes/editar" options={{ title: 'Lembrete' }} />
      <Stack.Screen name="exames/index" options={{ title: 'Exames de sangue' }} />
      <Stack.Screen name="exames/novo" options={{ title: 'Novo exame' }} />
      <Stack.Screen name="exames/[id]" options={{ title: 'Exame' }} />
      <Stack.Screen name="exames/marcador/[codigo]" options={{ title: 'Histórico' }} />
      <Stack.Screen name="sono" options={{ title: 'Sono' }} />
      <Stack.Screen name="medida/[codigo]" options={{ title: 'Medida' }} />
      <Stack.Screen name="historico" options={{ title: 'Revisar dia' }} />
      <Stack.Screen name="boas-vindas" options={{ headerShown: false, gestureEnabled: false }} />
    </Stack>
  );
}
