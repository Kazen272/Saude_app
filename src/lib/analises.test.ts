/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { constanciaDaSemana, encontrarPadroes, gorduraPollock7, prontidao, sequencias, sinaisDoCorpo, type DiaConsolidado } from './analises.ts';

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
  it('desconta FC alta, sono curto e energia baixa', () => {
    const p = prontidao({ fcHoje: 68, fcMedia: 60, sonoMin: 330, energia: 2 });
    assert.equal(p?.pontos, 7); // 100 − 48 − 25 − 20
    assert.equal(p?.nivel, 'baixa');
    assert.equal(prontidao({ fcHoje: null, fcMedia: null, sonoMin: 460, energia: 4 })?.nivel, 'boa');
    assert.equal(prontidao({ fcHoje: null, fcMedia: 60, sonoMin: null, energia: null }), null);
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
