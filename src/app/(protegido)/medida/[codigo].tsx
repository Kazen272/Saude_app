import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { GraficoMedida, PilulaDelta, textoDelta, textoValores } from '@/components/medidas';
import { Cartao, Nota, Rotulo, estilos } from '@/components/ui';
import { carregarMedidas } from '@/lib/dados';
import { diaCurto } from '@/lib/datas';
import { medidaPorCodigo, resumir, tom, variacao, type ResumoMedida } from '@/lib/medidas';
import { cores } from '@/lib/tema';

export default function DetalheMedida() {
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  const medida = medidaPorCodigo(codigo);
  const [resumo, setResumo] = useState<ResumoMedida | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregado, setCarregado] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!medida) return;
      carregarMedidas()
        .then((r) => {
          setResumo(resumir(r, medida));
          setCarregado(true);
        })
        .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar.'));
    }, [medida]),
  );

  const corDelta = (d: number | null) =>
    !resumo || d == null ? cores.tinta : { bom: cores.verdeEscuro, ruim: '#8A4A14', neutro: cores.tinta }[tom(resumo.medida, d)];
  const lista = resumo ? [...resumo.pontos].reverse() : [];

  return (
    <ScrollView contentContainerStyle={[estilos.conteudo, { paddingTop: 8 }]}>
      <Stack.Screen options={{ title: medida?.nome ?? 'Medida' }} />
      {erro && <Text style={{ color: cores.laranja, fontWeight: '600' }}>{erro}</Text>}
      {!medida && <Nota>Medida não encontrada.</Nota>}
      {carregado && !resumo && <Nota>Nenhuma medição registrada ainda. Use a aba Registrar.</Nota>}

      {resumo && (
        <>
          <Cartao estilo={{ flexDirection: 'row', gap: 8 }}>
            {[
              { rotulo: 'Atual (cm)', valor: textoValores(resumo.atual), cor: cores.tinta },
              { rotulo: 'vs. anterior', valor: textoDelta(resumo.vsAnterior) || '–', cor: corDelta(resumo.vsAnterior) },
              { rotulo: `vs. ${diaCurto(resumo.diaPrimeira)}`, valor: textoDelta(resumo.vsPrimeira) || '–', cor: corDelta(resumo.vsPrimeira) },
            ].map((b) => (
              <View key={b.rotulo} style={{ flex: 1, gap: 2, minWidth: 0 }}>
                <Text style={{ fontSize: 12, color: cores.cinza }} numberOfLines={1}>
                  {b.rotulo}
                </Text>
                <Text style={{ fontSize: 20, fontWeight: '800', color: b.cor, fontVariant: ['tabular-nums'] }} numberOfLines={1} adjustsFontSizeToFit>
                  {b.valor}
                </Text>
              </View>
            ))}
          </Cartao>

          <Cartao estilo={{ gap: 8 }}>
            <Rotulo>Evolução (cm)</Rotulo>
            <GraficoMedida resumo={resumo} />
          </Cartao>

          <Cartao estilo={{ paddingVertical: 4 }}>
            {resumo.medida.colunas.length === 2 && (
              <Text style={{ fontSize: 12, color: cores.cinza, textAlign: 'right', paddingTop: 8 }}>esq. · dir.</Text>
            )}
            {lista.map((p, i) => {
              const anterior = lista[i + 1];
              const d = anterior ? variacao(anterior, p) : null;
              return (
                <View
                  key={p.dia}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, borderBottomWidth: i === lista.length - 1 ? 0 : 1, borderBottomColor: cores.linhaSuave }}
                >
                  <Text style={{ flex: 1, fontSize: 14, color: cores.tintaSuave }}>
                    {diaCurto(p.dia)} {p.dia.slice(0, 4)}
                  </Text>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: cores.tinta, fontVariant: ['tabular-nums'] }}>{textoValores(p)}</Text>
                  {anterior ? (
                    <PilulaDelta resumo={resumo} delta={d} />
                  ) : (
                    <Text style={{ width: 64, textAlign: 'center', fontSize: 12, color: cores.cinza }}>1ª</Text>
                  )}
                </View>
              );
            })}
          </Cartao>
          <Nota>Para corrigir uma medição, abra a aba Registrar no dia dela.</Nota>
        </>
      )}
    </ScrollView>
  );
}
