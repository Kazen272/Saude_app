/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { COLUNAS, COLUNAS_EXTRAS, medidaPorCodigo, resumir, serie, tom, ultimosValores, variacao, type RegistroMedidas } from './medidas.ts';

const cintura = medidaPorCodigo('cintura')!;
const braco = medidaPorCodigo('braco-contraido')!;
const ombro = medidaPorCodigo('ombro')!;

const registros: RegistroMedidas[] = [
  { dia: '2026-10-13', valores: { waist_cm: 103.5, arm_flexed_l_cm: 39.5 } },
  { dia: '2026-09-15', valores: { waist_cm: 105.5, arm_flexed_l_cm: 39, arm_flexed_r_cm: 39.5 } },
  { dia: '2026-10-20', valores: { hip_cm: 114 } },
  { dia: '2026-10-29', valores: { waist_cm: 102.5, arm_flexed_l_cm: 40, arm_flexed_r_cm: 40 } },
];

describe('medidas', () => {
  it('tem 15 medidas de fita + 7 dobras; só cintura e quadril ficam fora de "Mais medidas"', () => {
    assert.equal(COLUNAS.length, 22);
    assert.equal(COLUNAS_EXTRAS.length, 20);
  });

  it('série ordena por data e pula dias sem a medida', () => {
    assert.deepEqual(serie(registros, cintura).map((p) => p.dia), ['2026-09-15', '2026-10-13', '2026-10-29']);
  });

  it('variação de dois lados usa só os lados medidos nas duas datas', () => {
    assert.equal(variacao({ dia: 'a', valores: [39.5, null] }, { dia: 'b', valores: [40, 40] }), 0.5);
    assert.equal(variacao({ dia: 'a', valores: [39, 39.5] }, { dia: 'b', valores: [40, 40] }), 0.8);
    assert.equal(variacao({ dia: 'a', valores: [null, 39] }, { dia: 'b', valores: [40, null] }), null);
    assert.equal(variacao({ dia: 'a', valores: [40.1] }, { dia: 'b', valores: [40.1] }), 0);
  });

  it('resume contra a anterior e a primeira', () => {
    const r = resumir(registros, cintura)!;
    assert.equal(r.vsAnterior, -1);
    assert.equal(r.vsPrimeira, -3);
    assert.equal(r.diaPrimeira, '2026-09-15');
    assert.equal(resumir(registros, ombro), null);
    const so = resumir([{ dia: '2026-10-29', valores: { waist_cm: 100 } }], cintura)!;
    assert.equal(so.vsAnterior, null);
    assert.equal(so.vsPrimeira, null);
  });

  it('cor: verde só quando diminui o que deve diminuir', () => {
    assert.equal(tom(cintura, -1), 'bom');
    assert.equal(tom(cintura, 0.5), 'ruim');
    assert.equal(tom(cintura, 0), 'neutro');
    assert.equal(tom(braco, 1), 'neutro');
  });

  it('últimos valores antes do dia, coluna a coluna', () => {
    assert.deepEqual(ultimosValores(registros, '2026-10-29'), {
      waist_cm: 103.5,
      arm_flexed_l_cm: 39.5,
      arm_flexed_r_cm: 39.5,
      hip_cm: 114,
    });
  });
});
