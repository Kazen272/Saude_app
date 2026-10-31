import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradeCheckins, GraficoSono } from '@/components/bemestar';
import { GraficoPeso, GraficoSemanas } from '@/components/graficos';
import { CartaoMedidas } from '@/components/medidas';
import { CartaoConstancia, CartaoGordura, CartaoPadroes, CartaoQualidadeDieta, CartoesSinais } from '@/components/analises';
import { CabecalhoCartao, Cabecalho, Cartao, Nota, Rotulo, estilos } from '@/components/ui';
import { LIMITE_RITMO_PCT } from '@/lib/calculos';
import { formatarDuracao, mediaCampo, resumirSono, type CheckIn, type Noite } from '@/lib/bemestar';
import { carregarCheckins, carregarNoites } from '@/lib/bemestar-dados';
import { carregarAnalises, carregarProgresso, type Analises, type Progresso as DadosProgresso } from '@/lib/dados';
import { EXPLICACOES } from '@/lib/explicacoes';
import { decimal, diaCurto, diaLocal, milhar } from '@/lib/datas';
import { cores } from '@/lib/tema';

// O período vale só para o gráfico de peso; os outros cartões dizem o próprio período.
const PERIODOS = [
  { dias: 7, nome: '7 dias' },
  { dias: 30, nome: '30 dias' },
  { dias: 56, nome: '8 semanas' },
];

type Aba = 'resumo' | 'corpo' | 'calorias' | 'habitos';
const ABAS: { id: Aba; nome: string }[] = [
  { id: 'resumo', nome: 'Resumo' },
  { id: 'corpo', nome: 'Corpo' },
  { id: 'calorias', nome: 'Calorias' },
  { id: 'habitos', nome: 'Hábitos' },
];

export default function Progresso() {
  const [aba, setAba] = useState<Aba>('resumo');
  const [periodo, setPeriodo] = useState(56);
  const [dados, setDados] = useState<DadosProgresso | null>(null);
  const [analises, setAnalises] = useState<Analises | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [noites, setNoites] = useState<Noite[]>([]);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);

  const carregar = useCallback(async (dias: number) => {
    try {
      setErro(null);
      const [p, n, c, a] = await Promise.all([carregarProgresso(dias), carregarNoites(7), carregarCheckins(7), carregarAnalises()]);
      setDados(p);
      setNoites(n);
      setCheckins(c);
      setAnalises(a);
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
  const sono = resumirSono(noites);

  return (
    <SafeAreaView style={estilos.tela} edges={['top']}>
      <ScrollView
        contentContainerStyle={estilos.conteudo}
        stickyHeaderIndices={[1]}
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
        <Cabecalho sobre="Peso, calorias, sono e hábitos" titulo="Progresso" />

        <View style={{ backgroundColor: cores.fundo, paddingVertical: 4 }}>
          <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 4, backgroundColor: cores.segmento, borderRadius: 12, padding: 4 }}>
            {ABAS.map((x) => {
              const ativa = x.id === aba;
              return (
                <Pressable
                  key={x.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: ativa }}
                  onPress={() => setAba(x.id)}
                  style={{ flex: 1, height: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: ativa ? cores.cartao : 'transparent' }}
                >
                  <Text style={{ fontSize: 13, fontWeight: ativa ? '800' : '600', color: ativa ? cores.tinta : cores.cinza }} numberOfLines={1}>
                    {x.nome}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {erro && (
          <Cartao estilo={{ backgroundColor: cores.laranjaClaro }}>
            <Text style={{ color: cores.laranjaTexto, fontSize: 14 }}>{erro}</Text>
          </Cartao>
        )}

        {aba === 'resumo' && (
          <>
            <Link href="/relatorio" asChild>
              <Pressable accessibilityRole="link" style={StyleSheet.flatten([estilos.cartao, { backgroundColor: cores.painel, flexDirection: 'row', alignItems: 'center' }])}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: '#FFFFFF' }}>Relatório da semana</Text>
                  <Text style={{ fontSize: 13, color: cores.escuroSuave }}>o que melhorou e o que piorou</Text>
                </View>
                <Text style={{ fontSize: 22, color: '#FFFFFF' }}>›</Text>
              </Pressable>
            </Link>
            <Cartao estilo={{ gap: 6 }}>
              <CabecalhoCartao titulo="Meta de peso" info={EXPLICACOES.peso} />
              <Text style={{ fontSize: 22, fontWeight: '800', color: cores.tinta }}>
                {variacao == null ? '—' : `${variacao <= 0 ? '−' : '+'}${decimal(Math.abs(variacao))} kg em 8 semanas`}
              </Text>
              {dados && <TextoProjecao dados={dados} />}
            </Cartao>
            <CartoesSinais a={analises} />
            <CartaoConstancia a={analises} />
            <CartaoPadroes a={analises} />
          </>
        )}

        {aba === 'corpo' && (
          <>
            <Cartao estilo={{ gap: 12 }}>
              <CabecalhoCartao titulo="Peso" info={EXPLICACOES.peso} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 28, fontWeight: '800', color: cores.tinta, fontVariant: ['tabular-nums'] }}>
                  {variacao == null ? '—' : `${variacao <= 0 ? '−' : '+'}${decimal(Math.abs(variacao))} kg`}
                </Text>
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
                <GraficoPeso medias={dados.medias} pesagens={dados.pesagens} metaKg={dados.perfil.goal_weight_kg} projecao={dados.projecao} hoje={hoje} periodoDias={periodo} />
              )}
              {dados && <TextoProjecao dados={dados} />}
              {dados?.ritmo && (
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: dados.ritmo.pctPorSemana > LIMITE_RITMO_PCT ? '700' : '400',
                    color: dados.ritmo.pctPorSemana > LIMITE_RITMO_PCT ? cores.laranja : cores.cinza,
                  }}
                >
                  {dados.ritmo.kgPorSemana > 0
                    ? `Ritmo real nas últimas 2 semanas: −${decimal(dados.ritmo.kgPorSemana, 2)} kg por semana (${decimal(dados.ritmo.pctPorSemana)}% do peso).`
                    : `Peso estável ou subindo nas últimas 2 semanas (${dados.ritmo.kgPorSemana === 0 ? '0' : '+' + decimal(Math.abs(dados.ritmo.kgPorSemana), 2)} kg por semana).`}
                  {dados.ritmo.pctPorSemana > LIMITE_RITMO_PCT ? ' Acima de 1% por semana costuma levar massa magra junto: vale reduzir o déficit.' : ''}
                </Text>
              )}
            </Cartao>
            <CartoesSinais a={analises} />
            <CartaoMedidas medidas={dados?.medidas ?? null} relacaoCintura={dados?.relacaoCintura ?? null} temAltura={!!dados?.perfil.height_cm} />
            <CartaoGordura a={analises} />
          </>
        )}

        {aba === 'calorias' && (
          <>
            <CartaoCalorias dados={dados} />
            <CartaoQualidadeDieta a={analises} metaProteina={dados?.metaProteina ?? null} />
            <Cartao estilo={{ gap: 6 }}>
              <CabecalhoCartao titulo="Previsto × real" info={EXPLICACOES.previstoReal} />
              <Text style={{ fontSize: 14, lineHeight: 20, color: cores.tinta }}>{textoPrevistoReal(dados)}</Text>
            </Cartao>
          </>
        )}

        {aba === 'habitos' && (
          <>
            <Cartao estilo={{ gap: 0, paddingVertical: 4 }}>
              <View style={{ paddingTop: 12, paddingBottom: 2 }}>
                <Rotulo>Semana · 7 dias completos (até ontem)</Rotulo>
              </View>
              <LinhaResumo
                titulo="Treinos"
                valor={dados ? `${dados.treinosSemana.quantidade}${dados.treinosSemana.kcal ? ` · ${milhar(dados.treinosSemana.kcal)} kcal` : ''}` : '—'}
              />
              <LinhaResumo titulo="Água (média/dia)" valor={dados ? `${decimal(dados.aguaMediaMl / 1000)} L` : '—'} />
              <LinhaResumo titulo="Sono (média/noite)" valor={sono.mediaMin != null ? formatarDuracao(sono.mediaMin) : '—'} ultima />
            </Cartao>

            <Cartao estilo={{ gap: 8 }}>
              <CabecalhoCartao titulo="Treinos por semana" info={EXPLICACOES.treinos} />
              <GraficoSemanas
                semanas={(dados?.tendencias ?? []).map((t) => ({ semana: t.semana, valor: t.treinos }))}
                formatar={(v) => String(v)}
                meta={{ valor: 3, texto: 'meta 3' }}
                rotulo="Treinos por semana"
                vazio="Os treinos do Hevy, do relógio e as atividades feitas aparecem aqui."
              />
              {dados && dados.tendencias.some((t) => t.treinos > 0) && (
                <Nota>{dados.tendencias.slice(0, -1).filter((t) => t.treinos >= 3).length} das últimas 7 semanas completas com 3 treinos ou mais.</Nota>
              )}
            </Cartao>

            <Cartao estilo={{ gap: 12 }}>
              <CabecalhoCartao
                titulo="Sono · últimas 7 noites"
                info={EXPLICACOES.sono}
                direita={<Text style={{ fontSize: 13, color: cores.cinza }}>{sono.mediaMin != null ? `média ${formatarDuracao(sono.mediaMin)}` : ''}</Text>}
              />
              <GraficoSono noites={noites} />
            </Cartao>

            <Cartao estilo={{ gap: 12 }}>
              <CabecalhoCartao
                titulo="Check-in · 7 dias"
                info={EXPLICACOES.checkin}
                direita={
                  <Text style={{ fontSize: 12, color: cores.cinza }}>
                    {checkins.length ? `energia ${decimal(mediaCampo(checkins, 'energia') ?? 0)} · fome ${decimal(mediaCampo(checkins, 'fome') ?? 0)}` : ''}
                  </Text>
                }
              />
              <GradeCheckins checkins={checkins} />
            </Cartao>

            <Cartao estilo={{ gap: 8 }}>
              <CabecalhoCartao titulo="Passos por dia · 8 semanas" info={EXPLICACOES.passos} />
              <GraficoSemanas
                semanas={(dados?.tendencias ?? []).map((t) => ({ semana: t.semana, valor: t.passos }))}
                formatar={(v) => (v >= 1000 ? `${decimal(v / 1000)} mil` : String(v))}
                cor={cores.azul}
                rotulo="Média de passos por dia, por semana"
                vazio="Os passos do relógio aparecem aqui."
              />
            </Cartao>

            <Cartao estilo={{ gap: 8 }}>
              <CabecalhoCartao titulo="FC de repouso · 8 semanas" info={EXPLICACOES.fc} />
              <GraficoSemanas
                semanas={(dados?.tendencias ?? []).map((t) => ({ semana: t.semana, valor: t.fcRepouso }))}
                formatar={(v) => `${v}`}
                cor={cores.laranja}
                rotulo="Frequência cardíaca de repouso média, por semana"
                vazio="A frequência de repouso aparece quando o relógio enviar medições de frequência cardíaca."
              />
            </Cartao>
          </>
        )}
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

const NOMES_DIA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const rotuloDia = (dia: string) => {
  const [a, m, d] = dia.split('-').map(Number);
  return `${NOMES_DIA[new Date(a, m - 1, d).getDay()]} ${d}`;
};

/** Os 7 dias completos em tabela: o que comeu, o que gastou e o saldo de cada um. */
function CartaoCalorias({ dados }: { dados: DadosProgresso | null }) {
  const dias = dados ? [...dados.ultimos7].reverse() : [];
  const comDieta = dias.filter((d) => d.deficit != null);
  const total = comDieta.reduce((s, d) => s + (d.deficit as number), 0);
  const algumEstimado = dias.some((d) => d.gastoEstimado && d.gasto != null);
  const col = { width: 58, textAlign: 'right' as const, fontVariant: ['tabular-nums' as const] };

  return (
    <Cartao estilo={{ gap: 12 }}>
      <View style={{ gap: 2 }}>
        <CabecalhoCartao titulo="Calorias · 7 dias completos" info={EXPLICACOES.calorias} />
        <Text style={{ fontSize: 26, fontWeight: '800', color: cores.tinta, fontVariant: ['tabular-nums'] }}>
          {comDieta.length ? `${milhar(Math.abs(total))} kcal de ${total >= 0 ? 'déficit' : 'superávit'}` : '—'}
        </Text>
        <Text style={{ fontSize: 13, color: cores.cinza }}>
          {comDieta.length
            ? `soma dos ${comDieta.length} dia${comDieta.length === 1 ? '' : 's'} com dieta registrada${total > 0 ? ` · ≈ ${decimal(total / 7700, 2)} kg de gordura` : ''}`
            : 'nenhum dia com dieta registrada na semana'}
        </Text>
      </View>

      <View>
        <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: cores.linha }}>
          <Text style={{ flex: 1, fontSize: 12, fontWeight: '700', color: cores.cinza }}>Dia</Text>
          <Text style={[col, { fontSize: 12, fontWeight: '700', color: cores.cinza }]}>Comeu</Text>
          <Text style={[col, { fontSize: 12, fontWeight: '700', color: cores.cinza }]}>Gastou</Text>
          <Text style={[col, { width: 72, fontSize: 12, fontWeight: '700', color: cores.cinza }]}>Saldo</Text>
        </View>
        {dias.map((d) => {
          const def = d.deficit;
          return (
            <View key={d.dia} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, borderBottomWidth: 1, borderBottomColor: cores.linhaSuave }}>
                <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: cores.tinta }} numberOfLines={1}>{rotuloDia(d.dia)}</Text>
                <Text style={[col, { fontSize: 14, color: d.consumo == null ? cores.cinza : cores.tinta }]}>{d.consumo == null ? '—' : milhar(d.consumo)}</Text>
                <Text style={[col, { fontSize: 14, color: cores.tinta }]}>
                  {d.gasto == null ? '—' : `${milhar(d.gasto)}${d.gastoEstimado ? '*' : ''}`}
                </Text>
                <View style={{ width: 72, alignItems: 'flex-end' }}>
                  {def == null ? (
                    <Text style={{ fontSize: 12, color: cores.cinza }}>sem dieta</Text>
                  ) : (
                    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: def >= 0 ? cores.verdeClaro : cores.laranjaClaro }}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: def >= 0 ? cores.verdeEscuro : cores.laranjaTexto, fontVariant: ['tabular-nums'] }}>
                        {def >= 0 ? '−' : '+'}
                        {milhar(Math.abs(def))}
                      </Text>
                    </View>
                  )}
                </View>
            </View>
          );
        })}
      </View>

      <Nota>
        Verde (−) = déficit · laranja (+) = superávit{algumEstimado ? ' · * = gasto estimado (sem dados do relógio)' : ''}. Toque no ? para ver como cada número é calculado.
      </Nota>
    </Cartao>
  );
}
