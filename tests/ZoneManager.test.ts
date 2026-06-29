// ============================================================
// HEXOS TCG — Zone Manager Tests (Node built-in test runner)
// Run with: tsx --test tests/ZoneManager.test.ts
// ============================================================

import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { GameManager } from '../src/engine/GameManager';
import { ZoneManager } from '../src/engine/ZoneManager';
import { getDinoDeck, getRomeDeck } from '../src/corpus/CardLoader';
import { resetCounter } from '../src/utils/id';

function makeGame() {
  resetCounter();
  const gm = new GameManager(getDinoDeck(), getRomeDeck());
  gm.startGame();
  return gm;
}

describe('ZoneManager — Zone Transitions', () => {

  it('cards start in THRONE zone', () => {
    const gm = makeGame();
    const s = gm.state;
    assert.ok(s.players.P1.throne.length > 0);
    assert.ok(s.players.P2.throne.length > 0);
  });

  it('drawCards moves cards from THRONE to HAND', () => {
    const gm = makeGame();
    const s = gm.state;
    const throneCount = s.players.P1.throne.length;
    const handCount = s.players.P1.hand.length;

    ZoneManager.drawCards(s, 'P1', 2);

    assert.equal(s.players.P1.hand.length, handCount + 2);
    assert.equal(s.players.P1.throne.length, throneCount - 2);
  });

  it('drawn card zone property is HAND', () => {
    const gm = makeGame();
    const s = gm.state;
    ZoneManager.drawCards(s, 'P1', 1);
    const last = s.players.P1.hand[s.players.P1.hand.length - 1];
    assert.equal(last.zone, 'HAND');
  });

  it('moveCard HAND → FIELD updates zone property', () => {
    const gm = makeGame();
    const s = gm.state;
    assert.ok(s.players.P1.hand.length > 0);
    const card = s.players.P1.hand[0];
    ZoneManager.moveCard(s, card.instanceId, 'FIELD');
    assert.equal(card.zone, 'FIELD');
    assert.ok(s.players.P1.field.includes(card));
    assert.ok(!s.players.P1.hand.includes(card));
  });

  it('moveCard FIELD → ABYSS triggers ON_CARD_TO_ABYSS', () => {
    const gm = makeGame();
    const s = gm.state;
    const card = s.players.P1.hand[0];
    ZoneManager.moveCard(s, card.instanceId, 'FIELD');
    const triggers = ZoneManager.moveCard(s, card.instanceId, 'ABYSS');
    assert.equal(card.zone, 'ABYSS');
    assert.ok(triggers.some(t => t.event === 'ON_CARD_TO_ABYSS'));
  });

  it('canSummonToField returns false when field is full', () => {
    const gm = makeGame();
    const s = gm.state;
    ZoneManager.drawCards(s, 'P1', 5);
    const hand = [...s.players.P1.hand];
    for (const card of hand.slice(0, 5)) {
      if (ZoneManager.canSummonToField(s, 'P1')) {
        ZoneManager.moveCard(s, card.instanceId, 'FIELD');
      }
    }
    assert.equal(s.players.P1.field.length, 5);
    assert.equal(ZoneManager.canSummonToField(s, 'P1'), false);
  });

  it('millCards moves top of THRONE to ABYSS', () => {
    const gm = makeGame();
    const s = gm.state;
    const topCard = s.players.P1.throne[0];
    ZoneManager.millCards(s, 'P1', 1);
    assert.ok(s.players.P1.abyss.includes(topCard));
    assert.equal(topCard.zone, 'ABYSS');
  });

  it('drawing from empty deck sets winner', () => {
    const gm = makeGame();
    const s = gm.state;
    const deckSize = s.players.P1.throne.length;
    ZoneManager.millCards(s, 'P1', deckSize);
    ZoneManager.drawCards(s, 'P1', 1);
    assert.equal(s.winner, 'P2');
  });

  it('shuffleDeck preserves all cards', () => {
    const gm = makeGame();
    const s = gm.state;
    const before = s.players.P1.throne.map(c => c.instanceId).sort();
    ZoneManager.shuffleDeck(s, 'P1');
    const after = s.players.P1.throne.map(c => c.instanceId).sort();
    assert.deepEqual(before, after);
  });

});

describe('ZoneManager — findCard', () => {

  it('finds card in HAND', () => {
    const gm = makeGame();
    const s = gm.state;
    const card = s.players.P1.hand[0];
    const { card: found } = ZoneManager.findCard(s, card.instanceId);
    assert.equal(found, card);
  });

  it('returns null for unknown instanceId', () => {
    const gm = makeGame();
    const { card } = ZoneManager.findCard(gm.state, 'NONEXISTENT_999');
    assert.equal(card, null);
  });

});
