import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CartaoHealthConnect } from '@/components/healthconnect';
import { FormularioPerfil } from '@/components/perfil';
import { Botao, Cartao, Nota, estilos } from '@/components/ui';
import { registrarCorpo } from '@/lib/dados';
import { diaLocal } from '@/lib/datas';
import { cores } from '@/lib/tema';

const PASSOS = ['Seu perfil', 'Seus apps', 'Peso de hoje'];

/** Primeiro acesso: perfil → Health Connect → primeira pesagem. Dá para pular. */
export default function BoasVindas() {
  const [passo, setPasso] = useState(0);
  const [peso, setPeso] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function concluir() {
    await AsyncStorage.setItem('boas-vindas:visto', '1').catch(() => {});
    router.replace('/');
  }

  async function salvarPeso() {
    setErro(null);
    const kg = Number(peso.replace(',', '.'));
    if (!peso.trim()) return concluir();
    if (!Number.isFinite(kg) || kg < 20 || kg > 400) return setErro('Peso em kg, como 88,6.');
    setSalvando(true);
    try {
      await registrarCorpo({ dia: diaLocal(), pesoKg: Math.round(kg * 10) / 10 });
      await concluir();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.');
      setSalvando(false);
    }
  }

  return (
    <SafeAreaView style={estilos.tela}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: cores.cinza }}>
              Passo {passo + 1} de {PASSOS.length}
            </Text>
            <Pressable accessibilityRole="button" onPress={concluir} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: cores.cinza }}>Pular tudo</Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', gap: 6 }} accessibilityRole="progressbar" accessibilityValue={{ min: 1, max: 3, now: passo + 1 }}>
            {PASSOS.map((p, i) => (
              <View key={p} style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: i <= passo ? cores.verde : cores.linha }} />
            ))}
          </View>

          <Text style={[estilos.titulo, { marginTop: 4 }]} accessibilityRole="header">
            {passo === 0 ? 'Vamos começar pelo básico' : passo === 1 ? 'Conecte seus apps' : 'Quanto você pesa hoje?'}
          </Text>

          {passo === 0 && (
            <>
              <Nota>Com sexo, idade e altura o app calcula quanto você gasta por dia. A meta de peso é usada na projeção.</Nota>
              <Cartao estilo={{ gap: 14 }}>
                <FormularioPerfil semCartao tituloBotao="Salvar e continuar" aoSalvar={() => setPasso(1)} />
              </Cartao>
            </>
          )}

          {passo === 1 && (
            <>
              <Nota>
                O app lê do Health Connect o que o relógio, o Hevy e o FatSecret registram. Antes, ative o Health Connect dentro de cada um
                desses apps (nas configurações ou integrações).
              </Nota>
              <CartaoHealthConnect />
              <Botao titulo="Continuar" aoTocar={() => setPasso(2)} />
              <Botao titulo="Fazer depois" variante="suave" aoTocar={() => setPasso(2)} />
            </>
          )}

          {passo === 2 && (
            <>
              <Nota>De preferência em jejum, depois de ir ao banheiro. Daqui pra frente, a tela Registrar já começa com o último peso.</Nota>
              <Cartao estilo={{ alignItems: 'center', gap: 8, paddingVertical: 24 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                  <TextInput
                    accessibilityLabel="Peso em kg"
                    value={peso}
                    onChangeText={(t) => setPeso(t.replace(/[^\d,.]/g, '').slice(0, 5))}
                    keyboardType="decimal-pad"
                    placeholder="00,0"
                    placeholderTextColor={cores.linha}
                    autoFocus
                    style={{ minWidth: 140, textAlign: 'center', fontSize: 48, fontWeight: '800', color: cores.tinta, borderBottomWidth: 2, borderBottomColor: cores.linha }}
                  />
                  <Text style={{ fontSize: 20, fontWeight: '600', color: cores.cinza }}> kg</Text>
                </View>
              </Cartao>
              {erro && <Text style={{ fontSize: 14, fontWeight: '700', color: cores.laranja }}>{erro}</Text>}
              <Botao titulo={peso.trim() ? 'Salvar e ir para o app' : 'Ir para o app'} aoTocar={salvarPeso} ocupado={salvando} />
            </>
          )}

          {passo > 0 && (
            <Pressable accessibilityRole="button" onPress={() => setPasso(passo - 1)} style={{ minHeight: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: cores.verde }}>Voltar</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
