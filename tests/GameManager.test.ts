// ============================================================
// HEXOS TCG — Game Manager Tests (Node built-in test runner)
// Run with: tsx --test tests/GameManager.test.ts
// ============================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GameManager } from '../src/engine/GameManager';
import { ZoneManager } from '../src/engine/ZoneManager';
import { getDinoDeck, getRomeDeck } from '../src/corpus/CardLoader';
import { resetCounter } from '../src/utils/id';

function makeGame() {
  resetCounter();
  return new GameManager(getDinoDeck(), getRomeDeck());
}

function startedGame() {
  const gm = makeGame();
  gm.startGame();
  return gm;
}

describe('GameManager — Initialization', () => {

  it('game starts with both players at 8000 life', () => {
    const gm = startedGame();
    assert.equal(gm.state.players.P1.life, 8000);
    assert.equal(gm.state.players.P2.life, 8000);
  });

  it('P1 goes first', () => {
    const gm = startedGame();
    assert.equal(gm.state.activePlayer, 'P1');
  });

  it('both players start with 5-card hands', () => {
    const gm = startedGame();
    assert.equal(gm.state.players.P1.hand.length, 5);
    assert.equal(gm.state.players.P2.hand.length, 5);
  });

  it('starts in STRATEGIC phase (AWAKENING auto-advances)', () => {
    const gm = startedGame();
    assert.equal(gm.state.phase, 'STRATEGIC');
  });

});

describe('GameManager — Phase Progression', () => {

  it('PASS from STRATEGIC moves to CONFLICT', () => {
    const gm = startedGame();
    gm.processAction({ type: 'PASS' });
    assert.equal(gm.state.phase, 'CONFLICT');
  });

  it('after CONFLICT PASS, P1 turn ends and P2 becomes active', () => {
    const gm = startedGame();
    gm.processAction({ type: 'PASS' }); // → CONFLICT
    gm.processAction({ type: 'PASS' }); // → TERMINAL → auto P2 AWAKENING → P2 STRATEGIC
    // TERMINAL auto-resolves and passes to P2
    assert.equal(gm.state.activePlayer, 'P2');
    assert.equal(gm.state.phase, 'STRATEGIC');
  });

  it('P2 draws 1 card on their AWAKENING', () => {
    const gm = startedGame();
    const p2Before = gm.state.players.P2.hand.length;
    gm.processAction({ type: 'PASS' }); // P1: → CONFLICT
    gm.processAction({ type: 'PASS' }); // P1: → TERMINAL → P2 AWAKENING draws
    assert.equal(gm.state.players.P2.hand.length, p2Before + 1);
  });

  it('turn counter increments after full round', () => {
    const gm = startedGame();
    assert.equal(gm.state.turn, 1);
    gm.processAction({ type: 'PASS' });
    gm.processAction({ type: 'PASS' }); // P1 done → P2 starts
    gm.processAction({ type: 'PASS' }); // P2: → CONFLICT
    gm.processAction({ type: 'PASS' }); // P2: → TERMINAL → P1 AWAKENING turn 2
    assert.equal(gm.state.turn, 2);
    assert.equal(gm.state.activePlayer, 'P1');
  });

});

describe('GameManager — Summon', () => {

  it('summon a card from hand to field', () => {
    const gm = startedGame();
    const s = gm.state;
    const card = s.players.P1.hand[0];

    gm.processAction({ type: 'SUMMON', instanceId: card.instanceId, position: 'ATTACK' });
    gm.processAction({ type: 'RESPOND_PASS' }); // resolve

    assert.ok(s.players.P1.field.includes(card));
    assert.equal(card.zone, 'FIELD');
    assert.equal(card.position, 'ATTACK');
  });

  it('summon in GUARD position', () => {
    const gm = startedGame();
    const s = gm.state;
    const card = s.players.P1.hand[0];

    gm.processAction({ type: 'SUMMON', instanceId: card.instanceId, position: 'GUARD' });
    gm.processAction({ type: 'RESPOND_PASS' });

    assert.equal(card.position, 'GUARD');
  });

  it('cannot summon outside STRATEGIC phase', () => {
    const gm = startedGame();
    const s = gm.state;
    gm.processAction({ type: 'PASS' }); // → CONFLICT

    const card = s.players.P1.hand[0];
    gm.processAction({ type: 'SUMMON', instanceId: card.instanceId, position: 'ATTACK' });

    assert.ok(!s.players.P1.field.includes(card));
  });

  it('field is limited to 5 cards', () => {
    const gm = startedGame();
    const s = gm.state;
    ZoneManager.drawCards(s, 'P1', 5);

    let summoned = 0;
    while (s.players.P1.hand.length > 0 && summoned < 6) {
      const card = s.players.P1.hand[0];
      if (!ZoneManager.canSummonToField(s, 'P1')) break;
      gm.processAction({ type: 'SUMMON', instanceId: card.instanceId, position: 'ATTACK' });
      gm.processAction({ type: 'RESPOND_PASS' });
      summoned++;
    }

    assert.ok(s.players.P1.field.length <= 5);
  });

});

describe('GameManager — Combat', () => {

  function setupCombat() {
    const gm = startedGame();
    const s = gm.state;

    // Pick Colossi (have ATK stats); fall back to first card
    const findColossus = (hand: typeof s.players.P1.hand) =>
      hand.find(c => c.def.type === 'COLOSSUS' && c.atk > 0) ?? hand[0];

    const attacker = findColossus(s.players.P1.hand);
    const defender = findColossus(s.players.P2.hand);

    ZoneManager.moveCard(s, attacker.instanceId, 'FIELD');
    ZoneManager.moveCard(s, defender.instanceId, 'FIELD');

    attacker.summonedThisTurn = false;

    gm.processAction({ type: 'PASS' }); // → CONFLICT

    return { gm, s, attacker, defender };
  }

  it('direct attack reduces opponent life', () => {
    const { gm, s, attacker, defender } = setupCombat();
    // Remove defender to allow direct
    ZoneManager.moveCard(s, defender.instanceId, 'HAND');

    const beforeLife = s.players.P2.life;
    const expectedDamage = attacker.atk;
    gm.processAction({ type: 'ATTACK', attackerId: attacker.instanceId, targetId: 'DIRECT' });
    gm.processAction({ type: 'RESPOND_PASS' });

    const expectedLife = Math.max(0, beforeLife - expectedDamage);
    assert.equal(s.players.P2.life, expectedLife);
  });

  it('stronger attacker destroys defender', () => {
    const { gm, s, attacker, defender } = setupCombat();
    attacker.atk = 9999;
    defender.atk = 1000;
    defender.position = 'ATTACK';

    gm.processAction({ type: 'ATTACK', attackerId: attacker.instanceId, targetId: defender.instanceId });
    gm.processAction({ type: 'RESPOND_PASS' });

    assert.equal(defender.zone, 'ABYSS');
  });

  it('weaker attacker is destroyed', () => {
    const { gm, s, attacker, defender } = setupCombat();
    attacker.atk = 1000;
    defender.atk = 9999;
    defender.position = 'ATTACK';

    gm.processAction({ type: 'ATTACK', attackerId: attacker.instanceId, targetId: defender.instanceId });
    gm.processAction({ type: 'RESPOND_PASS' });

    assert.equal(attacker.zone, 'ABYSS');
  });

  it('equal ATK destroys both', () => {
    const { gm, s, attacker, defender } = setupCombat();
    attacker.atk = 5000;
    defender.atk = 5000;
    defender.position = 'ATTACK';

    gm.processAction({ type: 'ATTACK', attackerId: attacker.instanceId, targetId: defender.instanceId });
    gm.processAction({ type: 'RESPOND_PASS' });

    assert.equal(attacker.zone, 'ABYSS');
    assert.equal(defender.zone, 'ABYSS');
  });

  it('life at 0 ends game', () => {
    const { gm, s, attacker, defender } = setupCombat();
    ZoneManager.moveCard(s, defender.instanceId, 'HAND');

    s.players.P2.life = 100;
    attacker.atk = 9999;

    gm.processAction({ type: 'ATTACK', attackerId: attacker.instanceId, targetId: 'DIRECT' });
    gm.processAction({ type: 'RESPOND_PASS' });

    assert.equal(s.winner, 'P1');
    assert.equal(s.step, 'GAME_OVER');
  });

});

describe('GameManager — Corpus Loading', () => {

  it('DINO deck loads correctly', () => {
    const deck = getDinoDeck();
    assert.ok(deck.length > 0);
    for (const card of deck) {
      assert.ok(card.defId);
      assert.ok(card.displayName);
      assert.match(card.type, /COLOSSUS|RITO|VETO|VASSAL|PILLAR/);
      assert.equal(card.affinity, 'DINO');
    }
  });

  it('ROME deck loads correctly', () => {
    const deck = getRomeDeck();
    assert.ok(deck.length > 0);
    assert.ok(deck.every(c => c.affinity === 'ROME'));
  });

  it('all DINO cards have abilities array', () => {
    const deck = getDinoDeck();
    for (const card of deck) {
      assert.ok(Array.isArray(card.abilities));
    }
  });

});
