/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ATIVIDADES, treinoCombinaCom, GRUPOS, buscarAtividades, descreverDias, diaDaSemana, kcalEstimadas, nomeDaAtividade, treinoCorrespondente, type TreinoGravado } from './atividades.ts';

// Os testes rodam com TZ=America/Sao_Paulo.

describe('catálogo', () => {
  it('todo tipo está num grupo conhecido, com código único e MET crescente', () => {
    assert.equal(new Set(ATIVIDADES.map((a) => a.codigo)).size, ATIVIDADES.length);
    for (const a of ATIVIDADES) {
      assert.ok(GRUPOS.includes(a.grupo), a.codigo);
      assert.ok(a.met.leve <= a.met.moderada && a.met.moderada <= a.met.intensa, a.codigo);
    }
  });
  it('busca ignora acentos e acha pelo grupo', () => {
    assert.deepEqual(buscarAtividades('judo').map((a) => a.codigo), ['judo']);
    assert.ok(buscarAtividades('lutas').some((a) => a.codigo === 'muay_thai'));
  });
  it('nome livre só quando preenchido', () => {
    assert.equal(nomeDaAtividade('outra', 'Slackline'), 'Slackline');
    assert.equal(nomeDaAtividade('muay_thai', '  '), 'Muay Thai');
  });
});

describe('kcalEstimadas', () => {
  it('(MET − 1) × peso × horas', () => {
    // Muay Thai intenso, 100 kg, 60 min: (10,3 − 1) × 100 × 1
    assert.equal(kcalEstimadas('muay_thai', 'intensa', 100, 60), 930);
    assert.equal(kcalEstimadas('yoga', 'leve', 60, 30), 45);
  });
});

describe('dias', () => {
  it('1 = domingo', () => {
    assert.equal(diaDaSemana('2026-11-01'), 1); // domingo
    assert.equal(diaDaSemana('2026-11-03'), 3); // terça
  });
  it('descreve', () => {
    assert.equal(descreverDias([5, 3]), 'ter e qui');
    assert.equal(descreverDias([2, 3, 4, 5, 6]), 'seg a sex');
    assert.equal(descreverDias([1, 2, 3, 4, 5, 6, 7]), 'todo dia');
    assert.equal(descreverDias([2, 4, 6]), 'seg, qua e sex');
  });
});

describe('treinoCorrespondente', () => {
  const tr = (id: number, inicio: string, fim: string, manual = false): TreinoGravado => ({ id, inicio, fim, titulo: null, app: 'com.huami.watch.hmwatchmanager', kcal: 600, manual });
  it('acha o treino do relógio perto do horário planejado (19h local = 22h UTC)', () => {
    const r = treinoCorrespondente('2026-11-03', '19:00', 60, [tr(1, '2026-11-03T10:00:00Z', '2026-11-03T11:00:00Z'), tr(2, '2026-11-03T22:20:00Z', '2026-11-03T23:25:00Z')]);
    assert.equal(r?.id, 2);
  });
  it('aceita até 60 min de diferença e ignora manuais e já usados', () => {
    assert.equal(treinoCorrespondente('2026-11-03', '19:00', 60, [tr(3, '2026-11-03T23:45:00Z', '2026-11-04T00:30:00Z')])?.id, 3);
    assert.equal(treinoCorrespondente('2026-11-03', '19:00', 60, [tr(4, '2026-11-04T01:30:00Z', '2026-11-04T02:00:00Z')]), null);
    assert.equal(treinoCorrespondente('2026-11-03', '19:00', 60, [tr(5, '2026-11-03T22:00:00Z', '2026-11-03T23:00:00Z', true)]), null);
    assert.equal(treinoCorrespondente('2026-11-03', '19:00', 60, [tr(6, '2026-11-03T22:00:00Z', '2026-11-03T23:00:00Z')], new Set([6])), null);
  });
});

describe('treinoCombinaCom', () => {
  const hevy: TreinoGravado = { id: 1, inicio: '2026-11-03T10:00:00Z', fim: null, titulo: 'Peito', app: 'com.hevy', kcal: null, manual: false };
  it('Hevy só casa com atividade de academia', () => {
    assert.equal(treinoCombinaCom('corrida')(hevy), false);
    assert.equal(treinoCombinaCom('musculacao')(hevy), true);
    assert.equal(treinoCombinaCom('corrida')({ ...hevy, app: 'com.strava' }), true);
  });
});
