import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import { Botao, Campo, Cartao, Nota, Rotulo, estilos } from '@/components/ui';
import type { Ritmo } from '@/lib/calculos';
import { carregarPerfil, carregarSugestaoMeta, salvarPerfil, type Perfil, type SugestaoMeta } from '@/lib/dados';
import { decimal, milhar } from '@/lib/datas';
import { cores } from '@/lib/tema';

const RITMOS: Record<Ritmo, { nome: string; texto: string }> = {
  gradual: { nome: 'Gradual', texto: 'mais fácil de manter no dia a dia' },
  moderado: { nome: 'Moderado · recomendado', texto: 'bom equilíbrio entre ritmo e conforto' },
  acelerado: { nome: 'Acelerado', texto: 'mais difícil de sustentar; mais fome e cansaço' },
};

const FONTES = [
  {
    texto: 'Frankenfield et al., 2005 (J Am Diet Assoc): revisão sistemática; Mifflin-St Jeor foi a equação que mais acertou o metabolismo de repouso dentro de 10% do medido.',
    url: 'https://pure.psu.edu/en/publications/comparison-of-predictive-equations-for-resting-metabolic-rate-in-/',
  },
  {
    texto: 'FAO/OMS/UNU, 2004 (Human energy requirements): faixas de nível de atividade (PAL) 1,40–1,69, 1,70–1,99 e 2,00–2,40.',
    url: 'https://www.fao.org/3/y5686e/y5686e07.htm',
  },
  {
    texto: 'NHLBI, 1998 (Clinical Guidelines on Obesity): déficit de 300–500 kcal/dia → ~0,25–0,5 kg/semana; 500–1.000 kcal/dia → ~0,5–1 kg/semana.',
    url: 'https://webarchive.library.unt.edu/eot2008/20080920160643/http:/www.nhlbi.nih.gov/guidelines/obesity/e_txtbk/txgd/4311.htm',
  },
  {
    texto: 'NHLBI, 2009 (Aim for a Healthy Weight): 1.000–1.200 kcal/dia para a maioria das mulheres e 1.200–1.600 para a maioria dos homens; o app usa o topo de cada faixa como mínimo.',
    url: 'https://d188lfxfyq6i9j.cloudfront.net/general-uploads/PDF-Assets/healthy_wt_atglance.pdf',
  },
  {
    texto: 'Helms, Aragon & Fitschen, 2014 (JISSN): perder ~0,5–1% do peso por semana ajuda a preservar massa magra; o ritmo acelerado nunca passa de 1%.',
    url: 'https://openrepository.aut.ac.nz/items/723f44d2-7c20-4214-ba62-987339099039/full',
  },
];

export default function MetaCalorica() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [s, setS] = useState<SugestaoMeta | null | undefined>(undefined);
  const [valor, setValor] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null);

  useFocusEffect(
    useCallback(() => {
      Promise.all([carregarPerfil(), carregarSugestaoMeta()])
        .then(([p, sug]) => {
          setPerfil(p);
          setS(sug);
          setValor(p.calorie_goal != null ? String(p.calorie_goal) : '');
        })
        .catch((e) => setMensagem({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Erro ao carregar.' }));
    }, []),
  );

  const numero = Number(valor);
  const abaixoDoPiso = s && valor && numero > 0 && numero < s.piso;
  const moderado = s?.opcoes.find((o) => o.ritmo === 'moderado');

  async function salvar(meta: number | null) {
    if (!perfil) return;
    setMensagem(null);
    if (meta != null && !(meta >= 800 && meta <= 6000)) return setMensagem({ tipo: 'erro', texto: 'Meta entre 800 e 6.000 kcal.' });
    setSalvando(true);
    try {
      await salvarPerfil({ calorie_goal: meta }, perfil.id);
      setPerfil({ ...perfil, calorie_goal: meta });
      if (meta == null) setValor('');
      setMensagem({ tipo: 'ok', texto: meta == null ? 'Usando a sugestão moderada, que se ajusta sozinha ao seu gasto.' : 'Meta salva.' });
    } catch (e) {
      setMensagem({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Erro ao salvar.' });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[estilos.conteudo, { paddingTop: 8 }]} keyboardShouldPersistTaps="handled">
        {s === null && (
          <Cartao>
            <Nota>Para sugerir uma meta, o app precisa de sexo, data de nascimento e altura (aba Mais › Perfil) e de pelo menos uma pesagem.</Nota>
          </Cartao>
        )}

        {s && (
          <Cartao estilo={{ gap: 6 }}>
            <Rotulo>Seu gasto por dia</Rotulo>
            <Text style={{ fontSize: 28, fontWeight: '800', color: cores.tinta, fontVariant: ['tabular-nums'] }}>≈ {milhar(s.gastoBase)} kcal</Text>
            <Nota>
              {s.origem === 'medido'
                ? `Média de ${s.diasMedidos} dos últimos 14 dias com dados do relógio e dos passos, já com o ajuste do previsto × real.`
                : `Estimativa: metabolismo de repouso de ${milhar(s.tmb)} kcal (fórmula de Mifflin-St Jeor com seu peso, altura, idade e sexo) × nível de atividade ${decimal(s.pal, 2)} (faixas da FAO/OMS). Com 7 dias de dados do relógio, passa a usar o gasto medido.`}
            </Nota>
          </Cartao>
        )}

        {s && (
          <View style={{ gap: 8 }}>
            <Rotulo>Sugestões para emagrecer</Rotulo>
            {s.opcoes.map((o) => {
              const escolhida = numero === o.kcal;
              return (
                <Pressable
                  key={o.ritmo}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: escolhida }}
                  onPress={() => setValor(String(o.kcal))}
                  style={{
                    backgroundColor: cores.cartao,
                    borderRadius: 18,
                    padding: 16,
                    gap: 4,
                    borderWidth: 2,
                    borderColor: escolhida ? cores.verde : 'transparent',
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: cores.tinta, flexShrink: 1 }}>{RITMOS[o.ritmo].nome}</Text>
                    <Text numberOfLines={1} style={{ flexShrink: 0, fontSize: 20, fontWeight: '800', color: cores.verdeTexto, fontVariant: ['tabular-nums'] }}>{milhar(o.kcal)} kcal</Text>
                  </View>
                  <Text style={{ fontSize: 13, color: cores.tintaSuave }}>
                    déficit de {milhar(o.deficit)} kcal/dia · ≈ {decimal(o.kgSemana, 2)} kg por semana ({decimal(o.pctSemana)}% do peso)
                  </Text>
                  <Text style={{ fontSize: 12, color: cores.cinza }}>
                    {RITMOS[o.ritmo].texto}
                    {o.noPiso ? ` · ficou no mínimo de segurança (${milhar(s.piso)} kcal)` : o.limitadoPeloRitmo ? ' · limitado a 1% do peso por semana' : ''}
                  </Text>
                </Pressable>
              );
            })}
            <Nota>
              Comendo entre {milhar(s.faixa.min)} e {milhar(s.faixa.max)} kcal por dia, você emagrece de forma progressiva e sustentável. A perda real desacelera com o tempo; o app compara
              o previsto com a balança e ajusta o gasto a cada semana.
            </Nota>
          </View>
        )}

        <Cartao estilo={{ gap: 10 }}>
          <Campo
            rotulo="Sua meta de calorias por dia (kcal)"
            value={valor}
            onChangeText={(t) => setValor(t.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            placeholder={moderado ? `sugestão: ${moderado.kcal}` : 'ex.: 2000'}
          />
          {abaixoDoPiso && (
            <Text style={{ fontSize: 13, fontWeight: '700', color: cores.laranja }}>
              Abaixo de {milhar(s.piso)} kcal por dia: só com acompanhamento de nutricionista ou médico.
            </Text>
          )}
          {mensagem && <Text style={{ fontSize: 13, fontWeight: '700', color: mensagem.tipo === 'ok' ? cores.verdeTexto : cores.laranja }}>{mensagem.texto}</Text>}
          <Botao titulo="Salvar minha meta" aoTocar={() => salvar(valor ? numero : null)} ocupado={salvando} desativado={!valor} />
          {perfil?.calorie_goal != null && (
            <Botao titulo="Usar a sugestão automática (moderado)" variante="suave" aoTocar={() => salvar(null)} desativado={salvando} />
          )}
          <Nota>
            {perfil?.calorie_goal != null
              ? `Meta atual: ${milhar(perfil.calorie_goal)} kcal (escolhida por você).`
              : 'Sem meta escolhida: a tela Hoje usa a sugestão moderada, que acompanha seu gasto.'}{' '}
            São referências gerais para adultos saudáveis, não uma prescrição.
          </Nota>
        </Cartao>

        <Cartao estilo={{ gap: 8 }}>
          <Rotulo>De onde vêm esses números</Rotulo>
          {FONTES.map((f) => (
            <Pressable key={f.url} accessibilityRole="link" onPress={() => Linking.openURL(f.url).catch(() => {})} style={{ paddingVertical: 4 }}>
              <Text style={{ fontSize: 12, lineHeight: 17, color: cores.tintaSuave }}>
                {f.texto} <Text style={{ color: cores.verdeTexto, fontWeight: '700' }}>abrir</Text>
              </Text>
            </Pressable>
          ))}
        </Cartao>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
