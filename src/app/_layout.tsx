import * as Notifications from 'expo-notifications';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { ProvedorDeSessao } from '@/lib/sessao';

const temNotificacoes = Platform.OS !== 'web';

// Lembretes aparecem mesmo com o app aberto.
if (temNotificacoes) Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Ao tocar num lembrete, abre a tela ligada a ele (ex.: Registrar, Relatório). */
function useAbrirTelaDoLembrete() {
  useEffect(() => {
    if (!temNotificacoes) return;
    const abrir = (resposta: Notifications.NotificationResponse | null) => {
      const url = resposta?.notification.request.content.data?.url;
      if (typeof url === 'string' && url.startsWith('/')) router.push(url as never);
    };
    abrir(Notifications.getLastNotificationResponse());
    const assinatura = Notifications.addNotificationResponseReceivedListener(abrir);
    return () => assinatura.remove();
  }, []);
}

export default function LayoutRaiz() {
  useAbrirTelaDoLembrete();
  return (
    <ProvedorDeSessao>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </ProvedorDeSessao>
  );
}
