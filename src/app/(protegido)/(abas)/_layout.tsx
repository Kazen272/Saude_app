import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';

import { cores } from '@/lib/tema';

type NomeIcone = keyof typeof Ionicons.glyphMap;

const icone =
  (nome: NomeIcone) =>
  ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={nome} color={color as string} size={size} />;

export default function LayoutAbas() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: cores.verde,
        tabBarInactiveTintColor: cores.cinza,
        tabBarStyle: { backgroundColor: cores.cartao, borderTopColor: cores.linha },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        sceneStyle: { backgroundColor: cores.fundo },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Hoje', tabBarIcon: icone('home-outline') }} />
      <Tabs.Screen name="progresso" options={{ title: 'Progresso', tabBarIcon: icone('trending-down-outline') }} />
      <Tabs.Screen name="registrar" options={{ title: 'Registrar', tabBarIcon: icone('add-circle') }} />
      <Tabs.Screen name="fotos" options={{ title: 'Fotos', tabBarIcon: icone('camera-outline') }} />
      <Tabs.Screen name="fontes" options={{ title: 'Mais', tabBarIcon: icone('menu-outline') }} />
    </Tabs>
  );
}
