// ============================================================
// HEXOS TCG — Effect Executor
// Resolves EffectOp instructions against the game state
// ============================================================

import { GameState, CardInstance, PlayerId, TriggerEntry } from '../types/game';
import { EffectOp, TargetType, Affinity } from '../types/card';
import { ZoneManager } from './ZoneManager';

export class EffectExecutor {

  // ---- Main entry: execute one EffectOp --------------------
  static execute(
    state: GameState,
    op: EffectOp,
    sourceCard: CardInstance,
    chosenTargets: CardInstance[] = []
  ): TriggerEntry[] {
    const triggers: TriggerEntry[] = [];
    const controller = sourceCard.controller;

    switch (op.op) {

      case 'DRAW': {
        const player = op.target === 'OPPONENT'
          ? ZoneManager.getOpponent(controller)
          : controller;
        const t = ZoneManager.drawCards(state, player, op.value ?? 1);
        triggers.push(...t);
        break;
      }

      case 'MILL': {
        const player = op.target === 'OPPONENT'
          ? ZoneManager.getOpponent(controller)
          : controller;
        const t = ZoneManager.millCards(state, player, op.value ?? 1);
        triggers.push(...t);
        break;
      }

      case 'MOVE_ZONE': {
        const targets = EffectExecutor.resolveTargets(state, op, sourceCard, chosenTargets);
        for (const target of targets) {
          if (op.toZone) {
            const t = ZoneManager.moveCard(state, target.instanceId, op.toZone);
            triggers.push(...t);
          }
        }
        break;
      }

      case 'DESTROY': {
        const targets = EffectExecutor.resolveTargets(state, op, sourceCard, chosenTargets);
        for (const target of targets) {
          const t = ZoneManager.moveCard(state, target.instanceId, 'ABYSS');
          triggers.push(...t);
          state.log.push({
            turn: state.turn, phase: state.phase, timestamp: Date.now(),
            message: `${target.def.displayName} is destroyed`,
            type: 'EFFECT',
          });
        }
        break;
      }

      case 'BANISH': {
        const targets = EffectExecutor.resolveTargets(state, op, sourceCard, chosenTargets);
        for (const target of targets) {
          const t = ZoneManager.moveCard(state, target.instanceId, 'SEAL');
          triggers.push(...t);
        }
        break;
      }

      case 'SET_STAT': {
        const targets = EffectExecutor.resolveTargets(state, op, sourceCard, chosenTargets);
        for (const target of targets) {
          if (op.stat && op.value !== undefined) {
            const key = op.stat.toLowerCase() as 'atk' | 'core' | 'shield';
            const old = target[key];
            target[key] = op.value;
            state.log.push({
              turn: state.turn, phase: state.phase, timestamp: Date.now(),
              message: `${target.def.displayName} ${op.stat} set to ${op.value} (was ${old})`,
              type: 'EFFECT',
            });
          }
        }
        break;
      }

      case 'MODIFY_STAT': {
        const targets = EffectExecutor.resolveTargets(state, op, sourceCard, chosenTargets);
        for (const target of targets) {
          if (op.stat && op.value !== undefined) {
            const key = op.stat.toLowerCase() as 'atk' | 'core' | 'shield';
            const old = target[key];
            target[key] = Math.max(0, old + op.value);
            target.modifiers.push({
              source: sourceCard.instanceId,
              stat: op.stat,
              delta: op.value,
              duration: op.duration ?? 'PERMANENT',
            });
            state.log.push({
              turn: state.turn, phase: state.phase, timestamp: Date.now(),
              message: `${target.def.displayName} ${op.stat} ${op.value >= 0 ? '+' : ''}${op.value} → ${target[key]}`,
              type: 'EFFECT',
            });
          }
        }
        break;
      }

      case 'GRANT_KEYWORD': {
        const targets = EffectExecutor.resolveTargets(state, op, sourceCard, chosenTargets);
        for (const target of targets) {
          if (op.keyword) {
            target.keywords.add(op.keyword);
            triggers.push({
              event: 'ON_KEYWORD_GAINED',
              sourceCard: sourceCard.instanceId,
              affectedCard: target.instanceId,
              data: { keyword: op.keyword },
              controller,
            });
          }
        }
        break;
      }

      case 'REMOVE_KEYWORD': {
        const targets = EffectExecutor.resolveTargets(state, op, sourceCard, chosenTargets);
        for (const target of targets) {
          if (op.keyword) target.keywords.delete(op.keyword);
        }
        break;
      }

      case 'GAIN_CURSE': {
        const targets = EffectExecutor.resolveTargets(state, op, sourceCard, chosenTargets);
        for (const target of targets) {
          target.hasCurse = true;
          triggers.push({
            event: 'ON_CURSE_GAINED',
            sourceCard: sourceCard.instanceId,
            affectedCard: target.instanceId,
            data: {},
            controller,
          });
        }
        break;
      }

      case 'REMOVE_CURSE': {
        const targets = EffectExecutor.resolveTargets(state, op, sourceCard, chosenTargets);
        for (const target of targets) {
          target.hasCurse = false;
          triggers.push({
            event: 'ON_CURSE_REMOVED',
            sourceCard: sourceCard.instanceId,
            affectedCard: target.instanceId,
            data: {},
            controller,
          });
        }
        break;
      }

      case 'DEAL_DAMAGE': {
        const targetPlayer = op.target === 'OPPONENT'
          ? ZoneManager.getOpponent(controller)
          : controller;
        const amount = op.value ?? 0;
        state.players[targetPlayer].life = Math.max(0, state.players[targetPlayer].life - amount);
        state.log.push({
          turn: state.turn, phase: state.phase, timestamp: Date.now(),
          message: `${targetPlayer} takes ${amount} damage (life: ${state.players[targetPlayer].life})`,
          type: 'EFFECT',
        });
        if (state.players[targetPlayer].life === 0) {
          state.winner = controller;
          state.step = 'GAME_OVER';
        }
        break;
      }

      case 'GAIN_LIFE': {
        const player = op.target === 'OPPONENT'
          ? ZoneManager.getOpponent(controller)
          : controller;
        state.players[player].life += op.value ?? 0;
        break;
      }

      case 'LOSE_LIFE': {
        const player = op.target === 'OPPONENT'
          ? ZoneManager.getOpponent(controller)
          : controller;
        state.players[player].life = Math.max(0, state.players[player].life - (op.value ?? 0));
        if (state.players[player].life === 0) {
          state.winner = player === 'P1' ? 'P2' : 'P1';
          state.step = 'GAME_OVER';
        }
        break;
      }

      case 'SET_POSITION': {
        const targets = EffectExecutor.resolveTargets(state, op, sourceCard, chosenTargets);
        for (const target of targets) {
          if (target.zone === 'FIELD') {
            target.position = target.position === 'ATTACK' ? 'GUARD' : 'ATTACK';
          }
        }
        break;
      }

      case 'SPECIAL_SUMMON': {
        // Search abyss or seal for a card matching filter, bring to field
        const targets = EffectExecutor.resolveTargets(state, op, sourceCard, chosenTargets);
        for (const target of targets) {
          if (ZoneManager.canSummonToField(state, target.controller)) {
            const t = ZoneManager.moveCard(state, target.instanceId, 'FIELD');
            triggers.push(...t);
          }
        }
        break;
      }

      case 'RETURN_TO_HAND': {
        const targets = EffectExecutor.resolveTargets(state, op, sourceCard, chosenTargets);
        for (const target of targets) {
          const t = ZoneManager.moveCard(state, target.instanceId, 'HAND', target.owner);
          triggers.push(...t);
        }
        break;
      }

      case 'SHUFFLE_DECK': {
        const player = op.target === 'OPPONENT'
          ? ZoneManager.getOpponent(controller)
          : controller;
        ZoneManager.shuffleDeck(state, player);
        break;
      }

      case 'SEARCH_DECK': {
        // Engine resolves by moving matching card to hand — UI must let player pick
        // For now: auto-pick first matching card from throne
        const player = op.target === 'OPPONENT'
          ? ZoneManager.getOpponent(controller)
          : controller;
        const deck = state.players[player].throne;
        const match = deck.find(c => {
          if (op.filter?.affinity && c.def.affinity !== op.filter.affinity) return false;
          if (op.filter?.type && c.def.type !== op.filter.type) return false;
          if (op.filter?.hasKeyword && !c.keywords.has(op.filter.hasKeyword)) return false;
          return true;
        });
        if (match) {
          const t = ZoneManager.moveCard(state, match.instanceId, 'HAND', player);
          triggers.push(...t);
          ZoneManager.shuffleDeck(state, player);
        }
        break;
      }

      case 'NEGATE': {
        // Negate top of stack
        if (state.stack.length > 0) {
          state.stack[state.stack.length - 1].negated = true;
          state.log.push({
            turn: state.turn, phase: state.phase, timestamp: Date.now(),
            message: `Effect negated by ${sourceCard.def.displayName}`,
            type: 'EFFECT',
          });
        }
        break;
      }

      case 'PREVENT_ATTACK': {
        const targets = EffectExecutor.resolveTargets(state, op, sourceCard, chosenTargets);
        for (const target of targets) {
          target.keywords.add('CANNOT_ATTACK');
        }
        break;
      }

      default:
        state.log.push({
          turn: state.turn, phase: state.phase, timestamp: Date.now(),
          message: `[WARN] Unimplemented op: ${(op as EffectOp).op}`,
          type: 'SYSTEM',
        });
    }

    return triggers;
  }

  // ---- Target Resolution ------------------------------------
  static resolveTargets(
    state: GameState,
    op: EffectOp,
    sourceCard: CardInstance,
    chosenTargets: CardInstance[]
  ): CardInstance[] {
    const controller = sourceCard.controller;
    const opponent = ZoneManager.getOpponent(controller);

    // If targets were explicitly chosen by UI, use them
    if (chosenTargets.length > 0) return chosenTargets;

    // Auto-resolve based on target type
    switch (op.target) {
      case 'SELF':
        return [sourceCard];

      case 'FIELD_OWN':
        return EffectExecutor.applyFilter(
          state.players[controller].field, op
        );

      case 'FIELD_OPPONENT':
        return EffectExecutor.applyFilter(
          state.players[opponent].field, op
        );

      case 'FIELD_ANY':
      case 'ALL_FIELD':
        return EffectExecutor.applyFilter(
          [...state.players[controller].field, ...state.players[opponent].field], op
        );

      case 'ALL_OPPONENT_FIELD':
        return state.players[opponent].field;

      case 'ALL_OWN_FIELD':
        return state.players[controller].field;

      case 'ABYSS_OWN':
        return EffectExecutor.applyFilter(
          state.players[controller].abyss, op
        );

      case 'ABYSS_OPPONENT':
        return EffectExecutor.applyFilter(
          state.players[opponent].abyss, op
        );

      case 'HAND_OWN':
        return EffectExecutor.applyFilter(
          state.players[controller].hand, op
        );

      case 'HAND_OPPONENT':
        return EffectExecutor.applyFilter(
          state.players[opponent].hand, op
        );

      default:
        return [];
    }
  }

  private static applyFilter(cards: CardInstance[], op: EffectOp): CardInstance[] {
    return cards.filter(c => {
      if (op.filter?.affinity && c.def.affinity !== op.filter.affinity) return false;
      if (op.filter?.type && c.def.type !== op.filter.type) return false;
      if (op.filter?.hasKeyword && !c.keywords.has(op.filter.hasKeyword)) return false;
      if (op.condition) {
        switch (op.condition.type) {
          case 'HAS_KEYWORD':
            if (!c.keywords.has(op.condition.keyword ?? '')) return false;
            break;
          case 'HAS_CURSE':
            if (!c.hasCurse) return false;
            break;
          case 'IS_AFFINITY':
            if (c.def.affinity !== op.condition.affinity) return false;
            break;
        }
      }
      return true;
    });
  }
}

