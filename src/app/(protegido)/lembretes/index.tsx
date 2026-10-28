import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';

import { Botao, Cartao, Nota, estilos } from '@/components/ui';
import { MAX_DISPAROS, SUGESTOES, descrever, disparos, type Lembrete } from '@/lib/lembretes-regras';
import { inserirLembretes, listarLembretes, salvarLembrete, sincronizarAgendamentos } from '@/lib/lembretes';
import { cores } from '@/lib/tema';

export default function Lembretes() {
  const [lista, setLista] = useState<Lembrete[] | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const sincronizar = useCallback(async (l: Lembrete[]) => {
    const r = await sincronizarAgendamentos(l);
    setAviso(
      r.semPermissao
        ? 'As notificações estão bloqueadas. Libere em Configurações do Android → Apps → Saúde → Notificações.'
        : null,
    );
  }, []);

  const carregar = useCallback(async () => {
    try {
      const l = await listarLembretes();
      setLista(l);
      await sincronizar(l);
    } catch (e) {
      setAviso(e instanceof Error ? e.message : 'Erro ao carregar os lembretes.');
    }
  }, [sincronizar]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  async function alternar(l: Lembrete, ativo: boolean) {
    if (!lista) return;
    const nova = lista.map((x) => (x.id === l.id ? { ...x, ativo } : x));
    setLista(nova);
    try {
      await salvarLembrete({ ...l, ativo });
      await sincronizar(nova);
    } catch {
      setLista(lista);
      setAviso('Não foi possível salvar.');
    }
  }

  async function adicionarSugestoes() {
    setOcupado(true);
    try {
      await inserirLembretes(SUGESTOES);
      await carregar();
    } finally {
      setOcupado(false);
    }
  }

  const total = (lista ?? []).reduce((s, l) => s + disparos(l).length, 0);

  return (
    <ScrollView contentContainerStyle={[estilos.conteudo, { paddingTop: 8 }]}>
      {aviso && (
        <View style={{ backgroundColor: cores.laranjaClaro, borderRadius: 14, padding: 14 }}>
          <Text style={{ fontSize: 14, color: '#5C3410' }}>{aviso}</Text>
        </View>
      )}

      {lista && lista.length === 0 && (
        <Cartao>
          <Text style={{ fontSize: 15, fontWeight: '700', color: cores.tinta }}>Nenhum lembrete ainda</Text>
          <Nota>Comece com as sugestões (água a cada 2 h, pesagem, check-in, foto e relatório de domingo) e ajuste depois.</Nota>
          <Botao titulo="Adicionar sugestões" aoTocar={adicionarSugestoes} ocupado={ocupado} />
        </Cartao>
      )}

      {lista && lista.length > 0 && (
        <Cartao estilo={{ gap: 0, paddingVertical: 4 }}>
          {lista.map((l, i) => (
            <View
              key={l.id}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: i === lista.length - 1 ? 0 : 1, borderBottomColor: cores.linhaSuave }}
            >
              <Link href={{ pathname: '/lembretes/editar', params: { id: String(l.id) } }} asChild>
                <Pressable accessibilityRole="link" style={{ flex: 1, gap: 2, minHeight: 44, justifyContent: 'center' }}>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: l.ativo ? cores.tinta : cores.cinza }}>{l.titulo}</Text>
                  <Text style={{ fontSize: 12, color: cores.cinza }}>{descrever(l)}</Text>
                </Pressable>
              </Link>
              <Switch
                accessibilityLabel={`${l.titulo} ${l.ativo ? 'ligado' : 'desligado'}`}
                value={l.ativo}
                onValueChange={(v) => alternar(l, v)}
                trackColor={{ true: cores.verde, false: cores.linha }}
                thumbColor="#FFFFFF"
              />
            </View>
          ))}
        </Cartao>
      )}

      <Link href="/lembretes/editar" asChild>
        <Pressable accessibilityRole="link" style={[estilos.botao, { backgroundColor: cores.verde, height: 54, borderRadius: 16 }]}>
          <Text style={[estilos.botaoTexto, { color: '#FFFFFF', fontSize: 16, fontWeight: '800' }]}>Novo lembrete</Text>
        </Pressable>
      </Link>

      {lista && lista.length > 0 && (
        <Nota>
          {total} aviso{total === 1 ? '' : 's'} por semana agendado{total === 1 ? '' : 's'} no celular
          {total >= MAX_DISPAROS ? ' (limite do Android atingido: alguns não serão agendados)' : ''}.
        </Nota>
      )}
    </ScrollView>
  );
}
