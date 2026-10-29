import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { Cartao, Nota, Rotulo, estilos } from '@/components/ui';
import { formatarDuracao } from '@/lib/bemestar';
import { carregarRelatorioSemanal, type RelatorioSemanal } from '@/lib/dados';
import { decimal, diaCurto, milhar } from '@/lib/datas';
import type { ItemComparacao, MetricasSemana } from '@/lib/relatorios';
import { cores, porTema } from '@/lib/tema';

const NOMES: Record<keyof MetricasSemana, string> = {
  pesoMedioKg: 'Peso médio',
  deficitTotal: 'Déficit da semana',
  treinos: 'Treinos',
  aguaMediaMl: 'Água por dia',
  sonoMedioMin: 'Sono por noite',
  variacaoDormirMin: 'Regularidade do sono',
  energia: 'Energia',
  fome: 'Fome',
  humor: 'Humor',
};

function formatar(chave: keyof MetricasSemana, v: number | null): string {
  if (v == null) return '—';
  switch (chave) {
    case 'pesoMedioKg':
      return `${decimal(v)} kg`;
    case 'deficitTotal':
      return `${milhar(v)} kcal`;
    case 'treinos':
      return String(v);
    case 'aguaMediaMl':
      return `${decimal(v / 1000)} L`;
    case 'sonoMedioMin':
      return formatarDuracao(v);
    case 'variacaoDormirMin':
      return `±${v} min`;
    default:
      return `${decimal(v)}/5`;
  }
}

const ESTILO_TENDENCIA = porTema(() => ({
  melhorou: { texto: 'melhorou', fundo: cores.verdeClaro, cor: cores.verdeEscuro, seta: '▲' },
  piorou: { texto: 'piorou', fundo: cores.laranjaClaro, cor: cores.laranjaTexto, seta: '▼' },
  estavel: { texto: 'estável', fundo: cores.linhaSuave, cor: cores.tintaSuave, seta: '=' },
  sem_dados: { texto: 'sem dados', fundo: cores.linhaSuave, cor: cores.cinza, seta: '·' },
}));

export default function Relatorio() {
  const [dados, setDados] = useState<RelatorioSemanal | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      carregarRelatorioSemanal()
        .then(setDados)
        .catch((e) => setErro(e instanceof Error ? e.message : 'Erro ao montar o relatório.'));
    }, []),
  );

  if (erro) {
    return (
      <View style={[estilos.conteudo]}>
        <Cartao estilo={{ backgroundColor: cores.laranjaClaro }}>
          <Text style={{ color: cores.laranjaTexto }}>{erro}</Text>
        </Cartao>
      </View>
    );
  }
  if (!dados) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={cores.verde} />
      </View>
    );
  }

  const melhorou = dados.itens.filter((i) => i.tendencia === 'melhorou');
  const piorou = dados.itens.filter((i) => i.tendencia === 'piorou');
  const peso = dados.itens.find((i) => i.chave === 'pesoMedioKg');
  const variacaoPeso = peso?.atual != null && peso.anterior != null ? peso.atual - peso.anterior : null;

  return (
    <ScrollView contentContainerStyle={[estilos.conteudo, { paddingTop: 8 }]}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: cores.cinza }}>
        {diaCurto(dados.semana.inicio)} a {diaCurto(dados.semana.fim)} · comparado com a semana anterior
      </Text>

      <View style={{ backgroundColor: cores.painel, borderRadius: 22, padding: 20, gap: 10 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: cores.escuroSuave }}>Resumo</Text>
        <Text style={{ fontSize: 22, fontWeight: '800', color: '#FFFFFF' }}>
          {variacaoPeso == null
            ? 'Semana registrada'
            : variacaoPeso < -0.05
              ? `${decimal(Math.abs(variacaoPeso))} kg a menos na média`
              : variacaoPeso > 0.05
                ? `${decimal(variacaoPeso)} kg a mais na média`
                : 'Peso médio estável'}
        </Text>
        <Text style={{ fontSize: 14, color: cores.escuroSuave }}>
          {melhorou.length} {melhorou.length === 1 ? 'ponto melhorou' : 'pontos melhoraram'} · {piorou.length}{' '}
          {piorou.length === 1 ? 'piorou' : 'pioraram'}
        </Text>
      </View>

      {dados.alertaDeficit && (
        <View style={{ backgroundColor: cores.laranjaClaro, borderRadius: 14, padding: 14 }}>
          <Text style={{ fontSize: 14, color: cores.laranjaTexto }}>
            <Text style={{ fontWeight: '700' }}>Atenção: </Text>energia baixa e fome alta nos últimos check-ins. O déficit pode estar agressivo
            demais.
          </Text>
        </View>
      )}

      {piorou.length > 0 && <Lista titulo="Pede atenção" itens={piorou} />}
      {melhorou.length > 0 && <Lista titulo="Melhorou" itens={melhorou} />}

      <Cartao estilo={{ gap: 0, paddingVertical: 4 }}>
        <View style={{ paddingTop: 12, paddingBottom: 4 }}>
          <Rotulo>Todos os números</Rotulo>
        </View>
        {dados.itens.map((i, idx) => (
          <Linha key={i.chave} item={i} ultima={idx === dados.itens.length - 1} />
        ))}
      </Cartao>

      <Nota>
        {dados.diasComCheckin} de 7 dias com check-in · {dados.noitesAbaixoDe7h} noite{dados.noitesAbaixoDe7h === 1 ? '' : 's'} abaixo de 7 h. Quanto
        mais dias registrados, mais confiável fica a comparação.
      </Nota>
    </ScrollView>
  );
}

function Lista({ titulo, itens }: { titulo: string; itens: ItemComparacao[] }) {
  return (
    <Cartao estilo={{ gap: 0, paddingVertical: 4 }}>
      <View style={{ paddingTop: 12, paddingBottom: 4 }}>
        <Rotulo>{titulo}</Rotulo>
      </View>
      {itens.map((i, idx) => (
        <Linha key={i.chave} item={i} ultima={idx === itens.length - 1} />
      ))}
    </Cartao>
  );
}

function Linha({ item, ultima }: { item: ItemComparacao; ultima: boolean }) {
  const e = ESTILO_TENDENCIA[item.tendencia];
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: ultima ? 0 : 1, borderBottomColor: cores.linhaSuave }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: cores.tinta }}>{NOMES[item.chave]}</Text>
        <Text style={{ fontSize: 12, color: cores.cinza }}>
          {formatar(item.chave, item.anterior)} → {formatar(item.chave, item.atual)}
        </Text>
      </View>
      <View style={{ backgroundColor: e.fundo, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: e.cor }}>
          {e.seta} {e.texto}
        </Text>
      </View>
    </View>
  );
}
