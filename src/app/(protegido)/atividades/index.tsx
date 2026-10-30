import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Cartao, Nota, estilos } from '@/components/ui';
import { descreverDias, nomeDaAtividade } from '@/lib/atividades';
import { listarRecorrentes, salvarRecorrente, type AtividadeRecorrente } from '@/lib/atividades-dados';
import { cores } from '@/lib/tema';

export default function Atividades() {
  const [lista, setLista] = useState<AtividadeRecorrente[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setErro(null);
      setLista(await listarRecorrentes());
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  async function alternar(a: AtividadeRecorrente) {
    setLista((l) => l?.map((x) => (x.id === a.id ? { ...x, ativa: !x.ativa } : x)) ?? null);
    try {
      await salvarRecorrente({ ...a, ativa: !a.ativa });
    } catch {
      setErro('Não foi possível salvar.');
      carregar();
    }
  }

  return (
    <ScrollView contentContainerStyle={[estilos.conteudo, { paddingTop: 8 }]}>
      <Nota>
        Cadastre o que você faz toda semana (luta, corrida, yoga…). Nos dias marcados, a tela Hoje pergunta se você fez. Se o relógio gravar um treino no horário, ele já
        conta como feito.
      </Nota>

      {erro && <Text style={{ color: cores.laranja, fontWeight: '600' }}>{erro}</Text>}

      <Link href="/atividades/editar" asChild>
        <Pressable accessibilityRole="link" style={StyleSheet.flatten([estilos.botao, { backgroundColor: cores.verde, height: 54, borderRadius: 16 }])}>
          <Text style={[estilos.botaoTexto, { color: '#FFFFFF', fontSize: 16, fontWeight: '800' }]}>Adicionar atividade</Text>
        </Pressable>
      </Link>

      {lista?.length === 0 && (
        <Cartao>
          <Text style={{ fontSize: 15, fontWeight: '700', color: cores.tinta }}>Nenhuma atividade ainda</Text>
          <Nota>Ex.: Muay Thai, terça e quinta, 19:00, 60 min.</Nota>
        </Cartao>
      )}

      {lista?.map((a) => (
        <View key={a.id} style={[estilos.cartao, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
          <Link href={{ pathname: '/atividades/editar', params: { id: String(a.id) } }} asChild>
            <Pressable accessibilityRole="link" style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: a.ativa ? cores.tinta : cores.cinza }}>{nomeDaAtividade(a.atividade, a.nomeLivre)}</Text>
              <Text style={{ fontSize: 13, color: cores.cinza }}>
                {descreverDias(a.dias)} · {a.hora} · {a.duracaoMin} min · {a.intensidade}
              </Text>
            </Pressable>
          </Link>
          <Switch
            accessibilityLabel={`${a.ativa ? 'Pausar' : 'Ativar'} ${nomeDaAtividade(a.atividade, a.nomeLivre)}`}
            value={a.ativa}
            onValueChange={() => alternar(a)}
            trackColor={{ true: cores.verde, false: cores.linha }}
            thumbColor="#FFFFFF"
          />
        </View>
      ))}
    </ScrollView>
  );
}
