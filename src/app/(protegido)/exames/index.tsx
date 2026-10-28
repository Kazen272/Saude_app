import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View, StyleSheet } from 'react-native';

import { AvisoMedico, COR_NIVEL, carregarContexto } from '@/components/exames';
import { Cartao, Nota, estilos } from '@/components/ui';
import { diaCurto } from '@/lib/datas';
import { listarExames, type Exame } from '@/lib/exames';
import { classificar, type Contexto, type Nivel } from '@/lib/referencias';
import { cores } from '@/lib/tema';

export default function Exames() {
  const [exames, setExames] = useState<Exame[] | null>(null);
  const [ctx, setCtx] = useState<Contexto>({ idade: null, sexo: null });
  const [erro, setErro] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      Promise.all([listarExames(), carregarContexto()])
        .then(([e, c]) => {
          setExames(e);
          setCtx(c);
        })
        .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao carregar os exames.'));
    }, []),
  );

  const contagem = (e: Exame) => {
    const total: Record<Nivel, number> = { adequado: 0, atencao: 0, alterado: 0 };
    for (const r of e.resultados) {
      const c = classificar(r.marcador, r.valor, ctx, { min: r.refMin, max: r.refMax });
      if (c) total[c.nivel]++;
    }
    return total;
  };

  return (
    <ScrollView contentContainerStyle={[estilos.conteudo, { paddingTop: 8 }]}>
      {erro && (
        <Cartao estilo={{ backgroundColor: cores.laranjaClaro }}>
          <Text style={{ color: '#5C3410' }}>{erro}</Text>
        </Cartao>
      )}
      {(ctx.idade == null || ctx.sexo == null) && exames && (
        <Nota>Preencha sexo e data de nascimento no perfil (aba Mais) para as faixas considerarem sua idade e sexo.</Nota>
      )}

      <Link href="/exames/novo" asChild>
        <Pressable accessibilityRole="link" style={StyleSheet.flatten([estilos.botao, { backgroundColor: cores.verde, height: 54, borderRadius: 16 }])}>
          <Text style={[estilos.botaoTexto, { color: '#FFFFFF', fontSize: 16, fontWeight: '800' }]}>Adicionar exame</Text>
        </Pressable>
      </Link>

      {exames && exames.length === 0 && (
        <Cartao>
          <Text style={{ fontSize: 15, fontWeight: '700', color: cores.tinta }}>Nenhum exame ainda</Text>
          <Nota>Anexe o laudo (PDF ou foto) e digite os valores. O app guarda o histórico e indica como cada resultado está em relação à referência.</Nota>
        </Cartao>
      )}

      {exames?.map((e) => {
        const t = contagem(e);
        return (
          <Link key={e.id} href={{ pathname: '/exames/[id]', params: { id: String(e.id) } }} asChild>
            <Pressable accessibilityRole="link" style={StyleSheet.flatten([estilos.cartao, { gap: 8 }])}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: cores.tinta }}>{diaCurto(e.dia)} {e.dia.slice(0, 4)}</Text>
                <Text style={{ fontSize: 13, color: cores.cinza }}>{e.resultados.length} resultado{e.resultados.length === 1 ? '' : 's'}</Text>
              </View>
              {e.laboratorio && <Nota>{e.laboratorio}</Nota>}
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {(['alterado', 'atencao', 'adequado'] as Nivel[])
                  .filter((n) => t[n] > 0)
                  .map((n) => (
                    <View key={n} style={{ backgroundColor: COR_NIVEL[n].fundo, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: COR_NIVEL[n].texto }}>
                        {t[n]} {COR_NIVEL[n].nome.toLowerCase()}
                      </Text>
                    </View>
                  ))}
              </View>
            </Pressable>
          </Link>
        );
      })}

      <AvisoMedico />
    </ScrollView>
  );
}
