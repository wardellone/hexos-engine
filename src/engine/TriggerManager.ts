// ============================================================
// HEXOS TCG — Trigger Manager
// Finds cards that respond to trigger events and queues effects
// ============================================================

import { GameState, TriggerEntry, CardInstance, StackEntry, PlayerId } from '../types/game';
import { TriggerEvent, Ability } from '../types/card';
import { ZoneManager } from './ZoneManager';
import { EffectExecutor } from './EffectExecutor';
import { generateStackId } from '../utils/id';

export class TriggerManager {

  // ---- Resolve a single trigger event ----------------------
  static resolve(state: GameState, trigger: TriggerEntry): TriggerEntry[] {
    const newTriggers: TriggerEntry[] = [];

    // Check all cards on field (both players) for matching triggered abilities
    for (const playerId of ['P1', 'P2'] as PlayerId[]) {
      const player = state.players[playerId];
      const allCards = [...player.field, ...player.abyss, ...player.hand];

      for (const card of allCards) {
        for (const ability of card.def.abilities) {
          if (!TriggerManager.matchesTrigger(ability, trigger, card, state)) continue;

          // Skip once-per-turn abilities already used
          if (ability.once && card.usedAbilities.has(ability.abilityId)) continue;

          // Auto-resolve triggered abilities (Opzione A: auto-resolve unless negated)
          state.log.push({
            turn: state.turn,
            phase: state.phase,
            timestamp: Date.now(),
            message: `TRIGGER: ${card.def.displayName} — ${ability.name}`,
            type: 'TRIGGER',
          });

          if (ability.once) card.usedAbilities.add(ability.abilityId);

          // Execute each effect op
          for (const op of ability.effects) {
            const t = EffectExecutor.execute(state, op, card, []);
            newTriggers.push(...t);
          }
        }
      }
    }

    return newTriggers;
  }

  // ---- Match ability trigger to event ----------------------
  private static matchesTrigger(
    ability: Ability,
    trigger: TriggerEntry,
    card: CardInstance,
    state: GameState
  ): boolean {
    if (ability.type !== 'TRIGGERED' && ability.type !== 'PASSIVE') return false;
    if (!ability.trigger) return false;
    if (ability.trigger !== trigger.event) return false;

    // Zone restrictions for triggers
    switch (ability.trigger) {
      case 'ON_ENTER_FIELD':
      case 'ON_ATTACK_DECLARED':
      case 'ON_ATTACK_RESOLVED':
        // These fire only if the triggering card matches source card
        if (trigger.affectedCard && trigger.affectedCard !== card.instanceId) return false;
        if (card.zone !== 'FIELD') return false;
        break;

      case 'ON_DEATH':
        // ON_DEATH fires for the card that died
        if (trigger.affectedCard && trigger.affectedCard !== card.instanceId) return false;
        break;

      case 'ON_CARD_TO_ABYSS':
        // Can fire from field or abyss (for other cards dying while this watches)
        if (card.zone !== 'FIELD' && card.zone !== 'ABYSS') return false;
        break;

      case 'ON_TURN_START':
      case 'ON_TURN_END':
        if (card.zone !== 'FIELD') return false;
        // Only fire for the controller's turn
        if (trigger.controller !== card.controller) return false;
        break;

      case 'ON_OPPONENT_ACTIVATE_RITO':
        if (card.zone !== 'FIELD') return false;
        if (trigger.controller === card.controller) return false; // Opponent's rito
        break;

      case 'ON_OPPONENT_ACTIVATE_VOW':
        if (card.zone !== 'FIELD') return false;
        if (trigger.controller === card.controller) return false;
        break;

      case 'ON_DRAW':
        if (card.zone !== 'FIELD') return false;
        if (trigger.controller !== card.controller) return false;
        break;

      case 'PASSIVE':
        // Passive effects don't fire from trigger events
        return false;

      default:
        if (card.zone !== 'FIELD') return false;
    }

    return true;
  }
}
