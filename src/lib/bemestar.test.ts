/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  alertaDeficitAgressivo,
  duracaoSono,
  formatarDuracao,
  formatarHora,
  horarioMedioDeDormir,
  lerHora,
  mediaCampo,
  regularidadeDormir,
  resumirSono,
} from './bemestar.ts';

describe('horas', () => {
  it('lê e formata', () => {
    assert.equal(lerHora('23:40'), 1420);
    assert.equal(lerHora('7h05'), 425);
    assert.equal(lerHora('25:00'), null);
    assert.equal(formatarHora(1420), '23:40');
    assert.equal(formatarHora(1450), '00:10');
    assert.equal(formatarDuracao(400), '6h40');
  });
});

describe('sono', () => {
  it('atravessa a meia-noite', () => {
    assert.equal(duracaoSono(lerHora('23:30') as number, lerHora('06:30') as number), 420);
    assert.equal(duracaoSono(lerHora('01:00') as number, lerHora('08:00') as number), 420);
  });
  it('média de dormir perto da meia-noite não vira meio-dia', () => {
    assert.equal(formatarHora(horarioMedioDeDormir([lerHora('23:30') as number, lerHora('00:30') as number]) as number), '00:00');
  });
  it('regularidade precisa de 3 noites', () => {
    assert.equal(regularidadeDormir([1380, 1400]), null);
    assert.equal(regularidadeDormir([1380, 1380, 1380]), 0);
  });
  it('resume a semana', () => {
    const r = resumirSono([
      { dia: '2026-10-26', deitouMin: 1380, duracaoMin: 420, qualidade: 4 },
      { dia: '2026-10-27', deitouMin: 1410, duracaoMin: 390, qualidade: 3 },
    ]);
    assert.equal(r.mediaMin, 405);
    assert.equal(r.abaixoDe7h, 1);
    assert.equal(r.noites, 2);
  });
});

describe('check-in', () => {
  const dia = (d: number, energia: number, fome: number) => ({ dia: `2026-10-${d}`, energia, fome, humor: 3 });
  it('alerta com energia baixa e fome alta em 3 dias', () => {
    assert.equal(alertaDeficitAgressivo([dia(25, 2, 4), dia(26, 1, 5), dia(27, 2, 4)]), true);
  });
  it('não alerta com poucos dias ou sinais bons', () => {
    assert.equal(alertaDeficitAgressivo([dia(26, 1, 5), dia(27, 1, 5)]), false);
    assert.equal(alertaDeficitAgressivo([dia(25, 4, 2), dia(26, 3, 3), dia(27, 4, 3)]), false);
  });
  it('média ignora dias sem resposta', () => {
    assert.equal(mediaCampo([{ dia: '2026-10-27', energia: 4, fome: null, humor: null }, { dia: '2026-10-28', energia: 3, fome: null, humor: null }], 'energia'), 3.5);
    assert.equal(mediaCampo([], 'humor'), null);
  });
});
