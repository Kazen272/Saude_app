/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { desdeOInicio, metaNoPeriodo, resumirSemana, semanaAtual, constanciaDaSemana, encontrarPadroes, gorduraPollock7, prontidao, sequencias, sinaisDoCorpo, type DiaConsolidado } from './analises.ts';

const dia = (d: string, p: Partial<DiaConsolidado> = {}): DiaConsolidado => ({
  dia: d,
  consumo: null,
  gasto: null,
  sonoMin: null,
  fome: null,
  energia: null,
  humor: null,
  treinou: false,
  aguaMl: 0,
  pesou: false,
  ...p,
});

describe('encontrarPadroes', () => {
  it('sono curto: come mais no dia seguinte', () => {
    const dias = [
      ...['2026-10-05', '2026-10-06', '2026-10-07'].map((d) => dia(d, { sonoMin: 300, consumo: 2600, fome: 4 })),
      ...['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'].map((d) => dia(d, { sonoMin: 450, consumo: 2100, fome: 3 })),
    ];
    const p = encontrarPadroes(dias).find((x) => x.id === 'sono-consumo');
    assert.ok(p);
    assert.match(p.texto, /500 kcal a mais/);
    assert.match(p.texto, /fome no check-in foi 4,0 contra 3,0/);
  });
  it('fim de semana com mais consumo; nada sem dados suficientes', () => {
    const dias = [
      ...['2026-10-24', '2026-10-25', '2026-10-31'].map((d) => dia(d, { consumo: 3000 })), // sáb, dom, sáb
      ...['2026-10-26', '2026-10-27', '2026-10-28'].map((d) => dia(d, { consumo: 2000 })),
    ];
    assert.ok(encontrarPadroes(dias).some((p) => p.id === 'fim-de-semana'));
    assert.deepEqual(encontrarPadroes(dias.slice(0, 2)), []);
  });
});

describe('constância', () => {
  it('nota por componente e sequências', () => {
    const semana = ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'].map((d, i) =>
      dia(d, { consumo: i < 5 ? 2000 : null, gasto: 2400, aguaMl: i % 2 ? 3000 : 1000, treinou: i < 2, sonoMin: 450, pesou: i === 0 }),
    );
    const c = constanciaDaSemana(semana, 2500);
    // dieta 5/7 → 18 · água 3/7 → 6 · treinos 2/3 → 13 · sono 7/7 → 20 · peso 1/3 → 7
    assert.equal(c.nota, 64);
    assert.deepEqual(sequencias(semana, 2500), { dieta: 0, agua: 0, deficit: 0 });
    assert.deepEqual(sequencias(semana.slice(0, 5), 2500), { dieta: 5, agua: 0, deficit: 5 });
  });
});

describe('prontidão', () => {
  const base = { hoje: '2026-10-31', humor: 4, sonoMin: 460, sono3Min: 450, cargas: [], deficits3: [400, 500, 450], fcHoje: null, fcMedia: null };
  it('cansaço e dor no check-in derrubam a nota, mesmo dormindo bem', () => {
    const p = prontidao({ ...base, energia: 2, dor: 4 });
    assert.equal(p?.pontos, 70); // 100 − 15 − 15
    assert.equal(p?.nivel, 'media');
  });
  it('sem check-in nunca diz que está tudo bem', () => {
    const p = prontidao({ ...base, energia: null, dor: null, humor: null });
    assert.equal(p?.completa, false);
    assert.equal(p?.nivel, 'media');
    assert.match(p?.sugestao ?? '', /check-in/);
  });
  it('treino puxado ontem, dias seguidos e déficit grande', () => {
    const cargas = ['2026-10-28', '2026-10-29', '2026-10-30'].map((dia) => ({ dia, carga: dia === '2026-10-30' ? 480 : 300 }));
    const p = prontidao({ ...base, energia: 4, dor: 2, cargas, deficits3: [1100, 1200, 1000] });
    assert.equal(p?.pontos, 65); // −10 ontem −10 seguidos −15 déficit
    assert.ok(p?.fatores.find((f) => f.id === 'carga')?.texto.includes('3 dias seguidos'));
  });
  it('tudo bem: boa', () => {
    assert.equal(prontidao({ ...base, energia: 4, dor: 1 })?.nivel, 'boa');
  });
});

describe('sinais do corpo', () => {
  it('platô com déficit e recomposição', () => {
    const s = sinaisDoCorpo({
      mediaHoje: 100.1,
      media14Atras: 100.2,
      deficits14: Array(12).fill(400),
      cinturaAtual: { dia: '2026-10-30', cm: 100 },
      cinturaAntes: { dia: '2026-10-01', cm: 102 },
      mediaNoDiaDaCinturaAntes: 100.3,
    });
    assert.deepEqual(s.map((x) => x.tipo), ['plato', 'recomposicao']);
  });
});

describe('gorduraPollock7', () => {
  it('bate com a avaliação (180 mm, 26 anos, homem ≈ 24%)', () => {
    assert.equal(gorduraPollock7([20, 21, 22, 26, 49, 26, 16], 26, 'masculino'), 24.1);
    assert.equal(gorduraPollock7([20, 21], 26, 'masculino'), null);
  });
});


describe('meta × real', () => {
  const dias = [
    { dia: '2026-10-26', consumo: 2100, gasto: 2600 }, // seg
    { dia: '2026-10-27', consumo: 2300, gasto: 2500 },
    { dia: '2026-10-28', consumo: null, gasto: 2400 },
    { dia: '2026-10-29', consumo: 1900, gasto: 2700 },
  ];
  it('orçamento da semana', () => {
    const s = semanaAtual(dias, 2000, '2026-10-29', '2026-10-26');
    assert.deepEqual(
      { usado: s.usado, restante: s.restante, diasRestantes: s.diasRestantes, porDia: s.porDiaRestante },
      { usado: 6300, restante: 7700, diasRestantes: 4, porDia: 1925 },
    );
  });
  it('planejado × conseguido e dias dentro da meta (até 10% acima)', () => {
    const m = metaNoPeriodo(dias, 2000);
    assert.equal(m.diasComDieta, 3);
    assert.equal(m.diasDentro, 2); // 2.100 (≤ 2.200) e 1.900; 2.300 passou
    assert.equal(m.planejado, 600 + 500 + 700);
    assert.equal(m.conseguido, 500 + 200 + 800);
    assert.equal(m.mediaConsumo, 2100);
  });
  it('desde o início: total, kg e semanas', () => {
    const r = desdeOInicio({
      inicio: '2026-10-26',
      hoje: '2026-10-31',
      balancos: dias.map((d) => ({ ...d, deficit: d.consumo != null ? d.gasto - d.consumo : null })),
      mediaInicio: 105,
      mediaHoje: 104.6,
      cinturas: [{ dia: '2026-10-29', cm: 102.5 }],
      segundaAtual: '2026-10-26',
    });
    assert.equal(r.deficitTotal, 1500);
    assert.equal(r.kgPelasCalorias, 0.2);
    assert.equal(r.kgNaBalanca, -0.4);
    assert.equal(r.cintura, null);
    assert.deepEqual(r.semanas, [{ semana: '2026-10-26', deficit: 1500 }]);
  });
});

describe('semana dia a dia', () => {
  const base = { futuro: false, hoje: false, gastoEstimado: false, sonoMin: 420, aguaMl: 2000, pesoKg: null, previstas: [] };
  it('soma treinos, meta e faltas só dos dias que passaram', () => {
    const s = resumirSemana(
      '2026-11-02',
      [
        { ...base, dia: '2026-11-02', consumo: 2100, deficit: 500, treinos: ['Treino Push'] },
        { ...base, dia: '2026-11-03', consumo: 2400, deficit: 100, treinos: ['Muay Thai'] },
        { ...base, dia: '2026-11-04', consumo: null, deficit: null, treinos: [], previstas: [{ nome: 'Muay Thai', estado: 'nao_feito' }] },
        { ...base, dia: '2026-11-05', consumo: 1900, deficit: 700, treinos: [], previstas: [{ nome: 'Muay Thai', estado: 'sem_registro' }], hoje: true },
        { ...base, dia: '2026-11-06', futuro: true, consumo: null, deficit: null, treinos: [] },
        { ...base, dia: '2026-11-07', futuro: true, consumo: null, deficit: null, treinos: [] },
        { ...base, dia: '2026-11-08', futuro: true, consumo: null, deficit: null, treinos: [] },
      ],
      2000,
    );
    assert.equal(s.treinos, 2);
    assert.equal(s.diasNaMeta, 2); // 2.100 (≤ 2.200) e 1.900; 2.400 passou
    assert.equal(s.diasComDieta, 3);
    assert.equal(s.faltas, 1); // hoje ainda não conta como falta
    assert.equal(s.deficitTotal, 1300);
    assert.equal(s.dias[1].meta, 'acima');
  });
});
