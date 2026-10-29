import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Botao, Campo, CampoData, Cartao, LinhaCampos, Nota, Rotulo, estilos } from '@/components/ui';
import { aguaSugeridaMl, type Sexo } from '@/lib/calculos';
import { carregarPerfil, carregarPesagens, salvarPerfil, type Perfil } from '@/lib/dados';
import { decimal } from '@/lib/datas';
import { cores } from '@/lib/tema';

export const NIVEIS = [
  { fator: 1.2, nome: 'Sedentário', detalhe: 'pouco movimento no dia' },
  { fator: 1.375, nome: 'Leve', detalhe: 'treina 1 a 3 vezes por semana' },
  { fator: 1.55, nome: 'Moderado', detalhe: 'treina 3 a 5 vezes por semana' },
  { fator: 1.725, nome: 'Intenso', detalhe: 'treina quase todo dia' },
];

/** "28/10/1992" → "1992-10-28"; inválido → null. */
export function lerData(texto: string): string | null {
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

/** Formulário do perfil, usado na aba Mais e no primeiro acesso. */
export function FormularioPerfil({ tituloBotao = 'Salvar perfil', aoSalvar, semCartao = false }: { tituloBotao?: string; aoSalvar?: () => void; semCartao?: boolean }) {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [nome, setNome] = useState('');
  const [sexo, setSexo] = useState<Sexo | null>(null);
  const [nascimento, setNascimento] = useState('');
  const [altura, setAltura] = useState('');
  const [meta, setMeta] = useState('');
  const [agua, setAgua] = useState('');
  const [sugestaoAgua, setSugestaoAgua] = useState<number | null>(null);
  const [fator, setFator] = useState(1.2);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'erro' | 'ok'; texto: string } | null>(null);

  useEffect(() => {
    Promise.all([carregarPerfil(), carregarPesagens(30)])
      .then(([p, pesagens]) => {
        setPerfil(p);
        setNome(p.display_name ?? '');
        setSexo(p.sex);
        setNascimento(mostrarData(p.birth_date));
        setAltura(p.height_cm != null ? decimal(p.height_cm, 0) : '');
        setMeta(p.goal_weight_kg != null ? decimal(p.goal_weight_kg) : '');
        setAgua(decimal(p.water_goal_ml / 1000, p.water_goal_ml % 1000 ? (p.water_goal_ml % 100 ? 2 : 1) : 0));
        setFator(p.activity_factor);
        const peso = pesagens.at(-1)?.pesoKg;
        setSugestaoAgua(peso ? aguaSugeridaMl(peso) : null);
      })
      .catch((e) => setMensagem({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Erro ao carregar o perfil.' }));
  }, []);

  async function salvar() {
    if (!perfil) return;
    setMensagem(null);
    const data = nascimento.trim() ? lerData(nascimento) : null;
    const alt = altura.trim() ? Number(altura.replace(',', '.')) : null;
    const pesoMeta = meta.trim() ? Number(meta.replace(',', '.')) : null;
    const aguaL = agua.trim() ? Number(agua.replace(',', '.')) : null;
    if (!sexo) return setMensagem({ tipo: 'erro', texto: 'Escolha o sexo: a fórmula do metabolismo é diferente para cada um.' });
    if (!data) return setMensagem({ tipo: 'erro', texto: 'Data de nascimento: digite só os números, ex.: 10051992.' });
    if (alt == null || !(alt >= 50 && alt <= 260)) return setMensagem({ tipo: 'erro', texto: 'Altura em centímetros, ex.: 178.' });
    if (pesoMeta != null && !(pesoMeta >= 20 && pesoMeta <= 400)) return setMensagem({ tipo: 'erro', texto: 'Meta de peso em kg, ex.: 85.' });
    if (aguaL != null && !(aguaL >= 0.5 && aguaL <= 10)) return setMensagem({ tipo: 'erro', texto: 'Meta de água em litros, ex.: 3.' });

    setSalvando(true);
    try {
      await salvarPerfil(
        {
          display_name: nome.trim() || null,
          sex: sexo,
          birth_date: data,
          height_cm: alt,
          goal_weight_kg: pesoMeta,
          activity_factor: fator,
          ...(aguaL != null ? { water_goal_ml: Math.round(aguaL * 1000) } : {}),
        },
        perfil.id,
      );
      setMensagem({ tipo: 'ok', texto: 'Perfil salvo.' });
      aoSalvar?.();
    } catch (e) {
      setMensagem({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Erro ao salvar.' });
    } finally {
      setSalvando(false);
    }
  }

  const conteudo = (
    <>
      <Campo rotulo="Nome" value={nome} onChangeText={setNome} autoComplete="name" />

      <View style={{ gap: 6 }}>
        <Text style={estilos.campoRotulo}>Sexo</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Opcao texto="Masculino" ativa={sexo === 'masculino'} aoTocar={() => setSexo('masculino')} />
          <Opcao texto="Feminino" ativa={sexo === 'feminino'} aoTocar={() => setSexo('feminino')} />
        </View>
      </View>

      <LinhaCampos>
        <CampoData rotulo="Nascimento" valor={nascimento} aoMudar={setNascimento} />
        <Campo rotulo="Altura (cm)" placeholder="178" value={altura} onChangeText={setAltura} keyboardType="number-pad" maxLength={3} />
      </LinhaCampos>

      <LinhaCampos>
        <Campo rotulo="Meta de peso (kg)" placeholder="85" value={meta} onChangeText={setMeta} keyboardType="decimal-pad" />
        <Campo rotulo="Meta de água (L)" placeholder="3" value={agua} onChangeText={setAgua} keyboardType="decimal-pad" />
      </LinhaCampos>
      {sugestaoAgua != null && (
        <Pressable accessibilityRole="button" onPress={() => setAgua(decimal(sugestaoAgua / 1000, sugestaoAgua % 1000 ? (sugestaoAgua % 100 ? 2 : 1) : 0))} style={{ minHeight: 32, justifyContent: 'center' }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: cores.verdeTexto }}>
            Usar sugestão pelo seu peso: {decimal(sugestaoAgua / 1000, sugestaoAgua % 1000 ? (sugestaoAgua % 100 ? 2 : 1) : 0)} L (35 ml por kg)
          </Text>
        </Pressable>
      )}

      <View style={{ gap: 6 }}>
        <Text style={estilos.campoRotulo}>Nível de atividade (usado quando não há dados do relógio)</Text>
        <View style={{ gap: 6 }}>
          {NIVEIS.map((n) => {
            const ativa = Math.abs(fator - n.fator) < 0.001;
            return (
              <Pressable
                key={n.fator}
                accessibilityRole="radio"
                accessibilityState={{ checked: ativa }}
                onPress={() => setFator(n.fator)}
                style={{
                  minHeight: 48,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  justifyContent: 'center',
                  backgroundColor: ativa ? cores.verde : cores.linhaSuave,
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: ativa ? '#FFFFFF' : cores.tinta }}>{n.nome}</Text>
                <Text style={{ fontSize: 12, color: ativa ? cores.verdeClaro : cores.cinza }}>{n.detalhe}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {mensagem && (
        <Text accessibilityLiveRegion="polite" style={{ fontSize: 14, fontWeight: '700', color: mensagem.tipo === 'ok' ? cores.verdeEscuro : cores.laranja }}>
          {mensagem.texto}
        </Text>
      )}
      <Botao titulo={tituloBotao} aoTocar={salvar} ocupado={salvando} desativado={!perfil} />
    </>
  );

  if (semCartao) return <View style={{ gap: 14 }}>{conteudo}</View>;
  return (
    <Cartao estilo={{ gap: 14 }}>
      <Rotulo>Seu perfil</Rotulo>
      <Nota>Usado para calcular o metabolismo basal, o gasto do dia e as faixas dos exames.</Nota>
      {conteudo}
    </Cartao>
  );
}

function Opcao({ texto, ativa, aoTocar }: { texto: string; ativa: boolean; aoTocar: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: ativa }}
      onPress={aoTocar}
      style={{ minHeight: 44, paddingHorizontal: 16, borderRadius: 12, justifyContent: 'center', backgroundColor: ativa ? cores.verde : cores.linhaSuave }}
    >
      <Text style={{ fontSize: 14, fontWeight: '700', color: ativa ? '#FFFFFF' : cores.tintaSuave }}>{texto}</Text>
    </Pressable>
  );
}
