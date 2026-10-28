import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Cabecalho, Cartao, Nota, Rotulo, estilos } from '@/components/ui';
import { mediaMovel, type Pesagem } from '@/lib/calculos';
import { carregarPesagens } from '@/lib/dados';
import { decimal, diaCurto } from '@/lib/datas';
import { cores } from '@/lib/tema';

// Versão inicial: histórico em lista. Os gráficos do protótipo entram na próxima etapa.
export default function Progresso() {
  const [pesagens, setPesagens] = useState<Pesagem[]>([]);
  const [medias, setMedias] = useState<Pesagem[]>([]);

  useFocusEffect(
    useCallback(() => {
      carregarPesagens(56).then((p) => {
        setPesagens(p);
        setMedias(mediaMovel(p));
      });
    }, []),
  );

  const primeira = medias[0];
  const ultima = medias.at(-1);
  const variacao = primeira && ultima ? ultima.pesoKg - primeira.pesoKg : null;

  return (
    <SafeAreaView style={estilos.tela} edges={['top']}>
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <Cabecalho sobre="Últimas 8 semanas" titulo="Progresso" />

        <Cartao>
          <Rotulo>Peso (média de 7 dias)</Rotulo>
          <Text style={{ fontSize: 28, fontWeight: '800', color: cores.tinta, fontVariant: ['tabular-nums'] }}>
            {variacao == null ? '—' : `${variacao <= 0 ? '−' : '+'}${decimal(Math.abs(variacao))} kg`}
          </Text>
          {primeira && ultima && (
            <Nota>
              {decimal(primeira.pesoKg)} → {decimal(ultima.pesoKg)} kg desde {diaCurto(primeira.dia)}
            </Nota>
          )}
        </Cartao>

        <Cartao estilo={{ gap: 0, paddingVertical: 4 }}>
          {pesagens.length === 0 && (
            <View style={{ paddingVertical: 12 }}>
              <Nota>Nenhuma pesagem ainda. Registre o peso na aba Registrar.</Nota>
            </View>
          )}
          {[...pesagens].reverse().map((p, i, lista) => {
            const media = medias.find((m) => m.dia === p.dia);
            return (
              <View
                key={p.dia}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  paddingVertical: 12,
                  borderBottomWidth: i === lista.length - 1 ? 0 : 1,
                  borderBottomColor: cores.linhaSuave,
                }}
              >
                <Text style={{ fontSize: 14, color: cores.tintaSuave }}>{diaCurto(p.dia)}</Text>
                <Text style={{ fontSize: 15, fontWeight: '800', color: cores.tinta, fontVariant: ['tabular-nums'] }}>
                  {decimal(p.pesoKg)} kg
                  {media && <Text style={{ fontSize: 12, fontWeight: '600', color: cores.cinza }}>  média {decimal(media.pesoKg)}</Text>}
                </Text>
              </View>
            );
          })}
        </Cartao>
      </ScrollView>
    </SafeAreaView>
  );
}
