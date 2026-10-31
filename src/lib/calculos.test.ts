/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  aguaSugeridaMl,
  fracaoDoDia,
  metaProteina,
  planoDoDia,
  gastoTipicoRelogio,
  relacaoCinturaAltura,
  ritmoSemanal,
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
  it('usa o total do relógio quando não há calorias ativas', () => {
    assert.deepEqual(gastoDiario({ tmb: 1832, kcalAtivas: null, kcalTotais: 2500, fatorAtividade: 1.2 }), { kcal: 2500, origem: 'relogio' });
    assert.equal(gastoDiario({ tmb: 1832, kcalAtivas: null, kcalTotais: 900, fatorAtividade: 1.2 }).origem, 'estimativa');
  });
  it('conta só a parte do dia que já passou', () => {
    // meio-dia: metade do basal + o que o relógio mediu até agora
    assert.equal(gastoDiario({ tmb: 1800, kcalAtivas: 200, fatorAtividade: 1.2, fracaoDoDia: 0.5 }).kcal, 1100);
    assert.equal(gastoDiario({ tmb: 1800, kcalAtivas: null, fatorAtividade: 1.2, fracaoDoDia: 0.5 }).kcal, 1080);
    assert.equal(fracaoDoDia(720), 0.5);
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
      dataCedo: '2026-12-09',
      dataTarde: '2026-12-30',
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

describe('ritmo, proteína, água e cintura', () => {
  it('ritmo semanal pela média móvel', () => {
    const r = ritmoSemanal([
      { dia: '2026-10-14', pesoKg: 90 },
      { dia: '2026-10-28', pesoKg: 88.6 },
    ]);
    assert.deepEqual(r, { kgPorSemana: 0.7, pctPorSemana: 0.8 });
    assert.equal(ritmoSemanal([{ dia: '2026-10-25', pesoKg: 90 }, { dia: '2026-10-28', pesoKg: 89 }]), null);
  });
  it('proteína de 1,6 a 2,2 g/kg', () => {
    assert.deepEqual(metaProteina(88.6), { min: 142, max: 195 });
  });
  it('água ~35 ml/kg em passos de 250 ml', () => {
    assert.equal(aguaSugeridaMl(88.6), 3000);
    assert.equal(aguaSugeridaMl(30), 1500);
  });
  it('cintura/altura', () => {
    assert.deepEqual(relacaoCinturaAltura(96, 178), { valor: 0.54, nivel: 'atencao' });
    assert.equal(relacaoCinturaAltura(85, 178).nivel, 'adequado');
    assert.equal(relacaoCinturaAltura(110, 178).nivel, 'alto');
  });
});

describe('planoDoDia', () => {
  it('com relógio: basal do dia inteiro + ativas até agora, sem contar atividade futura', () => {
    const p = planoDoDia({ tmb: 1400, kcalAtivas: 150, fatorAtividade: 1.375, fracaoDoDia: 0.5, consumoKcal: 392 });
    assert.equal(p.gastoPrevisto, 1550);
    assert.equal(p.metaDeficit, 300); // 20% de 1550, arredondado a 50
    assert.equal(p.podeComer, 858);
    assert.equal(p.deficitSeParar, 1158);
    assert.equal(p.deficitExcessivo, true);
  });
  it('sem relógio: estimativa pelo fator; meta limitada a 500', () => {
    const p = planoDoDia({ tmb: 1900, fatorAtividade: 1.55, fracaoDoDia: 0.8, consumoKcal: 2600 });
    assert.equal(p.gastoPrevisto, 2945);
    assert.equal(p.metaDeficit, 500);
    assert.equal(p.podeComer, -155);
    assert.equal(p.deficitExcessivo, false);
  });
  it('só com o total do relógio: completa o basal do resto do dia', () => {
    const p = planoDoDia({ tmb: 1600, kcalTotais: 1000, fatorAtividade: 1.2, fracaoDoDia: 0.5, consumoKcal: null });
    assert.equal(p.gastoPrevisto, 1800);
    assert.equal(p.podeComer, 1450);
  });
});

describe('relógio abaixo da fórmula', () => {
  it('gasto típico: mediana dos dias com o relógio no pulso', () => {
    assert.equal(gastoTipicoRelogio([1857, 2112, 400, null], 2050), 1985);
    assert.equal(gastoTipicoRelogio([1857], 2050), null);
  });
  it('com histórico do relógio, o total de hoje vale mesmo abaixo do basal da fórmula', () => {
    const f = 750 / 1440;
    assert.equal(gastoDiario({ tmb: 2050, kcalTotais: 815, fatorAtividade: 1.55, fracaoDoDia: f, confiarNoTotal: true }).kcal, 815);
    assert.equal(gastoDiario({ tmb: 2050, kcalTotais: 815, fatorAtividade: 1.55, fracaoDoDia: f }).origem, 'estimativa');
  });
  it('plano usa o menor entre fórmula e relógio', () => {
    const p = planoDoDia({ tmb: 2050, kcalTotais: 815, fatorAtividade: 1.55, fracaoDoDia: 750 / 1440, consumoKcal: 348, gastoTipicoRelogio: 1985 });
    assert.equal(p.gastoPrevisto, 1766); // 815 até agora + resto do dia no ritmo do relógio
    assert.equal(p.metaDeficit, 350);
    assert.equal(p.podeComer, 1068);
    // Sem o total de hoje, o relógio limita a estimativa pelo fator (2050 × 1,55).
    assert.equal(planoDoDia({ tmb: 2050, fatorAtividade: 1.55, fracaoDoDia: 0.5, consumoKcal: 0, gastoTipicoRelogio: 1985 }).gastoPrevisto, 1985);
  });
});

describe('gasto: relógio primeiro', () => {
  it('com o relógio em uso, o total medido vale mais que basal + ativas da fórmula', () => {
    assert.equal(gastoDiario({ tmb: 2050, kcalAtivas: 191, kcalTotais: 2112, fatorAtividade: 1.55, confiarNoTotal: true }).kcal, 2112);
  });
  it('sem dados do dia, a estimativa pelo fator não passa do gasto típico do relógio', () => {
    assert.equal(gastoDiario({ tmb: 2050, fatorAtividade: 1.55, tetoTipico: 1900 }).kcal, 1900);
    assert.equal(gastoDiario({ tmb: 2050, fatorAtividade: 1.55, tetoTipico: 1900, fracaoDoDia: 0.5 }).kcal, 950);
    assert.equal(gastoDiario({ tmb: 2050, fatorAtividade: 1.55 }).kcal, 3178);
  });
});

describe('gasto pelos passos', () => {
  it('sem calorias do relógio, passos viram atividade (0,04 kcal/passo a cada 70 kg)', () => {
    assert.equal(gastoDiario({ tmb: 2050, fatorAtividade: 1.55, passos: 10000, pesoKg: 105 }).kcal, 2650);
    assert.equal(gastoDiario({ tmb: 2050, fatorAtividade: 1.55, passos: 10000, pesoKg: 105, kcalAtivas: 300 }).kcal, 2350);
  });
});

describe('gasto: passos + treinos', () => {
  it('sem calorias do relógio, soma os treinos que os passos não pegam', () => {
    assert.equal(gastoDiario({ tmb: 2050, fatorAtividade: 1.55, passos: 10000, pesoKg: 105, kcalTreinos: 341 }).kcal, 2991);
    // com o relógio medindo o dia, os treinos não somam de novo
    assert.equal(gastoDiario({ tmb: 2050, fatorAtividade: 1.55, kcalTotais: 2400, confiarNoTotal: true, kcalTreinos: 341 }).kcal, 2400);
  });
});
