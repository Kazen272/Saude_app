import { Text, View } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Rect, Text as SvgTexto } from 'react-native-svg';

import type { Pesagem, Projecao } from '@/lib/calculos';
import { decimal, diaCurto, milhar, somarDias } from '@/lib/datas';
import { useLarguraDoCartao } from '@/components/ui';
import { cores } from '@/lib/tema';

const emDias = (dia: string) => Date.parse(dia + 'T00:00:00Z') / 86_400_000;


function Vazio({ altura, texto }: { altura: number; texto: string }) {
  return (
    <View
      style={{
        height: altura,
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: cores.linha,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <Text style={{ fontSize: 13, color: cores.cinza, textAlign: 'center' }}>{texto}</Text>
    </View>
  );
}

/**
 * Curva do peso (média de 7 dias) com pesagens do dia em pontos, linha da meta
 * e projeção tracejada. Projeções muito longas são cortadas na borda do gráfico.
 */
export function GraficoPeso({
  medias,
  pesagens,
  metaKg,
  projecao,
  hoje,
  periodoDias,
}: {
  medias: Pesagem[];
  pesagens: Pesagem[];
  metaKg: number | null;
  projecao: Projecao | null;
  hoje: string;
  periodoDias: number;
}) {
  const largura = useLarguraDoCartao();
  const altura = 190;

  if (medias.length < 2) {
    return (
      <View>
        <Vazio altura={altura} texto="Registre o peso por alguns dias para ver a curva e a projeção." />
      </View>
    );
  }

  const ultima = medias[medias.length - 1];
  const inicio = medias[0].dia;

  // Projeção: do último ponto até a meta, limitada a um período à frente.
  let fimProj: { dia: string; peso: number } | null = null;
  let projCortada = false;
  if (projecao?.estado === 'no_caminho' && metaKg != null) {
    const limite = somarDias(hoje, Math.max(14, Math.round(periodoDias / 2)));
    if (projecao.data <= limite) {
      fimProj = { dia: projecao.data, peso: metaKg };
    } else {
      projCortada = true;
      const fracao = (emDias(limite) - emDias(ultima.dia)) / (emDias(projecao.data) - emDias(ultima.dia));
      fimProj = { dia: limite, peso: ultima.pesoKg + (metaKg - ultima.pesoKg) * fracao };
    }
  }

  const fimEixo = fimProj?.dia ?? (hoje > ultima.dia ? hoje : ultima.dia);
  const valores = [...medias.map((m) => m.pesoKg), ...pesagens.map((p) => p.pesoKg)];
  if (metaKg != null) valores.push(metaKg);
  if (fimProj) valores.push(fimProj.peso);
  const minY = Math.floor(Math.min(...valores) - 0.5);
  const maxY = Math.ceil(Math.max(...valores) + 0.5);

  const margem = { esq: 30, dir: 12, topo: 14, base: 24 };
  const w = Math.max(largura, 200);
  const x = (dia: string) =>
    margem.esq + ((emDias(dia) - emDias(inicio)) / Math.max(1, emDias(fimEixo) - emDias(inicio))) * (w - margem.esq - margem.dir);
  const y = (kg: number) => margem.topo + ((maxY - kg) / Math.max(0.1, maxY - minY)) * (altura - margem.topo - margem.base);

  const passo = Math.max(1, Math.round((maxY - minY) / 3));
  const marcas: number[] = [];
  for (let v = maxY; v >= minY; v -= passo) marcas.push(v);

  const pontos = medias.map((m) => `${x(m.dia)},${y(m.pesoKg)}`).join(' ');
  const descricao = `Peso médio foi de ${decimal(medias[0].pesoKg)} para ${decimal(ultima.pesoKg)} kg${
    projecao?.estado === 'no_caminho' ? `; projeção de meta em ${diaCurto(projecao.data)}` : ''
  }`;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={descricao}>
      {largura > 0 && (
        <Svg width={w} height={altura}>
          {marcas.map((v) => (
            <Line key={`g${v}`} x1={margem.esq} x2={w - margem.dir} y1={y(v)} y2={y(v)} stroke={cores.linhaSuave} />
          ))}
          {marcas.map((v) => (
            <SvgTexto key={`t${v}`} x={0} y={y(v) + 4} fontSize={11} fill={cores.cinza}>
              {String(v)}
            </SvgTexto>
          ))}
          {metaKg != null && (
            <>
              <Line x1={margem.esq} x2={w - margem.dir} y1={y(metaKg)} y2={y(metaKg)} stroke={cores.laranja} strokeWidth={1.25} strokeDasharray="2 4" />
              <SvgTexto x={w - margem.dir} y={y(metaKg) - 6} fontSize={11} fontWeight="700" fill={cores.laranja} textAnchor="end">
                {`meta ${decimal(metaKg, metaKg % 1 === 0 ? 0 : 1)} kg`}
              </SvgTexto>
            </>
          )}
          {pesagens.map((p) => (
            <Circle key={p.dia} cx={x(p.dia)} cy={y(p.pesoKg)} r={2.5} fill={cores.verde} fillOpacity={0.3} />
          ))}
          {fimProj && (
            <Line
              x1={x(ultima.dia)}
              y1={y(ultima.pesoKg)}
              x2={x(fimProj.dia)}
              y2={y(fimProj.peso)}
              stroke={cores.verde}
              strokeWidth={2}
              strokeDasharray="5 5"
            />
          )}
          <Polyline points={pontos} fill="none" stroke={cores.verde} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          <Circle cx={x(ultima.dia)} cy={y(ultima.pesoKg)} r={5} fill="#FFFFFF" stroke={cores.verde} strokeWidth={2.5} />
          <SvgTexto x={x(ultima.dia)} y={y(ultima.pesoKg) - 10} fontSize={11} fontWeight="700" fill={cores.tinta} textAnchor="middle">
            {decimal(ultima.pesoKg)}
          </SvgTexto>
          <SvgTexto x={margem.esq} y={altura - 6} fontSize={11} fill={cores.cinza}>
            {diaCurto(inicio)}
          </SvgTexto>
          <SvgTexto x={w - margem.dir} y={altura - 6} fontSize={11} fill={cores.cinza} textAnchor="end">
            {fimProj ? `${projCortada ? '→ ' : ''}${diaCurto(fimProj.dia)}` : 'hoje'}
          </SvgTexto>
        </Svg>
      )}
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 6 }}>
        <Legenda cor={cores.verde} texto="Média 7 dias" />
        <Legenda cor={cores.verde} texto="Projeção" tracejada />
      </View>
    </View>
  );
}

function Legenda({ cor, texto, tracejada = false }: { cor: string; texto: string; tracejada?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 16, height: 0, borderTopWidth: tracejada ? 2 : 3, borderTopColor: cor, borderStyle: tracejada ? 'dashed' : 'solid' }} />
      <Text style={{ fontSize: 12, color: cores.cinza }}>{texto}</Text>
    </View>
  );
}

const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/** Barras do déficit diário: verde abaixo do gasto, laranja acima; dia sem dado em cinza. */
export function GraficoDeficit({ dias, hoje }: { dias: { dia: string; deficit: number | null }[]; hoje: string }) {
  const largura = useLarguraDoCartao();
  const altura = 150;

  if (dias.every((d) => d.deficit == null)) {
    return (
      <View>
        <Vazio altura={altura} texto="O déficit diário aparece aqui quando a dieta do FatSecret e o perfil estiverem completos." />
      </View>
    );
  }

  const w = Math.max(largura, 200);
  const maxAbs = Math.max(500, ...dias.map((d) => Math.abs(d.deficit ?? 0)));
  const topo = 18;
  const base = 22;
  const area = altura - topo - base;
  // Espaço acima e abaixo do zero proporcional aos maiores valores de cada lado,
  // com folga para os rótulos; a mesma escala vale para os dois lados.
  const maxPos = Math.max(0, ...dias.map((d) => d.deficit ?? 0));
  const maxNeg = Math.max(0, ...dias.map((d) => -(d.deficit ?? 0)));
  const rotulo = 14;
  const parteNeg = maxNeg > 0 ? Math.min(0.5, Math.max(0.22, maxNeg / (maxPos + maxNeg))) : 0;
  const zeroY = topo + area * (1 - parteNeg);
  const escala = Math.min(
    maxPos > 0 ? (area * (1 - parteNeg)) / maxPos : Infinity,
    maxNeg > 0 ? (area * parteNeg - rotulo) / maxNeg : Infinity,
    area / Math.max(maxAbs, 1),
  );
  const coluna = w / dias.length;
  const barra = Math.min(28, coluna * 0.55);

  const descricao = dias
    .map((d) => `${DIAS_CURTOS[new Date(d.dia + 'T12:00:00').getDay()]}: ${d.deficit == null ? 'sem dados' : `${milhar(d.deficit)} kcal`}`)
    .join(', ');

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`Déficit diário. ${descricao}`}>
      {largura > 0 && (
        <Svg width={w} height={altura}>
          {dias.map((d, i) => {
            const cx = coluna * i + coluna / 2;
            const v = d.deficit;
            const ehHoje = d.dia === hoje;
            const rotuloDia = ehHoje ? 'Hoje' : DIAS_CURTOS[new Date(d.dia + 'T12:00:00').getDay()];
            if (v == null) {
              return (
                <G key={d.dia}>
                  <Rect x={cx - barra / 2} y={zeroY - 3} width={barra} height={3} rx={1.5} fill={cores.linha} />
                  <SvgTexto x={cx} y={zeroY - 8} fontSize={10.5} fill={cores.cinza} textAnchor="middle">
                    —
                  </SvgTexto>
                  <SvgTexto x={cx} y={altura - 4} fontSize={11} fill={cores.cinza} textAnchor="middle">
                    {rotuloDia}
                  </SvgTexto>
                </G>
              );
            }
            const h = Math.max(2, Math.abs(v) * escala);
            const positivo = v >= 0;
            return (
              <G key={d.dia}>
                <Rect
                  x={cx - barra / 2}
                  y={positivo ? zeroY - h : zeroY}
                  width={barra}
                  height={h}
                  rx={4}
                  fill={positivo ? cores.verde : cores.laranja}
                  fillOpacity={ehHoje ? 0.5 : 1}
                />
                <SvgTexto
                  x={cx}
                  // abaixo do zero, o rótulo não pode invadir a linha dos dias da semana
                  y={positivo ? zeroY - h - 5 : Math.min(zeroY + h + 12, altura - base - 2)}
                  fontSize={10.5}
                  fontWeight={positivo ? '400' : '700'}
                  fill={positivo ? cores.tintaSuave : cores.laranja}
                  textAnchor="middle"
                >
                  {positivo ? milhar(v) : `+${milhar(-v)}`}
                </SvgTexto>
                <SvgTexto x={cx} y={altura - 4} fontSize={11} fontWeight={ehHoje ? '700' : '400'} fill={ehHoje ? cores.tinta : cores.cinza} textAnchor="middle">
                  {rotuloDia}
                </SvgTexto>
              </G>
            );
          })}
          <Line x1={0} x2={w} y1={zeroY} y2={zeroY} stroke="#9AA39D" />
        </Svg>
      )}
    </View>
  );
}

/**
 * Barras por semana (8 semanas, da mais antiga à atual). Semanas sem dado ficam
 * como um traço. A semana atual fica mais clara: ainda não terminou.
 */
export function GraficoSemanas({
  semanas,
  formatar,
  cor = cores.verde,
  meta,
  rotulo,
  vazio,
}: {
  semanas: { semana: string; valor: number | null }[];
  formatar: (v: number) => string;
  cor?: string;
  meta?: { valor: number; texto: string };
  rotulo: string;
  vazio: string;
}) {
  const largura = useLarguraDoCartao();
  const altura = 132;
  if (semanas.every((s) => s.valor == null || s.valor === 0)) {
    return (
      <View style={{ height: 72, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: cores.linha, alignItems: 'center', justifyContent: 'center', padding: 12 }}>
        <Text style={{ fontSize: 13, color: cores.cinza, textAlign: 'center' }}>{vazio}</Text>
      </View>
    );
  }
  const w = largura;
  const topo = 18;
  const base = 22;
  const maximo = Math.max(...semanas.map((s) => s.valor ?? 0), meta?.valor ?? 0, 1);
  const y = (v: number) => topo + (1 - v / maximo) * (altura - topo - base);
  const coluna = w / semanas.length;
  const barra = Math.min(26, coluna * 0.6);
  const descricao = semanas.map((s) => `semana de ${diaCurto(s.semana)}: ${s.valor == null ? 'sem dados' : formatar(s.valor)}`).join(', ');
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`${rotulo}. ${descricao}`}>
      <Svg width={w} height={altura}>
        {meta && (
          <>
            <Line x1={0} x2={w} y1={y(meta.valor)} y2={y(meta.valor)} stroke={cores.laranja} strokeDasharray="2 4" strokeWidth={1.25} />
            <SvgTexto x={w} y={y(meta.valor) - 4} fontSize={10.5} fill={cores.laranja} textAnchor="end" fontWeight="700">
              {meta.texto}
            </SvgTexto>
          </>
        )}
        {semanas.map((s, i) => {
          const cx = coluna * i + coluna / 2;
          const atual = i === semanas.length - 1;
          const rotuloX = atual ? 'atual' : diaCurto(s.semana);
          return (
            <G key={s.semana}>
              {s.valor != null && s.valor > 0 ? (
                <>
                  <Rect x={cx - barra / 2} y={y(s.valor)} width={barra} height={y(0) - y(s.valor)} rx={4} fill={cor} fillOpacity={atual ? 0.45 : 1} />
                  {(i % 2 === 1 || atual) && (
                    <SvgTexto x={cx} y={y(s.valor) - 4} fontSize={10} fill={cores.tintaSuave} textAnchor="middle">
                      {formatar(s.valor)}
                    </SvgTexto>
                  )}
                </>
              ) : (
                <Rect x={cx - barra / 2} y={y(0) - 3} width={barra} height={3} rx={1.5} fill={cores.linha} />
              )}
              {(i % 2 === 1 || atual) && (
                <SvgTexto x={cx} y={altura - 4} fontSize={10.5} fill={atual ? cores.tinta : cores.cinza} fontWeight={atual ? '700' : '400'} textAnchor="middle">
                  {rotuloX}
                </SvgTexto>
              )}
            </G>
          );
        })}
      </Svg>
    </View>
  );
}
