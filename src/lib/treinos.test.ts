/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ehDeslocamento, kcalDoTreino, kcalTreinosPorDia, sessoesDeTreino, type TreinoParaGasto } from './treinos.ts';

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

describe('sessoesDeTreino', () => {
  // Semana real de 26/10 a 01/11 (horários UTC): 2 Muay Thai + 3 academia, mais caminhadas e corrida curtas do relógio.
  const t = (titulo: string, inicio: string, fim: string) => ({ titulo, inicio, fim });
  const semana = [
    t('Muay Thai', '2026-10-27T22:00:00Z', '2026-10-27T23:30:00Z'),
    t('Treino Pull', '2026-10-28T23:02:53Z', '2026-10-29T00:04:57Z'),
    t('Muay Thai', '2026-10-29T22:00:00Z', '2026-10-29T23:30:00Z'),
    t('Caminhada', '2026-10-30T22:11:42Z', '2026-10-30T22:25:52Z'),
    t('Treino Push', '2026-10-30T22:32:28Z', '2026-10-30T23:50:56Z'),
    t('Caminhada', '2026-10-30T23:53:39Z', '2026-10-31T00:15:27Z'),
    t('Treino Pull', '2026-10-31T16:39:36Z', '2026-10-31T18:15:00Z'),
    t('Corrida', '2026-10-31T17:52:50Z', '2026-10-31T18:10:51Z'),
  ];
  it('conta 5 treinos, não 8', () => {
    const s = sessoesDeTreino(semana);
    assert.equal(s.length, 5);
    assert.deepEqual(s.map((x) => x.dia), ['2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31']);
  });
  it('junta registros sobrepostos e mantém corrida longa', () => {
    const s = sessoesDeTreino([
      t('Musculação', '2026-11-02T22:00:00Z', '2026-11-02T23:00:00Z'),
      t('Treino Legs', '2026-11-02T22:05:00Z', '2026-11-02T23:10:00Z'),
      t('Corrida', '2026-11-03T10:00:00Z', '2026-11-03T10:40:00Z'),
    ]);
    assert.equal(s.length, 2);
    assert.deepEqual(s[0].titulos, ['Musculação', 'Treino Legs']);
    assert.equal(s[0].minutos, 70);
  });
});
