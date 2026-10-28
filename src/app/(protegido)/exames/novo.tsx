import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { AvisoMedico, SeloNivel, carregarContexto } from '@/components/exames';
import { Botao, Campo, LinhaCampos, Cartao, Nota, Rotulo, estilos } from '@/components/ui';
import { diaLocal } from '@/lib/datas';
import { escolherLaudo, salvarExame, type ArquivoEscolhido, type Resultado } from '@/lib/exames';
import { MARCADORES, classificar, type Contexto, type Marcador } from '@/lib/referencias';
import { cores } from '@/lib/tema';

type Entrada = { valor: string; min: string; max: string; abrirFaixa: boolean };

const vazio: Entrada = { valor: '', min: '', max: '', abrirFaixa: false };

/** "5,7" → 5.7; vazio → null; inválido → NaN. */
function lerNumero(t: string): number | null {
  const s = t.trim().replace(',', '.');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function lerData(texto: string): string | null {
  const m = texto.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  if (d.getUTCMonth() !== Number(m[2]) - 1 || d > new Date()) return null;
  return d.toISOString().slice(0, 10);
}

const GRUPOS = [...new Set(MARCADORES.map((m) => m.grupo))];

export default function NovoExame() {
  const hoje = diaLocal();
  const [data, setData] = useState(`${hoje.slice(8)}/${hoje.slice(5, 7)}/${hoje.slice(0, 4)}`);
  const [laboratorio, setLaboratorio] = useState('');
  const [laudo, setLaudo] = useState<ArquivoEscolhido | null>(null);
  const [entradas, setEntradas] = useState<Record<string, Entrada>>({});
  const [ctx, setCtx] = useState<Contexto>({ idade: null, sexo: null });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    carregarContexto().then(setCtx).catch(() => {});
  }, []);

  const entrada = (codigo: string) => entradas[codigo] ?? vazio;
  const mudar = (codigo: string, parcial: Partial<Entrada>) => setEntradas((e) => ({ ...e, [codigo]: { ...(e[codigo] ?? vazio), ...parcial } }));

  async function anexar() {
    try {
      const a = await escolherLaudo();
      if (a) setLaudo(a);
    } catch {
      setErro('Não foi possível abrir o arquivo.');
    }
  }

  async function salvar() {
    setErro(null);
    const dia = lerData(data);
    if (!dia) return setErro('Data da coleta no formato dd/mm/aaaa.');
    const resultados: Resultado[] = [];
    for (const m of MARCADORES) {
      const e = entrada(m.codigo);
      const valor = lerNumero(e.valor);
      if (valor == null) continue;
      const min = lerNumero(e.min);
      const max = lerNumero(e.max);
      if (Number.isNaN(valor) || Number.isNaN(min as number) || Number.isNaN(max as number)) return setErro(`Confira os números de ${m.nome}.`);
      resultados.push({ marcador: m.codigo, valor, unidade: m.unidade, refMin: min, refMax: max });
    }
    if (!resultados.length && !laudo) return setErro('Digite pelo menos um resultado ou anexe o laudo.');
    setSalvando(true);
    try {
      const id = await salvarExame({ dia, laboratorio, resultados, laudo });
      router.replace({ pathname: '/exames/[id]', params: { id: String(id) } });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar o exame.');
      setSalvando(false);
    }
  }

  const preenchidos = MARCADORES.filter((m) => lerNumero(entrada(m.codigo).valor) != null).length;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[estilos.conteudo, { paddingTop: 8 }]} keyboardShouldPersistTaps="handled">
        <Cartao estilo={{ gap: 12 }}>
          <LinhaCampos>
            <Campo rotulo="Data da coleta" value={data} onChangeText={setData} placeholder="dd/mm/aaaa" keyboardType="numbers-and-punctuation" />
            <Campo rotulo="Laboratório (opcional)" value={laboratorio} onChangeText={setLaboratorio} maxLength={120} />
          </LinhaCampos>
          <Pressable
            accessibilityRole="button"
            onPress={anexar}
            style={{ minHeight: 48, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: laudo ? cores.verde : '#9AA39D', alignItems: 'center', justifyContent: 'center', padding: 12 }}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: laudo ? cores.verdeEscuro : cores.tintaSuave }} numberOfLines={1}>
              {laudo ? `Laudo: ${laudo.nome}` : 'Anexar laudo (PDF ou foto)'}
            </Text>
          </Pressable>
        </Cartao>

        <Nota>Digite só os exames que aparecem no seu laudo, na mesma unidade indicada. Se o laudo trouxer a faixa de referência, toque em "faixa do laboratório" e informe: ela passa a valer no lugar da padrão.</Nota>

        {GRUPOS.map((g) => (
          <Cartao key={g} estilo={{ gap: 4 }}>
            <Rotulo>{g}</Rotulo>
            {MARCADORES.filter((m) => m.grupo === g).map((m) => (
              <LinhaMarcador key={m.codigo} m={m} e={entrada(m.codigo)} ctx={ctx} aoMudar={(p) => mudar(m.codigo, p)} />
            ))}
          </Cartao>
        ))}

        <AvisoMedico />
        {erro && <Text style={{ fontSize: 14, fontWeight: '700', color: cores.laranja }}>{erro}</Text>}
        <Botao titulo={preenchidos ? `Salvar exame (${preenchidos})` : 'Salvar exame'} aoTocar={salvar} ocupado={salvando} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function LinhaMarcador({ m, e, ctx, aoMudar }: { m: Marcador; e: Entrada; ctx: Contexto; aoMudar: (p: Partial<Entrada>) => void }) {
  const valor = lerNumero(e.valor);
  const min = lerNumero(e.min);
  const max = lerNumero(e.max);
  const c =
    valor != null && !Number.isNaN(valor)
      ? classificar(m.codigo, valor, ctx, {
          min: min != null && !Number.isNaN(min) ? min : null,
          max: max != null && !Number.isNaN(max) ? max : null,
        })
      : null;
  return (
    <View style={{ paddingVertical: 10, borderTopWidth: 1, borderTopColor: cores.linhaSuave, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: cores.tinta }}>{m.nome}</Text>
          <Text style={{ fontSize: 12, color: cores.cinza }}>{c ? `${c.texto} · ref. ${c.faixaTexto}` : m.unidade}</Text>
        </View>
        <TextInput
          accessibilityLabel={`${m.nome} em ${m.unidade}`}
          value={e.valor}
          onChangeText={(t) => aoMudar({ valor: t })}
          keyboardType="decimal-pad"
          placeholder={m.unidade}
          placeholderTextColor={cores.cinza}
          style={[estilos.campo, { width: 96, textAlign: 'right' }]}
        />
      </View>
      {c && (
        <View style={{ flexDirection: 'row' }}>
          <SeloNivel c={c} />
        </View>
      )}
      <Pressable accessibilityRole="button" onPress={() => aoMudar({ abrirFaixa: !e.abrirFaixa })} style={{ minHeight: 32, justifyContent: 'center' }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: cores.verde }}>
          {e.abrirFaixa ? 'ocultar faixa do laboratório' : m.variaPorLaboratorio ? 'faixa do laboratório (recomendado)' : 'faixa do laboratório'}
        </Text>
      </Pressable>
      {e.abrirFaixa && (
        <LinhaCampos>
          <Campo rotulo={`Mínimo (${m.unidade})`} value={e.min} onChangeText={(t) => aoMudar({ min: t })} keyboardType="decimal-pad" />
          <Campo rotulo={`Máximo (${m.unidade})`} value={e.max} onChangeText={(t) => aoMudar({ max: t })} keyboardType="decimal-pad" />
        </LinhaCampos>
      )}
      {m.nota && valor != null && <Text style={{ fontSize: 12, color: cores.cinza }}>{m.nota}</Text>}
    </View>
  );
}
