/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { previstoVersusReal, resumirPeriodo } from './relatorios.ts';

describe('resumirPeriodo', () => {
  it('soma só dias completos no déficit', () => {
    const r = resumirPeriodo([
      { dia: '2026-10-22', gasto: 2500, consumo: 2000 },
      { dia: '2026-10-23', gasto: 2400, consumo: null },
      { dia: '2026-10-24', gasto: 2300, consumo: 2450 },
    ]);
    assert.deepEqual(r, { gastoTotal: 7200, consumoTotal: 4450, deficitTotal: 350, diasComDieta: 2 });
  });
  it('devolve vazio quando não há dados', () => {
    assert.deepEqual(resumirPeriodo([{ dia: '2026-10-22', gasto: null, consumo: null }]), {
      gastoTotal: null,
      consumoTotal: null,
      deficitTotal: null,
      diasComDieta: 0,
    });
  });
});

describe('previstoVersusReal', () => {
  it('compara a perda prevista pelas calorias com a real', () => {
    assert.deepEqual(previstoVersusReal({ deficitAcumuladoKcal: 15400, pesoInicialKg: 92, pesoFinalKg: 90.5 }), {
      previstoKg: 2,
      realKg: 1.5,
      diferencaKg: -0.5,
    });
  });
});
