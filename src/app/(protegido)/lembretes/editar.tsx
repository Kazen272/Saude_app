import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';

import { Botao, Campo, Cartao, Nota, estilos } from '@/components/ui';
import { NOMES_DIAS, descrever, validar, type Lembrete, type TipoLembrete } from '@/lib/lembretes-regras';
import { apagarLembrete, listarLembretes, salvarLembrete, sincronizarAgendamentos } from '@/lib/lembretes';
import { cores } from '@/lib/tema';

const NOVO: Lembrete = {
  titulo: '',
  mensagem: '',
  tipo: 'horarios',
  dias: [1, 2, 3, 4, 5, 6, 7],
  horarios: ['08:00'],
  intervaloMin: 120,
  inicio: '09:00',
  fim: '21:00',
  link: '/',
  ativo: true,
};

const TELAS = [
  { link: '/', nome: 'Hoje' },
  { link: '/registrar', nome: 'Registrar' },
  { link: '/sono', nome: 'Sono' },
  { link: '/fotos', nome: 'Fotos' },
  { link: '/relatorio', nome: 'Relatório' },
];

const INTERVALOS = [30, 60, 90, 120, 180, 240];

export default function EditarLembrete() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [l, setL] = useState<Lembrete | null>(id ? null : NOVO);
  const [novoHorario, setNovoHorario] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!id) return;
    listarLembretes()
      .then((lista) => setL(lista.find((x) => String(x.id) === id) ?? NOVO))
      .catch(() => setL(NOVO));
  }, [id]);

  if (!l) return null;
  const mudar = (parcial: Partial<Lembrete>) => setL({ ...l, ...parcial });

  function alternarDia(d: number) {
    mudar({ dias: l!.dias.includes(d) ? l!.dias.filter((x) => x !== d) : [...l!.dias, d].sort() });
  }

  function adicionarHorario() {
    const t = novoHorario.trim().replace('h', ':');
    const m = t.match(/^(\d{1,2}):(\d{2})$/);
    if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) {
      setErro('Horário no formato 08:30.');
      return;
    }
    const hhmm = `${m[1].padStart(2, '0')}:${m[2]}`;
    setErro(null);
    mudar({ horarios: [...new Set([...l!.horarios, hhmm])].sort() });
    setNovoHorario('');
  }

  async function salvar() {
    const problema = validar(l!);
    if (problema) {
      setErro(problema);
      return;
    }
    setSalvando(true);
    try {
      await salvarLembrete(l!);
      await sincronizarAgendamentos();
      router.back();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.');
      setSalvando(false);
    }
  }

  function apagar() {
    Alert.alert('Apagar lembrete?', l!.titulo, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Apagar',
        style: 'destructive',
        onPress: async () => {
          await apagarLembrete(l!.id as number);
          await sincronizarAgendamentos();
          router.back();
        },
      },
    ]);
  }

  const problema = validar(l);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[estilos.conteudo, { paddingTop: 8 }]} keyboardShouldPersistTaps="handled">
        <Cartao estilo={{ gap: 12 }}>
          <Campo rotulo="Nome" value={l.titulo} onChangeText={(t) => mudar({ titulo: t })} placeholder="Ex.: Tomar vitamina" maxLength={80} />
          <Campo rotulo="Mensagem (opcional)" value={l.mensagem} onChangeText={(t) => mudar({ mensagem: t })} maxLength={200} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: cores.tinta }}>Ligado</Text>
            <Switch value={l.ativo} onValueChange={(v) => mudar({ ativo: v })} trackColor={{ true: cores.verde, false: cores.linha }} thumbColor="#FFFFFF" />
          </View>
        </Cartao>

        <Cartao estilo={{ gap: 12 }}>
          <Text style={estilos.rotulo}>Dias</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {NOMES_DIAS.map((nome, i) => {
              const d = i + 1;
              const ativo = l.dias.includes(d);
              return (
                <Pressable
                  key={d}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: ativo }}
                  onPress={() => alternarDia(d)}
                  style={{ flex: 1, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: ativo ? cores.verde : cores.linhaSuave }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: ativo ? '#FFFFFF' : cores.tintaSuave }}>{nome}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Atalho texto="Todo dia" aoTocar={() => mudar({ dias: [1, 2, 3, 4, 5, 6, 7] })} />
            <Atalho texto="Seg a Sex" aoTocar={() => mudar({ dias: [2, 3, 4, 5, 6] })} />
            <Atalho texto="Fim de semana" aoTocar={() => mudar({ dias: [1, 7] })} />
          </View>
        </Cartao>

        <Cartao estilo={{ gap: 12 }}>
          <Text style={estilos.rotulo}>Quando</Text>
          <View style={{ flexDirection: 'row', gap: 4, backgroundColor: '#E7EAE4', borderRadius: 12, padding: 4 }}>
            {(
              [
                ['horarios', 'Horários fixos'],
                ['intervalo', 'A cada X tempo'],
              ] as [TipoLembrete, string][]
            ).map(([tipo, nome]) => (
              <Pressable
                key={tipo}
                accessibilityRole="tab"
                accessibilityState={{ selected: l.tipo === tipo }}
                onPress={() => mudar({ tipo })}
                style={{ flex: 1, height: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: l.tipo === tipo ? cores.cartao : 'transparent' }}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: l.tipo === tipo ? cores.tinta : cores.cinza }}>{nome}</Text>
              </Pressable>
            ))}
          </View>

          {l.tipo === 'horarios' ? (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {l.horarios.map((h) => (
                  <Pressable
                    key={h}
                    accessibilityRole="button"
                    accessibilityLabel={`Remover ${h}`}
                    onPress={() => mudar({ horarios: l.horarios.filter((x) => x !== h) })}
                    style={{ minHeight: 40, paddingHorizontal: 14, borderRadius: 10, backgroundColor: cores.verdeClaro, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '800', color: cores.verdeEscuro }}>{h}</Text>
                    <Text style={{ fontSize: 15, color: cores.verdeEscuro }}>×</Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
                <View style={{ flex: 1 }}>
                  <Campo rotulo="Adicionar horário" value={novoHorario} onChangeText={setNovoHorario} placeholder="08:30" keyboardType="numbers-and-punctuation" onSubmitEditing={adicionarHorario} />
                </View>
                <View style={{ width: 100 }}>
                  <Botao titulo="Adicionar" variante="suave" aoTocar={adicionarHorario} />
                </View>
              </View>
            </>
          ) : (
            <>
              <Text style={estilos.campoRotulo}>Repetir a cada</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {INTERVALOS.map((min) => (
                  <Atalho
                    key={min}
                    texto={min < 60 ? `${min} min` : min % 60 === 0 ? `${min / 60} h` : `${Math.floor(min / 60)}h${min % 60}`}
                    ativo={l.intervaloMin === min}
                    aoTocar={() => mudar({ intervaloMin: min })}
                  />
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Campo rotulo="Começa às" value={l.inicio ?? ''} onChangeText={(t) => mudar({ inicio: t })} placeholder="09:00" keyboardType="numbers-and-punctuation" />
                <Campo rotulo="Termina às" value={l.fim ?? ''} onChangeText={(t) => mudar({ fim: t })} placeholder="21:00" keyboardType="numbers-and-punctuation" />
              </View>
            </>
          )}
        </Cartao>

        <Cartao estilo={{ gap: 12 }}>
          <Text style={estilos.rotulo}>Ao tocar, abrir</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {TELAS.map((t) => (
              <Atalho key={t.link} texto={t.nome} ativo={l.link === t.link} aoTocar={() => mudar({ link: t.link })} />
            ))}
          </View>
        </Cartao>

        <Nota>{problema ? problema : `Resumo: ${descrever(l)}`}</Nota>
        {erro && <Text style={{ fontSize: 14, fontWeight: '700', color: cores.laranja }}>{erro}</Text>}
        <Botao titulo="Salvar lembrete" aoTocar={salvar} ocupado={salvando} />
        {l.id != null && <Botao titulo="Apagar" variante="suave" aoTocar={apagar} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Atalho({ texto, aoTocar, ativo = false }: { texto: string; aoTocar: () => void; ativo?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: ativo }}
      onPress={aoTocar}
      style={{ minHeight: 40, paddingHorizontal: 12, borderRadius: 10, justifyContent: 'center', backgroundColor: ativo ? cores.verde : cores.linhaSuave }}
    >
      <Text style={{ fontSize: 13, fontWeight: '700', color: ativo ? '#FFFFFF' : cores.tintaSuave }}>{texto}</Text>
    </Pressable>
  );
}

