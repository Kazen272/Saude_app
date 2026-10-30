import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { FormularioAtividade } from '@/components/atividades';
import { Botao, Cartao, estilos } from '@/components/ui';
import { nomeDaAtividade } from '@/lib/atividades';
import { apagarRecorrente, listarRecorrentes, pesoAtual, salvarRecorrente, type AtividadeRecorrente } from '@/lib/atividades-dados';
import { NOMES_DIAS } from '@/lib/lembretes-regras';
import { cores } from '@/lib/tema';

const NOVA: AtividadeRecorrente = { atividade: '', nomeLivre: '', dias: [], hora: '19:00', duracaoMin: 60, intensidade: 'moderada', ativa: true };

export default function EditarAtividade() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [a, setA] = useState<AtividadeRecorrente | null>(id ? null : NOVA);
  const [peso, setPeso] = useState(70);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    pesoAtual().then(setPeso).catch(() => {});
    if (!id) return;
    listarRecorrentes()
      .then((l) => setA(l.find((x) => String(x.id) === id) ?? NOVA))
      .catch(() => setA(NOVA));
  }, [id]);

  if (!a) return null;
  const mudar = (p: Partial<AtividadeRecorrente>) => setA({ ...a, ...p });

  async function salvar() {
    if (!a) return;
    if (!a.atividade) return setErro('Escolha a atividade.');
    if (a.atividade === 'outra' && !a.nomeLivre.trim()) return setErro('Dê um nome para a atividade.');
    if (!a.dias.length) return setErro('Marque pelo menos um dia da semana.');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(a.hora)) return setErro('Horário no formato 19:00.');
    if (a.duracaoMin < 5 || a.duracaoMin > 600) return setErro('Duração entre 5 e 600 minutos.');
    setSalvando(true);
    try {
      await salvarRecorrente(a);
      router.back();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.');
      setSalvando(false);
    }
  }

  function apagar() {
    Alert.alert('Apagar atividade?', `${nomeDaAtividade(a!.atividade, a!.nomeLivre)}. Os dias já registrados continuam no histórico.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          await apagarRecorrente(a!.id as number);
          router.back();
        },
      },
    ]);
  }

  const alternarDia = (d: number) => mudar({ dias: a.dias.includes(d) ? a.dias.filter((x) => x !== d) : [...a.dias, d] });

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[estilos.conteudo, { paddingTop: 8 }]} keyboardShouldPersistTaps="handled">
        <FormularioAtividade valores={a} aoMudar={mudar} pesoKg={peso} />

        <Cartao estilo={{ gap: 12 }}>
          <Text style={estilos.rotulo}>Dias da semana</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {NOMES_DIAS.map((nome, i) => {
              const d = i + 1;
              const ativo = a.dias.includes(d);
              return (
                <Pressable
                  key={d}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: ativo }}
                  onPress={() => alternarDia(d)}
                  style={{ flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: ativo ? cores.verde : cores.linhaSuave }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: ativo ? '#FFFFFF' : cores.tintaSuave }}>{nome}</Text>
                </Pressable>
              );
            })}
          </View>
        </Cartao>

        {erro && <Text style={{ fontSize: 14, fontWeight: '700', color: cores.laranja }}>{erro}</Text>}
        <Botao titulo="Salvar atividade" aoTocar={salvar} ocupado={salvando} />
        {a.id != null && <Botao titulo="Apagar" variante="suave" aoTocar={apagar} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
