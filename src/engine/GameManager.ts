// ============================================================
// HEXOS TCG — Game Manager
// Orchestrates the full game loop:
// AWAKENING → STRATEGIC → CONFLICT → TERMINAL
// ============================================================

import {
  GameState, PlayerState, PlayerId, GamePhase,
  PlayerAction, EngineEvent, StackEntry, TriggerEntry,
  CardInstance,
} from '../types/game';
import { CardDefinition, Ability } from '../types/card';
import { ZoneManager, HAND_MAX } from './ZoneManager';
import { EffectExecutor } from './EffectExecutor';
import { TriggerManager } from './TriggerManager';
import { generateId, generateGameId, generateStackId } from '../utils/id';

const STARTING_LIFE = 8000;
const STARTING_HAND = 5;

export class GameManager {
  public state: GameState;
  private eventListeners: ((event: EngineEvent) => void)[] = [];

  constructor(
    p1Deck: CardDefinition[],
    p2Deck: CardDefinition[]
  ) {
    this.state = GameManager.createInitialState(p1Deck, p2Deck);
  }

  // ---- Subscribe to engine events (for UI) -----------------
  on(listener: (event: EngineEvent) => void): void {
    this.eventListeners.push(listener);
  }

  private emit(event: EngineEvent): void {
    this.eventListeners.forEach(l => l(event));
  }

  // ---- Start game (deal hands, trigger game start) ---------
  startGame(): void {
    // Deal starting hands
    ZoneManager.drawCards(this.state, 'P1', STARTING_HAND);
    ZoneManager.drawCards(this.state, 'P2', STARTING_HAND);

    this.log('Game started! P1 goes first.', 'SYSTEM');
    this.beginPhase('AWAKENING');
  }

  // ---- Process player action ------------------------------
  processAction(action: PlayerAction): void {
    const state = this.state;

    if (state.step === 'GAME_OVER') return;

    switch (action.type) {

      case 'PASS':
        if (state.step === 'RESPONSE_WINDOW') {
          // Opponent passes on response — resolve top of stack
          this.resolveStack();
        } else {
          // Active player passes priority
          this.advancePhase();
        }
        break;

      case 'CHANGE_PHASE':
        this.advancePhase();
        break;

      case 'SUMMON': {
        if (state.phase !== 'STRATEGIC') {
          this.log('[ERROR] Can only summon in STRATEGIC phase', 'ERROR');
          return;
        }
        const { instanceId, position } = action;
        const { card } = ZoneManager.findCard(state, instanceId);
        if (!card || card.zone !== 'HAND' || card.controller !== state.activePlayer) {
          this.log('[ERROR] Invalid summon target', 'ERROR');
          return;
        }
        if (!ZoneManager.canSummonToField(state, state.activePlayer)) {
          this.log('[ERROR] Field full (max 5)', 'ERROR');
          return;
        }

        card.position = position;
        card.summonedThisTurn = true;

        // Summon = move HAND → FIELD
        const triggers = ZoneManager.moveCard(state, instanceId, 'FIELD');
        state.players[state.activePlayer].colossiSummonedThisTurn++;

        this.log(`${state.activePlayer} summons ${card.def.displayName} in ${position} position`, 'ACTION');

        // Push to stack, open response window
        const entry: StackEntry = {
          id: generateStackId(),
          type: 'SUMMON_COLOSSUS',
          sourceCard: instanceId,
          controller: state.activePlayer,
          payload: { instanceId, position },
          negated: false,
        };
        state.stack.push(entry);

        this.openResponseWindow(entry);
        this.queueTriggers(triggers);
        break;
      }

      case 'ACTIVATE_ABILITY': {
        const { instanceId, abilityId, targets } = action;
        const { card } = ZoneManager.findCard(state, instanceId);
        if (!card || card.controller !== state.activePlayer) return;

        const ability = card.def.abilities.find(a => a.abilityId === abilityId);
        if (!ability) return;

        if (ability.once && card.usedAbilities.has(abilityId)) {
          this.log('[ERROR] Ability already used this turn', 'ERROR');
          return;
        }

        // Validate and pay cost
        if (!this.payCost(card, ability)) return;

        card.usedAbilities.add(abilityId);

        // Determine action type
        const actionType = ability.type === 'INSTANT' ? 'ACTIVATE_VETO'
          : card.def.type === 'RITO' ? 'ACTIVATE_RITO'
          : card.def.type === 'VASSAL' ? 'ACTIVATE_VASSAL'
          : card.def.type === 'PILLAR' ? 'ACTIVATE_PILLAR'
          : 'ACTIVATE_VASSAL';

        const entry: StackEntry = {
          id: generateStackId(),
          type: actionType,
          sourceCard: instanceId,
          sourceAbility: abilityId,
          controller: state.activePlayer,
          payload: { targets: targets ?? [] },
          negated: false,
        };
        state.stack.push(entry);

        this.log(`${state.activePlayer} activates ${ability.name} (${card.def.displayName})`, 'ACTION');
        this.openResponseWindow(entry);
        break;
      }

      case 'ATTACK': {
        if (state.phase !== 'CONFLICT') {
          this.log('[ERROR] Can only attack in CONFLICT phase', 'ERROR');
          return;
        }
        const { attackerId, targetId } = action;
        const { card: attacker } = ZoneManager.findCard(state, attackerId);
        if (!attacker || attacker.zone !== 'FIELD' || attacker.controller !== state.activePlayer) return;
        if (attacker.attackedThisTurn || attacker.keywords.has('CANNOT_ATTACK')) return;
        if (attacker.summonedThisTurn && !attacker.keywords.has('RUSH')) return;

        const entry: StackEntry = {
          id: generateStackId(),
          type: 'DECLARE_ATTACK',
          sourceCard: attackerId,
          controller: state.activePlayer,
          payload: { attackerId, targetId },
          negated: false,
        };
        state.stack.push(entry);

        this.log(`${state.activePlayer} declares attack: ${attacker.def.displayName} → ${targetId}`, 'ACTION');
        this.emit({ type: 'ATTACK_DECLARED', attackerId, targetId });
        this.openResponseWindow(entry);

        // Queue ON_ATTACK_DECLARED triggers
        const triggers: TriggerEntry[] = [{
          event: 'ON_ATTACK_DECLARED',
          sourceCard: attackerId,
          affectedCard: typeof targetId === 'string' ? targetId : undefined,
          data: { attackerId, targetId },
          controller: state.activePlayer,
        }];
        this.queueTriggers(triggers);
        break;
      }

      case 'RESPOND_VETO': {
        const { vetoCardId, abilityId, targets } = action;
        const { card } = ZoneManager.findCard(state, vetoCardId);
        if (!card || card.controller !== ZoneManager.getOpponent(state.activePlayer)) return;

        const ability = card.def.abilities.find(a => a.abilityId === abilityId);
        if (!ability || ability.type !== 'INSTANT') return;

        if (!this.payCost(card, ability)) return;
        card.usedAbilities.add(abilityId);

        const entry: StackEntry = {
          id: generateStackId(),
          type: 'ACTIVATE_VETO',
          sourceCard: vetoCardId,
          sourceAbility: abilityId,
          controller: card.controller,
          payload: { targets: targets ?? [] },
          negated: false,
        };
        state.stack.push(entry);
        this.log(`${card.controller} responds with ${ability.name}`, 'ACTION');

        // Resolve stack
        this.resolveStack();
        break;
      }

      case 'RESPOND_PASS':
        // Opponent passes — resolve stack top
        this.resolveStack();
        break;
    }
  }

  // ---- Resolve top of the stack ----------------------------
  private resolveStack(): void {
    const state = this.state;
    if (state.stack.length === 0) return;

    const entry = state.stack.pop()!;

    if (entry.negated) {
      this.log(`[NEGATED] ${entry.type} from ${entry.sourceCard}`, 'EFFECT');
      this.emit({ type: 'EFFECT_NEGATED', stackEntryId: entry.id });
      if (state.stack.length > 0) this.resolveStack();
      return;
    }

    switch (entry.type) {
      case 'SUMMON_COLOSSUS': {
        // Summon already happened (card moved to field) — just resolve triggers
        this.resolveQueuedTriggers();
        break;
      }

      case 'ACTIVATE_RITO':
      case 'ACTIVATE_VETO':
      case 'ACTIVATE_VASSAL':
      case 'ACTIVATE_PILLAR': {
        const { card } = ZoneManager.findCard(state, entry.sourceCard);
        if (!card) break;

        const ability = card.def.abilities.find(a => a.abilityId === entry.sourceAbility);
        if (!ability) break;

        const chosenTargets = ((entry.payload.targets as string[]) ?? [])
          .map(id => ZoneManager.findCard(state, id).card)
          .filter(Boolean) as CardInstance[];

        const triggers: TriggerEntry[] = [];
        for (const op of ability.effects) {
          if (op.optional) continue; // Optional ops require player choice (TODO: request from UI)
          const t = EffectExecutor.execute(state, op, card, chosenTargets);
          triggers.push(...t);
        }
        this.queueTriggers(triggers);
        this.resolveQueuedTriggers();
        break;
      }

      case 'DECLARE_ATTACK': {
        const { attackerId, targetId } = entry.payload as { attackerId: string; targetId: string };
        this.resolveCombat(attackerId, targetId);
        break;
      }

      case 'TRIGGER_ABILITY': {
        const { card } = ZoneManager.findCard(state, entry.sourceCard);
        if (!card) break;

        const ability = card.def.abilities.find(a => a.abilityId === entry.sourceAbility);
        if (!ability) break;

        const triggers: TriggerEntry[] = [];
        for (const op of ability.effects) {
          const t = EffectExecutor.execute(state, op, card, []);
          triggers.push(...t);
        }
        this.queueTriggers(triggers);
        this.resolveQueuedTriggers();
        break;
      }
    }

    // Continue resolving if more on stack
    if (state.step === 'GAME_OVER') return;
    if (state.stack.length > 0) {
      this.resolveStack();
    } else {
      state.step = 'PLAYER_ACTION';
    }
  }

  // ---- Combat Resolution -----------------------------------
  private resolveCombat(attackerId: string, targetId: string): void {
    const state = this.state;
    const { card: attacker } = ZoneManager.findCard(state, attackerId);
    if (!attacker) return;

    attacker.attackedThisTurn = true;

    if (targetId === 'DIRECT') {
      // Direct attack to opponent's life
      const opponent = ZoneManager.getOpponent(state.activePlayer);
      const damage = attacker.atk;
      state.players[opponent].life = Math.max(0, state.players[opponent].life - damage);
      this.log(`DIRECT ATTACK: ${attacker.def.displayName} deals ${damage} to ${opponent} (life: ${state.players[opponent].life})`, 'ACTION');
      this.emit({ type: 'DAMAGE_DEALT', targetPlayer: opponent, amount: damage, sourceCard: attackerId });

      if (state.players[opponent].life === 0) {
        this.endGame(state.activePlayer, `${opponent} life reached 0`);
        return;
      }
    } else {
      // Monster vs Monster combat
      const { card: defender } = ZoneManager.findCard(state, targetId);
      if (!defender || defender.zone !== 'FIELD') return;

      const atkA = attacker.atk;
      const defB = defender.position === 'GUARD' ? defender.shield : defender.atk;

      this.log(`COMBAT: ${attacker.def.displayName} (${atkA}) vs ${defender.def.displayName} (${defB})`, 'ACTION');

      if (atkA > defB) {
        // Attacker wins
        const excess = atkA - defB;
        ZoneManager.moveCard(state, targetId, 'ABYSS');
        const opponent = ZoneManager.getOpponent(state.activePlayer);
        state.players[opponent].life = Math.max(0, state.players[opponent].life - excess);
        this.log(`${defender.def.displayName} destroyed! Excess damage: ${excess}`, 'EFFECT');
        if (excess > 0) this.emit({ type: 'DAMAGE_DEALT', targetPlayer: opponent, amount: excess, sourceCard: attackerId });

        if (state.players[opponent].life === 0) {
          this.endGame(state.activePlayer, `${opponent} life reached 0`);
          return;
        }
      } else if (defB > atkA) {
        // Defender wins
        ZoneManager.moveCard(state, attackerId, 'ABYSS');
        const excess = defB - atkA;
        state.players[state.activePlayer].life = Math.max(0, state.players[state.activePlayer].life - excess);
        this.log(`${attacker.def.displayName} destroyed! Counter damage: ${excess}`, 'EFFECT');
        if (excess > 0) this.emit({ type: 'DAMAGE_DEALT', targetPlayer: state.activePlayer, amount: excess, sourceCard: targetId });

        if (state.players[state.activePlayer].life === 0) {
          this.endGame(ZoneManager.getOpponent(state.activePlayer), `${state.activePlayer} life reached 0`);
          return;
        }
      } else {
        // Tie — both destroyed
        ZoneManager.moveCard(state, attackerId, 'ABYSS');
        ZoneManager.moveCard(state, targetId, 'ABYSS');
        this.log('Both monsters destroyed (tie)!', 'EFFECT');
      }

      this.emit({ type: 'COMBAT_RESOLVED', attackerId, targetId, result: 'resolved' });
    }
  }

  // ---- Phase Management ------------------------------------
  private beginPhase(phase: GamePhase): void {
    const state = this.state;
    const prev = state.phase;
    state.phase = phase;
    state.step = 'PHASE_START';

    this.log(`--- ${phase} PHASE (Turn ${state.turn}, ${state.activePlayer}) ---`, 'SYSTEM');
    this.emit({ type: 'PHASE_CHANGE', from: prev, to: phase });

    switch (phase) {
      case 'AWAKENING': {
        // Reset per-turn state
        const player = state.players[state.activePlayer];
        player.ritosActivatedThisTurn = 0;
        player.colossiSummonedThisTurn = 0;

        // Reset card per-turn state
        for (const card of player.field) {
          card.attackedThisTurn = false;
          card.summonedThisTurn = false;
          card.usedAbilities.clear();
          // Remove UNTIL_END_OF_TURN modifiers
          for (const mod of card.modifiers.filter(m => m.duration === 'UNTIL_END_OF_TURN')) {
            const statKey = mod.stat.toLowerCase() as 'atk' | 'core' | 'shield';
            card[statKey] = Math.max(0, card[statKey] - mod.delta);
          }
          card.modifiers = card.modifiers.filter(m => m.duration !== 'UNTIL_END_OF_TURN');
        }

        // Draw 1 card (skip on first turn for P1 per common rule)
        if (!(state.turn === 1 && state.activePlayer === 'P1')) {
          ZoneManager.drawCards(state, state.activePlayer, 1);
        }

        state.step = 'PLAYER_ACTION';
        this.advancePhase(); // Auto-advance to STRATEGIC
        break;
      }

      case 'STRATEGIC':
        state.step = 'PLAYER_ACTION';
        break;

      case 'CONFLICT':
        state.step = 'PLAYER_ACTION';
        break;

      case 'TERMINAL': {
        // End-of-turn triggers
        this.queueTriggers([{
          event: 'ON_TURN_END',
          sourceCard: 'SYSTEM',
          data: { player: state.activePlayer, turn: state.turn },
          controller: state.activePlayer,
        }]);
        this.resolveQueuedTriggers();

        // Discard to hand limit
        const hand = state.players[state.activePlayer].hand;
        while (hand.length > HAND_MAX) {
          const discarded = hand.pop()!;
          ZoneManager.moveCard(state, discarded.instanceId, 'ABYSS');
          this.log(`${state.activePlayer} discards ${discarded.def.displayName} (hand limit)`, 'ACTION');
        }

        // Pass turn
        this.endTurn();
        break;
      }
    }
  }

  private advancePhase(): void {
    const state = this.state;
    switch (state.phase) {
      case 'AWAKENING': this.beginPhase('STRATEGIC'); break;
      case 'STRATEGIC': this.beginPhase('CONFLICT'); break;
      case 'CONFLICT': this.beginPhase('TERMINAL'); break;
      case 'TERMINAL': this.endTurn(); break;
    }
  }

  private endTurn(): void {
    const state = this.state;
    state.activePlayer = ZoneManager.getOpponent(state.activePlayer);
    if (state.activePlayer === 'P1') {
      state.turn++;
    }
    this.beginPhase('AWAKENING');
  }

  // ---- Response Window ------------------------------------
  private openResponseWindow(entry: StackEntry): void {
    const state = this.state;
    const opponent = ZoneManager.getOpponent(state.activePlayer);

    state.step = 'RESPONSE_WINDOW';
    this.emit({ type: 'REQUEST_RESPONSE', player: opponent, againstAction: entry.type });

    // Note: In CLI/test mode, the engine waits for processAction to be called
    // In production, the UI calls processAction('RESPOND_PASS') or 'RESPOND_VETO'
  }

  // ---- Trigger System -------------------------------------
  private queueTriggers(triggers: TriggerEntry[]): void {
    this.state.triggerQueue.push(...triggers);
  }

  private resolveQueuedTriggers(): void {
    const state = this.state;

    while (state.triggerQueue.length > 0) {
      const trigger = state.triggerQueue.shift()!;
      const newTriggers = TriggerManager.resolve(state, trigger);
      state.triggerQueue.push(...newTriggers);
      if (state.step === 'GAME_OVER') break;
    }
  }

  // ---- Cost Payment ---------------------------------------
  private payCost(card: CardInstance, ability: Ability): boolean {
    const state = this.state;
    const cost = ability.cost;
    if (!cost || cost.type === 'NONE') return true;

    const player = state.players[card.controller];

    switch (cost.type) {
      case 'SACRIFICE': {
        if (player.field.length < cost.count) {
          this.log('[ERROR] Not enough monsters to sacrifice', 'ERROR');
          return false;
        }
        // Auto-sacrifice the source card itself if it's on field
        if (card.zone === 'FIELD') {
          ZoneManager.moveCard(state, card.instanceId, 'ABYSS');
        }
        return true;
      }

      case 'RETURN': {
        const zone = ZoneManager.getZone(state, card.controller, cost.from);
        if (zone.length < cost.count) {
          this.log('[ERROR] Not enough cards for RETURN cost', 'ERROR');
          return false;
        }
        for (let i = 0; i < cost.count; i++) {
          const c = zone[0];
          ZoneManager.moveCard(state, c.instanceId, 'HAND');
        }
        return true;
      }

      case 'DRAWN': {
        if (player.throne.length < cost.count) return false;
        ZoneManager.drawCards(state, card.controller, cost.count);
        return true;
      }

      case 'BANISH': {
        const zone = ZoneManager.getZone(state, card.controller, cost.from);
        if (zone.length < cost.count) return false;
        for (let i = 0; i < cost.count; i++) {
          ZoneManager.moveCard(state, zone[0].instanceId, 'SEAL');
        }
        return true;
      }

      default:
        return true;
    }
  }

  // ---- Game Over ------------------------------------------
  private endGame(winner: PlayerId, reason: string): void {
    this.state.winner = winner;
    this.state.step = 'GAME_OVER';
    this.log(`GAME OVER — ${winner} wins! (${reason})`, 'SYSTEM');
    this.emit({ type: 'GAME_OVER', winner, reason });
  }

  // ---- Helpers --------------------------------------------
  private log(message: string, type: 'ACTION' | 'TRIGGER' | 'EFFECT' | 'SYSTEM' | 'ERROR'): void {
    this.state.log.push({
      turn: this.state.turn,
      phase: this.state.phase,
      timestamp: Date.now(),
      message,
      type,
    });
  }

  // ---- State Factory --------------------------------------
  static createInitialState(p1Deck: CardDefinition[], p2Deck: CardDefinition[]): GameState {
    const makePlayer = (id: PlayerId, deck: CardDefinition[]): PlayerState => ({
      id,
      throne: deck.map(def => ZoneManager.createInstance(def, id)),
      hand: [],
      field: [],
      abyss: [],
      seal: [],
      life: STARTING_LIFE,
      hasCurse: false,
      eclipseActive: false,
      ritosActivatedThisTurn: 0,
      colossiSummonedThisTurn: 0,
    });

    return {
      gameId: generateGameId(),
      turn: 1,
      activePlayer: 'P1',
      phase: 'AWAKENING',
      step: 'PHASE_START',
      players: {
        P1: makePlayer('P1', p1Deck),
        P2: makePlayer('P2', p2Deck),
      },
      stack: [],
      triggerQueue: [],
      log: [],
      winner: null,
      turnStartTime: Date.now(),
    };
  }
}
