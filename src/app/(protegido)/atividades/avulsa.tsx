import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';

import { FormularioAtividade, type ValoresFormulario } from '@/components/atividades';
import { Botao, Nota, estilos } from '@/components/ui';
import { kcalEstimadas, nomeDaAtividade } from '@/lib/atividades';
import { marcarFeita, pesoAtual } from '@/lib/atividades-dados';
import { diaLocal, nomeDoDia } from '@/lib/datas';
import { cores } from '@/lib/tema';

/** Registra uma atividade que não é recorrente (ou fora do dia de costume). */
export default function AtividadeAvulsa() {
  const params = useLocalSearchParams<{ dia?: string }>();
  const dia = params.dia && /^\d{4}-\d{2}-\d{2}$/.test(params.dia) ? params.dia : diaLocal();
  const agora = new Date();
  const [v, setV] = useState<ValoresFormulario>({
    atividade: '',
    nomeLivre: '',
    hora: `${String(Math.max(0, agora.getHours() - 1)).padStart(2, '0')}:00`,
    duracaoMin: 60,
    intensidade: 'moderada',
  });
  const [peso, setPeso] = useState(70);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    pesoAtual().then(setPeso).catch(() => {});
  }, []);

  async function salvar() {
    if (!v.atividade) return setErro('Escolha a atividade.');
    if (v.atividade === 'outra' && !v.nomeLivre.trim()) return setErro('Dê um nome para a atividade.');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(v.hora)) return setErro('Horário no formato 19:00.');
    setSalvando(true);
    try {
      await marcarFeita(dia, {
        recorrenteId: null,
        logId: null,
        atividade: v.atividade,
        nome: nomeDaAtividade(v.atividade, v.nomeLivre),
        hora: v.hora,
        duracaoMin: v.duracaoMin,
        intensidade: v.intensidade,
        kcalEstimadas: kcalEstimadas(v.atividade, v.intensidade, peso, v.duracaoMin),
      });
      router.back();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.');
      setSalvando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[estilos.conteudo, { paddingTop: 8 }]} keyboardShouldPersistTaps="handled">
        <Nota>Registrando em: {nomeDoDia(dia)}</Nota>
        <FormularioAtividade valores={v} aoMudar={(p) => setV((x) => ({ ...x, ...p }))} pesoKg={peso} />
        {erro && <Text style={{ fontSize: 14, fontWeight: '700', color: cores.laranja }}>{erro}</Text>}
        <Botao titulo="Registrar atividade" aoTocar={salvar} ocupado={salvando} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
