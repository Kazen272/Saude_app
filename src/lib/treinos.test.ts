/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ehDeslocamento, kcalDoTreino, kcalTreinosPorDia, type TreinoParaGasto } from './treinos.ts';

const hevy: TreinoParaGasto = { titulo: 'Treino Push', inicio: '2026-10-30T22:32:28Z', fim: '2026-10-30T23:50:56Z', kcal: null, app: 'com.hevy' };

describe('kcalDoTreino', () => {
  it('Hevy sem calorias: (3,5 − 1) × peso × horas', () => {
    assert.deepEqual(kcalDoTreino(hevy, 105), { kcal: 341, estimado: true });
  });
  it('medido pelo relógio vale como está; do app é estimativa', () => {
    assert.deepEqual(kcalDoTreino({ ...hevy, app: 'com.huami.watch.hmwatchmanager', kcal: 500 }, 105), { kcal: 500, estimado: false });
    assert.deepEqual(kcalDoTreino({ ...hevy, app: 'saude', kcal: 800 }, 105), { kcal: 800, estimado: true });
    assert.equal(kcalDoTreino({ ...hevy, app: 'com.huami.watch.hmwatchmanager' }, 105), null);
  });
});

describe('kcalTreinosPorDia', () => {
  it('soma por dia local e deixa caminhada/corrida de fora', () => {
    assert.equal(ehDeslocamento('Caminhada'), true);
    const r = kcalTreinosPorDia(
      [
        hevy,
        { titulo: 'Muay Thai', inicio: '2026-10-29T22:00:00Z', fim: '2026-10-29T23:30:00Z', kcal: 800, app: 'saude' },
        { titulo: 'Caminhada', inicio: '2026-10-30T22:11:42Z', fim: '2026-10-30T22:25:52Z', kcal: 101, app: 'com.huami.watch.hmwatchmanager' },
      ],
      105,
    );
    assert.deepEqual([...r.entries()].sort(), [['2026-10-29', 800], ['2026-10-30', 341]]);
  });
});
