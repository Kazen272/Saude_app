import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Botao, Cabecalho, Campo, LinhaCampos, Cartao, Nota, Rotulo, estilos } from '@/components/ui';
import { mediaMovel } from '@/lib/calculos';
import { carregarPesagens, registrarAgua, registrarCorpo } from '@/lib/dados';
import { dataPorExtenso, decimal, diaLocal } from '@/lib/datas';
import { cores } from '@/lib/tema';

/** Lê "88,4" ou "88.4" como número; vazio vira null. */
function lerNumero(texto: string): number | null {
  const t = texto.trim().replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
}

export default function Registrar() {
  const [pesoDecimos, setPesoDecimos] = useState<number | null>(null); // em décimos de kg
  const [ultimo, setUltimo] = useState<{ ontem: number | null; media: number | null }>({ ontem: null, media: null });
  const [cintura, setCintura] = useState('');
  const [quadril, setQuadril] = useState('');
  const [gordura, setGordura] = useState('');
  const [aguaSessao, setAguaSessao] = useState(0);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'erro' | 'ok'; texto: string } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      carregarPesagens(14)
        .then((pesagens) => {
          if (!ativo) return;
          const hoje = diaLocal();
          const anteriores = pesagens.filter((p) => p.dia < hoje);
          const ultimoPeso = anteriores.at(-1)?.pesoKg ?? null;
          const doDia = pesagens.find((p) => p.dia === hoje)?.pesoKg;
          setUltimo({ ontem: ultimoPeso, media: mediaMovel(pesagens).at(-1)?.pesoKg ?? null });
          setPesoDecimos((atual) => atual ?? Math.round((doDia ?? ultimoPeso ?? 80) * 10));
        })
        .catch(() => setPesoDecimos((atual) => atual ?? 800));
      return () => {
        ativo = false;
      };
    }, []),
  );

  async function adicionarAgua(ml: number) {
    setMensagem(null);
    setAguaSessao((a) => a + ml);
    try {
      await registrarAgua(ml);
    } catch {
      setAguaSessao((a) => a - ml);
      setMensagem({ tipo: 'erro', texto: 'Não foi possível salvar a água.' });
    }
  }

  async function salvar() {
    setMensagem(null);
    const medidas = { cintura: lerNumero(cintura), quadril: lerNumero(quadril), gordura: lerNumero(gordura) };
    if (Object.values(medidas).some((v) => Number.isNaN(v))) {
      setMensagem({ tipo: 'erro', texto: 'Confira as medidas: use só números, como 92,5.' });
      return;
    }
    if (pesoDecimos == null) return;
    setSalvando(true);
    try {
      await registrarCorpo({
        dia: diaLocal(),
        pesoKg: pesoDecimos / 10,
        cinturaCm: medidas.cintura,
        quadrilCm: medidas.quadril,
        gorduraPct: medidas.gordura,
      });
      setMensagem({ tipo: 'ok', texto: 'Registro salvo. Projeção atualizada.' });
    } catch (e) {
      setMensagem({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Erro ao salvar.' });
    } finally {
      setSalvando(false);
    }
  }

  const ajustar = (delta: number) => setPesoDecimos((p) => (p == null ? p : Math.max(200, Math.min(4000, p + delta))));

  return (
    <SafeAreaView style={estilos.tela} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
          <Cabecalho sobre={dataPorExtenso()} titulo="Registrar" />

          <Cartao estilo={{ gap: 12 }}>
            <Rotulo>Peso em jejum</Rotulo>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <BotaoRedondo texto="−" rotulo="Diminuir 0,1 kg" aoTocar={() => ajustar(-1)} />
              <Text style={{ fontSize: 48, fontWeight: '800', color: cores.tinta, fontVariant: ['tabular-nums'] }}>
                {pesoDecimos == null ? '—' : decimal(pesoDecimos / 10)}
                <Text style={{ fontSize: 18, fontWeight: '600', color: cores.cinza }}> kg</Text>
              </Text>
              <BotaoRedondo texto="+" rotulo="Aumentar 0,1 kg" aoTocar={() => ajustar(1)} />
            </View>
            <Text style={{ fontSize: 12, color: cores.cinza, textAlign: 'center' }}>
              {ultimo.ontem != null
                ? `Último: ${decimal(ultimo.ontem)} kg${ultimo.media != null ? ` · média 7 dias: ${decimal(ultimo.media)} kg` : ''}`
                : 'Primeira pesagem: ajuste com − e +'}
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
          </Cartao>

          <Cartao estilo={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Rotulo>Água</Rotulo>
              {aguaSessao > 0 && (
                <Text style={{ fontSize: 13, fontWeight: '700', color: cores.azulEscuro }}>+{aguaSessao} ml agora</Text>
              )}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Botao titulo="+ Copo 250" variante="agua" aoTocar={() => adicionarAgua(250)} />
              </View>
              <View style={{ flex: 1 }}>
                <Botao titulo="+ 500 ml" variante="agua" aoTocar={() => adicionarAgua(500)} />
              </View>
              <View style={{ flex: 1 }}>
                <Botao titulo="+ 1 L" variante="agua" aoTocar={() => adicionarAgua(1000)} rotuloAcessivel="Adicionar garrafa de 1 litro" />
              </View>
            </View>
          </Cartao>

          <Link href="/sono" asChild>
            <Pressable accessibilityRole="link" style={[estilos.cartao, { flexDirection: 'row', alignItems: 'center' }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontSize: 15, fontWeight: '700', color: cores.tinta }}>Sono da última noite</Text>
                <Text style={{ fontSize: 13, color: cores.cinza }}>que horas deitou e acordou</Text>
              </View>
              <Text style={{ fontSize: 22, color: cores.cinza }}>›</Text>
            </Pressable>
          </Link>

          <View style={{ backgroundColor: '#E7EAE4', borderRadius: 14, padding: 14 }}>
            <Nota>Treinos e refeições não precisam ser digitados: vêm do Hevy e do FatSecret.</Nota>
          </View>

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

          <Botao titulo="Salvar registro" aoTocar={salvar} ocupado={salvando} desativado={pesoDecimos == null} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
