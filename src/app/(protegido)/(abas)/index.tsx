import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CartaoCheckin, CartaoSono } from '@/components/bemestar';
import { Botao, Cabecalho, Cartao, Nota, Pilula, Rotulo, estilos } from '@/components/ui';
import { alertaDeficitAgressivo, resumirSono, type CheckIn, type Noite } from '@/lib/bemestar';
import { carregarCheckins, carregarNoites, salvarCheckin } from '@/lib/bemestar-dados';
import { carregarResumoDoDia, registrarAgua, type ResumoDoDia } from '@/lib/dados';
import { dataPorExtenso, decimal, diaCurto, diaLocal, milhar } from '@/lib/datas';
import { nomeDoApp, sincronizar, sincronizarSeLiberado } from '@/lib/healthconnect';
import { cores } from '@/lib/tema';

export default function Hoje() {
  const [resumo, setResumo] = useState<ResumoDoDia | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [salvandoAgua, setSalvandoAgua] = useState(false);
  const [noites, setNoites] = useState<Noite[]>([]);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);

  const carregar = useCallback(async () => {
    try {
      setErro(null);
      const [r, n, c] = await Promise.all([carregarResumoDoDia(), carregarNoites(7), carregarCheckins(3)]);
      setResumo(r);
      setNoites(n);
      setCheckins(c);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar os dados.');
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
      // se o Health Connect estiver liberado e a última leitura for antiga, atualiza e recarrega
      sincronizarSeLiberado()
        .then((r) => r && carregar())
        .catch(() => {});
    }, [carregar]),
  );

  async function atualizar() {
    setAtualizando(true);
    if (Platform.OS === 'android') await sincronizar().catch(() => null);
    await carregar();
    setAtualizando(false);
  }

  async function adicionarAgua() {
    if (!resumo) return;
    setSalvandoAgua(true);
    setResumo({ ...resumo, aguaMl: resumo.aguaMl + 250 }); // resposta imediata na tela
    try {
      await registrarAgua(250);
    } catch {
      setResumo((r) => (r ? { ...r, aguaMl: r.aguaMl - 250 } : r));
      setErro('Não foi possível salvar a água. Tente de novo.');
    } finally {
      setSalvandoAgua(false);
    }
  }

  async function mudarCheckin(campo: 'energia' | 'fome' | 'humor', valor: number) {
    const hoje = diaLocal();
    const anterior = checkins;
    const atual = checkins.find((c) => c.dia === hoje) ?? { dia: hoje, energia: null, fome: null, humor: null };
    setCheckins([...checkins.filter((c) => c.dia !== hoje), { ...atual, [campo]: valor }]);
    try {
      await salvarCheckin(hoje, { [campo]: valor });
    } catch {
      setCheckins(anterior);
      setErro('Não foi possível salvar o check-in.');
    }
  }

  const nome = resumo?.perfil.display_name?.split(' ')[0];
  const checkinHoje = checkins.find((c) => c.dia === diaLocal()) ?? null;

  return (
    <SafeAreaView style={estilos.tela} edges={['top']}>
      <ScrollView
        contentContainerStyle={estilos.conteudo}
        refreshControl={<RefreshControl refreshing={atualizando} onRefresh={atualizar} tintColor={cores.verde} />}
      >
        <Cabecalho sobre={dataPorExtenso()} titulo={nome ? `Olá, ${nome}` : 'Hoje'} />

        {erro && (
          <Cartao estilo={{ backgroundColor: cores.laranjaClaro }}>
            <Text style={{ color: '#5C3410', fontSize: 14 }}>{erro}</Text>
          </Cartao>
        )}

        {resumo && !resumo.perfilCompleto && (
          <Link href="/fontes" asChild>
            <Pressable accessibilityRole="link" style={StyleSheet.flatten([estilos.cartao, { backgroundColor: cores.verdeClaro }])}>
              <Rotulo>Complete seu perfil</Rotulo>
              <Text style={{ fontSize: 14, color: cores.tintaSuave }}>
                Sexo, data de nascimento e altura são necessários para calcular seu gasto calórico.
              </Text>
            </Pressable>
          </Link>
        )}

        {resumo && <CartaoBalanco resumo={resumo} />}

        {resumo && (
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Cartao estilo={{ flex: 1 }}>
              <Rotulo>Água</Rotulo>
              <Text style={estilos.numero} numberOfLines={1} adjustsFontSizeToFit>
                {decimal(resumo.aguaMl / 1000, resumo.aguaMl % 1000 === 0 ? 0 : resumo.aguaMl % 100 === 0 ? 1 : 2)} L
                <Text style={estilos.unidade}> / {decimal(resumo.perfil.water_goal_ml / 1000, 0)} L</Text>
              </Text>
              <Barra fracao={resumo.aguaMl / resumo.perfil.water_goal_ml} cor={cores.azul} trilho={cores.azulClaro} />
              <Botao titulo="+ 250 ml" variante="agua" aoTocar={adicionarAgua} desativado={salvandoAgua} rotuloAcessivel="Adicionar 250 ml de água" />
            </Cartao>
            <Cartao estilo={{ flex: 1 }}>
              <Rotulo>Peso</Rotulo>
              <Text style={estilos.numero} numberOfLines={1} adjustsFontSizeToFit>
                {resumo.pesoAtual != null ? decimal(resumo.pesoAtual) : '—'}
                <Text style={estilos.unidade}> kg</Text>
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: cores.verde }}>
                {resumo.variacaoSemanaKg == null
                  ? 'sem histórico ainda'
                  : resumo.variacaoSemanaKg <= 0
                    ? `↓ ${decimal(Math.abs(resumo.variacaoSemanaKg))} kg na semana`
                    : `↑ ${decimal(resumo.variacaoSemanaKg)} kg na semana`}
              </Text>
              <Link href="/registrar" asChild>
                <Pressable accessibilityRole="link" style={StyleSheet.flatten([estilos.botao, { backgroundColor: cores.verdeClaro }])}>
                  <Text style={[estilos.botaoTexto, { color: cores.verdeEscuro }]}>Registrar</Text>
                </Pressable>
              </Link>
            </Cartao>
          </View>
        )}

        {resumo && <CartaoCheckin checkin={checkinHoje} alerta={alertaDeficitAgressivo(checkins)} aoMudar={mudarCheckin} />}
        {resumo && <CartaoSono ultima={noites.at(-1) ?? null} resumo={resumirSono(noites)} />}
        {resumo && <CartaoTreino resumo={resumo} />}
        {resumo && <CartaoRelogio resumo={resumo} />}
        {resumo && <CartaoProjecao resumo={resumo} />}
      </ScrollView>
    </SafeAreaView>
  );
}

function Barra({ fracao, cor, trilho }: { fracao: number; cor: string; trilho: string }) {
  const pct = `${Math.max(0, Math.min(1, fracao)) * 100}%` as const;
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: trilho }}>
      <View style={{ width: pct, height: 8, borderRadius: 4, backgroundColor: cor }} />
    </View>
  );
}

function CartaoBalanco({ resumo }: { resumo: ResumoDoDia }) {
  const { gasto, consumoKcal, deficitHoje } = resumo;
  const maior = Math.max(gasto?.kcal ?? 0, consumoKcal ?? 0, 1);
  return (
    <View style={{ backgroundColor: cores.tinta, borderRadius: 22, padding: 20, gap: 16 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: cores.escuroSuave }}>Balanço do dia</Text>
        <Text style={{ fontSize: 36, fontWeight: '800', color: '#FFFFFF', fontVariant: ['tabular-nums'] }}>
          {deficitHoje == null ? '—' : `${deficitHoje >= 0 ? '−' : '+'}${milhar(Math.abs(deficitHoje))} kcal`}
        </Text>
        <Text style={{ fontSize: 13, color: cores.escuroSuave }}>
          {deficitHoje == null
            ? consumoKcal == null
              ? 'aguardando a dieta (FatSecret via Health Connect)'
              : 'complete o perfil e registre o peso'
            : deficitHoje >= 0
              ? `déficit até agora · ≈ ${Math.round((deficitHoje / 7700) * 1000)} g de gordura`
              : 'superávit até agora'}
        </Text>
      </View>
      <View style={{ gap: 10 }}>
        <LinhaBalanco titulo="Consumido · dieta" valor={consumoKcal} fracao={(consumoKcal ?? 0) / maior} cor={cores.laranjaVivo} />
        <LinhaBalanco
          titulo={gasto?.origem === 'estimativa' ? 'Gasto · estimado' : 'Gasto · relógio + metabolismo'}
          valor={gasto?.kcal ?? null}
          fracao={(gasto?.kcal ?? 0) / maior}
          cor={cores.verdeVivo}
        />
      </View>
    </View>
  );
}

function LinhaBalanco({ titulo, valor, fracao, cor }: { titulo: string; valor: number | null; fracao: number; cor: string }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#FFFFFF' }}>{titulo}</Text>
        <Text style={{ fontSize: 13, color: '#FFFFFF', fontVariant: ['tabular-nums'] }}>{valor == null ? '—' : `${milhar(valor)} kcal`}</Text>
      </View>
      <Barra fracao={fracao} cor={cor} trilho={cores.escuroTrilho} />
    </View>
  );
}

function CartaoTreino({ resumo }: { resumo: ResumoDoDia }) {
  const treino = resumo.treinos.at(-1);
  return (
    <Cartao estilo={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: cores.cinza }}>
          Treino de hoje{treino?.origin_app ? ` · ${nomeDoApp(treino.origin_app)}` : ''}
        </Text>
        {treino ? (
          <>
            <Text style={{ fontSize: 16, fontWeight: '700', color: cores.tinta }}>{treino.title ?? 'Treino'}</Text>
            <Nota>
              {[
                treino.ended_at ? `${Math.round((Date.parse(treino.ended_at) - Date.parse(treino.started_at)) / 60000)} min` : null,
                treino.active_kcal != null ? `${milhar(treino.active_kcal)} kcal` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Nota>
          </>
        ) : (
          <Nota>Nenhum treino importado hoje.</Nota>
        )}
      </View>
      {treino && <Pilula texto="Feito" />}
    </Cartao>
  );
}

function CartaoRelogio({ resumo }: { resumo: ResumoDoDia }) {
  const a = resumo.atividade;
  const sono = a?.sleep_minutes != null ? `${Math.floor(a.sleep_minutes / 60)}h${String(a.sleep_minutes % 60).padStart(2, '0')}` : '—';
  return (
    <Cartao>
      <Rotulo>Relógio</Rotulo>
      {a ? (
        <View style={{ flexDirection: 'row' }}>
          <Indicador valor={a.steps != null ? milhar(a.steps) : '—'} legenda="passos" />
          <Indicador valor={sono} legenda="de sono" />
          <Indicador valor={a.resting_hr != null ? String(a.resting_hr) : '—'} legenda="bpm em repouso" />
        </View>
      ) : (
        <Nota>Sem dados do relógio hoje. Conecte o Health Connect na aba Mais e sincronize o relógio pelo app dele.</Nota>
      )}
    </Cartao>
  );
}

function Indicador({ valor, legenda }: { valor: string; legenda: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={{ fontSize: 20, fontWeight: '800', color: cores.tinta, fontVariant: ['tabular-nums'] }}>{valor}</Text>
      <Text style={{ fontSize: 12, color: cores.cinza }}>{legenda}</Text>
    </View>
  );
}

function CartaoProjecao({ resumo }: { resumo: ResumoDoDia }) {
  const p = resumo.projecao;
  let titulo = 'Projeção ainda indisponível';
  let detalhe = 'Precisa de meta de peso, pesagens e alguns dias de dieta registrados.';
  if (p?.estado === 'atingida') {
    titulo = 'Meta atingida';
    detalhe = 'Defina uma nova meta no perfil.';
  } else if (p?.estado === 'sem_deficit') {
    titulo = 'Sem déficit nos últimos dias';
    detalhe = 'No ritmo atual, o peso não deve cair.';
  } else if (p?.estado === 'no_caminho') {
    const semanas = Math.max(1, Math.round(p.dias / 7));
    titulo = `No ritmo atual, ${decimal(resumo.perfil.goal_weight_kg ?? 0, 0)} kg em ~${semanas} semana${semanas > 1 ? 's' : ''}`;
    detalhe = `previsão: ${diaCurto(p.data)} · ${decimal(p.kgPorSemana, 2)} kg por semana`;
  }
  return (
    <Link href="/progresso" asChild>
      <Pressable accessibilityRole="link" style={StyleSheet.flatten([estilos.cartao, { backgroundColor: cores.verdeClaro, gap: 2 }])}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: cores.verdeEscuro }}>Projeção</Text>
        <Text style={{ fontSize: 15, fontWeight: '700', color: cores.tinta }}>{titulo}</Text>
        <Text style={{ fontSize: 13, color: cores.tintaSuave }}>{detalhe}</Text>
      </Pressable>
    </Link>
  );
}
