/// <reference types="node" />
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SUGESTOES, descrever, disparos, horariosDoDia, validar, type Lembrete } from './lembretes-regras.ts';

const base: Lembrete = {
  titulo: 'Teste',
  mensagem: '',
  tipo: 'horarios',
  dias: [2, 3, 4, 5, 6],
  horarios: ['07:30', '12:00', '07:30'],
  intervaloMin: null,
  inicio: null,
  fim: null,
  link: null,
  ativo: true,
};

describe('lembretes', () => {
  it('horários fixos sem repetição, em ordem', () => {
    assert.deepEqual(horariosDoDia({ ...base, horarios: ['12:00', '07:30', '07:30'] }), [450, 720]);
  });
  it('intervalo gera horários entre início e fim', () => {
    const l = { ...base, tipo: 'intervalo' as const, intervaloMin: 120, inicio: '09:00', fim: '21:00' };
    assert.equal(horariosDoDia(l).length, 7);
    assert.equal(descrever(l), 'Seg a Sex · a cada 2 h, 09:00–21:00');
  });
  it('um disparo semanal por dia × horário', () => {
    assert.equal(disparos(base).length, 10);
    assert.deepEqual(disparos(base)[0], { weekday: 2, hour: 7, minute: 30 });
    assert.equal(disparos({ ...base, ativo: false }).length, 0);
  });
  it('valida antes de salvar', () => {
    assert.equal(validar(base), null);
    assert.match(validar({ ...base, dias: [] }) ?? '', /dia/);
    assert.match(validar({ ...base, horarios: ['25:00'] }) ?? '', /horário/);
    assert.match(validar({ ...base, tipo: 'intervalo', intervaloMin: 60, inicio: '20:00', fim: '08:00' }) ?? '', /início/);
  });
  it('descreve a recorrência', () => {
    assert.equal(descrever(base), 'Seg a Sex · 07:30, 12:00');
    assert.equal(descrever({ ...base, dias: [1] }), 'Dom · 07:30, 12:00');
  });
  it('sugestões são válidas', () => {
    for (const s of SUGESTOES) assert.equal(validar(s), null, s.titulo);
  });
});
