/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { descreverTipos, fcRepousoDasAmostras, minutosDormindo, nomeDoApp, nomeDoTreino, noitesPorDia, treinosDuplicados, ultimoPorDia } from './healthconnect-regras.ts';

// Os testes rodam com TZ=America/Sao_Paulo (ver package.json), como o celular.

describe('nomes', () => {
  it('reconhece os apps', () => {
    assert.equal(nomeDoApp('com.hevy'), 'Hevy');
    assert.equal(nomeDoApp('com.huami.watch.hmwatchmanager'), 'Zepp');
    assert.equal(nomeDoApp('com.exemplo.qualquer'), 'qualquer');
    assert.equal(nomeDoApp(null), 'outro app');
  });
  it('nomeia o treino pelo título ou pelo tipo', () => {
    assert.equal(nomeDoTreino(70), 'Musculação');
    assert.equal(nomeDoTreino(70, 'Peito e tríceps'), 'Peito e tríceps');
    assert.equal(nomeDoTreino(999), 'Treino');
  });
});

describe('sono', () => {
  it('desconta os estágios acordado', () => {
    assert.equal(
      minutosDormindo({
        id: 'a',
        inicio: '2026-10-28T02:00:00Z',
        fim: '2026-10-28T09:00:00Z',
        origem: 'com.huami.watch.hmwatchmanager',
        estagios: [
          { startTime: '2026-10-28T02:00:00Z', endTime: '2026-10-28T02:20:00Z', stage: 1 },
          { startTime: '2026-10-28T02:20:00Z', endTime: '2026-10-28T09:00:00Z', stage: 4 },
        ],
      }),
      400,
    );
  });
  it('uma noite por dia em que acordou, a mais longa', () => {
    const noites = noitesPorDia([
      // 23:00 de 27/10 a 06:00 de 28/10 em São Paulo
      { id: 'zepp', inicio: '2026-10-28T02:00:00Z', fim: '2026-10-28T09:00:00Z', origem: 'com.huami.watch.hmwatchmanager' },
      { id: 'mi', inicio: '2026-10-28T03:00:00Z', fim: '2026-10-28T09:00:00Z', origem: 'com.xiaomi.wearable' },
      // cochilo à tarde do mesmo dia
      { id: 'cochilo', inicio: '2026-10-28T17:00:00Z', fim: '2026-10-28T17:40:00Z', origem: 'com.huami.watch.hmwatchmanager' },
    ]);
    assert.equal(noites.length, 1);
    assert.equal(noites[0].dia, '2026-10-28');
    assert.equal(noites[0].minutosDormindo, 420);
  });
});

describe('medidas', () => {
  it('fica com o último valor do dia local', () => {
    const r = ultimoPorDia([
      { quando: '2026-10-28T10:00:00Z', valor: 60 },
      { quando: '2026-10-28T20:00:00Z', valor: 58 },
      // 01:00 UTC do dia 29 ainda é dia 28 em São Paulo
      { quando: '2026-10-29T01:00:00Z', valor: 57 },
    ]);
    assert.equal(r.get('2026-10-28'), 57);
    assert.equal(r.size, 1);
  });
});

describe('treinos', () => {
  it('detecta o mesmo treino vindo de dois apps', () => {
    const a = { inicio: '2026-10-28T10:00:00Z', fim: '2026-10-28T11:00:00Z' };
    assert.equal(treinosDuplicados(a, { inicio: '2026-10-28T10:04:00Z', fim: '2026-10-28T10:58:00Z' }), true);
    assert.equal(treinosDuplicados(a, { inicio: '2026-10-28T18:00:00Z', fim: '2026-10-28T19:00:00Z' }), false);
  });
});

describe('fcRepousoDasAmostras', () => {
  it('menor média de 30 min com 3+ amostras, por dia local', () => {
    const a = (iso: string, valor: number) => ({ quando: iso, valor });
    const r = fcRepousoDasAmostras([
      // 30/10 madrugada (horário de Brasília = UTC-3): janela calma
      a('2026-10-30T07:00:00Z', 58), a('2026-10-30T07:10:00Z', 56), a('2026-10-30T07:20:00Z', 57),
      // pico isolado com poucas amostras não conta
      a('2026-10-30T08:00:00Z', 40), a('2026-10-30T08:05:00Z', 42),
      // tarde, mais alta
      a('2026-10-30T18:00:00Z', 80), a('2026-10-30T18:10:00Z', 84), a('2026-10-30T18:20:00Z', 82),
      // 02:30 UTC do dia 31 = 23:30 do dia 30 em Brasília
      a('2026-10-31T02:31:00Z', 70), a('2026-10-31T02:40:00Z', 70), a('2026-10-31T02:50:00Z', 70),
      // leitura inválida
      a('2026-10-30T07:25:00Z', 0),
    ]);
    assert.deepEqual([...r.entries()], [['2026-10-30', 57]]);
  });
});

describe('descreverTipos', () => {
  it('junta tipos repetidos e usa "e" no fim', () => {
    assert.equal(descreverTipos(['Steps', 'ActiveCaloriesBurned', 'TotalCaloriesBurned', 'HeartRate']), 'passos, calorias e frequência cardíaca');
    assert.equal(descreverTipos(['Nutrition']), 'dieta');
    assert.equal(descreverTipos([]), '');
  });
});
