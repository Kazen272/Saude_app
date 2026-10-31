import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

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
  const [aberto, setAberto] = useState(false);
  if (!p) return null;
  const n = NIVEIS[p.nivel];
  return (
    <Cartao estilo={{ gap: 8 }}>
      <CabecalhoCartao
        titulo="Recuperação de hoje"
        info={EXPLICACOES.prontidao}
        direita={
          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: n.fundo() }}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: n.cor() }}>
              {n.nome}
              {p.completa ? ` · ${p.pontos}` : ' · parcial'}
            </Text>
          </View>
        }
      />
      <Text style={{ fontSize: 15, fontWeight: '700', color: cores.tinta }}>{p.sugestao}</Text>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: aberto }} onPress={() => setAberto((v) => !v)} style={{ minHeight: 32, justifyContent: 'center' }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: cores.verdeTexto }}>{aberto ? 'esconder o que pesou' : 'ver o que pesou'}</Text>
      </Pressable>
      {aberto && (
        <View>
          {p.fatores.map((f, i) => (
            <View
              key={f.id}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: cores.linhaSuave }}
            >
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: f.status === 'atencao' ? cores.laranja : f.status === 'ok' ? cores.verde : cores.linha }} />
              <View style={{ flex: 1, gap: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: cores.tinta }}>{f.nome}</Text>
                <Text style={{ fontSize: 12, color: cores.cinza }}>{f.texto}</Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: '800', color: f.desconto ? cores.laranja : cores.cinza, fontVariant: ['tabular-nums'] }}>
                {f.status === 'sem_dado' ? '—' : f.desconto ? `−${f.desconto}` : '0'}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Cartao>
  );
}

// ---------------------------------------------------------------------------
// Sua semana × meta (aba Calorias)

export function CartaoSemanaMeta({ a }: { a: Analises | null }) {
  const m = a?.meta;
  if (!m) {
    return (
      <Cartao estilo={{ gap: 4 }}>
        <CabecalhoCartao titulo="Sua semana × meta" info={EXPLICACOES.semanaMeta} />
        <Nota>Defina uma meta em Mais › Meta de calorias (ou complete o perfil para usar a sugerida).</Nota>
      </Cartao>
    );
  }
  const s = m.semana;
  const u = m.ultimos7;
  const pct = u.planejado && u.planejado > 0 && u.conseguido != null ? Math.round((u.conseguido / u.planejado) * 100) : null;
  return (
    <Cartao estilo={{ gap: 12 }}>
      <CabecalhoCartao
        titulo="Sua semana × meta"
        info={EXPLICACOES.semanaMeta}
        direita={<Text style={{ fontSize: 12, color: cores.cinza }}>{m.sugerida ? 'meta sugerida' : 'meta'} {milhar(m.kcal)}/dia</Text>}
      />

      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: cores.tinta }}>Orçamento da semana</Text>
          <Text style={{ fontSize: 13, color: cores.tintaSuave, fontVariant: ['tabular-nums'] }}>
            {milhar(s.usado)} de {milhar(s.orcamento)} kcal
          </Text>
        </View>
        <Barra fracao={s.usado / s.orcamento} cor={s.restante < 0 ? cores.laranja : cores.verde} />
        <Text style={{ fontSize: 13, color: s.restante < 0 ? cores.laranja : cores.tintaSuave, fontWeight: s.restante < 0 ? '700' : '400' }}>
          {s.restante >= 0
            ? `Sobram ${milhar(s.restante)} kcal para ${s.diasRestantes} dia${s.diasRestantes === 1 ? '' : 's'} (≈ ${milhar(s.porDiaRestante)} por dia, contando hoje).`
            : `${milhar(-s.restante)} kcal acima do orçamento da semana.`}
        </Text>
      </View>

      <View style={{ gap: 2, borderTopWidth: 1, borderTopColor: cores.linhaSuave, paddingTop: 10 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: cores.tinta }}>Últimos 7 dias completos</Text>
        <Linha rotulo="Média comida por dia" valor={u.mediaConsumo != null ? `${milhar(u.mediaConsumo)} kcal` : '—'} destaque={u.mediaConsumo != null && u.mediaConsumo > m.kcal * 1.1 ? 'ruim' : u.mediaConsumo != null ? 'bom' : null} />
        <Linha rotulo="Dias dentro da meta" valor={u.diasComDieta ? `${u.diasDentro} de ${u.diasComDieta}` : '—'} destaque={null} />
        <Linha rotulo="Déficit planejado pela meta" valor={u.planejado != null ? `${milhar(u.planejado)} kcal` : '—'} destaque={null} />
        <Linha rotulo="Déficit conseguido" valor={u.conseguido != null ? `${milhar(u.conseguido)} kcal` : '—'} destaque={u.conseguido != null && u.conseguido < 0 ? 'ruim' : null} />
      </View>
      {pct != null && (
        <View style={{ gap: 6 }}>
          <Barra fracao={pct / 100} cor={pct >= 80 ? cores.verde : cores.laranja} />
          <Text style={{ fontSize: 13, color: cores.tintaSuave }}>
            Você fez {pct}% do déficit planejado
            {u.conseguido != null ? ` (≈ ${decimal(Math.max(0, u.conseguido) / 7700, 2)} kg de gordura na semana)` : ''}.
          </Text>
        </View>
      )}
    </Cartao>
  );
}

function Linha({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque: 'bom' | 'ruim' | null }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8, paddingVertical: 6 }}>
      <Text style={{ fontSize: 14, color: cores.tintaSuave, flexShrink: 1 }}>{rotulo}</Text>
      <Text style={{ fontSize: 14, fontWeight: '800', color: destaque === 'ruim' ? cores.laranja : destaque === 'bom' ? cores.verdeTexto : cores.tinta, fontVariant: ['tabular-nums'] }}>
        {valor}
      </Text>
    </View>
  );
}

function Barra({ fracao, cor }: { fracao: number; cor: string }) {
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: cores.linhaSuave }}>
      <View style={{ width: `${Math.max(0, Math.min(1, fracao)) * 100}%`, height: 8, borderRadius: 4, backgroundColor: cor }} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Desde o começo (aba Resumo)

export function CartaoDesdeInicio({ a }: { a: Analises | null }) {
  const d = a?.meta?.desdeInicio;
  if (!d) return null;
  const kgBalanca = d.kgNaBalanca;
  const cintura = d.cintura ? d.cintura.para - d.cintura.de : null;
  let leitura = '';
  if (d.diasComDieta < 7) leitura = 'Com poucos dias registrados, os números ainda oscilam bastante.';
  else if (kgBalanca != null && d.kgPelasCalorias > 0.5 && -kgBalanca < d.kgPelasCalorias / 2)
    leitura =
      cintura != null && cintura < -1
        ? 'A balança caiu menos que as calorias indicam, mas a cintura diminuiu: sinal de perda de gordura com retenção de água ou ganho de músculo.'
        : 'A balança caiu menos que as calorias indicam. Causas comuns: retenção de água, refeições não registradas ou gasto superestimado. O ajuste do previsto × real corrige isso com o tempo.';
  else if (kgBalanca != null && -kgBalanca > Math.max(0, d.kgPelasCalorias) * 1.5 + 0.5)
    leitura = 'A balança caiu mais do que as calorias explicam. No começo de um déficit, parte da queda costuma ser água e glicogênio; com as semanas, as duas linhas tendem a se aproximar.';
  else if (kgBalanca != null && d.kgPelasCalorias > 0 && -kgBalanca >= d.kgPelasCalorias / 2)
    leitura = 'Balança e calorias contam a mesma história: o déficit está virando perda de peso.';
  return (
    <Cartao estilo={{ gap: 10 }}>
      <CabecalhoCartao titulo={`Desde o começo · ${diaCurto(d.inicio)}`} info={EXPLICACOES.desdeInicio} />
      <View style={{ gap: 2 }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: d.deficitTotal >= 0 ? cores.tinta : cores.laranja, fontVariant: ['tabular-nums'] }}>
          {milhar(Math.abs(d.deficitTotal))} kcal de {d.deficitTotal >= 0 ? 'déficit' : 'superávit'}
        </Text>
        <Nota>
          soma de {d.diasComDieta} dia{d.diasComDieta === 1 ? '' : 's'} com dieta registrada, em {d.dias} dia{d.dias === 1 ? '' : 's'}
        </Nota>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Bloco rotulo="Pelas calorias" valor={`${d.kgPelasCalorias > 0 ? '−' : '+'}${decimal(Math.abs(d.kgPelasCalorias))} kg`} />
        <Bloco rotulo="Na balança" valor={kgBalanca != null ? `${kgBalanca <= 0 ? '−' : '+'}${decimal(Math.abs(kgBalanca))} kg` : '—'} />
        <Bloco rotulo="Cintura" valor={cintura != null ? `${cintura <= 0 ? '−' : '+'}${decimal(Math.abs(cintura))} cm` : '—'} />
      </View>
      {leitura !== '' && <Text style={{ fontSize: 13, lineHeight: 19, color: cores.tintaSuave }}>{leitura}</Text>}
      <Text style={{ fontSize: 13, fontWeight: '700', color: cores.tinta }}>Déficit por semana</Text>
      <GraficoSemanas
        semanas={d.semanas.map((s) => ({ semana: s.semana, valor: s.deficit != null && s.deficit > 0 ? s.deficit : null }))}
        formatar={(v) => (v >= 1000 ? `${decimal(v / 1000)} mil` : String(v))}
        rotulo="Déficit somado por semana"
        vazio="O déficit de cada semana aparece aqui."
      />
    </Cartao>
  );
}
