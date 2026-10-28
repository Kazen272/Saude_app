import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { GraficoSono } from '@/components/bemestar';
import { Botao, Campo, LinhaCampos, Cartao, Nota, Rotulo, estilos } from '@/components/ui';
import { duracaoSono, formatarDuracao, formatarHora, lerHora, resumirSono, type Noite } from '@/lib/bemestar';
import { carregarNoites, registrarSono } from '@/lib/bemestar-dados';
import { diaCurto, diaLocal, somarDias } from '@/lib/datas';
import { cores } from '@/lib/tema';

export default function Sono() {
  const hoje = diaLocal();
  const [noites, setNoites] = useState<Noite[]>([]);
  const [dia, setDia] = useState(hoje);
  const [deitou, setDeitou] = useState('23:00');
  const [acordou, setAcordou] = useState('07:00');
  const [qualidade, setQualidade] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'erro' | 'ok'; texto: string } | null>(null);

  const carregar = useCallback(async () => {
    try {
      setNoites(await carregarNoites(14));
    } catch (e) {
      setMensagem({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Erro ao carregar.' });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  const deitouMin = lerHora(deitou);
  const acordouMin = lerHora(acordou);
  const duracao = deitouMin != null && acordouMin != null ? duracaoSono(deitouMin, acordouMin) : null;

  async function salvar() {
    setMensagem(null);
    if (deitouMin == null || acordouMin == null) {
      setMensagem({ tipo: 'erro', texto: 'Use o formato 23:30 para os horários.' });
      return;
    }
    setSalvando(true);
    try {
      await registrarSono({ dia, deitouMin, acordouMin, qualidade });
      setMensagem({ tipo: 'ok', texto: 'Noite salva.' });
      await carregar();
    } catch (e) {
      setMensagem({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Erro ao salvar.' });
    } finally {
      setSalvando(false);
    }
  }

  const ultimas7 = noites.filter((n) => n.dia > somarDias(hoje, -7));
  const resumo = resumirSono(ultimas7);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[estilos.conteudo, { paddingTop: 8 }]} keyboardShouldPersistTaps="handled">
        <Cartao estilo={{ gap: 12 }}>
          <Rotulo>Registrar noite</Rotulo>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              { valor: hoje, nome: 'Esta noite (acordei hoje)' },
              { valor: somarDias(hoje, -1), nome: 'Noite anterior' },
            ].map((o) => (
              <Pressable
                key={o.valor}
                accessibilityRole="radio"
                accessibilityState={{ checked: dia === o.valor }}
                onPress={() => setDia(o.valor)}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: 12,
                  padding: 8,
                  justifyContent: 'center',
                  backgroundColor: dia === o.valor ? cores.verde : cores.linhaSuave,
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', textAlign: 'center', color: dia === o.valor ? '#FFFFFF' : cores.tintaSuave }}>{o.nome}</Text>
              </Pressable>
            ))}
          </View>
          <LinhaCampos>
            <Campo rotulo="Deitei às" value={deitou} onChangeText={setDeitou} placeholder="23:00" keyboardType="numbers-and-punctuation" />
            <Campo rotulo="Acordei às" value={acordou} onChangeText={setAcordou} placeholder="07:00" keyboardType="numbers-and-punctuation" />
          </LinhaCampos>
          <Nota>{duracao != null ? `Total: ${formatarDuracao(duracao)}` : 'Use o formato 23:30.'}</Nota>
          <View style={{ gap: 6 }}>
            <Text style={estilos.campoRotulo}>Como dormiu? (opcional)</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable
                  key={n}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: qualidade === n }}
                  accessibilityLabel={`Qualidade ${n} de 5`}
                  onPress={() => setQualidade(qualidade === n ? null : n)}
                  style={{ flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: qualidade === n ? cores.verde : cores.linhaSuave }}
                >
                  <Text style={{ fontSize: 16, fontWeight: '800', color: qualidade === n ? '#FFFFFF' : cores.tintaSuave }}>{n}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          {mensagem && (
            <Text accessibilityLiveRegion="polite" style={{ fontSize: 14, fontWeight: '700', color: mensagem.tipo === 'ok' ? cores.verdeEscuro : cores.laranja }}>
              {mensagem.texto}
            </Text>
          )}
          <Botao titulo="Salvar noite" aoTocar={salvar} ocupado={salvando} />
          <Nota>Quando o relógio estiver conectado, as noites entram sozinhas. O registro manual tem prioridade.</Nota>
        </Cartao>

        <Cartao estilo={{ gap: 12 }}>
          <Rotulo>Últimas 7 noites</Rotulo>
          <GraficoSono noites={ultimas7} />
          <View style={{ flexDirection: 'row' }}>
            <Numero valor={resumo.mediaMin != null ? formatarDuracao(resumo.mediaMin) : '—'} legenda="média por noite" />
            <Numero valor={resumo.dormirMedio != null ? formatarHora(resumo.dormirMedio) : '—'} legenda="horário médio de dormir" />
            <Numero valor={resumo.variacaoMin != null ? `±${resumo.variacaoMin} min` : '—'} legenda="variação do horário" />
          </View>
          <Nota>
            {resumo.noites === 0
              ? 'Adultos costumam precisar de 7 a 9 horas por noite.'
              : `${resumo.abaixoDe7h} de ${resumo.noites} noites abaixo de 7 h. Adultos costumam precisar de 7 a 9 horas, e horários regulares ajudam tanto quanto a duração.`}
          </Nota>
        </Cartao>

        {noites.length > 0 && (
          <Cartao estilo={{ gap: 0, paddingVertical: 4 }}>
            {[...noites].reverse().map((n, i, lista) => (
              <View
                key={n.dia}
                style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: i === lista.length - 1 ? 0 : 1, borderBottomColor: cores.linhaSuave }}
              >
                <Text style={{ fontSize: 14, color: cores.tintaSuave }}>{diaCurto(n.dia)}</Text>
                <Text style={{ fontSize: 14, color: cores.tinta, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                  {formatarDuracao(n.duracaoMin)}
                  <Text style={{ fontWeight: '400', color: cores.cinza }}>
                    {n.deitouMin != null ? `  deitou ${formatarHora(n.deitouMin)}` : '  relógio'}
                    {n.qualidade != null ? ` · ${n.qualidade}/5` : ''}
                  </Text>
                </Text>
              </View>
            ))}
          </Cartao>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Numero({ valor, legenda }: { valor: string; legenda: string }) {
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={{ fontSize: 18, fontWeight: '800', color: cores.tinta, fontVariant: ['tabular-nums'] }}>{valor}</Text>
      <Text style={{ fontSize: 12, color: cores.cinza }}>{legenda}</Text>
    </View>
  );
}
