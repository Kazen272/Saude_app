import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradeCheckins, GraficoSono } from '@/components/bemestar';
import { GraficoDeficit, GraficoPeso, GraficoSemanas } from '@/components/graficos';
import { CartaoMedidas } from '@/components/medidas';
import { Cabecalho, Cartao, Nota, Rotulo, estilos } from '@/components/ui';
import { LIMITE_RITMO_PCT } from '@/lib/calculos';
import { formatarDuracao, mediaCampo, resumirSono, type CheckIn, type Noite } from '@/lib/bemestar';
import { carregarCheckins, carregarNoites } from '@/lib/bemestar-dados';
import { carregarProgresso, type Progresso as DadosProgresso } from '@/lib/dados';
import { decimal, diaCurto, diaLocal, milhar } from '@/lib/datas';
import { cores } from '@/lib/tema';

// O período vale só para o gráfico de peso; os outros cartões dizem o próprio período.
const PERIODOS = [
  { dias: 7, nome: '7 dias' },
  { dias: 30, nome: '30 dias' },
  { dias: 56, nome: '8 semanas' },
];

export default function Progresso() {
  const [periodo, setPeriodo] = useState(56);
  const [dados, setDados] = useState<DadosProgresso | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [noites, setNoites] = useState<Noite[]>([]);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);

  const carregar = useCallback(async (dias: number) => {
    try {
      setErro(null);
      const [p, n, c] = await Promise.all([carregarProgresso(dias), carregarNoites(7), carregarCheckins(7)]);
      setDados(p);
      setNoites(n);
      setCheckins(c);
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
        <Cabecalho sobre="Peso, energia, sono e hábitos" titulo="Progresso" />

        <Link href="/relatorio" asChild>
          <Pressable accessibilityRole="link" style={StyleSheet.flatten([estilos.cartao, { backgroundColor: cores.painel, flexDirection: 'row', alignItems: 'center' }])}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFFFFF' }}>Relatório da semana</Text>
              <Text style={{ fontSize: 13, color: cores.escuroSuave }}>o que melhorou e o que piorou</Text>
            </View>
            <Text style={{ fontSize: 22, color: '#FFFFFF' }}>›</Text>
          </Pressable>
        </Link>

        {erro && (
          <Cartao estilo={{ backgroundColor: cores.laranjaClaro }}>
            <Text style={{ color: cores.laranjaTexto, fontSize: 14 }}>{erro}</Text>
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
          <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 4, backgroundColor: cores.segmento, borderRadius: 12, padding: 4 }}>
            {PERIODOS.map((p) => {
              const ativo = p.dias === periodo;
              return (
                <Pressable
                  key={p.dias}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: ativo }}
                  onPress={() => setPeriodo(p.dias)}
                  style={{ flex: 1, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: ativo ? cores.cartao : 'transparent' }}
                >
                  <Text style={{ fontSize: 13, fontWeight: ativo ? '700' : '600', color: ativo ? cores.tinta : cores.cinza }}>{p.nome}</Text>
                </Pressable>
              );
            })}
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
          {dados?.ritmo && (
            <Text style={{ fontSize: 13, fontWeight: dados.ritmo.pctPorSemana > LIMITE_RITMO_PCT ? '700' : '400', color: dados.ritmo.pctPorSemana > LIMITE_RITMO_PCT ? cores.laranja : cores.cinza }}>
              {dados.ritmo.kgPorSemana > 0
                ? `Ritmo real nas últimas 2 semanas: −${decimal(dados.ritmo.kgPorSemana, 2)} kg por semana (${decimal(dados.ritmo.pctPorSemana)}% do peso).`
                : `Peso estável ou subindo nas últimas 2 semanas (${dados.ritmo.kgPorSemana === 0 ? '0' : '+' + decimal(Math.abs(dados.ritmo.kgPorSemana), 2)} kg por semana).`}
              {dados.ritmo.pctPorSemana > LIMITE_RITMO_PCT ? ' Acima de 1% por semana costuma levar massa magra junto: vale reduzir o déficit.' : ''}
            </Text>
          )}
        </Cartao>

        {/* Déficit */}
        <Cartao estilo={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View style={{ gap: 2 }}>
              <Rotulo>Déficit · 7 dias completos</Rotulo>
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
          <View style={{ paddingTop: 12, paddingBottom: 2 }}>
            <Rotulo>Últimos 7 dias completos (até ontem)</Rotulo>
          </View>
          <LinhaResumo titulo="Gasto calórico da semana" valor={dados?.semana.gastoTotal != null ? `${milhar(dados.semana.gastoTotal)} kcal` : '—'} />
          <LinhaResumo
            titulo="Consumo da semana"
            valor={dados?.semana.consumoTotal != null ? `${milhar(dados.semana.consumoTotal)} kcal` : '—'}
            detalhe={dados && dados.semana.diasComDieta > 0 && dados.semana.diasComDieta < 7 ? `${dados.semana.diasComDieta} de 7 dias com dieta` : undefined}
          />
          <LinhaResumo
            titulo="Proteína (média/dia)"
            valor={dados?.proteinaMediaSemana != null ? `${dados.proteinaMediaSemana} g` : '—'}
            detalhe={dados?.metaProteina ? `meta ${dados.metaProteina.min}–${dados.metaProteina.max} g` : undefined}
          />
          <LinhaResumo
            titulo="Treinos"
            valor={dados ? `${dados.treinosSemana.quantidade}${dados.treinosSemana.kcal ? ` · ${milhar(dados.treinosSemana.kcal)} kcal` : ''}` : '—'}
          />
          <LinhaResumo titulo="Água (média/dia)" valor={dados ? `${decimal(dados.aguaMediaMl / 1000)} L` : '—'} ultima />
        </Cartao>

        {/* Sono */}
        <Cartao estilo={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View style={{ gap: 2 }}>
              <Rotulo>Sono · últimas 7 noites</Rotulo>
              <Text style={{ fontSize: 28, fontWeight: '800', color: cores.tinta, fontVariant: ['tabular-nums'] }}>
                {resumirSono(noites).mediaMin != null ? formatarDuracao(resumirSono(noites).mediaMin as number) : '—'}
              </Text>
            </View>
            <Text style={{ fontSize: 13, color: cores.cinza }}>média por noite</Text>
          </View>
          <GraficoSono noites={noites} />
        </Cartao>

        {/* Check-in */}
        <Cartao estilo={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Rotulo>Check-in · 7 dias</Rotulo>
            <Text style={{ fontSize: 12, color: cores.cinza }}>
              {checkins.length
                ? `energia ${decimal(mediaCampo(checkins, 'energia') ?? 0)} · fome ${decimal(mediaCampo(checkins, 'fome') ?? 0)}`
                : ''}
            </Text>
          </View>
          <GradeCheckins checkins={checkins} />
        </Cartao>

        {/* Medidas */}
        <CartaoMedidas medidas={dados?.medidas ?? null} relacaoCintura={dados?.relacaoCintura ?? null} temAltura={!!dados?.perfil.height_cm} />

        {/* Tendências de 8 semanas */}
        <Cartao estilo={{ gap: 14 }}>
          <View style={{ gap: 2 }}>
            <Rotulo>Tendências · 8 semanas</Rotulo>
            <Nota>Médias por semana (segunda a domingo). A semana atual ainda não terminou.</Nota>
          </View>
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: cores.tinta }}>Treinos por semana</Text>
            <GraficoSemanas
              semanas={(dados?.tendencias ?? []).map((t) => ({ semana: t.semana, valor: t.treinos }))}
              formatar={(v) => String(v)}
              meta={{ valor: 3, texto: 'meta 3' }}
              rotulo="Treinos por semana"
              vazio="Os treinos do Hevy e do relógio aparecem aqui."
            />
            {dados && dados.tendencias.some((t) => t.treinos > 0) && (
              <Nota>
                Constância: {dados.tendencias.slice(0, -1).filter((t) => t.treinos >= 3).length} das últimas 7 semanas completas com 3 treinos ou mais.
              </Nota>
            )}
          </View>
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: cores.tinta }}>Passos por dia</Text>
            <GraficoSemanas
              semanas={(dados?.tendencias ?? []).map((t) => ({ semana: t.semana, valor: t.passos }))}
              formatar={(v) => (v >= 1000 ? `${decimal(v / 1000)} mil` : String(v))}
              cor={cores.azul}
              rotulo="Média de passos por dia, por semana"
              vazio="Os passos do relógio aparecem aqui."
            />
          </View>
          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: cores.tinta }}>Frequência cardíaca de repouso</Text>
            <GraficoSemanas
              semanas={(dados?.tendencias ?? []).map((t) => ({ semana: t.semana, valor: t.fcRepouso }))}
              formatar={(v) => `${v}`}
              cor={cores.laranja}
              rotulo="Frequência cardíaca de repouso média, por semana"
              vazio="A frequência de repouso do relógio aparece aqui."
            />
            <Nota>Quanto mais baixa, em geral, melhor o condicionamento. Picos podem indicar cansaço, estresse ou início de gripe.</Nota>
          </View>
        </Cartao>

        {/* Previsto × real */}
        <View style={{ backgroundColor: cores.laranjaClaro, borderRadius: 18, padding: 16, gap: 4 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: cores.laranjaTexto }}>Previsto × real</Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: cores.tinta }}>{textoPrevistoReal(dados)}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TextoProjecao({ dados }: { dados: DadosProgresso }) {
  const p = dados.projecao;
  let texto = 'A projeção aparece com meta definida, pesagens e alguns dias de dieta.';
  if (p?.estado === 'no_caminho')
    texto = `Com ${milhar(dados.deficitMedio ?? 0)} kcal/dia de déficit em média, a meta chega entre ${diaCurto(p.dataCedo)} e ${diaCurto(p.dataTarde)} (mais provável por volta de ${diaCurto(p.data)}).`;
  if (p?.estado === 'sem_deficit') texto = 'Sem déficit nos últimos 14 dias: no ritmo atual, o peso não deve cair.';
  if (p?.estado === 'atingida') texto = 'Meta atingida. Defina uma nova no perfil, na aba Mais.';
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
