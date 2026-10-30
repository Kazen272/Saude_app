import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { useColorScheme, View } from 'react-native';

import { cores, definirEsquema, type Esquema } from './tema';

const CHAVE = 'aparencia';

/** O que a pessoa escolheu: seguir o celular, ou fixar claro/escuro. */
export type Preferencia = 'sistema' | Esquema;

type Contexto = { preferencia: Preferencia; esquema: Esquema; definir: (p: Preferencia) => void };
const Ctx = createContext<Contexto>({ preferencia: 'sistema', esquema: 'claro', definir: () => {} });

export const useAparencia = () => useContext(Ctx);

/**
 * Guarda a escolha no celular. Ao mudar o esquema (pela escolha ou pelo modo
 * escuro do Android), remonta o app (key) para todas as telas repintarem.
 */
export function ProvedorDeAparencia({ children }: { children: ReactNode }) {
  const [preferencia, setPreferencia] = useState<Preferencia | null>(null);
  const sistema = useColorScheme();

  useEffect(() => {
    AsyncStorage.getItem(CHAVE)
      .then((v): Preferencia => (v === 'escuro' || v === 'claro' ? v : 'sistema'))
      .catch((): Preferencia => 'sistema')
      .then(setPreferencia);
  }, []);

  const definir = useCallback((p: Preferencia) => {
    setPreferencia(p);
    AsyncStorage.setItem(CHAVE, p).catch(() => {});
  }, []);

  if (!preferencia) return null;
  const esquema: Esquema = preferencia === 'sistema' ? (sistema === 'dark' ? 'escuro' : 'claro') : preferencia;
  definirEsquema(esquema);
  return (
    <Ctx.Provider value={{ preferencia, esquema, definir }}>
      <StatusBar style={esquema === 'escuro' ? 'light' : 'dark'} />
      <View key={esquema} style={{ flex: 1, backgroundColor: cores.fundo }}>
        {children}
      </View>
    </Ctx.Provider>
  );
}
