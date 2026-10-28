/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { compararSemanas, previstoVersusReal, resumirPeriodo, semanaDoRelatorio, type MetricasSemana } from './relatorios.ts';

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


describe('semanaDoRelatorio', () => {
  it('no domingo, termina hoje', () => {
    assert.deepEqual(semanaDoRelatorio('2026-11-01'), { inicio: '2026-10-26', fim: '2026-11-01' });
  });
  it('nos outros dias, é a última semana completa', () => {
    assert.deepEqual(semanaDoRelatorio('2026-10-28'), { inicio: '2026-10-19', fim: '2026-10-25' });
  });
});

describe('compararSemanas', () => {
  const vazia: MetricasSemana = {
    pesoMedioKg: null, deficitTotal: null, treinos: 0, aguaMediaMl: null, sonoMedioMin: null,
    variacaoDormirMin: null, energia: null, fome: null, humor: null,
  };
  it('respeita a direção de cada métrica', () => {
    const r = compararSemanas(
      { ...vazia, pesoMedioKg: 88.4, sonoMedioMin: 380, fome: 4, treinos: 4 },
      { ...vazia, pesoMedioKg: 89.0, sonoMedioMin: 420, fome: 4.1, treinos: 3 },
    );
    const t = Object.fromEntries(r.map((i) => [i.chave, i.tendencia]));
    assert.equal(t.pesoMedioKg, 'melhorou');
    assert.equal(t.sonoMedioMin, 'piorou');
    assert.equal(t.fome, 'estavel');
    assert.equal(t.treinos, 'melhorou');
    assert.equal(t.energia, 'sem_dados');
  });
});
