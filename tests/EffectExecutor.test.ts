// ============================================================
// HEXOS TCG — Effect Executor Tests (Node built-in test runner)
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GameManager } from '../src/engine/GameManager';
import { ZoneManager } from '../src/engine/ZoneManager';
import { EffectExecutor } from '../src/engine/EffectExecutor';
import { getDinoDeck, getRomeDeck } from '../src/corpus/CardLoader';
import { resetCounter } from '../src/utils/id';

function makeGame() {
  resetCounter();
  const gm = new GameManager(getDinoDeck(), getRomeDeck());
  gm.startGame();
  return gm;
}

describe('EffectExecutor — DRAW', () => {

  it('DRAW adds cards to hand', () => {
    const { state } = makeGame();
    const source = state.players.P1.hand[0];
    const before = state.players.P1.hand.length;

    EffectExecutor.execute(state, { op: 'DRAW', target: 'OWNER', value: 2 }, source);

    assert.equal(state.players.P1.hand.length, before + 2);
  });

});

describe('EffectExecutor — MILL', () => {

  it('MILL sends top cards to ABYSS', () => {
    const { state } = makeGame();
    const source = state.players.P1.hand[0];
    const before = state.players.P1.abyss.length;

    EffectExecutor.execute(state, { op: 'MILL', target: 'OWNER', value: 2 }, source);

    assert.equal(state.players.P1.abyss.length, before + 2);
  });

});

describe('EffectExecutor — DESTROY', () => {

  it('DESTROY sends opponent field card to ABYSS', () => {
    const { state } = makeGame();
    const source = state.players.P1.hand[0];
    const target = state.players.P2.hand[0];
    ZoneManager.moveCard(state, target.instanceId, 'FIELD');

    EffectExecutor.execute(state, { op: 'DESTROY', target: 'FIELD_OPPONENT' }, source);

    assert.equal(target.zone, 'ABYSS');
    assert.ok(state.players.P2.abyss.includes(target));
  });

});

describe('EffectExecutor — MODIFY_STAT', () => {

  it('MODIFY_STAT +500 ATK increases stat', () => {
    const { state } = makeGame();
    const source = state.players.P1.hand[0];
    ZoneManager.moveCard(state, source.instanceId, 'FIELD');
    const before = source.atk;

    EffectExecutor.execute(state, {
      op: 'MODIFY_STAT', target: 'SELF', stat: 'ATK', value: 500, duration: 'PERMANENT',
    }, source);

    assert.equal(source.atk, before + 500);
  });

  it('MODIFY_STAT cannot go below 0', () => {
    const { state } = makeGame();
    const source = state.players.P1.hand[0];
    ZoneManager.moveCard(state, source.instanceId, 'FIELD');
    source.atk = 200;

    EffectExecutor.execute(state, {
      op: 'MODIFY_STAT', target: 'SELF', stat: 'ATK', value: -500, duration: 'PERMANENT',
    }, source);

    assert.equal(source.atk, 0);
  });

});

describe('EffectExecutor — GRANT_KEYWORD', () => {

  it('adds keyword to card', () => {
    const { state } = makeGame();
    const source = state.players.P1.hand[0];
    ZoneManager.moveCard(state, source.instanceId, 'FIELD');

    EffectExecutor.execute(state, { op: 'GRANT_KEYWORD', target: 'SELF', keyword: 'DIRECT_ATTACK' }, source);

    assert.ok(source.keywords.has('DIRECT_ATTACK'));
  });

});

describe('EffectExecutor — DEAL_DAMAGE', () => {

  it('DEAL_DAMAGE reduces opponent life', () => {
    const { state } = makeGame();
    const source = state.players.P1.hand[0];
    const before = state.players.P2.life;

    EffectExecutor.execute(state, { op: 'DEAL_DAMAGE', target: 'OPPONENT', value: 1000 }, source);

    assert.equal(state.players.P2.life, before - 1000);
  });

  it('DEAL_DAMAGE to 0 ends game', () => {
    const { state } = makeGame();
    const source = state.players.P1.hand[0];
    state.players.P2.life = 500;

    EffectExecutor.execute(state, { op: 'DEAL_DAMAGE', target: 'OPPONENT', value: 1000 }, source);

    assert.equal(state.winner, 'P1');
    assert.equal(state.step, 'GAME_OVER');
  });

});

describe('EffectExecutor — GAIN_CURSE / REMOVE_CURSE', () => {

  it('GAIN_CURSE marks a card', () => {
    const { state } = makeGame();
    const source = state.players.P1.hand[0];
    ZoneManager.moveCard(state, source.instanceId, 'FIELD');

    EffectExecutor.execute(state, { op: 'GAIN_CURSE', target: 'SELF' }, source);
    assert.equal(source.hasCurse, true);
  });

  it('REMOVE_CURSE clears a cursed card', () => {
    const { state } = makeGame();
    const source = state.players.P1.hand[0];
    ZoneManager.moveCard(state, source.instanceId, 'FIELD');
    source.hasCurse = true;

    EffectExecutor.execute(state, { op: 'REMOVE_CURSE', target: 'SELF' }, source);
    assert.equal(source.hasCurse, false);
  });

});

describe('EffectExecutor — MOVE_ZONE', () => {

  it('MOVE_ZONE ABYSS → FIELD with chosen target', () => {
    const { state } = makeGame();
    const source = state.players.P1.hand[0];
    const target = state.players.P1.hand[1];
    ZoneManager.moveCard(state, target.instanceId, 'ABYSS');

    EffectExecutor.execute(state, {
      op: 'MOVE_ZONE', target: 'ABYSS_OWN', toZone: 'FIELD',
    }, source, [target]);

    assert.equal(target.zone, 'FIELD');
    assert.ok(state.players.P1.field.includes(target));
  });

});
