import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Botao, Cabecalho, Campo, Cartao, LinhaCampos, Nota, Rotulo, SeletorDia, estilos } from '@/components/ui';
import { mediaMovel } from '@/lib/calculos';
import { carregarPesagens, carregarRegistrosDoDia, registrarAgua, registrarCorpo } from '@/lib/dados';
import { decimal, diaLocal } from '@/lib/datas';
import { cores } from '@/lib/tema';

/** Lê "88,4" ou "88.4" como número; vazio vira null. */
function lerNumero(texto: string): number | null {
  const t = texto.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

const paraTexto = (n: number | null | undefined) => (n == null ? '' : decimal(n, Number.isInteger(n) ? 0 : 1));

export default function Registrar() {
  const [dia, setDia] = useState(diaLocal());
  const [peso, setPeso] = useState(''); // texto: a pessoa pode digitar direto
  const [referencia, setReferencia] = useState<{ ultimo: number | null; media: number | null }>({ ultimo: null, media: null });
  const [jaTinha, setJaTinha] = useState(false);
  const [cintura, setCintura] = useState('');
  const [quadril, setQuadril] = useState('');
  const [gordura, setGordura] = useState('');
  const [aguaSessao, setAguaSessao] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'erro' | 'ok'; texto: string } | null>(null);

  const carregarDia = useCallback(async (d: string) => {
    setMensagem(null);
    setAguaSessao(0);
    try {
      const [pesagens, registros] = await Promise.all([carregarPesagens(30), carregarRegistrosDoDia(d)]);
      const anteriores = pesagens.filter((p) => p.dia < d);
      setReferencia({ ultimo: anteriores.at(-1)?.pesoKg ?? null, media: mediaMovel(anteriores).at(-1)?.pesoKg ?? null });
      const c = registros.corpo;
      setJaTinha(c?.pesoKg != null);
      // Sem pesagem no dia: começa do último peso (é só ajustar 0,1) ou vazio na primeira vez.
      setPeso(paraTexto(c?.pesoKg ?? anteriores.at(-1)?.pesoKg ?? null));
      setCintura(paraTexto(c?.cinturaCm));
      setQuadril(paraTexto(c?.quadrilCm));
      setGordura(paraTexto(c?.gorduraPct));
    } catch (e) {
      setMensagem({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Erro ao carregar.' });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregarDia(dia);
    }, [carregarDia, dia]),
  );

  async function adicionarAgua(ml: number) {
    setMensagem(null);
    setAguaSessao((a) => a + ml);
    try {
      await registrarAgua(ml, dia);
    } catch {
      setAguaSessao((a) => a - ml);
      setMensagem({ tipo: 'erro', texto: 'Não foi possível salvar a água.' });
    }
  }

  function ajustar(delta: number) {
    const atual = lerNumero(peso);
    const base = atual == null || Number.isNaN(atual) ? (referencia.ultimo ?? 70) : atual;
    setPeso(decimal(Math.max(20, Math.min(400, Math.round((base + delta) * 10) / 10))));
  }

  async function salvar() {
    setMensagem(null);
    const pesoKg = lerNumero(peso);
    const medidas = { cintura: lerNumero(cintura), quadril: lerNumero(quadril), gordura: lerNumero(gordura) };
    if (pesoKg != null && (Number.isNaN(pesoKg) || pesoKg < 20 || pesoKg > 400)) {
      setMensagem({ tipo: 'erro', texto: 'Peso em kg, como 88,6.' });
      return;
    }
    if (Object.values(medidas).some((v) => Number.isNaN(v))) {
      setMensagem({ tipo: 'erro', texto: 'Confira as medidas: use só números, como 92,5.' });
      return;
    }
    if (pesoKg == null && medidas.cintura == null && medidas.quadril == null && medidas.gordura == null) {
      setMensagem({ tipo: 'erro', texto: 'Digite o peso ou alguma medida.' });
      return;
    }
    setSalvando(true);
    try {
      await registrarCorpo({ dia, pesoKg, cinturaCm: medidas.cintura, quadrilCm: medidas.quadril, gorduraPct: medidas.gordura });
      setJaTinha(pesoKg != null);
      setMensagem({ tipo: 'ok', texto: 'Registro salvo. Projeção atualizada.' });
    } catch (e) {
      setMensagem({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Erro ao salvar.' });
    } finally {
      setSalvando(false);
    }
  }

  const ehHoje = dia === diaLocal();

  return (
    <SafeAreaView style={estilos.tela} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
          <Cabecalho sobre="Peso, medidas e água" titulo="Registrar" />

          <Cartao estilo={{ paddingVertical: 8 }}>
            <SeletorDia dia={dia} aoMudar={setDia} />
          </Cartao>

          <Cartao estilo={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Rotulo>Peso em jejum</Rotulo>
              {jaTinha && <Text style={{ fontSize: 12, fontWeight: '700', color: cores.verde }}>já registrado · editar</Text>}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <BotaoRedondo texto="−" rotulo="Diminuir 0,1 kg" aoTocar={() => ajustar(-0.1)} />
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', minWidth: 0 }}>
                <TextInput
                  accessibilityLabel="Peso em kg"
                  value={peso}
                  onChangeText={(t) => setPeso(t.replace(/[^\d,.]/g, '').slice(0, 5))}
                  keyboardType="decimal-pad"
                  placeholder="00,0"
                  placeholderTextColor={cores.linha}
                  selectTextOnFocus
                  style={{
                    minWidth: 120,
                    textAlign: 'center',
                    fontSize: 44,
                    fontWeight: '800',
                    color: cores.tinta,
                    paddingVertical: 4,
                    borderBottomWidth: 2,
                    borderBottomColor: cores.linha,
                    fontVariant: ['tabular-nums'],
                  }}
                />
                <Text style={{ fontSize: 18, fontWeight: '600', color: cores.cinza }}> kg</Text>
              </View>
              <BotaoRedondo texto="+" rotulo="Aumentar 0,1 kg" aoTocar={() => ajustar(0.1)} />
            </View>
            <Text style={{ fontSize: 12, color: cores.cinza, textAlign: 'center' }}>
              {referencia.ultimo != null
                ? `Toque no número para digitar · último: ${decimal(referencia.ultimo)} kg${referencia.media != null ? ` · média 7 dias: ${decimal(referencia.media)} kg` : ''}`
                : 'Toque no número e digite seu peso'}
            </Text>
          </Cartao>

          <Cartao estilo={{ gap: 12 }}>
            <Rotulo>
              Medidas <Text style={{ fontWeight: '500', color: cores.cinza }}>(opcional, 1× por semana)</Text>
            </Rotulo>
            <LinhaCampos>
              <Campo rotulo="Cintura (cm)" value={cintura} onChangeText={setCintura} keyboardType="decimal-pad" />
              <Campo rotulo="Quadril (cm)" value={quadril} onChangeText={setQuadril} keyboardType="decimal-pad" />
              <Campo rotulo="% gordura" value={gordura} onChangeText={setGordura} keyboardType="decimal-pad" />
            </LinhaCampos>
            <Nota>Meça a cintura na altura do umbigo, sem apertar a fita.</Nota>
          </Cartao>

          {mensagem && (
            <View
              accessibilityLiveRegion="polite"
              style={{ backgroundColor: mensagem.tipo === 'ok' ? cores.verdeClaro : cores.laranjaClaro, borderRadius: 14, padding: 14 }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', textAlign: 'center', color: mensagem.tipo === 'ok' ? cores.verdeEscuro : '#5C3410' }}>
                {mensagem.texto}
              </Text>
            </View>
          )}

          <Botao titulo={ehHoje ? 'Salvar peso e medidas' : 'Salvar neste dia'} aoTocar={salvar} ocupado={salvando} />

          <Cartao estilo={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Rotulo>Água{ehHoje ? '' : ' neste dia'}</Rotulo>
              {aguaSessao > 0 && <Text style={{ fontSize: 13, fontWeight: '700', color: cores.azulEscuro }}>+{aguaSessao} ml salvos</Text>}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Botao titulo="+ 250 ml" rotuloAcessivel="Adicionar um copo de 250 ml" variante="agua" aoTocar={() => adicionarAgua(250)} />
              </View>
              <View style={{ flex: 1 }}>
                <Botao titulo="+ 500 ml" variante="agua" aoTocar={() => adicionarAgua(500)} />
              </View>
              <View style={{ flex: 1 }}>
                <Botao titulo="+ 1 L" variante="agua" aoTocar={() => adicionarAgua(1000)} rotuloAcessivel="Adicionar garrafa de 1 litro" />
              </View>
            </View>
            <Nota>A água é salva na hora, sem precisar do botão de salvar.</Nota>
          </Cartao>

          <Atalho href={{ pathname: '/historico', params: { dia } }} titulo="Revisar e corrigir este dia" detalhe="apagar água, peso ou sono registrados errado" />
          <Atalho href="/sono" titulo="Sono da última noite" detalhe="que horas deitou e acordou" />

          <View style={{ backgroundColor: '#E7EAE4', borderRadius: 14, padding: 14 }}>
            <Nota>Treinos e refeições não precisam ser digitados: vêm do Hevy e do FatSecret pelo Health Connect.</Nota>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Atalho({ href, titulo, detalhe }: { href: Parameters<typeof Link>[0]['href']; titulo: string; detalhe: string }) {
  return (
    <Link href={href} asChild>
      <Pressable accessibilityRole="link" style={StyleSheet.flatten([estilos.cartao, { flexDirection: 'row', alignItems: 'center' }])}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: cores.tinta }}>{titulo}</Text>
          <Text style={{ fontSize: 13, color: cores.cinza }}>{detalhe}</Text>
        </View>
        <Text style={{ fontSize: 22, color: cores.cinza }}>›</Text>
      </Pressable>
    </Link>
  );
}

function BotaoRedondo({ texto, rotulo, aoTocar }: { texto: string; rotulo: string; aoTocar: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      onPress={aoTocar}
      style={({ pressed }) => ({
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: cores.linhaSuave,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ fontSize: 26, fontWeight: '600', color: cores.tinta }}>{texto}</Text>
    </Pressable>
  );
}
