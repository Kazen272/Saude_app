import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { cores, definirEsquema, type Esquema } from './tema';

const CHAVE = 'aparencia';

type Contexto = { esquema: Esquema; definir: (e: Esquema) => void };
const Ctx = createContext<Contexto>({ esquema: 'claro', definir: () => {} });

export const useAparencia = () => useContext(Ctx);

/**
 * Guarda a escolha claro/escuro no celular. Ao trocar, remonta o app (key) para
 * todas as telas repintarem com a paleta nova.
 */
export function ProvedorDeAparencia({ children }: { children: ReactNode }) {
  const [esquema, setEsquema] = useState<Esquema | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(CHAVE)
      .then((v) => (v === 'escuro' ? 'escuro' : 'claro'))
      .catch(() => 'claro' as const)
      .then((e) => {
        definirEsquema(e);
        setEsquema(e);
      });
  }, []);

  const definir = useCallback((e: Esquema) => {
    definirEsquema(e);
    setEsquema(e);
    AsyncStorage.setItem(CHAVE, e).catch(() => {});
  }, []);

  if (!esquema) return null;
  definirEsquema(esquema);
  return (
    <Ctx.Provider value={{ esquema, definir }}>
      <StatusBar style={esquema === 'escuro' ? 'light' : 'dark'} />
      <View key={esquema} style={{ flex: 1, backgroundColor: cores.fundo }}>
        {children}
      </View>
    </Ctx.Provider>
  );
}
