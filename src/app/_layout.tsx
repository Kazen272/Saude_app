import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { ProvedorDeSessao } from '@/lib/sessao';

export default function LayoutRaiz() {
  return (
    <ProvedorDeSessao>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </ProvedorDeSessao>
  );
}
