// ============================================================
// HEXOS TCG — Zone Manager
// Handles all card movements between zones
// ============================================================

import { CardInstance, PlayerState, PlayerId, GameState, TriggerEntry } from '../types/game';
import { CardDefinition, ZoneType } from '../types/card';
import { generateId } from '../utils/id';

export const FIELD_MAX = 5;
export const HAND_MAX = 6; // Discard to this at end of turn

export class ZoneManager {

  // ---- Create a CardInstance from a CardDefinition ----------
  static createInstance(def: CardDefinition, owner: PlayerId): CardInstance {
    return {
      instanceId: generateId(def.defId, owner),
      defId: def.defId,
      def,
      owner,
      controller: owner,
      zone: 'THRONE',
      position: 'ATTACK',
      atk: def.atk ?? 0,
      core: def.core ?? 0,
      shield: def.shield ?? 0,
      keywords: new Set(def.keywords ?? []),
      counters: new Map(),
      hasCurse: false,
      isGoldStatue: false,
      usedAbilities: new Set(),
      summonedThisTurn: false,
      attackedThisTurn: false,
      modifiers: [],
    };
  }

  // ---- Move a card between zones ----------------------------
  static moveCard(
    state: GameState,
    instanceId: string,
    toZone: ZoneType,
    controller?: PlayerId
  ): TriggerEntry[] {
    const triggers: TriggerEntry[] = [];
    const { card, player } = ZoneManager.findCard(state, instanceId);
    if (!card) throw new Error(`Card not found: ${instanceId}`);

    const fromZone = card.zone;
    const targetController = controller ?? card.controller;
    const targetPlayer = state.players[targetController];

    // Remove from current zone
    ZoneManager.removeFromZone(state, card);

    // Update card state
    card.zone = toZone;
    card.controller = targetController;

    // Place in new zone
    ZoneManager.addToZone(targetPlayer, card, toZone);

    // Clean up field-specific state when leaving field
    if (fromZone === 'FIELD' && toZone !== 'FIELD') {
      card.attackedThisTurn = false;
      // Remove UNTIL_END_OF_TURN modifiers
      card.modifiers = card.modifiers.filter(m => m.duration !== 'UNTIL_END_OF_TURN');
    }

    // Queue triggers
    if (toZone === 'FIELD') {
      triggers.push({
        event: 'ON_ENTER_FIELD',
        sourceCard: instanceId,
        affectedCard: instanceId,
        data: { fromZone },
        controller: targetController,
      });
    }

    if (toZone === 'ABYSS' && fromZone !== 'ABYSS') {
      triggers.push({
        event: 'ON_CARD_TO_ABYSS',
        sourceCard: instanceId,
        affectedCard: instanceId,
        data: { fromZone },
        controller: card.owner,
      });

      if (card.def.type === 'COLOSSUS') {
        triggers.push({
          event: 'ON_DEATH',
          sourceCard: instanceId,
          affectedCard: instanceId,
          data: { fromZone },
          controller: card.owner,
        });
      }
    }

    if (toZone === 'HAND') {
      triggers.push({
        event: 'ON_CARD_TO_HAND',
        sourceCard: instanceId,
        affectedCard: instanceId,
        data: { fromZone },
        controller: targetController,
      });
    }

    if (toZone === 'SEAL') {
      triggers.push({
        event: 'ON_CARD_TO_SEAL',
        sourceCard: instanceId,
        affectedCard: instanceId,
        data: { fromZone },
        controller: card.owner,
      });
    }

    if (toZone === 'THRONE') {
      triggers.push({
        event: 'ON_CARD_TO_THRONE',
        sourceCard: instanceId,
        affectedCard: instanceId,
        data: { fromZone },
        controller: targetController,
      });
    }

    return triggers;
  }

  // ---- Draw N cards for a player ----------------------------
  static drawCards(state: GameState, playerId: PlayerId, count: number): TriggerEntry[] {
    const player = state.players[playerId];
    const triggers: TriggerEntry[] = [];

    for (let i = 0; i < count; i++) {
      if (player.throne.length === 0) {
        // Deck-out: player loses
        state.winner = playerId === 'P1' ? 'P2' : 'P1';
        state.step = 'GAME_OVER';
        state.log.push({
          turn: state.turn,
          phase: state.phase,
          timestamp: Date.now(),
          message: `${playerId} has no cards in deck — ${state.winner} wins!`,
          type: 'SYSTEM',
        });
        break;
      }

      const card = player.throne.shift()!;
      card.zone = 'HAND';
      player.hand.push(card);

      triggers.push({
        event: 'ON_DRAW',
        sourceCard: card.instanceId,
        affectedCard: card.instanceId,
        data: { player: playerId },
        controller: playerId,
      });
    }

    return triggers;
  }

  // ---- Mill N cards (throne → abyss) ------------------------
  static millCards(state: GameState, playerId: PlayerId, count: number): TriggerEntry[] {
    const player = state.players[playerId];
    const triggers: TriggerEntry[] = [];

    for (let i = 0; i < count; i++) {
      if (player.throne.length === 0) break;
      // Shift from top — card is already removed from throne, so move directly
      const card = player.throne.shift()!;
      card.zone = 'ABYSS';
      player.abyss.unshift(card);

      triggers.push({
        event: 'ON_CARD_TO_ABYSS',
        sourceCard: card.instanceId,
        affectedCard: card.instanceId,
        data: { fromZone: 'THRONE' },
        controller: playerId,
      });
      if (card.def.type === 'COLOSSUS') {
        triggers.push({
          event: 'ON_DEATH',
          sourceCard: card.instanceId,
          affectedCard: card.instanceId,
          data: { fromZone: 'THRONE' },
          controller: playerId,
        });
      }
    }

    return triggers;
  }

  // ---- Opponent helper --------------------------------------
  static getOpponent(player: PlayerId): PlayerId {
    return player === 'P1' ? 'P2' : 'P1';
  }

  // ---- Shuffle throne deck ----------------------------------
  static shuffleDeck(state: GameState, playerId: PlayerId): void {
    const deck = state.players[playerId].throne;
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
  }

  // ---- Field capacity check ---------------------------------
  static canSummonToField(state: GameState, playerId: PlayerId): boolean {
    return state.players[playerId].field.length < FIELD_MAX;
  }

  // ---- Find a card anywhere in game state -------------------
  static findCard(state: GameState, instanceId: string): { card: CardInstance | null; player: PlayerState | null } {
    for (const playerId of ['P1', 'P2'] as PlayerId[]) {
      const player = state.players[playerId];
      for (const zone of ['throne', 'hand', 'field', 'abyss', 'seal'] as const) {
        const card = player[zone].find(c => c.instanceId === instanceId);
        if (card) return { card, player };
      }
    }
    return { card: null, player: null };
  }

  // ---- Get all cards in a zone for a player ----------------
  static getZone(state: GameState, playerId: PlayerId, zone: ZoneType): CardInstance[] {
    const player = state.players[playerId];
    switch (zone) {
      case 'THRONE': return player.throne;
      case 'HAND': return player.hand;
      case 'FIELD': return player.field;
      case 'ABYSS': return player.abyss;
      case 'SEAL': return player.seal;
      default: return [];
    }
  }

  // ---- Internal helpers -------------------------------------
  private static removeFromZone(state: GameState, card: CardInstance): void {
    const player = state.players[card.controller];
    const zone = card.zone;
    switch (zone) {
      case 'THRONE': player.throne = player.throne.filter(c => c.instanceId !== card.instanceId); break;
      case 'HAND': player.hand = player.hand.filter(c => c.instanceId !== card.instanceId); break;
      case 'FIELD': player.field = player.field.filter(c => c.instanceId !== card.instanceId); break;
      case 'ABYSS': player.abyss = player.abyss.filter(c => c.instanceId !== card.instanceId); break;
      case 'SEAL': player.seal = player.seal.filter(c => c.instanceId !== card.instanceId); break;
    }
  }

  private static addToZone(player: PlayerState, card: CardInstance, zone: ZoneType): void {
    switch (zone) {
      case 'THRONE': player.throne.push(card); break;
      case 'HAND': player.hand.push(card); break;
      case 'FIELD': player.field.push(card); break;
      case 'ABYSS': player.abyss.unshift(card); break; // Most recent on top
      case 'SEAL': player.seal.push(card); break;
    }
  }
}
