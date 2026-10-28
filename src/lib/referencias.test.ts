/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { MARCADORES, classificar, faixaAdequadaTexto, marcador } from './referencias.ts';

const homem40 = { idade: 40, sexo: 'masculino' as const };
const mulher40 = { idade: 40, sexo: 'feminino' as const };

describe('classificar pela tabela padrão', () => {
  it('glicose de jejum', () => {
    assert.equal(classificar('glicose', 92, homem40)?.nivel, 'adequado');
    assert.equal(classificar('glicose', 100, homem40)?.nivel, 'atencao');
    assert.equal(classificar('glicose', 125, homem40)?.nivel, 'atencao');
    assert.equal(classificar('glicose', 126, homem40)?.nivel, 'alterado');
    assert.equal(classificar('glicose', 65, homem40)?.direcao, 'baixo');
  });
  it('HDL depende do sexo', () => {
    assert.equal(classificar('hdl', 45, homem40)?.nivel, 'adequado');
    assert.equal(classificar('hdl', 45, mulher40)?.nivel, 'atencao');
  });
  it('vitamina D depende da idade', () => {
    assert.equal(classificar('vitamina_d', 25, homem40)?.nivel, 'adequado');
    assert.equal(classificar('vitamina_d', 25, { idade: 65, sexo: 'masculino' })?.nivel, 'atencao');
    assert.equal(classificar('vitamina_d', 100, homem40)?.nivel, 'adequado');
    assert.equal(classificar('vitamina_d', 120, homem40)?.nivel, 'alterado');
  });
  it('limites inclusivos', () => {
    assert.equal(classificar('tsh', 4.5, homem40)?.nivel, 'adequado');
    assert.equal(classificar('tsh', 4.6, homem40)?.nivel, 'atencao');
  });
  it('marcador desconhecido', () => {
    assert.equal(classificar('xyz', 1, homem40), null);
  });
});

describe('faixa do laboratório tem prioridade', () => {
  it('usa min e max do laudo', () => {
    const r = classificar('tsh', 4.6, homem40, { min: 0.3, max: 5.0 });
    assert.equal(r?.nivel, 'adequado');
    assert.equal(r?.fonte, 'laboratorio');
    assert.equal(classificar('tsh', 0.2, homem40, { min: 0.3, max: 5.0 })?.direcao, 'baixo');
  });
});

describe('texto da faixa adequada', () => {
  it('formata limites', () => {
    assert.equal(faixaAdequadaTexto(marcador('glicose')!, homem40), '70 a 99 mg/dL');
    assert.equal(faixaAdequadaTexto(marcador('hba1c')!, homem40), 'abaixo de 5,7 %');
    assert.equal(faixaAdequadaTexto(marcador('tsh')!, homem40), '0,4 a 4,5 µUI/mL');
    assert.equal(faixaAdequadaTexto(marcador('hdl')!, mulher40), 'a partir de 50 mg/dL');
    assert.equal(faixaAdequadaTexto(marcador('colesterol_total')!, homem40), 'até 189 mg/dL');
  });
  it('todo marcador tem uma faixa adequada', () => {
    for (const m of MARCADORES) {
      for (const ctx of [homem40, mulher40, { idade: 70, sexo: null }]) {
        assert.ok(m.faixas(ctx).some((f) => f.nivel === 'adequado'), m.codigo);
      }
    }
  });
});
