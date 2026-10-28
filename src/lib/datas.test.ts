/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { inicioDaSemana, mascaraData, mascaraHora, nomeDoDia, porSemana } from './datas.ts';

describe('máscaras', () => {
  it('data', () => {
    assert.equal(mascaraData('2810'), '28/10');
    assert.equal(mascaraData('28101992'), '28/10/1992');
    assert.equal(mascaraData('28/10/19920'), '28/10/1992');
  });
  it('hora', () => {
    assert.equal(mascaraHora('23'), '23');
    assert.equal(mascaraHora('2330'), '23:30');
    assert.equal(mascaraHora('7:05'), '70:5'); // só dígitos contam: digite 0705
  });
});

describe('dias e semanas', () => {
  it('nomeia hoje, ontem e outros dias', () => {
    assert.equal(nomeDoDia('2026-10-28', '2026-10-28'), 'Hoje');
    assert.equal(nomeDoDia('2026-10-27', '2026-10-28'), 'Ontem');
    assert.equal(nomeDoDia('2026-10-21', '2026-10-28'), 'qua, 21 out');
  });
  it('semana começa na segunda', () => {
    assert.equal(inicioDaSemana('2026-10-28'), '2026-10-26');
    assert.equal(inicioDaSemana('2026-11-01'), '2026-10-26');
  });
  it('agrupa por semana', () => {
    const r = porSemana(
      [
        { dia: '2026-10-20', valor: 1 },
        { dia: '2026-10-27', valor: 2 },
        { dia: '2026-10-28', valor: 3 },
      ],
      2,
      '2026-10-28',
    );
    assert.deepEqual(r, [
      { semana: '2026-10-19', valores: [1] },
      { semana: '2026-10-26', valores: [2, 3] },
    ]);
  });
});
