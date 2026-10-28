/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ajusteDeGasto,
  deficit,
  gastoDiario,
  idadeEmAnos,
  kgDeDeficit,
  mediaMovel,
  projetarMeta,
  tmbMifflin,
} from './calculos.ts';

describe('idadeEmAnos', () => {
  it('conta só aniversários completos', () => {
    assert.equal(idadeEmAnos('1992-05-10', '2026-05-09'), 33);
    assert.equal(idadeEmAnos('1992-05-10', '2026-05-10'), 34);
  });
});

describe('tmbMifflin', () => {
  it('homem', () => {
    assert.equal(tmbMifflin({ sexo: 'masculino', pesoKg: 88.4, alturaCm: 178, idade: 34 }), 1832);
  });
  it('mulher', () => {
    assert.equal(tmbMifflin({ sexo: 'feminino', pesoKg: 60, alturaCm: 165, idade: 30 }), 1320);
  });
});

describe('gastoDiario', () => {
  it('usa as calorias ativas do relógio quando existem', () => {
    assert.deepEqual(gastoDiario({ tmb: 1832, kcalAtivas: 600, fatorAtividade: 1.2 }), {
      kcal: 2432,
      origem: 'relogio',
    });
  });
  it('estima pelo fator de atividade sem relógio', () => {
    assert.deepEqual(gastoDiario({ tmb: 1832, kcalAtivas: null, fatorAtividade: 1.2 }), {
      kcal: 2198,
      origem: 'estimativa',
    });
  });
  it('aplica o ajuste da recalibração', () => {
    assert.equal(gastoDiario({ tmb: 1832, kcalAtivas: 600, fatorAtividade: 1.2, ajusteKcal: -90 }).kcal, 2342);
  });
});

describe('déficit', () => {
  it('é positivo quando gasta mais do que come', () => {
    assert.equal(deficit(2500, 1980), 520);
    assert.equal(deficit(2000, 2150), -150);
  });
  it('7.700 kcal valem 1 kg', () => {
    assert.equal(kgDeDeficit(7700), 1);
  });
});

describe('mediaMovel', () => {
  it('suaviza dias seguidos', () => {
    const r = mediaMovel([
      { dia: '2026-10-03', pesoKg: 92 },
      { dia: '2026-10-01', pesoKg: 90 },
      { dia: '2026-10-02', pesoKg: 91 },
    ]);
    assert.deepEqual(
      r.map((p) => p.pesoKg),
      [90, 90.5, 91],
    );
  });
  it('ignora pesagens fora da janela', () => {
    const r = mediaMovel([
      { dia: '2026-10-01', pesoKg: 90 },
      { dia: '2026-10-10', pesoKg: 88 },
    ]);
    assert.equal(r[1].pesoKg, 88);
  });
});

describe('projetarMeta', () => {
  it('calcula a data no ritmo atual', () => {
    assert.deepEqual(projetarMeta({ pesoAtualKg: 88.4, metaKg: 85, deficitMedioDiario: 520, hoje: '2026-10-28' }), {
      estado: 'no_caminho',
      dias: 51,
      kgPorSemana: 0.47,
      data: '2026-12-18',
    });
  });
  it('avisa quando não há déficit', () => {
    assert.deepEqual(projetarMeta({ pesoAtualKg: 88, metaKg: 85, deficitMedioDiario: -50, hoje: '2026-10-28' }), {
      estado: 'sem_deficit',
    });
  });
  it('reconhece meta atingida', () => {
    assert.deepEqual(projetarMeta({ pesoAtualKg: 84.9, metaKg: 85, deficitMedioDiario: 500, hoje: '2026-10-28' }), {
      estado: 'atingida',
    });
  });
});

describe('ajusteDeGasto', () => {
  it('reduz o gasto quando perdeu menos que o previsto', () => {
    assert.equal(ajusteDeGasto({ deficitAcumuladoKcal: 15400, pesoInicialKg: 92, pesoFinalKg: 90.5, dias: 28 }), -137);
  });
  it('não ajusta com menos de 2 semanas de dados', () => {
    assert.equal(ajusteDeGasto({ deficitAcumuladoKcal: 15400, pesoInicialKg: 92, pesoFinalKg: 92, dias: 10 }), 0);
  });
  it('limita o ajuste a 500 kcal/dia', () => {
    assert.equal(ajusteDeGasto({ deficitAcumuladoKcal: 30800, pesoInicialKg: 92, pesoFinalKg: 92, dias: 14 }), -500);
  });
});
