import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CartaoCheckin, CartaoSono } from '@/components/bemestar';
import { Botao, Cabecalho, Cartao, Nota, Pilula, Rotulo, estilos } from '@/components/ui';
import { alertaDeficitAgressivo, resumirSono, type CheckIn, type Noite } from '@/lib/bemestar';
import { carregarCheckins, carregarNoites, salvarCheckin } from '@/lib/bemestar-dados';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { LIMITE_RITMO_PCT } from '@/lib/calculos';
import { apagarAgua, carregarResumoDoDia, registrarAgua, type ResumoDoDia } from '@/lib/dados';
import { CartaoAtividadesDoDia } from '@/components/atividades';
import { dataPorExtenso, decimal, diaCurto, diaLocal, milhar } from '@/lib/datas';
import { lerEstado, nomeDoApp, sincronizar, sincronizarSeLiberado, type EstadoSync } from '@/lib/healthconnect';
import { cores } from '@/lib/tema';

export default function Hoje() {
  const [resumo, setResumo] = useState<ResumoDoDia | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [atualizando, setAtualizando] = useState(false);
  const [salvandoAgua, setSalvandoAgua] = useState(false);
  const [noites, setNoites] = useState<Noite[]>([]);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [ultimaAgua, setUltimaAgua] = useState<{ id: number; ml: number } | null>(null);
  const [sync, setSync] = useState<EstadoSync | null>(null);

  const carregar = useCallback(async () => {
    try {
      setErro(null);
      const [r, n, c, e] = await Promise.all([carregarResumoDoDia(), carregarNoites(7), carregarCheckins(3), lerEstado()]);
      setResumo(r);
      setNoites(n);
      setCheckins(c);
      setSync(e);
      // Primeiro acesso: sem perfil, vai para o passo a passo (uma vez só).
      if (!r.perfilCompleto) {
        const visto = await AsyncStorage.getItem('boas-vindas:visto').catch(() => '1');
        if (!visto) router.replace('/boas-vindas');
      }
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
      const id = await registrarAgua(250);
      setUltimaAgua(id != null ? { id, ml: 250 } : null);
    } catch {
      setResumo((r) => (r ? { ...r, aguaMl: r.aguaMl - 250 } : r));
      setErro('Não foi possível salvar a água. Tente de novo.');
    } finally {
      setSalvandoAgua(false);
    }
  }

  async function desfazerAgua() {
    if (!ultimaAgua || !resumo) return;
    const { id, ml } = ultimaAgua;
    setUltimaAgua(null);
    setResumo({ ...resumo, aguaMl: Math.max(0, resumo.aguaMl - ml) });
    try {
      await apagarAgua(id);
    } catch {
      setErro('Não foi possível desfazer.');
      carregar();
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
            <Text style={{ color: cores.laranjaTexto, fontSize: 14 }}>{erro}</Text>
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
        {resumo && <CartaoProteina resumo={resumo} />}

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
              {ultimaAgua && (
                <Pressable accessibilityRole="button" onPress={desfazerAgua} style={{ minHeight: 32, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: cores.azulEscuro }}>Desfazer</Text>
                </Pressable>
              )}
            </Cartao>
            <Cartao estilo={{ flex: 1 }}>
              <Rotulo>Peso</Rotulo>
              <Text style={estilos.numero} numberOfLines={1} adjustsFontSizeToFit>
                {resumo.pesoAtual != null ? decimal(resumo.pesoAtual) : '—'}
                <Text style={estilos.unidade}> kg</Text>
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: cores.verdeTexto }}>
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
        <CartaoAtividadesDoDia dia={diaLocal()} ocultarSeVazio />
        {resumo && <CartaoTreino resumo={resumo} />}
        {resumo && <CartaoRelogio resumo={resumo} sync={sync} />}
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

const kcal = (n: number) => `${milhar(Math.abs(n))} kcal`;
const arred50 = (n: number) => Math.round(n / 50) * 50;

/** Texto do balanço sem sinal: "405 kcal de déficit" / "120 kcal de superávit". */
const textoBalanco = (d: number) => `${kcal(d)} de ${d >= 0 ? 'déficit' : 'superávit'}`;

function CartaoBalanco({ resumo }: { resumo: ResumoDoDia }) {
  const { gasto, consumoKcal, deficitHoje, plano } = resumo;
  const maior = Math.max(gasto?.kcal ?? 0, consumoKcal ?? 0, 1);

  // Destaque: quanto ainda dá para comer hoje (é a pergunta de quem abre o app).
  let destaque: string;
  let legenda: string;
  if (!plano) {
    destaque = '—';
    legenda = 'Complete o perfil e registre o peso para ver quanto ainda dá para comer hoje.';
  } else if (plano.podeComer > 0) {
    destaque = `~${milhar(Math.max(50, arred50(plano.podeComer)))} kcal`;
    legenda = `ainda dá para comer hoje e fechar o dia com cerca de ${kcal(plano.metaDeficit)} de déficit`;
  } else if (plano.deficitSeParar > 0) {
    destaque = 'Meta do dia feita';
    legenda = `se não comer mais nada, o dia fecha com ~${kcal(arred50(plano.deficitSeParar))} de déficit (meta: ${kcal(plano.metaDeficit)})`;
  } else {
    destaque = 'Acima do gasto';
    legenda = `o dia caminha para ~${kcal(arred50(-plano.deficitSeParar))} de superávit`;
  }
  const avisoExcesso = plano && resumo.tarde && plano.podeComer > 0 && plano.deficitExcessivo;

  return (
    <View style={{ backgroundColor: cores.painel, borderRadius: 22, padding: 20, gap: 16 }}>
      <View style={{ gap: 4 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: cores.escuroSuave }}>Calorias de hoje</Text>
          {plano && (
            <View style={{ backgroundColor: cores.escuroTrilho, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: cores.escuroSuave }}>meta: {kcal(plano.metaDeficit)} de déficit</Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 34, fontWeight: '800', color: '#FFFFFF', fontVariant: ['tabular-nums'] }} numberOfLines={1} adjustsFontSizeToFit>
          {destaque}
        </Text>
        <Text style={{ fontSize: 13, color: cores.escuroSuave, lineHeight: 18 }}>{legenda}</Text>
        {plano && consumoKcal == null && (
          <Text style={{ fontSize: 12, color: cores.escuroSuave, lineHeight: 17 }}>Nenhuma refeição chegou hoje ainda: a conta considera que nada foi comido.</Text>
        )}
      </View>

      {avisoExcesso && (
        <View style={{ backgroundColor: '#3A2A1C', borderRadius: 12, padding: 12 }}>
          <Text style={{ fontSize: 13, color: cores.laranjaVivo, lineHeight: 18, fontWeight: '600' }}>
            Se parar de comer agora, o dia fecha com ~{kcal(arred50(plano.deficitSeParar))} de déficit. Déficit grande demais tira energia e massa muscular: faça as próximas refeições normalmente.
          </Text>
        </View>
      )}

      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <Text style={{ fontSize: 13, color: cores.escuroSuave, flexShrink: 1 }}>Até agora ({resumo.horaParcial})</Text>
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF', fontVariant: ['tabular-nums'] }}>
            {deficitHoje == null ? (consumoKcal == null ? 'aguardando a dieta' : '—') : textoBalanco(deficitHoje)}
          </Text>
        </View>
        <LinhaBalanco titulo="Consumido · dieta" valor={consumoKcal} fracao={(consumoKcal ?? 0) / maior} cor={cores.laranjaVivo} />
        <LinhaBalanco
          titulo={gasto?.origem === 'estimativa' ? 'Gasto até agora · estimado' : 'Gasto até agora'}
          valor={gasto?.kcal ?? null}
          fracao={(gasto?.kcal ?? 0) / maior}
          cor={cores.verdeVivo}
        />
      </View>
      <View style={{ borderTopWidth: 1, borderTopColor: cores.escuroTrilho, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Text style={{ fontSize: 13, color: cores.escuroSuave, flexShrink: 1 }}>Ontem (dia completo)</Text>
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF', fontVariant: ['tabular-nums'] }}>
          {resumo.ontem.deficit == null ? '—' : textoBalanco(resumo.ontem.deficit)}
        </Text>
      </View>
    </View>
  );
}

function CartaoProteina({ resumo }: { resumo: ResumoDoDia }) {
  const m = resumo.macros;
  const meta = resumo.metaProteina;
  if (!m || m.proteina == null) {
    return (
      <Cartao estilo={{ gap: 4 }}>
        <Rotulo>Proteína</Rotulo>
        <Nota>
          {meta
            ? `Sua meta em déficit: ${meta.min} a ${meta.max} g por dia. O consumo aparece aqui quando a dieta chegar do FatSecret.`
            : 'A meta de proteína aparece depois da primeira pesagem.'}
        </Nota>
      </Cartao>
    );
  }
  const atingiu = meta ? m.proteina >= meta.min : false;
  return (
    <Cartao estilo={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <Rotulo>Proteína</Rotulo>
        <Text style={{ fontSize: 13, color: cores.cinza }}>{meta ? `meta ${meta.min}–${meta.max} g` : ''}</Text>
      </View>
      <Text style={estilos.numero}>
        {Math.round(m.proteina)} g
        {meta && <Text style={estilos.unidade}> {atingiu ? '· meta atingida' : `· faltam ${meta.min - Math.round(m.proteina)} g`}</Text>}
      </Text>
      {meta && <Barra fracao={m.proteina / meta.min} cor={atingiu ? cores.verde : cores.laranja} trilho={cores.linhaSuave} />}
      <Nota>
        {[m.carbo != null ? `carboidrato ${Math.round(m.carbo)} g` : null, m.gordura != null ? `gordura ${Math.round(m.gordura)} g` : null]
          .filter(Boolean)
          .join(' · ') || 'Em déficit, proteína suficiente ajuda a perder gordura e não músculo.'}
      </Nota>
    </Cartao>
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
  const treinos = resumo.treinos;
  return (
    <Cartao estilo={{ gap: 6 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: cores.cinza }}>{treinos.length > 1 ? `Treinos de hoje · ${treinos.length}` : 'Treino de hoje'}</Text>
      {treinos.length === 0 && <Nota>Nenhum treino importado hoje.</Nota>}
      {treinos.map((t, i) => (
        <View key={`${t.started_at}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: cores.tinta }}>{t.title ?? 'Treino'}</Text>
            <Nota>
              {[
                t.origin_app ? nomeDoApp(t.origin_app) : null,
                t.ended_at ? `${Math.round((Date.parse(t.ended_at) - Date.parse(t.started_at)) / 60000)} min` : null,
                t.kcal ? `${t.kcal.estimado ? '≈ ' : ''}${milhar(t.kcal.kcal)} kcal${t.kcal.estimado ? ' (estimativa)' : ''}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Nota>
          </View>
          <Pilula texto="Feito" />
        </View>
      ))}
    </Cartao>
  );
}

function haQuanto(iso: string): string {
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (min < 2) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `há ${h} h` : `há ${Math.round(h / 24)} d`;
}

function CartaoRelogio({ resumo, sync }: { resumo: ResumoDoDia; sync: EstadoSync | null }) {
  const a = resumo.atividade;
  const sono = a?.sleep_minutes != null ? `${Math.floor(a.sleep_minutes / 60)}h${String(a.sleep_minutes % 60).padStart(2, '0')}` : '—';
  const ultimo = sync?.ultimoDadoRelogio;
  const atrasado = ultimo ? Date.now() - Date.parse(ultimo) > 3 * 3600_000 : false;
  return (
    <Cartao>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <Rotulo>Relógio</Rotulo>
        {ultimo && (
          <Text style={{ fontSize: 12, fontWeight: atrasado ? '700' : '400', color: atrasado ? cores.laranja : cores.cinza, flexShrink: 1, textAlign: 'right' }}>
            último dado {haQuanto(ultimo)}
          </Text>
        )}
      </View>
      {a ? (
        <View style={{ flexDirection: 'row' }}>
          <Indicador valor={a.steps != null ? milhar(a.steps) : '—'} legenda="passos" />
          <Indicador valor={sono} legenda="de sono" />
          <Indicador valor={a.resting_hr != null ? String(a.resting_hr) : '—'} legenda="bpm em repouso" />
        </View>
      ) : (
        <Nota>Sem dados do relógio hoje. Conecte o Health Connect na aba Mais e sincronize o relógio pelo app dele.</Nota>
      )}
      {atrasado && <Nota>Os números podem estar desatualizados: abra o app do relógio para ele enviar os dados ao Health Connect.</Nota>}
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
    titulo = `${decimal(resumo.perfil.goal_weight_kg ?? 0, 0)} kg entre ${diaCurto(p.dataCedo)} e ${diaCurto(p.dataTarde)}`;
    detalhe = `no ritmo médio, por volta de ${diaCurto(p.data)} · ${decimal(p.kgPorSemana, 2)} kg por semana pelas calorias`;
  }
  const rapido = resumo.ritmo && resumo.ritmo.pctPorSemana > LIMITE_RITMO_PCT;
  return (
    <Link href="/progresso" asChild>
      <Pressable accessibilityRole="link" style={StyleSheet.flatten([estilos.cartao, { backgroundColor: cores.verdeClaro, gap: 2 }])}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: cores.verdeEscuro }}>Projeção</Text>
        <Text style={{ fontSize: 15, fontWeight: '700', color: cores.tinta }}>{titulo}</Text>
        <Text style={{ fontSize: 13, color: cores.tintaSuave }}>{detalhe}</Text>
        {rapido && (
          <Text style={{ fontSize: 13, fontWeight: '700', color: cores.laranja, marginTop: 4 }}>
            Perdendo {decimal(resumo.ritmo!.pctPorSemana)}% do peso por semana: acima de 1% costuma levar massa magra junto.
          </Text>
        )}
      </Pressable>
    </Link>
  );
}
