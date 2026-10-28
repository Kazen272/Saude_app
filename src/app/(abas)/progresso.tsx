import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GraficoDeficit, GraficoPeso } from '@/components/graficos';
import { Cabecalho, Cartao, Nota, Rotulo, estilos } from '@/components/ui';
import { carregarProgresso, type Progresso as DadosProgresso } from '@/lib/dados';
import { decimal, diaCurto, diaLocal, milhar } from '@/lib/datas';
import { cores } from '@/lib/tema';

const PERIODOS = [
  { dias: 7, nome: 'Semana', sobre: 'Últimos 7 dias' },
  { dias: 30, nome: 'Mês', sobre: 'Últimos 30 dias' },
  { dias: 56, nome: '8 semanas', sobre: 'Últimas 8 semanas' },
];

export default function Progresso() {
  const [periodo, setPeriodo] = useState(56);
  const [dados, setDados] = useState<DadosProgresso | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(async (dias: number) => {
    try {
      setErro(null);
      setDados(await carregarProgresso(dias));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar(periodo);
    }, [carregar, periodo]),
  );

  const hoje = diaLocal();
  const atual = PERIODOS.find((p) => p.dias === periodo) ?? PERIODOS[2];
  const primeira = dados?.medias[0];
  const ultima = dados?.medias.at(-1);
  const variacao = primeira && ultima && primeira.dia !== ultima.dia ? ultima.pesoKg - primeira.pesoKg : null;

  return (
    <SafeAreaView style={estilos.tela} edges={['top']}>
      <ScrollView
        contentContainerStyle={estilos.conteudo}
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            tintColor={cores.verde}
            onRefresh={async () => {
              setAtualizando(true);
              await carregar(periodo);
              setAtualizando(false);
            }}
          />
        }
      >
        <Cabecalho sobre={atual.sobre} titulo="Progresso" />

        <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 4, backgroundColor: '#E7EAE4', borderRadius: 12, padding: 4 }}>
          {PERIODOS.map((p) => {
            const ativo = p.dias === periodo;
            return (
              <Pressable
                key={p.dias}
                accessibilityRole="tab"
                accessibilityState={{ selected: ativo }}
                onPress={() => setPeriodo(p.dias)}
                style={{ flex: 1, height: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: ativo ? cores.cartao : 'transparent' }}
              >
                <Text style={{ fontSize: 13, fontWeight: ativo ? '700' : '600', color: ativo ? cores.tinta : cores.cinza }}>{p.nome}</Text>
              </Pressable>
            );
          })}
        </View>

        {erro && (
          <Cartao estilo={{ backgroundColor: cores.laranjaClaro }}>
            <Text style={{ color: '#5C3410', fontSize: 14 }}>{erro}</Text>
          </Cartao>
        )}

        {/* Peso */}
        <Cartao estilo={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View style={{ gap: 2 }}>
              <Rotulo>Peso</Rotulo>
              <Text style={{ fontSize: 28, fontWeight: '800', color: cores.tinta, fontVariant: ['tabular-nums'] }}>
                {variacao == null ? '—' : `${variacao <= 0 ? '−' : '+'}${decimal(Math.abs(variacao))} kg`}
              </Text>
            </View>
            <Text style={{ fontSize: 13, color: cores.cinza, textAlign: 'right' }}>
              {primeira && ultima ? `${decimal(primeira.pesoKg)} → ${decimal(ultima.pesoKg)} kg` : 'sem pesagens'}
              {'\n'}
              {dados?.perfil.goal_weight_kg != null ? `meta: ${decimal(dados.perfil.goal_weight_kg, dados.perfil.goal_weight_kg % 1 ? 1 : 0)} kg` : 'meta não definida'}
            </Text>
          </View>
          {dados && (
            <GraficoPeso
              medias={dados.medias}
              pesagens={dados.pesagens}
              metaKg={dados.perfil.goal_weight_kg}
              projecao={dados.projecao}
              hoje={hoje}
              periodoDias={periodo}
            />
          )}
          {dados && <TextoProjecao dados={dados} />}
        </Cartao>

        {/* Déficit */}
        <Cartao estilo={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View style={{ gap: 2 }}>
              <Rotulo>Déficit dos últimos 7 dias</Rotulo>
              <Text style={{ fontSize: 28, fontWeight: '800', color: cores.tinta, fontVariant: ['tabular-nums'] }}>
                {dados?.semana.deficitTotal == null ? '—' : `${milhar(dados.semana.deficitTotal)} kcal`}
              </Text>
            </View>
            {dados?.semana.deficitTotal != null && (
              <Text style={{ fontSize: 13, color: cores.cinza }}>≈ {decimal(dados.semana.deficitTotal / 7700, 2)} kg</Text>
            )}
          </View>
          {dados && <GraficoDeficit dias={dados.ultimos7} hoje={hoje} />}
        </Cartao>

        {/* Resumo da semana */}
        <Cartao estilo={{ gap: 0, paddingVertical: 4 }}>
          <LinhaResumo titulo="Gasto calórico da semana" valor={dados?.semana.gastoTotal != null ? `${milhar(dados.semana.gastoTotal)} kcal` : '—'} />
          <LinhaResumo
            titulo="Consumo da semana"
            valor={dados?.semana.consumoTotal != null ? `${milhar(dados.semana.consumoTotal)} kcal` : '—'}
            detalhe={dados && dados.semana.diasComDieta > 0 && dados.semana.diasComDieta < 7 ? `${dados.semana.diasComDieta} de 7 dias com dieta` : undefined}
          />
          <LinhaResumo
            titulo="Treinos (Hevy)"
            valor={dados ? `${dados.treinosSemana.quantidade}${dados.treinosSemana.kcal ? ` · ${milhar(dados.treinosSemana.kcal)} kcal` : ''}` : '—'}
          />
          <LinhaResumo titulo="Água (média/dia)" valor={dados ? `${decimal(dados.aguaMediaMl / 1000)} L` : '—'} ultima />
        </Cartao>

        {/* Previsto × real */}
        <View style={{ backgroundColor: cores.laranjaClaro, borderRadius: 18, padding: 16, gap: 4 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#8A4A14' }}>Previsto × real</Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: cores.tinta }}>{textoPrevistoReal(dados)}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TextoProjecao({ dados }: { dados: DadosProgresso }) {
  const p = dados.projecao;
  let texto = 'A projeção aparece com meta definida, pesagens e alguns dias de dieta.';
  if (p?.estado === 'no_caminho') texto = `No ritmo atual (${milhar(dados.deficitMedio ?? 0)} kcal/dia de déficit), a meta chega em ${diaCurto(p.data)}.`;
  if (p?.estado === 'sem_deficit') texto = 'Sem déficit nos últimos 14 dias: no ritmo atual, o peso não deve cair.';
  if (p?.estado === 'atingida') texto = 'Meta atingida. Defina uma nova na aba Fontes.';
  return <Nota>{texto}</Nota>;
}

function textoPrevistoReal(dados: DadosProgresso | null): string {
  const pr = dados?.previstoReal;
  if (!pr) return 'Depois de algumas semanas com peso e dieta registrados, o app compara a perda prevista pelas calorias com a real e ajusta a estimativa de gasto.';
  const base = `Em ${pr.dias} dias, as calorias previam ${decimal(pr.previstoKg)} kg a menos; a balança mostrou ${decimal(pr.realKg)} kg.`;
  if (!dados?.ajusteKcalDia) return `${base} Ainda sem ajuste: são precisos ao menos 14 dias de dados.`;
  return `${base} O gasto estimado foi recalibrado em ${dados.ajusteKcalDia > 0 ? '+' : '−'}${Math.abs(dados.ajusteKcalDia)} kcal/dia, e o balanço e a projeção já usam esse ajuste.`;
}

function LinhaResumo({ titulo, valor, detalhe, ultima = false }: { titulo: string; valor: string; detalhe?: string; ultima?: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: ultima ? 0 : 1,
        borderBottomColor: cores.linhaSuave,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 14, color: cores.tintaSuave }}>{titulo}</Text>
        {detalhe && <Text style={{ fontSize: 12, color: cores.cinza }}>{detalhe}</Text>}
      </View>
      <Text style={{ fontSize: 15, fontWeight: '800', color: cores.tinta, fontVariant: ['tabular-nums'] }}>{valor}</Text>
    </View>
  );
}
