import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CartaoHealthConnect } from '@/components/healthconnect';
import { Botao, Cabecalho, Campo, LinhaCampos, Cartao, Nota, Rotulo, estilos } from '@/components/ui';
import type { Sexo } from '@/lib/calculos';
import { carregarPerfil, salvarPerfil, type Perfil } from '@/lib/dados';
import { decimal } from '@/lib/datas';
import { supabase } from '@/lib/supabase';
import { cores } from '@/lib/tema';

const NIVEIS = [
  { fator: 1.2, nome: 'Sedentário' },
  { fator: 1.375, nome: 'Leve' },
  { fator: 1.55, nome: 'Moderado' },
  { fator: 1.725, nome: 'Intenso' },
];

/** "28/10/1992" → "1992-10-28"; inválido → null. */
function lerData(texto: string): string | null {
  const m = texto.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [d, mes, a] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const data = new Date(Date.UTC(a, mes - 1, d));
  if (data.getUTCMonth() !== mes - 1 || a < 1900 || data > new Date()) return null;
  return data.toISOString().slice(0, 10);
}

function mostrarData(iso: string | null): string {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

export default function Fontes() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [nome, setNome] = useState('');
  const [sexo, setSexo] = useState<Sexo | null>(null);
  const [nascimento, setNascimento] = useState('');
  const [altura, setAltura] = useState('');
  const [meta, setMeta] = useState('');
  const [fator, setFator] = useState(1.2);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'erro' | 'ok'; texto: string } | null>(null);

  useFocusEffect(
    useCallback(() => {
      carregarPerfil()
        .then((p) => {
          setPerfil(p);
          setNome(p.display_name ?? '');
          setSexo(p.sex);
          setNascimento(mostrarData(p.birth_date));
          setAltura(p.height_cm != null ? decimal(p.height_cm, 0) : '');
          setMeta(p.goal_weight_kg != null ? decimal(p.goal_weight_kg) : '');
          setFator(p.activity_factor);
        })
        .catch((e) => setMensagem({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Erro ao carregar o perfil.' }));
    }, []),
  );

  async function salvar() {
    if (!perfil) return;
    setMensagem(null);
    const data = nascimento.trim() ? lerData(nascimento) : null;
    const alt = altura.trim() ? Number(altura.replace(',', '.')) : null;
    const pesoMeta = meta.trim() ? Number(meta.replace(',', '.')) : null;
    if (nascimento.trim() && !data) return setMensagem({ tipo: 'erro', texto: 'Data de nascimento no formato dd/mm/aaaa.' });
    if (alt != null && !(alt >= 50 && alt <= 260)) return setMensagem({ tipo: 'erro', texto: 'Altura em centímetros, ex.: 178.' });
    if (pesoMeta != null && !(pesoMeta >= 20 && pesoMeta <= 400)) return setMensagem({ tipo: 'erro', texto: 'Meta de peso em kg, ex.: 85.' });

    setSalvando(true);
    try {
      await salvarPerfil(
        { display_name: nome.trim() || null, sex: sexo, birth_date: data, height_cm: alt, goal_weight_kg: pesoMeta, activity_factor: fator },
        perfil.id,
      );
      setMensagem({ tipo: 'ok', texto: 'Perfil salvo.' });
    } catch (e) {
      setMensagem({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Erro ao salvar.' });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <SafeAreaView style={estilos.tela} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
          <Cabecalho sobre="Relatórios, exames, lembretes e perfil" titulo="Mais" />

          <Cartao estilo={{ gap: 0, paddingVertical: 4 }}>
            <ItemMenu href="/relatorio" icone="stats-chart-outline" titulo="Relatório da semana" detalhe="o que melhorou e o que piorou" />
            <ItemMenu href="/exames" icone="water-outline" titulo="Exames de sangue" detalhe="resultados, referências e histórico" />
            <ItemMenu href="/sono" icone="moon-outline" titulo="Sono" detalhe="registrar noites e ver a semana" />
            <ItemMenu href="/lembretes" icone="notifications-outline" titulo="Lembretes" detalhe="água, pesagem, check-in e os seus" ultimo />
          </Cartao>

          <Text style={[estilos.rotulo, { marginTop: 6 }]}>Fontes de dados</Text>

          <CartaoHealthConnect />

          <Cartao estilo={{ gap: 14 }}>
            <Rotulo>Seu perfil</Rotulo>
            <Nota>Usado para calcular o metabolismo basal e o gasto do dia.</Nota>
            <Campo rotulo="Nome" value={nome} onChangeText={setNome} />

            <View style={{ gap: 6 }}>
              <Text style={estilos.campoRotulo}>Sexo</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Opcao texto="Masculino" ativa={sexo === 'masculino'} aoTocar={() => setSexo('masculino')} />
                <Opcao texto="Feminino" ativa={sexo === 'feminino'} aoTocar={() => setSexo('feminino')} />
              </View>
            </View>

            <LinhaCampos>
              <Campo rotulo="Nascimento" placeholder="dd/mm/aaaa" value={nascimento} onChangeText={setNascimento} keyboardType="numbers-and-punctuation" />
              <Campo rotulo="Altura (cm)" placeholder="178" value={altura} onChangeText={setAltura} keyboardType="decimal-pad" />
            </LinhaCampos>
            <Campo rotulo="Meta de peso (kg)" placeholder="85" value={meta} onChangeText={setMeta} keyboardType="decimal-pad" />

            <View style={{ gap: 6 }}>
              <Text style={estilos.campoRotulo}>Nível de atividade (usado quando não há dados do relógio)</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {NIVEIS.map((n) => (
                  <Opcao key={n.fator} texto={n.nome} ativa={Math.abs(fator - n.fator) < 0.001} aoTocar={() => setFator(n.fator)} />
                ))}
              </View>
            </View>

            {mensagem && (
              <Text accessibilityLiveRegion="polite" style={{ fontSize: 14, fontWeight: '700', color: mensagem.tipo === 'ok' ? cores.verdeEscuro : cores.laranja }}>
                {mensagem.texto}
              </Text>
            )}
            <Botao titulo="Salvar perfil" aoTocar={salvar} ocupado={salvando} desativado={!perfil} />
          </Cartao>

          <Botao titulo="Sair da conta" variante="suave" aoTocar={() => supabase.auth.signOut()} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ItemMenu({
  href,
  icone,
  titulo,
  detalhe,
  ultimo = false,
}: {
  href: Href;
  icone: keyof typeof Ionicons.glyphMap;
  titulo: string;
  detalhe: string;
  ultimo?: boolean;
}) {
  return (
    <Link href={href} asChild>
      <Pressable
        accessibilityRole="link"
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: ultimo ? 0 : 1, borderBottomColor: cores.linhaSuave }}
      >
        <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: cores.verdeClaro, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name={icone} size={20} color={cores.verdeEscuro} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: cores.tinta }}>{titulo}</Text>
          <Text style={{ fontSize: 12, color: cores.cinza }}>{detalhe}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={cores.cinza} />
      </Pressable>
    </Link>
  );
}


function Opcao({ texto, ativa, aoTocar }: { texto: string; ativa: boolean; aoTocar: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: ativa }}
      onPress={aoTocar}
      style={{
        minHeight: 44,
        paddingHorizontal: 16,
        borderRadius: 12,
        justifyContent: 'center',
        backgroundColor: ativa ? cores.verde : cores.linhaSuave,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: '700', color: ativa ? '#FFFFFF' : cores.tintaSuave }}>{texto}</Text>
    </Pressable>
  );
}
