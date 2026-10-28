import { Link, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';

import { AvisoMedico, SeloNivel, carregarContexto } from '@/components/exames';
import { Botao, Cartao, Nota, estilos } from '@/components/ui';
import { diaCurto, numeroCurto } from '@/lib/datas';
import { apagarExame, linkDoLaudo, listarExames, type Exame } from '@/lib/exames';
import { MARCADORES, classificar, marcador, type Contexto } from '@/lib/referencias';
import { cores } from '@/lib/tema';

const valorTexto = (v: number) => numeroCurto(v);

export default function DetalheExame() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [exame, setExame] = useState<Exame | null>(null);
  const [anteriores, setAnteriores] = useState<Exame[]>([]);
  const [ctx, setCtx] = useState<Contexto>({ idade: null, sexo: null });
  const [erro, setErro] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      Promise.all([listarExames(), carregarContexto()])
        .then(([lista, c]) => {
          const atual = lista.find((e) => String(e.id) === id) ?? null;
          setExame(atual);
          setAnteriores(atual ? lista.filter((e) => e.dia < atual.dia) : []);
          setCtx(c);
        })
        .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar o exame.'));
    }, [id]),
  );

  if (erro) return <Text style={{ padding: 20, color: cores.laranja }}>{erro}</Text>;
  if (!exame) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={cores.verde} />
      </View>
    );
  }

  async function abrirLaudo() {
    try {
      await Linking.openURL(await linkDoLaudo(exame!.arquivo as string));
    } catch {
      Alert.alert('Não foi possível abrir o laudo.');
    }
  }

  function apagar() {
    Alert.alert('Apagar este exame?', 'Os resultados e o laudo anexado serão removidos.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          await apagarExame(exame!);
          router.back();
        },
      },
    ]);
  }

  const ordem = (codigo: string) => MARCADORES.findIndex((m) => m.codigo === codigo);
  const resultados = [...exame.resultados].sort((a, b) => ordem(a.marcador) - ordem(b.marcador));
  const anteriorDe = (codigo: string) => {
    for (const e of [...anteriores].sort((a, b) => b.dia.localeCompare(a.dia))) {
      const r = e.resultados.find((x) => x.marcador === codigo);
      if (r) return { dia: e.dia, valor: r.valor };
    }
    return null;
  };

  return (
    <ScrollView contentContainerStyle={[estilos.conteudo, { paddingTop: 8 }]}>
      <View style={{ gap: 2 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: cores.tinta }}>
          Coleta de {diaCurto(exame.dia)} {exame.dia.slice(0, 4)}
        </Text>
        {exame.laboratorio && <Nota>{exame.laboratorio}</Nota>}
      </View>

      {exame.arquivo && <Botao titulo="Abrir laudo" variante="suave" aoTocar={abrirLaudo} />}

      {resultados.length === 0 && <Nota>Este exame só tem o laudo anexado, sem valores digitados.</Nota>}

      {resultados.length > 0 && (
        <Cartao estilo={{ gap: 0, paddingVertical: 4 }}>
          {resultados.map((r, i) => {
            const m = marcador(r.marcador);
            const c = classificar(r.marcador, r.valor, ctx, { min: r.refMin, max: r.refMax });
            const ant = anteriorDe(r.marcador);
            return (
              <Link key={r.marcador} href={{ pathname: '/exames/marcador/[codigo]', params: { codigo: r.marcador } }} asChild>
                <Pressable
                  accessibilityRole="link"
                  style={{ paddingVertical: 12, gap: 6, borderBottomWidth: i === resultados.length - 1 ? 0 : 1, borderBottomColor: cores.linhaSuave }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: cores.tinta }}>{m?.nome ?? r.marcador}</Text>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: cores.tinta, fontVariant: ['tabular-nums'] }}>
                      {valorTexto(r.valor)} <Text style={{ fontSize: 12, fontWeight: '600', color: cores.cinza }}>{r.unidade}</Text>
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {c && <SeloNivel c={c} />}
                    {c && (
                      <Text style={{ fontSize: 12, color: cores.cinza }}>
                        ref. {c.faixaTexto}
                        {c.fonte === 'laboratorio' ? ' (laboratório)' : ''}
                      </Text>
                    )}
                  </View>
                  {ant && (
                    <Text style={{ fontSize: 12, color: cores.cinza }}>
                      Anterior: {valorTexto(ant.valor)} em {diaCurto(ant.dia)} {ant.dia.slice(0, 4)}
                    </Text>
                  )}
                </Pressable>
              </Link>
            );
          })}
        </Cartao>
      )}

      <AvisoMedico />
      <Botao titulo="Apagar exame" variante="suave" aoTocar={apagar} />
    </ScrollView>
  );
}
