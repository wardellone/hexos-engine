// ============================================================
// HEXOS TCG — Game State Type Definitions
// ============================================================

import { CardDefinition, ZoneType, Position, Affinity, TriggerEvent } from './card';

// ---- CardInstance -------------------------------------------
// A live card in play — wraps its definition with mutable state
export interface CardInstance {
  instanceId: string;       // Unique per-game ID (e.g. "DINO_TRICERATOPS_p1_001")
  defId: string;            // Points to CardDefinition
  def: CardDefinition;      // Cached definition reference
  owner: PlayerId;          // Who owns this card
  controller: PlayerId;     // Who controls it (can differ after swap effects)
  zone: ZoneType;
  position: Position;       // ATTACK or GUARD (relevant on FIELD)
  atk: number;              // Current ATK (may differ from def.atk due to modifiers)
  core: number;             // Current CORE
  shield: number;           // Current SHIELD (only in GUARD position)
  keywords: Set<string>;    // Active keywords (including granted ones)
  counters: Map<string, number>; // Named counters (e.g. "RUNE" for NORD mechanics)
  hasCurse: boolean;
  isGoldStatue: boolean;    // GOLD-specific mechanic
  usedAbilities: Set<string>; // Ability IDs used this turn (for "once per turn")
  summonedThisTurn: boolean;
  attackedThisTurn: boolean;
  modifiers: StatModifier[]; // Temporary modifiers
}

export interface StatModifier {
  source: string;           // instanceId of the source card
  stat: 'ATK' | 'CORE' | 'SHIELD';
  delta: number;
  duration: 'PERMANENT' | 'UNTIL_END_OF_TURN' | 'WHILE_ON_FIELD';
}

// ---- Player -------------------------------------------------
export type PlayerId = 'P1' | 'P2';

export interface PlayerState {
  id: PlayerId;
  throne: CardInstance[];   // Deck (top = index 0)
  hand: CardInstance[];
  field: CardInstance[];    // Max 5 monsters on field
  abyss: CardInstance[];    // Graveyard
  seal: CardInstance[];     // Banished zone
  life: number;             // Starting: 8000
  hasCurse: boolean;
  eclipseActive: boolean;   // MIST/AZTEC mechanic
  ritosActivatedThisTurn: number;
  colossiSummonedThisTurn: number;
}

// ---- Game Phases --------------------------------------------
export type GamePhase =
  | 'AWAKENING'   // Draw phase — draw 1 card
  | 'STRATEGIC'   // Main phase — summon, activate Riti, Vassals, Pillar
  | 'CONFLICT'    // Battle phase — declare attacks
  | 'TERMINAL';   // End phase — discard to hand limit (6), trigger end effects

export type GameStep =
  | 'PHASE_START'
  | 'PLAYER_ACTION'         // Waiting for active player input
  | 'RESPONSE_WINDOW'       // Waiting for opponent response (Veto, VOW, Vassal, Pillar)
  | 'RESOLVE_EFFECT'        // Resolving top of action stack
  | 'DECLARE_ATTACK'
  | 'RESOLVE_COMBAT'
  | 'PHASE_END'
  | 'GAME_OVER';

// ---- Action Stack -------------------------------------------
export type ActionType =
  | 'SUMMON_COLOSSUS'
  | 'ACTIVATE_RITO'
  | 'ACTIVATE_VETO'
  | 'ACTIVATE_VASSAL'
  | 'ACTIVATE_PILLAR'
  | 'DECLARE_ATTACK'
  | 'TRIGGER_ABILITY'       // Auto-triggered (ON_ENTER_FIELD etc.)
  | 'EFFECT_OP';            // Individual effect operation

export interface StackEntry {
  id: string;               // Unique ID for this stack entry
  type: ActionType;
  sourceCard: string;       // instanceId of the card generating this
  sourceAbility?: string;   // abilityId
  controller: PlayerId;
  payload: Record<string, unknown>; // Type-specific data
  negated: boolean;         // Set to true if a Veto negates this
}

// ---- Game State ---------------------------------------------
export interface GameState {
  gameId: string;
  turn: number;             // Turn number (starts at 1)
  activePlayer: PlayerId;
  phase: GamePhase;
  step: GameStep;
  players: Record<PlayerId, PlayerState>;
  stack: StackEntry[];      // Action/effect stack (LIFO)
  triggerQueue: TriggerEntry[]; // Pending triggers to resolve
  log: LogEntry[];          // Full game log
  winner: PlayerId | null;
  turnStartTime: number;    // For timeout tracking
}

export interface TriggerEntry {
  event: TriggerEvent;
  sourceCard: string;       // What caused this trigger
  affectedCard?: string;    // What card the trigger is about
  data: Record<string, unknown>;
  controller: PlayerId;
}

export interface LogEntry {
  turn: number;
  phase: GamePhase;
  timestamp: number;
  message: string;
  type: 'ACTION' | 'TRIGGER' | 'EFFECT' | 'SYSTEM' | 'ERROR';
}

// ---- Player Actions (input from UI/CLI) ---------------------
export type PlayerAction =
  | { type: 'PASS' }
  | { type: 'SUMMON'; instanceId: string; position: Position }
  | { type: 'ATTACK'; attackerId: string; targetId: string | 'DIRECT' }
  | { type: 'ACTIVATE_ABILITY'; instanceId: string; abilityId: string; targets?: string[] }
  | { type: 'CHANGE_PHASE' }
  | { type: 'RESPOND_VETO'; vetoCardId: string; abilityId: string; targets?: string[] }
  | { type: 'RESPOND_PASS' }; // Pass on response window

// ---- Engine Events (output to UI) ---------------------------
export type EngineEvent =
  | { type: 'PHASE_CHANGE'; from: GamePhase; to: GamePhase }
  | { type: 'CARD_MOVED'; instanceId: string; from: ZoneType; to: ZoneType; controller: PlayerId }
  | { type: 'STAT_CHANGED'; instanceId: string; stat: string; from: number; to: number }
  | { type: 'KEYWORD_GRANTED'; instanceId: string; keyword: string }
  | { type: 'DAMAGE_DEALT'; targetPlayer: PlayerId; amount: number; sourceCard: string }
  | { type: 'ATTACK_DECLARED'; attackerId: string; targetId: string | 'DIRECT' }
  | { type: 'COMBAT_RESOLVED'; attackerId: string; targetId: string | 'DIRECT'; result: string }
  | { type: 'TRIGGER_FIRED'; event: TriggerEvent; sourceCard: string }
  | { type: 'EFFECT_NEGATED'; stackEntryId: string }
  | { type: 'GAME_OVER'; winner: PlayerId; reason: string }
  | { type: 'REQUEST_ACTION'; player: PlayerId; validActions: string[] }
  | { type: 'REQUEST_RESPONSE'; player: PlayerId; againstAction: string };
