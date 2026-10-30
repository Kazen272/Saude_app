import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Campo, Cartao, Nota, Rotulo, SeletorHora, estilos } from '@/components/ui';
import { GRUPOS, INTENSIDADES, buscarAtividades, kcalEstimadas, tipoPorCodigo, type Intensidade } from '@/lib/atividades';
import { carregarAtividadesDoDia, desfazer, marcarFeita, marcarNaoFeita, type AtividadeDoDia } from '@/lib/atividades-dados';
import { milhar } from '@/lib/datas';
import { nomeDoApp } from '@/lib/healthconnect-regras';
import { cores } from '@/lib/tema';

// ---------------------------------------------------------------------------
// Cartão "Atividades" do dia (Hoje e Revisar dia)

export function CartaoAtividadesDoDia({ dia, ocultarSeVazio = false }: { dia: string; ocultarSeVazio?: boolean }) {
  const [itens, setItens] = useState<AtividadeDoDia[] | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setErro(null);
      setItens(await carregarAtividadesDoDia(dia));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar as atividades.');
    }
  }, [dia]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  async function agir(i: AtividadeDoDia, acao: 'feito' | 'nao_feito' | 'desfazer') {
    setOcupado(i.chave);
    setErro(null);
    try {
      if (acao === 'feito') await marcarFeita(dia, i);
      else if (acao === 'nao_feito') await marcarNaoFeita(dia, i);
      else await desfazer(i.logId);
      await carregar();
    } catch {
      setErro('Não foi possível salvar. Confira a internet.');
    } finally {
      setOcupado(null);
    }
  }

  if (ocultarSeVazio && (!itens || itens.length === 0)) return null;

  return (
    <Cartao estilo={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Rotulo>Atividades</Rotulo>
        <Link href={{ pathname: '/atividades/avulsa', params: { dia } }} asChild>
          <Pressable accessibilityRole="link" style={{ minHeight: 36, justifyContent: 'center' }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: cores.verdeTexto }}>+ registrar outra</Text>
          </Pressable>
        </Link>
      </View>
      {itens?.length === 0 && <Nota>Nenhuma atividade neste dia. Cadastre as que você faz toda semana em Mais › Atividades.</Nota>}
      {itens?.map((i, n) => (
        <LinhaAtividade key={i.chave} item={i} ultima={n === itens.length - 1} ocupado={ocupado === i.chave} aoAgir={(a) => agir(i, a)} />
      ))}
      {erro && <Text style={{ fontSize: 13, fontWeight: '700', color: cores.laranja }}>{erro}</Text>}
    </Cartao>
  );
}

function LinhaAtividade({
  item,
  ultima,
  ocupado,
  aoAgir,
}: {
  item: AtividadeDoDia;
  ultima: boolean;
  ocupado: boolean;
  aoAgir: (a: 'feito' | 'nao_feito' | 'desfazer') => void;
}) {
  const t = item.treino;
  const detalhe =
    item.estado === 'relogio' && t
      ? `registrada por ${nomeDoApp(t.app)}${t.fim ? ` · ${Math.round((Date.parse(t.fim) - Date.parse(t.inicio)) / 60000)} min` : ''}${t.kcal ? ` · ${milhar(t.kcal)} kcal` : ''}`
      : item.estado === 'feito'
        ? `feita · ≈ ${milhar(item.kcalEstimadas)} kcal (estimativa)`
        : item.estado === 'nao_feito'
          ? 'não feita'
          : `${item.hora} · ${item.duracaoMin} min · ${item.intensidade}`;
  return (
    <View style={{ paddingVertical: 10, gap: 8, borderBottomWidth: ultima ? 0 : 1, borderBottomColor: cores.linhaSuave }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: cores.tinta }}>{item.nome}</Text>
          <Text style={{ fontSize: 12, color: item.estado === 'relogio' || item.estado === 'feito' ? cores.verdeTexto : cores.cinza }}>{detalhe}</Text>
        </View>
        {item.estado === 'relogio' && <Selo texto="Feita" />}
        {(item.estado === 'feito' || item.estado === 'nao_feito') && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Desfazer ${item.nome}`}
            disabled={ocupado}
            onPress={() => aoAgir('desfazer')}
            style={{ minHeight: 40, paddingHorizontal: 12, borderRadius: 10, justifyContent: 'center', backgroundColor: cores.linhaSuave }}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: cores.tintaSuave }}>Desfazer</Text>
          </Pressable>
        )}
      </View>
      {item.estado === 'pendente' && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <BotaoResposta texto="Fiz" principal desativado={ocupado} aoTocar={() => aoAgir('feito')} />
          <BotaoResposta texto="Não fiz" desativado={ocupado} aoTocar={() => aoAgir('nao_feito')} />
        </View>
      )}
    </View>
  );
}

function Selo({ texto }: { texto: string }) {
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: cores.verdeClaro }}>
      <Text style={{ fontSize: 12, fontWeight: '800', color: cores.verdeEscuro }}>{texto}</Text>
    </View>
  );
}

function BotaoResposta({ texto, principal = false, desativado, aoTocar }: { texto: string; principal?: boolean; desativado: boolean; aoTocar: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={desativado}
      onPress={aoTocar}
      style={{
        flex: 1,
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: principal ? cores.verde : cores.linhaSuave,
        opacity: desativado ? 0.5 : 1,
      }}
    >
      <Text style={{ fontSize: 15, fontWeight: '800', color: principal ? '#FFFFFF' : cores.tintaSuave }}>{texto}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Formulário (atividade recorrente e avulsa)

export type ValoresFormulario = { atividade: string; nomeLivre: string; hora: string; duracaoMin: number; intensidade: Intensidade };

const DURACOES = [30, 45, 60, 90, 120];

export function FormularioAtividade({
  valores,
  aoMudar,
  pesoKg,
}: {
  valores: ValoresFormulario;
  aoMudar: (v: Partial<ValoresFormulario>) => void;
  pesoKg: number;
}) {
  const [duracaoLivre, setDuracaoLivre] = useState(DURACOES.includes(valores.duracaoMin) ? '' : String(valores.duracaoMin));
  return (
    <>
      <Cartao estilo={{ gap: 12 }}>
        <Text style={estilos.rotulo}>Atividade</Text>
        <SeletorAtividade codigo={valores.atividade} aoEscolher={(c) => aoMudar({ atividade: c })} />
        {valores.atividade === 'outra' && (
          <Campo rotulo="Nome da atividade" value={valores.nomeLivre} onChangeText={(t) => aoMudar({ nomeLivre: t.slice(0, 60) })} placeholder="ex.: Slackline" />
        )}
      </Cartao>

      <Cartao estilo={{ gap: 12 }}>
        <SeletorHora rotulo="Horário de início" valor={valores.hora} aoMudar={(h) => aoMudar({ hora: h })} />
        <Text style={estilos.campoRotulo}>Duração</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {DURACOES.map((min) => (
            <Chip
              key={min}
              texto={min < 60 ? `${min} min` : min % 60 ? `${Math.floor(min / 60)}h${min % 60}` : `${min / 60} h`}
              ativo={valores.duracaoMin === min && !duracaoLivre}
              aoTocar={() => {
                setDuracaoLivre('');
                aoMudar({ duracaoMin: min });
              }}
            />
          ))}
          <TextInput
            accessibilityLabel="Outra duração em minutos"
            value={duracaoLivre}
            onChangeText={(t) => {
              const d = t.replace(/\D/g, '').slice(0, 3);
              setDuracaoLivre(d);
              if (Number(d) >= 5) aoMudar({ duracaoMin: Number(d) });
            }}
            keyboardType="number-pad"
            placeholder="outra (min)"
            placeholderTextColor={cores.placeholder}
            style={[estilos.campo, { width: 110, height: 40, textAlign: 'center', fontSize: 14 }]}
          />
        </View>
        <Text style={estilos.campoRotulo}>Intensidade</Text>
        <View style={{ gap: 6 }}>
          {INTENSIDADES.map((i) => {
            const ativo = valores.intensidade === i.id;
            return (
              <Pressable
                key={i.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: ativo }}
                onPress={() => aoMudar({ intensidade: i.id })}
                style={{ minHeight: 48, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, justifyContent: 'center', backgroundColor: ativo ? cores.verde : cores.linhaSuave }}
              >
                <Text style={{ fontSize: 14, fontWeight: '800', color: ativo ? '#FFFFFF' : cores.tinta }}>{i.nome}</Text>
                <Text style={{ fontSize: 12, color: ativo ? '#FFFFFF' : cores.cinza }}>{i.descricao}</Text>
              </Pressable>
            );
          })}
        </View>
        <Nota>
          Estimativa: ≈ {milhar(kcalEstimadas(valores.atividade, valores.intensidade, pesoKg, valores.duracaoMin))} kcal por sessão, para {Math.round(pesoKg)} kg. Se o
          relógio gravar o treino nesse horário, vale o número dele.
        </Nota>
      </Cartao>
    </>
  );
}

/** Escolhe a atividade: busca + lista por grupo. Fechado, mostra só a escolhida. */
export function SeletorAtividade({ codigo, aoEscolher }: { codigo: string; aoEscolher: (c: string) => void }) {
  const [aberto, setAberto] = useState(!codigo);
  const [busca, setBusca] = useState('');
  const escolhida = codigo ? tipoPorCodigo(codigo) : null;

  if (!aberto && escolhida) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Atividade: ${escolhida.nome}. Trocar`}
        onPress={() => setAberto(true)}
        style={{ flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: 14, borderRadius: 12, backgroundColor: cores.verdeClaro }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: cores.verdeEscuro }}>{escolhida.nome}</Text>
          <Text style={{ fontSize: 12, color: cores.tintaSuave }}>{escolhida.grupo}</Text>
        </View>
        <Text style={{ fontSize: 13, fontWeight: '700', color: cores.verdeTexto }}>trocar</Text>
      </Pressable>
    );
  }

  const lista = buscarAtividades(busca);
  return (
    <View style={{ gap: 10 }}>
      <TextInput
        accessibilityLabel="Buscar atividade"
        value={busca}
        onChangeText={setBusca}
        placeholder="Buscar (ex.: luta, corrida, yoga)"
        placeholderTextColor={cores.placeholder}
        style={estilos.campo}
      />
      {GRUPOS.map((g) => {
        const doGrupo = lista.filter((a) => a.grupo === g);
        if (!doGrupo.length) return null;
        return (
          <View key={g} style={{ gap: 6 }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: cores.cinza, textTransform: 'uppercase', letterSpacing: 0.5 }}>{g}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {doGrupo.map((a) => (
                <Chip
                  key={a.codigo}
                  texto={a.nome}
                  ativo={a.codigo === codigo}
                  aoTocar={() => {
                    aoEscolher(a.codigo);
                    setBusca('');
                    setAberto(false);
                  }}
                />
              ))}
            </View>
          </View>
        );
      })}
      {lista.length === 0 && <Nota>Nada encontrado. Escolha “Outra atividade” (em Outras) e dê o nome.</Nota>}
    </View>
  );
}

export function Chip({ texto, ativo, aoTocar }: { texto: string; ativo: boolean; aoTocar: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: ativo }}
      onPress={aoTocar}
      style={StyleSheet.flatten({ minHeight: 40, paddingHorizontal: 12, borderRadius: 10, justifyContent: 'center', backgroundColor: ativo ? cores.verde : cores.linhaSuave })}
    >
      <Text style={{ fontSize: 13, fontWeight: '700', color: ativo ? '#FFFFFF' : cores.tintaSuave }}>{texto}</Text>
    </Pressable>
  );
}
