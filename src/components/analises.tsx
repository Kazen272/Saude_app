import { Text, View } from 'react-native';

import { GraficoSemanas } from '@/components/graficos';
import { CabecalhoCartao, Cartao, Nota } from '@/components/ui';
import type { Prontidao } from '@/lib/analises';
import type { Analises } from '@/lib/dados';
import { decimal, diaCurto, milhar } from '@/lib/datas';
import { EXPLICACOES } from '@/lib/explicacoes';
import { cores } from '@/lib/tema';

// ---------------------------------------------------------------------------
// Constância

export function CartaoConstancia({ a }: { a: Analises | null }) {
  const c = a?.constancia;
  const corNota = c == null ? cores.cinza : c.nota >= 75 ? cores.verdeTexto : c.nota >= 50 ? cores.tinta : cores.laranja;
  return (
    <Cartao estilo={{ gap: 12 }}>
      <CabecalhoCartao titulo="Constância · últimos 7 dias" info={EXPLICACOES.constancia} />
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
        <Text style={{ fontSize: 40, fontWeight: '800', color: corNota, fontVariant: ['tabular-nums'] }}>{c ? c.nota : '—'}</Text>
        <Text style={{ fontSize: 15, fontWeight: '600', color: cores.cinza }}>de 100</Text>
      </View>
      {c && (
        <View style={{ gap: 10 }}>
          {c.itens.map((i) => (
            <View key={i.id} style={{ gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                <Text style={{ fontSize: 13, color: cores.tintaSuave, flexShrink: 1 }}>{i.nome}</Text>
                <Text style={{ fontSize: 13, fontWeight: '700', color: cores.tinta, fontVariant: ['tabular-nums'] }}>
                  {Math.min(i.feito, i.meta)}/{i.meta} · {i.pontos} pts
                </Text>
              </View>
              <View style={{ height: 6, borderRadius: 3, backgroundColor: cores.linhaSuave }}>
                <View style={{ width: `${(i.pontos / i.max) * 100}%`, height: 6, borderRadius: 3, backgroundColor: i.pontos === i.max ? cores.verde : cores.azul }} />
              </View>
            </View>
          ))}
        </View>
      )}
      {a && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Sequencia n={a.sequencias.dieta} texto="com dieta registrada" />
          <Sequencia n={a.sequencias.agua} texto="na meta de água" />
          <Sequencia n={a.sequencias.deficit} texto="em déficit" />
        </View>
      )}
      <Text style={{ fontSize: 13, fontWeight: '700', color: cores.tinta }}>Nota por semana</Text>
      <GraficoSemanas
        semanas={(a?.constanciaSemanas ?? []).map((s) => ({ semana: s.semana, valor: s.nota || null }))}
        formatar={(v) => String(v)}
        meta={{ valor: 75, texto: 'boa 75' }}
        rotulo="Nota de constância por semana"
        vazio="A nota de cada semana aparece aqui."
      />
    </Cartao>
  );
}

function Sequencia({ n, texto }: { n: number; texto: string }) {
  const ativa = n >= 2;
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: ativa ? cores.verdeClaro : cores.linhaSuave }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: ativa ? cores.verdeEscuro : cores.cinza }}>
        {n} dia{n === 1 ? '' : 's'} seguido{n === 1 ? '' : 's'} {texto}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Padrões

export function CartaoPadroes({ a }: { a: Analises | null }) {
  return (
    <Cartao estilo={{ gap: 10 }}>
      <CabecalhoCartao titulo="Padrões nos seus dados" info={EXPLICACOES.padroes} />
      {a && a.padroes.length === 0 && (
        <Nota>Ainda sem padrões claros. Eles aparecem com algumas semanas de sono, dieta e check-in registrados (pelo menos 3 dias de cada lado da comparação).</Nota>
      )}
      {a?.padroes.map((p, i) => (
        <View key={p.id} style={{ gap: 4, paddingTop: i ? 10 : 0, borderTopWidth: i ? 1 : 0, borderTopColor: cores.linhaSuave }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: cores.tinta }}>{p.titulo}</Text>
          <Text style={{ fontSize: 14, lineHeight: 20, color: cores.tintaSuave }}>{p.texto}</Text>
          <Text style={{ fontSize: 12, color: cores.cinza }}>{p.comoCalcula}</Text>
        </View>
      ))}
    </Cartao>
  );
}

// ---------------------------------------------------------------------------
// Platô e recomposição

export function CartoesSinais({ a }: { a: Analises | null }) {
  if (!a?.sinais.length) return null;
  return (
    <>
      {a.sinais.map((s) => (
        <View
          key={s.tipo}
          style={{ backgroundColor: s.tipo === 'recomposicao' ? cores.verdeClaro : cores.laranjaClaro, borderRadius: 18, padding: 16, gap: 6 }}
        >
          <CabecalhoCartao titulo={s.titulo} info={EXPLICACOES.sinais} />
          <Text style={{ fontSize: 14, lineHeight: 20, color: s.tipo === 'recomposicao' ? cores.verdeEscuro : cores.laranjaTexto }}>{s.texto}</Text>
        </View>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// % de gordura pelas dobras

export function CartaoGordura({ a }: { a: Analises | null }) {
  const lista = a?.gordura ?? [];
  const atual = lista.at(-1);
  const primeira = lista[0];
  return (
    <Cartao estilo={{ gap: 10 }}>
      <CabecalhoCartao titulo="% de gordura (dobras)" info={EXPLICACOES.gordura} direita={atual ? <Text style={{ fontSize: 12, color: cores.cinza }}>{diaCurto(atual.dia)}</Text> : undefined} />
      {!atual ? (
        <Nota>Registre as 7 dobras cutâneas da avaliação física em Registrar › Mais medidas, no dia em que ela foi feita. É preciso ter sexo e data de nascimento no perfil.</Nota>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Bloco rotulo="Gordura" valor={`${decimal(atual.pct)}%`} />
            <Bloco rotulo="Massa gorda" valor={atual.massaGordaKg != null ? `${decimal(atual.massaGordaKg)} kg` : '—'} />
            <Bloco rotulo="Massa magra" valor={atual.massaMagraKg != null ? `${decimal(atual.massaMagraKg)} kg` : '—'} />
          </View>
          {lista.length > 1 && primeira && (
            <Text style={{ fontSize: 13, color: cores.tintaSuave }}>
              Desde {diaCurto(primeira.dia)}: {atual.pct <= primeira.pct ? '−' : '+'}
              {decimal(Math.abs(atual.pct - primeira.pct))} ponto{Math.abs(atual.pct - primeira.pct) >= 2 ? 's' : ''} de gordura
              {atual.massaMagraKg != null && primeira.massaMagraKg != null
                ? ` · massa magra ${atual.massaMagraKg >= primeira.massaMagraKg ? '+' : '−'}${decimal(Math.abs(atual.massaMagraKg - primeira.massaMagraKg))} kg`
                : ''}
            </Text>
          )}
        </>
      )}
    </Cartao>
  );
}

function Bloco({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
      <Text style={{ fontSize: 12, color: cores.cinza }} numberOfLines={1}>
        {rotulo}
      </Text>
      <Text style={{ fontSize: 18, fontWeight: '800', color: cores.tinta, fontVariant: ['tabular-nums'] }} numberOfLines={1} adjustsFontSizeToFit>
        {valor}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Qualidade da dieta

export function CartaoQualidadeDieta({ a, metaProteina }: { a: Analises | null; metaProteina: { min: number; max: number } | null }) {
  const d = a?.dieta7;
  const linhas: { nome: string; valor: string; ref: string; ok: boolean | null }[] = d
    ? [
        {
          nome: 'Proteína',
          valor: d.proteinaGkg != null ? `${decimal(d.proteinaGkg)} g/kg` : '—',
          ref: metaProteina ? `meta 1,6–2,2 g/kg (${metaProteina.min}–${metaProteina.max} g)` : 'meta 1,6–2,2 g/kg',
          ok: d.proteinaGkg == null ? null : d.proteinaGkg >= 1.6,
        },
        { nome: 'Fibra', valor: d.fibra != null ? `${Math.round(d.fibra)} g` : '—', ref: 'meta 25–30 g', ok: d.fibra == null ? null : d.fibra >= 25 },
        {
          nome: 'Sódio',
          valor: d.sodioMg != null ? `${milhar(d.sodioMg)} mg` : '—',
          ref: 'até 2.000 mg (OMS)',
          ok: d.sodioMg == null ? null : d.sodioMg <= 2000,
        },
        { nome: 'Açúcar (total)', valor: d.acucar != null ? `${Math.round(d.acucar)} g` : '—', ref: 'inclui frutas e leite', ok: null },
      ]
    : [];
  return (
    <Cartao estilo={{ gap: 4 }}>
      <CabecalhoCartao titulo="Qualidade da dieta · média 7 dias" info={EXPLICACOES.dieta} />
      {d && d.dias === 0 && <Nota>Nenhum dia com dieta registrada na última semana.</Nota>}
      {d &&
        d.dias > 0 &&
        linhas.map((l, i) => (
          <View
            key={l.nome}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: i === linhas.length - 1 ? 0 : 1, borderBottomColor: cores.linhaSuave }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontSize: 14, color: cores.tintaSuave }}>{l.nome}</Text>
              <Text style={{ fontSize: 12, color: cores.cinza }}>{l.ref}</Text>
            </View>
            <Text style={{ fontSize: 15, fontWeight: '800', color: l.ok === false ? cores.laranja : l.ok ? cores.verdeTexto : cores.tinta, fontVariant: ['tabular-nums'] }}>{l.valor}</Text>
          </View>
        ))}
      {d && d.dias > 0 && d.fibra == null && <Nota>Fibra, sódio e açúcar passam a aparecer a partir da próxima sincronização com o FatSecret.</Nota>}
    </Cartao>
  );
}

// ---------------------------------------------------------------------------
// Recuperação (tela Hoje)

const NIVEIS = {
  boa: { nome: 'Boa', fundo: () => cores.verdeClaro, cor: () => cores.verdeEscuro },
  media: { nome: 'Média', fundo: () => cores.segmento, cor: () => cores.tinta },
  baixa: { nome: 'Baixa', fundo: () => cores.laranjaClaro, cor: () => cores.laranjaTexto },
};

export function CartaoProntidao({ p }: { p: Prontidao | null }) {
  if (!p) return null;
  const n = NIVEIS[p.nivel];
  return (
    <Cartao estilo={{ gap: 6 }}>
      <CabecalhoCartao
        titulo="Recuperação de hoje"
        info={EXPLICACOES.prontidao}
        direita={
          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: n.fundo() }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: n.cor() }}>
              {n.nome} · {p.pontos}
            </Text>
          </View>
        }
      />
      <Text style={{ fontSize: 15, fontWeight: '700', color: cores.tinta }}>{p.sugestao}</Text>
      <Nota>{p.motivos.join(' · ')}</Nota>
    </Cartao>
  );
}
