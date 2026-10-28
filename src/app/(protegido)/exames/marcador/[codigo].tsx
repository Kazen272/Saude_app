import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { AvisoMedico, GraficoMarcador, SeloNivel, carregarContexto } from '@/components/exames';
import { Cartao, Nota, estilos } from '@/components/ui';
import { diaCurto, numeroCurto } from '@/lib/datas';
import { listarExames, type Exame } from '@/lib/exames';
import { classificar, marcador, type Contexto } from '@/lib/referencias';
import { cores } from '@/lib/tema';

export default function HistoricoMarcador() {
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  const m = marcador(codigo);
  const [exames, setExames] = useState<Exame[]>([]);
  const [ctx, setCtx] = useState<Contexto>({ idade: null, sexo: null });

  useFocusEffect(
    useCallback(() => {
      Promise.all([listarExames(), carregarContexto()]).then(([e, c]) => {
        setExames(e);
        setCtx(c);
      });
    }, []),
  );

  const linhas = exames
    .flatMap((e) => e.resultados.filter((r) => r.marcador === codigo).map((r) => ({ dia: e.dia, r })))
    .sort((a, b) => a.dia.localeCompare(b.dia))
    .map(({ dia, r }) => ({ dia, r, c: classificar(codigo, r.valor, ctx, { min: r.refMin, max: r.refMax }) }));

  // Faixa adequada desenhada no gráfico: a do laboratório mais recente, se houver.
  const ultimoComFaixa = [...linhas].reverse().find((l) => l.r.refMin != null || l.r.refMax != null);
  const faixa = ultimoComFaixa ? { min: ultimoComFaixa.r.refMin, max: ultimoComFaixa.r.refMax } : faixaPadrao(codigo, ctx);

  return (
    <ScrollView contentContainerStyle={[estilos.conteudo, { paddingTop: 8 }]}>
      <Stack.Screen options={{ title: m?.nome ?? 'Histórico' }} />
      <Cartao estilo={{ gap: 12 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: cores.tinta }}>Evolução ({m?.unidade})</Text>
        <GraficoMarcador
          pontos={linhas.filter((l) => l.c).map((l) => ({ dia: l.dia, valor: l.r.valor, nivel: l.c!.nivel }))}
          faixa={faixa}
          unidade={m?.unidade ?? ''}
        />
        <Nota>Faixa verde: referência {ultimoComFaixa ? 'do seu laboratório' : 'padrão para sua idade e sexo'}.</Nota>
      </Cartao>

      <Cartao estilo={{ gap: 0, paddingVertical: 4 }}>
        {linhas.length === 0 && (
          <View style={{ paddingVertical: 12 }}>
            <Nota>Nenhum resultado registrado ainda.</Nota>
          </View>
        )}
        {[...linhas].reverse().map((l, i, lista) => (
          <View
            key={l.dia}
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 12, borderBottomWidth: i === lista.length - 1 ? 0 : 1, borderBottomColor: cores.linhaSuave }}
          >
            <Text style={{ fontSize: 14, color: cores.tintaSuave }}>
              {diaCurto(l.dia)} {l.dia.slice(0, 4)}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: cores.tinta, fontVariant: ['tabular-nums'] }}>{numeroCurto(l.r.valor)}</Text>
              {l.c && <SeloNivel c={l.c} />}
            </View>
          </View>
        ))}
      </Cartao>

      {m?.nota && <Nota>{m.nota}</Nota>}
      <AvisoMedico />
    </ScrollView>
  );
}

/** Limites da faixa "adequada" da tabela padrão, para desenhar no gráfico. */
function faixaPadrao(codigo: string, ctx: Contexto): { min: number | null; max: number | null } {
  const m = marcador(codigo);
  if (!m) return { min: null, max: null };
  const faixas = m.faixas(ctx);
  const i = faixas.findIndex((f) => f.nivel === 'adequado');
  const max = faixas[i].abaixoDe;
  return { min: i > 0 ? (faixas[i - 1].abaixoDe ?? null) : null, max: max != null ? Math.round(max * 100) / 100 : null };
}
